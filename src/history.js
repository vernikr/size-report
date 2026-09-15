import fs from 'fs';
import path from 'path';
import { assertFullHistory, diskForm, diskHashes, git, headTree, readBlobs, readHistory } from './git.js';
import { METRICS, measureBlob, pointExact } from './metrics.js';
import { touchedSection } from './journal.js';
import { EXIT, refuse } from './refusal.js';

/* Walking the history: measuring per commit, shifting numbers, carrying state between commits,
 * comparing against the working tree, and building — the one point from which rows and state
 * leave this layer. The top floor of reading: below it are git and the metrics, above it only
 * assembled values. */

/* Why a commit got no row is a key rather than a text: the summary counts by it and `explain`
 * answers by it. The words a human reads live in `skipLine` and are the ones that used to be the
 * row itself: "no change of volume" also covers a commit that touched no column at all — the
 * report never made that distinction and the contract fixture preserves it, while the difference
 * is visible in `explain`, where it is needed. */
const SKIP_WORDS = { merge: 'merge', report: 'только таблица', flat: 'без изменения объёма' };

export function skipLine(dropped) {
  return dropped.sha.slice(0, 7) + ' (' + SKIP_WORDS[dropped.reason] + ')';
}

/* Whether a commit moved at least one number. Numbers are compared rather than the list of files:
 * an edit to whitespace or comments changes no size and its row would be empty, while a merge
 * gives zero cells whenever resolving the conflict produced what the branch already had. A column
 * the commit did not touch keeps the very same state object. */
function changesVolume(state, before, columns, metrics) {
  return columns.some((_col, i) => {
    const a = state[i], b = before[i];
    if (a === b) return false;
    if (a === null || b === null) return true;
    return metrics.some((m) => a.cells[m] !== b.cells[m]);
  });
}

/* The read plan: which `revision:path` pairs will be needed, and all the content at once —
 * otherwise every commit would cost one git call per column. A column may have both of its aliases
 * touched by one commit: with rename detection off, git reports the old name and the new one in
 * the same commit. All of them are collected — which one is really there is decided later, by the
 * blobs that came back. */
function readPlan(cfg, root, commits, needText) {
  const plan = commits.map((c) => {
    const changed = new Set(c.files);
    const picks = cfg.columns.map((col) => col.paths
      .filter((cand) => changed.has(cand))
      .map((path) => ({ path: path, spec: c.sha + ':' + path })));
    const journal = cfg.journal && changed.has(cfg.journal.path) ? c.sha + ':' + cfg.journal.path : null;
    return { picks: picks, journal: journal };
  });
  const specs = [];
  plan.forEach((p) => {
    p.picks.forEach((candidates) => { candidates.forEach((cand) => specs.push(cand.spec)); });
    if (p.journal !== null) specs.push(p.journal);
  });
  return { plan: plan, blobs: readBlobs(root, specs, needText) };
}

/* Measuring a blob with a memory kept for the run: a revision with the same content (a revert, a
 * repeated merge) is not measured twice. */
function measurer(cfg) {
  const measured = new Map(); // blob sha + metric → number
  return (name, blob, file, rev) => {
    const key = blob.sha + '\u0000' + name;
    if (measured.has(key)) return measured.get(key);
    const value = measureBlob(name, blob, file, cfg, rev);
    measured.set(key, value);
    return value;
  };
}

/* The commit's edits applied to the state: the alias taken is the one present in the commit
 * rather than the first in the settings order — a vanished name is absent from the commit, and a
 * state taken in settings order lost the file (and the comparison against the tree refused). */
function applyPicks(pass, c, picks) {
  picks.forEach((candidates, i) => {
    const pick = candidates.find((cand) => pass.blobs.get(cand.spec) !== undefined);
    if (pick === undefined) {
      // The path is in the commit but no blob came back for it — the file was deleted.
      if (candidates.length > 0) pass.state[i] = null;
      return;
    }
    const blob = pass.blobs.get(pick.spec);
    const cells = {};
    /* Approximation is a property of the path rather than of the blob: whether the format goes to
     * the minifier depends on its extension. It is computed here along with the measurement, and
     * so it does not enter the content cache. */
    const approx = {};
    pass.metrics.forEach((m) => {
      cells[m] = pass.measure(m, blob, pick.path, c.sha);
      approx[m] = !pointExact(m, pick.path, pass.cfg);
    });
    pass.state[i] = { path: pick.path, sha: blob.sha, cells: cells, approx: approx };
  });
}

/* One commit of the run: shift the state, then decide whether the commit needs a row. `pass` is
 * shared by the whole run (state, lists, measurement memory), so the function only moves it
 * forward. */
function stepCommit(pass, c, ci) {
  const plan = pass.plan[ci];
  let section = null;
  if (plan.journal !== null) {
    const journalBlob = pass.blobs.get(plan.journal);
    if (journalBlob !== undefined) {
      section = touchedSection(pass.journalPrev, journalBlob.text, pass.cfg.journal.pattern);
      pass.journalPrev = journalBlob.text;
    }
  }

  const before = pass.state.slice();
  applyPicks(pass, c, plan.picks);

  if (c.parents.length > 1 && !pass.cfg.rows.merges) { pass.dropped.push({ sha: c.sha, reason: 'merge' }); return; }
  if (c.files.length > 0 && c.files.every((f) => pass.skipPaths.indexOf(f) >= 0)) {
    pass.dropped.push({ sha: c.sha, reason: 'report' });
    return;
  }
  if (!changesVolume(pass.state, before, pass.cfg.columns, pass.metrics)) {
    pass.dropped.push({ sha: c.sha, reason: 'flat' });
    return;
  }
  if (c.files.some((f) => f === pass.cfg.output)) pass.mixed.push(c.sha.slice(0, 7));

  pass.rows.push({
    sha: c.sha,
    when: c.when,
    subject: c.subject,
    section: section,
    cells: pass.state.map((s) => (s === null ? null : s.cells)),
    approx: pass.state.map((s) => (s === null ? null : s.approx))
  });
}

/* The run over the history. A column's state is carried forward, and only the files changed by the
 * commit are measured again.
 *
 * `known` is the history already read: a pass that needs it for its own sake as well (coverage)
 * has no reason to call `git log` a second time. */
export function measureHistory(cfg, root, known) {
  const commits = known === undefined ? readHistory(root) : known;
  // The journal text is always needed: a link to a section is not a metric, but it is a read too.
  const needText = !!cfg.journal || cfg.metrics.some((m) => METRICS[m].needsText);
  const reads = readPlan(cfg, root, commits, needText);
  const pass = {
    cfg: cfg,
    metrics: cfg.metrics,
    plan: reads.plan,
    blobs: reads.blobs,
    measure: measurer(cfg),
    skipPaths: [cfg.output].concat(cfg.skip || []),
    state: cfg.columns.map(() => null),
    rows: [],
    dropped: [],
    mixed: [],
    journalPrev: ''
  };
  commits.forEach((c, ci) => stepCommit(pass, c, ci));
  /* Which columns the last commit touched, read from the same plan the state is carried along:
   * a column's path is in the list of paths the commit changed. The page puts those columns ahead
   * of the rest — the report is rebuilt after every commit, and a reader's first question is what
   * this edit brought.
   *
   * The commit taken is the last one that touched at least one column, counting back from the top.
   * Commits that went past the columns (above all the report itself, which the hook commits) are
   * skipped: an edit to the report is not an edit to the project. Otherwise the mark would depend
   * on the report's own commit — the same run would produce different bytes, the report would stop
   * being a fixed point, and the hook would commit it a second time. */
  let last = cfg.columns.map(() => false);
  for (let i = commits.length - 1; i >= 0 && !last.some(Boolean); i--) {
    const picks = reads.plan[i].picks.map((paths) => paths.length > 0);
    if (picks.some(Boolean)) last = picks;
  }
  return { rows: pass.rows, dropped: pass.dropped, mixed: pass.mixed, state: pass.state, last: last };
}

/* The comparison against the working tree answers two questions, and both are needed: the engine's
 * state at HEAD matches the tree of the commit, and the file on disk matches that same content.
 * The first catches an edit lost while carrying state between commits (in a merge commit missing
 * from the list of changed paths, say): a lost creation (the file is in the tree while the state
 * knows nothing of it), a lost edit (the file is on both sides with different content) and a lost
 * deletion (the state knows the file while the tree does not). An empty state is compared against
 * the aliases present in the tree rather than against nothing: a column whose file lived in the
 * history and was deleted before HEAD is empty on both sides — that is not a loss, and the report
 * shows as much. The second question is an edit the history does not hold at all, and sizes are no
 * good for it: on disk they depend on the checkout (`core.autocrlf=true`, the default in Git for
 * Windows, gives CRLF against LF), and the tool used to refuse to work where everything was in
 * order. Files edited in the tree drop out of the disk comparison: their content legitimately
 * differs between the commit and the disk. */
function assertMatchesDisk(state, cfg, root) {
  const dirty = new Set(git(root, ['status', '--porcelain']).split('\n')
    .map((l) => l.trim()).filter((l) => l !== '').map((l) => l.replace(/^\S+\s+/, '').replace(/^.* -> /, '')));
  const tree = headTree(root);
  const clean = [];
  cfg.columns.forEach((col, i) => {
    const s = state[i];
    const aliases = col.paths.filter((alias) => tree.has(alias));
    const p = s === null ? aliases[0] : s.path;
    const inTree = p === undefined ? undefined : tree.get(p);
    const lost = s === null ? aliases.length > 0 : inTree !== s.sha;
    if (lost) {
      refuse(EXIT.VIOLATION, 'состояние «' + col.label + '» на HEAD не совпало с деревом коммита (в дереве '
        + (aliases.length === 0 ? 'файла нет'
          : aliases.map((alias) => alias + ' ' + tree.get(alias).slice(0, 7)).join(', '))
        + ', в состоянии ' + (s === null ? 'файла нет' : s.path + ' ' + s.sha.slice(0, 7))
        + '): перенос состояния между коммитами пропустил правку'
        // Rebuilding is no fix here: the state comes from this very run, so no stale table is
        // involved in this disagreement. Hence the advice names not a fix command but the way to
        // show the thing.
        + '\n  починка: пересборкой это не лечится — расхождение в самом переносе состояния,'
        + ' а не в таблице. Разбор: git show HEAD:' + p);
    }
    if (p !== undefined && !dirty.has(p) && clean.indexOf(p) < 0) clean.push(p);
  });
  if (clean.length === 0) return;
  const onDisk = diskHashes(root, clean);
  clean.forEach((p) => {
    if (onDisk.get(p) === tree.get(p)) return; // git counts the file as unmodified
    if (fs.readFileSync(path.join(root, p)).equals(diskForm(root, 'HEAD', p))) return; // line endings are not reversible
    refuse(EXIT.VIOLATION, 'содержимое ' + p + ' на диске разошлось с HEAD (' + onDisk.get(p).slice(0, 7)
      + ' вместо ' + tree.get(p).slice(0, 7) + '), хотя git не считает файл изменённым: правка есть только на диске'
      + '\n  починка: закоммитьте правку или откатите её: git checkout -- ' + p);
  });
}

export function build(cfg, root) {
  assertFullHistory(root);
  const measured = measureHistory(cfg, root);
  assertMatchesDisk(measured.state, cfg, root);
  if (measured.mixed.length > 0) {
    console.error('! таблицу обновляли вместе с кодом: ' + measured.mixed.join(', ')
      + ' — так строка коммита не может попасть в сам коммит; обновляйте таблицу отдельным коммитом.');
  }
  return measured;
}

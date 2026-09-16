import { assertFullHistory, readHistory } from './git.js';
import { measureHistory } from './history.js';
import { sensorGaps } from './metrics.js';
import { outsideFix, pathRoles } from './config.js';
import { cliCommand } from './refusal.js';

/* Coverage — the answer to "did everything in the history get into the report". The project's rule of
 * completeness is one: every path the history touched has to be either a column or a declared exception
 * (`skip` and the report file itself), and a path that is neither is a violation — an edit went past the
 * report.
 *
 * Hence coverage is counted over the facts of the history (the union of the changed paths of every commit)
 * rather than over the file list in the tree: a file created and deleted before HEAD is invisible there
 * while the history remembers it, and its edits went into no number at all. The same place explains what
 * the tool does **not** claim: it does not say whether the project picked the "right" columns — only that
 * nothing went past them, and what exactly did not fit.
 *
 * The rows are counted by the same run as the reports (`measureHistory`), for the usual reason: there is no
 * second calculation in the package. That is the price — the answer costs one pass over the history, like
 * any report. */

// How many paths and commits to show a person in the text: the rest as a number.
const SHOW = 8;

/* The list of commits of one reason — lines no longer than a screen: a large history gathers fifty dropped
 * commits alone, and one line for all of them is not readable at all. Every one of them stays in the answer
 * (in full in `--json`), while the wrapping is what makes it readable. */
function wrapped(head, items) {
  const lines = [];
  let line = head;
  items.forEach((item, i) => {
    const piece = (i === 0 ? '' : ' ') + item + (i === items.length - 1 ? '' : ',');
    if (line.length + piece.length > 100) { lines.push(line); line = '      ' + piece.trim(); return; }
    line += piece;
  });
  lines.push(line);
  return lines;
}

const REASON_WORD = { merge: 'merges', report: 'report only', flat: 'no change of volume' };

function short(sha) {
  return sha.slice(0, 7);
}

/* The paths the history touched, split in three: tracked by columns, excluded by declaration, and unknown.
 * The judgement itself is one and lives with the settings (`pathRoles`); here it is only applied to the
 * whole history. */
function pathCoverage(cfg, commits) {
  const role = pathRoles(cfg);
  const seen = { covered: new Set(), excluded: new Set() };
  const unknown = new Map();
  commits.forEach((c) => {
    c.files.forEach((f) => {
      const kind = role(f);
      if (kind === 'columns') { seen.covered.add(f); return; }
      if (kind === 'excluded') { seen.excluded.add(f); return; }
      /* The commit that introduced the path is the first one in the history (reads run oldest first), and it
       * is shown to a person as evidence: it tells whose edit it was. */
      if (!unknown.has(f)) unknown.set(f, { path: f, since: c.sha, subject: c.subject });
    });
  });
  return {
    covered: [...seen.covered].sort(),
    excluded: [...seen.excluded].sort(),
    unknown: [...unknown.values()]
  };
}

/* The full answer: settings, history, paths, sensors — and the verdict. `ok` means only "nothing went past
 * the report": a sensor counting approximately does not change the verdict (it has an exit code of its own,
 * as in every other mode). */
export function coverage(cfg, root, configFile) {
  assertFullHistory(root);
  const commits = readHistory(root);
  const measured = measureHistory(cfg, root, commits);
  const paths = pathCoverage(cfg, commits);
  const byReason = { merge: 0, report: 0, flat: 0 };
  measured.dropped.forEach((d) => { byReason[d.reason] += 1; });
  return {
    schema: 1,
    ok: paths.unknown.length === 0,
    config: {
      file: configFile,
      columns: cfg.columns.length,
      metrics: cfg.metrics,
      excluded: [...new Set([cfg.output].concat(cfg.skip || []))].sort()
    },
    history: {
      commits: commits.length,
      rows: measured.rows.length,
      dropped: measured.dropped.map((d) => ({ sha: d.sha, reason: d.reason })),
      byReason: byReason
    },
    paths: {
      covered: paths.covered.length,
      excluded: paths.excluded.length,
      unknown: paths.unknown
    },
    sensors: sensorGaps(cfg)
  };
}

/* The text for a person: a short "yes", or the list of what did not fit — with the path, the commit that
 * introduced it, and a ready command. `cli` does the printing rather than this module: a module has no
 * output and must not have one. */
export function coverageText(rep) {
  const lines = [];
  const unknown = rep.paths.unknown;
  const counts = '  history: ' + rep.history.commits + ' commits, ' + rep.history.rows + ' rows, without a row '
    + rep.history.dropped.length;
  if (!rep.ok) {
    lines.push('✗ coverage: ' + unknown.length
      + (unknown.length === 1
        ? ' path of the history is neither tracked nor excluded'
        : ' paths of the history are neither tracked nor excluded'));
    unknown.slice(0, SHOW).forEach((u) => {
      lines.push('    ' + u.path + ' — since ' + short(u.since) + ' "' + u.subject.slice(0, 60) + '"');
    });
    if (unknown.length > SHOW) lines.push('    … and ' + (unknown.length - SHOW) + ' more');
    lines.push('  fix: ' + outsideFix(unknown.map((u) => u.path))
      + '; a draft of columns by extension: ' + cliCommand('--init draft.json'));
  } else {
    lines.push('✓ coverage: ' + rep.history.commits + ' commits of the history, ' + rep.history.rows
      + ' rows, every touched path is tracked or excluded');
  }
  lines.push(counts + ' (' + Object.keys(rep.history.byReason)
    .filter((k) => rep.history.byReason[k] > 0)
    .map((k) => REASON_WORD[k] + ' ' + rep.history.byReason[k]).join(', ') + ')');
  if (rep.history.dropped.length > 0) {
    ['merge', 'report', 'flat'].forEach((key) => {
      const shas = rep.history.dropped.filter((d) => d.reason === key).map((d) => short(d.sha));
      if (shas.length > 0) lines.push(...wrapped('    ' + REASON_WORD[key] + ' (' + shas.length + '): ', shas));
    });
  }
  lines.push('  paths: ' + rep.paths.covered + ' tracked, ' + rep.paths.excluded + ' excluded'
    + (rep.ok ? '' : ', ' + unknown.length + ' unknown'));
  return lines.join('\n');
}

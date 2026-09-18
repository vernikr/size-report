import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { MAX_BUF, git, gitArgv, gitEnv, gitTry, readHistory } from './git.js';
import { cliCommand, invocation } from './refusal.js';

/* Settings derived from the project itself: what to measure, where the journal is, where to write,
 * and what cannot be a column.
 *
 * Why separate from `src/config.js`: that one reads **ready** settings and checks them, while this
 * one looks at the project for the first time and guesses about almost everything — the same work
 * the draft used to do (`--init`). Hence the two roles of one output: with no settings file it *is*
 * the settings (the project works at once, having set up nothing), and under `--init` the very same
 * output is written to a file, which is edited afterwards. There is no second way to guess a project
 * in this package.
 *
 * Two rules, from which everything else follows.
 *
 * **A column is a file.** The report names a column by one path — the first of its list — while the
 * whole list is the column's renames, and a revision resolves whichever of them is present there. So
 * "a whole directory" cannot be a column, and the profile names files rather than groups of paths. A
 * column is **every** tracked file that can be measured: a sample of the project passed the volume of
 * the sample off as the volume of the project.
 *
 * **The profile has to pass the very check its first run will apply**: a path that became neither a
 * column nor a declared exception is code 1 on that first run. So `skip` names both what cannot be a
 * column (the report itself, dependency locks, built output, an unknown format, a file too large) and
 * what git does not track: that way the first `check` is green, and every file outside the report has
 * a stated reason for standing there.
 */

/* What may become a column at all: the text forms the engine can work with. A file without a known
 * extension (`LICENSE`, `.gitignore`) never becomes one and is named as an exception. */
const KNOWN_EXTS = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.scss',
  '.json', '.yaml', '.yml', '.toml', '.md', '.txt', '.py', '.rb', '.go', '.rs', '.sh'];

const JOURNALS = ['WORKLOG.md', 'CHANGELOG.md', 'CHANGES.md', 'HISTORY.md'];

/* The size threshold is a guard: a very large file is usually built or generated, and in the report
 * it would outweigh the whole project. */
const MAX_BYTES = 512 * 1024;

/* The index gives paths and sizes: `ls-files -s` yields the objects, and their sizes are asked for in
 * one batch (`cat-file --batch-check`) rather than by reading the content. */
function indexFiles(root) {
  const listed = git(root, ['ls-files', '-s']).split('\n').filter((l) => l !== '');
  const sizes = new Map();
  const shas = listed.map((l) => l.split(/\s+/)[1]);
  if (shas.length > 0) {
    const checked = execFileSync('git', gitArgv(['cat-file', '--batch-check=%(objectname)\t%(objectsize)']), {
      cwd: root, encoding: 'utf8', input: shas.join('\n') + '\n', maxBuffer: MAX_BUF, env: gitEnv()
    });
    checked.split('\n').forEach((l) => {
      const [sha, size] = l.split('\t');
      sizes.set(sha, Number(size));
    });
  }
  return listed.map((line) => ({ p: line.split('\t')[1], size: sizes.get(line.split(/\s+/)[1]) || 0 }));
}

/* The history is the union of the paths of every commit, read the same way coverage reads it
 * (`readHistory`): otherwise the profile and `check` would count different histories. A file living
 * only in the history is simply empty at HEAD — a fact rather than a loss, and it has to be a column
 * (or an exception). */
function historyPaths(root) {
  const seen = new Set();
  try {
    readHistory(root).forEach((c) => c.files.forEach((f) => seen.add(f)));
  } catch (e) {
    // A repository without commits has no history at all: `git log` refuses there, and that is a state
    // of the project rather than a defect of the tool — `--init` has to work in one too (a first run
    // may come before the first commit).
    if (/does not have any commits/.test(String(e.stderr))) return seen;
    throw e;
  }
  return seen;
}

// The tree and the history in one list: everything the history touched may become a column.
function allPaths(root) {
  const files = indexFiles(root);
  const known = new Set(files.map((f) => f.p));
  historyPaths(root).forEach((p) => {
    if (!known.has(p)) files.push({ p: p, size: 0 });
  });
  return files;
}

// Whether the project has this path at all; nothing else is asked of this helper.
function exists(root, p) {
  return fs.existsSync(path.join(root, p));
}

/* Where the report lands — one answer for the package: `docs/size-report.html`, with the directory
 * created by the writer (`writeFileEnsured`). A fork on the existence of `docs/` was measured and
 * dropped: a fresh project has no such directory, so the report ended up in the root — neither where
 * it is looked for nor where a person installing the package for the sake of the report would put it.
 * The directory is part of the address here, not a sign of a project. */
function outputOf() {
  return 'docs/size-report.html';
}

/* The package manager comes from a lock file rather than a guess: the command has to exist in
 * someone else's project. One answer for two places (the fix command and the `--init` prompt). */
export function packageManager(root) {
  if (exists(root, 'pnpm-lock.yaml')) return 'pnpm';
  return exists(root, 'yarn.lock') ? 'yarn' : 'npm';
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_e) {
    return null;
  }
}

/* The artifact's note and the refusals quote this command, so it has to work right here and now: the
 * project's own script only if it is declared (or `npm run sizes` answers "no such script", and
 * advice that does not work is the worst kind), otherwise the installed package inside the project.
 * The package name is deliberately absent from the command: with no package installed it would send the
 * reader to the registry, which serves a revision the project never pinned, while a path inside the
 * project refuses on the spot. */
function fixCommandOf(root) {
  const pkg = readJson(path.join(root, 'package.json')) || {};
  const script = pkg.scripts === undefined ? '' : pkg.scripts.sizes;
  if (typeof script !== 'string' || script === '') return invocation() + ' --write';
  return packageManager(root) + ' run sizes';
}

/* The commit link comes from the origin address: the two hosts are covered by one rule that builds
 * the address from the host and the repository path (GitLab nests subgroups, hence the whole path),
 * while any third host would be a guess leading somewhere else. No remote, or the wrong one — no
 * links: an empty template is simply not spelled out. */
const REMOTE_RE = /^\S+?(?:@|\/\/)(?:[^@/]*@)?(github\.com|gitlab\.com)[/:]+((?:[^/\s]+\/)*[^/\s]+?)(?:\.git)?$/;

function commitUrlOf(root) {
  const m = gitTry(root, ['remote', 'get-url', 'origin']).stdout.trim().match(REMOTE_RE);
  if (m === null) return '';
  const shape = m[1] === 'github.com' ? '/commit/{sha}' : '/-/commit/{sha}';
  return 'https://' + m[1] + '/' + m[2] + shape;
}

function journalOf(root) {
  return JOURNALS.find((p) => exists(root, p)) || '';
}

/* What never becomes a column: the report itself (its size depends on the number of rows, that is,
 * on itself), dependency locks (their size is about someone else's packages), maps and built output
 * (made by a build rather than by a person), and anything the engine cannot read. */
function generated(p, output) {
  const ext = path.extname(p).toLowerCase();
  return p === output || KNOWN_EXTS.indexOf(ext) < 0
    || /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|npm-shrinkwrap\.json|yarn\.lock|composer\.lock|bun\.lockb)$/.test(p)
    || /\.min\./.test(p) || /\.map$/.test(p);
}

/* A column's label is the file name; a clash of names in different directories is split by the path
 * and, if that is taken too, by a number. The settings check lets no repeated label through. */
function labelFor(used, p) {
  const candidates = [path.basename(p), p];
  const free = candidates.find((name) => used.indexOf(name) < 0);
  if (free !== undefined) return free;
  let n = 2;
  while (used.indexOf(p + ' (' + n + ')') >= 0) n++;
  return p + ' (' + n + ')';
}

/* How columns are chosen: everything measurable becomes one — that is, every file of the project
 * rather than a sample of it. The sample (formerly the largest file per extension, at most twelve)
 * lied twice: the report named the volume of files it did not contain, and a reader took that for the
 * volume of the project. The only things left out are those that **cannot** be a column: the report
 * itself, locks, built output, an unknown format, and a file too large (`generated` and `MAX_BYTES`) —
 * they go to `skip` and are named there.
 *
 * The order of columns is a ring over the extensions, largest first: what the project has most of comes
 * first, and within an extension the large comes before the small. That is the reading order of the
 * report rather than weight — numbers do not depend on it. */
function columnsOf(files, journal) {
  const byExt = new Map();
  files.forEach((f) => {
    const ext = path.extname(f.p).toLowerCase();
    const list = byExt.get(ext) || [];
    list.push(f);
    byExt.set(ext, list);
  });
  const rings = [...byExt.values()].map((list) => list.sort((a, b) => b.size - a.size));
  const used = [];
  const columns = [];
  const take = (p) => {
    columns.push({ label: labelFor(used, p), paths: [p] });
    used.push(columns[columns.length - 1].label);
  };
  if (journal !== '' && files.some((f) => f.p === journal)) take(journal);
  for (let round = 0; columns.length < files.length; round++) {
    const before = columns.length;
    rings.forEach((ring) => {
      const f = ring[round];
      if (f !== undefined && f.p !== journal) take(f.p);
    });
    if (columns.length === before) break;
  }
  return columns;
}

export function projectConfig(root) {
  const output = outputOf();
  const journal = journalOf(root);
  const files = allPaths(root);
  /* Only what git tracks becomes a column: a file absent at HEAD has nothing to measure (it would be
   * empty in every row of the report). A path living only in the history is therefore an exception
   * rather than a column, while the list of paths stays complete either way. */
  const tracked = new Set(indexFiles(root).map((f) => f.p));
  const readable = files.filter((f) => tracked.has(f.p) && !generated(f.p, output) && f.size <= MAX_BYTES);
  const columns = columnsOf(readable, journal);
  const taken = new Set(columns.reduce((all, c) => all.concat(c.paths), []));
  // The language, the title, the row order and the hook switch are derived from nothing: they come
  // from the defaults (`DEFAULT_CONFIG`) instead of being passed off as derived from the project.
  return {
    output: output,
    fixCommand: fixCommandOf(root),
    metrics: ['raw', 'min', 'tok'],
    // Real compression and a real dictionary rather than their cheaper substitutes: a new project must
    // not start with numbers counted another way. Without the optional dependency the metric falls back
    // to another count and the run returns code 4 — said by the metric label rather than left to a
    // default.
    minify: { engine: 'esbuild' },
    tokens: { family: 'openai', encoding: 'o200k_base' },
    columns: columns,
    journal: journal === '' ? null : {
      path: journal,
      url: (path.dirname(output) === '.' ? '' : '../') + journal,
      pattern: '^## (?<id>\\S+)\\s+(?<title>.+?)\\s*$',
      anchor: 'heading'
    },
    links: { commitUrl: commitUrlOf(root) },
    // Exceptions are everything that did not become a column: what cannot be one, and what git does
    // not track (a path from the history alone). That way the first run is complete, and what `skip`
    // names is the answer to "why is it not in the report".
    skip: [output].concat(files.filter((f) => !taken.has(f.p)).map((f) => f.p))
      .filter((p, i, all) => all.indexOf(p) === i)
  };
}

/* Whether the report's own path lies inside the project (non-empty, not absolute, not climbing out):
 * only such a path can be named as a leaf of the tree. */
const ownPath = (output) => output !== '' && !path.isAbsolute(output) && output.indexOf('..') !== 0;

/* The project catalogue for the page: every path git sees, with a reason for those that did not become
 * columns (`null` means it did — the page reads this mark to decide between a checkbox and a label).
 * The page's tree is the project's tree, so the paths come from the index rather than from the columns,
 * and the reasons follow **the same** rules the profile uses to pick columns (`generated` and the size
 * limit) — otherwise the hint would say one thing while the choice of columns did another. A column
 * whose file is gone from HEAD does not enter the catalogue: the index does not hold it, and the page
 * keeps its place in the tree.
 *
 * The report itself is always in the catalogue, both before it is first built and while it is not
 * tracked: whether it is tracked is a property of the moment rather than of the project. The report
 * must not depend on it — otherwise the first rebuild in a fresh clone yields different bytes (the
 * report appeared in the catalogue) and the hook commits it a second time out of nowhere. */
export function projectTree(root, output, measured) {
  const files = indexFiles(root);
  if (ownPath(output) && files.every((f) => f.p !== output)) files.push({ p: output, size: 0 });
  return files.sort((a, b) => (a.p < b.p ? -1 : 1)).map((f) => ({
    path: f.p,
    why: measured.indexOf(f.p) >= 0 ? null
      : (generated(f.p, output) || f.size > MAX_BYTES ? 'rule' : 'choice')
  }));
}

/* The draft's name (`sniffColumns`) stays public: the callers of the column output rely on it
 * (`test/api.test.js` holds the list of names), and the shape of the answer is the same — columns,
 * the extensions the project knows, and how many paths there are in total. */
export function sniffColumns(root) {
  const files = allPaths(root);
  const exts = [...new Set(files.map((f) => path.extname(f.p).toLowerCase()))]
    .filter((e) => KNOWN_EXTS.indexOf(e) >= 0).sort();
  return { columns: projectConfig(root).columns, exts: exts, total: files.length };
}

/* What to tell a person when there is no settings file and the settings had to be derived: one line
 * about what came out, one about how to pin it. The text comes from the same list as the `doctor`
 * finding: two answers about one thing must not drift apart in words. */
export function derivedSummary(cfg) {
  const labels = cfg.columns.map((c) => c.label);
  return 'settings derived from the project (no file): columns ' + cfg.columns.length
    + ' (' + labels.slice(0, 5).join(', ') + (labels.length > 5 ? ', …' : '') + '),'
    + ' paths skipped ' + cfg.skip.length;
}

export function derivedLines(cfg) {
  return [
    '! ' + derivedSummary(cfg),
    '  pin them with a file of their own (then edit it as you like; otherwise the set of columns'
      + ' changes from run to run): ' + cliCommand('--init')
  ];
}

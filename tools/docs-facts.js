/* Facts read out of the documentation — one copy for two checks (`test/docs-paths`,
 * `docs-commands`). The defect class they exist for is one: a
 * document names what is gone — a path after a move, a check count, a command or a flag the
 * tool does not know, "rebuilt byte for byte" about a dead command. Prose cannot promise that,
 * so the checks read facts instead: the git tree, the fixture's history, the tool's help
 * (`USAGE`), the check declarations in the suites, the sections of the target documents.
 *
 * What stays with the person, said out loud: wording and meaning, promises about the future,
 * whether a file's role is described correctly (the table is checked against the tree for
 * existence and completeness, not for a right description), and the declaration count matching
 * the checks the runner reports — that one holds because a check appears nowhere but at the
 * start of a line (the guard checks that too).
 *
 * Four documents stay out of the fact check, each for its own reason:
 * `worklog/archive/WORKLOG.md` and `docs/archive/README_old.md` are the journals of the past (their
 * numbers and paths are a snapshot and are supposed to age — the archived README is what the main
 * page used to carry, with all of its living prose moved into `docs/`), `docs/requirements.md` says
 * what the tool is meant to be, `docs/module-design.md` is the plan of the move — both are targets,
 * not the state of today's tree. References to their sections are checked all the same: they are a
 * target, not a source of claims.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, gitIn } from './harness.js';
import { USAGE } from '../src/size-table.js';
import { TOOL_PKG } from '../src/tool.js';

/* The package's name comes from the manifest rather than a literal: a guard has to name the very name the
 * tool is called by, or a rename would weaken the check in silence — the old pattern stops matching and the
 * count of bad calls drops to zero. */
export const PKG = TOOL_PKG.name;
const ESC = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CALL = ESC('node node_modules/' + PKG + '/bin/size.js');

/* Where the living prose of the README the main page used to be now lives, one fact per document:
 * the tree map (`FILES`) and the wiring guide with its surface for an agent (`WIRING`). The guards
 * read the file table from the first and the code-2 table from the second — the archive keeps only
 * its release notes and is no longer a source of claims about today. */
export const FILES = 'docs/files.md';
export const WIRING = 'docs/wiring.md';

/* The documents describing the repository's state **today**. */
export const DOCS = [
  'README.md', 'docs/architecture.md', FILES, WIRING, 'plans/archive/PLAN.md',
  'plans/archive/REFACTOR.md', 'BLOCKERS.md', 'templates/README.md'
];

/* Paths a document may name although the tree has no such file: the consumer project's, the
 * ones the tree has shed, the planned ones. The list is kept by hand — the check asks only that
 * a new such path lands here deliberately rather than slips through unnoticed. */
export const FOREIGN = [
  // the consumer project: its files, settings and scripts
  'size-table.config.json', 'docs/size-table.html', 'docs/size-report.html',
  '.github/workflows/size-report.yml', 'node_modules/' + PKG + '/templates/ci.yml',
  'tools/size-table.js', 'tests/size-table.js',
  '../figma/safe-resets/docs/ROADMAP.md', '../figma/safe-resets/docs/TESTING.md', '../figma/safe-resets/AGENTS.md',
  // past: the path the frozen copy of the implementation used to sit under — the copy is out
  // of the tree now, and records still name it
  'fixtures/legacy/size-table.cjs',
  // past: the contract suite was split by subject into four files, and historical records call
  // it by its former name — which is true of them
  'test/contract.test.js',
  // past: the release guard watched `CHANGELOG.md`, which left the tree; the archived plans
  // still name it, and that is true of them
  'test/changelog.test.js',
  // past: the count-of-checks guard and the install-pin guard left the tree with the numbers they
  // watched — the runs table carries no counts now and the install example pins no version; the
  // archived plans and the blockers record still name them, and that is true of them
  'test/docs-numbers.test.js', 'test/docs-pin.test.js',
  // past: the report became one file — a self-contained page — so the static form (markup
  // assembly and its styling) left the tree; past records still name these files, and that is
  // true of them
  'src/render.js', 'src/artifact.css',
  // planned: described as a goal, not as a fact
  'dist/app.js', '.size-report/report.html', '.size-report/data.json',
  'docs/METHODS.md', 'docs/DATA-FORMAT.md', 'docs/ARCHITECTURE.md',
  'docs/ROADMAP.md', 'docs/TESTING.md', 'tests/harness.js', 'tests/doc-sync.js',
  // an example in the text: how the tool's refusal on someone else's broken project looks
  'src/only-in-merge.js',
  // past: the stripe over a long drawing left the tree with the freeze it was drawn for — the table is a
  // window now and a switch costs milliseconds (`worklog/0208-table-window.md`), so the documents name the
  // chapter that is gone where they tell that story
  'src/page/work.js'
];

/* Documents other documents point at by section — the target of a reference, not a source of
 * claims. The name matches by basename: text writes both `PLAN.md` and `docs/requirements.md`. */
export const TARGETS = [
  'README.md', 'docs/architecture.md', FILES, WIRING, 'plans/archive/PLAN.md',
  'plans/archive/REFACTOR.md', 'BLOCKERS.md', 'worklog/archive/WORKLOG.md', 'docs/requirements.md',
  'docs/module-design.md'
];

export const tracked = gitIn(ROOT, ['ls-files']).split('\n').filter((l) => l !== '');
export const dirs = new Set();
tracked.forEach((f) => {
  const parts = f.split('/');
  for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
});
/* A path exists when the tree has it or a tracked file lies under it. A document may name a path
 * without its prefix (`page/app.js` beside `src/page/`): the name has to exist, the length of the
 * prefix is its own business. */
export const inTree = (p) => tracked.indexOf(p) >= 0 || dirs.has(p.replace(/\/$/, ''))
  || tracked.some((f) => f.slice(-(p.length + 1)) === '/' + p);

export function read(doc) {
  return fs.readFileSync(path.join(ROOT, doc), 'utf8');
}

/* A whole section: from its heading to the next one of the same level, or to the end. */
function withoutSection(text, title) {
  return text.replace(new RegExp('## ' + title + '[\\s\\S]*?(?=\\n## |$)'), '');
}

/* A claim about today is the text without what names the **absent** (the "not yet" section and
 * the `>` remark explaining the caveat): checking those as promises would be nitpicking at
 * wording. The guide about wiring the tool into another project is dropped only where **paths**
 * are concerned: its paths are someone else's, its commands are ours and must work — and there the
 * whole document is someone else's project, hence the `*`. */
export const NOT_TODAY = {
  'docs/architecture.md': ['What is not here yet'],
  [WIRING]: ['For an AI agent']
};
export const OWN_PROJECT = { [WIRING]: ['*'] };
export function facts(doc, sections) {
  let text = read(doc);
  (sections || []).forEach((title) => {
    // A `*` is the whole document rather than a section of it.
    text = title === '*' ? '' : withoutSection(text, title);
  });
  return text.replace(/^>.*$/gm, '');
}

// The document's code spans: paths, commands and flags live there.
export function spans(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

/* Whether a word looks like a **file** of the repository: it has a slash and an extension in its
 * last part. Directories are not taken: `dist/`, `build/`, `node_modules/` in prose name a
 * category ("build results") rather than a claim about the repository, and demanding they exist
 * would be nitpicking. A list of extensions (`.md/.toml/.txt`) and addresses (`file://…`) are not
 * paths either. */
export function looksLikePath(tok) {
  if (tok.indexOf('/') < 0 || tok.indexOf('://') >= 0 || tok.indexOf('//') >= 0) return false;
  /* A package with a version (`@vernikr/size-report@1.1.2-draft.0`) is not a path: only the
   * version makes its last part look like a name with an extension. */
  if (tok[0] === '@' && /@[^/]+$/.test(tok)) return false;
  if (/[{<*…«»\\}]/.test(tok) || tok.indexOf(' ') >= 0) return false;
  const parts = tok.split('/');
  if (parts.some((p) => p === '')) return false;
  if (parts.every((p) => /^\.\w+$/.test(p))) return false;
  return /\.\w{1,6}$/.test(parts[parts.length - 1]);
}

/* Commands and flags come from the tool's help: there is no second list and there must not be
 * one — the guard and the help would diverge in silence. */
/* The commands of the help's `Commands:` section: the first word of an entry — a line whose word
 * stands at two spaces of indent. The continuation lines of an entry are indented further and are
 * words of a sentence rather than names; reading them as commands let a document call `of something`
 * and stay green (the reason this derivation was narrowed). */
export const usageCommands = USAGE.split('\nCommands:\n')[1].split('\n\n')[0]
  .split('\n').filter((l) => /^ {2}\S/.test(l)).map((l) => l.trim().split(/\s+/)[0]);
export const usageFlags = [...USAGE.matchAll(/--[a-z][a-z-]*/g)].map((m) => m[0]);

/* A call to the tool: either a code span or a line of a code block (where it is run, not
 * mentioned in prose). A tail after `#` is the example's own comment, not arguments. */
const CALL_START = new RegExp('^\\s*(?:size|pnpm exec size|npm exec size|' + CALL + '|node bin/size\\.js|npx ' + ESC(PKG) + ')\\s');
export function invocations(text) {
  const lines = text.split('\n').filter((l) => CALL_START.test(l))
    .map((l) => l.split('#')[0].trim());
  return spans(text).concat(lines);
}

/* The call's words without the tool's name: `pnpm exec size check --json` → ['check', …]. */
export function callWords(call) {
  return call.replace(/^pnpm exec /, '').replace(/^npm exec /, '')
    .replace(new RegExp('^npx ' + ESC(PKG)), 'size')
    .replace(new RegExp('^node (?:node_modules/' + ESC(PKG) + '/bin|bin)/size\\.js'), 'size')
    .trim().split(/\s+/).slice(1);
}

/* A document's sections: a heading (`## 4.5.`, `## B1.`), a numbered item inside a section
 * (`4.8.4` is the fourth item of §4.8), a plan row (`| R-4.12 |`) and a note (`- **N8.`).
 * These are the addresses a document refers to itself by. */
export function sectionsOf(text) {
  const keys = new Set();
  let heading = '';
  text.split('\n').forEach((line) => {
    let m = line.match(/^#{2,4}\s*(?:(\d+(?:\.\d+)*)\.|([BN]\d+)\.)/);
    if (m) {
      heading = m[1] || m[2];
      keys.add(heading);
      return;
    }
    // An item with a full number (`25.5.`, `4.8.4.`) and one without it under a section (`4.`
    // inside §4.8 is §4.8.4). A closed note stays struck through but does not stop being an
    // address.
    m = line.match(/^(\d+(?:\.\d+)+)\.\s/);
    if (m) keys.add(m[1]);
    m = line.match(/^(\d+)\.\s/);
    if (m && /^\d+(\.\d+)*$/.test(heading)) keys.add(heading + '.' + m[1]);
    m = line.match(/^\|\s*(R-\d+\.\d+)\s*\|/);
    if (m) keys.add(m[1]);
    m = line.match(/^\s*-\s+(?:~~)?\*\*([BN]\d+)\./);
    if (m) keys.add(m[1]);
  });
  return keys;
}

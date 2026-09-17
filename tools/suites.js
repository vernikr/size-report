/* The split of the check set into the fast run and the full one.
 *
 * **Why the split goes like this.** What a check costs here is not the size of its file but how many times the file runs
 * the tool and git: every run is a Node process (tens of milliseconds) while a clone of the fixture and building the
 * artifact cost hundreds. Hence the fast run keeps the files that prove their point from what is read: sources, the git
 * tree, the help, the fixture's reference numbers. The full run keeps those that drive the tool many times over in clones
 * of their own, commit and install hooks; the reason for each stands in `SLOW`, line by line, so that "expensive" never
 * rests on a word.
 *
 * **The default is the full run.** A file becomes fast only here, explicitly and with a reason. So new expensive work
 * cannot slip into the fast run quietly: a file missing here goes to the full run, and the guard (`test/suites.test.js`)
 * demands a reason for it — that is, the declaration has to be made and will show up in a diff.
 *
 * **There are no time targets here, and that is a decision.** Seconds depend on the window — a machine's load is whatever
 * it is — so neither the run nor CI fails over time, and there is no snapshot of cost to agree with either: the duration
 * is printed by measurement (`tools/run-tests.js`) as a reference to what belongs in the full run, while the split rests
 * on what a file is about rather than on how long it takes.
 *
 * Every file's duration, one run at a time: `pnpm run suites:measure`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEST_DIR = path.join(ROOT, 'test');

/* The fast run: `pnpm test`. Every entry carries the reason it is here. */
export const FAST = [
  { file: 'test/api.test.js', why: 'the public API is frozen as a list: any change to the engine has to leave it untouched' },
  { file: 'test/refusals-catalog.test.js', why: 'the refusal catalogue against the sources: it reads files and counts refusal sites, and never runs the tool' },
  { file: 'test/runner.test.js', why: 'reading the output of a process: the pieces are glued by buffers — a pure function, with no git and no runs' },
  { file: 'test/docs-paths.test.js', why: 'the paths named by the documentation against the tree and the files table: it is edited in every pass, so it has to be checked in every pass' },
  { file: 'test/docs-commands.test.js', why: 'the calls, the refusal reasons and the section anchors against the help: the same promise of the documentation' },
  { file: 'test/docs-numbers.test.js', why: 'the check counts against the fact: a document ages in silence unless it is read every time' },
  { file: 'test/docs-pin.test.js', why: 'the install pin against the help of the pinned revision: the path by which the package is installed' },
  { file: 'test/git-pins.test.js', why: 'the boundary of the git call: it reads sources and history, and does not run the tool' },
  { file: 'test/templates.test.js', why: 'templates for a project of someone else: the settings draft and the description of a check in full — on a fresh small repository' },
  { file: 'test/guard.test.js', why: 'module parsing: it runs in a worker thread, hundreds of parses in one process — no runs at all' },

  { file: 'test/parity.test.js', why: 'parity with the reference: the main promise of the transfer — the byte counts match, and the report is assembled and passes its own check; the runs are cached and share one fixture' },
  { file: 'test/frozen.test.js', why: 'the frozen copy: whether the revision is the one and whether it reproduces the reference — the distinguisher between "the reference moved" and "the engine broke"' },
  { file: 'test/contract-data.test.js', why: 'the data contract: the numbers against the reference and the set of fields — it counts in memory and calls the tool once' },
  { file: 'test/contract-derived.test.js', why: 'the derived values against the artifact\'s numbers: the computational part counts the totals and the deltas from a file, and calls the tool once' },
  { file: 'test/page-view.test.js', why: 'the assembled page in a real DOM: the program pasted in, emptiness, the layout, switching — two assemblies, both on the shared fixture' },
  { file: 'test/page-cols.test.js', why: 'the columns of the table in a real DOM: their order, the widths counted for them and the switches reaching them — one page assembly, on the shared fixture' },
  { file: 'test/page-tree.test.js', why: 'the panel\'s file tree in a real DOM: folders by the project\'s paths, a subtree, scrolling on a rebuild — one page assembly, on the shared fixture' },
  { file: 'test/page-choice.test.js', why: 'the memory of a choice and the link in a real DOM: revisits and address changes — it counts in memory, one page assembly' },
  { file: 'test/suites.test.js', why: 'the guard of the split itself: it reads the declaration and the sources, and runs nothing' },
  { file: 'test/gates-verify.test.js', why: 'the guard of the check profile: it reads `run.js`, the workflows and the hooks — no tool runs, only three calls for the step list' }
];

/* The full run: `pnpm test:all`. Everything missing from `FAST`, plus a reason for the costliest ones — why they are here
 * rather than in the fast run. */
export const SLOW = [
  { file: 'test/cli-paths.test.js', why: 'where the tool writes: every case has its own clone and its own `--write` — without writing there is nothing to check' },
  { file: 'test/crlf.test.js', why: 'a checkout with CRLF: a comparison with the working tree on a clone carrying someone else\'s line-ending setting' },
  { file: 'test/environment.test.js', why: 'the hermeticity of the output: the same set in four environments of someone else — a clone and a run for each' },
  { file: 'test/check.test.js', why: 'completeness and explanation on the fixture\'s commits: nine checks, each one a run of the command' },
  { file: 'test/minify.test.js', why: 'real minification: numbers over the whole history against a simplification, plus the seam where the minifier is absent' },
  { file: 'test/tokens.test.js', why: 'tokens: a count by dictionary against an estimate over the whole history, with the encoding as part of the number' },
  { file: 'test/refusals.test.js', why: 'the refusals of the tool: thirty-three runs, one process per refusal, plus clones of its own (a hook of someone else, a truncated history, a branch past the report) — the cost here is in runs, not in size' },
  { file: 'test/module.test.js', why: 'a module in `.js` and the parsing guard: six assemblies on disk and a run on each one — the guard is proved by mutation rather than by a word' },
  { file: 'test/disk.test.js', why: 'a comparison with the working tree and three kinds of loss: a clone per case, each case an edit on disk' },
  { file: 'test/doctor.test.js', why: 'diagnostics on seven states of a project: a run of the tool per state and per check' },
  { file: 'test/cli.test.js', why: 'argument parsing and refusals: a sweep over combinations of modes, keys and words — each case in a process of its own' },
  { file: 'test/hook.test.js', why: 'the auto-update hook on a fresh clone: real commits, a merge, refusals and the removal — the costliest check of the set' },
  { file: 'test/release.test.js', why: 'a release from CI: it reads the workflow description as text — it runs neither git nor the tool' },
  { file: 'test/gates-metrics.test.js', why: 'the bloat sensor\'s probe: six linter runs and a truncation of the baseline — a process per probe, otherwise the probe would not prove the exit code' },
  { file: 'test/gates-dup.test.js', why: 'the duplication sensor\'s probe: a tree of copies of its own and a jscpd run per verdict (taking the baseline away, a living clone, a new copy, the portability of the baseline, no baseline)' },
  { file: 'test/gates-deps.test.js', why: 'the relations sensor\'s probe: four runs of the parser over small graphs of its own — a graph per class of finding' },
  { file: 'test/gates-coverage.test.js', why: 'the coverage sensor\'s probe: verdicts over ready reports plus a check of the baseline against the tree — no suite runs, but every probe is a process' },
  { file: 'test/gates-files.test.js', why: 'the gate-file guard\'s probe: a temporary repository of its own, commits and an amend — the cost is in git, not in size' }
];

/* The suite's files: what lies in `test/` and ends with `.test.js`. The list comes from disk rather than from the
 * declaration: a file absent from the declaration has to be noticed. */
export function testFiles() {
  return fs.readdirSync(TEST_DIR).filter((f) => /\.test\.js$/.test(f)).sort()
    .map((f) => 'test/' + f);
}

/* A file's checks: a declaration at the start of a line — the same rule the documentation guard counts checks by. A
 * declaration inside a loop would make the number a conclusion of the code, leaving nothing to compare it with. */
export function checksIn(file) {
  let n = 0;
  fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').forEach((line) => {
    if (/^test\(/.test(line)) n++;
  });
  return n;
}

/* The files of a run: the fast one is the declared list, the full one is the whole set from disk (including a file not yet
 * classified: an unclassified file sees the full run rather than a skip — the guard finds it before CI does). */
export function filesOf(mode) {
  if (mode === 'fast') return FAST.map((e) => e.file);
  if (mode === 'full') return testFiles();
  throw new Error('unknown run “' + mode + '” (there are: fast, full)');
}

/* Diagnostics in a single answer (`size doctor`): environment, optional dependencies, settings and
 * coverage — one answer, with an exit code an agent branches on and text a person reads.
 *
 * What is checked is not a happy run but every state of the project on its own: no settings (0 — they are
 * derived from the project), unreadable settings (2), full coverage (0), incomplete coverage (1), a
 * truncated history (3), a missing optional dependency (4) and a file the measurement cannot parse (2).
 * The answer has to match the state rather than be green always — hence the exit codes and the causes
 * named are what is under test.
 *
 * The answer is assembled from the same pieces as the other commands, and that is proved by comparison
 * rather than by description: the coverage block of the `doctor` answer has to be deep-equal to the whole
 * answer `size check` gives — a second calculation would drift from the first in silence. It is compared
 * as data rather than as bytes: one answer in two places, not two renderings of it.
 *
 * The cost is the seven states, each a process run and a pass over the history.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NO_OPTIONAL } from '../src/optional.js';
import {
  CONFIG, configWith, firstLine, gitIn, hasStack, initRepo, readJson, runSize, shallowClone, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('doctor');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const PLAIN = sharedClone('plain', tmp);
const OFF = { [NO_OPTIONAL]: '1' };

// The fixture's path left outside the columns, and the commit that brought it in.
const LOOSE = 'README.md';
const LOOSE_SINCE = '3294a69';

// A fresh project: two commits and no settings at all — what a first run sees.
function freshRepo(name) {
  const dir = initRepo(path.join(tmp, name));
  fs.writeFileSync(path.join(dir, 'src', 'code.js'), '// начало\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'начало']);
  fs.appendFileSync(path.join(dir, 'src', 'code.js'), 'var width = 1;\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'правка']);
  return dir;
}

test('a fresh project with no settings: it works on the derived ones, and that is said', () => {
  const dir = freshRepo('fresh');

  const res = runSize(dir, ['doctor']);
  assert.equal(res.code, 0, 'the project with no settings was not built: ' + firstLine(res.stdout + res.stderr));
  assert.equal(hasStack(res.stdout + res.stderr), false, 'the answer came with a stack instead of an explanation');
  assert.match(res.stdout + res.stderr, /settings derived from the project/,
    'the answer kept quiet about where the settings came from:\n' + res.stdout + res.stderr);
  assert.match(res.stdout + res.stderr, /--init/, 'no command pins the settings');
  assert.match(res.stdout, /coverage:/, 'coverage is not counted, though the settings are there:\n' + res.stdout);

  const rep = JSON.parse(runSize(dir, ['doctor', '--json']).stdout);
  assert.equal(rep.schema, 1, 'the answer has no schema — an agent has nothing to branch on');
  assert.equal(rep.exit, 0, 'the exit code in the answer is the wrong one');
  assert.equal(rep.config.ok, true, 'the derived settings are declared unreadable');
  assert.equal(rep.config.derived, true, 'the answer does not say the settings are derived');
  assert.equal(rep.coverage.ok, true, 'the coverage of a fresh project is declared incomplete');

  /* Fixing them in a file closes the question: afterwards the settings are the project's own, and the
   * answer says so. */
  const init = runSize(dir, ['--init']);
  assert.equal(init.code, 0, '--init did not pin the settings: ' + firstLine(init.stderr));
  const fixed = JSON.parse(runSize(dir, ['doctor', '--json']).stdout);
  assert.equal(fixed.config.derived, false, 'after --init the settings are still called derived');
  assert.equal(fixed.exit, 0, 'after the pinning the project stopped being healthy');

  // The derived profile asks the minifier and the dictionary — so the answer about dependencies is not
  // "unknown": it is the same question as with settings fixed in a file.
  assert.equal(rep.dependencies.every((d) => d.present !== null), true,
    'the dependencies were not asked about, though the settings were read: ' + JSON.stringify(rep.dependencies));
});

/* The default has to cover the project: a column is every measurable tracked file, `skip` the rest. A
 * sample instead of the whole project lies about it (names its volume by a handful of files) and leaves a
 * person to sort out the difference. This project holds two `.js` files: a choice of "one column per
 * extension" would leave a single one, so such a choice fails here. */
test('a fresh project with no settings: every tracked file is a column', () => {
  const dir = initRepo(path.join(tmp, 'default'));
  const write = (p, text) => fs.writeFileSync(path.join(dir, p), text);
  write('README.md', '# проект\n');
  write('src/one.js', '// один\nvar a = 1;\n');
  write('src/two.js', '// два\nvar b = 2;\n');
  write('LICENSE', 'MIT\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'начало']);
  // A file outside git is no project file: it does not become a column, and it stands in the report's
  // tree only because the tree comes from the project's paths rather than from the disk.
  fs.writeFileSync(path.join(dir, 'untracked.js'), '// не в git\n');

  const draft = path.join(tmp, 'default.json');
  assert.equal(runSize(dir, ['--init', draft]).code, 0, 'the settings draft was not built');
  const cfg = readJson(draft);
  assert.deepEqual(cfg.columns.map((c) => c.paths[0]).sort(),
    ['README.md', 'src/one.js', 'src/two.js'], 'not the whole sample of the project made it into the columns');
  assert.deepEqual(cfg.skip.slice().sort(), ['LICENSE', 'docs/size-report.html'],
    'the exclusions are the wrong ones: everything that can be measured is a column rather than a sample');
  assert.equal(cfg.columns.every((c) => c.paths.length === 1), true,
    'a column is named as a group of paths: a column is a file');
  assert.equal(runSize(dir, ['check']).code, 0,
    'the very first `check` on the derived settings is red — the profile does not cover the project');
});

/* Unreadable settings: the cause and the fix are the same as for any refusal, but the answer is honestly
 * incomplete — there is nothing to count coverage with and nobody to ask the sensors — and it says so in
 * words rather than in invented values. */
test('unreadable settings: code 2, the cause is named, coverage is not invented', () => {
  const bad = path.join(tmp, 'broken.json');
  fs.writeFileSync(bad, JSON.stringify({
    columns: [{ label: 'code.js', paths: ['src/code.js'] }], metrics: ['none']
  }, null, 2) + '\n');

  const res = runSize(PLAIN, ['--config', bad, 'doctor']);
  assert.equal(res.code, 2, 'unreadable settings are not treated as a refusal: '
    + firstLine(res.stdout + res.stderr));
  assert.match(res.stdout, /unknown metric/, 'the answer did not name the cause:\n' + res.stdout);
  assert.match(res.stdout, /unreadable/, 'the answer kept quiet about there being no settings:\n' + res.stdout);

  const rep = JSON.parse(runSize(PLAIN, ['--config', bad, 'doctor', '--json']).stdout);
  assert.equal(rep.ok, false, 'with unreadable settings the answer is declared healthy');
  assert.equal(rep.config.ok, false, 'the settings are declared readable');
  assert.equal(rep.coverage, null, 'coverage is invented while the settings are unreadable');
  assert.deepEqual(rep.dependencies.map((d) => d.present), [null, null],
    'the dependencies are called known, though the settings are not read yet');
});

test('full coverage: the answer says there is nothing to do and invents no problems', () => {
  const file = configWith(tmp, 'full.json', (cfg) => { cfg.skip = [LOOSE]; });

  const res = runSize(PLAIN, ['--config', file, 'doctor']);
  assert.equal(res.code, 0, 'a healthy project was not accepted (code ' + res.code + '):\n' + res.stdout + res.stderr);
  assert.match(firstLine(res.stdout), /^✓ /, 'the answer does not start with a confirmation:\n' + res.stdout);

  const rep = JSON.parse(runSize(PLAIN, ['--config', file, 'doctor', '--json']).stdout);
  assert.equal(rep.ok, true, 'on a healthy project the answer is not "nothing to do"');
  assert.equal(rep.exit, 0);
  assert.equal(rep.coverage.ok, true, 'the coverage of a healthy project is declared incomplete');
  assert.deepEqual(rep.findings, [], 'a finding is invented on a healthy project: ' + JSON.stringify(rep.findings));
});

test('incomplete coverage: code 1, the path is named, and it is the same answer as check gives', () => {
  const res = runSize(PLAIN, ['--config', CONFIG, 'doctor']);
  assert.equal(res.code, 1, 'incomplete coverage did not become a violation: ' + firstLine(res.stdout));
  assert.ok(res.stdout.indexOf(LOOSE) >= 0, 'the uncovered path is not named:\n' + res.stdout);
  assert.ok(res.stdout.indexOf(LOOSE_SINCE) >= 0, 'the commit that brought the path in is not named:\n' + res.stdout);

  const rep = JSON.parse(runSize(PLAIN, ['--config', CONFIG, 'doctor', '--json']).stdout);
  assert.equal(rep.ok, false);
  assert.equal(rep.exit, 1);
  assert.deepEqual(rep.coverage.paths.unknown.map((u) => u.path), [LOOSE]);

  /* Assembly rather than a second calculation: the coverage block is exactly the answer `size check`
   * gives. Were they to drift apart, a person would get two different answers to one question. */
  const chk = JSON.parse(runSize(PLAIN, ['--config', CONFIG, 'check', '--json']).stdout);
  assert.deepEqual(rep.coverage, chk, 'doctor counts coverage differently from check');
});

test('a truncated history: code 3 and the command that fills it in, not "no coverage"', () => {
  const dir = shallowClone(PLAIN, path.join(tmp, 'shallow'));

  const res = runSize(dir, ['--config', CONFIG, 'doctor']);
  assert.equal(res.code, 3, 'a truncated history is not treated as truncated: ' + firstLine(res.stdout));
  assert.match(res.stdout, /--unshallow/, 'there is no command that fills it in:\n' + res.stdout);

  const rep = JSON.parse(runSize(dir, ['--config', CONFIG, 'doctor', '--json']).stdout);
  assert.equal(rep.environment.shallow, true, 'the answer does not say the history is truncated');
  assert.equal(rep.coverage, null, 'coverage is counted over a truncated history');
});

/* Two things refuse inside coverage, and the difference is visible to a person: a truncated history is
 * repaired by fetching it, while a file the measurement cannot parse is repaired in the settings. So the
 * step names the kind of circumstance by the refusal's code, and this check holds that choice: the advice
 * "fetch the history" would name a cause that is not there. */
test('a file the measurement cannot parse: code 2 and a settings edit rather than fetching history', () => {
  const dir = freshRepo('unparsed');
  fs.writeFileSync(path.join(dir, 'src', 'bad.js'), '@@@ это не JavaScript\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'не JavaScript']);
  const file = configWith(tmp, 'unparsed.json', (cfg) => {
    cfg.columns = [{ label: 'bad.js', paths: ['src/bad.js'] }];
    cfg.skip = ['src/code.js'];
  });

  const res = runSize(dir, ['--config', file, 'doctor']);
  assert.equal(res.code, 2, 'an unparsed file is treated as a truncated history: '
    + firstLine(res.stdout + res.stderr));
  assert.match(res.stdout, /is not JavaScript/, 'the answer did not name the cause:\n' + res.stdout);
  assert.equal(res.stdout.indexOf('--unshallow'), -1,
    'the repair sends one to fetch a history this has nothing to do with:\n' + res.stdout);

  const rep = JSON.parse(runSize(dir, ['--config', file, 'doctor', '--json']).stdout);
  assert.equal(rep.exit, 2, 'the exit code in the answer is the wrong one');
  assert.equal(rep.coverage, null, 'coverage is counted, though the measurement refused');
  assert.equal(rep.findings.filter((f) => f.level === 'action').length, 1,
    'the measurement refusal is not named as a finding: ' + JSON.stringify(rep.findings));
});

test('an approximation of a sensor: code 4 with the cause and a ready repair', () => {
  const file = configWith(tmp, 'esbuild.json', (cfg) => {
    cfg.skip = [LOOSE];
    cfg.minify = { engine: 'esbuild', ext: {}, guard: ['.js', '.mjs', '.cjs'] };
  });

  const res = runSize(PLAIN, ['--config', file, 'doctor'], OFF);
  assert.equal(res.code, 4, 'the approximation went out as a success: ' + firstLine(res.stdout + res.stderr));
  assert.match(res.stdout, /"engine": "strip"/, 'there is no ready repair:\n' + res.stdout);

  const rep = JSON.parse(runSize(PLAIN, ['--config', file, 'doctor', '--json'], OFF).stdout);
  assert.equal(rep.exit, 4);
  assert.equal(rep.ok, false, 'an approximate count is declared a healthy state');
  assert.equal(rep.dependencies.find((d) => d.name === 'esbuild').present, false,
    'the unavailable minifier is called available');
});

/* Completeness outranks accuracy of the count: without it there are no numbers at all, while an
 * approximate number is still a number. So with two findings the exit code carries incompleteness, and the
 * approximation names itself in the text. */
test('two findings at once: the exit code is carried by the one without which there are no numbers', () => {
  const file = configWith(tmp, 'both.json', (cfg) => {
    cfg.minify = { engine: 'esbuild', ext: {}, guard: ['.js', '.mjs', '.cjs'] };
  });

  const rep = JSON.parse(runSize(PLAIN, ['--config', file, 'doctor', '--json'], OFF).stdout);
  assert.equal(rep.coverage.ok, false, 'the coverage of the fixture is declared full');
  assert.equal(rep.coverage.sensors.length, 1, 'the unavailable minifier is not named as a sensor');
  assert.equal(rep.exit, 1, 'the exit code is not carried by the most important finding');
  assert.equal(rep.findings.filter((f) => f.level === 'action').length, 1,
    'the repair of the sensor is not named together with the incompleteness: ' + JSON.stringify(rep.findings));
});

/* A sensor the settings are silent about is not "unknown whether present" but unneeded: the dictionary
 * weighs megabytes, and asking for it where no metric asked would mean paying for an answer the numbers
 * never needed (the same rule as in the report — `test/tokens.test.js`). */
test('a sensor the settings keep quiet about is called unneeded rather than missing', () => {
  const rep = JSON.parse(runSize(PLAIN, ['--config', CONFIG, 'doctor', '--json']).stdout);
  const tokens = rep.dependencies.find((d) => d.name === 'gpt-tokenizer');
  assert.equal(tokens.present, null, 'the dictionary is asked about where the metric did not ask for it');
  assert.match(tokens.note, /not asked for/, 'the silence about the sensor is not explained: ' + tokens.note);
});

test('doctor takes no arguments: a superfluous word is a refusal rather than a pass', () => {
  const res = runSize(PLAIN, ['doctor', 'extra']);
  assert.equal(res.code, 2, 'a superfluous word beside doctor is not a refusal: ' + firstLine(res.stdout + res.stderr));
  assert.equal(hasStack(res.stderr), false, 'the refusal printed a stack');
  assert.match(res.stderr, /"extra" is extra/, 'the refusal named a command rather than the cause:\n' + res.stderr);
  assert.match(res.stderr, /fix/, 'the refusal gives no ready command:\n' + res.stderr);
});

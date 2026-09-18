/* A probe of the bloat sensor (`pnpm run metrics`): an artificial violation has to colour the run
 * rather than slip through unseen. Each probe is the defect class the rule exists for: a function that
 * is a wall of code, a branching function, a check without an assertion, an assertion without a
 * comparison, a switched-off check, a debt marker.
 *
 * A probe goes **through stdin with a virtual file name** rather than through a file on disk: the name
 * decides which rules apply (`test/**` gets the test-weight rules on top of the size ones), and the tree
 * stays clean — otherwise the probe would land in the sensor and in the baseline itself.
 *
 * The ratchet is checked separately, both halves of its promise: what is already in the baseline passes
 * in silence, and a person's pruning works and breaks nothing (`--prune-suppressions` produces a subset
 * of the baseline rather than a refusal). Its baseline is one of its own, built on a file of its own: the
 * repository's may be empty — the whole debt sorted out is the sensor's goal rather than a broken
 * ratchet. A stale record (the violation was fixed, the line stayed in the baseline) does not fail the
 * gate: otherwise fixing code would require editing a gate file, which that same gate forbids without the
 * trailer.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, exec, probe, readJson, tempDir, write } from '../tools/gate-probe.js';

const tmp = tempDir('metrics');

/* The "live sensor" and ratchet probes are written **inside the repository**: ESLint lints only what
 * lies under its base path and quietly does nothing on a tree in a temporary directory — the probe would
 * go red on "file outside the base path" rather than on a violation. The place is chosen so that no
 * reader of the tree sees the leftovers: `reports/` is named in `.gitignore` and in the linter's ignores
 * as well. So an interrupted run (a killed process, a failed check) leaves neither an untracked file for
 * `git add -A` to pick up nor code that reddens `lint:strict` — the profile's first step. The sensor
 * itself does see the file: its ignore list (`eslint.metrics.config.js`) does not name the directory —
 * otherwise the probe would go red on the ignore rather than on a violation. The gates do not scan
 * `reports/` (their walk is `src`, `bin`, `tools`, `test`) and do not clean it. */
const SCRATCH = path.join(ROOT, 'reports', 'probe');

function scratch(name, source) {
  const file = path.join(SCRATCH, name);
  write(file, source);
  return path.relative(ROOT, file).split(path.sep).join('/');
}

/* A wall of code inside a function: the array is long enough to pass the limit, and the length comes out
 * red by `max-lines-per-function` alone (the statement count stays silent: there is one statement). */
const LONG = ['export function big() {', '  return [', '    0,'
].concat(Array.from({ length: 60 }, (_v, i) => '    ' + (i + 1) + ','))
  .concat(['  ];', '}', '']).join('\n');

/* A run of the sensor's rules over a piece of code: `--stdin-filename` decides which rule set applies
 * to it. Every expected rule has to be named — the shared part of two probes, so that parsing and
 * comparison are not written twice. */
function lint(text, stdinFilename, expected) {
  const res = exec('pnpm', ['exec', 'eslint', '--config', 'eslint.metrics.config.js',
    '--stdin', '--stdin-filename', stdinFilename, '--format', 'json'], { input: text });
  const found = [];
  try {
    JSON.parse(res.out).forEach((file) => file.messages.forEach((m) => found.push(m.ruleId)));
  } catch (_e) {
    assert.fail('the linter gave no report for ' + stdinFilename + ':\n' + res.out.slice(0, 600));
  }
  expected.forEach((rule) => {
    assert.ok(found.includes(rule), 'the rule ' + rule + ' did not paint ' + stdinFilename
      + ' (found: ' + (found.join(', ') || 'nothing') + ')');
  });
}

/* The debt line is assembled from parts: otherwise the probe would land in the debt sensor itself, which
 * reads this very file. */
const DEBT = 'TO' + 'DO' + ': починить';

/* All the violations sit in one probe per file rather than one probe per rule: a linter run costs
 * seconds, and six probes would cost six runs where two suffice (otherwise the sensor would become the
 * bloat it catches). Every rule is still checked by name. */
test('size, complexity and debt in the source paint the sensor', () => {
  const source = '// ' + DEBT + '\n'
    + 'export function big(x) {\n'
    + Array.from({ length: 70 }, (_v, i) => '  x = x + ' + i + ';\n').join('')
    + '  return x;\n}\n'
    + 'export function pick(x) {\n'
    + Array.from({ length: 14 }, (_v, i) => '  if (x === ' + i + ') return ' + i + ';\n').join('')
    + '  return -1;\n}\n';
  lint(source, 'src/probe-bad.js',
    ['max-lines-per-function', 'complexity', 'local/no-debt-marker']);
});

test('the weight of the checks paints the sensor by name', () => {
  const tests = "import { test } from 'node:test';\n"
    + "import assert from 'node:assert/strict';\n"
    + "test('ничего не проверяет', () => {\n  const ready = true;\n  ready.toString();\n});\n"
    + "test('слабое утверждение', () => {\n  const ready = true;\n  assert.ok(ready);\n});\n"
    + "test.only('одна на всех', () => {});\n"
    + "test('выключенная', { skip: true }, () => {});\n";
  lint(tests, 'test/probe-weak.test.js',
    ['local/assert-in-test', 'local/weak-assert', 'local/no-skipped-test']);
});

test('the ratchet holds both halves: the baseline passes in silence and pruning the baseline works', () => {
  const suppressions = path.join(ROOT, '.eslint-suppressions.json');
  assert.ok(fs.existsSync(suppressions), 'there is no suppressions file: the sensor would be brought down by its first run');
  const files = Object.keys(readJson(suppressions));
  assert.deepEqual(files.filter((f) => !fs.existsSync(path.join(ROOT, f))), [],
    'the baseline names a file the tree does not hold: a rename or a deletion makes'
      + ' the entry dead and the ratchet quietly weaker');

  /* The silent pass and the pruning are checked on a baseline of **its own** rather than on the
   * repository's: the whole debt may be sorted out — that is the sensor's goal, and a ban on emptiness
   * would not hold it — while a baseline of one's own can be built on exactly the violation under test
   * (that a new violation goes red is the neighbour probe's business). */
  const file = scratch('src/baselined.js', LONG);
  try {
    const own = path.join(tmp, 'ratchet-suppressions.json');
    exec('pnpm', ['exec', 'eslint', '--config', 'eslint.metrics.config.js',
      '--suppressions-location', own, '--suppress-all', file]);
    assert.ok(fs.existsSync(own), 'the baseline was not written — there is nothing to check the ratchet with');
    const kept = probe('metrics', ['--paths', file, '--baseline', own]);
    assert.equal(kept.code, 0, 'a violation from the baseline brought the gate down (the ratchet does not work):\n' + kept.out);

    /* A stale record (the violation is fixed, the line stays in the baseline) does not fail the gate,
     * while pruning takes it away: otherwise fixing code would require editing a gate file, which that
     * same gate forbids without the trailer. */
    write(path.join(ROOT, file), 'export const one = 1;\n');
    const stale = probe('metrics', ['--paths', file, '--baseline', own]);
    assert.equal(stale.code, 0, 'a stale entry of the baseline brought the gate down:\n' + stale.out);
    const copy = path.join(tmp, 'ratchet-pruned.json');
    fs.copyFileSync(own, copy);
    const pruned = exec('pnpm', ['exec', 'eslint', '--config', 'eslint.metrics.config.js',
      '--suppressions-location', copy, '--prune-suppressions', file]);
    assert.equal(pruned.code, 0, 'pruning the baseline did not go through:\n' + pruned.out.slice(0, 600));
    assert.deepEqual(readJson(copy), {}, 'pruning did not take the stale entry away');
  } finally {
    fs.rmSync(SCRATCH, { recursive: true, force: true });
  }
});

test('a violation the tree does not hold is named by the sensor all the same', () => {
  // The gate's baseline comes from the repository, so "the sensor is live" is checked on a file it
  // cannot hold: a file absent from the baseline, carrying a violation, has to go red.
  const file = scratch('src/plain.js', LONG);
  try {
    const res = probe('metrics', ['--paths', file]);
    assert.equal(res.code, 1, 'a new violation did not paint the sensor:\n' + res.out);
    assert.match(res.out, /new violations 1/, 'the sensor did not name the number of new violations:\n' + res.out);
  } finally {
    fs.rmSync(SCRATCH, { recursive: true, force: true });
  }
});

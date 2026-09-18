/* The port's parity: the engine's package yields exactly the bytes the fixture's golden was taken
 * from — numbers (`--json`) and the artifact. Telling "the engine broke" from "the golden moved" is
 * the frozen copy's business, a subject of its own (`frozen.test.js`).
 *
 * Read-only runs share one clone of the fixture and are cached (`readRun`): the same command in the
 * same environment must not be run twice for two checks. Runs that write (`--write` and the control
 * mode on their own report) take a clone of their own — they leave a file behind, and a shared clone
 * would no longer be the one the numbers were taken on.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG, PACKAGE, cloneFixture, firstDiff, golden, readRun, requireTarget, runFixtureWith,
  sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('parity');

const { text: goldenText, json: goldenJson } = golden();

/* The clone for read-only runs: `--json` and the locale check write nothing. */
const PLAIN = sharedClone('plain', tmp);

test('the package engine: --json is byte-identical to the reference', () => {
  requireTarget(PACKAGE);
  const res = readRun(PACKAGE, PLAIN, ['--json']);
  assert.equal(res.code, 0, 'the tool did not give --json (code ' + res.code + '): ' + res.stderr.trim());
  assert.equal(res.stdout, goldenText,
    'the --json output diverged from the reference: ' + firstDiff(res.stdout, goldenText));
});

test('the package engine: --write builds the report and passes its own control', () => {
  requireTarget(PACKAGE);
  const dir = cloneFixture(path.join(tmp, 'write'));
  const wrote = runFixtureWith(PACKAGE, dir, ['--write']);
  assert.equal(wrote.code, 0, 'the tool did not build the report: ' + wrote.stderr.trim());

  /* The report has to be self-contained: data, styles and program inside it, no external reference.
   * There is deliberately no byte comparison with the frozen copy's artifact: that copy wrote a static
   * table, so there is no form to compare — the numbers were compared above. */
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const report = fs.readFileSync(path.join(dir, cfg.output), 'utf8');
  ['src="', '<link '].forEach((mark) => assert.equal(report.indexOf(mark), -1,
    'the report carries an external link (' + mark + '): there would be nothing to open it with offline'));
  assert.ok(report.indexOf('id="data"') > 0, 'the report carries no data of the contract');
  assert.ok(report.indexOf('<style>') > 0, 'the report carries no styling');

  const checked = runFixtureWith(PACKAGE, dir, []);
  assert.equal(checked.code, 0,
    'the control mode is red on its own artifact: ' + checked.stderr.trim());

  const rows = /: (\d+) rows × (\d+) files/.exec(wrote.stdout);
  assert.notEqual(rows, null, 'the build did not report a number of rows: ' + wrote.stdout.trim());
  assert.equal(Number(rows[1]), goldenJson.rows.length, 'the number of rows diverged from the reference');
  assert.equal(Number(rows[2]), goldenJson.columns.length, 'the number of columns diverged from the reference');
});

test('the package engine: the numbers do not depend on the locale', () => {
  requireTarget(PACKAGE);
  const res = readRun(PACKAGE, PLAIN, ['--json'], { LC_ALL: 'C', LANG: 'C' });
  assert.equal(res.code, 0, 'under LC_ALL=C the tool crashed: ' + res.stderr.trim());
  assert.equal(res.stdout, goldenText,
    'under LC_ALL=C the output diverged from the reference (non-ASCII paths read differently): '
      + firstDiff(res.stdout, goldenText));
});

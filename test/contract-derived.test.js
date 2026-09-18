/* Derived quantities are computed by the page, and they have to agree with the artifact: row totals,
 * cell deltas and the delta of a total. The same code the page runs (`src/derived.js`) computes them —
 * here it is run straight from the file on disk, so what is checked is what got embedded rather than
 * what was promised.
 *
 * A separate concern is the column of a file that left and came back: it holds two cells of growth
 * while "now" is a single size, so its deltas sum to more than the current size. Such columns are
 * named (`GAPS`) so the rule cannot be changed silently; why it is so and what could be done about it
 * is in `BLOCKERS.md` §N4.
 *
 * The contract itself is in `test/contract-data.test.js`, the page in `page-view`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rowModel, stripModules, totalsOf } from '../src/size-table.js';
import { ROOT, tempDir } from '../tools/harness.js';
import { contractData } from '../tools/page-harness.js';

const tmp = tempDir('contract-derived');

const { data, golden } = contractData(tmp, 'numbers');

const allOn = () => data.files.map(() => true);
const allMetrics = { raw: true, min: true };

/* The page math: the same code the page executes. */
const derivedSrc = fs.readFileSync(path.join(ROOT, 'src', 'derived.js'), 'utf8');
const pageMath = new Function(stripModules(derivedSrc)
  + '\nreturn { rowModel: rowModel, totalsOf: totalsOf };')();

// Keys of the enabled metrics: what the page math takes as input.
function keysOn(view) {
  return data.metrics.filter((m) => view.metrics[m.key]).map((m) => m.key);
}

// Table rows in the page math's terms: the same thing the report is drawn from.
const models = data.rows.map((row, r) => rowModel(row.values, r === 0 ? null : data.rows[r - 1].values,
  keysOn({ metrics: allMetrics }), allOn()));

const GAPS = ['crlf.txt'];

test('the page totals agree with the artifact totals', () => {
  const metrics = keysOn({ metrics: allMetrics });
  const on = allOn();
  data.rows.forEach((row, r) => {
    assert.deepEqual(pageMath.totalsOf(row.values, metrics, on), golden.rows[r].totals,
      'row ' + (r + 1) + ': the total from the contract did not match the artifact total');
  });
});

test('the sum of the deltas over a column agrees with the current size when the file never vanished', () => {
  const metrics = keysOn({ metrics: allMetrics });
  const found = [];
  data.files.forEach((f, i) => {
    let deleted = false;
    data.rows.forEach((row, r) => {
      if (r > 0 && data.rows[r - 1].values[i] !== null && row.values[i] === null) deleted = true;
    });
    if (deleted) { found.push(f.label); return; }
    metrics.forEach((m, mi) => {
      let sum = 0;
      models.forEach((model) => { sum += model.files[i][mi].delta || 0; });
      assert.equal(sum, data.now[i] === null ? 0 : data.now[i][m],
        'column “' + f.label + '”/' + m + ': the deltas do not agree with the current size');
    });
  });
  assert.deepEqual(found, GAPS,
    'the set of columns with a returning file changed: the delta rule has to be reconsidered');
});

test('a returning file sums more deltas than its current size — and that is written down', () => {
  GAPS.forEach((label) => {
    const i = data.files.findIndex((f) => f.label === label);
    let sum = 0;
    models.forEach((model) => { sum += model.files[i][0].delta || 0; });
    assert.equal(sum, 117, 'the sum of the deltas of column “' + label + '” changed');
    assert.equal(data.now[i].raw, 63, 'the current size of column “' + label + '” changed');
    assert.ok(sum > data.now[i].raw, 'a returning file has to look like growth');
  });
});

/* A row total is derived too, and its delta has to be the sum of the deltas of the enabled files. The
 * one exception is a vanished file: its cell is "—" (no delta) while its volume leaves the total, so
 * on such a row the rule itself is checked: total delta = sum of deltas minus the vanished volume
 * (`BLOCKERS.md` §N4). */
test('the delta of a total equals the sum of the deltas over the files', () => {
  const metrics = keysOn({ metrics: allMetrics });
  const on = allOn();
  const withGone = [];
  data.rows.forEach((row, r) => {
    const prev = r === 0 ? null : data.rows[r - 1];
    const model = models[r];
    const gone = {};
    metrics.forEach((m) => { gone[m] = 0; });
    let vanished = false;
    data.files.forEach((_f, i) => {
      if (!on[i] || prev === null || prev.values[i] === null || row.values[i] !== null) return;
      vanished = true;
      metrics.forEach((m) => { gone[m] += prev.values[i][m]; });
    });
    if (vanished) withGone.push(row.subject);
    metrics.forEach((m, mi) => {
      let sum = 0;
      model.files.forEach((cells) => { sum += cells[mi].delta || 0; });
      sum -= gone[m];
      assert.equal(model.total[mi].delta, sum,
        'row ' + (r + 1) + '/' + m + ': the delta of the total diverged from the sum of the deltas over the files');
    });
  });
  assert.deepEqual(withGone, ['fixture: удаление файла'],
    'a vanished file changed the set of rows: the rule of the total’s delta has to be reconsidered');
});

test('what is switched off takes part neither in the table nor in the total', () => {
  const metrics = keysOn({ metrics: { raw: true, min: false } });
  const on = allOn();
  on[0] = false;
  assert.deepEqual(metrics, ['raw'], 'a switched-off metric stayed in the selection');

  const totals = totalsOf(data.now, metrics, on);
  let expected = 0;
  data.files.forEach((f, i) => {
    if (!on[i] || data.now[i] === null) return;
    expected += data.now[i].raw;
  });
  assert.equal(totals.raw, expected, 'the total counts switched-off files');
  assert.equal(rowModel(data.now, null, metrics, on).files.length, data.files.length - 1,
    'a switched-off file stayed in the table');
  assert.notEqual(totals.raw, totalsOf(data.now, metrics, allOn()).raw,
    'switching a file off changed nothing: the total does not depend on the choice');
});

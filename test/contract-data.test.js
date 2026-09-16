/* The data contract — what the engine hands the page: absolute values and the shape of the table.
 * Everything derived (deltas, totals, "now", filters) is computed by the page and must not be here.
 *
 * Checked against real output rather than a description:
 *
 *   1. the contract's numbers are compared with the fixture's frozen golden (taken by the same copy
 *      of the engine) — the contract has to carry the same truth as the artifact;
 *   2. the contract holds no derived quantity (checked by the set of fields, not on trust);
 *   3. accuracy is declared twice and in agreement: the metric says the worst in the column, a cell
 *      its own number;
 *   4. every file has a category, and the category is declared in the data.
 *
 * Derived quantities and the page are neighbouring suites (`contract-derived`, `page-view`,
 * `page-choice`): the file is split by subject, not by size.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORY_ORDER } from '../src/size-table.js';
import { readHistory } from '../src/git.js';
import { cloneFixture, gitIn, runFixture, tempDir } from '../tools/harness.js';
import { contractData } from '../tools/page-harness.js';
import { TOOL_PKG } from '../src/tool.js';

const tmp = tempDir('contract-data');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* The contract is taken once for the whole suite: it depends only on the fixture and the settings, and
 * that different clones agree is checked separately, by reproducibility. */
const { dir, text, data, golden } = contractData(tmp, 'numbers');

test('the contract is reproducible: two runs give the same bytes', () => {
  const second = cloneFixture(path.join(tmp, 'fixture-repro'));
  assert.equal(runFixture(second, ['--data']).stdout, text,
    'the data depend on the run: “floating” values would appear in the report');
});

test('the contract carries the same truth as the frozen reference', () => {
  assert.equal(data.schema, 1, 'the data schema is not declared');
  assert.equal(data.tool.name, TOOL_PKG.name, 'the tool name in the data diverged from the manifest');
  assert.deepEqual(data.metrics.map((m) => m.key), golden.metrics,
    'the set of metrics diverged from the reference');
  assert.equal(data.files.length, golden.columns.length, 'the number of files diverged from the reference');
  assert.equal(data.rows.length, golden.rows.length, 'the number of rows diverged from the reference');
  assert.deepEqual(data.skipped, golden.skipped, 'the skip reasons diverged from the reference');

  data.files.forEach((f, i) => {
    assert.equal(f.label, golden.columns[i].label, 'the file label diverged from the reference');
    assert.deepEqual(f.paths, golden.columns[i].paths, 'the file paths diverged from the reference');
  });

  data.rows.forEach((row, r) => {
    assert.equal(row.sha, golden.rows[r].sha, 'row ' + (r + 1) + ': the sha diverged');
    assert.deepEqual(row.values, golden.rows[r].cells,
      'row ' + (r + 1) + ': the absolute values diverged from the reference');
  });

  // "Now" — the same absolute values the artifact's deltas stand on.
  const last = golden.rows[golden.rows.length - 1].cells;
  assert.deepEqual(data.now, last, 'the current values diverged from the last row of the reference');
});

test('the contract holds no derived quantity at all', () => {
  const rowKeys = ['sha', 'when', 'subject', 'section', 'href', 'values'];
  const fileKeys = ['label', 'path', 'paths', 'category', 'categoryBy'];
  data.rows.forEach((row, r) => {
    assert.deepEqual(Object.keys(row).sort(), rowKeys.slice().sort(),
      'row ' + (r + 1) + ': a field appeared in the data besides the absolute values');
  });
  data.files.forEach((f, i) => {
    assert.deepEqual(Object.keys(f).sort(), fileKeys.slice().sort(),
      'file ' + (i + 1) + ': the set of fields diverged from the contract');
  });
  assert.equal(Object.prototype.hasOwnProperty.call(data, 'totals'), false,
    'the engine computed totals — that is the page’s business: it alone knows what is switched on');
});

/* The catalogue is the project tree for the page: every path git sees, not just the columns. A reason
 * mark reads unambiguously: empty — the file is measured (and then it is among the columns), `rule` —
 * it cannot be a column (a rule of the package), `choice` — it could be, but was not picked. The check
 * runs against the git tree, not a description. */
test('the catalogue names every file of the project, and a reason only for those outside the report', () => {
  const tracked = gitIn(dir, ['ls-files']).split('\n').filter((l) => l !== '').sort();
  /* The report itself is always named, and that is part of the rule rather than an exception: whether
   * it is tracked is a property of the moment, and the report must not depend on it. */
  const artifactPath = data.report.artifact;
  const expected = tracked.indexOf(artifactPath) >= 0 ? tracked : tracked.concat([artifactPath]).sort();
  assert.deepEqual(data.catalog.map((e) => e.path).sort(), expected,
    'the catalogue diverged from the git tree: the page’s tree is the project’s tree');
  const measured = data.files.map((f) => (f.path === null ? f.paths[0] : f.path));
  const named = data.catalog.filter((e) => e.why === null).map((e) => e.path);
  assert.deepEqual(named.sort(), measured.filter((p) => tracked.indexOf(p) >= 0).sort(),
    'the “measured” mark stands on the wrong files');
  data.catalog.filter((e) => e.why !== null).forEach((e) => {
    assert.ok(['rule', 'choice'].indexOf(e.why) >= 0,
      'file ' + e.path + ': no reason is named (' + JSON.stringify(e.why) + ')');
  });
  assert.equal(data.catalog.find((e) => e.path === artifactPath).why, 'rule',
    'the report itself is named a column, which it cannot be');
  assert.ok(data.catalog.some((e) => e.why === 'choice'),
    'the catalogue holds no file with the reason “not chosen for the columns”');
});

/* The mark "the last commit touched this column" is a fact from history and is checked against that
 * history: the newest commit touching at least one column, counted from the tip backwards, because
 * commits past the columns (and the report the hook commits) are skipped. The page puts the marked
 * columns first, and a mistake here would go unnoticed: the order of columns is not a number, and no
 * standard checks it. */
test('the last commit is named by history: exactly the columns it touched are marked', () => {
  const aliases = data.files.map((f) => f.paths);
  const history = readHistory(dir);
  assert.ok(history.length > 0, 'the fixture has no history — there is nothing to check the mark against');
  /* The mark is set by the newest commit that touched at least one column, and a column is marked if
   * that commit touched it. */
  const real = [...history].reverse()
    .find((c) => c.files.some((f) => aliases.some((paths) => paths.indexOf(f) >= 0)));
  assert.notEqual(real, undefined, 'the fixture’s history has no commit that touched a column');
  assert.deepEqual(data.last, aliases.map((paths) => paths.some((p) => real.files.indexOf(p) >= 0)),
    'the mark of the last commit did not match the paths it changed');
  assert.equal(data.last.length, data.files.length, 'there are fewer marks than columns');
});

test('a metric that is not minification is marked as an approximation', () => {
  data.metrics.forEach((m) => {
    assert.ok(m.label && m.note && m.method, 'metric “' + m.key + '” has no description of its method');
    assert.ok(['exact', 'approximate'].indexOf(m.accuracy) >= 0, 'metric “' + m.key + '” has no accuracy declared');
  });
  const min = data.metrics.find((m) => m.key === 'min');
  assert.equal(min.accuracy, 'approximate',
    'stripping comments is passed off as minification: the metric carries no approximation mark');
});

/* Accuracy is declared twice, and these are not two answers to one question: for the metric it is the
 * worst in the column, for a cell its own number. That is why the fixture is mixed: `package.json` is
 * exact (JSON loses only insignificant whitespace — the one strategy that is minification itself),
 * while every other format is measured by stripping, since the fixture's settings ask for no minifier.
 *
 * The agreement of the two answers is checked, not the presence of a field: a metric with not a single
 * mark cannot say "approximate", and a row of marks has to cover exactly all cells — rows and "now"
 * separately. */
test('accuracy is declared per cell, while the metric’s label is the worst in the column', () => {
  data.metrics.forEach((m) => {
    const marks = data.approx[m.key];
    if (marks === undefined) {
      assert.equal(m.accuracy, 'exact',
        'metric “' + m.key + '” promises accuracy without naming a single approximate cell');
      return;
    }
    assert.equal(m.accuracy, 'approximate',
      'metric “' + m.key + '” has approximate cells, while its label promises accuracy');
    assert.equal(marks.rows.length, data.rows.length * data.files.length,
      'the row of marks does not cover the cells of the rows');
    assert.equal(marks.now.length, data.files.length, 'the row of marks does not cover the “now” row');
    assert.equal(/[^01]/.test(marks.rows + marks.now), false,
      'the marks hold a sign besides “exact/approximate”: ' + marks.rows.slice(0, 40));
  });

  /* Mixedness is what this row exists for: were all cells of one mark, a per-cell mark would add
   * nothing to the metric's label. */
  const min = (data.approx || {}).min;
  assert.notEqual(min, undefined, 'the contract holds no approximate-cell marks');
  const json = data.files.findIndex((f) => f.label === 'package.json');
  const md = data.files.findIndex((f) => f.label === 'заметки.md');
  assert.equal(min.now.charAt(json), '0',
    'an exact format (JSON is parsed whole) is marked as an approximation');
  assert.equal(min.now.charAt(md), '1', 'stripping is passed off as exact minification');
  assert.ok(min.rows.indexOf('0') >= 0 && min.rows.indexOf('1') >= 0,
    'the report holds no cells of both signs — there is nothing to check per cell');
});

test('every file has a category, and it is declared in the data', () => {
  const declared = data.categories.map((c) => c.key);
  data.categories.forEach((c) => assert.ok(c.label, 'category “' + c.key + '” has no label'));
  assert.deepEqual(declared, CATEGORY_ORDER.filter((k) => declared.indexOf(k) >= 0),
    'the categories do not come in the declared order');
  data.files.forEach((f) => {
    assert.ok(declared.indexOf(f.category) >= 0, 'file ' + f.path + ': the category is not declared');
    assert.ok(['auto', 'config'].indexOf(f.categoryBy) >= 0,
      'file ' + f.path + ': it is not said where the category came from');
  });
  assert.ok(data.files.some((f) => f.category === 'docs'), 'the fixture has documentation');
  assert.ok(data.files.some((f) => f.category === 'code'), 'the fixture has code');
});

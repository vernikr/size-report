/* The data contract — what the engine hands the page: absolute values and the shape of the table.
 * Everything derived (deltas, totals, "now", filters) is computed by the page and must not be here.
 *
 * Checked against real output rather than a description:
 *
 *   1. the contract's numbers are compared with the fixture's frozen golden (taken by the same copy
 *      of the engine) — the contract has to carry the same truth as the artifact;
 *   2. the contract holds no derived quantity (checked by the set of fields, not on trust);
 *   3. the way a number was obtained is one (the metric's method) and no judgement about it is
 *      carried: no field of precision, no marks per cell;
 *   4. every file has a category, and the category is declared in the data;
 *   5. the page's block is this contract in sparse form, and the round trip restores it whole.
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
import { pagePacked, pagePayload } from '../src/page/build.js';
import { cloneFixture, gitIn, runFixture, tempDir } from '../tools/harness.js';
import { contractData, pageDecode, unpackPack } from '../tools/page-harness.js';
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

/* The page's block is the contract in **sparse form** rather than the contract itself, and that is the seam where a
 * number can quietly disappear: the encoder writes the history as changes, the decoder unrolls it back
 * (`src/page/payload.js`, both sides pasted into the page). So what stands here is a round trip on real output — the
 * contract encoded, decoded by the page's own chapter and compared whole — rather than the format described.
 *
 * Three things are declared as not surviving, and each has its reason: the list of skipped commits changes with the
 * report's own commit and would stop the file from being a fixed point (the encoder's own comment), while the
 * report's `heading` (the artifact's `<h1>`, built before the block) and `journal` are words the page never reads.
 * `schema` is not lost but re-marked: 1 is the contract's shape, 2 the block's.
 *
 * The second half is the other half of a fixed point: the same contract has to give the same bytes twice — the hook
 * rebuilds the artifact after every commit and would otherwise commit it forever. */
test('the sparse block restores the contract whole, through the packing, and twice over the same bytes', () => {
  const want = JSON.parse(JSON.stringify(data));
  want.schema = 2;
  delete want.skipped;
  delete want.report.heading;
  delete want.report.journal;
  assert.deepEqual(pageDecode(pagePayload(data)), want,
    'the round trip through the sparse block lost or moved something');

  /* The other half of the way: the block travels in the file **packed** (gzip inside base64, `pagePacked`), and the
   * packing is the page's transport rather than the block's shape. So the round trip is taken through it as well,
   * with the platform's own zlib (`unpackPack`) rather than with a decoder of the check's own — and the transport
   * has to be smaller than what it carries, or it would be weight added rather than saved. */
  const encoded = JSON.stringify(pagePayload(data));
  assert.deepEqual(unpackPack(pagePacked(encoded)), pagePayload(data),
    'the packing lost or moved something of the block');
  assert.ok(pagePacked(encoded).length < encoded.length,
    'the packed block is larger than the block itself: ' + pagePacked(encoded).length + ' against ' + encoded.length);

  assert.equal(JSON.stringify(pagePayload(data)), JSON.stringify(pagePayload(JSON.parse(text))),
    'two encodes of one contract gave different bytes: the artifact would stop being a fixed point');
  assert.equal(pagePacked(encoded), pagePacked(JSON.stringify(pagePayload(JSON.parse(text)))),
    'two packings of one block gave different bytes: the artifact would stop being a fixed point');
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

test('a metric describes the way it was counted and judges nothing', () => {
  data.metrics.forEach((m) => {
    assert.ok(m.label && m.note && m.method, 'metric “' + m.key + '” has no description of its method');
    assert.deepEqual(Object.keys(m).sort(), ['key', 'label', 'method', 'note'],
      'metric “' + m.key + '” carries a field besides the way it was counted');
  });
  /* The splitting of numbers into exact and approximate was taken out of the package: a cell is a number,
   * and how it was obtained is said once, in the method. Checked on the bytes rather than on the parsed
   * object, because both a field and a record of marks would be its second place. */
  assert.equal(/"accuracy"|"approx"/.test(text), false,
    'the contract still carries a judgement about the precision of its numbers');
});

/* What a reader can learn about the way column `min` was measured is the method, and it has to keep naming
 * the formats counted another way — that is the one answer the removed per-cell marks used to dress. The
 * fixture is mixed on purpose: `package.json` is minified by parsing (JSON loses only insignificant
 * whitespace) while every other format is measured by stripping, since the fixture's settings ask for no
 * minifier. */
test('the method names the way a number was obtained, and no word of precision is left', () => {
  const min = data.metrics.find((m) => m.key === 'min');
  /* The fixture's settings ask for no minifier, so the whole column is counted one way and the method says
   * which one — in words, rather than as a mark of precision repeated on every cell. */
  assert.match(min.method, /снятие комментариев и отступов/,
    'the method does not say how the numbers were obtained: ' + min.method);
  assert.match(min.method, /не минификация/, 'the method passes stripping off as minification: ' + min.method);
  assert.equal(/приближ|точно/.test(min.method), false, 'the method judges its numbers: ' + min.method);
  /* Nothing is counted another way here, so no format is named: that list belongs to a run asking for the
   * minifier, where part of the column really is measured differently. */
  assert.equal(min.method.indexOf('остальные форматы'), -1,
    'a way of counting that no setting asked for is named in the method: ' + min.method);
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

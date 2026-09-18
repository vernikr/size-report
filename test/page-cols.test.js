/* The table's columns: their order, the caption over a group, and a choice that leaves the others where they are.
 *
 * The order is about the reader rather than about the numbers: the report is rebuilt after every commit, and the first
 * question is what that edit brought. So a file's column stands by the newest row in which its numbers moved — not by
 * the commit's list of paths, which names files a commit touched without moving them — and the files that moved in one
 * and the same row keep the settings' order between them. The expectation is counted from the contract
 * (`columnRank` of the harness) rather than taken from the page, and read off the header, which is where the reader
 * sees it.
 *
 * A column has three lives at once — the cells that draw it, the caption over it and its place in the extent of the
 * grid — and the page keeps them together by building the window out of the columns that are on: a caption spans
 * exactly the metrics of its group, and a column that is not built holds no band of emptiness in the extent.
 *
 * The assembled page in a real DOM (jsdom), on the shared fixture of the page suites: `page-view` reads the page as a
 * whole, `page-tree` the panel, `page-choice` the memory of a choice and the link, and `page-grid` the window itself.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  captions, columnOrder, columnRank, fileBox, metricBox, metricCaptions, pageReady, toggleBox, where
} from '../tools/page-harness.js';

const { data, openPage } = pageReady('cols');

const order = columnOrder(data);
const labels = order.map((i) => data.files[i].label);

/* A caption and the metric columns it covers: what the page leaves out of the styling is one column, which is how the
 * grid reads (`src/page/table.js` writes `span n` only where n is more than one). */
const covers = (doc) => [...doc.querySelectorAll('#grid .hgroups > span')]
  .map((span) => span.style.gridColumn || 'span 1');

test('the columns stand by the newest row their numbers moved in, and the settings decide the rest', async () => {
  const doc = (await openPage()).window.document;
  const rank = columnRank(data);

  assert.deepEqual(captions(doc).slice(1), labels,
    'the columns come in the wrong order: the files whose numbers moved last stand first, then the settings’ order');
  assert.equal(rank[order[0]], data.rows.length - 1,
    'the first column is not a file the newest row moved: ' + data.files[order[0]].label);
  /* The rule said out of the two figures it rests on rather than out of the order alone: the newest row of the history
   * is the last of the contract's rows, and its numbers are what put a column in front of the others. */
  const newest = data.rows[data.rows.length - 1].values;
  const before = data.rows[data.rows.length - 2].values;
  assert.ok(JSON.stringify(newest[order[0]]) !== JSON.stringify(before[order[0]]),
    'the numbers of the first column did not move in the newest row');
});

test('a caption covers the metrics of its group, and no more', async () => {
  const doc = (await openPage()).window.document;
  const count = data.metrics.length;
  assert.deepEqual([...new Set(covers(doc))], ['span ' + count],
    'the captions do not cover the metrics of their groups: ' + covers(doc).join(' | '));
  assert.equal(metricCaptions(doc).length, captions(doc).length * count,
    'the metric captions do not stand one per column of the window');

  /* The metric switched off: its columns leave the window, and every caption covers one metric less — a caption left
   * over the columns of its old group would stand over the metrics of its neighbour. */
  toggleBox(doc, metricBox(doc), false);
  assert.equal(captions(doc).length, labels.length + 1,
    'switching a metric off changed the set of files in the header');
  assert.deepEqual([...new Set(covers(doc))], ['span ' + (count - 1)],
    'after a metric was switched off the captions still cover it: ' + covers(doc).join(' | '));
  assert.equal(metricCaptions(doc).length, captions(doc).length * (count - 1),
    'the metric captions stayed for the metric that was switched off');
});

test('a choice does not move the columns that stay', async () => {
  const doc = (await openPage()).window.document;
  const before = captions(doc);
  const first = where(data.files[order[0]]);
  toggleBox(doc, fileBox(doc, first), false);
  assert.deepEqual(captions(doc), before.filter((label) => label !== data.files[order[0]].label),
    'снятая галочка сдвинула колонки соседей: порядок зависит от набора, а не от файлов');
  toggleBox(doc, fileBox(doc, first), true);
  assert.deepEqual(captions(doc), before, 'галочка назад не вернула колонку на её место');
});

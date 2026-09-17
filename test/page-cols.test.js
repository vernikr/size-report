/* The table's columns: their order, their width and what a switch does to them.
 *
 * A column has three lives at once — the cells that draw it, the headings that caption it and the `<col>` that gives it
 * its width, since the table's layout is **fixed**: the browser takes the widths from the `<colgroup>` the page builds
 * (`appCols`) instead of measuring every cell of the table to assign them (174 468 of them here). Hence a rule over the
 * three together: a switch that reached the cells alone would leave a caption over the numbers of a file that is gone,
 * and a `<col>` that stayed behind would hold the width of a column nobody sees. The widths are counted from the data
 * and checked against the text the cells really carry rather than against a second count of the same numbers.
 *
 * The assembled page in a real DOM (jsdom), on the shared fixture of the page suites: `page-view` reads the page as a
 * whole, `page-tree` the panel, `page-choice` the memory of a choice and the link.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABLE_CSS } from '../src/css.js';
import { allCells, fileBox, pageReady, toggleBox } from '../tools/page-harness.js';

const { data, openPage } = pageReady('cols');

/* The width the fixed layout reads: the counted text in `ch` (`appCols`), which the styling turns into a column
 * (`#grid col`). A column is taken by its own number rather than by its ordinal among the cells, so that a check and
 * the drawing meet in the markup. */
const cols = (doc) => [...doc.querySelectorAll('#grid colgroup col')];
const ch = (col) => Number(col.style.getPropertyValue('--ch').replace('ch', ''));

// The order of the columns as the reader sees it: the headings of the header's first row, in their places.
const heads = (doc) => [...doc.querySelectorAll('#grid thead tr')[0].querySelectorAll('th')];
const headers = (doc) => heads(doc).map((th) => th.textContent).slice(2);

/* The order of columns is about the reader rather than about numbers: the report is rebuilt after every commit, and the
 * first question is what this edit brought. So the columns the last commit touched stand first, in the order of the
 * settings, and the rest follow, in that same order. The check reads this off the header, which is where the reader
 * sees it. */
test('the columns of the last commit come before the rest, while the settings’ order holds', async () => {
  const doc = (await openPage()).window.document;
  // The first two header cells are not columns: the commit's caption and the overall total.
  const where = (i) => (data.files[i].path === null ? data.files[i].paths[0] : data.files[i].path);
  const indexes = data.files.map((_f, i) => i);
  const labels = (list) => list.map((i) => data.files[i].label);
  const touched = indexes.filter((i) => data.last[i] === true);
  const rest = indexes.filter((i) => data.last[i] !== true);
  assert.ok(touched.length > 0,
    'in the fixture the last commit touched no column — there is nothing to check');
  assert.deepEqual(headers(doc), labels(touched.concat(rest)),
    'the columns come in the wrong order: first those the last commit touched, then the rest in the settings’ order');

  /* The same on a live choice, and that is what lets the table be built once: the reader switches a file off, the
   * column is marked hidden rather than taken out, and the columns that stay keep their places — the order depends
   * on the files rather than on how many of them are on. */
  const last = touched[touched.length - 1];
  toggleBox(doc, fileBox(doc, where(last)), false);
  assert.deepEqual(headers(doc), labels(touched.concat(rest)),
    'the order of the columns followed the choice: a hidden column moved the others');
  const hidden = heads(doc).slice(2)[touched.length - 1];
  assert.equal(hidden.textContent, data.files[last].label, 'a hidden column lost its place in the header');
  assert.equal(hidden.classList.contains('off'), true,
    'the switched-off column is not marked hidden: it is still shown');
});

/* The counted width is in `ch`, and a digit is one `ch` in the table's own font; only the thin space between the
 * thousands is counted as a fraction of a digit (`appBreadth`). So every character that is not a thin space stands for
 * a whole one — which is what this check holds the page to, against the text the cells really carry rather than
 * against a second count of the numbers: a column that came out short would show a number running over its neighbour,
 * since a cell clips nothing. The pixels themselves are a browser's business and are measured there (the probe beside
 * this suite); jsdom has no layout at all. */
test('every column is wide enough for the longest text it holds', async () => {
  const doc = (await openPage()).window.document;
  const all = cols(doc);
  assert.equal(all.length, 1 + allCells(data),
    'the fixed layout has no column per metric and group: its widths come from nowhere');
  const wide = all.slice(1).map(ch);
  const solid = (text) => text.replace(/\u2009/g, '').length;
  const longest = wide.map(() => 0);
  // The cells of a row stand in the order of the columns, one cell per column, which is what ties a text to a width.
  [...doc.querySelectorAll('#grid tbody tr')].forEach((tr) => {
    [...tr.querySelectorAll('td')].forEach((td, at) => {
      if (solid(td.textContent) > longest[at]) longest[at] = solid(td.textContent);
    });
  });
  [...doc.querySelectorAll('#grid thead tr:last-child th')].forEach((th, mi) => {
    if (solid(th.textContent) > longest[mi]) longest[mi] = solid(th.textContent);
  });
  longest.forEach((n, at) => assert.ok(wide[at] >= n,
    'колонка ' + at + ' в ' + wide[at] + ' знаков держит текст в ' + n + ': число выйдет за соседнюю клетку'));

  /* The trap this step fell into, and no check of the page would have caught it: a fixed layout with `width: auto` is
   * not a fixed layout. The browser falls back to the automatic one, the columns' widths are ignored, every cell is
   * measured again — and the page looks exactly right (measured in Chrome while this step was being made). Both
   * declarations are read off the shared styling here, where they are the table's own business. */
  const shared = /\btable\s*\{([^}]*)\}/.exec(TABLE_CSS);
  assert.notEqual(shared, null, 'the shared styling sets no rule for the table itself');
  assert.match(shared[1], /table-layout:\s*fixed/,
    'the table is not laid out fixed: every cell of it is measured to assign the widths');
  assert.match(shared[1], /width:\s*[\d.]/,
    'a fixed layout without a definite width is the automatic one: the columns’ widths would be ignored');

  /* A group's caption is one line over the columns of its group (`white-space: nowrap`), so the group as a whole has to
   * be wide enough for its file's name — otherwise the names of two neighbouring groups would run into one another. */
  const groups = heads(doc).slice(1);
  groups.forEach((th, g) => {
    const sum = wide.slice(g * data.metrics.length, (g + 1) * data.metrics.length).reduce((a, b) => a + b, 0);
    assert.ok(sum >= th.textContent.length,
      'подпись группы «' + th.textContent + '» шире своих колонок: имя файла выйдет за свою группу');
  });
});

/* A switch of the reader's has to reach the column and not only its cells: with a fixed layout the width of a hidden
 * column would stay in the table as a band of emptiness. The page writes one class on both — `off` for a file, the
 * metric's own track for a metric, which the table's `m-off-N` turns into hiding (that rule, and the tracks it covers,
 * is checked in `page-view`). */
test('a switch reaches the column itself, and not only its cells', async () => {
  const doc = (await openPage()).window.document;
  const all = cols(doc);
  const index = data.files.findIndex((f) => f.path === 'src/code.js');
  // A file's group among the headings: where the reader sees it, rather than by the ordinal number of the column.
  const g = heads(doc).slice(2).findIndex((th) => th.textContent === data.files[index].label);
  assert.ok(g > 0, 'the file of the switch is not a group of the table — there is nothing to check');
  const mine = all.slice(1 + (g + 1) * data.metrics.length, 1 + (g + 2) * data.metrics.length);
  assert.deepEqual(mine.map((col) => [...col.classList].find((c) => /^m\d+$/.test(c))),
    data.metrics.map((_m, mi) => 'm' + mi),
    'the columns of a file carry no metric track: switching that metric off would leave them behind');

  toggleBox(doc, fileBox(doc, 'src/code.js'), false);
  const off = all.filter((col) => col.classList.contains('off'));
  assert.deepEqual(off.map((col) => mine.indexOf(col)).sort(), mine.map((_c, mi) => mi),
    'снятая галочка не дошла до колонок: ширина колонки осталась в таблице пустой полосой');
  toggleBox(doc, fileBox(doc, 'src/code.js'), true);
  assert.equal(all.filter((col) => col.classList.contains('off')).length, 0,
    'галочка назад не вернула колонки: таблица изменилась навсегда');
});

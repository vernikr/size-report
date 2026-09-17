/* The grid of the page: a window of the table rather than the table.
 *
 * What this suite is about: the page builds the rows and the columns the reader can see and nothing else, because the
 * price of a table was the browser's — this repository's report was 370 758 nodes and about 1.4 GB of memory
 * (`src/page/table.js` says what was measured, and why a library was not taken). The page is read in a real DOM here
 * (jsdom), given a viewport of a size the check chooses (jsdom lays nothing out) and looked at for what it built.
 *
 * Two copies of the geometry stand in the repository — the script's (`src/page/table.js`) and the styling's
 * (`src/table.css`) — and this suite is the only place they can be held together: a column that moved in one of the
 * two would place every cell a little away from its caption. The constants are read off the chapter itself (the way
 * `pageMath` takes the calculation) rather than copied here.
 *
 * Neighbouring suites, deactivated while the table was rebuilt: `page-view`, `page-cols`, `page-tree` and
 * `page-choice` read the markup of the `<table>` that is gone, and each names its own reason at the top of the file.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cellParts, stripModules, valueParts } from '../src/size-table.js';
import { ROOT } from '../tools/harness.js';
import { fileBox, metricBox, pageMath, pageReady, toggleBox } from '../tools/page-harness.js';

const { data, openPage } = pageReady('grid');

/* The page's own figures, not a paraphrase of them: the chapter is evaluated without its module syntax, which is what
 * the paste into the page does, and its functions are never called (they want the document). */
const chapter = stripModules(fs.readFileSync(path.join(ROOT, 'src', 'page', 'table.js'), 'utf8'));
const G = new Function(chapter
  + '\nreturn { col: APP_COL, row: APP_ROW, head: APP_HEAD, commit: APP_COMMIT, over: APP_OVER };')();

const CSS = fs.readFileSync(path.join(ROOT, 'src', 'table.css'), 'utf8');
const declared = (name) => Number(new RegExp('--' + name + ':\\s*(\\d+)px').exec(CSS)[1]);

const GRID = (doc) => doc.getElementById('grid');
const rows = (doc) => [...GRID(doc).querySelectorAll('.row')];
const nowRow = (doc) => GRID(doc).querySelector('.row.now');
const numbers = (row) => [...row.querySelectorAll('.cells > span')].map((span) => span.textContent.trim());
const captions = (doc) => [...GRID(doc).querySelectorAll('.hgroups > span')].map((span) => span.textContent);
const where = (f) => (f.path === null ? f.paths[0] : f.path);
const placed = (el) => Number(el.style.left.replace('px', ''));

/* The shared sheet read as rules: the comments out, every block with the selectors that open it. Two places write one
 * geometry and one border down — the styling and the script — and no number of the page's own would report a clash
 * between them, so the rules are read here rather than trusted. */
const SHEET = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const BLOCKS = [...SHEET.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .map((m) => ({ sel: m[1].split(',').map((s) => s.trim()), body: m[2] }));
const rule = (selector) => {
  const found = BLOCKS.filter((b) => b.sel.indexOf(selector) >= 0);
  assert.ok(found.length > 0, 'в таблице стилей нет правила для «' + selector + '»');
  return found.map((b) => b.body).join(' ').replace(/\s+/g, ' ').trim();
};
const decl = (selector, name) => {
  const found = new RegExp('(?:^|;)\\s*' + name + ':\\s*([^;]+)').exec(rule(selector));
  assert.notEqual(found, null, 'правило «' + selector + '» не задаёт «' + name + '»');
  return found[1].trim();
};

/* Where a file's column stands: the files whose numbers moved most recently come first, and a file the history never
 * moved anywhere comes last — the rule the header and the window share (`appOrder`). The expectation is counted here
 * from the contract's own rows rather than taken from the page: a column of empty cells standing in front of the table
 * is what the order is about, and the check says so in the numbers the reader sees. */
const columnOrder = () => {
  const rank = data.files.map(() => -1);
  let was = null;
  data.rows.forEach((row, i) => {
    row.values.forEach((cell, j) => {
      if (was === null || JSON.stringify(cell) !== JSON.stringify(was[j])) rank[j] = i;
    });
    was = row.values;
  });
  return data.files.map((_f, i) => i).sort((a, b) => rank[b] - rank[a]);
};

/* A viewport and a place in it, given rather than measured: jsdom has no layout and remembers no scroll, so the check
 * hands the shell the four figures the page reads — the same properties a browser fills in — and sends the event a
 * browser sends when they move. */
function place(dom, view) {
  const shell = dom.window.document.getElementById('shell');
  const given = { clientHeight: view.high, clientWidth: view.wide, scrollTop: view.top, scrollLeft: view.left };
  Object.keys(given).forEach((name) => {
    Object.defineProperty(shell, name, { configurable: true, get: () => given[name] });
  });
  shell.dispatchEvent(new dom.window.Event('scroll'));
  return shell;
}

/* The ordinal of a built row in the whole grid, read off the place it stands in: the page places a row at its own
 * `top` under the header (`APP_HEAD + r * APP_ROW`), so the ordinals say whether the window is where the shell is. */
const ordinals = (doc) => rows(doc)
  .map((row) => Math.round((Number(row.style.top.replace('px', '')) - G.head) / G.row));

/* The rows in sight of the shell at a place, in ordinals, without the overreach the page is free to build (which is
 * what the bounds below are for — the page may build more than the shell shows, never less). */
function inSight(view) {
  const top = view.top + G.head;
  return {
    first: Math.floor(top / G.row),
    last: Math.min(data.rows.length, Math.floor((top + view.high) / G.row))
  };
}

test('the grid is a window of the table: what the reader sees is built, and no more', async () => {
  const dom = await openPage();
  const doc = dom.window.document;
  const whole = data.rows.length + 1;

  assert.equal(doc.querySelectorAll('#grid table, #grid tr, #grid td').length, 0,
    'ячейки таблицы вернулись в разметку: таблица снова собирается целиком');
  assert.equal(doc.getElementById('bar'), null, 'the stripe over the drawing stayed although the freeze it drew for is gone');

  /* A shell of one row: the window is what it shows, so the whole history cannot be in it. */
  place(dom, { high: G.row, wide: 400, top: 0, left: 0 });
  const seen = ordinals(doc);
  assert.ok(seen.length < whole, 'the whole history was built for a window of one row: ' + seen.length);
  assert.deepEqual(seen, [...Array(seen.length).keys()],
    'the rows of the window are not the first ones of the grid, in order: ' + JSON.stringify(seen));
  assert.equal(nowRow(doc).classList.contains('now'), true,
    'the state at HEAD is not the first row of the grid: the deltas below it have nothing to add up to');
  assert.equal(rows(doc).filter((row) => row.querySelectorAll('.cells > span').length === 0).length, 0,
    'a row of the window came out without numbers');
});

test('the grid is as wide as its columns and as tall as its rows, and the styling agrees with the script', async () => {
  const doc = (await openPage()).window.document;
  const columns = (data.files.length + 1) * data.metrics.length;
  assert.equal(Number(GRID(doc).style.width.replace('px', '')), G.commit + columns * G.col,
    'the grid is not as wide as its columns and the pinned commit column: the scrollbar would answer about another extent');
  assert.equal(Number(GRID(doc).style.height.replace('px', '')), G.head + (data.rows.length + 1) * G.row,
    'the grid is not as tall as its rows: the scrollbar would answer about another extent');

  /* The two copies of the geometry, side by side. The width of every column is one and fixed — that is the promise
   * the step makes — so the styling has one figure for all of them rather than a width per column. */
  assert.equal(declared('col'), G.col, 'the column of the styling is not the column of the script');
  assert.equal(declared('row'), G.row, 'the row of the styling is not the row of the script');
  assert.equal(declared('head'), G.head, 'the header of the styling is not the header of the script');
  assert.equal(declared('commit'), G.commit, 'the pinned column of the styling is not the one the script places the numbers beside');
  assert.equal(declared('head'), 2 * declared('row'),
    'the header is not exactly two rows: its two lines would have a height of their own');
  assert.match(CSS, /\.cells\s*\{[^}]*grid-auto-columns:\s*var\(--col\)/,
    'the cells of a row are not one grid of the same track per column');
  assert.match(CSS, /\.hgroups > span\s*\{[^}]*text-overflow:\s*ellipsis/,
    'файл с длинным именем не обрезается многоточием: имя выйдет за свою группу');
  assert.equal((CSS.match(/--ch\b|table-layout|colgroup/g) || []).length, 0,
    'the styling still counts a width per column: the columns are one width now');
});

/* The three rules of the drawing a reader sees at once, each of which one declaration of another kind had broken: one
 * border, rows of one height (the header's two lines among them), a file's name centred over its group — and the panel,
 * which the table's styling must not reach at all (an unscoped `.row` took the panel's own row out of the flow). The
 * panel is not a matter of taste here but of one sheet being shared: `#grid` is the border between the two. */
test('one border, rows of one height, captions centred, and the panel outside the table’s styling', async () => {
  /* The lines of the table — under a row, under a cell of the header, along the left edge of a group — are one line.
   * The dotted underline of a journal mark is not among them: it is a mark on a word rather than an edge of the table. */
  const edges = ['#grid .cells > span', '#grid .c-commit', '#grid .hgroups > span', '#grid .hmetrics > span']
    .map((sel) => decl(sel, 'border-bottom'))
    .concat(['#grid .cells > .g', '#grid .hmetrics > .g', '#grid .hgroups > .gh']
      .map((sel) => decl(sel, 'border-left')));
  assert.deepEqual([...new Set(edges)], ['1px solid var(--grid-line)'],
    'бордеры разной толщины или цвета: ' + JSON.stringify([...new Set(edges)]));

  /* And the page's chrome is framed in the very same line. Two greys for one drawing is the kind of difference nobody
   * names in a report and everybody sees, so the two declarations are read against each other rather than trusted. */
  const OWN = fs.readFileSync(path.join(ROOT, 'src', 'page', 'app.css'), 'utf8');
  const line = /--line:\s*([^;]+)/.exec(OWN.replace(/\/\*[\s\S]*?\*\//g, ''))[1].replace(/\s+/g, ' ').trim();
  assert.equal(line, /--grid-line:\s*([^;]+)/.exec(SHEET)[1].replace(/\s+/g, ' ').trim(),
    'линия рамки страницы не того же цвета, что линии таблицы');

  /* A cell of the numbers and a cell of the header carry the same padding, line height and line: the header is two
   * rows of the same rhythm as the table rather than a band of its own size. */
  ['padding', 'line-height', 'border-bottom'].forEach((name) => assert.equal(
    decl('#grid .cells > span', name), decl('#grid .hgroups > span', name),
    'ячейка заголовка и ячейка чисел разной высоты: «' + name + '» расходится'));
  assert.equal(decl('#grid .hgroups', 'height'), 'var(--row)', 'строка имён файлов не равна строке таблицы');
  assert.equal(decl('#grid .hmetrics', 'top'), 'var(--row)', 'строка метрик не стоит под строкой имён');
  assert.equal(decl('#grid .hmetrics', 'height'), 'var(--row)', 'строка метрик не равна строке таблицы');
  assert.equal(decl('#grid .head', 'height'), 'var(--head)', 'шапка не двухстрочная');

  // A file's name stands over its group of metrics, centred on it.
  assert.equal(decl('#grid .hgroups > span', 'text-align'), 'center',
    'название файла не выровнено по центру своей группы');

  /* One sheet, two consumers: every rule of the table's part is tied to `#grid`, or it reaches the panel standing beside
   * the table — which is exactly what the panel's own `.row` suffered. */
  const loose = BLOCKS.map((b) => b.sel).flat().filter((sel) => sel.indexOf('#grid') !== 0);
  assert.deepEqual(loose, [], 'правило таблицы не привязано к #grid и достанет до панели: ' + loose.join(' | '));

  /* And the numbers begin beside the pinned commit column rather than under it: the total (the first group of every
   * row) is the one a reader misses first when the column is laid over it. */
  const doc = (await openPage()).window.document;
  assert.equal(placed(nowRow(doc).querySelector('.cells')), G.commit,
    'числа первой группы уехали под закреплённую колонку коммита');
  assert.equal(placed(GRID(doc).querySelector('.hgroups')), G.commit,
    'подписи первой группы уехали под закреплённую колонку коммита');
});

test('the window follows the scroll: the rows in sight are built, and those that left are dropped', async () => {
  const dom = await openPage();
  const doc = dom.window.document;
  const view = { high: 200, wide: 400, top: 0, left: 0 };

  place(dom, view);
  const first = ordinals(doc);
  const top = inSight(view);
  assert.ok(first.indexOf(top.first) >= 0 && first.indexOf(top.last) >= 0,
    'the window does not hold the rows of the shell: ' + JSON.stringify(first));
  assert.ok(first[0] >= top.first - G.over && first[first.length - 1] <= Math.min(data.rows.length, top.last + G.over),
    'the window reaches further than the overreach the page is allowed: ' + JSON.stringify(first));

  /* Down the table: the rows of the place the shell moved to, and none of the rows of the old place beyond the
   * overreach — a window that grew instead of moving would be the table again, only slower. */
  view.top = 10 * G.row;
  place(dom, view);
  const second = ordinals(doc);
  const moved = inSight(view);
  assert.ok(second.indexOf(moved.first) >= 0 && second.indexOf(moved.last) >= 0,
    'after the scroll the window does not hold the rows of the shell: ' + JSON.stringify(second));
  assert.equal(second.indexOf(0), -1, 'a row that left the window stayed in the markup');
  assert.ok(second.length <= Math.ceil(view.high / G.row) + 2 * G.over + 1,
    'the window holds more rows than the shell and the overreach: ' + second.length);
});

test('the columns of the window follow the scroll sideways, and a number stays under its own caption', async () => {
  const dom = await openPage();
  const doc = dom.window.document;
  const order = columnOrder();
  const count = data.metrics.length;
  /* Six columns to the right: the total's group is out of sight, so the first caption of the header is a file's — and
   * the columns the page builds are the ones of that file, which is what ties the window to the place in it. */
  const view = { high: 400, wide: 400, top: 0, left: 6 * G.col };

  place(dom, view);
  const group = Math.floor((Math.floor(view.left / G.col) - G.over) / count);
  assert.ok(group >= 1, 'the check did not scroll far enough to leave the total behind');
  const file = order[group - 1];
  assert.equal(captions(doc)[0], data.files[file].label,
    'the caption over the first column in sight is not the file of that column: ' + captions(doc).join(' | '));
  assert.equal(numbers(nowRow(doc))[0], valueParts(data.now[file].raw).text,
    'the first number in sight is not the raw size of the file of that column: '
      + numbers(nowRow(doc)).slice(0, 2).join(', '));
});

test('a file switched off leaves the window: its caption, its columns and its numbers', async () => {
  const doc = (await openPage()).window.document;
  const order = columnOrder();
  const file = order[0];
  const before = Number(GRID(doc).style.width.replace('px', ''));
  assert.equal(captions(doc)[1], data.files[file].label, 'the first column of the window is not the first of the order');

  const off = data.files.map((_f, i) => i !== file);
  toggleBox(doc, fileBox(doc, where(data.files[file])), false);

  assert.equal(Number(GRID(doc).style.width.replace('px', '')), before - data.metrics.length * G.col,
    'the columns of the switched-off file stayed in the extent of the grid');
  assert.equal(captions(doc).indexOf(data.files[file].label), -1,
    'the caption of the switched-off file stayed over the numbers of others');
  assert.equal(numbers(nowRow(doc))[0], valueParts(pageMath.totalsOf(data.now, ['raw'], off).raw).text,
    'the total did not drop by exactly the file that was switched off');
});

test('the rows of the window are the commits, the newest first, and their numbers are the shared calculation', async () => {
  const dom = await openPage();
  const doc = dom.window.document;
  /* A shell bigger than the report: the whole history is in the window, so every row can be compared at once. */
  place(dom, { high: 10000, wide: 10000, top: 0, left: 0 });
  const built = rows(doc);
  const whole = data.rows.length + 1;
  assert.equal(built.length, whole, 'the window of a shell that holds everything is not the whole history');

  const keys = data.metrics.map((m) => m.key);
  const allOn = data.files.map(() => true);
  keys.forEach((key, mi) => assert.equal(numbers(nowRow(doc))[mi],
    valueParts(pageMath.totalsOf(data.now, keys, allOn)[key]).text,
    'the top row is not the state at HEAD for the metric ' + key));
  data.rows.forEach((row, i) => {
    const r = data.rows.length - i;
    const model = pageMath.rowModel(row.values, i === 0 ? null : data.rows[i - 1].values, keys, allOn);
    keys.forEach((key, mi) => assert.equal(numbers(built[r])[mi],
      cellParts(model.total[mi].value, model.total[mi].delta, '−').text,
      'the total of the commit ' + i + ' for the metric ' + key + ' is not the shared calculation’s'));
  });
  assert.ok(built[1].querySelector('.c-commit').textContent.indexOf(data.rows[data.rows.length - 1].subject) > 0,
    'the newest commit does not stand under the state at HEAD');
});

test('a metric switched off takes its columns out of the window', async () => {
  const doc = (await openPage()).window.document;
  const before = Number(GRID(doc).style.width.replace('px', ''));
  const files = data.files.length + 1;
  toggleBox(doc, metricBox(doc), false);
  assert.equal(Number(GRID(doc).style.width.replace('px', '')), before - files * G.col,
    'the columns of the switched-off metric stayed in the extent of the grid');
  assert.equal(numbers(nowRow(doc)).length, (data.files.length + 1) * (data.metrics.length - 1),
    'the window still holds one number per column of every metric');
});

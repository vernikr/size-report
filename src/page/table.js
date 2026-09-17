import { cellParts, commitParts, deltaOf, nowModel, rowModel, valueParts } from '../derived.js';
import { appEl } from './dom.js';
import { appData, appUi, appView } from './state.js';

/* The table is built once and then only shown and hidden. That rests on three things that do not depend on the
 * reader: a cell's content and colour come from the pair (commit, file) and a metric (`cellParts`, `valueParts`),
 * the order of the columns comes from the files alone, and only the visibility and the totals are the choice's.
 * Hence nothing below builds a node after the first drawing — a click writes a class and a number.
 *
 * What makes this cheap is a cache of references to the nodes of every column (`appTable` returns it): reaching a
 * cell through the markup costs several times what changing it does (measured: `tr.children[i]` 0.0254 ms against
 * `classList.toggle` 0.0070 ms), and the first drawing creates every node anyway, so collecting them is free. The
 * columns of the fixed layout — a `<col>` per column, carrying the counted width — are collected there too.
 *
 * The totals are the only numbers that move with the choice, and they are carried rather than recounted: a sum is
 * linear, so a file switched off subtracts exactly its own numbers — the same integers the first drawing wrote.
 */

/* The cell's class: the metric's track (`m0`, `m1`, … — one class per metric, which is what hides a whole metric
 * at once), the group it belongs to (every cell of a group, not the first one: the group's left border is carried
 * by the first *enabled* metric, and the styling decides which that is), and the gap ("no such file"). */
function appCellClass(mi, miss) {
  return 'num g m' + mi + (miss ? ' miss' : '');
}

/* A cell filled where it stands: the totals are written again on every click, and a cell has to forget its own
 * content first — a delta is a node of its own, so `textContent` alone would leave it behind. */
function appFill(td, parts) {
  td.textContent = '';
  if (parts.dir === null) td.textContent = parts.text;
  else td.appendChild(appEl('span', 'delta ' + parts.dir, parts.text));
  return td;
}

// The markup of a commit row's cell: the rules live in cellParts, only the node is here.
export function appCell(cell, mi) {
  const parts = cellParts(cell.value, cell.delta, '−');
  return appFill(appEl('td', appCellClass(mi, parts.miss)), parts);
}

// The markup of the top row's cell: the rules live in valueParts.
export function appValueCell(value, mi) {
  const parts = valueParts(value);
  return appFill(appEl('td', appCellClass(mi, parts.miss)), parts);
}

/* A commit's caption: the date, the subject, the journal section's mark. The column's width and the clipping of a long
 * subject come from the shared part of the styling, which is why the column does not jump when files are switched. */
export function appCommit(row) {
  const parts = commitParts(row, appData.report.showSha, row.href);
  const name = parts.href ? appEl('a', 'subj', parts.subject) : appEl('span', 'subj', parts.subject);
  if (parts.href) name.href = parts.href;
  name.title = parts.title;
  const mark = appEl('span', 'sect', parts.mark.text);
  if (parts.mark.title) mark.title = parts.mark.title;

  const clip = appEl('div', 'clip');
  clip.appendChild(appEl('span', 'when', parts.when));
  clip.appendChild(name);
  clip.appendChild(mark);
  const th = appEl('th', 'c-commit');
  th.appendChild(clip);
  return th;
}

/* The empty states: when there will be no numbers at all, the page says so in words rather than showing a grid without
 * columns. Every file can be switched off — then the total volume remains, and the note explains why there are no
 * columns. The table itself stands there either way: this is about what is shown, not about what exists. */
export function appState(metricsCount, filesCount) {
  const state = document.getElementById('state');
  const text = metricsCount === 0 ? appUi.empty : (filesCount === 0 ? appUi.noFiles : '');
  state.textContent = text;
  state.hidden = text === '';
  document.getElementById('shell').hidden = metricsCount === 0;
}

/* The order of the columns: the files the last commit touched come first — the report is rebuilt after every
 * commit, and a reader's first question is what that edit brought. Inside each part the order stays as it comes
 * from the settings, and it depends on the files rather than on the choice: that is what lets a column be hidden
 * without moving the others. */
export function appOrder() {
  const files = [];
  appData.files.forEach((_f, i) => files.push(i));
  files.sort((a, b) => (appData.last[a] === true ? 0 : 1) - (appData.last[b] === true ? 0 : 1));
  return files;
}

/* The header: a row of groups (the total and the files) and a row of metrics under it — every metric of every file,
 * because nothing here knows the choice. The headings whose `colSpan` follows the number of enabled metrics and the
 * headings of each file's column are collected in the cache: they are the nodes a click has to touch. */
export function appHead(files, metrics, cache) {
  const head = appEl('tr');
  const commit = appEl('th', 'c-commit', appUi.commit);
  commit.rowSpan = 2;
  head.appendChild(commit);
  const subs = appEl('tr');
  const group = (label, i) => {
    const th = appEl('th', 'gh', label);
    th.colSpan = metrics.length;
    head.appendChild(th);
    cache.spans.push(th);
    /* The group's own heading belongs to the column: hiding a file has to take its caption with it, or the header
     * would keep a name over numbers that are gone. */
    if (i !== null) cache.cols[i].push(th);
    metrics.forEach((_key, mi) => {
      const cell = appEl('th', 'g m' + mi, appData.metrics[mi].label);
      subs.appendChild(cell);
      if (i !== null) cache.cols[i].push(cell);
    });
  };
  group(appUi.total, null);
  files.forEach((i) => {
    cache.cols[i] = [];
    group(appData.files[i].label, i);
  });
  const thead = appEl('thead');
  thead.appendChild(head);
  thead.appendChild(subs);
  return thead;
}

/* A text's breadth in `ch`, the unit a column is measured in: a digit is exactly one `ch` in this table's font
 * (measured in Chrome: 8.67px against 8.67px), and a thin space is counted as a third of a digit — nothing else is
 * discounted. Without that one fraction every number column would come out a fifth wider than the number in it (the
 * grouping makes a text 21 % narrower than its characters, measured), which would give back more than the padding and
 * the clipping of this step save. What is left over-measures — a letter is 0.84 of a `ch`, a slash 0.48 — and that is
 * the safe side: a cell clips nothing, so a column a character short would show a number running over its neighbour. */
function appBreadth(text) {
  let wide = 0;
  for (let i = 0; i < text.length; i++) wide += text[i] === '\u2009' ? 0.35 : 1;
  return wide;
}

/* The widest text of every column, counted before a single node is made: the numbers of the commit rows — through
 * `rowModel`, the very model the cells are drawn from, so a column cannot be sized for a number other than the one
 * that will stand in it — the absolute sizes of the "now" row and the metric's own caption. */
function appWidest(files, keys) {
  const wide = files.map(() => keys.map(() => 0));
  const total = keys.map(() => 0);
  const put = (into, mi, breadth) => { if (breadth > into[mi]) into[mi] = breadth; };
  const delta = (cell) => appBreadth(cellParts(cell.value, cell.delta, '−').text);
  const value = (v) => appBreadth(valueParts(v).text);
  appData.rows.forEach((row, r) => {
    const model = rowModel(row.values, r === 0 ? null : appData.rows[r - 1].values, keys);
    model.total.forEach((cell, mi) => put(total, mi, delta(cell)));
    files.forEach((i) => model.files[i].forEach((cell, mi) => put(wide[i], mi, delta(cell))));
  });
  const now = nowModel(appData.now, keys);
  now.total.forEach((v, mi) => put(total, mi, value(v)));
  files.forEach((i) => now.files[i].forEach((v, mi) => put(wide[i], mi, value(v))));
  keys.forEach((_key, mi) => {
    const caption = appBreadth(appData.metrics[mi].label);
    put(total, mi, caption);
    wide.forEach((per) => put(per, mi, caption));
  });
  return { total: total, files: wide };
}

/* A group's heading — a file's name, the word over the total — is one line over the columns of that group
 * (`white-space: nowrap` in the shared styling), so the group as a whole has to be wide enough for it, or the names of
 * two neighbouring groups would run into one another. The caption is divided among the metrics of the group rather than
 * weighed against their sum: every column carries at least its share, so the group can never come out narrower than the
 * caption, while a column that is wider anyway keeps its own count. */
function appGroupWide(per, label) {
  const share = Math.ceil(appBreadth(label) / per.length);
  return per.map((n) => Math.max(n, share));
}

/* The columns, before the rows: `table-layout: fixed` reads the first row of the table and takes the widths from there,
 * so they are known while the table is built rather than measured by the browser over every cell of it. A column
 * carries the metric's class (`m0`, `m1`, …) — which is what hides a whole metric at once — and its counted width in
 * `ch`; the styling adds the padding and the border to it (`#grid col`), because a count and a drawing are one sum
 * rather than two. The columns of a file are collected where its cells are, so one switch writes one class over both. */
function appCols(files, wide, cache) {
  const group = appEl('colgroup');
  const add = (n, mi) => {
    const col = appEl('col', 'm' + mi);
    col.style.setProperty('--ch', n + 'ch');
    group.appendChild(col);
    return col;
  };
  group.appendChild(appEl('col', 'c-commit'));
  appGroupWide(wide.total, appUi.total).forEach(add);
  files.forEach((i) => appGroupWide(wide.files[i], appData.files[i].label)
    .forEach((n, mi) => { cache.cols[i].push(add(n, mi)); }));
  return group;
}

/* A file's share of a row: one cell per metric, in the order of the table's columns, and each is put into its
 * column's cache while it is made. The maker is what tells a commit's delta from an absolute size at HEAD — the walk
 * over the files is one, and there is no second one to drift away. */
function appRowCells(tr, model, files, cache, make) {
  files.forEach((i) => {
    model.files[i].forEach((value, mi) => {
      const td = make(value, mi);
      cache.cols[i].push(td);
      tr.appendChild(td);
    });
  });
}

/* A commit row: the caption and the numbers. The deltas come from the shared calculation (`rowModel`) rather than
 * from here — two ways to count one row would be two answers. The model is taken whole (every file) because the
 * table holds every column, and the column order of the table is applied by taking the model by the file's own
 * index: the model lists the files the way the data does, not the way the columns stand. */
export function appRow(r, files, metrics, cache) {
  const row = appData.rows[r];
  const prev = r === 0 ? null : appData.rows[r - 1];
  const model = rowModel(row.values, prev === null ? null : prev.values, metrics);
  const tr = appEl('tr');
  tr.appendChild(appCommit(row));
  model.total.forEach((cell, mi) => {
    const td = appCell(cell, mi);
    cache.sums[mi][r] = cell.value;
    cache.cells[mi][r] = td;
    tr.appendChild(td);
  });
  appRowCells(tr, model, files, cache, appCell);
  return tr;
}

/* The top row holds the absolute sizes at HEAD: an absolute number stands in the table once, and it is the one every
 * delta below it adds up to. Its numbers are the state at HEAD rather than the last commit's cells, which is why the
 * running sums take them from here instead of assuming they are the row above. */
export function appNow(files, metrics, cache) {
  const tr = appEl('tr', 'now');
  tr.appendChild(appEl('th', 'c-commit', appUi.now));
  const model = nowModel(appData.now, metrics);
  const last = appData.rows.length;
  model.total.forEach((v, mi) => {
    const td = appValueCell(v, mi);
    cache.sums[mi][last] = v;
    cache.cells[mi][last] = td;
    tr.appendChild(td);
  });
  appRowCells(tr, model, files, cache, appValueCell);
  return tr;
}

/* The body: the commit rows from the newest down, plus the "now" row with the absolute sizes at HEAD. The deltas
 * under it add up to it, which is why it stands first. */
export function appBody(files, metrics, cache) {
  const body = appEl('tbody');
  for (let r = appData.rows.length - 1; r >= 0; r--) body.appendChild(appRow(r, files, metrics, cache));
  body.insertBefore(appNow(files, metrics, cache), body.firstChild);
  return body;
}

/* The whole table, built once. What the cache holds is what the reader's choice works with: the nodes of each file's
 * column — its cells, its headings and its `<col>` (`cols`), the group headings whose colSpan follows the enabled
 * metrics (`spans`), the cells of the totals (`cells`), the running sums (`sums`) and those same sums with every
 * column on (`all`) — the sums a view painted again starts from. */
export function appTable(grid) {
  const metrics = appData.metrics.map((m) => m.key);
  const files = appOrder();
  const cache = { grid: grid, keys: metrics, cols: [], drawn: [], spans: [], cells: [], sums: [], all: [] };
  /* The columns are built shown: that is the state the nodes carry before anything is drawn. */
  files.forEach((i) => { cache.drawn[i] = true; });
  metrics.forEach(() => {
    cache.cells.push([]);
    cache.sums.push([]);
  });
  grid.textContent = '';
  grid.appendChild(appHead(files, metrics, cache));
  grid.appendChild(appBody(files, metrics, cache));
  /* The columns stand before the rows rather than beside them: a `<colgroup>` is where the fixed layout reads its
   * widths from, and it has to be in the markup before the browser settles on a layout — the drawing is one pass, not
   * two. */
  grid.insertBefore(appCols(files, appWidest(files, metrics), cache), grid.firstChild);
  cache.all = cache.sums.map((row) => row.slice());
  return cache;
}

/* How many nodes a file's column holds — its cells, its captions and its `<col>`. It is the unit the page's bar
 * counts in (`appDraw`), so it is answered here, where the column's nodes are: the choice's state costs arithmetic,
 * and the nodes are the table's business. */
export function appColumnSize(cache, i) {
  return cache.cols[i].length;
}

/* Whether a file's column has to be drawn at all: `drawn` is the state its nodes carry (the table is built with every
 * column shown), so a column that is on and was never drawn is already right. The first drawing of a report has
 * nothing switched off and therefore costs nothing, and a record from the memory or a link queues exactly the columns
 * that differ from it — on a table of a few hundred thousand cells that is the difference between a page that opens
 * and a page that works for a minute after opening. */
export function appColumnStale(cache, i) {
  return cache.drawn[i] !== (appView.files[i] === true);
}

/* A file's column shown or hidden: its cells and its headings together, one class per node and no new node. A hidden
 * column keeps its place in the markup — the order of the columns is the files' business, not the choice's. What the
 * nodes carry is remembered (`drawn`), or a repeated switch would walk a column nobody has to see again. */
export function appColumn(cache, i, on) {
  cache.cols[i].forEach((node) => node.classList.toggle('off', !on));
  cache.drawn[i] = on;
}

/* A file's share of the totals: switched off it takes exactly its own numbers out of the running sums, switched on
 * it puts them back. Two rows per file are the whole of it — the numbers are the data's, and a sum of integers is
 * exact in either direction. */
export function appContribute(cache, i, on) {
  const sign = on ? 1 : -1;
  appData.rows.forEach((row, r) => {
    const values = row.values[i];
    if (values === null) return;
    cache.keys.forEach((key, mi) => { cache.sums[mi][r] += sign * values[key]; });
  });
  const values = appData.now[i];
  if (values === null) return;
  const last = appData.rows.length;
  cache.keys.forEach((key, mi) => { cache.sums[mi][last] += sign * values[key]; });
}

/* The totals written where they stand: a data row shows the change against the row below it, the "now" row the
 * absolute size — the same rules the first drawing used (`cellParts`, `valueParts`), so the reader sees one kind of
 * number and not two. */
export function appTotals(cache) {
  const last = appData.rows.length;
  cache.cells.forEach((cells, mi) => {
    cells.forEach((td, r) => {
      if (r === last) { appFill(td, valueParts(cache.sums[mi][r])); return; }
      appFill(td, cellParts(cache.sums[mi][r], deltaOf(cache.sums[mi][r], r === 0 ? null : cache.sums[mi][r - 1]), '−'));
    });
  });
}

/* The running sums of the whole view again: a link, a record from the memory and the first drawing change the choice
 * as a whole rather than a column, so the sums start from the sums with every column on and take the switched-off
 * ones out — one copy of the numbers instead of a recount. */
export function appTotalsReset(cache) {
  cache.sums = cache.all.map((row) => row.slice());
  appData.files.forEach((_f, i) => { if (!appView.files[i]) appContribute(cache, i, false); });
  appTotals(cache);
}

/* The metrics of the choice: a class on the table hides every cell of a metric at once, and the group headings follow
 * how many are left — two things that change, instead of a pass over the metric's cells (measured: 2.20 ms and 265
 * operations against 433 ms and 56 496 for walking them). `.m-none` is what the styling reads to drop the group's
 * left border when there is nothing left to separate. */
export function appMetrics(cache) {
  let on = 0;
  cache.keys.forEach((key, mi) => {
    const visible = appView.metrics[key] === true;
    if (visible) on++;
    cache.grid.classList.toggle('m-off-' + mi, !visible);
  });
  cache.grid.classList.toggle('m-none', on === 0);
  cache.spans.forEach((th) => { th.colSpan = on === 0 ? 1 : on; });
}

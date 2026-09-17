import { cellParts, commitParts, nowModel, rowModel, valueParts } from '../derived.js';
import { appEl } from './dom.js';
import { appData, appUi, appView } from './state.js';

/* The table: a grid of plain elements (`<div>`), of which only the part the reader looks at is built. The file's
 * length is the report's, but the price of a report is paid by whoever opens it, so the table is no longer a
 * `<table>` with every cell of every column in it.
 *
 * **Why not a `<table>`.** Measured on this repository's own report (238 500 cells = 370 758 nodes, a table 71 712 ×
 * 5 982 px): about 1.4 GB of a browser's memory, of which roughly half the nodes and half the painted area, and a
 * browser's relayout of it costs close to a second on any switch (`probes/step-12-columns.mjs`). `content-visibility:
 * auto`, the cheap way out, is ignored on a table row by Chrome 153 (`probes/step-10-tables.mjs`), so the answer is
 * to build less rather than to promise the browser will skip it. A grid of `position: absolute` rows has no layout to
 * be redone: a row is placed by its `top`, a column by the `left` of the group of cells that starts it, and the
 * browser never measures a cell to decide a width — every column is `--col` wide (70px), which is what the numbers
 * need and no more (the counted widths this step replaced were 47–70px), and they begin at the right edge of the
 * pinned commit column (`APP_COMMIT`) rather than under it.
 *
 * **Why not a library.** A virtualizer for two axes is not a solved problem for a page like this one — measured from
 * the tarballs, `@tanstack/virtual-core` is ~6.7 kB gzip and headless (the rows and columns are two virtualizers and
 * every node is yours to write), `virtua` (~6.1 kB) calls its grid `experimental_VGrid` and has no sticky pieces,
 * `Clusterize.js` virtualizes rows from a string of all of them and knows nothing of columns. All three would have to
 * be vendored into the artifact — the page is one file, opens from disk and resolves no import — and the report
 * measures its own bytes, so the library would be measured by the very tool it is inside. What is left to write
 * after any of them is what this file is: the window, the cells, the header and the pinned column.
 *
 * **What is built.** The window is the rows and the columns the shell shows, plus `APP_OVER` beyond each edge: what
 * the reader is about to reach is already there, so the edge of the window is never seen empty. Scrolling costs no
 * JavaScript, the rows sit in the scrolled content at their own `top`; the script works only when the window has
 * really moved, and then only on what left it and what entered it (measured on the prototype: 0.9 ms a step down the
 * table, against 6.5 ms for building the whole window again). The header sticks to the shell's top and the commit
 * column to its left (both `position: sticky`), so the row and the column a number belongs to are always in sight.
 *
 * The choice is applied by building the window again: the columns of a switched-off file are simply not among the
 * columns that are built, so there is nothing to hide and nothing to recount — the totals are the sum over the files
 * that are on, counted by `rowModel` for the rows the window holds (`src/derived.js`, one place for that
 * arithmetic).
 */

/* The geometry in pixels: written here and read by the styling (`src/table.css`), which is one copy too many — hence
 * `test/page-grid.test.js` holds the two together, and the report says the same numbers in its journal. The header is
 * two lines of one row each, and the commit column is as wide as the styling pins it. */
export const APP_COL = 70;
export const APP_ROW = 25;
export const APP_HEAD = APP_ROW * 2;
export const APP_COMMIT = 220;

/* How much more than the visible window is built, in rows and in columns. A window that ends exactly at the edge of
 * the shell shows an empty band while the browser scrolls a notch; four rows and four columns of slack are cheaper
 * than that band, and they are what makes a scroll with the wheel or the trackpad look like a scroll. */
export const APP_OVER = 4;

/* The window of a shell that has no size: jsdom lays nothing out, and a shell with no metrics is hidden. A page is
 * not written for that case, but its checks are: without these figures a check would read an empty table and say
 * nothing rather than say it about the right thing. */
export const APP_MIN_ROWS = 24;
export const APP_MIN_COLS = 10;

/* The order of the columns: the files whose numbers last moved come first, and the older the move the further right the
 * column stands. A reader opens the report after a commit, and what he looks for is what that edit brought — while the
 * rest may as well be ordered by the settings, which is the order of the ties.
 *
 * The mark is taken from the numbers rather than from the history's list of paths, and that is the whole of the
 * difference: a commit can touch a column without moving it (a version bumped inside a line of the same length, this
 * package's own attachment to itself is one), and a column of empty cells standing in front of the table is what a
 * reader sees as a broken order. The list of paths is the engine's (`--data`), which is where a fact about a commit
 * belongs; what stands here is a fact about the numbers.
 *
 * The order depends on the files rather than on the choice: that is what lets a column be switched off without moving
 * the others. Counted once per document — the model does not change while the page is open — because every window the
 * reader scrolls to asks for it. */
function appRank() {
  const rank = appData.files.map(() => -1);
  let was = null;
  appData.rows.forEach((row, i) => {
    /* The rows of a file are the same object until it moves (`src/page/payload.js`), so one comparison per file and
     * row says whether the file appeared, moved or went away at this commit — the three cases a cell is not empty. */
    row.values.forEach((v, j) => { if (was === null || was[j] !== v) rank[j] = i; });
    was = row.values;
  });
  return rank;
}

let appOrderValue = null;

export function appOrder() {
  if (appOrderValue === null) {
    const rank = appRank();
    const files = [];
    appData.files.forEach((_f, i) => files.push(i));
    appOrderValue = files.sort((a, b) => rank[b] - rank[a]);
  }
  return appOrderValue;
}

/* The files whose columns are built, in the order of the columns: what is switched off is not among them, which is
 * the whole of what a switch changes about the grid. */
function appList() {
  const out = [];
  appOrder().forEach((i) => { if (appView.files[i] === true) out.push(i); });
  return out;
}

/* A number with its sign: the rules of a cell's content live in `cellParts` and `valueParts`, only the node is here —
 * and its class, which carries the alignment (`num`), the group's left edge (`g`), the gap (`miss`) and the colour of
 * the change (`up`/`down`). The colour stands on the cell itself rather than on a child of it: a report of this
 * repository's size has a quarter of a million of these numbers, and one node instead of two is half of the window. */
function appNum(parts, cls) {
  return appEl('span', cls + (parts.miss ? ' miss' : '') + (parts.dir === null ? '' : ' ' + parts.dir), parts.text);
}

/* A commit's caption: the date, the subject, the journal section's mark. The column has a fixed width, so the
 * caption is clipped with an ellipsis rather than wrapped (`.clip` in the styling), while the whole subject stands
 * in the tooltip. */
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
  return clip;
}

/* The empty states: when there will be no numbers at all, the page says so in words rather than showing a grid
 * without columns. Every file can be switched off — then the total volume remains, and the note explains why there
 * are no columns. The shell stays where it is either way: this is about what is shown, not about what exists. */
export function appState(metricsCount, filesCount) {
  const state = document.getElementById('state');
  const text = metricsCount === 0 ? appUi.empty : (filesCount === 0 ? appUi.noFiles : '');
  state.textContent = text;
  state.hidden = text === '';
  document.getElementById('shell').hidden = metricsCount === 0;
}

/* One cell of the window: the column decides what it holds. The group is the column's ordinal divided by the number of
 * metrics — `0` is the total over the files, `g ≥ 1` is the g-th column of the order — and it is the same arithmetic
 * the header is placed by, so a column and its caption cannot drift apart. The model lists the *enabled* files in the
 * order of the data (that is what its mask means), while the columns stand in the order of the settings, which is why
 * the ordinal of the column is turned into the ordinal of the model by `slot` (counted once per window). */
function appCell(model, c, now, cache) {
  const mi = c % cache.keys.length;
  const group = (c - mi) / cache.keys.length;
  const cls = 'num' + (mi === 0 ? ' g' : '');
  const at = group === 0 ? null : cache.slot[group - 1];
  const cell = at === null ? model.total[mi] : (model.files[at] || [])[mi];
  if (cell === undefined) return appEl('span', cls);
  return appNum(now ? valueParts(cell) : cellParts(cell.value, cell.delta, '−'), cls);
}

/* A row of the window: the caption of the commit and the numbers of the columns the window holds. The top row is the
 * state at HEAD (`nowModel`) rather than the last commit's cells: an absolute number stands in the table once, and
 * the deltas below it add up to it. */
function appRow(cache, r, span) {
  const last = appData.rows.length;
  const now = r === 0;
  const i = last - r;
  const model = now
    ? nowModel(appData.now, cache.keys, appView.files)
    : rowModel(appData.rows[i].values, i === 0 ? null : appData.rows[i - 1].values, cache.keys, appView.files);
  const row = appEl('div', 'row' + (now ? ' now' : ''));
  row.style.top = (APP_HEAD + r * APP_ROW) + 'px';
  const commit = appEl('div', 'c-commit');
  if (now) commit.textContent = appUi.now;
  else commit.appendChild(appCommit(appData.rows[i]));
  row.appendChild(commit);
  const cells = appEl('div', 'cells');
  /* The numbers stand beside the commit column rather than under it: the column is pinned over the content, so what the
   * grid holds begins where the column ends. */
  cells.style.left = (APP_COMMIT + span.c0 * APP_COL) + 'px';
  for (let c = span.c0; c <= span.c1; c++) cells.appendChild(appCell(model, c, now, cache));
  row.appendChild(cells);
  return row;
}

/* A built row into the window: the map is what says which rows are in the markup, so a row goes into it where it is
 * made — otherwise a window that moved would build its rows beside the ones that are still there. */
function appPlace(cache, r, span) {
  const row = appRow(cache, r, span);
  cache.rows.set(r, row);
  cache.grid.appendChild(row);
  return row;
}

/* A caption of the header: a file's name or a metric's. The room is a fixed number of columns, so a name that does
 * not fit is cut with an ellipsis (the styling) rather than wrapped — the header is one line high, and the whole name
 * is reachable in the tooltip. */
function appCaption(text, cls, span) {
  const el = appEl('span', cls, text);
  if (span > 1) el.style.gridColumn = 'span ' + span;
  el.title = text;
  return el;
}

/* The header: the total and the enabled files over their columns, and one caption per metric column under them. It
 * holds the window's columns alone and is built again only when the window moves sideways — scrolling down leaves it
 * untouched, and the two rows of it are placed by `grid-column`, so a group of metrics is a group in the grid. */
function appHead(cache, span) {
  const count = cache.keys.length;
  const g0 = Math.floor(span.c0 / count);
  const g1 = Math.floor(span.c1 / count);
  const left = (APP_COMMIT + g0 * count * APP_COL) + 'px';
  const head = appEl('div', 'head');
  head.appendChild(appEl('div', 'c-commit', appUi.commit));
  const groups = appEl('div', 'hgroups');
  groups.style.left = left;
  const metrics = appEl('div', 'hmetrics');
  metrics.style.left = left;
  for (let g = g0; g <= g1; g++) {
    const label = g === 0 ? appUi.total : appData.files[cache.list[g - 1]].label;
    groups.appendChild(appCaption(label, 'gh', count));
    for (let mi = 0; mi < count; mi++) {
      metrics.appendChild(appCaption(cache.labels[mi], mi === 0 ? 'g' : '', 1));
    }
  }
  head.appendChild(groups);
  head.appendChild(metrics);
  return head;
}

/* The window the shell shows: the rows and the columns, in the ordinals of the whole grid, and the size of that
 * grid. The rows are counted from the top of the content, under the header: the header is stuck to the top of the
 * shell and covers the first rows of the content, hence the offset at both ends of the window. */
export function appSpan(cache) {
  const shell = cache.shell;
  /* The metrics and the files of the window are read from the view here rather than kept: a switch changes them, and
   * what is built has to be the choice as it is now — the keys, their captions and the ordinals of both below. */
  cache.keys = [];
  cache.labels = [];
  appData.metrics.forEach((m) => {
    if (appView.metrics[m.key] === true) { cache.keys.push(m.key); cache.labels.push(m.label); }
  });
  const count = cache.keys.length;
  cache.list = appList();
  /* The ordinals of the model: `rowModel` lists the enabled files in the order of the data, the columns stand in the
   * order of the settings, and `rank` is the bridge between the two — counted once per window, asked per cell. */
  let rank = 0;
  cache.rank = [];
  appData.files.forEach((_f, i) => { cache.rank[i] = appView.files[i] === true ? rank++ : -1; });
  cache.slot = cache.list.map((i) => cache.rank[i]);
  const cols = count * (cache.list.length + 1);
  const rows = appData.rows.length + 1;
  cache.grid.style.width = (APP_COMMIT + cols * APP_COL) + 'px';
  cache.grid.style.height = (APP_HEAD + rows * APP_ROW) + 'px';
  if (count === 0) return { r0: 0, r1: -1, c0: 0, c1: -1 };
  const high = shell.clientHeight || APP_MIN_ROWS * APP_ROW;
  const wide = shell.clientWidth || APP_MIN_COLS * APP_COL;
  const top = shell.scrollTop + APP_HEAD;
  return {
    r0: Math.max(0, Math.floor(top / APP_ROW) - APP_OVER),
    r1: Math.min(rows - 1, Math.floor((top + high) / APP_ROW) + APP_OVER),
    c0: Math.max(0, Math.floor(shell.scrollLeft / APP_COL) - APP_OVER),
    c1: Math.min(cols - 1, Math.floor((shell.scrollLeft + wide) / APP_COL) + APP_OVER)
  };
}

/* The window drawn. A scroll costs what left the window and what entered it, and nothing else: the row that is
 * already built is not touched. Sideways — the window of columns is another window — the header and the rows are
 * built again, because a column that is not there cannot be shown; the reader's own choice (`redraw`) is the same
 * kind of change, and comes here by the same road. */
export function appWindow(cache, redraw) {
  const span = appSpan(cache);
  const was = cache.win;
  cache.win = span;
  if (redraw === true || was === null || was.c0 !== span.c0 || was.c1 !== span.c1) {
    const head = cache.grid.querySelector('.head');
    if (head !== null) head.remove();
    cache.grid.insertBefore(appHead(cache, span), cache.grid.firstChild);
    cache.rows.clear();
    [...cache.grid.querySelectorAll('.row')].forEach((row) => row.remove());
    for (let r = span.r0; r <= span.r1; r++) appPlace(cache, r, span);
    return;
  }
  [...cache.rows.keys()].forEach((r) => {
    if (r >= span.r0 && r <= span.r1) return;
    cache.rows.get(r).remove();
    cache.rows.delete(r);
  });
  for (let r = span.r0; r <= span.r1; r++) {
    if (!cache.rows.has(r)) appPlace(cache, r, span);
  }
}

/* The grid: the shell whose scroll it follows, the metrics it counts in and the window at the place the reader is.
 * The first drawing happens where the view is known (`appPaint` of the assembling chapter): what is built here is the
 * place the table stands in, and no cell of it. */
export function appTable(grid) {
  const cache = {
    grid: grid,
    shell: document.getElementById('shell'),
    keys: [],
    labels: [],
    list: [],
    rank: [],
    slot: [],
    rows: new Map(),
    win: null
  };
  cache.shell.addEventListener('scroll', () => appWindow(cache));
  window.addEventListener('resize', () => appWindow(cache, true));
  return cache;
}

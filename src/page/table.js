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
 * **A step down the table and a step sideways cost the same kind of work.** A row is made once and then stands at its
 * own place in the scrolled content while the window moves over it: the window's columns are the range of that row's
 * numbers, so a step sideways makes the columns that entered and drops the ones that left (`appStrip`) — a cell per
 * row, the header's two lines included. A row that left the window vertically is dropped and made again when the
 * reader comes back to it, which is what makes a jump down the table cost the same as a step. Building the rows again
 * on every sideways scroll — the first version of this step — is what `probes/step-12-window.mjs` measures against the
 * splice (`worklog/0211-sideways-step.md`).
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

/* A strip of pieces of one range, moved to another: the pieces the two ranges share are kept, and only the ends are
 * made and dropped. The unit of a strip is its child — a row's numbers are one column to a child, the header's line of
 * names one group, its line of metrics one column — so the same movement serves all three, and a group of metrics
 * cannot be split by the window (a column of numbers would lose its caption). A window that jumped clear of the old
 * range — the reader dragged the scrollbar — has nothing to keep and the strip is made again; the empty range
 * `[c, c - 1]` is how a strip that holds nothing yet says so. */
function appStrip(strip, was, now, make) {
  const a = Math.max(was[0], now[0]);
  const b = Math.min(was[1], now[1]);
  if (a > b) {
    strip.textContent = '';
    for (let c = now[0]; c <= now[1]; c++) strip.appendChild(make(c));
    return;
  }
  for (let n = a - was[0]; n > 0; n--) strip.firstChild.remove();
  for (let n = was[1] - b; n > 0; n--) strip.lastChild.remove();
  const edge = strip.firstChild;
  for (let c = a - 1; c >= now[0]; c--) strip.insertBefore(make(c), edge);
  for (let c = b + 1; c <= now[1]; c++) strip.appendChild(make(c));
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

/* A row of the window: the caption of the commit and an empty strip of numbers for the window to fill (`appCells`).
 * The top row is the state at HEAD (`nowModel`) rather than the last commit's cells: an absolute number stands in the
 * table once, and the deltas below it add up to it.
 *
 * The model is kept in the entry beside the node because the numbers of a row depend on the commit and the choice
 * rather than on the place the window stands at: a step sideways asks for a cell's arithmetic, never for `rowModel`
 * again. The strip is born empty — the range `[c0, c0 - 1]` — and is filled by the first `appCells`. */
function appRow(cache, r, span) {
  const last = appData.rows.length;
  const now = r === 0;
  const i = last - r;
  const model = now
    ? nowModel(appData.now, cache.keys, appView.files)
    : rowModel(appData.rows[i].values, i === 0 ? null : appData.rows[i - 1].values, cache.keys, appView.files);
  const el = appEl('div', 'row' + (now ? ' now' : ''));
  el.style.top = (APP_HEAD + r * APP_ROW) + 'px';
  const commit = appEl('div', 'c-commit');
  if (now) commit.textContent = appUi.now;
  else commit.appendChild(appCommit(appData.rows[i]));
  el.appendChild(commit);
  const cells = appEl('div', 'cells');
  el.appendChild(cells);
  return { el: el, cells: cells, model: model, now: now, cols: [span.c0, span.c0 - 1] };
}

/* A row's numbers at the window's columns: the columns the two windows share keep their cells, and a column that
 * entered is made. The numbers stand beside the pinned commit column rather than under it — the column lies over the
 * content — so the strip is placed by the window's first column, and the cells of it follow their strip. A step down
 * the table asks for the columns it already holds, and the row is not touched at all. */
function appCells(entry, cache, span) {
  const cols = [span.c0, span.c1];
  if (entry.cols[0] === cols[0] && entry.cols[1] === cols[1]) return;
  entry.cells.style.left = (APP_COMMIT + cols[0] * APP_COL) + 'px';
  appStrip(entry.cells, entry.cols, cols, (c) => appCell(entry.model, c, entry.now, cache));
  entry.cols = cols;
}

/* A built row into the window: the map is what says which rows are in the markup, so a row goes into it where it is
 * made — otherwise a window that moved would build its rows beside the ones that are still there. */
function appPlace(cache, r, span) {
  const entry = appRow(cache, r, span);
  cache.rows.set(r, entry);
  appCells(entry, cache, span);
  cache.grid.appendChild(entry.el);
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

/* The header's frame: the commit column and the two empty strips that `appStrip` fills — the names of the groups over
 * the columns, their metrics under them. An empty strip says `[0, -1]`, which is what makes the first `appHead` fill
 * it rather than move it. */
function appHeadNew() {
  const el = appEl('div', 'head');
  const groups = appEl('div', 'hgroups');
  const metrics = appEl('div', 'hmetrics');
  el.appendChild(appEl('div', 'c-commit', appUi.commit));
  el.appendChild(groups);
  el.appendChild(metrics);
  return { el: el, groups: groups, metrics: metrics, g: [0, -1] };
}

/* The header: the total and the enabled files over their columns, and one caption per metric column under them. The two
 * strips move by the same `appStrip` as a row's numbers, and the unit of the metrics line is a column, so its strip is
 * asked for whole groups — the metrics of a column stand under their file even when the window cuts the last group.
 * A window that did not leave a group (a step down the table) leaves the header alone. */
function appHead(cache, span) {
  const count = cache.keys.length;
  const g0 = count === 0 ? 0 : Math.floor(span.c0 / count);
  const g1 = count === 0 ? -1 : Math.floor(span.c1 / count);
  if (cache.head === null) cache.head = appHeadNew();
  const h = cache.head;
  if (h.g[0] === g0 && h.g[1] === g1) return h.el;
  const was = h.g;
  h.g = [g0, g1];
  h.groups.style.left = (APP_COMMIT + g0 * count * APP_COL) + 'px';
  h.metrics.style.left = h.groups.style.left;
  appStrip(h.groups, was, h.g, (g) => appCaption(
    g === 0 ? appUi.total : appData.files[cache.list[g - 1]].label, 'gh', count));
  appStrip(h.metrics, [was[0] * count, was[1] * count + count - 1], [g0 * count, g1 * count + count - 1],
    (c) => appCaption(cache.labels[c % count], c % count === 0 ? 'g' : '', 1));
  return h.el;
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

/* The window drawn. Moving over the grid costs what left it and what entered it, and nothing else: the rows in the
 * markup are the window's rows (what left it is dropped, what entered it is made) and each of them holds the columns
 * of the window (`appCells`), so a step in either direction is paid by the rows that moved rather than by the table.
 *
 * The reader's own choice (`redraw`) is the one thing that cannot be a move: the columns of a switched-off file are
 * simply not among the columns that are built, so there is nothing to hide and nothing to recount — the totals are the
 * sum over the files that are on (`rowModel`), and the window is built from nothing. The shell's own size is the same
 * kind of change: it decides how much of the grid is in sight, which is not a place to move to. */
export function appWindow(cache, redraw) {
  const span = appSpan(cache);
  const was = cache.win;
  cache.win = span;
  if (redraw === true || was === null) {
    /* The grid holds the header and the rows of the window and nothing else, so the whole of it is thrown away rather
     * than tracked piece by piece — and the rows that are made below say in the map that they are there. */
    cache.grid.textContent = '';
    cache.rows.clear();
    cache.head = null;
    cache.grid.appendChild(appHead(cache, span));
    for (let r = span.r0; r <= span.r1; r++) appPlace(cache, r, span);
    return;
  }
  appHead(cache, span);
  [...cache.rows.keys()].forEach((r) => {
    if (r >= span.r0 && r <= span.r1) { appCells(cache.rows.get(r), cache, span); return; }
    cache.rows.get(r).el.remove();
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
    head: null,
    win: null
  };
  cache.shell.addEventListener('scroll', () => appWindow(cache));
  window.addEventListener('resize', () => appWindow(cache, true));
  return cache;
}

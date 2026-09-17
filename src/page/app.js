import { appUnpack } from './payload.js';
import { appApply, appBoot, appData, appFoldRead, appLinkUse, appNotice, appRead, appUi, appView, appWrite } from './state.js';
import { appColumn, appColumnSize, appColumnStale, appContribute, appMetrics, appState, appTable, appTotals, appTotalsReset } from './table.js';
import { appDraw } from './work.js';
import { appPanel, appPanelAll, appPanelState } from './panel.js';

/* Assembling the report: the table is built once (`appTable` of the table chapter) and everything afterwards only
 * shows, hides and recounts. A click on any switch therefore costs a class, a number and the fields it reached — the
 * whole table used to be destroyed and built again, which was 81 % of the cost of a click and produced a hundred
 * thousand dead nodes for the collector to walk.
 *
 * Hence two paths and no third: `appPaint` draws the whole view (the first drawing, a record from the browser's
 * memory, a link in the address), while `appSwitch`, `appSwitchGroup` and `appSwitchMetric` are what one click on a
 * box does. The numbers are counted on the click itself — that is arithmetic over the data — while the nodes of the
 * columns are handed to the work chapter (`appDraw`), which draws the short work on the click and the long one in the
 * next task with a stripe over the page (`src/page/work.js` says what was measured: the price of a switch is the
 * browser's own relayout of the table, and it is paid once here rather than once per slice). Neither path makes a
 * node.
 */

// The table's cache of node references: made once, at the first drawing.
let appCache = null;

/* One file's column drawn from the view — the state is read when the slice runs rather than kept from the click that
 * queued it, so a click that arrives while the queue is running is drawn by the next slice rather than after it. */
function appDrawColumn(i) {
  appColumn(appCache, i, appView.files[i] === true);
}

/* The columns of a switch that have to be drawn, as the units the work chapter weighs (`{i, units}` — the file and the
 * nodes of its column). Only the columns whose nodes are out of step with the view are asked for (`appColumnStale`): a
 * report opened with everything switched on has nothing to draw, and a column that is already right would cost its
 * nodes again. The count is the table's (`appColumnSize`), because the table is the only place that knows how many
 * nodes a column has. */
function appColumns(indexes) {
  const todo = indexes.filter((i) => appColumnStale(appCache, i));
  appDraw(appDrawColumn, todo.map((i) => ({ i: i, units: appColumnSize(appCache, i) })));
}

/* The note under the table: what a row is and how the report was made. It does not depend on the choice, so it is
 * written once — with the table rather than with every drawing of it. */
function appNote() {
  document.getElementById('note').textContent = appUi.note
    .replace('{rows}', appData.rows.length)
    .replace('{command}', appData.report.fixCommand);
}

/* What the empty states are told: how many metrics and how many files are left. The table stands there in either
 * case (it is built once) — the words are about what is shown. */
export function appCounts() {
  appState(appData.metrics.filter((m) => appView.metrics[m.key] === true).length,
    appView.files.filter((on) => on === true).length);
}

/* The whole view drawn: every column, the totals of the whole selection, the metrics, the empty states and the panel's
 * fields. This is what a link, a record from the memory and the first drawing need — and it makes no node either. */
export function appPaint() {
  appColumns(appData.files.map((_f, i) => i));
  appTotalsReset(appCache);
  appMetrics(appCache);
  appCounts();
  appPanelAll();
  appWrite();
}

/* One file switched by the reader: the view, its share of the totals, the fields it shows in and its column — the
 * last through the queue, because a column may be long. The message about a link fades here: by this action the
 * reader has read it. */
export function appSwitch(i, on) {
  if (appView.files[i] === on) return;
  appView.files[i] = on;
  appContribute(appCache, i, on);
  appTotals(appCache);
  appCounts();
  appPanelState([i]);
  appWrite();
  appNotice('');
  appColumns([i]);
}

/* A group switched at once — a folder or a category: the same work per file, then the totals once and the fields of
 * the files the choice really reached (switching a folder on when a part of it was already on touches only the rest,
 * and a field that did not move is not written). The columns of the whole group go into the queue together, so the bar
 * counts them as one piece of work. */
export function appSwitchGroup(indexes, on) {
  const touched = indexes.filter((i) => appView.files[i] !== on);
  touched.forEach((i) => {
    appView.files[i] = on;
    appContribute(appCache, i, on);
  });
  appTotals(appCache);
  appCounts();
  appPanelState(touched);
  appWrite();
  appNotice('');
  appColumns(touched);
}

/* One metric switched: a class on the table and the headings' `colSpan`. The totals do not move with a metric — they
 * are sums over files — and the metric's own field is the box the reader just clicked. */
export function appSwitchMetric() {
  appMetrics(appCache);
  appCounts();
  appWrite();
  appNotice('');
}

/* The first drawing: the choice is already in the view (the link and the memory are applied above), the panel is
 * built to match it, the table is built once — every column of every file — and the view is painted over it. */
function appFirst() {
  appPanel();
  appCache = appTable(document.getElementById('grid'));
  appNote();
  appPaint();
}

/* The page's one asynchronous step, and why there is one. The block in the artifact is packed, and the platform's own
 * unpacker answers with a promise, so the first drawing waits for it; everything after the first drawing is as
 * synchronous as it was, and a click costs what it cost. A host that cannot unpack is told in words instead of being
 * left with an empty table — the reader would not know whether the report or the browser is at fault. */
let appBooted = false;

/* Restoring happens before the first drawing: for someone opening the page for the first time the view has to be the
 * default rather than someone else's choice. A link outranks the memory: it is the sender's explicit choice, and
 * while the reader has changed nothing it does not replace his own — writing it to the memory is what does not
 * happen. A refused link is not an empty table but a message: the reader sees both what happened and what is shown
 * instead. */
async function appBegin() {
  try {
    appBoot(await appUnpack(document.getElementById('data')));
  } catch (_e) {
    appNotice(appUi.unpack);
    return;
  }
  const appStart = appLinkUse();
  /* A link that came in is the sender's choice rather than the reader's: while it is drawn, the memory is not touched
   * (`appWrite`), so opening a link does not make it the reader's own. */
  appTransient = appStart === 'ours';
  if (appStart !== 'ours') {
    const appSaved = appRead();
    if (appSaved !== null) appApply(appSaved);
  }
  /* The unfolded tree is the onlooker's memory rather than the reader's choice: it comes back even when someone
   * else's link is open (otherwise a link sent over would unfold the tree again on every visit). */
  appFoldRead();
  appFirst();
  appBooted = true;
  appTransient = false;
}

/* Whoever opened the page and has to know when the first drawing is over waits for this promise — the checks do
 * (`tools/page-harness.js`); the page itself has no use for it. */
window.appDrawn = appBegin();

/* The anchor changed on an open page: the choice in the new address is applied by the same code as at opening. The
 * page's own address raises no such event (`replaceState` does not), so there is no loop here. A refusal touches
 * neither the view — the reader keeps looking at what he looked at — nor the address: it was sent to the reader,
 * and until he acts it is not ours. The message about the link stays: this drawing is exactly what it explains. */
window.addEventListener('hashchange', () => {
  /* The first drawing has not happened yet: the address the page was opened with is the business of that drawing,
   * and a change that arrives before it has drawn nothing to replace. */
  if (!appBooted) return;
  /* An address that came in from outside is read here the way it is read at opening, and a link is not the reader's
   * choice until he changes something — the memory stays his own. The address itself is never rewritten: the page has
   * no business in the tab's title bar, and what a link holds is read rather than made. */
  appTransient = appLinkUse() === 'ours';
  appPaint();
  appTransient = false;
});

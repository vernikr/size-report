import { appUnpack } from './payload.js';
import { appAddressDrop, appApply, appBoot, appData, appFoldRead, appLinkUse, appNotice, appRead, appUi, appView, appWrite } from './state.js';
import { appColumn, appContribute, appMetrics, appState, appTable, appTotals, appTotalsReset } from './table.js';
import { appPanel, appPanelAll, appPanelState } from './panel.js';

/* Assembling the report: the table is built once (`appTable` of the table chapter) and everything afterwards only
 * shows, hides and recounts. A click on any switch therefore costs a class, a number and the fields it reached — the
 * whole table used to be destroyed and built again, which was 81 % of the cost of a click and produced a hundred
 * thousand dead nodes for the collector to walk.
 *
 * Hence two paths and no third: `appPaint` draws the whole view (the first drawing, a record from the browser's
 * memory, a link in the address), while `appSwitch`, `appSwitchGroup` and `appSwitchMetric` are what one click on a
 * box does. Neither makes a node.
 */

// The table's cache of node references: made once, at the first drawing.
let appCache = null;

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
  appData.files.forEach((_f, i) => appColumn(appCache, i, appView.files[i]));
  appTotalsReset(appCache);
  appMetrics(appCache);
  appCounts();
  appPanelAll();
  appWrite();
}

/* One file switched by the reader: the view, its column, its share of the totals and the fields it shows in — each in
 * its own place. The message about a link fades here: by this action the reader has read it. */
export function appSwitch(i, on) {
  if (appView.files[i] === on) return;
  appView.files[i] = on;
  appColumn(appCache, i, on);
  appContribute(appCache, i, on);
  appTotals(appCache);
  appCounts();
  appPanelState([i]);
  appWrite();
  appNotice('');
}

/* A group switched at once — a folder or a category: the same work per file, then the totals once and the fields of
 * the files the choice really reached (switching a folder on when a part of it was already on touches only the rest,
 * and a field that did not move is not written). */
export function appSwitchGroup(indexes, on) {
  const touched = indexes.filter((i) => appView.files[i] !== on);
  touched.forEach((i) => {
    appView.files[i] = on;
    appColumn(appCache, i, on);
    appContribute(appCache, i, on);
  });
  appTotals(appCache);
  appCounts();
  appPanelState(touched);
  appWrite();
  appNotice('');
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
  if (appStart === 'ours') appTransient = true;
  else if (appStart === 'refused') appForeign = true;
  if (appStart !== 'ours') {
    const appSaved = appRead();
    if (appSaved !== null) appApply(appSaved);
  }
  /* The folded tree is the onlooker's memory rather than the reader's choice: it comes back even when someone
   * else's link is open (otherwise a link sent over would unfold the tree again on every visit). */
  appFoldRead();
  appFirst();
  appBooted = true;
  appStartup = false;
  appForeign = false;
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
  /* An address that came in from outside is read first and a write this page was still holding is dropped: the reader
   * has the address they were sent, not the one the previous click armed (see `appAddressDrop`). */
  appAddressDrop();
  const state = appLinkUse();
  if (state === 'refused') appForeign = true;
  appTransient = state === 'ours';
  appPaint();
  appForeign = false;
  appTransient = false;
});

import { appUnpack } from './payload.js';
import { appApply, appBoot, appData, appFoldRead, appLinkUse, appNotice, appRead, appUi, appView, appWrite } from './state.js';
import { appState, appTable, appWindow } from './table.js';
import { appPanel, appPanelAll, appPanelState } from './panel.js';

/* Assembling the report: the table is a window of the grid (`appWindow` of the table chapter) and nothing is built
 * that the reader cannot see. Two paths and no third: `appPaint` draws the whole view (the first drawing, a record from
 * the browser's memory, a link in the address), while a click on a box does the same work for the choice it made — the
 * difference between them is only how much of the view moved. Neither has anything to wait for: a switch builds the
 * window of the grid, a few hundred cells and milliseconds, so the page needs no indicator and keeps no promise it
 * cannot measure.
 */

// The table's window: made once, at the first drawing.
let appCache = null;

/* The note under the table: what a row is and how the report was made. It does not depend on the choice, so it is
 * written once — with the table rather than with every drawing of it. */
function appNote() {
  document.getElementById('note').textContent = appUi.note
    .replace('{rows}', appData.rows.length)
    .replace('{command}', appData.report.fixCommand);
}

/* What the empty states are told: how many metrics and how many files are left. The window stands there in either
 * case — the words are about what is shown. */
export function appCounts() {
  appState(appData.metrics.filter((m) => appView.metrics[m.key] === true).length,
    appView.files.filter((on) => on === true).length);
}

/* The whole view drawn: the window of the grid, the metrics, the empty states and the panel's fields. This is what a
 * link, a record from the memory and the first drawing need. */
export function appPaint() {
  appWindow(appCache, true);
  appCounts();
  appPanelAll();
  appWrite();
}

/* One drawing after a click, whatever was clicked: the window of the grid (the columns of what is switched off are
 * simply not among the columns that are built), the counts of the empty states, the fields the choice really reached
 * (`touched` — a whole group is one click, and a field that did not move is not written) and the memory. The message
 * about a link fades here: by this action the reader has read it. */
function appChanged(touched) {
  appWindow(appCache, true);
  appCounts();
  if (touched.length > 0) appPanelState(touched);
  appWrite();
  appNotice('');
}

// One file switched by the reader. A switch that changes nothing is not a change: the click costs no drawing.
export function appSwitch(i, on) {
  if (appView.files[i] === on) return;
  appView.files[i] = on;
  appChanged([i]);
}

/* A group switched at once — a folder or a category: the same work per file, and the fields of the files the choice
 * really reached (switching a folder on when a part of it was already on touches only the rest). */
export function appSwitchGroup(indexes, on) {
  const touched = indexes.filter((i) => appView.files[i] !== on);
  touched.forEach((i) => { appView.files[i] = on; });
  appChanged(touched);
}

/* One metric switched. Only the panel's metric box shows it, and that box is the one the reader just clicked. */
export function appSwitchMetric() {
  appChanged([]);
}

/* The first drawing: the choice is already in the view (the link and the memory are applied above), the panel is
 * built to match it, the window of the grid is built — the columns the choice leaves and the rows the shell shows —
 * and the panel's fields are written from the view. */
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

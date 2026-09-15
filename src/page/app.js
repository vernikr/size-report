import { appData, appUi, appView, appWrite, appNotice, appLinkUse, appRead, appApply, appFoldRead } from './state.js';
import { appBody, appHead, appState } from './table.js';
import { appPanel } from './panel.js';

/* Assembling the table: what to show (the metrics and files the reader left on) and where to put it. The table
 * chapter builds the markup of the head and the rows, the shared calculation gives the numbers — all that is
 * left here is the decision and the insertion, with no numbers of its own. */
function appTable() {
  const shown = appData.metrics.filter((m) => appView.metrics[m.key]);
  const metrics = shown.map((m) => m.key);
  const on = appView.files;
  const files = [];
  appData.files.forEach((f, i) => { if (on[i]) files.push(i); });
  /* The columns the last commit touched come first: the report is rebuilt after every commit, and a reader's first
   * question is what that edit brought. Inside each part the order stays as it comes from the settings — `sort` is
   * stable, and the order of the columns is what the reader is used to. The mark comes from the history (which the
   * engine knows) rather than from the numbers: an edit that changed no size is an edit too. */
  files.sort((a, b) => (appData.last[a] === true ? 0 : 1) - (appData.last[b] === true ? 0 : 1));

  const table = document.getElementById('grid');
  table.textContent = '';
  appState(metrics.length, files.length);
  if (metrics.length === 0) return;

  table.appendChild(appHead(shown, files, metrics));
  table.appendChild(appBody(metrics, files));
  document.getElementById('note').textContent = appUi.note
    .replace('{rows}', appData.rows.length)
    .replace('{command}', appData.report.fixCommand);
  appWrite();
}

/* The panel's scroll is a property of the panel rather than of the markup, which is why it survives a rebuild:
 * otherwise every click on a checkbox would send the list back to the top and the files at its end would be
 * unreachable. Both the panel's scroll and the file list's are remembered — each has one of its own, and in a
 * narrow window it is the list that scrolls. The elements are the ones the page really has (`#panel` from the
 * markup, `.files` inside it from the panel): there is no second list of scroll places in the package. */
const appScrolled = ['#panel', '#panel .files'];
function appScrollTop() {
  return appScrolled.map((sel) => {
    const el = document.querySelector(sel);
    return el === null ? 0 : el.scrollTop;
  });
}

function appScrollBack(saved) {
  appScrolled.forEach((sel, i) => {
    const el = document.querySelector(sel);
    if (el !== null) el.scrollTop = saved[i];
  });
}

/* The panel is redrawn whole, so the field under the keyboard and the scroll come back to their places after every
 * rebuild: otherwise switching with Tab and Space would mean walking the panel from the start again, and the scroll
 * would have to find its place anew. A field is identified by its ordinal number — the order of the panel's fields
 * does not change between rebuilds. The focus is set without scrolling (`preventScroll`): it returns the keyboard
 * rather than moving the list. */
function appRender(keepNotice) {
  const at = Array.from(document.querySelectorAll('#panel input')).indexOf(document.activeElement);
  const saved = appScrollTop();
  appPanel();
  appScrollBack(saved);
  if (at >= 0) document.querySelectorAll('#panel input')[at].focus({ preventScroll: true });
  appTable();
  /* The message about the link survives the very drawing it caused, and fades on the reader's next action: he has read
   * it by then. */
  if (keepNotice !== true) appNotice('');
}

/* Restoring happens before the first drawing: for someone opening the page for the first time the view has to be the
 * default rather than someone else's choice. A link outranks the memory: it is the sender's explicit choice, and
 * while the reader has changed nothing it does not replace his own — writing it to the memory is what does not
 * happen. A refused link is not an empty table but a message: the reader sees both what happened and what is shown
 * instead. */
const appStart = appLinkUse();
if (appStart === 'ours') appTransient = true;
else if (appStart === 'refused') appForeign = true;
if (appStart !== 'ours') {
  const appSaved = appRead();
  if (appSaved !== null) appApply(appSaved);
}
/* The folded tree is the onlooker's memory rather than the reader's choice: it comes back even when someone else's
 * link is open (otherwise a link sent over would unfold the tree again on every visit). */
appFoldRead();
appRender(true);
appStartup = false;
appForeign = false;
appTransient = false;

/* The anchor changed on an open page: the choice in the new address is applied by the same code as at opening. The
 * page's own address raises no such event (`replaceState` does not), so there is no loop here. A refusal touches
 * neither the view — the reader keeps looking at what he looked at — nor the address: it was sent to the reader,
 * and until he acts it is not ours. */
window.addEventListener('hashchange', () => {
  const state = appLinkUse();
  if (state === 'refused') appForeign = true;
  appTransient = state === 'ours';
  appRender(true);
  appForeign = false;
  appTransient = false;
});

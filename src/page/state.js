/* The page's choice state: what is switched on, how it survives a closing and how it travels as a link.
 *
 * An ordinary source file rather than a string inside the engine: a linter sees it, and it is pasted into the assembled
 * page (`pageScript` strips module syntax — the `import` lines and the `export` keywords of the chapters). The numbers
 * come from the derived quantities, so switching a metric, a category or a file calls the same calculation the report's
 * numbers come from and cannot yield different ones.
 *
 * The page is one file without external references, so there is no dynamic import here and nothing is loaded over the
 * network: the styling arrives in the same file, and the cell markup follows the rules of the shared part of the styling
 * (`clip`, a commit's caption).
 *
 * The panel remembers the reader's choice between visits and can hand it over as a link ("the choice's memory" below):
 * the record is tied to the report's passport and keeps only what is switched off, by name, so someone else's record is
 * not applied while a vanished name simply means nothing. The same record goes into the address — which is what one
 * sends to a colleague.
 *
 * The page does not derive a number's accuracy itself: the marks of approximate cells arrive in the data, from the same
 * rule that names a metric's accuracy. The page draws no such conclusion from paths and formats — there will be no
 * second rule of accuracy. */

export const appData = JSON.parse(document.getElementById('data').textContent);
export const appUi = JSON.parse(document.getElementById('ui').textContent);
export const appView = { metrics: {}, files: [], folded: {} };
appData.metrics.forEach((m) => { appView.metrics[m.key] = true; });
appData.files.forEach(() => { appView.files.push(true); });

/* A metric's description by key: the tooltip of an approximate cell names the way its number was obtained — the same one
 * that stands in the metric's caption, so the page holds no two answers about "counted with what". */
export const appMetric = {};
appData.metrics.forEach((m) => { appMetric[m.key] = m; });

/* A column by a file's path: the page's tree is the project's tree (every path of the catalogue) while the numbers
 * belong to columns only, so this pointer is what decides whether a leaf is a checkbox or a caption. The name follows the
 * same rule as the choice's record (`appFileAt`), so the tree and the reader's memory cannot drift apart. */
export const appMeasured = {};
appData.files.forEach((_f, i) => { appMeasured[appFileAt(i)] = i; });

/* A link is that same choice in the address, under a name of its own: someone else's anchor on the page does not count
 * as a link, and there is nothing to argue with it about. */
const APP_LINK = '#size-report=';

/* Three circumstances of the first drawing, which act on it alone: the address is not rewritten during it (it was sent to
 * the reader rather than the other way), the memory is not touched (a link that came in is not the reader's choice), and
 * the message about the link has not faded yet. */
let appStartup = true;
let appForeign = false;
let appTransient = false;

/* -------- the reader's memory of his choice -------- */

/* The name of a file for the record is its path at HEAD, or the last of the settings when the file is already gone from
 * there: that is the name it is recognised by in the report. */
export function appFileAt(i) {
  const f = appData.files[i];
  return f.path === null ? f.paths[0] : f.path;
}

/* The passport's fingerprint: an identifying mark of a record rather than protection against forgery, so 32 bits are
 * enough (FNV-1a). */
function appHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/* The report's passport: the tool's name, the data schema, the artifact's path, the title and the column labels in the
 * report's order. It is what tells one report from another — the record's key is chosen by it, so a choice made in
 * someone else's report is not picked up. The package version and the top of the history are absent on purpose: this is
 * the same report — updating the tool does not change what a column means, while a grown history is the very history the
 * reader comes back to. */
function appPassport() {
  return appHash([appData.tool.name, appData.schema, appData.report.artifact,
    appData.report.title, appData.files.map((f) => f.label).join('|')].join('\n'));
}
const appKey = 'size-report:' + appPassport();

/* One record of the choice for everything: it goes both into the memory and into the address, so there are no two formats
 * of one state. Only what is switched off is kept, by name: "switched on" and "no record" are the same state, which is
 * why turning every checkbox back on removes the record instead of leaving a trace indistinguishable from a choice. */
function appRecord() {
  const metrics = {};
  const files = {};
  appData.metrics.forEach((m) => { if (!appView.metrics[m.key]) metrics[m.key] = false; });
  appData.files.forEach((_f, i) => { if (!appView.files[i]) files[appFileAt(i)] = false; });
  return { v: 1, passport: appPassport(), metrics: metrics, files: files };
}

// Whether a record is ours and of the right format — one rule for the memory and the address alike.
function appRecordOk(rec) {
  return rec !== null && typeof rec === 'object' && rec.v === 1 && rec.passport === appPassport();
}

export function appWrite() {
  const rec = appRecord();
  const empty = Object.keys(rec.metrics).length === 0 && Object.keys(rec.files).length === 0;
  if (!appTransient) {
    try {
      if (empty) window.localStorage.removeItem(appKey);
      else window.localStorage.setItem(appKey, JSON.stringify(rec));
    } catch (_e) {
      /* There is no memory (the browser grants this page none): the choice will not survive a closing, while the numbers
       * and the markup do not depend on it. */
    }
  }
  /* The address is the link for a colleague, which is why it repeats the choice. But not during the first drawing and not
   * when the link turned out to be someone else's: an address that came in is not ours, and the reader has yet to read
   * it. */
  if (appStartup || appForeign) return;
  try {
    window.history.replaceState(null, '', APP_LINK + encodeURIComponent(JSON.stringify(rec)));
  } catch (_e) {
    /* The browser grants no change of the address: the link is then taken from the browser's memory. */
  }
}

/* A reset to "everything on": the border between "this is no longer in the report" and "switched off" is the record
 * rather than a missing value. A link carries the sender's whole choice, which is why it is applied to a clean view rather
 * than on top of someone else's. */
function appAll() {
  appData.metrics.forEach((m) => { appView.metrics[m.key] = true; });
  appData.files.forEach((_f, i) => { appView.files[i] = true; });
}

/* What the address says. It answers either with a record of ours or with a refusal (`linkForeign` — a link of another
 * report, `linkBroken` — nothing to read): someone else's or a broken choice is not applied, but it does not stay silent
 * either — otherwise the reader would not understand why he sees something other than what was sent to him. An address
 * without the link's name is no link at all: silence, so as not to argue with the page's ordinary anchors. */
function appLinkRead() {
  const hash = window.location.hash || '';
  if (hash.indexOf(APP_LINK) !== 0) return { rec: null, refused: null };
  const body = hash.slice(APP_LINK.length);
  let rec = null;
  try {
    rec = JSON.parse(decodeURIComponent(body));
  } catch (_e) {
    try {
      rec = JSON.parse(body);
    } catch (_e2) {
      return { rec: null, refused: 'linkBroken' };
    }
  }
  if (!appRecordOk(rec)) {
    return { rec: null, refused: rec === null || typeof rec !== 'object' || rec.v !== 1
      ? 'linkBroken' : 'linkForeign' };
  }
  return { rec: rec, refused: null, extra: appUnknown(rec) };
}

/* How many names in the link are unknown to this report: the reader has to be told about them — otherwise he would look
 * in the table for something that was never there. */
function appUnknown(rec) {
  const known = {};
  const metricKeys = {};
  appData.files.forEach((_f, i) => { known[appFileAt(i)] = true; });
  appData.metrics.forEach((m) => { metricKeys[m.key] = true; });
  let n = 0;
  Object.keys(rec.metrics || {}).forEach((k) => { if (!metricKeys[k]) n++; });
  Object.keys(rec.files || {}).forEach((k) => { if (!known[k]) n++; });
  return n;
}

/* The message about the link fades after the reader's very first action: he has read it, and a permanent warning is noise
 * on top of the numbers. */
export function appNotice(text) {
  const el = document.getElementById('notice');
  el.textContent = text;
  el.hidden = text === '';
}

/* What its event does with the address — opening the page and an anchor change on an already open one (the browser does
 * not reload the document then, it only moves the anchor, so without this reading a link would work in a new tab alone).
 * A link of ours replaces the view whole: it holds the sender's entire choice rather than a difference from someone
 * else's. A refusal is explained in words — and touches neither the view nor the address. */
export function appLinkUse() {
  const link = appLinkRead();
  if (link.rec !== null) {
    appAll();
    appApply(link.rec);
    if (link.extra > 0) appNotice(appUi.linkExtra.replace('{n}', link.extra));
    return 'ours';
  }
  if (link.refused !== null) {
    appNotice(appUi[link.refused]);
    return 'refused';
  }
  return 'none';
}

/* Reading: only a record of ours — of our format version and our passport. Another report's record lies under another key,
 * while a foreign, outdated or broken one amounts to its absence. */
export function appRead() {
  let text = null;
  try {
    text = window.localStorage.getItem(appKey);
  } catch (_e) {
    return null;
  }
  if (text === null) return null;
  let rec = null;
  try {
    rec = JSON.parse(text);
  } catch (_e) {
    return null;
  }
  return appRecordOk(rec) ? rec : null;
}

/* Applying goes by name: a file is recognised by its path, a metric by its key. A name the report does not hold matches
 * nothing (a column was pointed at another path, a metric was dropped from the settings), while files and metrics that
 * appeared stay switched on — the way someone opening the page for the first time sees them. */
export function appApply(rec) {
  const metrics = rec.metrics || {};
  const files = rec.files || {};
  appData.metrics.forEach((m) => { if (metrics[m.key] === false) appView.metrics[m.key] = false; });
  appData.files.forEach((_f, i) => { if (files[appFileAt(i)] === false) appView.files[i] = false; });
}

/* -------- the folded tree -------- */

/* Folded folders are a memory of the same kind as the choice, but of a record of their own: it is about how much of the
 * tree is visible rather than about which numbers are read. Hence it does not go into the address: a link is sent for the
 * sake of the numbers, while an unfolded tree is the onlooker's business. As with the choice, only what is folded is kept
 * (`true`), and a folder's name is its path ("src/page"), so a vanished name simply means nothing. */
const appFoldKey = appKey + ':tree';

export function appFoldRead() {
  let text = null;
  try {
    text = window.localStorage.getItem(appFoldKey);
  } catch (_e) {
    return;
  }
  if (text === null) return;
  let rec = null;
  try {
    rec = JSON.parse(text);
  } catch (_e) {
    return;
  }
  if (!appRecordOk(rec)) return;
  const folded = rec.folded || {};
  Object.keys(folded).forEach((p) => { if (folded[p] === true) appView.folded[p] = true; });
}

export function appFoldSet(path, folded) {
  if (folded) appView.folded[path] = true;
  else delete appView.folded[path];
  const rec = { v: 1, passport: appPassport(), folded: Object.assign({}, appView.folded) };
  try {
    if (Object.keys(rec.folded).length === 0) window.localStorage.removeItem(appFoldKey);
    else window.localStorage.setItem(appFoldKey, JSON.stringify(rec));
  } catch (_e) {
    /* There is no memory: what is folded will not survive a closing, while the view does not depend on it — the tree is
     * folded exactly the way the reader folded it just now. */
  }
}

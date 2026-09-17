import { appDecode } from './payload.js';

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
 * The panel remembers the reader's choice between visits ("the choice's memory" below): the record is tied to the
 * report's passport and keeps only what is switched off, by name, so someone else's record is not applied while a
 * vanished name simply means nothing. The record stays in the browser's memory and nowhere else: a report opened from
 * disk keeps a clean address, and a link made in an earlier release is still read (`appLinkUse`).
 *
 * The page draws no conclusion about how a number was obtained: the method of each metric arrives in the data, and the
 * page prints it. There is no second rule of counting here, and no vocabulary of precision either. */

export const appUi = JSON.parse(document.getElementById('ui').textContent);

/* The model is not a constant any longer: the block in the file is **packed** (gzipped and base64 encoded,
 * `appUnpack` of the payload chapter), so unpacking is asynchronous and the model is set once, by `appBoot`,
 * before anything is drawn and before any chapter below reads it. The names, their shapes and their order are what
 * they were; only their appearance moved — from the parse to that one call. */
export let appData = null;
export let appView = null;
export let appMetric = null;
export let appMeasured = null;
let appKey = null;
let appFoldKey = null;

/* One place that turns the unpacked block into what the chapters speak: the sparse form is unrolled by the payload
 * chapter into the dense contract every number comes from — snapshots per commit, the texts themselves, "now" as
 * the state at HEAD — and the view starts switched on whole.
 *
 * A metric's description by key stands here too: the way the number was obtained is text under the switches, so the
 * page holds no second answer about "counted with what".
 *
 * A column by a file's path is the pointer that decides whether a leaf of the tree is a checkbox or a caption (the
 * page's tree is the project's tree while the numbers belong to columns only); the name follows the same rule as the
 * choice's record (`appFileAt`), so the tree and the reader's memory cannot drift apart.
 *
 * The key the reader's memory lives under is counted here as well, because it is the report's passport: it depends
 * on the data, and until the block is unpacked there is nothing to count it from. */
export function appBoot(text) {
  appData = appDecode(JSON.parse(text));
  /* The tree is folded as it opens: a project's tree is longer than the window, and the reader's first look is at a
   * short list rather than at everything. What is remembered is the opposite — the folders the reader unfolded
   * (`appFoldRead`). */
  appView = { metrics: {}, files: [], open: {} };
  appMetric = {};
  appMeasured = {};
  appData.metrics.forEach((m) => { appView.metrics[m.key] = true; appMetric[m.key] = m; });
  appData.files.forEach((_f, i) => { appView.files.push(true); appMeasured[appFileAt(i)] = i; });
  appKey = 'size-report:' + appPassport();
  appFoldKey = appKey + ':tree';
}

/* A link is that same choice in the address, under a name of its own: someone else's anchor on the page does not count
 * as a link, and there is nothing to argue with it about. The page does not write it any more — it only reads what came
 * with the address — and this paragraph is what such a link is read by. */
const APP_LINK = '#size-report=';

/* One circumstance of the first drawing, and it acts on it alone: the memory is not written while somebody else's link
 * is open — what came in is not the reader's choice, and only his own action makes it his. */
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
 * reader comes back to.
 *
 * Counted once per document: it is a constant of the report, which depends on nothing the reader can change, and every
 * click asks for it (the key of the memory and the passport of the record). A second count would be a second answer
 * waiting to happen, and the labels it reads do not change while the page is open. */
let appPassportValue = null;
function appPassport() {
  if (appPassportValue === null) {
    appPassportValue = appHash([appData.tool.name, appData.schema, appData.report.artifact,
      appData.report.title, appData.files.map((f) => f.label).join('|')].join('\n'));
  }
  return appPassportValue;
}

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

/* The record goes into the browser's memory and nowhere else: it is written on the click itself, which is what survives
 * a closing, and the page's address keeps a clean tail — the report is a local page whose address is copied as it is,
 * and a reader's choice belongs in the browser that made it rather than in the tab's title bar. What a link sent from an
 * earlier release holds is still read (`appLinkUse`), and it is not written into the reader's memory: what came in is
 * not his choice until he changes something. */
export function appWrite() {
  if (appTransient) return;
  const rec = appRecord();
  const empty = Object.keys(rec.metrics).length === 0 && Object.keys(rec.files).length === 0;
  try {
    if (empty) window.localStorage.removeItem(appKey);
    else window.localStorage.setItem(appKey, JSON.stringify(rec));
  } catch (_e) {
    /* There is no memory (the browser grants this page none): the choice will not survive a closing, while the numbers
     * and the markup do not depend on it. */
  }
}

/* A reset to "everything on": the border between "this is no longer in the report" and "switched off" is the record
 * rather than a missing value. A link carries the sender's whole choice, which is why it is applied to a clean view
 * rather than on top of someone else's. */
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

/* -------- the unfolded tree -------- */

/* How much of the tree is visible is a memory of the same kind as the choice, but of a record of its own: it is about
 * what the onlooker looks at rather than about which numbers are read, which is why it never goes into a link and never
 * leaves the browser. The tree opens folded, so **the unfolded folders are what is kept** (`true`) — the default is the
 * absence of the name, the same way "switched on" is the absence of a choice. A folder's name is its path ("src/page"),
 * so a vanished name simply means nothing, and unfolding nothing is the state the page opens in: then the record is not
 * kept at all rather than being kept empty. `appFoldKey` is set with the model (`appBoot`), for the reason the key
 * itself is. */
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
  const open = rec.open || {};
  Object.keys(open).forEach((p) => { if (open[p] === true) appView.open[p] = true; });
}

export function appFoldSet(path, open) {
  if (open) appView.open[path] = true;
  else delete appView.open[path];
  const rec = { v: 1, passport: appPassport(), open: Object.assign({}, appView.open) };
  try {
    if (Object.keys(rec.open).length === 0) window.localStorage.removeItem(appFoldKey);
    else window.localStorage.setItem(appFoldKey, JSON.stringify(rec));
  } catch (_e) {
    /* There is no memory: what is unfolded will not survive a closing, while the view does not depend on it — the tree
     * is unfolded exactly the way the reader unfolded it just now. */
  }
}

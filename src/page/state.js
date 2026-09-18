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
 * The panel remembers the reader's choice between visits ("the choice's memory" below): the record is addressed by the
 * report rather than by a build of it (`appPassport`), it keeps the fact of a whole category where the reader decided by
 * groups and the names of the files where he decided one by one, and only what is switched off is written down — so
 * someone else's record is not applied while a vanished name simply means nothing. The record stays in the browser's
 * memory and nowhere else: a report opened from disk keeps a clean address, and a link made in an earlier release is
 * still read (`appLinkUse`).
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
 * on the data, and until the block is unpacked there is nothing to count it from. The addresses an earlier naming of
 * the passport left behind go away at the same moment (`appSweep`): the report is in a position to say what is dead,
 * and nothing of the reader's memory has been read yet. */
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
  appKey = APP_FORM + appPassport();
  appFoldKey = appKey + ':tree';
  appSweep();
}

/* A link is that same choice in the address, under a name of its own: someone else's anchor on the page does not count
 * as a link, and there is nothing to argue with it about. The page does not write it any more — it only reads what came
 * with the address — and this paragraph is what such a link is read by. */
const APP_LINK = '#size-report=';

/* One circumstance of the first drawing, and it acts on it alone: the memory is not written while somebody else's link
 * is open — what came in is not the reader's choice, and only his own action makes it his. */
let appTransient = false;

/* -------- the reader's memory of his choice -------- */

/* The form of the memory's address: the tool's namespace, a mark of the form, then the report's identity (`appPassport`
 * counts it). The mark stands in the address because the identity was named differently once — in the first naming the
 * columns stood inside it, so every build of the report had an address of its own and the reader's choice was left
 * behind at the previous one — and because the mark is what lets this release tell the addresses it writes from the
 * addresses of that naming (`appSweep`), without pretending to know whose record lies under the older one. */
const APP_STORE = 'size-report:';
const APP_FORM = APP_STORE + '2:';

/* The name of a file for the record is its path at HEAD, or the last of the settings when the file is already gone from
 * there: that is the name it is recognised by in the report. */
export function appFileAt(i) {
  const f = appData.files[i];
  return f.path === null ? f.paths[0] : f.path;
}

/* The files of one category, in the order of the data: a category is a group of files as the engine named it
 * (`category`), and the record, the boxes of the panel and their fields all ask for that group here rather than walking
 * the files a second time. */
export function appCatOf(key) {
  const idx = [];
  appData.files.forEach((f, i) => { if (f.category === key) idx.push(i); });
  return idx;
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

/* The report's passport: the tool's name, the data schema, the artifact's path, the title and the oldest row of the
 * history. It is what tells one report from another — the record's key is chosen by it, so a choice made in someone
 * else's report is not picked up — and it is what makes the memory the report's rather than a build of it: every later
 * build of the same report counts the same value and finds the same choice.
 *
 * The first four are what the report says about itself, and they are the same in a report of another project (both the
 * artifact's path and the title are defaults there, and all `file://` pages share one memory), which is what the fifth
 * is for: the oldest row is a commit of this history, the same in every clone and every build, and the one commit the
 * history never moves — rows are built from the oldest commit up, so a commit appends rows and leaves that one where it
 * stands.
 *
 * The package version and the top of the history are absent on purpose: updating the tool does not change what a column
 * means, while a grown history is the very history the reader comes back to.
 *
 * The columns were named here once, and they are what does not belong here at all: their labels and their order move
 * with the numbers — a project without settings pinned derives the columns on every run, ordered by size within an
 * extension (`src/project.js`), so every commit that grew or shrank a file gave the report another passport and left the
 * reader's choice at the old address. What a record holds are names, and a name the report no longer has means nothing
 * (`appApply`), so the columns have nothing to guard in the passport.
 *
 * Counted once per document: it is a constant of the report, which depends on nothing the reader can change, and every
 * click asks for it (the key of the memory and the passport of the record). A second count would be a second answer
 * waiting to happen, and the block it reads does not change while the page is open. */
let appPassportValue = null;
function appPassport() {
  if (appPassportValue === null) {
    const oldest = appData.rows.length === 0 ? '' : appData.rows[0].sha;
    appPassportValue = appHash([appData.tool.name, appData.schema, appData.report.artifact,
      appData.report.title, oldest].join('\n'));
  }
  return appPassportValue;
}

/* The addresses an earlier naming left in the browser: every one of them belonged to a single build of a report, and no
 * report ever looks under them again — the memory is read under the address of the report's identity alone. A browser
 * that has lived through a long history holds one such record per commit, so they go away, once, when a report of this
 * release is opened.
 *
 * What is swept is the mark of the form rather than a claim about whose record it is: the older address was counted from
 * the data, so the record under it cannot be attributed to a report — hence a memory left by an older release in this
 * browser goes too, and it is one of a report that was not rebuilt since its reader last clicked (that release moved the
 * address at the next build itself, leaving the memory behind). What this release writes is left alone: under it lies
 * this report's memory and another report's, and the two are told apart by the identity rather than by the form. */
function appSweep() {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key !== null && key.indexOf(APP_STORE) === 0 && key.indexOf(APP_FORM) !== 0) {
        window.localStorage.removeItem(key);
      }
    }
  } catch (_e) {
    /* There is no memory (the browser grants this page none): there is nothing to sweep either. */
  }
}

/* One record of the choice: the facts of the groups where the reader decided by groups, the names of the files where he
 * decided one by one, and only what is switched off.
 *
 * A category whose box is wholly off — or wholly on — is written down as that fact rather than as the state of every
 * file in it: `cats` names the group and says where it stands, so a file that joins the category later is switched with
 * it, which is exactly what the reader asked for when he switched the group, and the record does not grow with the
 * project. A category in the third state cannot speak for his choice — the choice was made file by file — and the files
 * he switched off go into the record by name (`files`), as they did before this chapter knew categories; such a category
 * is **absent** from `cats`, which is how the record distinguishes "a group fact" from "no group fact to state".
 *
 * "Switched on" and "no record" are the same state, hence `null` rather than an empty record — turning every checkbox
 * back on removes the record instead of leaving a trace indistinguishable from a choice. */
function appRecord() {
  const metrics = {};
  const cats = {};
  const files = {};
  appData.metrics.forEach((m) => { if (!appView.metrics[m.key]) metrics[m.key] = false; });
  appData.categories.forEach((c) => {
    const idx = appCatOf(c.key);
    const on = idx.filter((i) => appView.files[i] === true).length;
    if (on === idx.length || on === 0) { cats[c.key] = on === idx.length; return; }
    idx.forEach((i) => { if (appView.files[i] !== true) files[appFileAt(i)] = false; });
  });
  const empty = Object.keys(metrics).length === 0 && Object.keys(files).length === 0
    && Object.keys(cats).every((key) => cats[key] === true);
  return empty ? null : { v: 1, passport: appPassport(), metrics: metrics, cats: cats, files: files };
}

// Whether a record is ours and of the right format — one rule for the memory and the address alike.
function appRecordOk(rec) {
  return rec !== null && typeof rec === 'object' && rec.v === 1 && rec.passport === appPassport();
}

/* A record into the browser's memory or out of it, and what is read back from it: the two halves of the memory, written
 * once, because the page keeps two records of the same kind under two keys — the choice and the unfolded tree — and
 * their rules are one. Nothing but the browser's memory is written: it is written on the click itself, which is what
 * survives a closing, and the page's address keeps a clean tail — the report is a local page whose address is copied as
 * it is, and a reader's choice belongs in the browser that made it rather than in the tab's title bar. What a link sent
 * from an earlier release holds is still read (`appLinkUse`), and it is not written into the reader's memory: what came
 * in is not his choice until he changes something. */
function appKeep(key, rec) {
  try {
    if (rec === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(rec));
  } catch (_e) {
    /* There is no memory (the browser grants this page none): the choice will not survive a closing, while the numbers
     * and the markup do not depend on it. */
  }
}

export function appWrite() {
  if (!appTransient) appKeep(appKey, appRecord());
}

/* What the browser saved under a key: its absence, a foreign record, a broken one and a record of another report amount
 * to the same thing here — nothing to read. `JSON.parse` of a missing value answers `null`, so the two absences need no
 * telling apart. */
function appLoad(key) {
  let rec = null;
  try {
    rec = JSON.parse(window.localStorage.getItem(key));
  } catch (_e) {
    return null;
  }
  return appRecordOk(rec) ? rec : null;
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
 * in the table for something that was never there. The two tables the model already holds answer it: a file by its path
 * at HEAD (`appMeasured`) and a metric by its key (`appMetric`), the same names a record is written in (`appFileAt`). */
function appUnknown(rec) {
  let n = 0;
  Object.keys(rec.metrics || {}).forEach((k) => { if (appMetric[k] === undefined) n++; });
  Object.keys(rec.files || {}).forEach((k) => { if (appMeasured[k] === undefined) n++; });
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

// Reading: the reader's own choice, as he left it — another report's record lies under another key.
export function appRead() {
  return appLoad(appKey);
}

/* Applying goes by name: a file is recognised by its path, a metric by its key, a category by the key the engine gave
 * it. A name the report does not hold matches nothing (a column was pointed at another path, a metric was dropped from
 * the settings), while files, categories and metrics that appeared stay switched on — the way someone opening the page
 * for the first time sees them.
 *
 * A category's fact is applied to the files of that category as they are now, and the names are applied after it: the
 * file-by-file decision is the finer one and stands last, and a record of an earlier release — which knew no categories
 * and wrote only names — is applied by its names exactly as it was. */
export function appApply(rec) {
  const metrics = rec.metrics || {};
  const cats = rec.cats || {};
  const files = rec.files || {};
  appData.metrics.forEach((m) => { if (metrics[m.key] === false) appView.metrics[m.key] = false; });
  appData.categories.forEach((c) => {
    const on = cats[c.key];
    if (on !== true && on !== false) return;
    appCatOf(c.key).forEach((i) => { appView.files[i] = on; });
  });
  appData.files.forEach((_f, i) => { if (files[appFileAt(i)] === false) appView.files[i] = false; });
}

/* -------- the unfolded tree -------- */

/* How much of the tree is visible is a memory of the same kind as the choice, but of a record of its own: it is about
 * what the onlooker looks at rather than about which numbers are read, which is why it never goes into a link and never
 * leaves the browser. The tree opens folded, so **the unfolded folders are what is kept** (`true`) — the default is the
 * absence of the name, the same way "switched on" is the absence of a choice. A folder's name is its path ("src/page"),
 * so a vanished name simply means nothing. `appFoldKey` is set with the model (`appBoot`), for the reason the key itself
 * is. */
export function appFoldRead() {
  const rec = appLoad(appFoldKey);
  if (rec === null) return;
  const open = rec.open || {};
  Object.keys(open).forEach((p) => { if (open[p] === true) appView.open[p] = true; });
}

/* What a folder's sign does with the memory: the unfolded folders are what is kept (`true`), so a tree folded whole is
 * the absence of the record — the default — and the record goes away with the last unfolded folder. */
export function appFoldSet(path, open) {
  if (open) appView.open[path] = true;
  else delete appView.open[path];
  const names = Object.keys(appView.open);
  appKeep(appFoldKey, names.length === 0
    ? null
    : { v: 1, passport: appPassport(), open: appView.open });
}

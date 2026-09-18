/* The harness of the contract and page suites: the contract data, the assembled page and its
 * reading in a real DOM. One for six suites (`contract-data`, `contract-derived`, `page-view`,
 * `page-cols`, `page-tree`, `page-choice`), for the same reason the package has one shared harness
 * (`tools/harness.js`): a copied setting in two files diverges in silence, and the duplicate
 * sensor catches that earlier than a person would.
 *
 * It sits in `tools/` rather than `test/`: the Node runner takes any `.js` under `test/` for a
 * suite and would run a helper as an empty one. jsdom loads from here, so it is paid for by
 * whichever suite imports this file — the three DOM suites need it, the two contract suites come
 * for the data helper.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { stripModules } from '../src/size-table.js';
import { CONFIG, ROOT, SYNTH, cloneFixture, runFixture, tempDir } from './harness.js';

/* The contract data and the frozen golden: a fresh clone of the fixture plus one `--data` run.
 * The contract is the same for everyone who reads it — reproducibility checks that, not the
 * shared setup. */
export function contractData(tmp, name) {
  const dir = cloneFixture(path.join(tmp, 'fixture-' + name));
  const run = runFixture(dir, ['--data']);
  assert.equal(run.code, 0,
    'the tool gave no --data (code ' + run.code + '): ' + run.stderr.trim());
  const golden = JSON.parse(fs.readFileSync(path.join(SYNTH, 'golden.json'), 'utf8'));
  // `text` is the same answer in bytes: reproducibility of runs is checked against it.
  return { dir: dir, text: run.stdout, data: JSON.parse(run.stdout), golden: golden };
}

/* A suite's whole setup: the contract data and the assembled page — what a page suite starts
 * with. The directory comes from the suite's name, so that clones of different processes do not
 * fight over paths. */
export function reportSetup(tmp, name) {
  const { data, golden } = contractData(tmp, name);
  return { data: data, golden: golden, pageText: pageHtml(tmp, name) };
}

/* The same for a suite that reads the page in a DOM: its own directory for clones (removed on
 * exit), the data, the assembled text and the opening of the page. It lives here because the page
 * suites share one setup — a copy in two files diverges in silence, and an extra clone costs an
 * extra second of the run. */
export function pageReady(name) {
  const tmp = tempDir('page-' + name);
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const { data, golden, pageText } = reportSetup(tmp, name);
  return {
    data: data, golden: golden, pageText: pageText,
    openPage: (seed, hash, opts) => openPage(pageText, seed, hash, opts)
  };
}

/* The page's data block as the page reads it, unpacked by the platform's own zlib. The packing is the file's
 * transport rather than the block's shape, so what the checks compare is the text the page unpacks — and whether
 * the block is packed at all is checked here too, because a build that quietly stopped packing would otherwise be
 * noticed only by the file's weight. */
export function pageBlock(text) {
  const tag = /<script [^>]*id="data"[^>]*>([\s\S]*?)<\/script>/.exec(text);
  assert.ok(tag !== null, 'в странице нет блока данных');
  const pack = /data-pack="([^"]+)"/.exec(tag[0]);
  assert.notEqual(pack, null, 'блок данных в странице не сжат: маркера упаковки нет');
  assert.equal(pack[1], 'base64+gzip',
    'блок данных упакован как «' + pack[1] + '», а распаковщика для этого у харнесса нет');
  return unpackPack(tag[1]);
}

/* The packing itself, read by the platform's zlib: apart from `pageBlock` (which finds it in a built page) the
 * transport is checked on the builder's own answer (`contract-data`), so that a block that stopped fitting through
 * gzip is caught by a check rather than by the file's weight. */
export function unpackPack(text) {
  return JSON.parse(zlib.gunzipSync(Buffer.from(text, 'base64')).toString('utf8'));
}

/* The page's arithmetic: the source on disk and its function. The page suites compute expected
 * totals with the same code the page carries, not with a rule rewritten in a check; the text goes
 * out separately because the embedding itself is checked against it. */
export const derivedSrc = fs.readFileSync(path.join(ROOT, 'src', 'derived.js'), 'utf8');
export const pageMath = new Function(stripModules(derivedSrc)
  + '\nreturn { rowModel: rowModel, totalsOf: totalsOf };')();

/* The page's decoder as a function: the chapter is read from disk and evaluated the way the page carries it
 * (`pageMath` does the same with the calculation), so a round trip compares the encoder with the decoder that
 * really unrolls the block rather than with a paraphrase of it. The chapter declares and imports nothing, which
 * is what makes it evaluable on its own. */
const payloadSrc = fs.readFileSync(path.join(ROOT, 'src', 'page', 'payload.js'), 'utf8');
export const pageDecode = new Function(stripModules(payloadSrc) + '\nreturn appDecode;')();

/* The assembled report: its own clone and the `--write` flag — the same way a reader builds it.
 * The path comes from the fixture's settings rather than a guess: a person named it there, and
 * that is the place to check. */
export function pageHtml(tmp, name) {
  const dir = cloneFixture(path.join(tmp, 'page-' + name));
  const run = runFixture(dir, ['--write']);
  assert.equal(run.code, 0, 'the tool did not build the report: ' + run.stderr.trim());
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const file = path.join(dir, cfg.output);
  assert.ok(fs.existsSync(file), 'the report did not appear at the path from the settings: ' + cfg.output);
  return fs.readFileSync(file, 'utf8');
}

/* A moment of the page's own clock, taken from the window the page runs in rather than made up by a
 * check: a timeout of the check's own would be a guess about the platform's clock, and a wait that
 * misses reads as a bug in the page. */
export const settled = (dom) => new Promise((done) => {
  dom.window.setTimeout(done, 0);
});

/* What the platform gives a browser and jsdom has not: the page's block is packed, and the page unpacks it with
 * `DecompressionStream` and `TextDecoder`, both of which are the platform's own and both of which jsdom lacks (its
 * `atob`, which the page also uses, is there). So the harness puts the platform's implementations into the window
 * before the page runs — and the two environments the page is read in are told apart by that: the suites read the
 * page here, in jsdom with these two put in, and what a browser does with the same file is checked by hand in
 * Chrome (`file://`), where the file is served by nothing and the API is its own.
 *
 * A window **without** them is what a host that cannot unpack looks like, and one check needs exactly that
 * (`{ platform: false }`): the page has to say in words that it cannot unpack instead of standing empty. */
function platform(window) {
  window.DecompressionStream = window.DecompressionStream || globalThis.DecompressionStream;
  window.TextDecoder = window.TextDecoder || globalThis.TextDecoder;
}

/* A page with memory: the address gives it an origin (without one jsdom, like a browser in a
 * private window, offers no storage), and `beforeParse` puts in what "the browser saved" on the
 * previous visit — that is how a second visit is checked. */
export const PAGE_URL = 'https://report.invalid/size-report.html';
export async function openPage(text, seed, hash, opts) {
  const host = opts || {};
  const dom = new JSDOM(text, {
    url: PAGE_URL + (hash || ''),
    runScripts: 'dangerously',
    beforeParse(window) {
      Object.keys(seed || {}).forEach((key) => window.localStorage.setItem(key, seed[key]));
      if (host.platform !== false) platform(window);
    }
  });
  /* The first drawing is asynchronous — the block is packed and the platform's unpacker answers with a promise — so
   * a check reads the markup after it rather than beside it. It waits for the promise the page publishes rather than
   * for a timer: a timer would be a guess about how long unpacking takes, and a wrong guess looks like a bug in the
   * page. */
  await dom.window.appDrawn;
  /* Every suite but the one about the window reads the whole table, so the shell is given a window that holds it: the
   * page builds the rows and the columns in sight of the shell and no more (`src/page/table.js`), and jsdom lays
   * nothing out — without this every suite would read the fallback window the page uses for a shell with no size. The
   * suite of the window places its own places (`place`), which is what makes the window the thing it is about. */
  whole(dom);
  return dom;
}

// What "the browser" has saved by now — what will outlive the page's close.
export function stored(dom) {
  const store = dom.window.localStorage;
  const out = {};
  for (let i = 0; i < store.length; i++) out[store.key(i)] = store.getItem(store.key(i));
  return out;
}

// A link to a choice in the very shape the address carries it: our format, not a paraphrase.
export const linkTo = (rec) => '#size-report=' + encodeURIComponent(JSON.stringify(rec));

export const panelInputs = (doc) => [...doc.querySelectorAll('#panel input')];
export const fileBox = (doc, p) => panelInputs(doc).find((b) => b.title.indexOf(p) === 0);

/* A group's switch — a folder of the tree, a quick button of a category — found by the text the reader reads (`appDirHead`
 * and the panel name them): the suites that click a group share this, because how a group is told from another is a fact
 * about the panel rather than about a suite's subject. */
export const dirBox = (doc, prefix) => [...doc.querySelectorAll('#panel .box.dir')]
  .find((b) => b.textContent.indexOf(prefix) === 0);
export const dirInput = (doc, prefix) => dirBox(doc, prefix).querySelector('input');
export const catInput = (doc, cat) => [...doc.querySelectorAll('#panel .row .box.all')]
  .find((b) => b.textContent === cat.label).querySelector('input');

/* -------- reading the page --------
 *
 * One set of readers for the page suites, because the drawing they read is one: a file's path as the panel names it,
 * the rows and the numbers the window built, the captions over the columns, and the place the shell stands at. A suite
 * that rolled its own reader would be reading the same page with a second pair of eyes — the page is one file, and the
 * suites are split by subject rather than by what they can see. */

/* A file's path at HEAD, or the last of the settings when the file is already gone from there: the name the panel and
 * the report recognise it by (`appFileAt`). */
export const where = (f) => (f.path === null ? f.paths[0] : f.path);

/* The rows the window built, as they stand: the page builds the rows and the columns the shell shows and no more
 * (`src/page/table.js`), so a suite that wants the whole table gives the shell a window that holds it (`whole`). */
export const gridRows = (doc) => [...doc.querySelectorAll('#grid .row')];
export const nowRow = (doc) => doc.querySelector('#grid .row.now');

// The numbers of a row, left to right: one per column the window holds, the total's first.
export const rowNumbers = (row) => [...row.querySelectorAll('.cells > span')].map((span) => span.textContent.trim());

// The captions over the columns: the total and the files the window holds (above), the metrics (below).
export const captions = (doc) => [...doc.querySelectorAll('#grid .hgroups > span')].map((span) => span.textContent);
export const metricCaptions = (doc) => [...doc.querySelectorAll('#grid .hmetrics > span')].map((span) => span.textContent);

/* The “now” row: how many numbers it holds, and the first of them — the whole project in one figure, for the first
 * metric that is on (`src/page/table.js` builds the cells of the metrics the reader left on). */
export const nowCells = (doc) => rowNumbers(nowRow(doc)).length;
export const nowTotal = (doc) => rowNumbers(nowRow(doc))[0];
export const allCells = (data, keys) => (data.files.length + 1)
  * (keys === undefined ? data.metrics.length : keys.length);

/* The place the shell is at, given rather than measured: jsdom lays nothing out, so a check hands the shell the four
 * figures a browser fills in and sends the event a browser sends when they move. The shell is left in place, which is
 * what lets a suite read the window at two places in a row. */
export function place(dom, view) {
  const shell = dom.window.document.getElementById('shell');
  const given = { clientHeight: view.high, clientWidth: view.wide, scrollTop: view.top, scrollLeft: view.left };
  Object.keys(given).forEach((name) => {
    Object.defineProperty(shell, name, { configurable: true, get: () => given[name] });
  });
  shell.dispatchEvent(new dom.window.Event('scroll'));
  return shell;
}

// A window that holds the whole grid: every row and every column is built, and the numbers are the numbers of the page.
export const whole = (dom) => place(dom, { high: 100000, wide: 100000, top: 0, left: 0 });

/* Where each file's numbers moved last: the newest row of the history in which they differ from the row above (or the
 * first row, where every file is new). The figure the suites hold the order of the columns to — counted from the
 * contract's own rows here rather than taken from the page, because a check has to have an expectation of its own
 * (`src/page/table.js` counts the same thing in the page, from the rows of the block). */
export function columnRank(data) {
  const rank = data.files.map(() => -1);
  let was = null;
  data.rows.forEach((row, i) => {
    row.values.forEach((cell, j) => {
      if (was === null || JSON.stringify(cell) !== JSON.stringify(was[j])) rank[j] = i;
    });
    was = row.values;
  });
  return rank;
}

// The order of the columns: the files whose numbers moved most recently first, the rest in the settings' order.
export function columnOrder(data) {
  const rank = columnRank(data);
  return data.files.map((_f, i) => i).sort((a, b) => rank[b] - rank[a]);
}

/* The metric switch is found by its visible label: the label does not depend on the words used
 * for the method and the precision. That those words exist and match the cells is a check of its
 * own. */
export const metricBox = (doc) => [...doc.querySelectorAll('#panel .box.metric')]
  .find((b) => b.textContent === 'min').querySelector('input');

export function toggleBox(doc, box, checked) {
  box.checked = checked;
  box.dispatchEvent(new doc.defaultView.Event('change'));
}

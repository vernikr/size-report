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

/* The cells of a row the reader sees. The table is built once and hidden by classes, so the markup holds every column
 * of every file — the suites compare what is shown rather than what exists. A cell is hidden either with its file's
 * column (`off`) or with the whole metric (the table's `m-off-N`). */
export function shownCells(tr) {
  const grid = tr.closest('#grid');
  return [...tr.querySelectorAll('td')].filter((td) => {
    if (td.classList.contains('off')) return false;
    const track = [...td.classList].find((c) => /^m\d+$/.test(c));
    return !grid.classList.contains('m-off-' + track.slice(1));
  });
}

/* The “now” row's cells: the count of what is shown, and the total of the first metric (which is the one the suites
 * compare expected sums with, whether it is on or off — a hidden cell keeps its number). */
export const nowCells = (doc) => shownCells(doc.querySelectorAll('#grid tbody tr')[0]).length;
export const nowTotal = (doc) => doc.querySelectorAll('#grid tbody tr')[0].querySelectorAll('td')[0].textContent;
export const allCells = (data) => (data.files.length + 1) * data.metrics.length;
export const fileBox = (doc, p) => panelInputs(doc).find((b) => b.title.indexOf(p) === 0);

/* The metric switch is found by its visible label: the label does not depend on the words used
 * for the method and the precision. That those words exist and match the cells is a check of its
 * own. */
export const metricBox = (doc) => [...doc.querySelectorAll('#panel .box.metric')]
  .find((b) => b.textContent === 'min').querySelector('input');

export function toggleBox(doc, box, checked) {
  box.checked = checked;
  box.dispatchEvent(new doc.defaultView.Event('change'));
}

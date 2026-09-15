/* The harness of the contract and page suites: the contract data, the assembled page and its
 * reading in a real DOM. One for five suites (`contract-data`, `contract-derived`, `page-view`,
 * `page-tree`, `page-choice`), for the same reason the package has one shared harness
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
    'инструмент не отдал --data (код ' + run.code + '): ' + run.stderr.trim());
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
    openPage: (seed, hash) => openPage(pageText, seed, hash)
  };
}

/* The page's arithmetic: the source on disk and its function. The page suites compute expected
 * totals with the same code the page carries, not with a rule rewritten in a check; the text goes
 * out separately because the embedding itself is checked against it. */
export const derivedSrc = fs.readFileSync(path.join(ROOT, 'src', 'derived.js'), 'utf8');
export const pageMath = new Function(stripModules(derivedSrc)
  + '\nreturn { rowModel: rowModel, totalsOf: totalsOf };')();

/* The assembled report: its own clone and the `--write` flag — the same way a reader builds it.
 * The path comes from the fixture's settings rather than a guess: a person named it there, and
 * that is the place to check. */
export function pageHtml(tmp, name) {
  const dir = cloneFixture(path.join(tmp, 'page-' + name));
  const run = runFixture(dir, ['--write']);
  assert.equal(run.code, 0, 'инструмент не собрал отчёт: ' + run.stderr.trim());
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const file = path.join(dir, cfg.output);
  assert.ok(fs.existsSync(file), 'отчёт не появился по пути из настроек: ' + cfg.output);
  return fs.readFileSync(file, 'utf8');
}

/* A page with memory: the address gives it an origin (without one jsdom, like a browser in a
 * private window, offers no storage), and `beforeParse` puts in what "the browser saved" on the
 * previous visit — that is how a second visit is checked. */
export const PAGE_URL = 'https://report.invalid/size-report.html';
export function openPage(text, seed, hash) {
  return new JSDOM(text, {
    url: PAGE_URL + (hash || ''),
    runScripts: 'dangerously',
    beforeParse(window) {
      Object.keys(seed || {}).forEach((key) => window.localStorage.setItem(key, seed[key]));
    }
  });
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
export const nowCells = (doc) => doc.querySelectorAll('#grid tbody tr')[0].querySelectorAll('td').length;
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

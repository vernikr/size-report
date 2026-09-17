/* The reader's choice and the work a click starts.
 *
 * The memory is the browser rather than a request, and it follows one rule: a record is bound to the
 * report's passport and lives in storage under a key of its own. Hence what is checked here in a real DOM (jsdom): a
 * further visit returns the same choice and the same numbers, while switching everything back removes the record; a
 * foreign, outdated or broken record is not applied, and a foreign name switches off nothing of someone else's.
 *
 * **The address stays clean.** The page writes the choice into the browser's memory and nowhere else: a report opened
 * from disk keeps the address it was opened with, and nothing of what a reader switches lands in the tab's title bar.
 * A link in the address — a name of its own, `#size-report=…` — is still read, because such links were sent before
 * and a link that stopped working would be a reader's loss; what is checked here is that it is applied to a page
 * opened by it and to an already open one (`hashchange`), that a foreign, broken, incomplete or empty choice is
 * explained in words rather than by an empty grid, that the link does not become the reader's own memory before he
 * changes something, and that the address it was sent with is not rewritten. What the host must be able to do at all
 * stands here too: a browser without an unpacker is told so rather than left with an empty table.
 *
 * What a click costs is the other subject of this file: the columns are drawn by the work chapter, and a long drawing
 * happens in a task of its own with an indeterminate stripe over the top edge of the window (`src/page/work.js` — the
 * price of a switch is the browser's relayout of the whole table, so it is paid once rather than once per slice).
 * Both halves of the rule are checked: the long drawing goes to the next task with the stripe, while work short enough
 * to be over before the browser could paint one is done on the click itself, with nothing at the top of the page.
 *
 * The assembly of the page itself is a neighbouring suite (`page-view`): the file is split by
 * subject rather than by size.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { totalsOf, valueParts } from '../src/size-table.js';
import { ROOT } from '../tools/harness.js';
import {
  allCells as cellsOf, fileBox, linkTo, metricBox, nowCells, nowTotal, pageReady, settled,
  stored, toggleBox as toggleCheck
} from '../tools/page-harness.js';

const { data, openPage } = pageReady('choice');

const allCells = () => cellsOf(data);
const nowTotalCell = nowTotal;
const topRaw = (off) => totalsOf(data.now, ['raw'], off).raw;

/* The figure above which the drawing is a task of its own is read from the chapter that sets it rather than copied
 * here: a change there has to reach the checks instead of breaking them with no hint of why. */
const WORK_SRC = fs.readFileSync(path.join(ROOT, 'src', 'page', 'work.js'), 'utf8');
const LONG = Number(/APP_LONG = (\d+)/.exec(WORK_SRC)[1]);
const barOf = (doc) => doc.getElementById('bar');

/* An owner of the report with a choice of their own and the storage that choice leaves — what a sent link is
 * compared against (the link is older than the owner's choice). `pick` names the switch that owner flips: the metric by
 * default, a file where the case needs the two choices to differ in a file rather than in a metric. */
async function ownerChoice(pick) {
  const owner = await openPage();
  const doc = owner.window.document;
  toggleCheck(doc, (pick === undefined ? metricBox : pick)(doc), false);
  const own = stored(owner);
  return { owner: owner, doc: doc, own: own,
    passport: Object.keys(own)[0].slice('size-report:'.length) };
}

/* A link to a choice: the record the memory holds, in the very shape the address carries it. The page no longer
 * writes one itself — that is the point of the first check below — so a link is built here from what a sender's memory
 * holds, which is one and the same record. */
async function senderLink(pick) {
  const dom = await openPage();
  const doc = dom.window.document;
  pick(doc).forEach((box) => toggleCheck(doc, box, false));
  const rec = JSON.parse(stored(dom)[Object.keys(stored(dom))[0]]);
  return { dom: dom, doc: doc, record: rec, link: linkTo(rec) };
}

/* A page whose address writes are counted: `writes()` is how many have happened so far and `links()` what they
 * carried. The page is not supposed to make any — the memory is where the choice lives — hence a check can look at
 * the calls rather than wait for an address to settle. */
async function countingPage() {
  const dom = await openPage();
  const history = dom.window.history;
  const write = history.replaceState.bind(history);
  const seen = { n: 0, links: [] };
  history.replaceState = function (...args) { seen.n++; seen.links.push(String(args[2])); return write(...args); };
  return { dom: dom, doc: dom.window.document, writes: () => seen.n, links: () => seen.links.slice() };
}

test('the memory of a choice: a revisit brings back the same choice and the same numbers', async () => {
  const first = await openPage();
  const doc = first.window.document;

  /* The first reader: everything is on, and nothing is remembered about them yet. */
  assert.deepEqual(stored(first), {}, 'the first visit left a record of a choice that never was');
  assert.equal(nowCells(doc), allCells(), 'the default does not have everything switched on');

  toggleCheck(doc, metricBox(doc), false);
  toggleCheck(doc, fileBox(doc, 'src/code.js'), false);
  const off = data.files.map((f) => f.path !== 'src/code.js');
  const total = valueParts(topRaw(off)).text;
  assert.equal(nowTotalCell(doc), total, 'the total after the choice is not the one the computational part gives');

  const saved = stored(first);
  assert.equal(Object.keys(saved).length, 1, 'the choice is not written as a single record');

  /* A further visit: the same report, the same storage. */
  const again = await openPage(saved);
  const doc2 = again.window.document;
  assert.equal(metricBox(doc2).checked, false, 'the revisit did not bring the switched-off metric back');
  assert.equal(fileBox(doc2, 'src/code.js').checked, false, 'the revisit did not bring the switched-off file back');
  // Everything is on except the metric and the file switched off by the choice — which is what the
  // columns show.
  assert.equal(nowCells(doc2), (off.filter(Boolean).length + 1) * (data.metrics.length - 1),
    'the revisit brought back the wrong set of columns');
  assert.equal(nowTotalCell(doc2), total, 'the revisit showed other numbers');

  /* Everything switched back on makes the choice the default and leaves no record: otherwise "put
   * back as it was" would be no different from "something is off". */
  toggleCheck(doc2, metricBox(doc2), true);
  toggleCheck(doc2, fileBox(doc2, 'src/code.js'), true);
  assert.deepEqual(stored(again), {}, 'bringing every box back left a record of a choice');
  assert.equal(nowCells(doc2), allCells(), 'bringing the boxes back did not return the table to its default');
});

test('the memory of a choice: a foreign or broken record is not applied', async () => {
  const first = await openPage();
  const doc = first.window.document;
  toggleCheck(doc, metricBox(doc), false);
  toggleCheck(doc, fileBox(doc, 'src/code.js'), false);
  const saved = stored(first);
  const key = Object.keys(saved)[0];
  const rec = JSON.parse(saved[key]);

  /* The record explains itself: the format's version, the passport (which is also the key's name,
   * or the record would be looked for where it does not lie) and only what is off, by name. */
  assert.equal(rec.v, 1, 'the record did not declare the format version');
  assert.equal(rec.passport, key.slice('size-report:'.length),
    'the record’s key and its passport diverged');
  assert.deepEqual(rec.metrics, { min: false }, 'the record did not name the switched-off metric');
  assert.deepEqual(rec.files, { 'src/code.js': false }, 'the record did not name the switched-off file');

  /* A foreign report: its record lies under its own key and has to stay whole. */
  const foreignKey = 'size-report:2f1a';
  const other = await openPage({ [foreignKey]: JSON.stringify({ v: 1, passport: '2f1a',
    metrics: { min: false }, files: { 'src/code.js': false } }) });
  assert.equal(nowCells(other.window.document), allCells(), 'another report’s choice was applied to this one');
  assert.deepEqual(Object.keys(stored(other)), [foreignKey], 'the page wiped another report’s record');

  /* The right key but a foreign passport is the same as no record at all. */
  const stranger = await openPage({ [key]: JSON.stringify(Object.assign({}, rec, { passport: 'deadbeef' })) });
  assert.equal(nowCells(stranger.window.document), allCells(), 'a record with a foreign passport was applied');

  /* A record of another format and a broken one read the same way: not at all. */
  const older = await openPage({ [key]: JSON.stringify(Object.assign({}, rec, { v: 0 })) });
  assert.equal(nowCells(older.window.document), allCells(), 'a record of the old format was applied');
  const broken = await openPage({ [key]: '{ это не JSON' });
  assert.equal(nowCells(broken.window.document), allCells(), 'a broken record broke the page');

  /* A name the report no longer holds: a name that is there applies, an unknown one means nothing
   * and switches off nothing of someone else's, and the record is brought back to what the report
   * holds. */
  const ghost = await openPage({ [key]: JSON.stringify({ v: 1, passport: rec.passport,
    metrics: { tok: false, min: false }, files: { 'src/gone.js': false, 'src/code.js': false } }) });
  const gd = ghost.window.document;
  assert.equal(metricBox(gd).checked, false, 'the named metric was not applied');
  assert.equal(fileBox(gd, 'src/code.js').checked, false, 'the named file was not applied');
  assert.equal(fileBox(gd, 'src/empty.js').checked, true, 'a name that vanished switched off a file of someone else');
  assert.deepEqual(JSON.parse(stored(ghost)[key]),
    { v: 1, passport: rec.passport, metrics: { min: false }, files: { 'src/code.js': false } },
    'the page did not bring the record back to what the report holds');
});

/* A report opened from disk keeps its address: the page writes the choice into the browser's memory and never into the
 * address bar. The address is the report's own, and the tail of it belongs to whoever sent the link rather than to the
 * page that received it — a rewrite would also make a history entry out of every switch. */
test('the choice stays in the browser: the address is never rewritten', async () => {
  const reader = await countingPage();
  const doc = reader.doc;

  toggleCheck(doc, metricBox(doc), false);
  toggleCheck(doc, fileBox(doc, 'src/code.js'), false);
  toggleCheck(doc, fileBox(doc, 'package.json'), false);
  await settled(reader.dom);

  assert.equal(reader.writes(), 0, 'the page rewrote the address: ' + reader.links().join(', '));
  assert.equal(reader.dom.window.location.hash, '', 'something landed in the address: '
    + reader.dom.window.location.hash);
  const saved = stored(reader.dom);
  assert.equal(Object.keys(saved).length, 1, 'the choice is not written into the browser’s memory');
  const again = (await openPage(saved)).window.document;
  assert.equal(metricBox(again).checked, false, 'a reload right after the click lost the metric');
  assert.equal(fileBox(again, 'src/code.js').checked, false, 'a reload right after the click lost the file');
});

/* Exchanging a choice by link: the address is read (the page does not repeat it), and opening it shows the sender's
 * choice — the same set of columns and the same numbers. The link does not replace the storage of whoever merely
 * shared it and does not touch the address it was sent with before the reader's first action. */
test('a link: the page opened by it shows the sender’s choice', async () => {
  const { doc: sd, record, link } = await senderLink((d) => [metricBox(d), fileBox(d, 'src/code.js')]);
  const sentCells = nowCells(sd);
  const sentTotal = nowTotalCell(sd);

  /* The receiver has a stored state of their own — a file rather than the sender's metric, so a mixture of the two would
   * be visible — but the link is older than it: the reader sees what was sent (the sender's whole choice). */
  const { own } = await ownerChoice((d) => fileBox(d, 'package.json'));
  const guest = await openPage(own, link);
  const gd = guest.window.document;
  assert.equal(nowCells(gd), sentCells, 'the link gave the wrong set of columns');
  assert.equal(nowTotalCell(gd), sentTotal, 'the link gave the wrong total');
  assert.equal(metricBox(gd).checked, false, 'the link did not switch off the sender’s metric');
  assert.equal(fileBox(gd, 'src/code.js').checked, false, 'the link did not switch off the sender’s file');
  assert.equal(fileBox(gd, 'package.json').checked, true,
    'the link did not replace the reader’s choice but mixed with it');
  assert.deepEqual(stored(guest), own, 'the link that was sent rewrote the reader’s memory');
  assert.equal(guest.window.location.hash, link, 'the address of the sent link was rewritten by the page');
  assert.equal(gd.getElementById('notice').hidden, true, 'something extra was said about a good link');

  /* The reader's action makes the state theirs: the storage, starting from the view on screen (the sender's)
   * rather than from their own earlier choice — the page remembers what it shows — while the address keeps the tail it
   * was sent with. */
  toggleCheck(gd, fileBox(gd, 'src/code.js'), true);
  assert.notDeepEqual(stored(guest), own, 'the reader’s action was not saved into their memory');
  assert.equal(guest.window.location.hash, link, 'the address was rewritten by the reader’s own click');
  const rec = JSON.parse(stored(guest)[Object.keys(stored(guest))[0]]);
  assert.deepEqual(rec.metrics, { min: false }, 'a metric that is not theirs landed in the reader’s memory');
  assert.deepEqual(rec.files, {}, 'something other than what they did landed in the reader’s memory');
  assert.equal(nowCells(gd), (data.files.length + 1) * (data.metrics.length - 1),
    'an edit of the sender’s view did not bring every file back');
  assert.deepEqual(record.files, { 'src/code.js': false }, 'the sender’s record is not the one that was shared');
});

/* A refused link is a message to the reader rather than an empty table: a foreign report and a
 * broken record read the same way — not at all — and each is told in its own text, while the
 * reader's previous view and the address they were sent stay whole. */
test('a link: a foreign and a broken address are explained in words', async () => {
  const { doc: od, own } = await ownerChoice();
  const ui = JSON.parse(od.getElementById('ui').textContent);
  const notice = (doc) => doc.getElementById('notice');

  /* A foreign anchor is not our link: silence. */
  const anchor = await openPage({}, '#top');
  assert.equal(notice(anchor.window.document).hidden, true, 'an ordinary anchor was taken for a link');

  /* A link of another report: not applied, the reader is told, the address is untouched. */
  const foreignHash = linkTo({ v: 1, passport: 'deadbeef',
    metrics: { min: false }, files: { 'src/code.js': false } });
  const foreign = await openPage(own, foreignHash);
  const fd = foreign.window.document;
  assert.equal(notice(fd).textContent, ui.linkForeign, 'nothing was said about a foreign link');
  assert.equal(notice(fd).hidden, false, 'the page stayed silent about a foreign link');
  assert.equal(fileBox(fd, 'src/code.js').checked, true, 'a foreign choice was applied after all');
  assert.equal(metricBox(fd).checked, false, 'the reader’s choice was not applied after the link was refused');
  assert.equal(foreign.window.location.hash, foreignHash, 'the foreign address was rewritten by the page');

  /* A broken link: told too, and the markup stays at the default. */
  const broken = await openPage({}, '#size-report=%7B%D1%8D%D1%82%D0%BE-%D0%BD%D0%B5-JSON');
  assert.equal(notice(broken.window.document).textContent, ui.linkBroken, 'nothing was said about a broken link');
  assert.equal(nowCells(broken.window.document), allCells(), 'a broken link spoiled the default');
});

/* A link about what the report does not hold: what is named applies, and what was left out is said
 * as a number — or the reader would look in the table for what is not in it. A sender who switched
 * everything off is explained in words rather than by an empty grid. */
test('a link: an incomplete or empty choice is explained by a number', async () => {
  const { doc: od, passport } = await ownerChoice();
  const ui = JSON.parse(od.getElementById('ui').textContent);

  const ghost = await openPage({}, linkTo({ v: 1, passport: passport,
    metrics: { tok: false, min: false }, files: { 'src/gone.js': false, 'src/code.js': false } }));
  const gd = ghost.window.document;
  assert.equal(metricBox(gd).checked, false, 'the named metric was not applied from the link');
  assert.equal(fileBox(gd, 'src/code.js').checked, false, 'the named file was not applied from the link');
  assert.equal(gd.getElementById('notice').textContent, ui.linkExtra.replace('{n}', '2'),
    'nothing was said about the skipped names');

  const all = { v: 1, passport: passport, metrics: {}, files: {} };
  data.metrics.forEach((m) => { all.metrics[m.key] = false; });
  data.files.forEach((f) => { all.files[f.path === null ? f.paths[0] : f.path] = false; });
  const empty = await openPage({}, linkTo(all));
  const ed = empty.window.document;
  assert.equal(ed.getElementById('state').textContent, ui.empty,
    'a link with every metric switched off gave a grid without explanation');
  assert.equal(ed.getElementById('notice').hidden, true, 'something extra was said about a complete link');
});

/* What the page needs from its host to draw anything: the block lies in the file packed, and unpacking it is the
 * browser's own `DecompressionStream`. A host without it (an old browser; jsdom, which has none and gets the
 * platform's one put in by the harness for every other check — hence `{ platform: false }` here) has to be told in
 * words rather than left with an empty table, where the reader cannot tell the report from his browser. */
test('a host without an unpacker is told in words, and nothing is drawn', async () => {
  const dom = await openPage({}, undefined, { platform: false });
  const doc = dom.window.document;
  const ui = JSON.parse(doc.getElementById('ui').textContent);
  assert.equal(doc.getElementById('notice').textContent, ui.unpack,
    'the page said nothing about a host that cannot unpack its data');
  assert.equal(doc.getElementById('notice').hidden, false, 'the message about unpacking is hidden');
  assert.equal(doc.querySelectorAll('#grid tr').length, 0,
    'the table was built although the block was never unpacked');
  assert.equal(doc.querySelectorAll('#panel input').length, 0,
    'the panel was built although the block was never unpacked');
});

/* The address is also read on an already open page: the browser does not reload the document
 * then, it only moves the anchor. That has to work too, or a link would only work in a new
 * tab — and it is sent to someone who most likely has the report open already. */
test('a link: a change of address on an open page is applied too', async () => {
  const { link, doc: sd } = await senderLink((d) => [metricBox(d)]);

  const reader = await openPage();
  const rd = reader.window.document;
  const ui = JSON.parse(rd.getElementById('ui').textContent);
  assert.equal(metricBox(rd).checked, true, 'the page did not open with the default');

  const applied = new Promise((done) => reader.window.addEventListener('hashchange', () => done()));
  reader.window.location.hash = link;
  await applied;
  assert.equal(metricBox(rd).checked, false, 'the change of address did not apply the choice from the link');
  assert.equal(nowCells(rd), (data.files.length + 1) * (data.metrics.length - 1),
    'the change of address gave the wrong set of columns');
  assert.equal(nowTotalCell(rd), nowTotalCell(sd), 'the change of address gave the wrong numbers');
  assert.equal(reader.window.location.hash, link, 'the address was rewritten while the link was applied');
  assert.deepEqual(stored(reader), {}, 'the choice that was sent was written into the reader’s memory');

  /* A foreign link on an open page: a message, the previous view and a whole address. */
  const foreign = linkTo({ v: 1, passport: 'deadbeef', metrics: { min: false }, files: {} });
  const refused = new Promise((done) => reader.window.addEventListener('hashchange', () => done()));
  reader.window.location.hash = foreign;
  await refused;
  assert.equal(rd.getElementById('notice').textContent, ui.linkForeign,
    'the page stayed silent about a foreign link on an open page');
  assert.equal(metricBox(rd).checked, false, 'a foreign address changed the reader’s view');
  assert.equal(reader.window.location.hash, foreign, 'the foreign address was rewritten by the page');
});

/* The stripe of a long drawing, and why there is no share in it. A switch costs the browser a relayout of the whole
 * table — measured on this repository's own report, `probes/step-12-columns.mjs` — and that price is paid once, in one
 * task, rather than once per slice: a queue worked off between timeouts was written first and measured at 2.5–4 s a
 * slice against 1.04 s for the very same click unsliced. So the work is one task, and the stripe over the top edge of
 * the window says it is going on instead of pretending to know how far it is (nothing can repaint inside that task).
 *
 * The work is asked for with its units here rather than through a click: a click's units come from the table
 * (`appColumnSize`), and a check cannot make the shared fixture's table long enough to be a long switch without lying
 * about them. This is the same function the page's own switches end in, in the same window. */
test('a long switch is drawn in the next task, with the stripe over the page', async () => {
  const dom = await openPage();
  const doc = dom.window.document;
  const bar = barOf(doc);
  assert.equal(bar.hidden, true, 'the stripe stands on the page before any work was asked for');

  const seen = [];
  const step = (i) => seen.push(i);
  const items = [{ i: 0, units: LONG }, { i: 1, units: LONG }];
  dom.window.appDraw(step, items);

  /* The click is answered before the drawing: the reader's page stays alive and the stripe says what is going on. */
  assert.deepEqual(seen, [], 'the long work was done on the spot instead of in the next task');
  assert.equal(bar.hidden, false, 'nothing on the page says that the drawing is going on');

  await settled(dom);
  assert.deepEqual(seen, [0, 1], 'the drawing did not happen in the next task: ' + JSON.stringify(seen));
  assert.equal(bar.hidden, true, 'the stripe stayed on the page after the drawing was done');
});

/* The other half of the rule: work short enough to be over before the browser could paint a stripe is done on the
 * click itself, and no stripe appears — one that flashed for three milliseconds tells the reader less than nothing.
 * This is the ordinary case of a small project, and it is what the shared fixture's switches are: the columns are
 * drawn before the click's own line ends. */
test('a short switch is drawn on the click, with no stripe', async () => {
  const dom = await openPage();
  const doc = dom.window.document;
  const where = (f) => (f.path === null ? f.paths[0] : f.path);
  const inSrc = [];
  data.files.forEach((f, i) => { if (where(f).indexOf('src/') === 0) inSrc.push(i); });
  assert.ok(inSrc.length > 0, 'the fixture has no folder to switch');

  const dir = [...doc.querySelectorAll('#panel .box.dir')].find((b) => b.textContent.indexOf('src/') === 0);
  toggleCheck(doc, dir.querySelector('input'), false);

  const off = data.files.map((_f, i) => inSrc.indexOf(i) < 0);
  assert.equal(nowCells(doc), (off.filter(Boolean).length + 1) * data.metrics.length,
    'the columns of the switched-off files were not drawn on the click itself');
  assert.equal(barOf(doc).hidden, true, 'a stripe was shown for work that is over before it could be painted');
});

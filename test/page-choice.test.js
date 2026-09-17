/* The reader's choice: the page remembers what they switched off and passes it on as a link.
 *
 * The memory and the link are the browser rather than a request, and both follow one rule: a record
 * is bound to the report's passport and lives in storage under a key of its own. Hence what is
 * checked here in a real DOM (jsdom): a further visit returns the same choice and the same numbers,
 * while switching everything back removes the record; a foreign, outdated or broken record is not
 * applied, and a foreign name switches off nothing of someone else's; a page opened by a link shows
 * the sender's choice without mixing it with its own and without rewriting the address it was sent
 * before the first action; a foreign, broken, incomplete or empty choice is explained in words
 * rather than by an empty grid; a change of the address on an already open page is applied
 * (`hashchange`), or the link would work in a new tab only; the address is written once per burst
 * of switches while the memory is written on the click, and an address that arrives during that
 * moment replaces the pending write rather than being overwritten by it. What the host must be able
 * to do at all stands here too: a browser without an unpacker is told so rather than left with an
 * empty table.
 *
 * The assembly of the page itself is a neighbouring suite (`page-view`): the file is split by
 * subject rather than by size.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalsOf, valueParts } from '../src/size-table.js';
import {
  allCells as cellsOf, fileBox, linkTo, metricBox, nowCells, nowTotal, pageReady, settled,
  stored, toggleBox as toggleCheck
} from '../tools/page-harness.js';

const { data, openPage } = pageReady('choice');

const allCells = () => cellsOf(data);
const nowTotalCell = nowTotal;
const topRaw = (off) => totalsOf(data.now, ['raw'], off).raw;

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

/* A sender: a page that switches off what `pick` names, and the link its address carries once the page has written it.
 * The address is written a moment after the last switch — a burst is one write — so the link is read after the delay. */
async function senderLink(pick) {
  const dom = await openPage();
  const doc = dom.window.document;
  pick(doc).forEach((box) => toggleCheck(doc, box, false));
  await settled(dom);
  return { dom: dom, doc: doc, link: dom.window.location.hash };
}

/* A page whose address writes are counted: `writes()` is how many have happened so far and `links()` what they carried.
 * The address is written late, so a check counts the calls rather than waiting for the address to settle. jsdom writes
 * the address itself when the fragment changes (`location.hash = …`), which is why the checks look at what a write
 * carried rather than only at how many there were. */
async function countingPage() {
  const dom = await openPage();
  const history = dom.window.history;
  const write = history.replaceState.bind(history);
  const seen = { n: 0, links: [] };
  history.replaceState = function (...args) { seen.n++; seen.links.push(String(args[2])); return write(...args); };
  return { dom: dom, doc: dom.window.document, writes: () => seen.n, links: () => seen.links.slice() };
}

// The record a page's address carries now, read back the way the page writes it.
const addressRecord = (dom) => JSON.parse(decodeURIComponent(dom.window.location.hash.slice('#size-report='.length)));

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

/* Exchanging a choice by link: the address is the link (the page repeats it), and opening it shows
 * the sender's choice — the same set of columns and the same numbers. The link does not replace the
 * storage of whoever merely shared it and does not touch the address it was sent with before the
 * reader's first action. */
test('a link: the page opened by it shows the sender’s choice', async () => {
  const { doc: sd, link } = await senderLink((d) => [metricBox(d), fileBox(d, 'src/code.js')]);
  assert.equal(link.indexOf('#size-report='), 0, 'the choice did not get into the address: there is nothing to pass by link');
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

  /* The reader's action makes the state theirs: both the storage and the address, starting from the
   * view on screen (the sender's) rather than from their own earlier choice — the page remembers
   * what it shows. */
  toggleCheck(gd, fileBox(gd, 'src/code.js'), true);
  assert.notDeepEqual(stored(guest), own, 'the reader’s action was not saved into their memory');
  await settled(guest);
  assert.notEqual(guest.window.location.hash, link, 'the address did not become the reader’s choice');
  const rec = JSON.parse(stored(guest)[Object.keys(stored(guest))[0]]);
  assert.deepEqual(rec.metrics, { min: false }, 'a metric that is not theirs landed in the reader’s memory');
  assert.deepEqual(rec.files, {}, 'something other than what they did landed in the reader’s memory');
  assert.equal(nowCells(gd), (data.files.length + 1) * (data.metrics.length - 1),
    'an edit of the sender’s view did not bring every file back');
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

/* The address is also changed on an already open page: the browser does not reload the document
 * then, it only moves the anchor. The link has to work that way too, or it would only work in a new
 * tab — and it is sent to someone who most likely has the report open already. */
test('a link: a change of address on an open page is applied too', async () => {
  const sender = await openPage();
  const sd = sender.window.document;
  toggleCheck(sd, metricBox(sd), false);
  await settled(sender);
  const link = sender.window.location.hash;

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
  /* And it is still that address after the moment a write would have taken: the page was holding a write of its own from
   * the link it applied a moment ago, and an address that came in from outside wins over it. A refusal arms nothing to
   * replace the pending write, so this is where it would land. */
  await settled(reader);
  assert.equal(reader.window.location.hash, foreign,
    'запись, оставшаяся от прошлого выбора, перекрыла присланный адрес');
});

/* The address is written once per burst of switches, and the memory on the click itself: a reader who clicks three boxes
 * passes on one link rather than three history entries, while a visit right after a click still keeps the choice. What
 * the link carries is the whole choice — the same record the memory holds. */
test('the address is written once per burst, the memory on the click', async () => {
  const reader = await countingPage();
  const doc = reader.doc;

  toggleCheck(doc, metricBox(doc), false);
  toggleCheck(doc, fileBox(doc, 'src/code.js'), false);
  toggleCheck(doc, fileBox(doc, 'package.json'), false);
  assert.equal(reader.writes(), 0, 'адрес переписан на самом клике: пачка переключений должна дать одну ссылку');
  const saved = stored(reader.dom);
  assert.equal(Object.keys(saved).length, 1, 'выбор не записан в память на самом клике');
  const again = (await openPage(saved)).window.document;
  assert.equal(metricBox(again).checked, false, 'перезагрузка сразу после клика потеряла метрику');
  assert.equal(fileBox(again, 'src/code.js').checked, false, 'перезагрузка сразу после клика потеряла файл');

  await settled(reader.dom);
  assert.equal(reader.writes(), 1, 'за пачку из трёх переключений адрес записан ' + reader.writes() + ' раза');
  const link = reader.dom.window.location.hash;
  assert.equal(link.indexOf('#size-report='), 0, 'выбор не попал в адрес');
  assert.deepEqual(addressRecord(reader.dom), JSON.parse(saved[Object.keys(saved)[0]]),
    'адрес и память описывают разные выборы');
  const guest = (await openPage({}, link)).window.document;
  assert.equal(nowCells(guest), nowCells(doc), 'ссылка несёт не тот набор колонок');
  assert.equal(nowTotal(guest), nowTotal(doc), 'ссылка несёт не те числа');

  /* A later burst is one write again, and it carries the newest choice rather than the one before it. */
  toggleCheck(doc, fileBox(doc, 'src/code.js'), true);
  toggleCheck(doc, fileBox(doc, 'package.json'), true);
  await settled(reader.dom);
  assert.equal(reader.writes(), 2, 'вторая пачка переключений дала не одну запись адреса');
  assert.deepEqual(addressRecord(reader.dom).files, {},
    'адрес нёс предыдущий выбор: в ссылке остались файлы, которые читатель уже вернул');
});

/* The deferred write of the address changes what a colleague would receive and nothing else: the nodes the click left in
 * place are the same objects after the delay too, and the wait itself appends nothing. The page suite watches a click up
 * to its end, so a write that rebuilds what it can rebuild would show there only under a check of its own — on the page it
 * would look like the reader's scroll and place in the list jumping a fifth of a second after the click. */
test('the write of the address, once it comes, builds nothing', async () => {
  const reader = await countingPage();
  const doc = reader.doc;
  const add = reader.dom.window.Node.prototype.appendChild;
  let made = 0;
  reader.dom.window.Node.prototype.appendChild = function (node) { made++; return add.call(this, node); };
  const panel = doc.querySelector('#panel');
  const list = doc.querySelector('#panel .files');
  const tree = doc.querySelector('#panel .tree');
  const rows = [...doc.querySelectorAll('#grid tbody tr')];
  const cells = [...doc.querySelectorAll('#grid td')];

  toggleCheck(doc, fileBox(doc, 'src/code.js'), false);
  made = 0;
  await settled(reader.dom);
  assert.equal(reader.writes(), 1, 'отложенной записи адреса не было — проверять нечего');
  assert.equal(made, 0, 'отложенная запись адреса создала ' + made + ' узлов: разметку пересобирает таймер');
  assert.equal(doc.querySelector('#panel'), panel, 'панель пересобрана отложенной записью адреса');
  assert.equal(doc.querySelector('#panel .files'), list, 'список файлов пересобран отложенной записью адреса');
  assert.equal(doc.querySelector('#panel .tree'), tree, 'дерево пересобрано отложенной записью адреса');
  assert.deepEqual([...doc.querySelectorAll('#grid tbody tr')], rows,
    'строки таблицы стали другими узлами после отложенной записи адреса');
  assert.deepEqual([...doc.querySelectorAll('#grid td')], cells,
    'клетки таблицы стали другими узлами после отложенной записи адреса');
});

/* An address that arrives while a write is still waiting wins over it: the write the reader's click armed must not land
 * on the link that was just applied. A refusal arms nothing of its own, so nothing would replace the pending write —
 * this is where it would land. The two choices name different files, so a landing write would be visible. */
test('a link: an address that arrives during the delay wins over the pending write', async () => {
  const sender = await openPage();
  toggleCheck(sender.window.document, fileBox(sender.window.document, 'package.json'), false);
  await settled(sender);
  const incoming = sender.window.location.hash;

  const reader = await countingPage();
  const doc = reader.doc;
  toggleCheck(doc, fileBox(doc, 'src/code.js'), false);
  reader.dom.window.location.hash = incoming;
  await settled(reader.dom);
  assert.equal(reader.dom.window.location.hash, incoming,
    'запись, оставшаяся от прошлого выбора, перекрыла пришедшую ссылку');
  assert.deepEqual(reader.links().filter((u) => u !== incoming), [],
    'задержанная запись читателя легла поверх присланной ссылки');
  assert.deepEqual(addressRecord(reader.dom).files, { 'package.json': false },
    'адрес описывает выбор читателя, а не присланную ссылку');
  assert.equal(fileBox(doc, 'package.json').checked, false, 'пришедшая ссылка не была применена');
  assert.equal(fileBox(doc, 'src/code.js').checked, true, 'пришедшая ссылка не заменила выбор читателя собой');
});

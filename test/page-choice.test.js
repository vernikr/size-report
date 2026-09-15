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
 * (`hashchange`), or the link would work in a new tab only.
 *
 * The assembly of the page itself is a neighbouring suite (`page-view`): the file is split by
 * subject rather than by size.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalsOf, valueParts } from '../src/size-table.js';
import {
  allCells as cellsOf, fileBox, linkTo, metricBox, nowCells, nowTotal, pageReady,
  stored, toggleBox as toggleCheck
} from '../tools/page-harness.js';

const { data, openPage } = pageReady('choice');

const allCells = () => cellsOf(data);
const nowTotalCell = nowTotal;
const topRaw = (off) => totalsOf(data.now, ['raw'], off).raw;

/* An owner of the report with a choice of their own: a page with a metric off and its storage —
 * what a sent link is compared against (the link is older than the owner's choice). */
function ownerChoice() {
  const owner = openPage();
  const doc = owner.window.document;
  toggleCheck(doc, metricBox(doc), false);
  const own = stored(owner);
  return { owner: owner, doc: doc, own: own,
    passport: Object.keys(own)[0].slice('size-report:'.length) };
}

test('память выбора: перезаход возвращает тот же выбор и те же числа', () => {
  const first = openPage();
  const doc = first.window.document;

  /* The first reader: everything is on, and nothing is remembered about them yet. */
  assert.deepEqual(stored(first), {}, 'первый заход оставил запись о выборе, которого не было');
  assert.equal(nowCells(doc), allCells(), 'умолчание не всё включено');

  toggleCheck(doc, metricBox(doc), false);
  toggleCheck(doc, fileBox(doc, 'src/code.js'), false);
  const off = data.files.map((f) => f.path !== 'src/code.js');
  const total = valueParts(topRaw(off)).text;
  assert.equal(nowTotalCell(doc), total, 'итог после выбора не тот, что даёт вычислительная часть');

  const saved = stored(first);
  assert.equal(Object.keys(saved).length, 1, 'выбор записан не одной записью');

  /* A further visit: the same report, the same storage. */
  const again = openPage(saved);
  const doc2 = again.window.document;
  assert.equal(metricBox(doc2).checked, false, 'перезаход не вернул выключенную метрику');
  assert.equal(fileBox(doc2, 'src/code.js').checked, false, 'перезаход не вернул выключенный файл');
  // Everything is on except the metric and the file switched off by the choice — which is what the
  // columns show.
  assert.equal(nowCells(doc2), (off.filter(Boolean).length + 1) * (data.metrics.length - 1),
    'перезаход вернул не тот набор колонок');
  assert.equal(nowTotalCell(doc2), total, 'перезаход показал другие числа');

  /* Everything switched back on makes the choice the default and leaves no record: otherwise "put
   * back as it was" would be no different from "something is off". */
  toggleCheck(doc2, metricBox(doc2), true);
  toggleCheck(doc2, fileBox(doc2, 'src/code.js'), true);
  assert.deepEqual(stored(again), {}, 'возврат всех галочек оставил запись о выборе');
  assert.equal(nowCells(doc2), allCells(), 'возврат галочек не вернул таблицу к умолчанию');
});

test('память выбора: чужая или испорченная запись не применяется', () => {
  const first = openPage();
  const doc = first.window.document;
  toggleCheck(doc, metricBox(doc), false);
  toggleCheck(doc, fileBox(doc, 'src/code.js'), false);
  const saved = stored(first);
  const key = Object.keys(saved)[0];
  const rec = JSON.parse(saved[key]);

  /* The record explains itself: the format's version, the passport (which is also the key's name,
   * or the record would be looked for where it does not lie) and only what is off, by name. */
  assert.equal(rec.v, 1, 'запись не объявила версию формата');
  assert.equal(rec.passport, key.slice('size-report:'.length),
    'ключ записи и её паспорт разошлись');
  assert.deepEqual(rec.metrics, { min: false }, 'запись не назвала выключенную метрику');
  assert.deepEqual(rec.files, { 'src/code.js': false }, 'запись не назвала выключенный файл');

  /* A foreign report: its record lies under its own key and has to stay whole. */
  const foreignKey = 'size-report:2f1a';
  const other = openPage({ [foreignKey]: JSON.stringify({ v: 1, passport: '2f1a',
    metrics: { min: false }, files: { 'src/code.js': false } }) });
  assert.equal(nowCells(other.window.document), allCells(), 'выбор чужого отчёта применился к этому');
  assert.deepEqual(Object.keys(stored(other)), [foreignKey], 'страница стёрла чужую запись');

  /* The right key but a foreign passport is the same as no record at all. */
  const stranger = openPage({ [key]: JSON.stringify(Object.assign({}, rec, { passport: 'deadbeef' })) });
  assert.equal(nowCells(stranger.window.document), allCells(), 'запись с чужим паспортом применилась');

  /* A record of another format and a broken one read the same way: not at all. */
  const older = openPage({ [key]: JSON.stringify(Object.assign({}, rec, { v: 0 })) });
  assert.equal(nowCells(older.window.document), allCells(), 'запись старого формата применилась');
  const broken = openPage({ [key]: '{ это не JSON' });
  assert.equal(nowCells(broken.window.document), allCells(), 'испорченная запись сломала страницу');

  /* A name the report no longer holds: a name that is there applies, an unknown one means nothing
   * and switches off nothing of someone else's, and the record is brought back to what the report
   * holds. */
  const ghost = openPage({ [key]: JSON.stringify({ v: 1, passport: rec.passport,
    metrics: { tok: false, min: false }, files: { 'src/gone.js': false, 'src/code.js': false } }) });
  const gd = ghost.window.document;
  assert.equal(metricBox(gd).checked, false, 'названная метрика не применилась');
  assert.equal(fileBox(gd, 'src/code.js').checked, false, 'названный файл не применился');
  assert.equal(fileBox(gd, 'src/empty.js').checked, true, 'исчезнувшее имя выключило чужой файл');
  assert.deepEqual(JSON.parse(stored(ghost)[key]),
    { v: 1, passport: rec.passport, metrics: { min: false }, files: { 'src/code.js': false } },
    'страница не привела запись к тому, что есть в отчёте');
});

/* Exchanging a choice by link: the address is the link (the page repeats it), and opening it shows
 * the sender's choice — the same set of columns and the same numbers. The link does not replace the
 * storage of whoever merely shared it and does not touch the address it was sent with before the
 * reader's first action. */
test('ссылка: открытая по ней страница показывает выбор отправителя', () => {
  const sender = openPage();
  const sd = sender.window.document;
  toggleCheck(sd, metricBox(sd), false);
  toggleCheck(sd, fileBox(sd, 'src/code.js'), false);

  const link = sender.window.location.hash;
  assert.equal(link.indexOf('#size-report='), 0, 'выбор не попал в адрес: передавать ссылкой нечего');
  const sentCells = nowCells(sd);
  const sentTotal = nowTotalCell(sd);

  /* The receiver has a stored state of their own — but the link is older than it: the reader sees
   * what was sent rather than a mixture of two choices. */
  const owner = openPage();
  const od = owner.window.document;
  toggleCheck(od, fileBox(od, 'package.json'), false);
  const own = stored(owner);
  assert.equal(Object.keys(own).length, 1, 'выбор владельца не записался');

  const guest = openPage(own, link);
  const gd = guest.window.document;
  assert.equal(nowCells(gd), sentCells, 'ссылка дала не тот набор колонок');
  assert.equal(nowTotalCell(gd), sentTotal, 'ссылка дала не тот итог');
  assert.equal(metricBox(gd).checked, false, 'ссылка не выключила метрику отправителя');
  assert.equal(fileBox(gd, 'src/code.js').checked, false, 'ссылка не выключила файл отправителя');
  assert.equal(fileBox(gd, 'package.json').checked, true,
    'ссылка не заменила выбор читателя, а смешалась с ним');
  assert.deepEqual(stored(guest), own, 'присланная ссылка переписала память читателя');
  assert.equal(guest.window.location.hash, link, 'адрес присланной ссылки переписан страницей');
  assert.equal(gd.getElementById('notice').hidden, true, 'о нормальной ссылке сказано лишнее');

  /* The reader's action makes the state theirs: both the storage and the address, starting from the
   * view on screen (the sender's) rather than from their own earlier choice — the page remembers
   * what it shows. */
  toggleCheck(gd, fileBox(gd, 'src/code.js'), true);
  assert.notDeepEqual(stored(guest), own, 'действие читателя не сохранилось в его память');
  assert.notEqual(guest.window.location.hash, link, 'адрес не стал выбором читателя');
  const rec = JSON.parse(stored(guest)[Object.keys(stored(guest))[0]]);
  assert.deepEqual(rec.metrics, { min: false }, 'в память читателя легла не его метрика');
  assert.deepEqual(rec.files, {}, 'в память читателя легло не то, что он сделал');
  assert.equal(nowCells(gd), (data.files.length + 1) * (data.metrics.length - 1),
    'правка вида отправителя не вернула все файлы');
});

/* A refused link is a message to the reader rather than an empty table: a foreign report and a
 * broken record read the same way — not at all — and each is told in its own text, while the
 * reader's previous view and the address they were sent stay whole. */
test('ссылка: чужой и битый адрес объясняются словами', () => {
  const { doc: od, own } = ownerChoice();
  const ui = JSON.parse(od.getElementById('ui').textContent);
  const notice = (doc) => doc.getElementById('notice');

  /* A foreign anchor is not our link: silence. */
  const anchor = openPage({}, '#top');
  assert.equal(notice(anchor.window.document).hidden, true, 'обычный якорь приняли за ссылку');

  /* A link of another report: not applied, the reader is told, the address is untouched. */
  const foreignHash = linkTo({ v: 1, passport: 'deadbeef',
    metrics: { min: false }, files: { 'src/code.js': false } });
  const foreign = openPage(own, foreignHash);
  const fd = foreign.window.document;
  assert.equal(notice(fd).textContent, ui.linkForeign, 'про чужую ссылку не сказано');
  assert.equal(notice(fd).hidden, false, 'про чужую ссылку промолчали');
  assert.equal(fileBox(fd, 'src/code.js').checked, true, 'чужой выбор всё-таки применился');
  assert.equal(metricBox(fd).checked, false, 'выбор читателя не применился после отказа ссылки');
  assert.equal(foreign.window.location.hash, foreignHash, 'чужой адрес переписан страницей');

  /* A broken link: told too, and the markup stays at the default. */
  const broken = openPage({}, '#size-report=%7B%D1%8D%D1%82%D0%BE-%D0%BD%D0%B5-JSON');
  assert.equal(notice(broken.window.document).textContent, ui.linkBroken, 'про битую ссылку не сказано');
  assert.equal(nowCells(broken.window.document), allCells(), 'битая ссылка испортила умолчание');
});

/* A link about what the report does not hold: what is named applies, and what was left out is said
 * as a number — or the reader would look in the table for what is not in it. A sender who switched
 * everything off is explained in words rather than by an empty grid. */
test('ссылка: неполный или пустой выбор объясняется числом', () => {
  const { doc: od, passport } = ownerChoice();
  const ui = JSON.parse(od.getElementById('ui').textContent);

  const ghost = openPage({}, linkTo({ v: 1, passport: passport,
    metrics: { tok: false, min: false }, files: { 'src/gone.js': false, 'src/code.js': false } }));
  const gd = ghost.window.document;
  assert.equal(metricBox(gd).checked, false, 'названная метрика не применилась из ссылки');
  assert.equal(fileBox(gd, 'src/code.js').checked, false, 'названный файл не применился из ссылки');
  assert.equal(gd.getElementById('notice').textContent, ui.linkExtra.replace('{n}', '2'),
    'о пропущенных именах не сказано');

  const all = { v: 1, passport: passport, metrics: {}, files: {} };
  data.metrics.forEach((m) => { all.metrics[m.key] = false; });
  data.files.forEach((f) => { all.files[f.path === null ? f.paths[0] : f.path] = false; });
  const empty = openPage({}, linkTo(all));
  const ed = empty.window.document;
  assert.equal(ed.getElementById('state').textContent, ui.empty,
    'ссылка с выключенными метриками дала сетку без объяснения');
  assert.equal(ed.getElementById('notice').hidden, true, 'о полной ссылке сказано лишнее');
});

/* The address is also changed on an already open page: the browser does not reload the document
 * then, it only moves the anchor. The link has to work that way too, or it would only work in a new
 * tab — and it is sent to someone who most likely has the report open already. */
test('ссылка: смена адреса на открытой странице тоже применяется', async () => {
  const sender = openPage();
  const sd = sender.window.document;
  toggleCheck(sd, metricBox(sd), false);
  const link = sender.window.location.hash;

  const reader = openPage();
  const rd = reader.window.document;
  const ui = JSON.parse(rd.getElementById('ui').textContent);
  assert.equal(metricBox(rd).checked, true, 'страница открылась не с умолчанием');

  const applied = new Promise((done) => reader.window.addEventListener('hashchange', () => done()));
  reader.window.location.hash = link;
  await applied;
  assert.equal(metricBox(rd).checked, false, 'смена адреса не применила выбор из ссылки');
  assert.equal(nowCells(rd), (data.files.length + 1) * (data.metrics.length - 1),
    'смена адреса дала не тот набор колонок');
  assert.equal(nowTotalCell(rd), nowTotalCell(sd), 'смена адреса дала не те числа');
  assert.equal(reader.window.location.hash, link, 'адрес переписан при применении ссылки');
  assert.deepEqual(stored(reader), {}, 'присланный выбор записался в память читателя');

  /* A foreign link on an open page: a message, the previous view and a whole address. */
  const foreign = linkTo({ v: 1, passport: 'deadbeef', metrics: { min: false }, files: {} });
  const refused = new Promise((done) => reader.window.addEventListener('hashchange', () => done()));
  reader.window.location.hash = foreign;
  await refused;
  assert.equal(rd.getElementById('notice').textContent, ui.linkForeign,
    'про чужую ссылку на открытой странице промолчали');
  assert.equal(metricBox(rd).checked, false, 'чужой адрес изменил вид читателя');
  assert.equal(reader.window.location.hash, foreign, 'чужой адрес переписан страницей');
});

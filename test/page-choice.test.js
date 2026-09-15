/* Выбор читателя: страница помнит, что он выключил, и передаёт это ссылкой.
 *
 * Память и ссылка — это браузер, а не запрос, и обе устроены одним правилом:
 * запись привязана к паспорту отчёта и лежит в памяти под своим ключом. Отсюда
 * всё, что здесь проверяется в настоящем DOM (jsdom):
 *
 *   1. перезаход возвращает тот же выбор и те же числа, а «включил всё обратно»
 *      убирает запись;
 *   2. чужая, устаревшая или испорченная запись не применяется, а названное
 *      чужое имя ничего не выключает;
 *   3. открытая по ссылке страница показывает выбор отправителя, не смешивая
 *      его со своим и не переписывая присланный адрес до первого действия;
 *   4. чужой, битый, неполный или пустой выбор объясняется словами, а не
 *      пустой сеткой;
 *   5. смена адреса на уже открытой странице применяется (`hashchange`) — иначе
 *      ссылка срабатывала бы только в новой вкладке.
 *
 * Сборка самой страницы — соседний набор (`page-view`): файл разделён по
 * предмету, а не по размеру.
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

/* Владелец отчёта со своим выбором: страница с выключенной метрикой и её память —
 * то, с чем сверяется присланная ссылка (она старше своего выбора). */
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

  /* Первый читатель: всё включено, и памяти о нём ещё нет. */
  assert.deepEqual(stored(first), {}, 'первый заход оставил запись о выборе, которого не было');
  assert.equal(nowCells(doc), allCells(), 'умолчание не всё включено');

  toggleCheck(doc, metricBox(doc), false);
  toggleCheck(doc, fileBox(doc, 'src/code.js'), false);
  const off = data.files.map((f) => f.path !== 'src/code.js');
  const total = valueParts(topRaw(off)).text;
  assert.equal(nowTotalCell(doc), total, 'итог после выбора не тот, что даёт вычислительная часть');

  const saved = stored(first);
  assert.equal(Object.keys(saved).length, 1, 'выбор записан не одной записью');

  /* Перезаход: тот же отчёт, та же память. */
  const again = openPage(saved);
  const doc2 = again.window.document;
  assert.equal(metricBox(doc2).checked, false, 'перезаход не вернул выключенную метрику');
  assert.equal(fileBox(doc2, 'src/code.js').checked, false, 'перезаход не вернул выключенный файл');
  // Включено всё, кроме выключенных выбором метрики и файла — это и видно колонками.
  assert.equal(nowCells(doc2), (off.filter(Boolean).length + 1) * (data.metrics.length - 1),
    'перезаход вернул не тот набор колонок');
  assert.equal(nowTotalCell(doc2), total, 'перезаход показал другие числа');

  /* Включил всё обратно — выбор стал умолчанием, и записи больше нет: иначе
   * «вернул как было» ничем не отличается от «что-то выключено». */
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

  /* Запись объясняет себя: версия формата, паспорт (он же — имя ключа, иначе
   * запись ищется не там, где лежит) и только выключенное, по именам. */
  assert.equal(rec.v, 1, 'запись не объявила версию формата');
  assert.equal(rec.passport, key.slice('size-report:'.length),
    'ключ записи и её паспорт разошлись');
  assert.deepEqual(rec.metrics, { min: false }, 'запись не назвала выключенную метрику');
  assert.deepEqual(rec.files, { 'src/code.js': false }, 'запись не назвала выключенный файл');

  /* Чужой отчёт: его запись лежит под своим ключом и должна остаться целой. */
  const foreignKey = 'size-report:2f1a';
  const other = openPage({ [foreignKey]: JSON.stringify({ v: 1, passport: '2f1a',
    metrics: { min: false }, files: { 'src/code.js': false } }) });
  assert.equal(nowCells(other.window.document), allCells(), 'выбор чужого отчёта применился к этому');
  assert.deepEqual(Object.keys(stored(other)), [foreignKey], 'страница стёрла чужую запись');

  /* Свой ключ, но чужой паспорт — равносильно отсутствию записи. */
  const stranger = openPage({ [key]: JSON.stringify(Object.assign({}, rec, { passport: 'deadbeef' })) });
  assert.equal(nowCells(stranger.window.document), allCells(), 'запись с чужим паспортом применилась');

  /* Запись другого формата и испорченная читаются одинаково: никак. */
  const older = openPage({ [key]: JSON.stringify(Object.assign({}, rec, { v: 0 })) });
  assert.equal(nowCells(older.window.document), allCells(), 'запись старого формата применилась');
  const broken = openPage({ [key]: '{ это не JSON' });
  assert.equal(nowCells(broken.window.document), allCells(), 'испорченная запись сломала страницу');

  /* Имя, которого в отчёте больше нет: названное верно применяется, неизвестное не
   * значит ничего и не выключает чужое, а запись приводится к тому, что есть. */
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

/* Обмен выбором ссылкой: адрес и есть ссылка (страница его повторяет), а открытие
 * по ней показывает выбор отправителя — тем же набором колонок и теми же числами.
 * При этом ссылка не подменяет память того, кто ею лишь поделился, и не трогает
 * присланный адрес до первого действия читателя. */
test('ссылка: открытая по ней страница показывает выбор отправителя', () => {
  const sender = openPage();
  const sd = sender.window.document;
  toggleCheck(sd, metricBox(sd), false);
  toggleCheck(sd, fileBox(sd, 'src/code.js'), false);

  const link = sender.window.location.hash;
  assert.equal(link.indexOf('#size-report='), 0, 'выбор не попал в адрес: передавать ссылкой нечего');
  const sentCells = nowCells(sd);
  const sentTotal = nowTotalCell(sd);

  /* У получателя своё сохранённое состояние — но ссылка старше его: читатель видит
   * то, что ему прислали, а не смесь двух выборов. */
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

  /* Действие читателя — теперь состояние его: и память, и адрес становятся его,
   * причём от того вида, что стоит на экране (вид отправителя), а не от прежнего
   * собственного выбора — страница помнит то, что показывает. */
  toggleCheck(gd, fileBox(gd, 'src/code.js'), true);
  assert.notDeepEqual(stored(guest), own, 'действие читателя не сохранилось в его память');
  assert.notEqual(guest.window.location.hash, link, 'адрес не стал выбором читателя');
  const rec = JSON.parse(stored(guest)[Object.keys(stored(guest))[0]]);
  assert.deepEqual(rec.metrics, { min: false }, 'в память читателя легла не его метрика');
  assert.deepEqual(rec.files, {}, 'в память читателя легло не то, что он сделал');
  assert.equal(nowCells(gd), (data.files.length + 1) * (data.metrics.length - 1),
    'правка вида отправителя не вернула все файлы');
});

/* Отказ ссылки — это сообщение читателю, а не пустая таблица: чужой отчёт и
 * битая запись читаются одинаково — никак, и о каждом сказано своим текстом,
 * причём прежний вид читателя и присланный адрес остаются целыми. */
test('ссылка: чужой и битый адрес объясняются словами', () => {
  const { doc: od, own } = ownerChoice();
  const ui = JSON.parse(od.getElementById('ui').textContent);
  const notice = (doc) => doc.getElementById('notice');

  /* Чужой якорь — не наша ссылка: молчание. */
  const anchor = openPage({}, '#top');
  assert.equal(notice(anchor.window.document).hidden, true, 'обычный якорь приняли за ссылку');

  /* Ссылка другого отчёта: не применяется, читателю сказано, адрес не тронут. */
  const foreignHash = linkTo({ v: 1, passport: 'deadbeef',
    metrics: { min: false }, files: { 'src/code.js': false } });
  const foreign = openPage(own, foreignHash);
  const fd = foreign.window.document;
  assert.equal(notice(fd).textContent, ui.linkForeign, 'про чужую ссылку не сказано');
  assert.equal(notice(fd).hidden, false, 'про чужую ссылку промолчали');
  assert.equal(fileBox(fd, 'src/code.js').checked, true, 'чужой выбор всё-таки применился');
  assert.equal(metricBox(fd).checked, false, 'выбор читателя не применился после отказа ссылки');
  assert.equal(foreign.window.location.hash, foreignHash, 'чужой адрес переписан страницей');

  /* Битая ссылка: тоже сказано, а разметка остаётся умолчанием. */
  const broken = openPage({}, '#size-report=%7B%D1%8D%D1%82%D0%BE-%D0%BD%D0%B5-JSON');
  assert.equal(notice(broken.window.document).textContent, ui.linkBroken, 'про битую ссылку не сказано');
  assert.equal(nowCells(broken.window.document), allCells(), 'битая ссылка испортила умолчание');
});

/* Ссылка про то, чего в отчёте нет: применено названное верно, а о пропущенном
 * сказано числом — иначе читатель станет искать в таблице то, чего в ней нет.
 * Отправитель, выключивший всё, объяснён словами, а не пустой сеткой. */
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

/* Адрес меняют и на уже открытой странице: браузер в этом случае документ не
 * перезагружает, а только переставляет якорь. Ссылка должна работать и так, иначе
 * она срабатывает лишь в новой вкладке — а её отправляют тому, у кого отчёт,
 * скорее всего, уже открыт. */
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

  /* Чужая ссылка на открытой странице: сообщение, прежний вид и целый адрес. */
  const foreign = linkTo({ v: 1, passport: 'deadbeef', metrics: { min: false }, files: {} });
  const refused = new Promise((done) => reader.window.addEventListener('hashchange', () => done()));
  reader.window.location.hash = foreign;
  await refused;
  assert.equal(rd.getElementById('notice').textContent, ui.linkForeign,
    'про чужую ссылку на открытой странице промолчали');
  assert.equal(metricBox(rd).checked, false, 'чужой адрес изменил вид читателя');
  assert.equal(reader.window.location.hash, foreign, 'чужой адрес переписан страницей');
});

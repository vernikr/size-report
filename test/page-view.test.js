/* Страница отчёта — то, что читает человек: один самодостаточный файл, который
 * считает то же, что артефакт, и пересчитывается по выбору читателя.
 *
 * Проверяется по собранному выводу и в настоящем DOM (jsdom), а не по описанию:
 *
 *   1. вклеена ровно программа из своих исходников — общий расчёт первым, без
 *      модульного синтаксиса, и оболочка не завела своих функций расчёта;
 *   2. страница самодостаточна (нет внешних ссылок и обращений к сети) и несёт
 *      данные контракта;
 *   3. выключение метрики, файла или папки пересчитывает таблицу и итог, дерево
 *      файлов повторяет пути данных, а у папки три состояния;
 *   4. приближённые клетки помечены, и знак итога — худшее из включённых;
 *   5. оформление таблицы одно на оба вывода, а состояния пустоты объясняются
 *      словами;
 *   6. переключатели панели — одна цель нажатия, и пересборка не отбирает фокус.
 *
 * Память выбора и обмен ссылкой — соседний набор (`page-choice`): файл разделён
 * по предмету, а не по размеру. Сам контракт и производные — `contract-data` и
 * `contract-derived`.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { pageScript, stripModules, valueParts } from '../src/size-table.js';
import { PAGE_PARTS, pagePayload } from '../src/page/build.js';
import { PAGE_CSS, TABLE_CSS } from '../src/css.js';
import { ROOT, tempDir } from '../tools/harness.js';
import {
  allCells, fileBox, metricBox, nowCells, nowTotal, openPage as openReport, panelInputs,
  reportSetup, toggleBox
} from '../tools/page-harness.js';

const tmp = tempDir('page-view');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const { data, pageText } = reportSetup(tmp, 'report');
const openPage = () => openReport(pageText);

/* Программа страницы собирается из исходников на диске: общий расчёт
 * (`src/derived.js`) и главы оболочки (`src/page/*.js`, список — от самой сборки).
 * Проверки ниже читают те же файлы, чтобы сверять вклеенное в страницу с тем, что
 * лежит в репозитории, а не с тем, что движок сказал про себя. */
const derivedSrc = fs.readFileSync(path.join(ROOT, 'src', 'derived.js'), 'utf8');
const appSrc = PAGE_PARTS
  .map((part) => fs.readFileSync(path.join(ROOT, 'src', 'page', part.slice(2)), 'utf8'))
  .join('');
const pageMath = new Function(stripModules(derivedSrc)
  + '\nreturn { rowModel: rowModel, totalsOf: totalsOf };')();

const allOn = () => data.files.map(() => true);

/* Второй независимый расчёт не должен появиться тихо. Страница получает текст
 * вычислительной части у самого движка, а оболочка страницы обязана только
 * строить узлы: свои итоги, дельты или форматирование в ней — уже второй расчёт. */
test('вычислительная часть страницы — код движка, а не копия', () => {
  const script = pageScript();
  const defined = (src) => [...src.matchAll(/\nfunction\s+(\w+)/g)].map((m) => m[1]);

  // В страницу попадает ровно текст двух файлов (без модульного синтаксиса).
  assert.deepEqual(defined(script).sort(), defined(stripModules(derivedSrc))
    .concat(defined(stripModules(appSrc))).sort(),
  'в программе страницы есть функция не из своих исходников');
  assert.equal(script.indexOf(stripModules(derivedSrc)), 0,
    'программа страницы начинается не с общего расчёта');
  assert.equal(/^\s*(import|export)\s/m.test(script), false,
    'в вклеенной программе остался модульный синтаксис: страница с диска его не разрешит');
  assert.ok(pageText.indexOf(script) > 0, 'страница собрана не из общей программы');

  /* Список функций оболочки закрыт: любая новая функция в ней — это либо
   * разметка, либо вернувшийся своим путём расчёт; первое правится здесь же,
   * второе лучше не делать вовсе. Главы читаются в том же виде, в каком они
   * попадают в страницу, — со снятым модульным синтаксисом. */
  assert.deepEqual(defined('\n' + stripModules(appSrc)).sort(), [
    'appAll', 'appApply', 'appApprox', 'appBody', 'appBox', 'appCell', 'appCellClass', 'appCommit', 'appEl',
    'appFileAt', 'appFileBox',
    'appHash', 'appHead', 'appIndexes', 'appLegend', 'appLinkRead', 'appLinkUse', 'appNotice', 'appPanel',
    'appPassport', 'appRead', 'appRecord', 'appRecordOk', 'appRender', 'appRow', 'appState', 'appSubHead',
    'appTable', 'appTree', 'appTreeList', 'appUnknown', 'appValueCell', 'appWrite'
  ], 'оболочка страницы завела свою функцию: расчёт должен жить в вычислительной части');
  assert.equal(/\breduce\(|Math\.abs/.test(appSrc), false,
    'оболочка страницы считает итоги или знак дельты сама');
  ['rowModel', 'nowModel', 'commitParts', 'cellParts', 'valueParts'].forEach((name) => {
    assert.ok(appSrc.indexOf(name + '(') >= 0, 'оболочка страницы не пользуется ' + name);
  });
});

test('страница самодостаточна и несёт данные контракта', () => {
  assert.equal(/https?:\/\//.test(pageText), false,
    'в странице есть внешняя ссылка: без сети она не откроется');
  assert.equal(/<link|<img|src=/.test(pageText), false, 'страница тянет что-то со стороны');

  /* Один файл и три тега: два с данными и программа. Программа вклеена ровно
   * так, как её отдаёт движок, и без модульного синтаксиса: страница открывается
   * с диска, а не с сервера, и разрешать `import` там нечем. */
  assert.equal((pageText.match(/<script/g) || []).length, 3,
    'в странице не три тега script: вклейка изменилась, и файлов могло стать больше одного');

  /* Ни одна возможность страницы не ходит в сеть: память и ссылка — это браузер,
   * а не запрос. Проверка по именам (внешней ссылки может и не быть, а обращение —
   * быть), и она буквальная: слово не должно встречаться в странице даже в
   * комментарии — поэтому о динамическом импорте в исходниках пишут словами. */
  ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'import('].forEach((api) => {
    assert.equal(pageText.indexOf(api), -1,
      'в странице появилось обращение к сети: ' + api + ' — так она не работает с диска');
  });
  assert.ok(pageText.indexOf('<script>\n' + pageScript() + '</script>') > 0,
    'программа страницы вклеена не целиком или не тем текстом, который отдаёт движок');
  assert.equal(/type="module"/.test(pageText), false, 'программа страницы объявлена модулем');

  const dom = new JSDOM(pageText);
  const embedded = JSON.parse(dom.window.document.getElementById('data').textContent);
  assert.deepEqual(embedded, pagePayload(data), 'в странице лежат не те данные, что отдаёт --data');

  /* Чего в файле нет — сказано кодом, а не комментарием. Список пропущенных
   * коммитов меняется от коммита самого отчёта, поэтому в файле его быть не может:
   * отчёт перестал бы быть неподвижной точкой, а хук коммитил бы его бесконечно
   * (проверка хука — `test/hook.test.js`). Наружу этот список по-прежнему идёт:
   * `--data` и `--json`. */
  assert.deepEqual(Object.keys(data).filter((key) => !(key in embedded)), ['skipped'],
    'из страницы пропало что-то, кроме объявленного в сборке (NOT_IN_FILE)');
});

test('страница считает то же, что артефакт, и пересчитывается по выбору', () => {
  const doc = openPage().window.document;
  const rows = doc.querySelectorAll('#grid tbody tr');
  assert.equal(rows.length, data.rows.length + 1,
    'в таблице ' + rows.length + ' строк вместо ' + (data.rows.length + 1) + ' (строки коммитов и «сейчас»)');

  assert.equal(rows[0].querySelectorAll('td').length, allCells(data), 'в строке «сейчас» не все колонки');
  const totalRaw = pageMath.totalsOf(data.now, ['raw'], allOn()).raw;
  assert.equal(nowTotal(doc), valueParts(totalRaw).text,
    'итог на странице не совпал с итогом артефакта: ' + nowTotal(doc));

  /* Выключаем метрику min: её колонки обязаны исчезнуть, а raw — остаться тем же. */
  const minBox = metricBox(doc);
  assert.notEqual(minBox, undefined, 'в панели нет переключателя метрики min');
  toggleBox(doc, minBox, false);

  const afterRows = doc.querySelectorAll('#grid tbody tr');
  assert.equal(afterRows.length, data.rows.length + 1, 'таблица перестала строиться');
  assert.equal(afterRows[0].querySelectorAll('td').length, data.files.length + 1,
    'выключенная метрика осталась в таблице');
  assert.equal(nowTotal(doc), valueParts(totalRaw).text, 'выключение метрики сдвинуло чужой итог');

  /* Выключаем файл: он уходит из таблицы, и итог уменьшается ровно на него. */
  const fileIndex = data.files.findIndex((f) => f.path === 'src/code.js');
  const box = fileBox(doc, 'src/code.js');
  assert.notEqual(box, undefined, 'в панели нет переключателя файла src/code.js');
  toggleBox(doc, box, false);

  assert.equal(nowCells(doc), data.files.length, 'выключенный файл остался в таблице');
  const expected = totalRaw - data.now[fileIndex].raw;
  assert.equal(nowTotal(doc), valueParts(expected).text,
    'итог после выключения файла не совпал с суммой без него');
});

/* Пометка точности на странице: приближённая клетка подчёркнута и объясняется
 * словами, точная — не тронута, а у итога знак — худшее из включённых в него
 * файлов (сумма не может обещать точность, которой нет у слагаемых). Знаки
 * страница берёт из данных движка, поэтому число помеченных клеток сверяется не с
 * разметкой, а с рядом пометок, который движок отдал. */
test('приближённые клетки помечены, а итог берёт худшее из включённых', () => {
  const doc = openPage().window.document;
  const ui = JSON.parse(doc.getElementById('ui').textContent);
  const metrics = data.metrics.length;
  const first = () => doc.querySelectorAll('#grid tbody tr')[0];
  const cellsOf = (tr) => [...tr.querySelectorAll('td')];
  /* Клетки строки: сперва итог по метрике, затем по блоку на файл, в каждом —
   * по метрике (тот же порядок, что в шапке таблицы). */
  const at = (tr, file, mi) => cellsOf(tr)[(file + 1) * metrics + mi];
  const total = (tr, mi) => cellsOf(tr)[mi];

  /* Знаки страницы — ровно знаки движка, клетка за клеткой, и знак итога —
   * по слагаемым. */
  data.metrics.forEach((m, mi) => {
    const marks = data.approx[m.key];
    const ones = marks === undefined ? 0 : (marks.now.match(/1/g) || []).length;
    let marked = 0;
    data.files.forEach((_f, i) => { if (at(first(), i, mi).classList.contains('approx')) marked++; });
    assert.equal(marked, ones,
      'метрика «' + m.key + '»: помечено ' + marked + ' клеток вместо ' + ones);
    assert.equal(total(first(), mi).classList.contains('approx'), ones > 0,
      'знак итога метрики «' + m.key + '» разошёлся с её слагаемыми');
  });

  /* Смешанная фикстура: точная клетка не помечена, приближённая помечена и
   * называет способ, которым число получено. */
  const md = data.files.findIndex((f) => f.label === 'заметки.md');
  const json = data.files.findIndex((f) => f.label === 'package.json');
  const minAt = data.metrics.findIndex((m) => m.key === 'min');
  const min = data.metrics[minAt];
  assert.equal(at(first(), json, minAt).classList.contains('approx'), false,
    'точная клетка помечена приближением');
  assert.equal(at(first(), md, minAt).classList.contains('approx'), true,
    'приближённая клетка не помечена: точность метрики до клетки не доехала');
  assert.equal(at(first(), md, minAt).title, ui.approxCell + min.method,
    'пометка клетки не называет способ, которым получено число');

  /* Способ и точность видны в панели текстом, а не только во всплывающей строке:
   * словарь и минификатор выбираются настройками запуска, и читателю нечем
   * переключить их на странице. */
  const about = [...doc.querySelectorAll('#panel .about')].map((p) => p.textContent);
  assert.equal(about.length, data.metrics.length, 'под метриками нет подписи способа');
  assert.ok(about.some((line) => line.indexOf(min.method) >= 0),
    'способ метрики min назван не тот: ' + about.join(' | '));
  const legend = [...doc.querySelectorAll('.legend li')].map((li) => li.textContent);
  assert.ok(legend.indexOf(ui.legend.find((l) => l.cls === 'approx').text) >= 0,
    'в легенде не сказано, что значит подчёркнутое число');

  /* Итог пересчитывается по выбору: оставим один точный файл — и знак с итога
   * снимется. Иначе «худшее из включённых» было бы сказано, но не сделано. */
  const box = (f) => fileBox(doc, f.path === null ? f.paths[0] : f.path);
  data.files.forEach((f, i) => { if (i !== json) toggleBox(doc, box(f), false); });
  assert.equal(total(first(), minAt).classList.contains('approx'), false,
    'итог остался приближённым, хотя все слагаемые точные');
  assert.equal(cellsOf(first()).filter((td) => td.classList.contains('approx')).length, 0,
    'с точными слагаемыми остались помеченные клетки');
});

const where = (f) => (f.path === null ? f.paths[0] : f.path);
const dirs = (doc) => [...doc.querySelectorAll('#panel .box.dir')];
const dirBox = (doc, prefix) => dirs(doc).find((b) => b.textContent.indexOf(prefix) === 0);
const dirInput = (doc, prefix) => dirBox(doc, prefix).querySelector('input');
const leaves = (doc) => [...doc.querySelectorAll('#panel .tree .box:not(.dir)')];

// Папки дерева — ровно те, что есть в путях файлов, и в дереве лежат все файлы.
function foldersMatchPaths(doc) {
  const expected = [...new Set(data.files.map((f) => where(f).split('/').slice(0, -1).join('/')))]
    .filter((d) => d !== '').sort();
  assert.deepEqual(dirs(doc).map((b) => b.textContent.replace(/\/\d+$/, '')).sort(), expected,
    'папки дерева разошлись с путями файлов');
  assert.equal(leaves(doc).length, data.files.length, 'в дереве не все файлы');
  data.files.forEach((f) => assert.ok(leaves(doc)
    .some((b) => b.querySelector('input').title.indexOf(where(f)) === 0),
  'в дереве нет файла ' + where(f)));
}

/* Три состояния папки: все её файлы включены — отметка; часть — третье
 * состояние; ни одного — папка просто не отмечена, но не выглядит частичной. */
function folderStates(doc) {
  const leafOf = (prefix) => dirBox(doc, prefix).closest('li').querySelector('.box:not(.dir) input');
  assert.equal(dirInput(doc, 'src/').checked, true, 'папка не отмечена вместе со своими файлами');
  toggleBox(doc, leafOf('src/'), false);
  assert.equal(dirInput(doc, 'src/').indeterminate, true,
    'папка с частью выключенных файлов не показала третье состояние');
  assert.equal(dirInput(doc, 'src/').checked, false, 'частично выключенная папка отмечена как целая');
  toggleBox(doc, dirInput(doc, 'src/'), true);
  assert.equal(dirInput(doc, 'src/').indeterminate, false, 'третье состояние осталось после включения всех файлов');

  assert.equal(dirInput(doc, 'notes/').checked, true, 'папка с единственным файлом не отмечена вместе с ним');
  toggleBox(doc, leafOf('notes/'), false);
  assert.equal(dirInput(doc, 'notes/').indeterminate, false,
    'папка без включённых файлов показана как частичная');
  assert.equal(dirInput(doc, 'notes/').checked, false, 'папка без включённых файлов осталась отмеченной');
  toggleBox(doc, dirInput(doc, 'notes/'), true);
  assert.equal(dirInput(doc, 'notes/').checked, true, 'включение папки не включило её файл');
}

/* Переключатель папки ведёт за собой всё поддерево: из таблицы и из итога
 * уходят ровно её файлы и их колонки. Быстрые кнопки категорий и дерево — одно
 * состояние: выключение категории видно на папке, где лежат её файлы, и не
 * трогает чужие. */
function subtreeAndCategories(doc) {
  const inSrc = [];
  data.files.forEach((f, i) => { if (where(f).indexOf('src/') === 0) inSrc.push(i); });
  assert.ok(inSrc.length > 1, 'в фикстуре нет папки с несколькими файлами');

  const all = allOn();
  const rawOf = (on) => pageMath.totalsOf(data.now, ['raw'], on).raw;
  assert.equal(dirBox(doc, 'src/').querySelector('.n').textContent, String(inSrc.length),
    'счётчик файлов у папки не тот');
  assert.equal(nowTotal(doc), valueParts(rawOf(all)).text, 'итог до выключения папки не тот');
  toggleBox(doc, dirInput(doc, 'src/'), false);
  const off = all.map((_on, i) => inSrc.indexOf(i) < 0);
  assert.equal(nowTotal(doc), valueParts(rawOf(off)).text, 'выключение папки не убрало её файлы из итога');
  assert.equal(nowCells(doc), (off.filter(Boolean).length + 1) * data.metrics.length,
    'выключение папки не убрало её колонки');

  const chore = [...doc.querySelectorAll('#panel .row .box.all')]
    .find((b) => b.textContent === data.categories.find((c) => c.key === 'chore').label);
  assert.notEqual(chore, undefined, 'в панели нет быстрой кнопки категории');
  toggleBox(doc, chore.querySelector('input'), false);
  assert.equal(dirInput(doc, 'data/').checked, false,
    'выключение категории не отразилось на папке с её файлами');
  assert.equal(dirInput(doc, 'docs/').checked, true, 'выключение категории выключило чужие файлы');
  toggleBox(doc, chore.querySelector('input'), true);
  assert.equal(dirInput(doc, 'data/').checked, true, 'включение категории не вернуло её файлы');
}

test('дерево файлов: папки по путям, три состояния и всё поддерево', () => {
  const doc = openPage().window.document;
  foldersMatchPaths(doc);
  folderStates(doc);
  subtreeAndCategories(doc);
});

/* Оформление: общая часть таблицы у двух выводов одна, и цвет дельт задан один раз.
 * Проверяется по файлам и по собранной странице, а не на слово: второй набор стилей
 * или второй цвет дельт — это ровно то, из-за чего два отчёта одной истории
 * расходятся на вид. */
test('оформление таблицы одно на оба вывода, и цвет дельт задан в одном месте', () => {
  assert.ok(pageText.indexOf(TABLE_CSS) > 0, 'страница не несёт общую часть оформления дословно');
  assert.equal(pageText.indexOf(TABLE_CSS), pageText.lastIndexOf(TABLE_CSS),
    'общая часть оформления вклеена в страницу дважды');
  assert.ok(pageText.indexOf(PAGE_CSS) > 0, 'страница собрана не из своего оформления');

  /* Своё оформление страницы обязано не заводить правил для того, что уже задано
   * общей частью, — иначе это второй набор той же таблицы. Список общих селекторов
   * берётся из самой общей части, а не переписывается сюда: правило, добавленное
   * там, стережётся здесь же. Исключение — адаптации под узкое окно: там
   * расхождение осознанное (общая часть заморожена байтами артефакта), и оно должно
   * быть внутри `@media`, поэтому блоки `@media` из сверки выпадают. */
  const own = fs.readFileSync(path.join(ROOT, 'src', 'page', 'app.css'), 'utf8')
    .replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
  const heads = (css) => [...css.matchAll(/(?:^|\})\s*([^{}@]+)\{/g)].map((m) => m[1].trim());
  const clash = heads(own).filter((head) => heads(TABLE_CSS).indexOf(head) >= 0);
  assert.deepEqual(clash, [],
    'своё оформление страницы повторило правила общей части: ' + clash.join(' | '));

  // Цвет дельт: пара значений живёт в общей части, а больше цветов в стилях нет.
  const hex = (text) => [...text.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
  assert.deepEqual([...new Set(hex(TABLE_CSS))].sort(), ['#1e8449', '#c0392b'],
    'соглашение о цвете дельт изменилось — его надо записать заново (src/css.js)');
  assert.deepEqual(hex(PAGE_CSS), [],
    'оформление страницы завело свой цвет: цвет дельт должен быть один на пакет');
  hex(TABLE_CSS).forEach((color) => assert.equal(pageText.split(color).length - 1, 1,
    'цвет ' + color + ' встречается в странице не один раз: он уехал из общей части'));
});

/* Состояния пустоты: без метрик таблицу не из чего собрать — страница говорит об
 * этом словами, а не сеткой без колонок; без файлов остаётся общий объём, и это
 * тоже сказано. Ни в одном из состояний не должно остаться `colspan="0"`. */
test('состояния пустоты: без метрик — слова вместо сетки, без файлов — только общий объём', () => {
  const doc = openPage().window.document;
  const ui = JSON.parse(doc.getElementById('ui').textContent);
  const inputs = panelInputs(doc);
  const metricsOn = [...doc.querySelectorAll('#panel .box.metric input')];

  metricsOn.forEach((b) => toggleBox(doc, b, false));
  assert.equal(doc.getElementById('state').hidden, false,
    'без метрик страница молчит вместо того, чтобы объяснить пустоту');
  assert.equal(doc.getElementById('state').textContent, ui.empty, 'объяснение пустоты не то');
  assert.equal(doc.getElementById('shell').hidden, true, 'сетка без метрик осталась на виду');
  assert.equal(doc.querySelectorAll('#grid tbody tr').length, 0, 'таблица без метрик всё ещё строится');
  assert.equal(doc.querySelectorAll('[colspan="0"]').length, 0, 'в разметке остался colspan="0"');

  metricsOn.forEach((b) => toggleBox(doc, b, true));
  inputs.filter((b) => metricsOn.indexOf(b) < 0).forEach((b) => toggleBox(doc, b, false));
  assert.equal(doc.getElementById('shell').hidden, false, 'сетка пропала, хотя метрики выбраны');
  assert.equal(doc.getElementById('state').textContent, ui.noFiles, 'про пустой выбор файлов не сказано');
  const onlyTotal = doc.querySelectorAll('#grid tbody tr');
  assert.equal(onlyTotal.length, data.rows.length + 1, 'без файлов таблица перестала строиться');
  assert.equal(onlyTotal[0].querySelectorAll('td').length, data.metrics.length,
    'с выключенными файлами в строке остались чужие колонки');
  assert.equal(doc.querySelectorAll('[colspan="0"]').length, 0, 'в разметке остался colspan="0"');
});

/* Переключатели панели глазами клавиатуры: поле ввода лежит внутри метки (одна цель
 * для мыши и для клавиатуры) и достижимо с Tab, а полная пересборка панели не
 * отбирает фокус — иначе каждое переключение начиналось бы с обхода панели заново. */
test('переключатели панели: одна цель нажатия и фокус, который не теряется', () => {
  const doc = openPage().window.document;
  const inputs = () => panelInputs(doc);
  const first = inputs();

  first.forEach((b) => {
    const label = b.closest('label');
    assert.ok(label && label.querySelector('input') === b,
      'переключатель вне метки: подпись и поле — две разные цели нажатия');
    assert.equal(b.tabIndex, 0, 'переключатель недостижим с клавиатуры');
  });

  inputs()[2].focus();
  assert.equal(doc.activeElement, inputs()[2], 'фокус не встал на переключатель');
  toggleBox(doc, inputs()[2], false);
  assert.equal(inputs().length, first.length, 'пересборка панели изменила набор переключателей');
  assert.equal(doc.activeElement, inputs()[2],
    'после пересборки панели фокус потерян: клавиатура начинает обход заново');
});

/* Контракт данных: движок отдаёт абсолютные значения и устройство таблицы, а всё
 * производное — дельты, суммы, «сейчас» и фильтры — считает страница. Проверяется
 * это на настоящем выводе, а не описанием:
 *
 *   1. числа контракта сверяются с замороженным эталоном паритета (той же снятой
 *      ревизией) — контракт обязан нести ту же правду, что и артефакт;
 *   2. в контракте нет ни одной производной величины (проверяется по составу
 *      полей, а не на слово);
 *   3. вычислительная часть страницы (`src/derived.js` — тот же код, которым
 *      считает артефакт) прогоняется и её итоги сверяются с итогами артефакта, а
 *      сумма дельт по колонке — с текущим размером; оболочка страницы при этом не
 *      имеет права заводить свои функции расчёта;
 *   4. страница собирается и работает в настоящем DOM (jsdom): включение метрик,
 *      категорий, файлов и папок дерева пересчитывает таблицу без обращения к движку;
 *   5. оформление таблицы у двух выводов одно, и цвет дельт задан один раз;
 *   6. состояния пустоты (сняты все метрики или все файлы) объясняются словами.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { CATEGORY_ORDER, pageScript, rowModel, stripModules, totalsOf, valueParts } from '../src/size-table.js';
import { ARTIFACT_CSS, PAGE_CSS, TABLE_CSS } from '../src/css.js';
import { ROOT, SYNTH, cloneFixture, runFixture, tempDir } from '../tools/harness.js';

const goldenText = fs.readFileSync(path.join(SYNTH, 'golden.json'), 'utf8');
const golden = JSON.parse(goldenText);

const tmp = tempDir('contract');
let clones = 0;
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function clone(name) {
  return cloneFixture(path.join(tmp, 'fixture-' + (clones++) + '-' + name));
}



/* Программа страницы собирается из исходников на диске: общий расчёт
 * (`src/derived.js`) и оболочка (`src/page/app.js`). Проверки ниже читают те же
 * файлы, чтобы сверять вклеенное в страницу с тем, что лежит в репозитории, а не
 * с тем, что движок сказал про себя. */
const DERIVED_FILE = path.join(ROOT, 'src', 'derived.js');
const APP_FILE = path.join(ROOT, 'src', 'page', 'app.js');
const derivedSrc = fs.readFileSync(DERIVED_FILE, 'utf8');
const appSrc = fs.readFileSync(APP_FILE, 'utf8');

// Вычислительная часть — тот же код, что исполняет страница.
const pageMath = new Function(stripModules(derivedSrc)
  + '\nreturn { rowModel: rowModel, totalsOf: totalsOf };')();

// Ключи включённых метрик — то, что вычислительная часть принимает на вход.
function keysOn(view) {
  return data.metrics.filter((m) => view.metrics[m.key]).map((m) => m.key);
}

/* Контракт снимается один раз на весь набор: он зависит только от фикстуры и
 * настроек, а их одинаковость у разных клонов отдельно проверяет воспроизводимость. */
const dir = clone('numbers');
const dataRun = runFixture(dir, ['--data']);
assert.equal(dataRun.code, 0, 'инструмент не отдал --data (код ' + dataRun.code + '): ' + dataRun.stderr.trim());
const data = JSON.parse(dataRun.stdout);
const allOn = () => data.files.map(() => true);
const allMetrics = { raw: true, min: true };

/* ---------- контракт ---------- */

test('контракт воспроизводим: два прогона дают те же байты', () => {
  assert.equal(runFixture(clone('repro'), ['--data']).stdout, dataRun.stdout,
    'данные зависят от запуска: в отчёте появятся «плавающие» значения');
});

test('контракт несёт ту же правду, что замороженный эталон', () => {
  assert.equal(data.schema, 1, 'схема данных не объявлена');
  assert.equal(data.tool.name, 'size-report');
  assert.deepEqual(data.metrics.map((m) => m.key), golden.metrics,
    'состав метрик разошёлся с эталоном');
  assert.equal(data.files.length, golden.columns.length, 'число файлов разошлось с эталоном');
  assert.equal(data.rows.length, golden.rows.length, 'число строк разошлось с эталоном');
  assert.deepEqual(data.skipped, golden.skipped, 'причины пропусков разошлись с эталоном');

  data.files.forEach((f, i) => {
    assert.equal(f.label, golden.columns[i].label, 'метка файла разошлась с эталоном');
    assert.deepEqual(f.paths, golden.columns[i].paths, 'пути файла разошлись с эталоном');
  });

  data.rows.forEach((row, r) => {
    assert.equal(row.sha, golden.rows[r].sha, 'строка ' + (r + 1) + ': sha разошёлся');
    assert.deepEqual(row.values, golden.rows[r].cells,
      'строка ' + (r + 1) + ': абсолютные значения разошлись с эталоном');
  });

  // «Сейчас» — те же абсолютные значения, на которых стоят дельты артефакта.
  const last = golden.rows[golden.rows.length - 1].cells;
  assert.deepEqual(data.now, last, 'текущие значения разошлись с последней строкой эталона');
});

test('в контракте нет ни одной производной величины', () => {
  const rowKeys = ['sha', 'when', 'subject', 'section', 'href', 'values'];
  const fileKeys = ['label', 'path', 'paths', 'category', 'categoryBy'];
  data.rows.forEach((row, r) => {
    assert.deepEqual(Object.keys(row).sort(), rowKeys.slice().sort(),
      'строка ' + (r + 1) + ': в данных появилось поле помимо абсолютных значений');
  });
  data.files.forEach((f, i) => {
    assert.deepEqual(Object.keys(f).sort(), fileKeys.slice().sort(),
      'файл ' + (i + 1) + ': состав полей разошёлся с контрактом');
  });
  assert.equal(Object.prototype.hasOwnProperty.call(data, 'totals'), false,
    'движок посчитал итоги — это дело страницы: она одна знает, что включено');
});

test('метрика, которая не минификация, помечена приближением', () => {
  data.metrics.forEach((m) => {
    assert.ok(m.label && m.note && m.method, 'метрика «' + m.key + '» без описания способа');
    assert.ok(['exact', 'approximate'].indexOf(m.accuracy) >= 0, 'у метрики «' + m.key + '» нет честности');
  });
  const min = data.metrics.find((m) => m.key === 'min');
  assert.equal(min.accuracy, 'approximate',
    'снятие комментариев выдаётся за минификацию: у метрики нет пометки приближения');
});

test('у каждого файла есть категория, и она объявлена в данных', () => {
  const declared = data.categories.map((c) => c.key);
  data.categories.forEach((c) => assert.ok(c.label, 'категория «' + c.key + '» без подписи'));
  assert.deepEqual(declared, CATEGORY_ORDER.filter((k) => declared.indexOf(k) >= 0),
    'категории идут не в объявленном порядке');
  data.files.forEach((f) => {
    assert.ok(declared.indexOf(f.category) >= 0, 'файл ' + f.path + ': категория не объявлена');
    assert.ok(['auto', 'config'].indexOf(f.categoryBy) >= 0,
      'файл ' + f.path + ': не сказано, откуда взялась категория');
  });
  assert.ok(data.files.some((f) => f.category === 'docs'), 'в фикстуре есть документация');
  assert.ok(data.files.some((f) => f.category === 'code'), 'в фикстуре есть код');
});

/* ---------- производные считает страница ---------- */

test('итоги страницы сходятся с итогами артефакта', () => {
  const metrics = keysOn({ metrics: allMetrics });
  const on = allOn();
  data.rows.forEach((row, r) => {
    assert.deepEqual(pageMath.totalsOf(row.values, metrics, on), golden.rows[r].totals,
      'строка ' + (r + 1) + ': итог по контракту не совпал с итогом артефакта');
  });
});

/* Дельты сходятся с текущим размером — но не для любого файла: у удалённого и
 * возвращённого в колонке две клетки роста (первое появление и возврат), а
 * «сейчас» — один размер, поэтому сумма больше. Такие колонки названы поимённо
 * (`GAPS`), чтобы правило нельзя было поменять молча; почему так и что с этим
 * делать — в `BLOCKERS.md` §N4. */
const GAPS = ['crlf.txt'];

// Строки таблицы в терминах вычислительной части: то же, из чего рисуется отчёт.
const models = data.rows.map((row, r) => rowModel(row.values, r === 0 ? null : data.rows[r - 1].values,
  keysOn({ metrics: allMetrics }), allOn()));

test('сумма дельт по колонке сходится с текущим размером, если файл не исчезал', () => {
  const metrics = keysOn({ metrics: allMetrics });
  const found = [];
  data.files.forEach((f, i) => {
    let deleted = false;
    data.rows.forEach((row, r) => {
      if (r > 0 && data.rows[r - 1].values[i] !== null && row.values[i] === null) deleted = true;
    });
    if (deleted) { found.push(f.label); return; }
    metrics.forEach((m, mi) => {
      let sum = 0;
      models.forEach((model) => { sum += model.files[i][mi].delta || 0; });
      assert.equal(sum, data.now[i] === null ? 0 : data.now[i][m],
        'колонка «' + f.label + '»/' + m + ': дельты не сходятся с текущим размером');
    });
  });
  assert.deepEqual(found, GAPS,
    'состав колонок с возвратом файла изменился: правило дельт придётся пересмотреть');
});

test('у возвращённого файла сумма дельт больше текущего размера — и это записано', () => {
  GAPS.forEach((label) => {
    const i = data.files.findIndex((f) => f.label === label);
    let sum = 0;
    models.forEach((model) => { sum += model.files[i][0].delta || 0; });
    assert.equal(sum, 117, 'сумма дельт колонки «' + label + '» изменилась');
    assert.equal(data.now[i].raw, 63, 'текущий размер колонки «' + label + '» изменился');
    assert.ok(sum > data.now[i].raw, 'возврат файла обязан выглядеть как рост');
  });
});

/* Итог по строке — тоже производная, и его дельта обязана быть суммой дельт по
 * включённым файлам. Одно исключение — исчезнувший файл: в его клетке «—» (дельты
 * нет), а из итога его объём уходит. Поэтому на такой строке сверяется само
 * правило: дельта итога = сумма дельт минус объём исчезнувшего (BLOCKERS.md §N4). */
test('дельта итога равна сумме дельт по файлам', () => {
  const metrics = keysOn({ metrics: allMetrics });
  const on = allOn();
  const withGone = [];
  data.rows.forEach((row, r) => {
    const prev = r === 0 ? null : data.rows[r - 1];
    const model = models[r];
    const gone = {};
    metrics.forEach((m) => { gone[m] = 0; });
    let vanished = false;
    data.files.forEach((_f, i) => {
      if (!on[i] || prev === null || prev.values[i] === null || row.values[i] !== null) return;
      vanished = true;
      metrics.forEach((m) => { gone[m] += prev.values[i][m]; });
    });
    if (vanished) withGone.push(row.subject);
    metrics.forEach((m, mi) => {
      let sum = 0;
      model.files.forEach((cells) => { sum += cells[mi].delta || 0; });
      sum -= gone[m];
      assert.equal(model.total[mi].delta, sum,
        'строка ' + (r + 1) + '/' + m + ': дельта итога разошлась с суммой дельт по файлам');
    });
  });
  assert.deepEqual(withGone, ['fixture: удаление файла'],
    'исчезновение файла изменило состав строк: правило дельты итога придётся пересмотреть');
});

test('выключенное не участвует ни в таблице, ни в сумме', () => {
  const metrics = keysOn({ metrics: { raw: true, min: false } });
  const on = allOn();
  on[0] = false;
  assert.deepEqual(metrics, ['raw'], 'выключенная метрика осталась в выборке');

  const totals = totalsOf(data.now, metrics, on);
  let expected = 0;
  data.files.forEach((f, i) => {
    if (!on[i] || data.now[i] === null) return;
    expected += data.now[i].raw;
  });
  assert.equal(totals.raw, expected, 'итог считает выключенные файлы');
  assert.equal(rowModel(data.now, null, metrics, on).files.length, data.files.length - 1,
    'выключенный файл остался в таблице');
  assert.notEqual(totals.raw, totalsOf(data.now, metrics, allOn()).raw,
    'выключение файла ничего не изменило: сумма не зависит от выбора');
});

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
   * второе лучше не делать вовсе. */
  assert.deepEqual(defined('\n' + appSrc).sort(), [
    'appBox', 'appCell', 'appCommit', 'appEl', 'appFileBox', 'appIndexes', 'appLegend', 'appPanel',
    'appRender', 'appState', 'appSubHead', 'appTable', 'appTree', 'appTreeList', 'appValueCell'
  ], 'оболочка страницы завела свою функцию: расчёт должен жить в вычислительной части');
  assert.equal(/\breduce\(|Math\.abs/.test(appSrc), false,
    'оболочка страницы считает итоги или знак дельты сама');
  ['rowModel', 'nowModel', 'commitParts', 'cellParts', 'valueParts'].forEach((name) => {
    assert.ok(appSrc.indexOf(name + '(') >= 0, 'оболочка страницы не пользуется ' + name);
  });
});

/* ---------- страница ---------- */

/* Сборка страницы — один прогон на весь набор: страница зависит только от данных
 * и настроек, а они здесь одни и те же (совпадение данных у двух клонов уже
 * проверено выше, в проверке воспроизводимости). */
const pageDir = clone('page');
const pageRun = runFixture(pageDir, ['--page']);

function pageHtml() {
  assert.equal(pageRun.code, 0, 'инструмент не собрал страницу: ' + pageRun.stderr.trim());
  const file = path.join(pageDir, 'docs', 'size-report.html');
  assert.ok(fs.existsSync(file), 'страница не появилась рядом с таблицей');
  return fs.readFileSync(file, 'utf8');
}

const pageText = pageHtml();

test('страница самодостаточна и несёт данные контракта', () => {
  assert.equal(pageRun.code, 0, 'сборка страницы не отчиталась: ' + pageRun.stderr.trim());
  assert.equal(/https?:\/\//.test(pageText), false,
    'в странице есть внешняя ссылка: без сети она не откроется');
  assert.equal(/<link|<img|src=/.test(pageText), false, 'страница тянет что-то со стороны');

  /* Один файл и три тега: два с данными и программа. Программа вклеена ровно
   * так, как её отдаёт движок, и без модульного синтаксиса: страница открывается
   * с диска, а не с сервера, и разрешать `import` там нечем. */
  assert.equal((pageText.match(/<script/g) || []).length, 3,
    'в странице не три тега script: вклейка изменилась, и файлов могло стать больше одного');
  assert.ok(pageText.indexOf('<script>\n' + pageScript() + '</script>') > 0,
    'программа страницы вклеена не целиком или не тем текстом, который отдаёт движок');
  assert.equal(/type="module"/.test(pageText), false, 'программа страницы объявлена модулем');

  const dom = new JSDOM(pageText);
  const embedded = JSON.parse(dom.window.document.getElementById('data').textContent);
  assert.deepEqual(embedded, data, 'в странице лежат не те данные, что отдаёт --data');
});

test('страница считает то же, что артефакт, и пересчитывается по выбору', () => {
  const dom = new JSDOM(pageText, { runScripts: 'dangerously' });
  const doc = dom.window.document;
  const rows = doc.querySelectorAll('#grid tbody tr');
  assert.equal(rows.length, data.rows.length + 1,
    'в таблице ' + rows.length + ' строк вместо ' + (data.rows.length + 1) + ' (строки коммитов и «сейчас»)');

  const nowCells = rows[0].querySelectorAll('td');
  const metricsCount = data.metrics.length;
  assert.equal(nowCells.length, (data.files.length + 1) * metricsCount,
    'в строке «сейчас» не все колонки');
  const totalRaw = pageMath.totalsOf(data.now, ['raw'], allOn()).raw;
  assert.equal(nowCells[0].textContent, valueParts(totalRaw).text,
    'итог на странице не совпал с итогом артефакта: ' + nowCells[0].textContent);

  /* Выключаем метрику min: её колонки обязаны исчезнуть, а raw — остаться тем же. */
  const boxes = doc.querySelectorAll('#panel input');
  const minBox = Array.prototype.find.call(boxes, (b) => b.title.indexOf('не минификация') >= 0);
  assert.ok(minBox, 'в панели нет переключателя метрики min');
  minBox.checked = false;
  minBox.dispatchEvent(new dom.window.Event('change'));

  const afterRows = doc.querySelectorAll('#grid tbody tr');
  assert.equal(afterRows.length, data.rows.length + 1, 'таблица перестала строиться');
  const afterNow = afterRows[0].querySelectorAll('td');
  assert.equal(afterNow.length, data.files.length + 1,
    'выключенная метрика осталась в таблице');
  assert.equal(afterNow[0].textContent, valueParts(totalRaw).text,
    'выключение метрики сдвинуло чужой итог');

  /* Выключаем файл: он уходит из таблицы, и итог уменьшается ровно на него. */
  const fileIndex = data.files.findIndex((f) => f.path === 'src/code.js');
  const fileBox = Array.prototype.find.call(boxes, (b) => b.title.indexOf('src/code.js') === 0);
  assert.ok(fileBox, 'в панели нет переключателя файла src/code.js');
  fileBox.checked = false;
  fileBox.dispatchEvent(new dom.window.Event('change'));

  const lastNow = doc.querySelectorAll('#grid tbody tr')[0].querySelectorAll('td');
  assert.equal(lastNow.length, data.files.length, 'выключенный файл остался в таблице');
  const expected = totalRaw - data.now[fileIndex].raw;
  assert.equal(lastNow[0].textContent, valueParts(expected).text,
    'итог после выключения файла не совпал с суммой без него');
});

/* Дерево файлов: папки повторяют пути данных, у папки три состояния, а её
 * переключатель ведёт за собой всё поддерево. Состояние хранят только файлы —
 * поэтому дерево, быстрые кнопки категорий и числа таблицы не могут разойтись:
 * проверяется это по итогу таблицы, а не по разметке. */
test('дерево файлов: папки по путям, три состояния и всё поддерево', () => {
  const dom = new JSDOM(pageText, { runScripts: 'dangerously' });
  const doc = dom.window.document;
  const where = (f) => (f.path === null ? f.paths[0] : f.path);
  const dirs = () => [...doc.querySelectorAll('#panel .box.dir')];
  const dirBox = (prefix) => dirs().find((b) => b.textContent.indexOf(prefix) === 0);
  const leaves = () => [...doc.querySelectorAll('#panel .tree .box:not(.dir)')];
  const toggle = (box, checked) => {
    box.checked = checked;
    box.dispatchEvent(new dom.window.Event('change'));
  };
  const nowTotal = () => doc.querySelectorAll('#grid tbody tr')[0]
    .querySelectorAll('td')[0].textContent;
  const all = allOn();
  const rawOf = (on) => pageMath.totalsOf(data.now, ['raw'], on).raw;

  /* Папки дерева — ровно те, что есть в путях файлов, и в дереве лежат все файлы,
   * каждый под своим путём. */
  const expected = [...new Set(data.files.map((f) => where(f).split('/').slice(0, -1).join('/')))]
    .filter((d) => d !== '').sort();
  assert.deepEqual(dirs().map((b) => b.textContent.replace(/\/\d+$/, '')).sort(), expected,
    'папки дерева разошлись с путями файлов');
  assert.equal(leaves().length, data.files.length, 'в дереве не все файлы');
  data.files.forEach((f) => assert.ok(leaves()
    .some((b) => b.querySelector('input').title.indexOf(where(f)) === 0),
  'в дереве нет файла ' + where(f)));

  const inSrc = [];
  data.files.forEach((f, i) => { if (where(f).indexOf('src/') === 0) inSrc.push(i); });
  assert.ok(inSrc.length > 1, 'в фикстуре нет папки с несколькими файлами');

  /* Три состояния папки: все её файлы включены — отметка; часть — третье
   * состояние; ни одного — папка просто не отмечена, но не выглядит частичной. */
  const srcBox = () => dirBox('src/').querySelector('input');
  assert.equal(srcBox().checked, true, 'папка не отмечена вместе со своими файлами');
  toggle(dirBox('src/').closest('li').querySelector('.box:not(.dir) input'), false);
  assert.equal(srcBox().indeterminate, true,
    'папка с частью выключенных файлов не показала третье состояние');
  assert.equal(srcBox().checked, false, 'частично выключенная папка отмечена как целая');
  toggle(srcBox(), true);
  assert.equal(srcBox().indeterminate, false, 'третье состояние осталось после включения всех файлов');

  assert.equal(dirBox('notes/').querySelector('input').checked, true,
    'папка с единственным файлом не отмечена вместе с ним');
  toggle(dirBox('notes/').closest('li').querySelector('.box:not(.dir) input'), false);
  assert.equal(dirBox('notes/').querySelector('input').indeterminate, false,
    'папка без включённых файлов показана как частичная');
  assert.equal(dirBox('notes/').querySelector('input').checked, false,
    'папка без включённых файлов осталась отмеченной');
  toggle(dirBox('notes/').querySelector('input'), true);
  assert.equal(dirBox('notes/').querySelector('input').checked, true,
    'включение папки не включило её файл');

  /* Переключатель папки ведёт за собой всё поддерево: из таблицы и из итога
   * уходят ровно её файлы и их колонки. */
  assert.equal(dirBox('src/').querySelector('.n').textContent, String(inSrc.length),
    'счётчик файлов у папки не тот');
  assert.equal(nowTotal(), valueParts(rawOf(all)).text, 'итог до выключения папки не тот');
  toggle(dirBox('src/').querySelector('input'), false);
  const off = all.map((_on, i) => inSrc.indexOf(i) < 0);
  assert.equal(nowTotal(), valueParts(rawOf(off)).text, 'выключение папки не убрало её файлы из итога');
  assert.equal(doc.querySelectorAll('#grid tbody tr')[0].querySelectorAll('td').length,
    (off.filter(Boolean).length + 1) * data.metrics.length, 'выключение папки не убрало её колонки');

  /* Быстрые кнопки категорий и дерево — одно состояние: выключение категории
   * видно на папке, где лежат её файлы, и не трогает чужие. */
  const chore = [...doc.querySelectorAll('#panel .row .box.all')]
    .find((b) => b.textContent === data.categories.find((c) => c.key === 'chore').label);
  assert.ok(chore, 'в панели нет быстрой кнопки категории');
  toggle(chore.querySelector('input'), false);
  assert.equal(dirBox('data/').querySelector('input').checked, false,
    'выключение категории не отразилось на папке с её файлами');
  assert.equal(dirBox('docs/').querySelector('input').checked, true,
    'выключение категории выключило чужие файлы');
  toggle(chore.querySelector('input'), true);
  assert.equal(dirBox('data/').querySelector('input').checked, true,
    'включение категории не вернуло её файлы');
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
  assert.deepEqual(hex(ARTIFACT_CSS + PAGE_CSS), [],
    'оформление артефакта или страницы завело свой цвет: цвет дельт должен быть один на пакет');
  hex(TABLE_CSS).forEach((color) => assert.equal(pageText.split(color).length - 1, 1,
    'цвет ' + color + ' встречается в странице не один раз: он уехал из общей части'));
});

/* Состояния пустоты: без метрик таблицу не из чего собрать — страница говорит об
 * этом словами, а не сеткой без колонок; без файлов остаётся общий объём, и это
 * тоже сказано. Ни в одном из состояний не должно остаться `colspan="0"`. */
test('состояния пустоты: без метрик — слова вместо сетки, без файлов — только общий объём', () => {
  const dom = new JSDOM(pageText, { runScripts: 'dangerously' });
  const doc = dom.window.document;
  const ui = JSON.parse(doc.getElementById('ui').textContent);
  const inputs = [...doc.querySelectorAll('#panel input')];
  const isMetric = (b) => b.title.indexOf('· способ:') >= 0;
  const toggle = (b, checked) => {
    b.checked = checked;
    b.dispatchEvent(new dom.window.Event('change'));
  };

  inputs.filter(isMetric).forEach((b) => toggle(b, false));
  assert.equal(doc.getElementById('state').hidden, false,
    'без метрик страница молчит вместо того, чтобы объяснить пустоту');
  assert.equal(doc.getElementById('state').textContent, ui.empty, 'объяснение пустоты не то');
  assert.equal(doc.getElementById('shell').hidden, true, 'сетка без метрик осталась на виду');
  assert.equal(doc.querySelectorAll('#grid tbody tr').length, 0, 'таблица без метрик всё ещё строится');
  assert.equal(doc.querySelectorAll('[colspan="0"]').length, 0, 'в разметке остался colspan="0"');

  inputs.filter(isMetric).forEach((b) => toggle(b, true));
  inputs.filter((b) => !isMetric(b)).forEach((b) => toggle(b, false));
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
  const dom = new JSDOM(pageText, { runScripts: 'dangerously' });
  const doc = dom.window.document;
  const inputs = () => [...doc.querySelectorAll('#panel input')];
  const first = inputs();

  first.forEach((b) => {
    const label = b.closest('label');
    assert.ok(label && label.querySelector('input') === b,
      'переключатель вне метки: подпись и поле — две разные цели нажатия');
    assert.equal(b.tabIndex, 0, 'переключатель недостижим с клавиатуры');
  });

  inputs()[2].focus();
  assert.equal(doc.activeElement, inputs()[2], 'фокус не встал на переключатель');
  inputs()[2].checked = false;
  inputs()[2].dispatchEvent(new dom.window.Event('change'));
  assert.equal(inputs().length, first.length, 'пересборка панели изменила набор переключателей');
  assert.equal(doc.activeElement, inputs()[2],
    'после пересборки панели фокус потерян: клавиатура начинает обход заново');
});

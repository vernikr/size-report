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
 *   6. состояния пустоты (сняты все метрики или все файлы) объясняются словами;
 *   7. выбор читателя переживает перезаход, но не переезжает на чужой отчёт
 *      (другой паспорт, чужая версия записи, испорченная или неизвестное имя),
 *      а первый читатель видит умолчание.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { CATEGORY_ORDER, pageScript, rowModel, stripModules, totalsOf, valueParts } from '../src/size-table.js';
import { ARTIFACT_CSS, PAGE_CSS, TABLE_CSS } from '../src/css.js';
import { ROOT, SYNTH, cloneFixture, runFixture, tempDir } from '../tools/harness.js';
import { TOOL_PKG } from '../src/tool.js';

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
  assert.equal(data.tool.name, TOOL_PKG.name, 'имя инструмента в данных разошлось с манифестом');
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

/* Точность объявлена дважды, и это не два ответа на один вопрос: у метрики —
 * худшее в колонке, у клетки — её собственное число. Фикстура для этого и нужна
 * смешанная: в ней рядом стоят точный формат (`package.json` — JSON теряет
 * только незначащие пробелы) и приближённые (`.js`, `.md`, `.toml`, `.txt`).
 *
 * Проверяется согласие двух ответов, а не наличие поля: у метрики без единой
 * пометки не может стоять «приблизительно», а ряд пометок обязан покрывать ровно
 * все клетки — строки и «сейчас» порознь. */
test('точность объявлена по клетке, а подпись метрики — худшее в колонке', () => {
  data.metrics.forEach((m) => {
    const marks = data.approx[m.key];
    if (marks === undefined) {
      assert.equal(m.accuracy, 'exact',
        'метрика «' + m.key + '» обещает точность, не назвав ни одной приближённой клетки');
      return;
    }
    assert.equal(m.accuracy, 'approximate',
      'у метрики «' + m.key + '» есть приближённые клетки, а подпись обещает точность');
    assert.equal(marks.rows.length, data.rows.length * data.files.length,
      'ряд пометок не покрывает клетки строк');
    assert.equal(marks.now.length, data.files.length, 'ряд пометок не покрывает строку «сейчас»');
    assert.equal(/[^01]/.test(marks.rows + marks.now), false,
      'в пометках есть знак кроме «точное/приближённое»: ' + marks.rows.slice(0, 40));
  });

  /* Смешанность отчёта — то, ради чего этот ряд и заведён: если бы все клетки
   * были одного знака, пометка по клетке ничего не добавляла бы к подписи. */
  const min = (data.approx || {}).min;
  assert.ok(min, 'в контракте нет пометок приближённых клеток');
  const json = data.files.findIndex((f) => f.label === 'package.json');
  const md = data.files.findIndex((f) => f.label === 'заметки.md');
  assert.equal(min.now.charAt(json), '0',
    'точный формат (JSON разбирается целиком) помечен приближением');
  assert.equal(min.now.charAt(md), '1', 'упрощение снято за точную минификацию');
  assert.ok(min.rows.indexOf('0') >= 0 && min.rows.indexOf('1') >= 0,
    'в отчёте нет клеток обоих знаков — проверять по клетке не на чем');
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
    'appAll', 'appApply', 'appApprox', 'appBox', 'appCell', 'appCellClass', 'appCommit', 'appEl', 'appFileAt', 'appFileBox',
    'appHash', 'appIndexes', 'appLegend', 'appLinkRead', 'appLinkUse', 'appNotice', 'appPanel',
    'appPassport', 'appRead', 'appRecord', 'appRecordOk', 'appRender', 'appState', 'appSubHead',
    'appTable', 'appTree', 'appTreeList', 'appUnknown', 'appValueCell', 'appWrite'
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

/* Страница с памятью: адрес даёт ей начало координат (без него jsdom, как и браузер
 * в приватном окне, памяти не даёт), а `beforeParse` кладёт в неё то, что «браузер
 * сохранил» с прошлого захода — так перезаход и проверяется. */
const PAGE_URL = 'https://report.invalid/size-report.html';
function openPage(seed, hash) {
  return new JSDOM(pageText, {
    url: PAGE_URL + (hash || ''),
    runScripts: 'dangerously',
    beforeParse(window) {
      Object.keys(seed || {}).forEach((key) => window.localStorage.setItem(key, seed[key]));
    }
  });
}

// Что «браузер» сохранил к этому моменту — то, что переживёт закрытие страницы.
function stored(dom) {
  const store = dom.window.localStorage;
  const out = {};
  for (let i = 0; i < store.length; i++) out[store.key(i)] = store.getItem(store.key(i));
  return out;
}

const panelInputs = (doc) => [...doc.querySelectorAll('#panel input')];
/* Переключатель метрики — по видимой подписи: она не зависит от того, какими
 * словами названы способ и точность. Что слова эти есть и что они совпадают с
 * клетками — отдельная проверка ниже. */
const metricBox = (doc) => [...doc.querySelectorAll('#panel .box.metric')]
  .find((b) => b.textContent === 'min').querySelector('input');
const fileBox = (doc, path) => panelInputs(doc).find((b) => b.title.indexOf(path) === 0);
const nowTotalCell = (doc) => doc.querySelectorAll('#grid tbody tr')[0].querySelectorAll('td')[0].textContent;
const nowCells = (doc) => doc.querySelectorAll('#grid tbody tr')[0].querySelectorAll('td').length;
const allCells = () => (data.files.length + 1) * data.metrics.length;

// Ссылка на выбор в том же виде, в каком её носит адрес: наш формат, а не пересказ.
const linkTo = (rec) => '#size-report=' + encodeURIComponent(JSON.stringify(rec));
function toggleCheck(doc, box, checked) {
  box.checked = checked;
  box.dispatchEvent(new doc.defaultView.Event('change'));
}

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
  const minBox = metricBox(doc);
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

/* Пометка точности на странице: приближённая клетка подчёркнута и объясняется
 * словами, точная — не тронута, а у итога знак — худшее из включённых в него
 * файлов (сумма не может обещать точность, которой нет у слагаемых). Знаки
 * страница берёт из данных движка, поэтому число помеченных клеток сверяется не с
 * разметкой, а с рядом пометок, который движок отдал. */
test('приближённые клетки помечены, а итог берёт худшее из включённых', () => {
  const dom = new JSDOM(pageText, { runScripts: 'dangerously' });
  const doc = dom.window.document;
  const ui = JSON.parse(doc.getElementById('ui').textContent);
  const metrics = data.metrics.length;
  const first = () => doc.querySelectorAll('#grid tbody tr')[0];
  const cellsOf = (tr) => [...tr.querySelectorAll('td')];
  /* Клетки строки: сперва итог по метрике, затем по блоку на файл, в каждом —
   * по метрике (тот же порядок, что в шапке таблицы). */
  const at = (tr, file, mi) => cellsOf(tr)[(file + 1) * metrics + mi];
  const total = (tr, mi) => cellsOf(tr)[mi];
  const where = (f) => (f.path === null ? f.paths[0] : f.path);

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
  data.files.forEach((f, i) => { if (i !== json) toggleCheck(doc, fileBox(doc, where(f)), false); });
  assert.equal(total(first(), minAt).classList.contains('approx'), false,
    'итог остался приближённым, хотя все слагаемые точные');
  assert.equal(cellsOf(first()).filter((td) => td.classList.contains('approx')).length, 0,
    'с точными слагаемыми остались помеченные клетки');
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

/* Память выбора: страница помнит, что читатель выключил, и возвращает его при
 * следующем открытии — тем же набором колонок и теми же числами. Проверяется
 * перезаходом: вторая страница получает ту память, которую записала первая. */
test('память выбора: перезаход возвращает тот же выбор и те же числа', () => {
  const first = openPage();
  const doc = first.window.document;

  /* Первый читатель: всё включено, и памяти о нём ещё нет. */
  assert.deepEqual(stored(first), {}, 'первый заход оставил запись о выборе, которого не было');
  assert.equal(nowCells(doc), allCells(), 'умолчание не всё включено');

  toggleCheck(doc, metricBox(doc), false);
  toggleCheck(doc, fileBox(doc, 'src/code.js'), false);
  const off = data.files.map((f) => f.path !== 'src/code.js');
  const total = valueParts(pageMath.totalsOf(data.now, ['raw'], off).raw).text;
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

/* Память обязана молчать, когда чужая: чужой отчёт, разошедшийся паспорт,
 * устаревшая версия записи, испорченный JSON, имя, которого в отчёте нет. */
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

/* Отказ ссылки — это сообщение читателю, а не пустая таблица: чужой отчёт, битая
 * запись, имена, которых в отчёте нет, и честно выключенное всё. */
test('ссылка: чужой, битый или неполный выбор объясняется словами', () => {
  const owner = openPage();
  const od = owner.window.document;
  const ui = JSON.parse(od.getElementById('ui').textContent);
  toggleCheck(od, metricBox(od), false);
  const own = stored(owner);
  const passport = Object.keys(own)[0].slice('size-report:'.length);
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

  /* Ссылка про то, чего в отчёте нет: применено названное верно, а о пропущенном
   * сказано числом — иначе читатель станет искать в таблице то, чего в ней нет. */
  const ghost = openPage({}, linkTo({ v: 1, passport: passport,
    metrics: { tok: false, min: false }, files: { 'src/gone.js': false, 'src/code.js': false } }));
  const gd = ghost.window.document;
  assert.equal(metricBox(gd).checked, false, 'названная метрика не применилась из ссылки');
  assert.equal(fileBox(gd, 'src/code.js').checked, false, 'названный файл не применился из ссылки');
  assert.equal(notice(gd).textContent, ui.linkExtra.replace('{n}', '2'),
    'о пропущенных именах не сказано');

  /* Отправитель выключил всё: это его вид, и он объяснён словами, а не пустой сеткой. */
  const all = { v: 1, passport: passport, metrics: {}, files: {} };
  data.metrics.forEach((m) => { all.metrics[m.key] = false; });
  data.files.forEach((f) => { all.files[f.path === null ? f.paths[0] : f.path] = false; });
  const empty = openPage({}, linkTo(all));
  const ed = empty.window.document;
  assert.equal(ed.getElementById('state').textContent, ui.empty,
    'ссылка с выключенными метриками дала сетку без объяснения');
  assert.equal(notice(ed).hidden, true, 'о полной ссылке сказано лишнее');
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
  const metricsOn = [...doc.querySelectorAll('#panel .box.metric input')];
  const toggle = (b, checked) => {
    b.checked = checked;
    b.dispatchEvent(new dom.window.Event('change'));
  };

  metricsOn.forEach((b) => toggle(b, false));
  assert.equal(doc.getElementById('state').hidden, false,
    'без метрик страница молчит вместо того, чтобы объяснить пустоту');
  assert.equal(doc.getElementById('state').textContent, ui.empty, 'объяснение пустоты не то');
  assert.equal(doc.getElementById('shell').hidden, true, 'сетка без метрик осталась на виду');
  assert.equal(doc.querySelectorAll('#grid tbody tr').length, 0, 'таблица без метрик всё ещё строится');
  assert.equal(doc.querySelectorAll('[colspan="0"]').length, 0, 'в разметке остался colspan="0"');

  metricsOn.forEach((b) => toggle(b, true));
  inputs.filter((b) => metricsOn.indexOf(b) < 0).forEach((b) => toggle(b, false));
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

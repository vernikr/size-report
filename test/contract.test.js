/* Контракт данных: движок отдаёт абсолютные значения и устройство таблицы, а всё
 * производное — дельты, суммы, «сейчас» и фильтры — считает страница. Проверяется
 * это на настоящем выводе, а не описанием:
 *
 *   1. числа контракта сверяются с замороженным эталоном паритета (той же снятой
 *      ревизией) — контракт обязан нести ту же правду, что и артефакт;
 *   2. в контракте нет ни одной производной величины (проверяется по составу
 *      полей, а не на слово);
 *   3. вычислительная часть страницы (`DERIVED_SRC` — исходники функций, которыми
 *      считает артефакт) прогоняется и её итоги сверяются с итогами артефакта, а
 *      сумма дельт по колонке — с текущим размером; оболочка страницы при этом не
 *      имеет права заводить свои функции расчёта;
 *   4. страница собирается и работает в настоящем DOM (jsdom): включение метрик,
 *      категорий и файлов пересчитывает таблицу без обращения к движку.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import {
  APP_DOM, APP_SCRIPT, CATEGORY_ORDER, DERIVED_SRC, rowModel, totalsOf, valueParts
} from '../src/size-table.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTH = path.join(ROOT, 'fixtures', 'synthetic');
const BUNDLE = path.join(SYNTH, 'history.bundle');
const CONFIG = path.join(SYNTH, 'config.json');
const PACKAGE_BIN = path.join(ROOT, 'bin', 'size.js');
const MAX_BUF = 256 * 1024 * 1024;

const goldenText = fs.readFileSync(path.join(SYNTH, 'golden.json'), 'utf8');
const golden = JSON.parse(goldenText);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-contract-'));
let clones = 0;
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function cloneFixture() {
  const dir = path.join(tmp, 'fixture-' + (clones++));
  execFileSync('git', ['clone', '-q', BUNDLE, dir], { encoding: 'utf8', maxBuffer: MAX_BUF });
  return dir;
}

function runCli(dir, args) {
  const res = spawnSync(process.execPath, [PACKAGE_BIN, '--config', CONFIG].concat(args), {
    cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function dataOf(dir) {
  const res = runCli(dir, ['--data']);
  assert.equal(res.code, 0, 'инструмент не отдал --data (код ' + res.code + '): ' + res.stderr.trim());
  return JSON.parse(res.stdout);
}

/* Вычислительная часть страницы — текст, вклеенный в страницу. Проверки ниже
 * гоняют его в настоящем JS: если он перестанет исполняться или разойдётся с
 * числами артефакта, станет видно из теста, а не из браузера. */
const pageMath = new Function(DERIVED_SRC + '\nreturn { rowModel: rowModel, totalsOf: totalsOf };')();

// Ключи включённых метрик — то, что вычислительная часть принимает на вход.
function keysOn(view) {
  return data.metrics.filter((m) => view.metrics[m.key]).map((m) => m.key);
}

const dir = cloneFixture();
const data = dataOf(dir);
const allOn = () => data.files.map(() => true);
const allMetrics = { raw: true, min: true };

/* ---------- контракт ---------- */

test('контракт воспроизводим: два прогона дают те же байты', () => {
  assert.equal(runCli(cloneFixture(), ['--data']).stdout, runCli(dir, ['--data']).stdout,
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
  ['group', 'totalsOf', 'deltaOf', 'cellParts', 'valueParts', 'rowModel', 'nowModel', 'commitParts']
    .forEach((name) => {
      assert.ok(new RegExp('function ' + name + '\\(').test(DERIVED_SRC),
        'в вычислительной части страницы нет ' + name);
    });
  assert.equal(APP_SCRIPT.indexOf(DERIVED_SRC), 0, 'программа страницы начинается не с общего расчёта');
  assert.ok(pageHtml.indexOf(APP_SCRIPT) > 0, 'страница собрана не из общей программы');

  /* Список функций оболочки закрыт: любая новая функция в ней — это либо
   * разметка, либо вернувшийся своим путём расчёт; первое правится здесь же,
   * второе лучше не делать вовсе. */
  const defined = [...APP_DOM.matchAll(/function\s+(\w+)/g)].map((m) => m[1]).sort();
  assert.deepEqual(defined, [
    'appBox', 'appCell', 'appCommit', 'appEl', 'appPanel', 'appRender', 'appSubHead', 'appTable', 'appValueCell'
  ], 'оболочка страницы завела свою функцию: расчёт должен жить в вычислительной части');
  assert.equal(/\breduce\(|Math\.abs/.test(APP_DOM), false,
    'оболочка страницы считает итоги или знак дельты сама');
  ['rowModel', 'nowModel', 'commitParts', 'cellParts', 'valueParts'].forEach((name) => {
    assert.ok(APP_DOM.indexOf(name + '(') >= 0, 'оболочка страницы не пользуется ' + name);
  });
});

/* ---------- страница ---------- */

function pageHtmlOf(dir) {
  const res = runCli(dir, ['--page']);
  assert.equal(res.code, 0, 'инструмент не собрал страницу: ' + res.stderr.trim());
  const file = path.join(dir, 'docs', 'size-report.html');
  assert.ok(fs.existsSync(file), 'страница не появилась рядом с таблицей');
  return fs.readFileSync(file, 'utf8');
}

const pageDir = cloneFixture();
const pageRun = runCli(pageDir, ['--page']);
const pageHtml = pageHtmlOf(pageDir);

test('страница самодостаточна и несёт данные контракта', () => {
  assert.equal(pageRun.code, 0, 'сборка страницы не отчиталась: ' + pageRun.stderr.trim());
  assert.equal(/https?:\/\//.test(pageHtml), false,
    'в странице есть внешняя ссылка: без сети она не откроется');
  assert.equal(/<link|<img|src=/.test(pageHtml), false, 'страница тянет что-то со стороны');

  const dom = new JSDOM(pageHtml);
  const embedded = JSON.parse(dom.window.document.getElementById('data').textContent);
  assert.deepEqual(embedded, dataOf(pageDir), 'в странице лежат не те данные, что отдаёт --data');
});

test('страница считает то же, что артефакт, и пересчитывается по выбору', () => {
  const dom = new JSDOM(pageHtml, { runScripts: 'dangerously' });
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

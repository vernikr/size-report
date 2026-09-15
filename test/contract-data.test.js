/* Контракт данных — то, что движок отдаёт странице: абсолютные значения и
 * устройство таблицы. Всё производное (дельты, суммы, «сейчас», фильтры) считает
 * страница, и этого в контракте быть не должно.
 *
 * Проверяется на настоящем выводе, а не описанием:
 *
 *   1. числа контракта сверяются с замороженным эталоном паритета (той же снятой
 *      ревизией) — контракт обязан нести ту же правду, что и артефакт;
 *   2. в контракте нет ни одной производной величины (проверяется по составу
 *      полей, а не на слово);
 *   3. точность объявлена дважды и согласованно: у метрики — худшее в колонке, у
 *      клетки — её собственное число;
 *   4. у каждого файла есть категория, и она объявлена в данных.
 *
 * Производные величины и страница — соседние наборы (`contract-derived`,
 * `page-view`, `page-choice`): файл разделён по предмету, а не по размеру.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORY_ORDER } from '../src/size-table.js';
import { cloneFixture, gitIn, runFixture, tempDir } from '../tools/harness.js';
import { contractData } from '../tools/page-harness.js';
import { TOOL_PKG } from '../src/tool.js';

const tmp = tempDir('contract-data');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* Контракт снимается один раз на весь набор: он зависит только от фикстуры и
 * настроек, а их одинаковость у разных клонов отдельно проверяет воспроизводимость. */
const { dir, text, data, golden } = contractData(tmp, 'numbers');

test('контракт воспроизводим: два прогона дают те же байты', () => {
  const second = cloneFixture(path.join(tmp, 'fixture-repro'));
  assert.equal(runFixture(second, ['--data']).stdout, text,
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

/* Каталог — дерево проекта для страницы: все пути, которые видит git, а не только
 * колонки. Знак причины читается однозначно: пусто — файл измеряется (и тогда он
 * есть среди колонок), `rule` — колонкой быть не может (правило пакета), `choice` —
 * мог бы, но в набор не выбран. Проверка идёт по дереву git, а не по описанию. */
test('каталог называет все файлы проекта, а причину — только у тех, что вне отчёта', () => {
  const tracked = gitIn(dir, ['ls-files']).split('\n').filter((l) => l !== '').sort();
  /* Сам отчёт назван всегда, и это часть правила, а не исключение: его
   * отслеживаемость — свойство момента, и зависеть от неё отчёт не должен. */
  const artifactPath = data.report.artifact;
  const expected = tracked.indexOf(artifactPath) >= 0 ? tracked : tracked.concat([artifactPath]).sort();
  assert.deepEqual(data.catalog.map((e) => e.path).sort(), expected,
    'каталог разошёлся с деревом git: дерево страницы — дерево проекта');
  const measured = data.files.map((f) => (f.path === null ? f.paths[0] : f.path));
  const named = data.catalog.filter((e) => e.why === null).map((e) => e.path);
  assert.deepEqual(named.sort(), measured.filter((p) => tracked.indexOf(p) >= 0).sort(),
    'знак «измеряется» стоит не у тех файлов');
  data.catalog.filter((e) => e.why !== null).forEach((e) => {
    assert.ok(['rule', 'choice'].indexOf(e.why) >= 0,
      'файл ' + e.path + ': причина не названа (' + JSON.stringify(e.why) + ')');
  });
  assert.equal(data.catalog.find((e) => e.path === artifactPath).why, 'rule',
    'сам отчёт назван колонкой, которой быть не может');
  assert.ok(data.catalog.some((e) => e.why === 'choice'),
    'в каталоге нет ни одного файла с причиной «не выбран в колонки»');
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
  assert.notEqual(min, undefined, 'в контракте нет пометок приближённых клеток');
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

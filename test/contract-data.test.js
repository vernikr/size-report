/* The data contract — what the engine hands the page: absolute values and the shape of the table.
 * Everything derived (deltas, totals, "now", filters) is computed by the page and must not be here.
 *
 * Checked against real output rather than a description:
 *
 *   1. the contract's numbers are compared with the fixture's frozen golden (taken by the same copy
 *      of the engine) — the contract has to carry the same truth as the artifact;
 *   2. the contract holds no derived quantity (checked by the set of fields, not on trust);
 *   3. accuracy is declared twice and in agreement: the metric says the worst in the column, a cell
 *      its own number;
 *   4. every file has a category, and the category is declared in the data.
 *
 * Derived quantities and the page are neighbouring suites (`contract-derived`, `page-view`,
 * `page-choice`): the file is split by subject, not by size.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORY_ORDER } from '../src/size-table.js';
import { readHistory } from '../src/git.js';
import { cloneFixture, gitIn, runFixture, tempDir } from '../tools/harness.js';
import { contractData } from '../tools/page-harness.js';
import { TOOL_PKG } from '../src/tool.js';

const tmp = tempDir('contract-data');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* The contract is taken once for the whole suite: it depends only on the fixture and the settings, and
 * that different clones agree is checked separately, by reproducibility. */
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

  // "Now" — the same absolute values the artifact's deltas stand on.
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

/* The catalogue is the project tree for the page: every path git sees, not just the columns. A reason
 * mark reads unambiguously: empty — the file is measured (and then it is among the columns), `rule` —
 * it cannot be a column (a rule of the package), `choice` — it could be, but was not picked. The check
 * runs against the git tree, not a description. */
test('каталог называет все файлы проекта, а причину — только у тех, что вне отчёта', () => {
  const tracked = gitIn(dir, ['ls-files']).split('\n').filter((l) => l !== '').sort();
  /* The report itself is always named, and that is part of the rule rather than an exception: whether
   * it is tracked is a property of the moment, and the report must not depend on it. */
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

/* The mark "the last commit touched this column" is a fact from history and is checked against that
 * history: the newest commit touching at least one column, counted from the tip backwards, because
 * commits past the columns (and the report the hook commits) are skipped. The page puts the marked
 * columns first, and a mistake here would go unnoticed: the order of columns is not a number, and no
 * standard checks it. */
test('последний коммит назван по истории: отмечены ровно тронутые колонки', () => {
  const aliases = data.files.map((f) => f.paths);
  const history = readHistory(dir);
  assert.ok(history.length > 0, 'в фикстуре нет истории — сверять знак не с чем');
  /* The mark is set by the newest commit that touched at least one column, and a column is marked if
   * that commit touched it. */
  const real = [...history].reverse()
    .find((c) => c.files.some((f) => aliases.some((paths) => paths.indexOf(f) >= 0)));
  assert.notEqual(real, undefined, 'в истории фикстуры нет коммита, задевшего колонку');
  assert.deepEqual(data.last, aliases.map((paths) => paths.some((p) => real.files.indexOf(p) >= 0)),
    'знак последнего коммита не совпал с изменёнными им путями');
  assert.equal(data.last.length, data.files.length, 'знаков меньше, чем колонок');
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

/* Accuracy is declared twice, and these are not two answers to one question: for the metric it is the
 * worst in the column, for a cell its own number. That is why the fixture is mixed: `package.json` is
 * exact (JSON loses only insignificant whitespace — the one strategy that is minification itself),
 * while every other format is measured by stripping, since the fixture's settings ask for no minifier.
 *
 * The agreement of the two answers is checked, not the presence of a field: a metric with not a single
 * mark cannot say "approximate", and a row of marks has to cover exactly all cells — rows and "now"
 * separately. */
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

  /* Mixedness is what this row exists for: were all cells of one mark, a per-cell mark would add
   * nothing to the metric's label. */
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

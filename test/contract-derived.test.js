/* Производные величины считает страница, и они обязаны сходиться с артефактом:
 * итоги строки, дельты клетки и дельта итога. Считает их тот же код, что
 * исполняет страница (`src/derived.js`), — здесь он прогоняется прямо из файла
 * на диске, поэтому проверяется вклеенное, а не обещанное.
 *
 * Отдельная забота — колонка файла, который уходил и вернулся: в ней две клетки
 * роста, а «сейчас» — один размер, поэтому сумма дельт больше текущего размера.
 * Такие колонки названы поимённо (`GAPS`), чтобы правило нельзя было поменять
 * молча; почему так и что с этим делать — в `BLOCKERS.md` §N4.
 *
 * Сам контракт — в `test/contract-data.test.js`, страница — в `page-view`.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rowModel, stripModules, totalsOf } from '../src/size-table.js';
import { ROOT, tempDir } from '../tools/harness.js';
import { contractData } from '../tools/page-harness.js';

const tmp = tempDir('contract-derived');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const { data, golden } = contractData(tmp, 'numbers');

const allOn = () => data.files.map(() => true);
const allMetrics = { raw: true, min: true };

/* Вычислительная часть — тот же код, что исполняет страница. */
const derivedSrc = fs.readFileSync(path.join(ROOT, 'src', 'derived.js'), 'utf8');
const pageMath = new Function(stripModules(derivedSrc)
  + '\nreturn { rowModel: rowModel, totalsOf: totalsOf };')();

// Ключи включённых метрик — то, что вычислительная часть принимает на вход.
function keysOn(view) {
  return data.metrics.filter((m) => view.metrics[m.key]).map((m) => m.key);
}

// Строки таблицы в терминах вычислительной части: то же, из чего рисуется отчёт.
const models = data.rows.map((row, r) => rowModel(row.values, r === 0 ? null : data.rows[r - 1].values,
  keysOn({ metrics: allMetrics }), allOn()));

const GAPS = ['crlf.txt'];

test('итоги страницы сходятся с итогами артефакта', () => {
  const metrics = keysOn({ metrics: allMetrics });
  const on = allOn();
  data.rows.forEach((row, r) => {
    assert.deepEqual(pageMath.totalsOf(row.values, metrics, on), golden.rows[r].totals,
      'строка ' + (r + 1) + ': итог по контракту не совпал с итогом артефакта');
  });
});

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

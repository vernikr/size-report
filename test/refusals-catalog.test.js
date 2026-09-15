/* Каталог отказов: у каждого места отказа есть свой пункт, а у каждого пункта —
 * сторож. Прогонов здесь нет вовсе: проверяются сами объявления, поэтому файл
 * дешёвый и идёт в быстром прогоне. Живое исполнение отказов — в
 * `test/refusals.test.js` (там прогон на каждый случай, и это дорого).
 *
 * Что стережётся. Карты `SITES` (отказы, бросающие исключение) и `PRINTED`
 * (отказы со знаком «✗» и кодом) держат числа мест в исходниках: новое место отказа
 * меняет число, и без пункта в каталоге прогон красный. Отсюда и главное обещание —
 * **отказ не может появиться без проверки**: прежде ложную причину в тексте находил
 * случайный живой прогон (B1, B3, R-4.13, `explain HEAD` — четыре раза подряд).
 *
 * Второе: отказы, которые каталог отдаёт другой проверке (`coveredBy`), названы не
 * «где-то проверяется», а файлом и фразами, которые тот файл утверждает. Пропавшая
 * проверка или переписанная фраза видны здесь как расхождение.
 *
 * Чего проверка не берёт — сказано в шапке каталога: формулировки вне фраз, смысл и
 * `--json`. Одно исключение названо явно и закрытым списком: отказ, который нельзя
 * вызвать прогоном, обязан объяснить, почему (сейчас такой ровно один).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CASES, PRINTED, SITES } from '../tools/refusals.js';
import { ROOT } from '../tools/harness.js';

test('отказы, стерегомые другой проверкой, названы и в самом деле ею утверждаются', () => {
  const covered = CASES.filter((c) => c.coveredBy !== undefined);
  assert.ok(covered.length > 0, 'в каталоге нет ни одного отказа со ссылкой на другую проверку');
  covered.forEach((c) => {
    const file = path.join(ROOT, c.coveredBy);
    assert.ok(fs.existsSync(file), 'проверка, которой каталог отдаёт отказ, не найдена: ' + c.coveredBy);
    const text = fs.readFileSync(file, 'utf8');
    c.must.forEach((phrase) => {
      assert.ok(text.indexOf(phrase) >= 0, 'в ' + c.coveredBy + ' нет утверждения «' + phrase
        + '» за отказ «' + c.key + '» — значит, отказ остался без сторожа');
    });
  });
});

test('у каждого места отказа в исходниках есть пункт каталога', () => {
  const found = new Map();
  const bump = (key) => found.set(key, (found.get(key) || 0) + 1);
  // `src/refusal.js` не считается: он и есть механизм отказа, а не место, где
  // инструмент отказывается.
  const files = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js') && f !== 'refusal.js');
  const printed = {};
  files.forEach((f) => {
    const text = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
    // Причина из реестра и код из таблицы — два способа отказать; считаются оба.
    [...text.matchAll(/refuseCause\('([^']+)'/g)].forEach((m) => bump(m[1]));
    [...text.matchAll(/refuse\(EXIT\.([A-Z]+)/g)].forEach((m) => bump('EXIT.' + m[1]));
    const marks = [...text.matchAll(/'✗ /g)].length;
    if (marks > 0) printed['src/' + f] = marks;
  });

  const declared = new Map(Object.entries(SITES));
  const missing = [...found.keys()].filter((k) => !declared.has(k));
  assert.deepEqual(missing, [], 'в исходниках есть место отказа без пункта каталога (tools/refusals.js): '
    + missing.join(', '));
  const phantom = [...declared.keys()].filter((k) => !found.has(k));
  assert.deepEqual(phantom, [], 'каталог объявляет отказ, которого в исходниках нет: ' + phantom.join(', '));
  const diff = [...declared.keys()].filter((k) => found.get(k) !== declared.get(k))
    .map((k) => k + ' (' + declared.get(k) + ' в каталоге, ' + found.get(k) + ' в исходниках)');
  assert.deepEqual(diff, [], 'число мест отказа разошлось с каталогом: ' + diff.join('; ')
    + ' — у нового места обязан быть свой пункт и своя строка проверки');

  // Отказы со знаком «✗» и кодом: их механизм другой (знак и код, а не исключение),
  // и держатся они тем же счётом. В карте есть и неотказы (`src/hook.js` пишет в
  // журнал хука, `src/doctor.js` ставит метки в отчёте) — затем, чтобы новое «✗»
  // в этих файлах не проскочило молча.
  assert.deepEqual(printed, PRINTED, 'число отказов со знаком «✗» разошлось с картой PRINTED'
    + ' (tools/refusals.js) — у нового места обязан быть свой пункт');

  // У каждого объявленного места отказа есть случай: место без строки в каталоге,
  // без ссылки на другую проверку и без названной причины, почему его не поймать,
  // не стережёт никто. Счёт мест этого не ловит: место и пункт карты сходятся, а
  // проверки у места нет.
  const named = new Set(CASES.map((c) => (c.id === undefined ? c.key : c.id)));
  const noCase = [...declared.keys()].filter((k) => !named.has(k));
  assert.deepEqual(noCase, [], 'у места отказа нет ни случая в каталоге, ни названной'
    + ' причины, почему его не поймать: ' + noCase.join(', '));

  /* Совет — вторая половина отказа: мало назвать причину, надо дать выход. У каждого
   * случая сказано, что он советует (`advice`), — и для случаев, которые целиком
   * стережёт другая проверка, это единственное место, где видно, чем именно совет
   * проверен: файлом и строкой в нём. Живое исполнение объявленных советов — в
   * `test/refusals.test.js`. */
  const silent = CASES.filter((c) => !Array.isArray(c.advice));
  assert.deepEqual(silent.map((c) => (c.id === undefined ? c.key : c.id)), [],
    'у случая не сказано, что отказ советует (advice: [] — если совета нет)');
  CASES.filter((c) => c.uncatchable !== undefined).forEach((c) => {
    assert.deepEqual(c.advice, [], '«' + c.id + '»: отказ, который нельзя вызвать прогоном,'
      + ' не может ничего советовать — его вывод никто не читает');
  });
  const unfixed = [];
  CASES.forEach((c) => c.advice.forEach((a) => {
    if (a.kind !== 'coveredBy') return;
    const file = path.join(ROOT, a.file);
    if (!fs.existsSync(file)) {
      unfixed.push((c.id === undefined ? c.key : c.id) + ': нет файла ' + a.file);
      return;
    }
    if (fs.readFileSync(file, 'utf8').indexOf(a.text) < 0) {
      unfixed.push((c.id === undefined ? c.key : c.id) + ': в ' + a.file + ' нет строки «' + a.text + '»');
    }
  }));
  assert.deepEqual(unfixed, [], 'совет отдан другой проверке, а она его не исполняет:\n  ' + unfixed.join('\n  '));

  // Закрытый список того, что нельзя проверить прогоном: причина сказана словами.
  const loose = CASES.filter((c) => c.uncatchable !== undefined);
  assert.deepEqual(loose.map((c) => c.id), ['внутренняя ошибка'],
    'список непроверяемых отказов изменился — это решение, а не мелочь, и его надо назвать');
  loose.forEach((c) => {
    assert.ok(c.uncatchable.length > 40, 'непроверяемый отказ «' + c.id + '» не объяснил, почему его не поймать');
  });
});

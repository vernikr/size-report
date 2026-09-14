/* Четвёртое обещание документации: **названные числа совпадают с фактом** — число
 * проверок и цели по времени в `README.md` и в таблице бюджета `REFACTOR.md` равны
 * тому, что есть на самом деле: сколько проверок объявлено в файлах набора и какие
 * цели объявлены у прогонов (`tools/suites.js`). Счёт держится тем, что проверка
 * объявляется в начале строки: объявление внутри цикла сделало бы число выводом из
 * кода, и документации было бы не на что опираться (за этим следит первая проверка
 * файла).
 *
 * Прогонов два, и у каждого свои числа — иначе быстрый прогон перестал бы быть
 * быстрым молча, а документ говорил бы о цели, которой никто не держит.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../tools/harness.js';
import { BUDGET, FAST, checksIn, testFiles } from '../tools/suites.js';
import { publishedRuns, read } from '../tools/docs-facts.js';

function lastMatch(text, pattern) {
  const rows = [...text.matchAll(pattern)];
  return rows.length === 0 ? null : rows[rows.length - 1];
}

test('числа проверок и целей в документации совпадают с фактом', () => {
  // Объявлений проверок — по файлам набора. Счёт держится на том, что проверка
  // объявляется в начале строки: объявление внутри цикла сделало бы число выводом
  // из кода, и документации было бы не на что опираться.
  const nested = [];
  fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /\.test\.js$/.test(f)).forEach((f) => {
    read(path.join('test', f)).split('\n').forEach((line, i) => {
      if (/^\s+test\(/.test(line)) nested.push('test/' + f + ':' + (i + 1));
    });
  });
  assert.deepEqual(nested, [],
    'проверка объявлена не в начале строки — число проверок нельзя прочесть по файлам:\n  '
    + nested.join('\n  '));

  const total = testFiles().reduce((sum, f) => sum + checksIn(f), 0);
  const quick = FAST.reduce((sum, entry) => sum + checksIn(entry.file), 0);

  // README называет оба прогона таблицей: команда, сколько проверок, цель.
  const runs = publishedRuns();
  assert.ok(runs.fast !== null, 'README не называет быстрый прогон: `pnpm test` — сколько'
    + ' проверок из скольких и цель');
  assert.ok(runs.full !== null, 'README не называет полный прогон: `pnpm test:all` — сколько'
    + ' проверок и цель');
  assert.equal(runs.fast.checks, quick, 'README обещает быстрому прогону ' + runs.fast.checks
    + ' проверок, а в быстрых файлах их ' + quick);
  assert.equal(runs.fast.total, total, 'README называет в наборе ' + runs.fast.total
    + ' проверок, а в файлах их ' + total);
  assert.equal(runs.full.checks, total, 'README обещает полному прогону ' + runs.full.checks
    + ' проверок, а в файлах их ' + total);
  assert.equal(runs.fast.budget, BUDGET.fast, 'README обещает быстрому прогону цель ≤ '
    + runs.fast.budget + ' с, а объявление — ≤ ' + BUDGET.fast + ' с');
  assert.equal(runs.full.budget, BUDGET.full, 'README обещает полному прогону цель ≤ '
    + runs.full.budget + ' с, а объявление — ≤ ' + BUDGET.full + ' с');

  // Бюджет времени: строк в таблице REFACTOR про каждый прогон может быть несколько
  // (история целей), сверить обязан последнюю — она и есть действующая.
  const text = read('REFACTOR.md');
  const fastRow = lastMatch(text, /^\| `pnpm test` \((\d+) провер[а-я]*[^|]*\|[^|]*\| \*\*≤ (\d+) с\*\*/gm);
  assert.ok(fastRow, 'в REFACTOR нет строки бюджета про быстрый прогон (`pnpm test`)');
  assert.equal(Number(fastRow[1]), quick, 'последняя строка бюджета REFACTOR про быстрый прогон —'
    + ' про ' + fastRow[1] + ' проверок, а в быстрых файлах их ' + quick);
  assert.equal(Number(fastRow[2]), BUDGET.fast, 'последняя строка бюджета REFACTOR обещает'
    + ' быстрому прогону ≤ ' + fastRow[2] + ' с, а объявление — ≤ ' + BUDGET.fast + ' с');

  const fullRow = lastMatch(text, /^\| `pnpm test:all` \((\d+) провер[а-я]*[^|]*\|[^|]*\| \*\*≤ (\d+) с\*\*/gm);
  assert.ok(fullRow, 'в REFACTOR нет строки бюджета про полный прогон (`pnpm test:all`)');
  assert.equal(Number(fullRow[1]), total, 'последняя строка бюджета REFACTOR про полный прогон —'
    + ' про ' + fullRow[1] + ' проверок, а в наборе их ' + total);
  assert.equal(Number(fullRow[2]), BUDGET.full, 'последняя строка бюджета REFACTOR обещает'
    + ' полному прогону ≤ ' + fullRow[2] + ' с, а объявление — ≤ ' + BUDGET.full + ' с');
});

/* Четвёртое обещание документации: **названные числа совпадают с фактом** — число
 * проверок в `README.md` равно тому, что есть на самом деле: сколько проверок
 * объявлено в файлах набора (`tools/suites.js`). Счёт держится тем, что проверка
 * объявляется в начале строки: объявление внутри цикла сделало бы число выводом из
 * кода, и документации было бы не на что опираться (за этим следит первая проверка
 * файла).
 *
 * Прогонов два, и у каждого своё число — иначе быстрый прогон перестал бы быть
 * быстрым молча, а документ говорил бы о разделении, которого никто не держит.
 *
 * **Целей по времени здесь нет, и это сказано, а не спрятано:** секунды зависят от
 * окна (загрузка машины бывает какой угодно), поэтому прогон за время не валится и
 * документ секунд не обещает — сверять нечего.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../tools/harness.js';
import { FAST, checksIn, testFiles } from '../tools/suites.js';
import { publishedRuns, read } from '../tools/docs-facts.js';

test('числа проверок в документации совпадают с фактом', () => {
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

  // README называет оба прогона таблицей: команда и сколько проверок.
  const runs = publishedRuns();
  assert.ok(runs.fast !== null, 'README не называет быстрый прогон: `pnpm test` — сколько'
    + ' проверок из скольких');
  assert.ok(runs.full !== null, 'README не называет полный прогон: `pnpm test:all` — сколько'
    + ' проверок');
  assert.equal(runs.fast.checks, quick, 'README обещает быстрому прогону ' + runs.fast.checks
    + ' проверок, а в быстрых файлах их ' + quick);
  assert.equal(runs.fast.total, total, 'README называет в наборе ' + runs.fast.total
    + ' проверок, а в файлах их ' + total);
  assert.equal(runs.full.checks, total, 'README обещает полному прогону ' + runs.full.checks
    + ' проверок, а в файлах их ' + total);
});

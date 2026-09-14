/* Четвёртое обещание документации: **названные числа совпадают с фактом** —
 * число проверок в `README.md` и последняя строка бюджета времени в
 * `REFACTOR.md` равны числу объявлений `test(` в наборах. Счёт держится тем, что
 * проверка объявляется в начале строки: объявление внутри цикла сделало бы число
 * выводом из кода, и документации было бы не на что опираться (за этим следит
 * первая проверка файла).
 *
 * Цель по времени берётся из README, а бюджет — из REFACTOR: их совпадение и есть
 * обещание, что цель не поднималась под сегодняшнее число.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../tools/harness.js';
import { read } from '../tools/docs-facts.js';

test('числа проверок и целей в документации совпадают с фактом', () => {
  // Объявлений проверок — по файлам набора. Счёт держится на том, что проверка
  // объявляется в начале строки: объявление внутри цикла сделало бы число выводом
  // из кода, и документации было бы не на что опираться.
  const declared = [];
  const nested = [];
  fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /\.test\.js$/.test(f)).forEach((f) => {
    read(path.join('test', f)).split('\n').forEach((line, i) => {
      if (/^test\(/.test(line)) declared.push('test/' + f);
      if (/^\s+test\(/.test(line)) nested.push('test/' + f + ':' + (i + 1));
    });
  });
  assert.deepEqual(nested, [],
    'проверка объявлена не в начале строки — число проверок нельзя прочесть по файлам:\n  '
    + nested.join('\n  '));

  const claimed = read('README.md').match(/при (\d+) проверках/);
  assert.ok(claimed, 'README не называет числа проверок — сверить нечего');
  assert.equal(Number(claimed[1]), declared.length,
    'README обещает ' + claimed[1] + ' проверок, а в наборах их ' + declared.length);

  // Бюджет времени: строк в таблице REFACTOR про сегодняшний набор может быть
  // несколько (история целей), сверить обязан последнюю — она и есть действующая.
  const rows = [...read('REFACTOR.md').matchAll(/^\| `pnpm test` \((\d+) провер[а-я]*[^|]*\|[^|]*\| \*\*≤ (\d+) с\*\*/gm)];
  assert.ok(rows.length > 0, 'в REFACTOR нет строки бюджета про `pnpm test`');
  const last = rows[rows.length - 1];
  assert.equal(Number(last[1]), declared.length,
    'последняя строка бюджета REFACTOR — про ' + last[1] + ' проверок, а в наборах их ' + declared.length);
  const goal = read('README.md').match(/цель — `pnpm test`\s*\*\*≤ (\d+) с\*\*/);
  assert.ok(goal, 'README не называет цели по времени — сверить нечего');
  assert.equal(goal[1], last[2],
    'README обещает цель ≤ ' + goal[1] + ' с, а бюджет REFACTOR — ≤ ' + last[2] + ' с');
});

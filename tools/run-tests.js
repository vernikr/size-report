#!/usr/bin/env node
/* Прогон проверок: `node tools/run-tests.js fast` (то же, что `pnpm test`) и
 * `node tools/run-tests.js full` (то же, что `pnpm test:all`).
 *
 * Зачем свой прогон, если есть `node --test`. Три вещи, которых у него нет, и все
 * нужны именно разделению:
 *
 *   1. **Стоимость каждого файла видна.** Файл запускается отдельным процессом, и
 *      время этого процесса известно. Объявление стоимости в `tools/suites.js` —
 *      снимок, и он может устареть; прогон печатает замер рядом, поэтому расхождение
 *      видно сразу, а не через полгода.
 *   2. **Числа проверок складываются.** Прогон считает проверки по каждому файлу и
 *      сверяет сумму с числом объявлений `test(` в тех же файлах: файл, который не
 *      отработал, — это не «меньше проверок», а провал прогона.
 *   3. **У бюджета есть измеряемая граница.** Цель прогона объявлена в `suites.js`
 *      (`BUDGET`), и прогон валится, если вышел за неё вдвое: занятое окно
 *      растягивает прогон, но не в такое число раз — значит, дорогой файл попал не
 *      в тот прогон. Загрузка машины печатается, чтобы отказ было чем проверить.
 *
 * `measure` перемеряет снимок: гоняет каждый файл отдельно, по одному (иначе числа
 * были бы про пул, а объявление — про сам файл), и печатает таблицу стоимостью — по
 * ней и правится `tools/suites.js`.
 *
 * Дополнительные ключи после имени прогона уходят в `node --test`, например
 * `node tools/run-tests.js fast --test-name-pattern=паритет`.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { BUDGET, FAST, LIMIT, ROOT, SLOW, checksIn, filesOf, testFiles } from './suites.js';
// Сбор вывода — тот же, что у обвязки проверок: склейка кусков строкой рвёт
// многобайтовый символ на границе и портит числа, прочитанные из вывода.
import { collectOutput } from './harness.js';

const argv = process.argv.slice(2);
const mode = argv[0];
const extra = argv.slice(1);
const jobs = Number(process.env.SIZE_REPORT_TEST_JOBS || 0) || Math.max(1, os.cpus().length);
const MODES = { fast: 'быстрый', full: 'полный' };

/* Числа — по-русски: запятая в дроби и верная форма слова, иначе «1 проверок» и
 * «5 проверок» рядом читаются как сломанный счётчик. */
function sec(n) {
  return n.toFixed(2).replace('.', ',');
}

function plural(n, one, few, many) {
  const ten = n % 100;
  const last = n % 10;
  if (ten >= 11 && ten <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function checks(n) {
  return n + ' ' + plural(n, 'проверка', 'проверки', 'проверок');
}

function files(n) {
  return n + ' ' + plural(n, 'файл', 'файла', 'файлов');
}

function load() {
  return os.loadavg()[0].toFixed(2).replace('.', ',');
}

function declaredCosts() {
  const out = {};
  FAST.concat(SLOW).forEach((entry) => { out[entry.file] = entry.cost; });
  return out;
}

/* Один файл — один процесс: из него берутся и стоимость, и собственные счётчики
 * прогона. Файл, который не отработал, печатает свой вывод целиком. */
async function runFile(file, args) {
  const started = process.hrtime.bigint();
  const child = spawn(process.execPath, ['--test', file].concat(args), { stdio: ['ignore', 'pipe', 'pipe'] });
  const res = await collectOutput(child);
  const out = res.stdout + res.stderr;
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const count = (what) => {
    const m = out.match(new RegExp('^# ' + what + ' (\\d+)$', 'm'));
    return m === null ? 0 : Number(m[1]);
  };
  return { file: file, code: res.code, out: out, seconds: seconds, tests: count('tests'), fail: count('fail') };
}

/* Пул на ядрах: файлы набора не зависят друг от друга, но их больше, чем ядер.
 * `together` — сколько запускать разом: прогон идёт пулом, а замер стоимости — по
 * одному файлу, чтобы числа были сравнимы с объявлением (объявление — стоимость файла
 * самого по себе, а не в пуле и не под загрузкой соседей). */
async function runAll(list, args, together) {
  const done = [];
  let next = 0;
  const width = Math.max(1, Math.min(together === undefined ? jobs : together, list.length));
  await Promise.all(Array.from({ length: width }, async () => {
    while (next < list.length) {
      const i = next++;
      done[i] = await runFile(list[i], args);
    }
  }));
  return done;
}

function line(result, cost) {
  return '  ' + (result.code === 0 ? '✓' : '✗') + ' ' + result.file.padEnd(28) + ' '
    + checks(result.tests).padEnd(18) + ' ' + sec(result.seconds) + ' с'
    + (cost === undefined ? '' : ' (в объявлении ' + sec(cost) + ' с)');
}

async function measure(all) {
  console.log('замер каждого файла отдельно, по одному (' + files(all.length) + ', загрузка '
    + load() + '):\n');
  const declared = declaredCosts();
  const results = await runAll(all, extra, 1);
  results.slice().sort((a, b) => a.seconds - b.seconds).forEach((r) => {
    console.log('  ' + (r.seconds > LIMIT ? 'полный ' : 'быстрый') + ' ' + r.file.padEnd(28) + ' '
      + checks(r.tests).padEnd(18) + ' ' + sec(r.seconds) + ' с'
      + (declared[r.file] === undefined ? '' : ' (в объявлении ' + sec(declared[r.file]) + ' с)')
      + (r.code === 0 ? '' : ' — ПРОВАЛ'));
  });
  console.log('\nпотолок быстрого прогона — ' + sec(LIMIT) + ' с на файл, окно замера — загрузка '
    + load() + '. Числа разных окон несравнимы; снимок и причины — `tools/suites.js`.');
  if (results.some((r) => r.code !== 0)) process.exitCode = 1;
}

async function suite(name) {
  const list = filesOf(name);
  const all = testFiles();
  // Файл, названный в объявлении и не найденный на диске, — это не пустой прогон, а
  // ошибка объявления: считать его проверки нечем.
  const missing = list.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length > 0) {
    console.error('✗ в объявлении прогона назван файл, которого нет: ' + missing.join(', ')
      + '\n  исправьте список в `tools/suites.js`');
    process.exitCode = 2;
    return;
  }
  const declared = list.reduce((sum, f) => sum + checksIn(f), 0);
  const total = all.reduce((sum, f) => sum + checksIn(f), 0);
  const declared2 = declaredCosts();

  /* Загрузка названа по замеру **на входе**, а не на выходе: пул прогона сам
   * заметная часть нагрузки, и число, снятое в конце, говорило бы больше о самом
   * прогоне, чем об окне. */
  const loadBefore = load();
  console.log((name === 'fast' ? '▶ быстрый прогон' : '▶ полный прогон') + ': ' + files(list.length)
    + ', ' + checks(declared)
    + (name === 'fast'
      ? ' из ' + total + ' — остальные ' + checks(total - declared) + ' в полном прогоне (`pnpm test:all`)'
      : ' — весь набор (`pnpm test:all`)')
    + '.');
  console.log('загрузка машины на входе ' + loadBefore + ', файлов разом '
    + Math.min(jobs, list.length) + '\n');

  const started = Date.now();
  const results = await runAll(list, extra);
  const seconds = (Date.now() - started) / 1000;

  let bad = 0;
  results.forEach((r) => {
    if (r.code === 0) {
      console.log(line(r, declared2[r.file]));
      return;
    }
    bad++;
    console.error('\n✗ ' + r.file + ' (' + sec(r.seconds) + ' с, код ' + r.code + '):\n');
    console.error(r.out.trimEnd() + '\n');
  });

  const tests = results.reduce((sum, r) => sum + r.tests, 0);
  if (tests !== declared) {
    bad++;
    console.error('✗ ' + checks(tests) + ' отработало, а объявлено ' + checks(declared)
      + ': файл не доехал до прогона или объявление устарело');
  }

  /* Объявление стоимости — снимок, и верность снимка видно только замером. Запас
   * четырёхкратный плюс секунда: занятое окно и параллельный пул растягивают файл
   * против одиночного замера в разы, но не в такое число раз — а вот объявленный
   * дешёвым файл, который на деле стоит секунды, видно сразу. */
  results.forEach((r) => {
    const was = declared2[r.file];
    if (was === undefined || r.seconds <= was * 4 + 2) return;
    bad++;
    console.error('✗ ' + r.file + ' объявлен за ' + sec(was) + ' с, а идёт ' + sec(r.seconds)
      + ' с: снимок устарел или файл стал дороже. Перемерьте (`pnpm run suites:measure`),'
      + ' а если он выше потолка ' + sec(LIMIT) + ' с — его место в полном прогоне');
  });

  /* Цель — не порог отказа: занятое окно растягивает прогон, и красный прогон на
   * чужой нагрузке был бы ложью. Но и молчать об этом нельзя: строка «✓ … (цель ≤ N с)»
   * при 29 с читается как успех. Поэтому цель называется, а недобор — словами. */
  const budget = BUDGET[name];
  console.log('\n' + (bad === 0 ? '✓ ' : '✗ ') + MODES[name] + ' прогон: ' + checks(declared)
    + ', провалов ' + bad + ', ' + sec(seconds) + ' с (цель ≤ ' + budget + ' с, загрузка при старте '
    + loadBefore + (seconds > budget ? ', ЦЕЛЬ НЕ ДОСТИГНУТА' : '') + ')');

  if (seconds > budget * 2) {
    console.error('✗ прогон вышел за цель вдвое: ' + sec(seconds) + ' с против ' + budget
      + ' с. Занятое окно растягивает прогон, но не в такое число раз — скорее всего,'
      + ' дорогой файл попал в ' + (name === 'fast' ? 'быстрый' : 'полный')
      + ' прогон: стоимости файлов видны выше, объявление — `tools/suites.js`.');
    bad++;
  }

  if (bad > 0) process.exitCode = 1;
}

if (['fast', 'full'].includes(mode)) await suite(mode);
else if (mode === 'measure') await measure(testFiles());
else {
  console.error('Прогон не назван. Есть: `fast` (быстрый, то же, что `pnpm test`),'
    + ' `full` (полный, `pnpm test:all`), `measure` (перемерить стоимости файлов).');
  console.error('  например: node tools/run-tests.js fast');
  process.exitCode = 2;
}

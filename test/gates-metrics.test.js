/* Проба датчика раздувания (`pnpm run metrics`): искусственное нарушение обязано
 * красить прогон, а не проходить незамеченным. Каждая проба — это тот класс
 * дефекта, ради которого правило и заведено: простыня-функция, ветвистая функция,
 * проверка без утверждения, утверждение без сравнения, выключенная проверка, долг
 * пометкой.
 *
 * Проба идёт **через stdin с виртуальным именем файла**, а не файлом на диске: имя
 * выбирает, какие правила применяются (`src/` — размер, `test/` — вес проверок), а
 * дерево остаётся чистым — иначе проба сама попадала бы в датчик и в базу.
 *
 * Отдельно проверяется храповик, и обе половины его обещания: то, что уже в базе,
 * проходит молча, а чистка базы человеком работает и ничего не ломает:
 * `--prune-suppressions` даёт подмножество базы, а не отказ. База для этого берётся
 * своя, собранная на своём же файле: репозиторная может быть пуста — весь долг
 * разобран, и это цель датчика, а не поломка храповика. Устаревшая запись (нарушение
 * починили, строка в базе осталась) гейт не валит: иначе починка кода требовала бы
 * правки гейт-файла, которую тот же гейт и запрещает без трейлера.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, exec, probe, readJson, tempDir, write } from '../tools/gate-probe.js';

const tmp = tempDir('metrics');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* Проба «датчика живого» и храповика пишется **внутри репозитория** — в каталоге,
 * которого нет для git (`.size-report/`, он же в `.gitignore`): ESLint линтует только
 * файлы под своим базовым путём, а на дереве во временном каталоге молча не делает
 * ничего, и проба краснела бы на «файл вне базового пути», а не на нарушении.
 * Каталог убирается тем же прогоном; гейты его не сканируют (их обход — `src`, `bin`,
 * `tools`, `test`). */
const SCRATCH = path.join(ROOT, '.size-report', 'probe');
after(() => fs.rmSync(SCRATCH, { recursive: true, force: true }));

function scratch(name, source) {
  const file = path.join(SCRATCH, name);
  write(file, source);
  return path.relative(ROOT, file).split(path.sep).join('/');
}

/* Простыня внутри функции: одна инструкция, но 64 строки — красное ровно по
 * `max-lines-per-function` (счёт операторов молчит: инструкция одна). */
const LONG = ['export function big() {', '  return [', '    0,'
].concat(Array.from({ length: 60 }, (_v, i) => '    ' + (i + 1) + ','))
  .concat(['  ];', '}', '']).join('\n');

/* Прогон правил датчика по куску кода: `--stdin-filename` выбирает, какой набор
 * правил к нему применится. Каждое ожидаемое правило обязано быть названо — общая
 * часть двух проб, чтобы не повторять разбор и сверку дважды. */
function lint(text, stdinFilename, expected) {
  const res = exec('pnpm', ['exec', 'eslint', '--config', 'eslint.metrics.config.js',
    '--stdin', '--stdin-filename', stdinFilename, '--format', 'json'], { input: text });
  const found = [];
  try {
    JSON.parse(res.out).forEach((file) => file.messages.forEach((m) => found.push(m.ruleId)));
  } catch (_e) {
    assert.fail('линтер не отдал отчёт по ' + stdinFilename + ':\n' + res.out.slice(0, 600));
  }
  expected.forEach((rule) => {
    assert.ok(found.includes(rule), 'правило ' + rule + ' не покрасило ' + stdinFilename
      + ' (найдено: ' + (found.join(', ') || 'ничего') + ')');
  });
}

/* Строка долга собирается из частей: иначе проба сама попала бы в датчик долгов —
 * он читает и этот файл. */
const DEBT = 'TO' + 'DO' + ': починить';

/* Все нарушения — в одной пробе на файл, а не по одной пробе на правило: прогон
 * линтера стоит секунды, и шесть проб стоили бы шесть прогонов там, где хватает двух
 * (иначе датчик сам стал бы раздуванием — тем, что ловит). Проверяется по-прежнему
 * каждое правило поимённо. */
test('размер, сложность и долг в исходнике красят датчик', () => {
  const source = '// ' + DEBT + '\n'
    + 'export function big(x) {\n'
    + Array.from({ length: 70 }, (_v, i) => '  x = x + ' + i + ';\n').join('')
    + '  return x;\n}\n'
    + 'export function pick(x) {\n'
    + Array.from({ length: 14 }, (_v, i) => '  if (x === ' + i + ') return ' + i + ';\n').join('')
    + '  return -1;\n}\n';
  lint(source, 'src/probe-bad.js',
    ['max-lines-per-function', 'complexity', 'local/no-debt-marker']);
});

test('вес проверок красят датчик поимённо', () => {
  const tests = "import { test } from 'node:test';\n"
    + "import assert from 'node:assert/strict';\n"
    + "test('ничего не проверяет', () => {\n  const ready = true;\n  ready.toString();\n});\n"
    + "test('слабое утверждение', () => {\n  const ready = true;\n  assert.ok(ready);\n});\n"
    + "test.only('одна на всех', () => {});\n"
    + "test('выключенная', { skip: true }, () => {});\n";
  lint(tests, 'test/probe-weak.test.js',
    ['local/assert-in-test', 'local/weak-assert', 'local/no-skipped-test']);
});

test('храповик держит обе половины: база проходит молча, чистка базы работает', () => {
  const suppressions = path.join(ROOT, '.eslint-suppressions.json');
  assert.ok(fs.existsSync(suppressions), 'нет файла подавлений: датчик завален первым же прогоном');
  const files = Object.keys(readJson(suppressions));
  assert.deepEqual(files.filter((f) => !fs.existsSync(path.join(ROOT, f))), [],
    'в базе назван файл, которого в дереве нет: переименование или удаление делают'
      + ' запись мёртвой, а храповик — тихо слабее');

  /* Молчаливый проход и чистка проверяются на **своей** базе, а не на репозиторной:
   * весь долг может быть разобран — это цель датчика, и запретом на пустоту её не
   * удержать, — а свою базу можно собрать ровно на том нарушении, которое проверяешь
   * (что новое нарушение красно, проверяет соседняя проба). */
  const file = scratch('src/baselined.js', LONG);
  const own = path.join(tmp, 'ratchet-suppressions.json');
  exec('pnpm', ['exec', 'eslint', '--config', 'eslint.metrics.config.js',
    '--suppressions-location', own, '--suppress-all', file]);
  assert.ok(fs.existsSync(own), 'база не записалась — храповик нечем проверить');
  const kept = probe('metrics', ['--paths', file, '--baseline', own]);
  assert.equal(kept.code, 0, 'нарушение из базы повалило гейт (храповик не работает):\n' + kept.out);

  /* Устаревшая запись (нарушение починили, строка в базе осталась) гейт не валит, а
   * обрезка её снимает: иначе починка кода требовала бы правки гейт-файла, которую
   * тот же гейт и запрещает без трейлера. */
  write(path.join(ROOT, file), 'export const one = 1;\n');
  const stale = probe('metrics', ['--paths', file, '--baseline', own]);
  assert.equal(stale.code, 0, 'устаревшая запись базы повалила гейт:\n' + stale.out);
  const copy = path.join(tmp, 'ratchet-pruned.json');
  fs.copyFileSync(own, copy);
  const pruned = exec('pnpm', ['exec', 'eslint', '--config', 'eslint.metrics.config.js',
    '--suppressions-location', copy, '--prune-suppressions', file]);
  assert.equal(pruned.code, 0, 'обрезка базы не прошла:\n' + pruned.out.slice(0, 600));
  assert.deepEqual(readJson(copy), {}, 'обрезка не сняла устаревшую запись');
});

test('нарушение, которого в дереве нет, датчик всё равно называет', () => {
  // База гейта берётся из репозитория, поэтому «датчик живой» проверяется на файле,
  // которого в ней быть не может.
  // Проба «датчик живой»: файл, которого нет в базе, с нарушением — красный.
  const res = probe('metrics', ['--paths', scratch('src/plain.js', LONG)]);
  assert.equal(res.code, 1, 'новое нарушение не покрасило датчик:\n' + res.out);
  assert.match(res.out, /новых нарушений 1/, 'датчик не назвал число новых нарушений:\n' + res.out);
});

/* Разбор модуля — цена, а не строгость. Гард компиляции обязан понимать модуль
 * (`import`/`export` в `.js` — обычное дело у проекта с бандлером), но разбор
 * модуля стоил запуска Node на каждую клетку (86–97 мс), то есть минуты на
 * истории, где модуль меняется каждым коммитом. Теперь модуль разбирает один
 * рабочий поток на прогон (`src/parse.js`), а запуск остаётся отступлением.
 *
 * Здесь проверяется то, что делает ускорение законным: разбор идёт потоком, а не
 * тихим отступлением; оба пути дают один и тот же вердикт на одних и тех же
 * текстах; отступление работает без файла потока — тем же вердиктом, а не
 * молчанием; сотни разборов в одном прогоне дешевле одного запуска Node.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { moduleError, parseMode } from '../src/parse.js';
import { ROOT, tempDir } from '../tools/harness.js';

const tmp = tempDir('guard');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* Образцы — по одному на каждую развилку разбора: модуль, скрипт, модуль с
 * верхнеуровневым `await`, пустой модуль, битый модуль, битый оператор,
 * незакрытый шаблон и разметка прямо в `.js` (её гард и обязан отличить от своей
 * поломки). */
const SAMPLES = [
  'export const a = 1;\n',
  'const a = 1;\n',
  'export const b = await Promise.resolve(1);\n',
  'export {};\n',
  'export function f() { return 1; }\n',
  'export const a = <div/>;\n',
  'export const a = 1;\nconst b = ;\n',
  'export const a = `текст;\n'
];

/* Копия одного `parse.js` без файла потока — так выглядит неполная упаковка:
 * `parse-worker.js` не доехал. Разбор обязан остаться прежним: тем же вердиктом,
 * а не молчанием и не стеком. */
function withoutThread() {
  const dir = path.join(tmp, 'no-worker');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'src', 'parse.js'), path.join(dir, 'parse.js'));
  return import(path.join(dir, 'parse.js'));
}

test('разбор модуля идёт рабочим потоком, а не запуском', () => {
  assert.equal(moduleError(SAMPLES[0]), null, 'модуль не разобрался');
  assert.match(moduleError(SAMPLES[5]), /^SyntaxError/, 'битый модуль прошёл молча');
  assert.equal(parseMode(), 'thread', 'разбор ушёл в запуск Node — ускорения нет');
});

test('оба пути разбора дают один и тот же вердикт', async () => {
  const fallback = await withoutThread();
  SAMPLES.forEach((text) => {
    assert.equal(moduleError(text), fallback.moduleError(text),
      'разбор потоком и запуском разошлись на ' + JSON.stringify(text));
  });
  assert.equal(parseMode(), 'thread', 'быстрый путь перестал быть потоком');
  assert.equal(fallback.parseMode(), 'node', 'отступление не сработало: разбирал поток');
});

test('сотни разборов дешевле одного запуска Node', () => {
  const started = performance.now();
  for (let i = 0; i < 300; i++) moduleError('export const a = ' + i + ';\n');
  const spent = performance.now() - started;
  assert.equal(parseMode(), 'thread');
  // Отступление стоит 86–97 мс на разбор, поэтому те же 300 текстов прежним
  // путём заняли бы около 26 с. Порог намеренно грубый: проверка стережёт
  // порядок цены, а не такт машины.
  assert.ok(spent < 1000,
    '300 разборов заняли ' + spent.toFixed(0) + ' мс — это похоже на запуск на каждый текст');
});

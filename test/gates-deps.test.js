/* Проба датчика связей (`pnpm run deps`): кольцо, сирота и неразрешимый импорт обязаны
 * красить прогон, а простая связка — быть зелёной. Искусственные деревья собираются во
 * временном каталоге: правила датчика проверяются на маленьком графе, где находка
 * видна целиком, а не в графе пакета из восьми десятков модулей.
 *
 * Проба берёт **настоящий путь** временного каталога (`tempDir` в
 * `tools/gate-probe.js`): на macOS `/tmp` — ссылка, и разборщик связей считает один
 * файл под двумя путями двумя модулями — тогда «сирота» появляется там, где её нет.
 *
 * Каждый случай — файлы, ожидаемый код и (для красных) ожидаемое правило: общая часть
 * проб вынесена в `verdictOf`, иначе четыре пробы были бы почти одной и той же.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { probe, tempDir, write } from '../tools/gate-probe.js';

const tmp = tempDir('deps');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const A = "import { b } from './b.js';\nexport const a = b + 1;\n";
const B = 'export const b = 1;\n';
const CYCLE = "import { a } from './a.js';\nexport const b = a + 1;\n";
const GONE = "import { gone } from './gone.js';\nexport const a = gone;\n";
const LONELY = 'export const lonely = 1;\n';

/* Граф из нескольких файлов своего каталога за один вызов. */
function verdictOf(name, files) {
  const dir = path.join(tmp, name);
  Object.keys(files).forEach((f) => write(path.join(dir, f), files[f]));
  return probe('deps', ['--paths', path.join(dir, 'src')]);
}

function expectVerdict(name, files, code, rule) {
  const res = verdictOf(name, files);
  assert.equal(res.code, code, (code === 0 ? 'исправный граф покрашен' : 'находка прошла молча')
    + ' (' + name + '):\n' + res.out);
  if (rule !== null) {
    assert.match(res.out, new RegExp(rule), 'находка не названа правилом ' + rule + ':\n' + res.out);
  }
}

test('связка из двух модулей зелёная', () => {
  const res = verdictOf('linked', { 'src/a.js': A, 'src/b.js': B });
  assert.equal(res.code, 0, 'исправная связка покрашена:\n' + res.out);
  assert.match(res.out, /находок нет/, 'датчик не сказал про чистый граф:\n' + res.out);
});

test('кольцо связей красит прогон', () => {
  expectVerdict('cycle', { 'src/a.js': A, 'src/b.js': CYCLE }, 1, 'no-circular');
});

test('сирота красит прогон', () => {
  expectVerdict('orphan', { 'src/lonely.js': LONELY }, 1, 'no-orphans');
});

test('связь в несуществующий модуль красит прогон', () => {
  expectVerdict('broken', { 'src/a.js': GONE }, 1, 'not-to-unresolvable');
});

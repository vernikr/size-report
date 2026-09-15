/* Проба датчика дублей (`pnpm run dup`): копия обязана красить прогон, а база —
 * держать уже живущие в дереве клоны. Проба идёт на своём маленьком дереве во
 * временном каталоге, а не на репозитории: так проверяются и храповик, и
 * переносимость базы, и ничего не приходится трогать в рабочем дереве.
 *
 * Копия берётся **целым файлом** (две одинаковые функции-модуля), и это не
 * случайность: участок, вырезанный из середины функции, не разбирается, а пары
 * функций jscpd сравнивает по дереву разбора — проба из обрезанного участка
 * доказала бы не то, что работает в коммите (`tools/gates/dup.js`, шапка).
 *
 * Отдельно проверяется то, ради чего база сделана по содержимому: та же база,
 * применённая к тому же дереву в другом каталоге, остаётся зелёной. Родная база
 * jscpd этого не умеет — на копии дерева она объявляет все клоны новыми.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { probe, readJson, tempDir, write } from '../tools/gate-probe.js';

const tmp = tempDir('dup');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* Копируемый модуль: тринадцать строк разбирающегося кода — больше и `minLines`, и
 * `minTokens`. */
const MODULE = [
  'export function alpha(a, b) {',
  '  const x = a + b;',
  '  const y = x * 2;',
  '  return { x: x, y: y };',
  '}',
  'export function beta(list) {',
  '  const out = [];',
  '  list.forEach((n) => { if (n > 0) out.push(n * 3); });',
  '  return out;',
  '}',
  'export function gamma(s) {',
  '  return s.split("").reverse().join("");',
  '}',
  ''
].join('\n');
const OTHER = ['export function delta(n) {', '  return n - 1;', '}', 'export function epsilon() {',
  '  return Object.keys({ a: 1 }).length;', '}', ''].join('\n');

function tree(name, files) {
  const dir = path.join(tmp, name);
  Object.keys(files).forEach((f) => write(path.join(dir, f), files[f]));
  return dir;
}

const first = tree('first', { 'src/one.js': MODULE, 'src/two.js': MODULE, 'tools/other.js': OTHER });
const paths = first + '/src,' + first + '/tools';
const baseline = path.join(tmp, 'baseline.json');

test('база снимается, и живущий клон гейт не валит', () => {
  const made = probe('dup', ['--update', '--baseline', baseline, '--paths', paths]);
  assert.equal(made.code, 0, 'база дублей не снялась:\n' + made.out);
  const fingerprints = Object.keys(readJson(baseline).fingerprints);
  assert.equal(fingerprints.length, 1, 'в базе не один отпечаток на два одинаковых файла');

  const clean = probe('dup', ['--baseline', baseline, '--paths', paths, '--no-ref']);
  assert.equal(clean.code, 0, 'клон из базы повалил гейт (храповик не работает):\n' + clean.out);
});

test('новая копия красит гейт', () => {
  write(path.join(first, 'src/three.js'), MODULE);
  const red = probe('dup', ['--baseline', baseline, '--paths', paths, '--no-ref']);
  assert.equal(red.code, 1, 'третья копия того же модуля прошла молча:\n' + red.out);
  assert.match(red.out, /новых клонов 1/, 'гейт не назвал число новых клонов:\n' + red.out);
  fs.rmSync(path.join(first, 'src/three.js'));
});

test('база переносима: то же дерево в другом каталоге остаётся зелёным', () => {
  const copy = tree('copy', { 'src/one.js': MODULE, 'src/two.js': MODULE, 'tools/other.js': OTHER });
  const again = probe('dup', ['--baseline', baseline,
    '--paths', copy + '/src,' + copy + '/tools', '--no-ref']);
  assert.equal(again.code, 0, 'база привязана к пути выкладки — на копии дерева она красная:\n'
    + again.out);
});

test('без базы датчик отказывает, а не зеленеет', () => {
  const none = probe('dup', ['--baseline', path.join(tmp, 'нет-такого.json'),
    '--paths', paths, '--no-ref']);
  assert.equal(none.code, 1, 'отсутствие базы принято за чистое дерево:\n' + none.out);
  assert.match(none.out, /базы нет/, 'отказ не назвал причину:\n' + none.out);
});

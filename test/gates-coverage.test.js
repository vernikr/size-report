/* Проба датчика покрытия (`pnpm run cover`). Снятие покрытия стоит полный набор под
 * c8 (десятки секунд) и живёт в slow-профиле, поэтому здесь проверяется то, что
 * решает вердикт, — сравнение базы со снятым покрытием, — на готовых отчётах в
 * формате c8 (`json-summary`). Это тот же формат, что датчик читает в slow-профиле,
 * поэтому шов «отчёт c8 → вердикт» проверен, а не обойдён.
 *
 * Храповик проверяется с двух сторон: просадка ниже своей же базы — красный; новый
 * исходник, который ни разу не выполнился, — тоже; новый файл с покрытием — зелено.
 * Плюс отдельно сверяется, что база не разошлась с деревом: файл, названный в базе,
 * обязан быть в дереве, а исходники `src`/`bin` — в базе (иначе новую папку или
 * смену расширения покрытие пропустит тихо, а храповик станет пустым).
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, git, probe, readJson, tempDir, write } from '../tools/gate-probe.js';

const tmp = tempDir('cover');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* Отчёт в форме c8: на файл — четыре метрики по `{ total, covered, skipped, pct }`. */
function point(lines, branches, functions) {
  const one = (pct) => ({ total: 10, covered: Math.round(pct / 10), skipped: 0, pct: pct });
  return { lines: one(lines), statements: one(lines), functions: one(functions), branches: one(branches) };
}

function summary(files) {
  const all = Object.assign({}, files);
  all.total = point(70, 60, 50);
  return all;
}

function verdict(name, current, base) {
  const file = path.join(tmp, name + '-summary.json');
  const baseline = path.join(tmp, name + '-baseline.json');
  write(file, JSON.stringify(current, null, 2) + '\n');
  write(baseline, JSON.stringify({ schema: 1, suite: 'full', files: base }, null, 2) + '\n');
  return probe('coverage', ['--summary', file, '--baseline', baseline]);
}

test('храповик: своё покрытие зелено, просадка красна', () => {
  const base = { 'src/x.js': { lines: 80, branches: 70, functions: 60 } };
  const same = verdict('same', summary({ 'src/x.js': point(80, 70, 60) }), base);
  assert.equal(same.code, 0, 'своё же покрытие объявлено просадкой:\n' + same.out);

  const down = verdict('down', summary({ 'src/x.js': point(50, 70, 60) }), base);
  assert.equal(down.code, 1, 'падение строк ниже базы прошло молча:\n' + down.out);
  assert.match(down.out, /src\/x\.js — lines: было 80, стало 50/,
    'просадка названа не по файлу и метрике:\n' + down.out);

  const branch = verdict('branch', summary({ 'src/x.js': point(80, 40, 60) }), base);
  assert.equal(branch.code, 1, 'падение ветвей ниже базы прошло молча (а ветви важнее строк):\n'
    + branch.out);
});

test('новый непокрытый исходник красный, новый покрытый — зелёный', () => {
  const base = { 'src/x.js': { lines: 80, branches: 70, functions: 60 } };
  const blind = verdict('blind', summary({
    'src/x.js': point(80, 70, 60), 'src/new.js': point(0, 0, 0)
  }), base);
  assert.equal(blind.code, 1, 'новый исходник без единого выполнения прошёл молча:\n' + blind.out);
  assert.match(blind.out, /src\/new\.js — lines: было не в базе, стало 0/,
    'новый непокрытый файл назван не по файлу:\n' + blind.out);

  const covered = verdict('covered', summary({
    'src/x.js': point(80, 70, 60), 'src/new.js': point(90, 80, 70)
  }), base);
  assert.equal(covered.code, 0, 'новый покрытый файл объявлен просадкой:\n' + covered.out);
});

test('база покрытия сходится с деревом', () => {
  const baseline = readJson(path.join(ROOT, 'coverage-baseline.json'));
  const named = Object.keys(baseline.files);
  assert.ok(named.length > 0, 'база покрытия пуста — тогда она ничего не стережёт');

  const tracked = git(['ls-files', 'src', 'bin']).out
    .split('\n').filter((f) => f.endsWith('.js'));
  assert.deepEqual(named.filter((f) => tracked.indexOf(f) < 0), [],
    'в базе покрытия есть файлы, которых в дереве нет: почините базу человеком'
      + ' (`pnpm run baseline:coverage`)');
  assert.deepEqual(tracked.filter((f) => named.indexOf(f) < 0), [],
    'в дереве есть исходники, которых нет в базе покрытия: снятие покрытия их не видит'
      + ' (проверьте `include` в `.c8rc.json` и обновите базу)');
});

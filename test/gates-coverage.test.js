/* A probe of the coverage sensor (`pnpm run cover`). Taking coverage costs the whole suite under c8 and
 * lives in the slow profile, so what is checked here is what decides the verdict — the baseline compared
 * with the coverage taken — on ready-made reports in c8's format (`json-summary`). That is the same format
 * the sensor reads in the slow profile, so the "c8 report → verdict" seam is checked rather than skipped.
 *
 * The ratchet is checked from two sides: a drop below its own baseline — red; a new source file that never
 * ran — red too; a new file with coverage — green. On top of that the baseline is compared with the tree:
 * a file named in the baseline has to be in the tree, and the sources of `src`/`bin` have to be in the
 * baseline (otherwise a new directory or a changed extension would slip past coverage, and the ratchet
 * would come out empty).
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, git, probe, readJson, tempDir, write } from '../tools/gate-probe.js';

const tmp = tempDir('cover');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* A report in c8's shape: per file, four metrics of `{ total, covered, skipped, pct }`. */
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

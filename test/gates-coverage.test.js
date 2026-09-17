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

test('the ratchet: its own coverage is green, a fall is red', () => {
  const base = { 'src/x.js': { lines: 80, branches: 70, functions: 60 } };
  const same = verdict('same', summary({ 'src/x.js': point(80, 70, 60) }), base);
  assert.equal(same.code, 0, 'its own coverage was declared a fall:\n' + same.out);

  const down = verdict('down', summary({ 'src/x.js': point(50, 70, 60) }), base);
  assert.equal(down.code, 1, 'a fall of lines below the baseline passed in silence:\n' + down.out);
  assert.match(down.out, /src\/x\.js — lines: was 80, now 50/,
    'the fall is not named by file and metric:\n' + down.out);

  const branch = verdict('branch', summary({ 'src/x.js': point(80, 40, 60) }), base);
  assert.equal(branch.code, 1, 'a fall of branches below the baseline passed in silence (and branches matter more than lines):\n'
    + branch.out);
});

test('a new uncovered source is red, a new covered one green', () => {
  const base = { 'src/x.js': { lines: 80, branches: 70, functions: 60 } };
  const blind = verdict('blind', summary({
    'src/x.js': point(80, 70, 60), 'src/new.js': point(0, 0, 0)
  }), base);
  assert.equal(blind.code, 1, 'a new source without a single execution passed in silence:\n' + blind.out);
  assert.match(blind.out, /src\/new\.js — lines: was not in the baseline, now 0/,
    'a new uncovered file is not named by file:\n' + blind.out);

  const covered = verdict('covered', summary({
    'src/x.js': point(80, 70, 60), 'src/new.js': point(90, 80, 70)
  }), base);
  assert.equal(covered.code, 0, 'a new covered file was declared a fall:\n' + covered.out);
});

test('the coverage baseline agrees with the tree', () => {
  const baseline = readJson(path.join(ROOT, 'coverage-baseline.json'));
  const named = Object.keys(baseline.files);
  assert.ok(named.length > 0, 'the coverage baseline is empty — then it guards nothing');

  const tracked = git(['ls-files', 'src', 'bin']).out
    .split('\n').filter((f) => f.endsWith('.js'));
  assert.deepEqual(named.filter((f) => tracked.indexOf(f) < 0), [],
    'the coverage baseline holds files the tree does not: repair the baseline by hand'
      + ' (`pnpm run baseline:coverage`)');
  assert.deepEqual(tracked.filter((f) => named.indexOf(f) < 0), [],
    'the tree holds sources the coverage baseline does not: taking coverage does not see them'
      + ' (check `include` in `.c8rc.json` and update the baseline)');
});

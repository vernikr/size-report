/* A probe of the coverage sensor (`pnpm run cover`). Taking coverage costs the whole suite under c8 and
 * lives in the slow profile, so what is checked here is what decides the verdict — the baseline compared
 * with the coverage taken — on ready-made reports in c8's format (`json-summary`). That is the same format
 * the sensor reads in the slow profile, so the "c8 report → verdict" seam is checked rather than skipped.
 *
 * **The unit of the ratchet is the executed count, and the probe holds both halves of that decision:**
 * fewer executed lines than the baseline — red, down to a single line; **a file that grew while its
 * executions stayed the same — green**, which is the case a share-based ratchet got wrong (a share falls
 * when the total rises, so a reformatting reddened it). On top of the ratchet: a new source file that
 * never ran — red; a new file with coverage — green; and the baseline is compared with the tree, so a
 * file named in it has to be in the tree and the sources of `src`/`bin` have to be in the baseline
 * (otherwise a new directory or a changed extension would slip past coverage, and the ratchet would come
 * out empty).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ROOT, git, probe, readJson, tempDir, write } from '../tools/gate-probe.js';

const tmp = tempDir('cover');

/* A report in c8's shape: per file, four metrics of `{ total, covered, skipped, pct }`. The arguments
 * are the **executed counts** — the unit the ratchet compares — and `extra` pads the totals, which is how
 * a file that grew without losing an execution is written down. */
function point(lines, branches, functions, extra) {
  const one = (covered) => ({
    total: covered + 10 + (extra || 0),
    covered: covered,
    skipped: 0,
    pct: Math.round(covered / (covered + 10 + (extra || 0)) * 10000) / 100
  });
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

  // The ratchet counts rather than shares, so one execution less is already a regression.
  const single = verdict('single', summary({ 'src/x.js': point(79, 70, 60) }), base);
  assert.equal(single.code, 1, 'one executed line less than the baseline passed in silence:\n' + single.out);
  assert.match(single.out, /src\/x\.js — lines: was 80, now 79/,
    'the single-line fall is not named by file and count:\n' + single.out);

  /* ...and the case the unit was chosen for: the file grew, every execution it had is still there, and
   * the share fell — which is how a translated literal split into a two-line concatenation looked. */
  const grown = verdict('grown', summary({ 'src/x.js': point(80, 70, 60, 40) }), base);
  assert.equal(grown.code, 0, 'a file that grew without losing an execution was declared a fall:\n' + grown.out);
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

/* A probe of the duplication sensor (`pnpm run dup`): a copy has to colour the run, while the baseline
 * has to hold the clones already living in the tree. The probe runs on a small tree of its own in a
 * temporary directory rather than on the repository: that way the ratchet and the portability of the
 * baseline are both checked, and nothing in the working tree is touched.
 *
 * A copy is taken as **a whole file** (two identical functions-modules), and that is no accident: a
 * stretch cut out of the middle of a function does not parse, and jscpd compares function pairs by parse
 * tree — a probe made of a cut stretch would prove something other than what runs in a commit
 * (`tools/gates/dup.js`, its header).
 *
 * Separately checked is the portability of the baseline: the same baseline applied to the same tree in
 * another directory stays green, because the fingerprint is taken from the clone's content rather than
 * from its place. The file itself is the project's own — a schema, the config name and a note a person
 * reads — and `gatefiles` guards it, which is the reason for not leaning on a baseline file of jscpd's
 * own (measured: a jscpd baseline survives a moved tree as well, but it carries nothing but versions and
 * fingerprints, and no gate protects it).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { probe, readJson, tempDir, write } from '../tools/gate-probe.js';

const tmp = tempDir('dup');

/* The module to be copied: thirteen lines of parsing code — above both `minLines` and `minTokens`. */
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

test('the baseline is taken, and a clone it holds does not bring the gate down', () => {
  const made = probe('dup', ['--update', '--baseline', baseline, '--paths', paths]);
  assert.equal(made.code, 0, 'the baseline of twins was not taken:\n' + made.out);
  const fingerprints = Object.keys(readJson(baseline).fingerprints);
  assert.equal(fingerprints.length, 1, 'the baseline does not hold one fingerprint for two identical files');

  const clean = probe('dup', ['--baseline', baseline, '--paths', paths, '--no-ref']);
  assert.equal(clean.code, 0, 'a clone from the baseline brought the gate down (the ratchet does not work):\n' + clean.out);
});

test('a new copy paints the gate', () => {
  write(path.join(first, 'src/three.js'), MODULE);
  const red = probe('dup', ['--baseline', baseline, '--paths', paths, '--no-ref']);
  assert.equal(red.code, 1, 'a third copy of the same module passed in silence:\n' + red.out);
  assert.match(red.out, /new clones 1/, 'the gate did not name the number of new clones:\n' + red.out);
  fs.rmSync(path.join(first, 'src/three.js'));
});

test('the baseline is portable: the same tree in another directory stays green', () => {
  const copy = tree('copy', { 'src/one.js': MODULE, 'src/two.js': MODULE, 'tools/other.js': OTHER });
  const again = probe('dup', ['--baseline', baseline,
    '--paths', copy + '/src,' + copy + '/tools', '--no-ref']);
  assert.equal(again.code, 0, 'the baseline is tied to the path of the working tree — on a copy of the tree it is red:\n'
    + again.out);
});

test('with no baseline the sensor refuses rather than turns green', () => {
  const none = probe('dup', ['--baseline', path.join(tmp, 'нет-такого.json'),
    '--paths', paths, '--no-ref']);
  assert.equal(none.code, 1, 'a missing baseline was taken for a clean tree:\n' + none.out);
  assert.match(none.out, /no baseline/, 'the refusal did not name the cause:\n' + none.out);
});

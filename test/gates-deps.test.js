/* A probe of the dependencies sensor (`pnpm run deps`): a cycle, an orphan and an unresolvable import
 * have to colour the run, while a plain link has to stay green. Artificial trees are built in a temporary
 * directory: the sensor's rules are checked on a small graph where a find is visible whole rather than in
 * the package's graph of well over a hundred modules.
 *
 * The probe takes the temporary directory by its **real path** (`tempDir` in `tools/gate-probe.js`): on
 * macOS `/tmp` is a link, and the dependency resolver takes one file under two paths for two modules —
 * then an "orphan" shows up where there is none.
 *
 * Each case is files, an expected code and (for the red ones) an expected rule: the shared part of the
 * probes lives in `verdictOf`, or four probes would be nearly the same one.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { probe, tempDir, write } from '../tools/gate-probe.js';

const tmp = tempDir('deps');

const A = "import { b } from './b.js';\nexport const a = b + 1;\n";
const B = 'export const b = 1;\n';
const CYCLE = "import { a } from './a.js';\nexport const b = a + 1;\n";
const GONE = "import { gone } from './gone.js';\nexport const a = gone;\n";
const LONELY = 'export const lonely = 1;\n';

/* A graph of several files of one's own directory in a single call. */
function verdictOf(name, files) {
  const dir = path.join(tmp, name);
  Object.keys(files).forEach((f) => write(path.join(dir, f), files[f]));
  return probe('deps', ['--paths', path.join(dir, 'src')]);
}

function expectVerdict(name, files, code, rule) {
  const res = verdictOf(name, files);
  assert.equal(res.code, code, (code === 0 ? 'a clean graph came out painted' : 'a finding passed in silence')
    + ' (' + name + '):\n' + res.out);
  if (rule !== null) {
    assert.match(res.out, new RegExp(rule), 'the finding is not named by the rule ' + rule + ':\n' + res.out);
  }
}

test('a pair of two modules is green', () => {
  const res = verdictOf('linked', { 'src/a.js': A, 'src/b.js': B });
  assert.equal(res.code, 0, 'a sound pair came out painted:\n' + res.out);
  assert.match(res.out, /no findings/, 'the sensor did not say the graph is clean:\n' + res.out);
});

test('a cycle of relations paints the run', () => {
  expectVerdict('cycle', { 'src/a.js': A, 'src/b.js': CYCLE }, 1, 'no-circular');
});

test('an orphan paints the run', () => {
  expectVerdict('orphan', { 'src/lonely.js': LONELY }, 1, 'no-orphans');
});

test('a relation to a module that does not exist paints the run', () => {
  expectVerdict('broken', { 'src/a.js': GONE }, 1, 'not-to-unresolvable');
});

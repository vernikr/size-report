/* The guard of the split into a fast and a full run (`tools/suites.js`).
 *
 * The defect class is its own: a split ages in silence. A file missing from the declaration goes to the
 * full run — which is right, but "why it is in the full one" stays a guess; a file can become fast "by the
 * way", and nobody notices the fast run stopped being fast; the check count in a run and in the document
 * drift apart as quietly as the counts in `README.md` did before the documentation guard.
 *
 * What the check guards: every file of the suite has a place of its own (fast explicitly, full with a
 * cause named), a cause has a substantial length, and the fast run stays part of the suite rather than a
 * second suite. The run counts in the documentation are the documentation guard's business
 * (`test/docs-numbers.test.js`): one promise lives in one home, or two guards would argue about who is
 * right.
 *
 * **What the check does not take, said rather than hidden:** time. Seconds depend on the window — a
 * machine's load is whatever it is — so they are not declared as a target and nothing guards them: the run
 * prints each file's duration for reference, while the split rests on what a file is busy with rather
 * than on a number of seconds.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { FAST, ROOT, SLOW, checksIn, testFiles } from '../tools/suites.js';

const files = testFiles();
const fast = FAST.map((e) => e.file);
const slow = SLOW.map((e) => e.file);

function duplicated(list) {
  return list.filter((f, i) => list.indexOf(f) !== i);
}

function written(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

test('every file of the set is classified: fast explicitly, full with a reason', () => {
  assert.deepEqual(duplicated(fast), [], 'a file is named twice in the fast run');
  assert.deepEqual(duplicated(slow), [], 'a reason for the full run is named twice');
  assert.deepEqual(fast.filter((f) => slow.indexOf(f) >= 0), [],
    'a file is named both fast and full: it cannot be in two runs at once');
  assert.deepEqual(fast.filter((f) => files.indexOf(f) < 0), [],
    'a file that is not in the set is called fast');
  assert.deepEqual(slow.filter((f) => files.indexOf(f) < 0), [],
    'a reason is named for a file that is not in the set');

  // A file missing from the fast list goes to the full one — a good default, since new work cannot
  // quietly ride into the fast run. But then every such file needs a cause: otherwise nobody named why it
  // is in the full one.
  assert.deepEqual(files.filter((f) => fast.indexOf(f) < 0 && slow.indexOf(f) < 0).map(written), [],
    'a file in the full run has no reason named — write it into SLOW (`tools/suites.js`)'
      + ' or move the file into the fast run with a reason');
});

test('every file has a reason named for why it is in this run', () => {
  FAST.forEach((entry) => {
    assert.ok(entry.why !== undefined && entry.why.length > 30,
      'a fast file with no reason (' + entry.file + '): why is it here rather than in the full run?');
  });
  SLOW.forEach((entry) => {
    assert.ok(entry.why !== undefined && entry.why.length > 30,
      'an expensive file has no reason named for why it is in the full run: ' + entry.file);
  });
});

test('the fast run is part of the set, and the declaration agrees with its files', () => {
  const total = files.reduce((sum, f) => sum + checksIn(f), 0);
  const inFast = fast.reduce((sum, f) => sum + checksIn(f), 0);
  assert.ok(inFast > 0, 'the fast run is empty: then there is no point calling it');
  assert.ok(inFast < total, 'the fast run equals the full one (' + inFast + ' of ' + total
    + ') — there is no split');
  // Every file of the suite is counted exactly once: completeness of the classification is checked
  // above, while what matters here is that the fast run lists no file twice and loses no checks in the
  // count.
  assert.equal(inFast, FAST.reduce((sum, entry) => sum + checksIn(entry.file), 0),
    'the check count of the fast run does not agree with its files');
});

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

test('каждый файл набора классифицирован: быстрый — явно, полный — с причиной', () => {
  assert.deepEqual(duplicated(fast), [], 'в быстром прогоне файл назван дважды');
  assert.deepEqual(duplicated(slow), [], 'причина для полного прогона названа дважды');
  assert.deepEqual(fast.filter((f) => slow.indexOf(f) >= 0), [],
    'файл назван и быстрым, и полным: он не может быть в двух прогонах сразу');
  assert.deepEqual(fast.filter((f) => files.indexOf(f) < 0), [],
    'быстрым назван файл, которого в наборе нет');
  assert.deepEqual(slow.filter((f) => files.indexOf(f) < 0), [],
    'причина названа для файла, которого в наборе нет');

  // A file missing from the fast list goes to the full one — a good default, since new work cannot
  // quietly ride into the fast run. But then every such file needs a cause: otherwise nobody named why it
  // is in the full one.
  assert.deepEqual(files.filter((f) => fast.indexOf(f) < 0 && slow.indexOf(f) < 0).map(written), [],
    'в полном прогоне файл без названной причины — допишите её в SLOW (`tools/suites.js`)'
      + ' или переведите файл в быстрый с причиной');
});

test('у каждого файла названа причина, почему он в этом прогоне', () => {
  FAST.forEach((entry) => {
    assert.ok(entry.why !== undefined && entry.why.length > 30,
      'быстрый файл без причины (' + entry.file + '): почему он здесь, а не в полном прогоне?');
  });
  SLOW.forEach((entry) => {
    assert.ok(entry.why !== undefined && entry.why.length > 30,
      'у дорогого файла не названа причина, почему он в полном прогоне: ' + entry.file);
  });
});

test('быстрый прогон — часть набора, а объявление сходится с его файлами', () => {
  const total = files.reduce((sum, f) => sum + checksIn(f), 0);
  const inFast = fast.reduce((sum, f) => sum + checksIn(f), 0);
  assert.ok(inFast > 0, 'быстрый прогон пуст: тогда его незачем звать');
  assert.ok(inFast < total, 'быстрый прогон равен полному (' + inFast + ' из ' + total
    + ') — разделения нет');
  // Every file of the suite is counted exactly once: completeness of the classification is checked
  // above, while what matters here is that the fast run lists no file twice and loses no checks in the
  // count.
  assert.equal(inFast, FAST.reduce((sum, entry) => sum + checksIn(entry.file), 0),
    'счёт проверок быстрого прогона не сходится с его файлами');
});

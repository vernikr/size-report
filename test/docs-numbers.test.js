/* The promise that **the numbers named match the fact**: the check count in `README.md` is the real
 * one, that is, how many checks are declared in the suite's files (`tools/suites.js`). The count holds
 * because a check is declared at the start of a line: a declaration inside a loop would make the number
 * a derivation from the code, and the documentation would have nothing to rest on (the file's first
 * check watches that).
 *
 * There are two runs and each has a count of its own — otherwise the fast run would stop being fast in
 * silence, and the document would speak of a split nobody holds.
 *
 * **There are no time targets here, and that is said rather than hidden:** seconds depend on the window
 * (a machine's load is whatever it is), so a run does not fail on time and the document promises no
 * seconds — there is nothing to check against.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../tools/harness.js';
import { FAST, checksIn, testFiles } from '../tools/suites.js';
import { publishedRuns, read } from '../tools/docs-facts.js';

test('числа проверок в документации совпадают с фактом', () => {
  // Check declarations, file by file. The count holds because a check is declared at the start of a
  // line: a declaration inside a loop would make the number a derivation from the code, and the
  // documentation would have nothing to rest on.
  const nested = [];
  fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /\.test\.js$/.test(f)).forEach((f) => {
    read(path.join('test', f)).split('\n').forEach((line, i) => {
      if (/^\s+test\(/.test(line)) nested.push('test/' + f + ':' + (i + 1));
    });
  });
  assert.deepEqual(nested, [],
    'проверка объявлена не в начале строки — число проверок нельзя прочесть по файлам:\n  '
    + nested.join('\n  '));

  const total = testFiles().reduce((sum, f) => sum + checksIn(f), 0);
  const quick = FAST.reduce((sum, entry) => sum + checksIn(entry.file), 0);

  // README names both runs as a table: the command and how many checks it takes.
  const runs = publishedRuns();
  assert.ok(runs.fast !== null, 'README не называет быстрый прогон: `pnpm test` — сколько'
    + ' проверок из скольких');
  assert.ok(runs.full !== null, 'README не называет полный прогон: `pnpm test:all` — сколько'
    + ' проверок');
  assert.equal(runs.fast.checks, quick, 'README обещает быстрому прогону ' + runs.fast.checks
    + ' проверок, а в быстрых файлах их ' + quick);
  assert.equal(runs.fast.total, total, 'README называет в наборе ' + runs.fast.total
    + ' проверок, а в файлах их ' + total);
  assert.equal(runs.full.checks, total, 'README обещает полному прогону ' + runs.full.checks
    + ' проверок, а в файлах их ' + total);
});

/* Reading a process's output: chunks are joined as buffers rather than appended to a string.
 *
 * A chunk arrives where the kernel returned it, and in output of hundreds of kilobytes a multi-byte
 * character does land on the boundary between chunks now and then. Joined by string, the letter turns
 * into replacement characters, and the failure comes at a random spot because nothing depends on the
 * spot. The mechanism is what is checked, not a current defect: the letter is written by two `write()`
 * calls, so the chunks are guaranteed to split it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { collectOutput } from '../tools/harness.js';

/* The split is between the bytes of one letter: the first half leaves at once, the second after a
 * delay, so the reader cannot join them into one chunk. */
const SPLIT = 'process.stdout.write(Buffer.from([0xd0]));'
  + 'setTimeout(() => { process.stdout.write(Buffer.from([0xb9]));'
  + 'process.stdout.write("-конец\\n"); }, 30);';

test('куски вывода склеиваются буферами: разорванный символ уцелел', async () => {
  const res = await collectOutput(spawn(process.execPath, ['-e', SPLIT]));
  assert.equal(res.code, 0, 'процесс завершился кодом ' + res.code + ': ' + res.stderr.trim());
  assert.equal(res.stdout, 'й-конец\n',
    'символ на границе кусков развалился: ' + JSON.stringify(res.stdout)
      + ' — вывод склеивается как строки, а не как буферы');
});

test('чтение вывода отдаёт код, вывод и ошибки по отдельности', async () => {
  const res = await collectOutput(spawn(process.execPath,
    ['-e', 'process.stdout.write("из вывода"); process.stderr.write("из ошибок"); process.exit(3)']));
  assert.equal(res.code, 3, 'код выхода не тот');
  assert.equal(res.stdout, 'из вывода', 'вывод потерян или перемешан с ошибками');
  assert.equal(res.stderr, 'из ошибок', 'ошибки потеряны или перемешаны с выводом');
});

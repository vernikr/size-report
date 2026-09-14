/* Чтение вывода процесса: куски склеиваются буферами, а не приклеиваются к строке.
 *
 * Зачем отдельная проверка. Кусок приходит с потока там, где его вернуло ядро, и
 * на выводе в сотни килобайт многобайтовый символ нет-нет да и попадёт на границу
 * между кусками. Живой паритет падал именно на этом — вместо расхождения чисел
 * выходило «цена неза��исимости», два символа-заменителя вместо буквы, — и падал
 * на случайном месте, потому что от места не зависит ничего
 * (`WORKLOG.md` §21). Проверяется механизм, а не текущий дефект: буква пишется
 * двумя `write()`, чтобы куски гарантированно разошлись.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { collectOutput } from '../tools/harness.js';

/* Разрыв — между байтами одной буквы: первая половина уходит сразу, вторая с
 * задержкой, поэтому читатель их точно не склеит в один кусок. */
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

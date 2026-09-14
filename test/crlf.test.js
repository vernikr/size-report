/* Выкладка с переводами строк в CRLF — свидетель починки B2. При
 * `core.autocrlf=true` (значение по умолчанию в установке Git для Windows) git
 * выкладывает на диск CRLF, а в объектах держит LF; инструмент обязан видеть это
 * как обычную выкладку, а не как расхождение с историей и не отказываться
 * работать. Проверка сравнивает такую выкладку и с обычной, и с эталоном, а
 * собранный артефакт — по хешу: сверка с рабочим деревом не должна превратиться в
 * пустышку.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PACKAGE, SYNTH, firstDiff, gitIn, readRun, runFixtureWith, sha256, shaFileLine, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('crlf');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const goldenText = fs.readFileSync(path.join(SYNTH, 'golden.json'), 'utf8');

test('выкладка с переводами строк в CRLF не мешает сверке', () => {
  const dir = sharedClone('crlf', tmp);
  assert.ok(/\r\n/.test(fs.readFileSync(path.join(dir, 'src', 'code.js'), 'utf8')),
    'клон вышел без CRLF: это не то окружение, которое проверяем');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '',
    'git считает выкладку грязной: сверка такие файлы пропускает, и проверять нечего');

  const plain = readRun(PACKAGE, sharedClone('plain', tmp), ['--json']);
  const crlf = readRun(PACKAGE, dir, ['--json']);
  assert.equal(crlf.code, 0, 'при core.autocrlf=true инструмент отказался работать: '
    + crlf.stderr.trim().split('\n')[0]);
  assert.equal(crlf.stdout, plain.stdout, 'выкладка CRLF изменила числа: ' + firstDiff(crlf.stdout, plain.stdout));
  assert.equal(crlf.stdout, goldenText, 'выкладка CRLF разошлась с эталоном: ' + firstDiff(crlf.stdout, goldenText));

  const wrote = runFixtureWith(PACKAGE, dir, ['--write']);
  assert.equal(wrote.code, 0, 'сборка в выкладке CRLF не прошла: ' + wrote.stderr.trim().split('\n')[0]);
  assert.equal(sha256(fs.readFileSync(path.join(dir, 'docs', 'size-table.html'))),
    shaFileLine(path.join(SYNTH, 'artifact.sha256')),
    'артефакт в выкладке CRLF разошёлся с эталонным побайтово');
});

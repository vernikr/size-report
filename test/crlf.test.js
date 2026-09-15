/* A working tree with CRLF newlines — the witness of the fix for B2 (`BLOCKERS.md`). Under
 * `core.autocrlf=true` (the default of Git's installer for Windows) git lays CRLF on disk while
 * keeping LF in objects, and the tool has to read that as an ordinary working tree: neither as a
 * discrepancy with history nor a reason to refuse. The check compares such a tree's numbers with the
 * ordinary tree's and with the standard, and the report it builds with the one built in an ordinary
 * tree: the comparison against the working tree must not become an empty gesture.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG, PACKAGE, SYNTH, cloneFixture, firstDiff, gitIn, readRun, runFixtureWith, sha256, sharedClone, tempDir
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

  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const plainDir = cloneFixture(path.join(tmp, 'crlf-plain'));
  const wrote = runFixtureWith(PACKAGE, dir, ['--write']);
  assert.equal(wrote.code, 0, 'сборка в выкладке CRLF не прошла: ' + wrote.stderr.trim().split('\n')[0]);
  assert.equal(runFixtureWith(PACKAGE, plainDir, ['--write']).code, 0,
    'сборка в обычной выкладке не прошла');
  assert.equal(sha256(fs.readFileSync(path.join(dir, cfg.output))),
    sha256(fs.readFileSync(path.join(plainDir, cfg.output))),
    'отчёт в выкладке CRLF разошёлся с собранным в обычной выкладке побайтово');
});

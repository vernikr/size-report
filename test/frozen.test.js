/* The frozen copy of the engine: the very revision the standard was taken with, and the very bytes it
 * yields. It serves as a distinguisher: if the standard parted from both engines, the standard moved;
 * if only from the package, the package broke. The copy is not in the tree — its bytes live in history
 * and are fetched from there on demand — and what is fetched is compared with the record of the
 * standard's origin, so a "frozen" copy cannot quietly stop being one.
 *
 * The full reproduction of both standards by this copy is checked by `pnpm run check:standards` (it
 * takes them anew aside and compares bytes); what stays here is what the suite needs the check for: the
 * copy still yields the numbers written in the standard.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PARITY, SYNTH, firstDiff, frozenTarget, legacyTool, readJson, readRun, requireTarget,
  sha256, shaFileLine, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('frozen');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const golden = fs.readFileSync(path.join(SYNTH, 'golden.json'));
const goldenText = golden.toString('utf8');
const parityManifest = readJson(path.join(PARITY, 'manifest.json'));

const PLAIN = sharedClone('plain', tmp);
const FROZEN = frozenTarget();

test('замороженная копия — та ревизия, с которой снят эталон', () => {
  requireTarget(FROZEN);
  assert.equal(sha256(fs.readFileSync(legacyTool())), parityManifest.tool.sha256,
    'замороженная копия разошлась с ревизией, с которой снят эталон паритета');
  const synth = readJson(path.join(SYNTH, 'manifest.json'));
  assert.equal(synth.legacy.sha256, parityManifest.tool.sha256,
    'числа фикстуры сняты другой ревизией инструмента, чем числа живого проекта');
  assert.equal(sha256(golden), synth.legacy.goldenSha256,
    'файл эталонных чисел изменён после снятия');
});

/* A manifest is the record of what lies next to it, and it has to agree with the files: an edit of a
 * standard after it was taken would otherwise drift away silently, while both the port and the live
 * history are compared against these records. */
test('записанное в манифестах совпадает с файлами эталонов', () => {
  const synth = readJson(path.join(SYNTH, 'manifest.json'));
  Object.keys(synth.files).forEach((name) => {
    const file = path.join(SYNTH, name);
    assert.equal(fs.statSync(file).size, synth.files[name].bytes,
      'размер ' + name + ' не тот, что записан в манифесте фикстуры');
    assert.equal(sha256(fs.readFileSync(file)), synth.files[name].sha256,
      name + ' не тот, что записан в манифесте фикстуры (правился после снятия?)');
  });
  assert.equal(sha256(fs.readFileSync(path.join(PARITY, 'data.json'))), parityManifest.data.sha256,
    'числа эталона паритета не те, что записаны в его манифесте');
  assert.equal(sha256(fs.readFileSync(path.join(PARITY, 'config.json'))), parityManifest.config.sha256,
    'настройки эталона паритета не те, что записаны в его манифесте');
  assert.equal(shaFileLine(path.join(PARITY, 'artifact.sha256')), parityManifest.artifact.sha256,
    'артефакт эталона паритета не тот, что записан в его манифесте');
});

test('фикстура и живой проект сняты одним инструментом', () => {
  assert.equal(readJson(path.join(SYNTH, 'manifest.json')).legacy.file.split('/').pop(),
    parityManifest.tool.file.split('/').pop(),
    'эталоны сняты разными инструментами');
});

/* Its subject is the origin of the standard ("these numbers are what that revision yields"), not the
 * copy's behaviour, and the same claim whole and byte for byte is checked by
 * `pnpm run check:standards`, which takes both standards anew. What is left here is what the suite
 * sees without a re-take.
 *
 * The environment is the one the standard was taken in (the copy has no fix for B1), so agreement
 * under it is what checks the taking was pinned: take the standard without the pins and the numbers
 * would part here rather than silently in someone else's working tree. */
test('замороженная копия выдаёт те же числа, что записаны в эталоне', () => {
  requireTarget(FROZEN);
  const res = readRun(FROZEN, PLAIN, ['--json']);
  assert.equal(res.code, 0, 'копия не отдала --json (код ' + res.code + '): ' + res.stderr.trim());
  assert.equal(res.stdout, goldenText,
    'копия разошлась с эталоном — значит разошёлся эталон, а не движок пакета: '
      + firstDiff(res.stdout, goldenText));

  const asC = readRun(FROZEN, PLAIN, ['--json'], { LC_ALL: 'C', LANG: 'C' });
  assert.equal(asC.stdout, goldenText, 'под LC_ALL=C копия разошлась с эталоном: '
    + firstDiff(asC.stdout, goldenText));
});

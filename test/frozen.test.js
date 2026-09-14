/* Замороженная копия движка: та самая ревизия, с которой снят эталон, и те самые
 * байты, которые она выдаёт. Нужна она как различитель: если эталон разошёлся с
 * обоими движками — поехал эталон, если только с пакетом — сломался пакет.
 *
 * Здесь же проверяется, что копия в дереве не подменена: её хеш сверяется с
 * записанным при снятии эталона. Иначе «замороженная» копия тихо переставала бы
 * им быть, и различать было бы нечего.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FROZEN, LEGACY, PARITY, SYNTH, cloneFixture, firstDiff, readJson, readRun, requireTarget,
  runFixtureWith, sha256, shaFileLine, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('frozen');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const golden = fs.readFileSync(path.join(SYNTH, 'golden.json'));
const goldenText = golden.toString('utf8');
const goldenJson = JSON.parse(goldenText);
const parityManifest = readJson(path.join(PARITY, 'manifest.json'));

const PLAIN = sharedClone('plain', tmp);

test('замороженная копия — та ревизия, с которой снят эталон', () => {
  requireTarget(FROZEN);
  assert.equal(sha256(fs.readFileSync(LEGACY)), parityManifest.tool.sha256,
    'замороженная копия разошлась с ревизией, с которой снят эталон паритета');
  const synth = readJson(path.join(SYNTH, 'manifest.json'));
  assert.equal(synth.legacy.sha256, parityManifest.tool.sha256,
    'числа фикстуры сняты другой ревизией инструмента, чем числа живого проекта');
  assert.equal(sha256(golden), synth.legacy.goldenSha256,
    'файл эталонных чисел изменён после снятия');
});

test('фикстура и живой проект сняты одним инструментом', () => {
  assert.equal(readJson(path.join(SYNTH, 'manifest.json')).legacy.file.split('/').pop(),
    parityManifest.tool.file.split('/').pop(),
    'эталоны сняты разными инструментами');
});

test('замороженная копия воспроизводит эталон: --json побайтово', () => {
  requireTarget(FROZEN);
  const res = readRun(FROZEN, PLAIN, ['--json']);
  assert.equal(res.code, 0, 'копия не отдала --json (код ' + res.code + '): ' + res.stderr.trim());
  assert.equal(res.stdout, goldenText,
    'копия разошлась с эталоном — значит разошёлся эталон, а не движок пакета: '
      + firstDiff(res.stdout, goldenText));
});

test('замороженная копия: --write собирает тот же артефакт и проходит контроль', () => {
  requireTarget(FROZEN);
  const dir = cloneFixture(path.join(tmp, 'write'));
  const wrote = runFixtureWith(FROZEN, dir, ['--write']);
  assert.equal(wrote.code, 0, 'копия не собрала артефакт: ' + wrote.stderr.trim());

  const artifact = fs.readFileSync(path.join(dir, 'docs', 'size-table.html'));
  assert.equal(sha256(artifact), shaFileLine(path.join(SYNTH, 'artifact.sha256')),
    'артефакт копии разошёлся с эталонным побайтово (эталон ' + goldenJson.rows.length + ' строк)');

  const checked = runFixtureWith(FROZEN, dir, []);
  assert.equal(checked.code, 0, 'контрольный режим красный у копии: ' + checked.stderr.trim());
});

test('замороженная копия: числа не зависят от локали', () => {
  requireTarget(FROZEN);
  const res = readRun(FROZEN, PLAIN, ['--json'], { LC_ALL: 'C', LANG: 'C' });
  assert.equal(res.code, 0, 'под LC_ALL=C копия упала: ' + res.stderr.trim());
  assert.equal(res.stdout, goldenText, 'под LC_ALL=C копия разошлась с эталоном: '
    + firstDiff(res.stdout, goldenText));
});

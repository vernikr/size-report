/* Замороженная копия движка: та самая ревизия, с которой снят эталон, и те самые
 * байты, которые она выдаёт. Нужна она как различитель: если эталон разошёлся с
 * обоими движками — поехал эталон, если только с пакетом — сломался пакет.
 * В дереве её нет: байты живут в истории и берутся оттуда по требованию
 * (`REFACTOR.md` R-1.5), а взятóе сверяется с записью о происхождении эталона —
 * там же, где и раньше, поэтому «замороженная» копия всё так же не может тихо
 * перестать ею быть.
 *
 * Полное воспроизведение обоих эталонов этой копией проверяет
 * `pnpm run check:standards` (он снимает их заново в стороне и сверяет байты),
 * и там же живёт снятие эталонов — а здесь остаётся то, ради чего проверка нужна
 * в наборе: копия всё ещё выдаёт те же числа, что записаны в эталоне.
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

/* Манифест — запись о том, что лежит рядом, и она обязана сходиться с файлами:
 * правка эталона после снятия рукой иначе расходится молча, а по этим записям
 * сверяется и перенос, и живая история. */
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

/* Одна проверка вместо трёх (`REFACTOR.md` R-3.4): её предмет — происхождение
 * эталона («эти числа выдаёт та ревизия»), а не поведение копии, и это же
 * утверждение целиком и побайтово проверяет `pnpm run check:standards`, снимая оба
 * эталона заново. Здесь остаётся то, что видно в наборе и без пересъёма.
 *
 * Окружение — то же, в котором снимали эталон (у копии нет починки B1), поэтому
 * совпадение под ним и есть проверка закреплённости снятия: сними эталон без
 * закрепления — числа разошлись бы здесь, а не молча в чужой выкладке. */
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

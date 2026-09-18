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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PARITY, SYNTH, firstDiff, frozenTarget, golden, legacyTool, readJson, readRun, requireTarget,
  sha256, shaFileLine, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('frozen');

const { text: goldenText } = golden();
const parityManifest = readJson(path.join(PARITY, 'manifest.json'));

const PLAIN = sharedClone('plain', tmp);
const FROZEN = frozenTarget();

test('the frozen copy is the revision the reference was taken with', () => {
  requireTarget(FROZEN);
  assert.equal(sha256(fs.readFileSync(legacyTool())), parityManifest.tool.sha256,
    'the frozen copy diverged from the revision the parity reference was taken with');
  const synth = readJson(path.join(SYNTH, 'manifest.json'));
  assert.equal(synth.legacy.sha256, parityManifest.tool.sha256,
    'the numbers of the fixture were taken by a different revision of the tool than the numbers of the live project');
  assert.equal(sha256(goldenText), synth.legacy.goldenSha256,
    'the file of reference numbers was changed after it was taken');
});

/* A manifest is the record of what lies next to it, and it has to agree with the files: an edit of a
 * standard after it was taken would otherwise drift away silently, while both the port and the live
 * history are compared against these records. */
test('what the manifests record agrees with the files of the references', () => {
  const synth = readJson(path.join(SYNTH, 'manifest.json'));
  Object.keys(synth.files).forEach((name) => {
    const file = path.join(SYNTH, name);
    assert.equal(fs.statSync(file).size, synth.files[name].bytes,
      'the size of ' + name + ' is not the one recorded in the fixture manifest');
    assert.equal(sha256(fs.readFileSync(file)), synth.files[name].sha256,
      name + ' is not the one recorded in the fixture manifest (edited after it was taken?)');
  });
  assert.equal(sha256(fs.readFileSync(path.join(PARITY, 'data.json'))), parityManifest.data.sha256,
    'the numbers of the parity reference are not the ones recorded in its manifest');
  assert.equal(sha256(fs.readFileSync(path.join(PARITY, 'config.json'))), parityManifest.config.sha256,
    'the settings of the parity reference are not the ones recorded in its manifest');
  assert.equal(shaFileLine(path.join(PARITY, 'artifact.sha256')), parityManifest.artifact.sha256,
    'the artifact of the parity reference is not the one recorded in its manifest');
});

test('the fixture and the live project were taken with one tool', () => {
  assert.equal(readJson(path.join(SYNTH, 'manifest.json')).legacy.file.split('/').pop(),
    parityManifest.tool.file.split('/').pop(),
    'the references were taken with different tools');
});

/* Its subject is the origin of the standard ("these numbers are what that revision yields"), not the
 * copy's behaviour, and the same claim whole and byte for byte is checked by
 * `pnpm run check:standards`, which takes both standards anew. What is left here is what the suite
 * sees without a re-take.
 *
 * The environment is the one the standard was taken in (the copy has no fix for B1), so agreement
 * under it is what checks the taking was pinned: take the standard without the pins and the numbers
 * would part here rather than silently in someone else's working tree. */
test('the frozen copy gives the same numbers as the reference records', () => {
  requireTarget(FROZEN);
  const res = readRun(FROZEN, PLAIN, ['--json']);
  assert.equal(res.code, 0, 'the copy did not give --json (code ' + res.code + '): ' + res.stderr.trim());
  assert.equal(res.stdout, goldenText,
    'the copy diverged from the reference — so the reference has diverged rather than the engine of the package: '
      + firstDiff(res.stdout, goldenText));

  const asC = readRun(FROZEN, PLAIN, ['--json'], { LC_ALL: 'C', LANG: 'C' });
  assert.equal(asC.stdout, goldenText, 'under LC_ALL=C the copy diverged from the reference: '
    + firstDiff(asC.stdout, goldenText));
});

/* A working tree with CRLF newlines — the witness of the fix for B2 (`BLOCKERS.md`). Under
 * `core.autocrlf=true` (the default of Git's installer for Windows) git lays CRLF on disk while
 * keeping LF in objects, and the tool has to read that as an ordinary working tree: neither as a
 * discrepancy with history nor a reason to refuse. The check compares such a tree's numbers with the
 * ordinary tree's and with the standard, and the report it builds with the one built in an ordinary
 * tree: the comparison against the working tree must not become an empty gesture.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG, PACKAGE, cloneFixture, firstDiff, gitIn, golden, readRun, runFixtureWith, sha256, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('crlf');

const { text: goldenText } = golden();

test('a working tree with CRLF newlines does not stand in the way of the comparison', () => {
  const dir = sharedClone('crlf', tmp);
  assert.ok(/\r\n/.test(fs.readFileSync(path.join(dir, 'src', 'code.js'), 'utf8')),
    'the clone came out without CRLF: this is not the environment under check');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '',
    'git calls the working tree dirty: the comparison skips such files, and there is nothing to check');

  const plain = readRun(PACKAGE, sharedClone('plain', tmp), ['--json']);
  const crlf = readRun(PACKAGE, dir, ['--json']);
  assert.equal(crlf.code, 0, 'with core.autocrlf=true the tool refused to work: '
    + crlf.stderr.trim().split('\n')[0]);
  assert.equal(crlf.stdout, plain.stdout, 'the CRLF working tree changed the numbers: ' + firstDiff(crlf.stdout, plain.stdout));
  assert.equal(crlf.stdout, goldenText, 'the CRLF working tree diverged from the reference: ' + firstDiff(crlf.stdout, goldenText));

  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const plainDir = cloneFixture(path.join(tmp, 'crlf-plain'));
  const wrote = runFixtureWith(PACKAGE, dir, ['--write']);
  assert.equal(wrote.code, 0, 'the build in the CRLF working tree failed: ' + wrote.stderr.trim().split('\n')[0]);
  assert.equal(runFixtureWith(PACKAGE, plainDir, ['--write']).code, 0,
    'the build in the ordinary working tree failed');
  assert.equal(sha256(fs.readFileSync(path.join(dir, cfg.output))),
    sha256(fs.readFileSync(path.join(plainDir, cfg.output))),
    'the report in the CRLF working tree diverged byte for byte from the one built in an ordinary one');
});

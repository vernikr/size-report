/* The second half of the command line's checks: where the tool writes (the directory may be absent —
 * that is an ordinary run rather than a user's mistake), what it does with an incomplete history and
 * with a disagreement with the working tree, and what happens when it is run outside a repository.
 * The refusals here are the same shape: an exit code and a ready command, no stack.
 *
 * The help, the settings and the exit codes are in the neighbouring suite (`cli.test.js`), split by
 * cost: checks inside a file run in sequence, and the work here is spawning processes, so a file of
 * its own keeps this cost out of the fast run.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG, cloneFixture, firstLine, gitIn, hasStack, initRepo, refusal, runFixture, runSize, shallowClone,
  tempDir
} from '../tools/harness.js';

const tmp = tempDir('cli-paths');

/* ---------- a shallow history ---------- */

test('a truncated history: code 3 and the command that fills it in', () => {
  const base = cloneFixture(path.join(tmp, 'shallow-source'));
  const dir = shallowClone(base, path.join(tmp, 'shallow'));

  const res = runFixture(dir, ['--data']);
  refusal(res, 3, 'a run on a truncated history');
  assert.match(res.stderr, /--unshallow/, 'the refusal does not name the command that fills it in:\n' + res.stderr);
});

/* ---------- output into a directory that does not exist ---------- */

/* A project with no settings and no `docs` directory — the case the package is installed for: the
 * report has to appear in `docs/` (the directory is created by itself) rather than in the root. The
 * check exists by measurement: the first version of the derived profile chose the root when the
 * directory was absent, so in a fresh project the report landed where nobody looks for it. */
test('in a fresh project the report lands in docs/, a directory that creates itself', () => {
  const dir = initRepo(path.join(tmp, 'fresh'));
  fs.writeFileSync(path.join(dir, 'README.md'), '# свежий проект\n');
  fs.writeFileSync(path.join(dir, 'code.js'), 'var a = 1;\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'feat: начало']);
  assert.equal(fs.existsSync(path.join(dir, 'docs')), false, 'the docs directory is already there: this is not the case');

  const res = runSize(dir, ['--write']);
  assert.equal(res.code, 0, 'a run with no settings did not build the report: ' + firstLine(res.stderr));
  const report = path.join(dir, 'docs', 'size-report.html');
  assert.ok(fs.existsSync(report), 'the report is not in docs/ — in the derived profile that is where it lands');
  assert.equal(fs.existsSync(path.join(dir, 'size-report.html')), false,
    'the report landed in the root as well: it has one place only');
  assert.equal(runSize(dir, []).code, 0, 'the checking mode is red on its own report');
});

test('--write creates a missing directory named by a flag', () => {
  const dir = cloneFixture(path.join(tmp, 'page-dir'));
  const target = path.join('.size-report', 'report.html');
  const res = runFixture(dir, ['--write', target]);
  assert.equal(res.code, 0, '--write refused to work: ' + firstLine(res.stderr));
  assert.equal(hasStack(res.stderr), false, '--write fell over with a stack:\n' + res.stderr);
  assert.ok(fs.existsSync(path.join(dir, target)), 'there is no report at the named path: ' + target);
});

test('--write creates a missing directory named in the settings', () => {
  const dir = cloneFixture(path.join(tmp, 'write-dir'));
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  cfg.output = path.join('.size-report', 'table.html');
  fs.writeFileSync(path.join(dir, 'size-table.config.json'), JSON.stringify(cfg, null, 2));

  const res = runSize(dir, ['--write']);
  assert.equal(res.code, 0, '--write refused to work: ' + firstLine(res.stderr));
  assert.equal(hasStack(res.stderr), false, '--write fell over with a stack:\n' + res.stderr);
  assert.ok(fs.existsSync(path.join(dir, cfg.output)), 'there is no table at the named path');
});

/* ---------- a disagreement with the working tree ---------- */

test('an edit on disk only: code 1 and what to do about it', () => {
  const dir = cloneFixture(path.join(tmp, 'disk-edit'));
  gitIn(dir, ['update-index', '--assume-unchanged', 'src/code.js']);
  fs.appendFileSync(path.join(dir, 'src', 'code.js'), '// правка, которой нет в git\n');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '',
    'the edit went into the git status: the file would fall out of the comparison, and there is nothing to check');

  const res = runFixture(dir, ['--data']);
  refusal(res, 1, 'an edit that is not in the history');
  assert.match(res.stderr, /the edit exists on disk only/, 'the refusal explains the wrong thing:\n' + res.stderr);
  assert.match(res.stderr, /fix/, 'the refusal does not say what to do:\n' + res.stderr);
});

/* ---------- a run outside a repository ---------- */

test('outside a git repository the refusal explains itself rather than falling over with a stack', () => {
  const res = runSize(tmp, ['--data']);
  refusal(res, 2, 'a run outside a repository');
  // The advice has to be a command: a refusal without a fix helps no reader.
  assert.match(res.stderr, /^\s*fix: .*git init$/m,
    'the refusal did not name the repair command:\n' + res.stderr);
});

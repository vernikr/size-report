/* A probe of the gate-file protection (`tools/gates/gatefiles.js`): editing thresholds, baselines or the
 * check harness without the `Gate-Change:` trailer has to colour the check — both in the hook (by the
 * index) and in CI (commit by commit across a range).
 *
 * The probe runs in **a temporary repository of its own** holding a copy of the sensor scripts and of the
 * part of the product they lean on (`src/git.js` — the git boundary with its pinned settings): in the
 * working tree the probe would leave commits behind, and a gate that commits on behalf of the one it
 * checks is a bad idea. The script finds the repository by its own location, so the copy reproduces the
 * layout.
 *
 * Both halves of the promise are checked: **no trailer — red**, **trailer — green**, and that an edit of
 * an ordinary file needs no trailer (otherwise the gate would demand a justification for every edit).
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, exec, git, tempDir, write } from '../tools/gate-probe.js';

const tmp = tempDir('gatefiles');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const repo = path.join(tmp, 'repo');
const GATE = path.join(repo, 'tools/gates');

function gitIn(argv) {
  const res = git(argv, { cwd: repo });
  assert.equal(res.code, 0, 'git ' + argv.join(' ') + ' не отработал:\n' + res.out);
  return res.out;
}

/* The message goes in as a file (`git commit -F`): the trailer lives in the message body, and a
 * one-line `-m` would leave it unchecked. */
function commit(message) {
  const file = path.join(tmp, 'message.txt');
  write(file, message + '\n');
  return git(['commit', '-F', file], { cwd: repo });
}

function gate(argv) {
  return exec(process.execPath, [path.join(GATE, 'gatefiles.js')].concat(argv), { cwd: repo });
}

/* The layout of the temporary repository: a copy of the sensor's harness (and of the part of the product
 * it leans on), an ordinary file and two gate files. Returns the first commit — the base for the range
 * check. */
function prepare() {
  fs.mkdirSync(GATE, { recursive: true });
  ['common.js', 'gatefiles.js'].forEach((f) => {
    fs.copyFileSync(path.join(ROOT, 'tools/gates', f), path.join(GATE, f));
  });
  fs.cpSync(path.join(ROOT, 'src'), path.join(repo, 'src'), { recursive: true });
  write(path.join(repo, 'src/ok.js'), 'export const ok = 1;\n');
  write(path.join(repo, 'package.json'), '{\n  "name": "probe"\n}\n');
  write(path.join(repo, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  gitIn(['init', '-q']);
  gitIn(['config', 'user.name', 'проба']);
  gitIn(['config', 'user.email', 'probe@example.invalid']);
  gitIn(['add', 'src/ok.js']);
  const first = commit('feat: обычный файл без трейлера');
  assert.equal(first.code, 0, 'обычный коммит не прошёл:\n' + first.out);
  return gitIn(['rev-parse', 'HEAD']).trim();
}

test('гейт-файл без трейлера красный, с трейлером — зелёный', () => {
  const base = prepare();

  // A gate-file edit in the index — the hook's verdict.
  gitIn(['add', 'package.json']);
  const staged = path.join(tmp, 'staged-msg.txt');
  write(staged, 'chore: правка порога\n');
  const hook = gate(['--commit-msg', staged]);
  assert.equal(hook.code, 1, 'правка гейт-файла прошла хук без трейлера:\n' + hook.out);
  // The red has to be a verdict rather than a failure of the script itself (a broken import is a
  // non-zero code too, and without this comparison the probe would "pass" on it).
  assert.match(hook.out, /a gate edit with no Gate-Change: trailer/, 'красный не назвал причину:\n' + hook.out);
  assert.match(hook.out, /package\.json/, 'хук не назвал гейт-файл:\n' + hook.out);

  write(staged, 'chore: правка порога\n\nGate-Change: порог поднят по замеру, причина такая\n');
  const hookOk = gate(['--commit-msg', staged]);
  assert.equal(hookOk.code, 0, 'трейлер не был принят:\n' + hookOk.out);

  // A commit without the trailer in the range — the CI verdict.
  const bad = commit('chore: правка порога без трейлера');
  assert.equal(bad.code, 0, 'git не смог закоммитить:\n' + bad.out);
  const range = gate(['--range', base]);
  assert.equal(range.code, 1, 'коммит с правкой гейт-файла прошёл диапазон без трейлера:\n' + range.out);

  // The same commit with the trailer is green: amend, and the range is clean again.
  const amend = git(['commit', '--amend', '-m',
    'chore: правка порога\n\nGate-Change: порог поднят по замеру, причина такая'], { cwd: repo });
  assert.equal(amend.code, 0, 'аменд не прошёл:\n' + amend.out);
  const rangeOk = gate(['--range', base]);
  assert.equal(rangeOk.code, 0, 'трейлер в коммите не принят диапазоном:\n' + rangeOk.out);
  assert.match(rangeOk.out, /Gate-Change/, 'вердикт не назвал трейлер:\n' + rangeOk.out);
});

test('обычная правка трейлера не требует', () => {
  write(path.join(repo, 'src/ok.js'), 'export const ok = 2;\n');
  gitIn(['add', 'src/ok.js']);
  const staged = path.join(tmp, 'plain-msg.txt');
  write(staged, 'feat: правка обычного файла\n');
  const res = gate(['--commit-msg', staged]);
  assert.equal(res.code, 0, 'правка обычного файла потребовала трейлер:\n' + res.out);
  assert.match(res.out, /the commit can be made/, 'вердикт не сказал, что коммит ставится:\n' + res.out);
});

test('короткая пометка вместо причины не принимается', () => {
  gitIn(['add', 'pnpm-lock.yaml']);
  const staged = path.join(tmp, 'short-msg.txt');
  write(staged, 'chore: правка базы\n\nGate-Change: ok\n');
  const res = gate(['--commit-msg', staged]);
  assert.equal(res.code, 1, 'пометка без причины принята за обоснование:\n' + res.out);
  assert.match(res.out, /a gate edit with no Gate-Change: trailer/, 'красный не назвал причину:\n' + res.out);
});

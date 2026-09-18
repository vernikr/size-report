/* The `post-commit` hook (`size install-hook` / `uninstall-hook` / `hook-run`): the report rebuilds
 * itself after a commit and, when it is tracked by git, lands as a commit of its own. The three
 * promises checked here are self-updating, protection from a loop, and being switchable off.
 *
 * What is checked is the git repository's behaviour around the hook rather than the hook file's shape,
 * and every case runs in a fresh clone of a small project rather than in the package's working tree:
 * the hook lives in `.git`, so every clone has one of its own and "installed" can be checked nowhere
 * else. The project is small on purpose: what is under test is the hook, not a history with traps, and
 * the cost of a run is no subject of a check here.
 *
 * What counts as proof here:
 *
 * - the installation happens **by itself** on the first run in a project (the package's postinstall
 *   does the same after an install), or a person would never see the first rebuild of the report; the
 *   explicit command is for where installing is impossible, and it names the cause. The hook lies in
 *   `.git/hooks`, so `git status` does not see it, and a fresh clone has none until the first run;
 * - an edit of code gives a commit of its **own** carrying the report alone — the answer to the trap
 *   of a code edit and the table in one commit;
 * - a repeated run (and the hook fired by its own report commit) produces no next one: the report's
 *   commit is assembled with plumbing, which calls no hook, and the report is a path that gets no
 *   row, so the same rebuild yields the same bytes;
 * - someone else's uncommitted work and the index are untouched: the tree comes from HEAD with only
 *   the report's path replaced in it, so nothing else can enter the commit;
 * - a refusal by the tool does not bring the commit down: the cause is one line and a record that
 *   `size doctor` shows;
 * - where there is nothing to update (integration, the switch, a detached HEAD, a report outside git,
 *   someone else's clone with no installation) the hook stays silent and commits nothing;
 * - removing it returns the project to its previous behaviour, while someone else's `post-commit`
 *   and `core.hooksPath` are never overwritten.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { firstLine, gitIn, gitTry, hasStack, initRepo, runSize, setIdentity, tempDir } from '../tools/harness.js';

/* The check sets the environment itself rather than taking the machine's: `CI` and
 * `SIZE_REPORT_NO_HOOK` are the hook's switches and are set for the whole suite in integration, so
 * every scenario would stay silent "for the CI reason" while the hook looked guilty. The scenario
 * about the switches sets them itself — in the call rather than in the process environment. */
delete process.env.CI;
delete process.env.SIZE_REPORT_NO_HOOK;

const tmp = tempDir('hook');

const REPORT = 'docs/size-table.html';
const CONFIG = 'size-table.config.json';

const SOURCE = path.join(tmp, 'source');
let built = false;

/* The sample project: code columns, the report tracked by git, full coverage (README and the config
 * itself declared as exceptions). The report is assembled by the tool rather than written by hand —
 * otherwise the hook's very first run would rewrite it, and "the hook broke nothing" would be proved
 * on different bytes. */
function source() {
  if (built) return SOURCE;
  initRepo(SOURCE);
  fs.writeFileSync(path.join(SOURCE, 'README.md'), '# проект\n');
  fs.writeFileSync(path.join(SOURCE, 'src', 'code.js'), '// начало\nvar width = 1;\n');
  fs.writeFileSync(path.join(SOURCE, 'src', 'other.js'), '// ещё файл\n');
  fs.writeFileSync(path.join(SOURCE, CONFIG), JSON.stringify({
    output: REPORT,
    columns: [{ label: 'code.js', paths: ['src/code.js'] }, { label: 'other.js', paths: ['src/other.js'] }],
    metrics: ['raw', 'min'],
    journal: null,
    links: { commitUrl: '' },
    rows: { merges: true, sha: true },
    skip: ['README.md', CONFIG]
  }, null, 2) + '\n');
  gitIn(SOURCE, ['add', '-A']);
  gitIn(SOURCE, ['commit', '-qm', 'feat: начало']);
  assert.equal(runSize(SOURCE, ['--write']).code, 0, 'the report of the sample was not built');
  gitIn(SOURCE, ['add', REPORT]);
  gitIn(SOURCE, ['commit', '-qm', 'chore: отчёт']);
  built = true;
  return SOURCE;
}

// A fresh clone: no hook can travel into it (`.git/hooks` is not cloned), and hard links are off —
// otherwise `--write` in the clone would edit the sample's files.
function clone(name) {
  const dir = path.join(tmp, name);
  gitIn(null, ['clone', '-q', '--no-hardlinks', source(), dir]);
  setIdentity(dir);
  return dir;
}

function install(dir) {
  const res = runSize(dir, ['--config', CONFIG, 'install-hook']);
  assert.equal(res.code, 0, 'the hook was not installed: ' + firstLine(res.stdout + res.stderr));
  return res;
}

function subjects(dir, count) {
  return gitIn(dir, ['log', '--format=%s', '-' + count]).trim().split('\n');
}

function hookFileOf(dir) {
  return path.join(dir, '.git', 'hooks', 'post-commit');
}

function hookState(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.git', 'size-report', 'hook.json'), 'utf8'));
}

// A commit of an edit — of the named files alone: it does not take someone else's work from the
// index, or "the hook touched nothing foreign" would be checked on an empty index.
function commit(dir, subject, files) {
  files.forEach((f) => fs.appendFileSync(path.join(dir, f), '// ' + subject + '\n'));
  gitIn(dir, ['commit', '-qm', subject, '--'].concat(files));
}

/* ---------- installation ---------- */

test('the hook installs itself on the first run, and whether it may is the decision of the project', () => {
  const dir = clone('install');
  const file = hookFileOf(dir);

  // A fresh clone has no hook: `.git/hooks` is not cloned, and nothing can install it before the
  // first run — a manual step is absent on purpose.
  assert.equal(fs.existsSync(file), false, 'the hook appeared in the clone before the first run');

  // The first ordinary run is enough.
  assert.equal(runSize(dir, ['--config', CONFIG, '--write']).code, 0, 'the report was not built');
  assert.ok(fs.existsSync(file), 'the first run did not install the hook: ' + file);
  assert.ok((fs.statSync(file).mode & 0o111) !== 0, 'the hook is not executable: git will not call it');
  assert.ok(fs.readFileSync(file, 'utf8').indexOf('size-report') >= 0, 'the hook carries no mark of the tool');
  assert.ok(fs.existsSync(path.join(dir, '.git', 'hooks', 'post-merge')),
    'there is no post-merge hook: git does not call post-commit for a merge, and the report would stay stale');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '',
    'the installation changed something in the project: the hook has to live in `.git` alone');

  // The diagnostics rearrange nothing: it reports rather than repairs.
  const before = fs.readFileSync(file, 'utf8');
  assert.equal(runSize(dir, ['--config', CONFIG, 'doctor', '--json']).code, 0,
    'the diagnostics of a healthy project are not green');
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'the diagnostics rewrote the hook');

  // The explicit installation says what a person needs: it is already there, here is what switches
  // it off, here is how it is removed.
  const again = install(dir);
  assert.match(again.stdout, /already installed/, 'the installation did not say the hook is already there');
  assert.match(again.stdout, /hooks.*enabled/, 'the installation did not say what switches the automation off');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'the repeated installation left dirt behind');
});

/* The automation is a background service rather than a side effect: where a project does not want it
 * or it cannot be installed, it does not appear and does not get in the way. Checked by a run (the
 * first one in the clone) rather than by reading a condition in the code. */
test('where the automation is switched off or cannot be installed, no hook appears', () => {
  const off = clone('install-off');
  const offCfg = JSON.parse(fs.readFileSync(path.join(off, CONFIG), 'utf8'));
  offCfg.hooks = { enabled: false };
  fs.writeFileSync(path.join(off, CONFIG), JSON.stringify(offCfg, null, 2) + '\n');
  assert.equal(runSize(off, ['--config', CONFIG, '--write']).code, 0, 'the write with the switch off did not go through');
  assert.equal(fs.existsSync(hookFileOf(off)), false, 'the hook was installed against hooks.enabled: false');

  const foreignDir = clone('install-foreign');
  const foreignFile = hookFileOf(foreignDir);
  fs.mkdirSync(path.dirname(foreignFile), { recursive: true });
  fs.writeFileSync(foreignFile, '#!/bin/sh\necho чужой хук\n');
  fs.chmodSync(foreignFile, 0o755);
  assert.equal(runSize(foreignDir, ['--config', CONFIG, '--write']).code, 0);
  assert.match(fs.readFileSync(foreignFile, 'utf8'), /чужой хук/, 'the installation rewrote a foreign hook');

  const customDir = clone('install-custom');
  gitIn(customDir, ['config', 'core.hooksPath', '.githooks']);
  assert.equal(runSize(customDir, ['--config', CONFIG, '--write']).code, 0);
  assert.equal(fs.existsSync(path.join(customDir, '.githooks')), false,
    'the installation created the directory of a foreign core.hooksPath');
});

/* ---------- updating ---------- */

test('an edit of code gives the rebuilt report as a commit of its own', () => {
  const dir = clone('update');
  install(dir);

  commit(dir, 'feat: правка кода', ['src/code.js']);
  const parent = gitIn(dir, ['rev-parse', 'HEAD^']).trim();

  assert.deepEqual(subjects(dir, 2), ['chore(report): report rebuilt after ' + parent.slice(0, 7),
    'feat: правка кода'], 'the report did not land as a commit of its own right after the commit of code');
  assert.deepEqual(gitIn(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'), [REPORT],
    'the report commit carried something besides the report');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'the working tree is dirty after the hook');

  // The commit carries the very bytes `--write` assembles: otherwise the report in history and the
  // report on disk would diverge, and so would the check "the table agrees with history".
  const committed = fs.readFileSync(path.join(dir, REPORT), 'utf8');
  assert.equal(runSize(dir, ['--config', CONFIG, '--write']).code, 0);
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), committed,
    'the hook put into the commit something other than what `--write` builds');
  assert.equal(runSize(dir, ['--config', CONFIG]).code, 0, 'the report in git diverged from the history');

  const state = hookState(dir);
  assert.equal(state.result, 'committed', 'the hook did not record that it committed: ' + JSON.stringify(state));
  assert.equal(state.head, parent, 'the record of the hook holds the wrong commit');
  assert.equal(runSize(dir, ['--config', CONFIG, 'check', '--json']).code, 0,
    'the report commit broke the completeness of coverage');
});

test('a repeated run and a commit with no changes produce nothing', () => {
  const dir = clone('repeat');
  install(dir);
  commit(dir, 'feat: правка кода', ['src/code.js']);
  assert.match(subjects(dir, 1)[0], /^chore\(report\): /);

  // An empty commit: it earns the report no row, hence no commit either.
  gitIn(dir, ['commit', '-q', '--allow-empty', '-m', 'chore: пусто']);
  assert.equal(subjects(dir, 1)[0], 'chore: пусто', 'the hook made a commit where the report did not change');
  assert.equal(gitIn(dir, ['log', '--format=%s']).split('\n').filter((s) => /^chore\(report\)/.test(s)).length, 1,
    'a second report commit appeared after a commit with no changes');

  // And by hand the answer is the same: there was nothing to change.
  const res = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(res.code, 0, 'the repeated run returned a refusal: ' + firstLine(res.stderr));
  assert.equal(res.stdout.trim() + res.stderr.trim(), '', 'the repeated run printed something extra');
  assert.equal(hookState(dir).result, 'unchanged', 'the repeated run found something to change');
});

/* On a merge the hook behaves as on any commit, but arrives there by another file: git creates the
 * merge commit itself and does not call `post-commit` — it calls `post-merge` (measured on git 2.50).
 * Both branches edit the report, so the merge conflicts — a property of "the report in git" — and
 * here it is resolved in favour of the current branch, as a person would.
 *
 * A merge row in the report is not to be expected here: by the usual rule it appears only when the
 * merge itself shifted a volume, and the branch's edit is already counted. So what is checked is what
 * the hook is responsible for: after the merge the report is rebuilt as a commit of its own and
 * agrees with what history and the working tree assemble. */
test('on a merge the hook behaves as on any commit', () => {
  const dir = clone('merge');
  install(dir);

  gitIn(dir, ['checkout', '-q', '-b', 'side']);
  commit(dir, 'feat: правка сбоку', ['src/other.js']);
  gitIn(dir, ['checkout', '-q', 'main']);
  commit(dir, 'feat: правка в основной', ['src/code.js']);
  gitIn(dir, ['merge', '-q', '--no-ff', '--no-edit', '-X', 'ours', 'side']);
  // The hook has already run: HEAD is the report's commit, and the merge commit is its parent.
  const merge = gitIn(dir, ['rev-parse', 'HEAD^']).trim();
  assert.equal(gitIn(dir, ['rev-list', '--parents', '-n1', merge]).trim().split(' ').length, 3,
    'the merge made no merge commit: there is nothing to check');

  assert.equal(subjects(dir, 1)[0], 'chore(report): report rebuilt after ' + merge.slice(0, 7),
    'after the merge the report was not rebuilt as a commit of its own');
  assert.deepEqual(gitIn(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'), [REPORT],
    'the report commit after the merge carried something besides the report');
  assert.equal(runSize(dir, ['--config', CONFIG]).code, 0, 'the report after the merge diverged from the history');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'the tree is dirty after the merge');
});

test('the uncommitted work of others and the index are untouched', () => {
  const dir = clone('stage');
  install(dir);

  // An edit staged in the index, a dirty file outside it, and a commit of code: the hook has to
  // leave all of it alone and commit the report only.
  fs.appendFileSync(path.join(dir, 'src', 'other.js'), '// отложенная правка\n');
  gitIn(dir, ['add', 'src/other.js']);
  fs.appendFileSync(path.join(dir, 'README.md'), 'грязная правка\n');
  commit(dir, 'feat: правка кода', ['src/code.js']);

  // `trim` would eat the meaningful leading space of the first line (" M" is an edit outside the
  // index).
  const status = gitIn(dir, ['status', '--porcelain']).replace(/\n+$/, '').split('\n').sort();
  assert.deepEqual(status, [' M README.md', 'M  src/other.js'],
    'the hook touched the work of others or the index: ' + JSON.stringify(status));
  assert.deepEqual(gitIn(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'), [REPORT],
    'the report commit picked up an edit of someone else');
});

/* ---------- where there is nothing to update ---------- */

test('the hook keeps quiet in CI, behind the switch and on a detached HEAD', () => {
  const dir = clone('quiet');
  install(dir);
  commit(dir, 'feat: правка кода', ['src/code.js']);
  const report = fs.readFileSync(path.join(dir, REPORT), 'utf8');

  // An edit on disk: if the hook does run, the report changes — which is how it shows.
  fs.appendFileSync(path.join(dir, 'src', 'code.js'), '// ещё правка\n');
  const env = runSize(dir, ['--config', CONFIG, 'hook-run'], { CI: '1' });
  assert.equal(env.code, 0, 'in CI the hook answered with a refusal: ' + firstLine(env.stderr));
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'the hook updated the report in CI');
  assert.match(hookState(dir).why, /CI/, 'the hook did not say why it skipped: ' + JSON.stringify(hookState(dir)));

  const off = runSize(dir, ['--config', CONFIG, 'hook-run'], { SIZE_REPORT_NO_HOOK: '1' });
  assert.equal(off.code, 0);
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'the environment switch did not work');

  // The switch in the settings: the file is read off the disk and need not be committed.
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, CONFIG), 'utf8'));
  cfg.hooks = { enabled: false };
  fs.writeFileSync(path.join(dir, CONFIG), JSON.stringify(cfg, null, 2) + '\n');
  const disabled = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(disabled.code, 0);
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'the switch in the settings did not work');
  assert.match(hookState(dir).why, /hooks\.enabled/, 'the reason for the skip is not named');

  // A switched-off hook shows in the diagnostics as something to act on rather than as the norm.
  const doc = JSON.parse(runSize(dir, ['--config', CONFIG, 'doctor', '--json']).stdout);
  assert.equal(doc.hooks.installed, true, 'the diagnostics do not see the installed hook');
  assert.equal(doc.hooks.enabled, false, 'the diagnostics do not see the switch');
  assert.ok(doc.findings.some((f) => f.level === 'action' && /hook/.test(f.what)),
    'the diagnostics keep quiet about the switched-off hook: ' + JSON.stringify(doc.findings));

  cfg.hooks = { enabled: true };
  fs.writeFileSync(path.join(dir, CONFIG), JSON.stringify(cfg, null, 2) + '\n');
  gitIn(dir, ['checkout', '-q', '--detach']);
  const detached = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(detached.code, 0);
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'on a detached HEAD the report was rebuilt');
  assert.match(hookState(dir).why, /detached HEAD/, 'a detached HEAD is given the wrong reason');
});

test('a refusal of the tool does not bring the commit down, and the cause shows in the diagnostics', () => {
  // A shallow history is a refusal of the tool itself (code 3) rather than of the hook.
  const dir = path.join(tmp, 'shallow');
  const shallow = gitTry(null, ['clone', '-q', '--depth', '1', '--no-hardlinks', 'file://' + source(), dir]);
  assert.equal(shallow.status, 0, 'the truncated working tree was not assembled: ' + firstLine(shallow.stderr));
  setIdentity(dir);
  install(dir);

  const refused = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(refused.code, 0, 'the hook returned a refusal instead of zero: ' + firstLine(refused.stderr));
  assert.equal(hasStack(refused.stderr), false, 'the hook printed a stack');
  assert.match(refused.stderr.split('\n')[0], /^✗ size-report: /, 'the cause is not named as a line: ' + refused.stderr);
  assert.equal(hookState(dir).result, 'refused', 'the refusal is not recorded: ' + JSON.stringify(hookState(dir)));

  // The commit is there and it is the only one: no report in history, a clean tree.
  commit(dir, 'feat: правка кода', ['src/code.js']);
  assert.equal(subjects(dir, 1)[0], 'feat: правка кода', 'the hook made a commit after the refusal');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'dirt was left after the refusal');

  const doc = JSON.parse(runSize(dir, ['--config', CONFIG, 'doctor', '--json']).stdout);
  assert.equal(doc.hooks.last.result, 'refused', 'the diagnostics do not see the refusal of the hook');
  assert.ok(doc.findings.some((f) => f.level === 'action' && /hook/.test(f.what)),
    'the diagnostics do not call a broken hook a matter: ' + JSON.stringify(doc.findings));
});

test('the report outside git: the hook rebuilds and does not commit', () => {
  const dir = clone('untracked');
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, CONFIG), 'utf8'));
  cfg.output = '.size-report/report.html';
  fs.writeFileSync(path.join(dir, CONFIG), JSON.stringify(cfg, null, 2) + '\n');
  fs.rmSync(path.join(dir, REPORT));
  install(dir);

  commit(dir, 'feat: правка кода', ['src/code.js']);
  assert.equal(subjects(dir, 1)[0], 'feat: правка кода', 'the hook committed a report that is not in git');
  assert.ok(fs.existsSync(path.join(dir, '.size-report', 'report.html')), 'the report outside git was not rebuilt');
  assert.equal(hookState(dir).result, 'rebuilt', 'the hook did not say it rebuilt without a commit');

  // And a fresh clone has no hook at all — which is the answer for "someone else's machine and
  // integration".
  assert.equal(fs.existsSync(hookFileOf(clone('fresh'))), false, 'the hook came along with the history');
});

/* ---------- removal and someone else's files ---------- */

test('the uninstall brings the project back to its old behaviour', () => {
  const dir = clone('uninstall');
  install(dir);
  commit(dir, 'feat: правка кода', ['src/code.js']);
  assert.match(subjects(dir, 1)[0], /^chore\(report\): /);
  const report = fs.readFileSync(path.join(dir, REPORT), 'utf8');

  const gone = runSize(dir, ['--config', CONFIG, 'uninstall-hook']);
  assert.equal(gone.code, 0, 'the uninstall did not go through: ' + firstLine(gone.stderr));
  assert.equal(fs.existsSync(hookFileOf(dir)), false, 'the hook file is still there');
  assert.equal(fs.existsSync(path.join(dir, '.git', 'hooks', 'post-merge')), false, 'the post-merge hook file is still there');
  assert.equal(fs.existsSync(path.join(dir, '.git', 'size-report')), false, 'the state of the hook is still there');

  commit(dir, 'feat: ещё правка', ['src/code.js']);
  assert.equal(subjects(dir, 1)[0], 'feat: ещё правка', 'the removed hook keeps committing');
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report,
    'the removed hook keeps rebuilding the report');
  assert.equal(runSize(dir, ['--config', CONFIG, 'uninstall-hook']).code, 0, 'a repeated uninstall is a refusal');
});

test('a foreign hook and a foreign hooks directory are not overwritten', () => {
  const dir = clone('foreign');
  const file = hookFileOf(dir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const foreign = '#!/bin/sh\necho чужой хук\n';
  fs.writeFileSync(file, foreign);
  fs.chmodSync(file, 0o755);

  const res = runSize(dir, ['--config', CONFIG, 'install-hook']);
  assert.equal(res.code, 2, 'installing over a foreign hook is not a refusal');
  assert.equal(hasStack(res.stderr), false, 'the refusal printed a stack');
  assert.match(res.stderr, /hook-run/, 'the refusal gives no ready line for a foreign hook:\n' + res.stderr);
  assert.equal(fs.readFileSync(file, 'utf8'), foreign, 'the foreign hook was rewritten');
  assert.equal(runSize(dir, ['--config', CONFIG, 'uninstall-hook']).code, 2, 'the uninstall touched a foreign hook');

  fs.rmSync(file);
  gitIn(dir, ['config', 'core.hooksPath', '.githooks']);
  const custom = runSize(dir, ['--config', CONFIG, 'install-hook']);
  assert.equal(custom.code, 2, 'with a foreign core.hooksPath the installation is not a refusal');
  assert.match(custom.stderr, /core\.hooksPath/, 'the refusal did not name the cause:\n' + custom.stderr);
  assert.equal(fs.existsSync(path.join(dir, '.githooks')), false, 'the tool created a foreign hooks directory');
});

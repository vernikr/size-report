/* The comparison with the working tree: its two sides and the witnesses it is written for.
 *
 *   - an edit of a file on disk alone (git says nothing about it) has to be caught — or "repairing"
 *     would come down to deleting the comparison;
 *   - a loss while the state is carried between commits (a merge commit without
 *     `--diff-merges=first-parent`) is visible only when the state is compared with the commit's
 *     tree, and it is lost in three ways: by an edit, by the creation of a file and by its removal;
 *   - a column whose file was removed before HEAD, and a rename inside its aliases, are no loss: the
 *     run has to assemble, and the numbers have to agree with git.
 *
 * Every check has a clone of its own here: they edit files, and a shared clone suits nobody
 * afterwards (one check would slip its edit to another).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CONFIG, PACKAGE, PACKAGE_BIN, ROOT, cloneCrlf, cloneFixture, configWith, gitConfig, gitIn, initRepo,
  readJson, runFixtureWith, runSize, runTool, tempDir
} from '../tools/harness.js';

const tmp = tempDir('disk');

// A commit in the fixture's clone: the identity and the address are set right here so that git does
// not ask.
function commit(dir, subject) {
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local', 'commit', '-qm', subject]);
  return gitIn(dir, ['rev-parse', 'HEAD']).trim();
}

/* Settings for a repository of one's own: they hold only what describes the project, and the engine's
 * defaults add the rest. So the check does not depend on which columns the fixture has. */
function ownConfig(name, columns) {
  const file = path.join(tmp, name + '.json');
  fs.writeFileSync(file, JSON.stringify({
    output: 'docs/size-table.html',
    locale: 'ru',
    metrics: ['raw'],
    columns: columns
  }, null, 2) + '\n');
  return file;
}

/* Settings whose `fixCommand` is a real command: the refusal quotes it as its advice, and checking
 * the advice means running it. The advice itself is taken from the refusal's text rather than from
 * these settings: the settings are but the source of the repair command. */
let withFix;
function reconfig() {
  if (withFix === undefined) {
    const cfg = readJson(CONFIG);
    withFix = path.join(tmp, 'merge.json');
    cfg.fixCommand = 'node ' + PACKAGE_BIN + ' --config ' + withFix + ' --write';
    fs.writeFileSync(withFix, JSON.stringify(cfg, null, 2) + '\n');
  }
  return withFix;
}

function fixCommand(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8')).fixCommand;
}

/* A mutated engine is a **copy** of the sources rather than the live tree: the suites run file by file
 * in parallel, and a broken `git.js` in the live tree would be a mutation at the neighbour's expense.
 * The replacement is checked: once it stops applying, the mutation needs rewriting, and the run must
 * not be taken for proof. */
function mutatedEngine(name, part, from, to) {
  const source = fs.readFileSync(path.join(ROOT, 'src', part), 'utf8');
  const mutated = source.replace(from, to);
  assert.notEqual(mutated, source, 'the mutation did not apply: ' + part + ' was rewritten, the mutation needs updating');
  const dir = path.join(tmp, 'engine-' + name);
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'src'), path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', part), mutated);
  fs.copyFileSync(PACKAGE_BIN, path.join(dir, 'bin', 'size.js'));
  return { name: 'the mutated engine', file: path.join(dir, 'bin', 'size.js'), env: null };
}

/* A loss while the state is carried: the merge commit is deprived of its list of changed paths, so
 * what came in by the merge never reaches the state. */
function engineWithoutMergePaths() {
  return mutatedEngine('without-merge-paths', 'git.js', "'--diff-merges=first-parent', ", '');
}

/* A check of the check: an edit of a file on disk that git says nothing about (the file is marked
 * "assumed unchanged") has to be caught. */
function assertCatchesDiskEdit(dir, label) {
  gitIn(dir, ['update-index', '--assume-unchanged', 'src/code.js']);
  fs.appendFileSync(path.join(dir, 'src', 'code.js'), '// правка, которой нет в git\n');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '',
    'in the working tree «' + label + '» the edit went into the git status: the file would fall out of the comparison as dirty, and there would be nothing to check');
  const res = runFixtureWith(PACKAGE, dir, ['--json']);
  assert.notEqual(res.code, 0, 'the comparison skipped an edit that is not in the history (' + label + ')');
  assert.match(res.stderr, /the edit exists on disk only/,
    'the comparison refused for another reason: ' + res.stderr.trim().split('\n')[0]);

  /* The refusal's advice is a command and has to work: `git checkout -- <path>` returns the file to
   * HEAD, and the same call answers zero afterwards. */
  assert.match(res.stderr, /fix: commit the edit or roll it back: git checkout -- /,
    'the advice does not say how to bring the file back: ' + res.stderr.trim());
  gitIn(dir, ['checkout', '--', 'src/code.js']);
  const after = runFixtureWith(PACKAGE, dir, ['--json']);
  assert.equal(after.code, 0, 'the advice «git checkout -- src/code.js» did not repair the state (' + label + '): '
    + (after.stderr || after.stdout).trim().split('\n')[0]);
}

test('an edit of a file on disk only is caught — both in an ordinary working tree and in CRLF', () => {
  assertCatchesDiskEdit(cloneFixture(path.join(tmp, 'edit-plain')), 'an ordinary working tree');
  assertCatchesDiskEdit(cloneCrlf(path.join(tmp, 'edit-crlf')), 'a CRLF working tree');
});

/* The second half of the comparison — the state against the commit's tree — exists for an edit lost
 * while the state was carried between commits. The first witness: a conflict resolution falls out of
 * the state (the mutation above) while remaining in the tree. */
test('a lost edit of a merge commit is caught by the state against the tree', () => {
  const dir = cloneFixture(path.join(tmp, 'mutated-clone'));
  const tool = engineWithoutMergePaths();
  const res = runTool(tool, dir, ['--config', reconfig(), '--json']);
  assert.notEqual(res.code, 0, 'the lost edit of a merge commit slipped past the comparison');
  assert.match(res.stderr, /carrying the state between commits lost an edit/,
    'the comparison refused for another reason: ' + res.stderr.trim().split('\n')[0]);

  /* This refusal's advice is no repair command, and the text says so: the discrepancy lies in the
   * carrying of the state itself, and a rebuild will not change it. Both halves are checked: the
   * diagnostic command runs, while the rebuild does not remove the refusal — otherwise the advice's
   * text would be untrue. */
  assert.match(res.stderr, /fix: a rebuild does not cure this/,
    'the advice promises what a rebuild does not do, or is not named:\n' + res.stderr.trim());
  assert.match(res.stderr, /See it with: git show HEAD:/,
    'the advice does not say what to show it with:\n' + res.stderr.trim());
  const shown = spawnSync('bash', ['-c', 'git show HEAD:src/code.js'], { cwd: dir, encoding: 'utf8' });
  assert.equal(shown.status, 0, 'the advice calls git show on what git does not show: '
    + (shown.stderr || '').trim().split('\n')[0]);
  const rebuild = spawnSync('bash', ['-c', fixCommand(reconfig())], { cwd: dir, encoding: 'utf8' });
  assert.equal(rebuild.status, 0, 'the rebuild command from the settings does not work: '
    + (rebuild.stderr || '').trim().split('\n')[0]);
  const after = runTool(tool, dir, ['--config', reconfig(), '--json']);
  assert.notEqual(after.code, 0, 'the rebuild removed the divergence — then the text of the advice is wrong');
});

/* The second witness: a file that appears **in the merge itself** — how a resolution looks when the
 * file is created anew (neither parent has it). The same mutated engine learns nothing of its
 * appearance, and the state comes out empty where the tree holds a file — another case of the same
 * comparison: a lost creation. The first run is with the whole engine: such a history has to
 * assemble. */
test('a lost creation of a file is caught by the state against the tree', () => {
  const dir = initRepo(path.join(tmp, 'created-in-merge'));
  fs.writeFileSync(path.join(dir, 'src', 'base.js'), 'export const base = 1;\n');
  commit(dir, 'начало');
  gitIn(dir, ['checkout', '-q', '-b', 'side']);
  fs.writeFileSync(path.join(dir, 'src', 'side.js'), 'export const side = 2;\n');
  commit(dir, 'файл в ветке');
  gitIn(dir, ['checkout', '-q', 'main']);
  fs.writeFileSync(path.join(dir, 'src', 'base.js'), 'export const base = 1;\nexport const more = 2;\n');
  commit(dir, 'правка ствола');
  // The merge is brought to a commit by hand: the file is created in the merge itself.
  gitIn(dir, ['merge', '-q', '--no-commit', '--no-ff', 'side']);
  fs.writeFileSync(path.join(dir, 'src', 'only-in-merge.js'), 'export const resolved = 3;\n');
  commit(dir, 'слияние: файл заведён при разрешении');

  const parents = gitIn(dir, ['log', '-1', '--format=%P']).trim().split(' ');
  assert.equal(parents.length, 2, 'no merge came out: HEAD has one parent, and there is nothing to check');
  parents.forEach((parent) => {
    assert.throws(() => gitIn(dir, ['cat-file', '-e', parent + ':src/only-in-merge.js']),
      'the file is there at the parent ' + parent.slice(0, 7) + ': the creation did not happen in a merge');
  });

  const file = ownConfig('created-in-merge', [
    { label: 'base.js', paths: ['src/base.js'] },
    { label: 'side.js', paths: ['src/side.js'] },
    { label: 'only-in-merge.js', paths: ['src/only-in-merge.js'] }
  ]);

  const ok = runSize(dir, ['--config', file, '--json']);
  assert.equal(ok.code, 0, 'the history with a file created in a merge is not built: '
    + ok.stderr.trim().split('\n')[0]);

  const res = runTool(engineWithoutMergePaths(), dir, ['--config', file, '--json']);
  assert.notEqual(res.code, 0, 'the lost creation of a file slipped past the comparison');
  assert.match(res.stderr, /in the tree: src\/only-in-merge\.js/,
    'the refusal did not name the tree side: ' + res.stderr.trim().split('\n')[0]);
  assert.match(res.stderr, /in the state: the file is absent/,
    'the refusal did not name the state side: ' + res.stderr.trim().split('\n')[0]);
});

/* The other side of the same comparison: a column whose file lived in the history and was removed
 * before HEAD is no lost state. The run has to assemble, and the column's numbers have to agree with
 * what git shows (the blob's size at every commit). */
test('a file deleted before HEAD does not bring the run down, and the numbers agree with the history', () => {
  const dir = cloneFixture(path.join(tmp, 'gone'));
  const gone = path.join(dir, 'src', 'gone.js');

  fs.writeFileSync(gone, 'const a = 1;\n');
  const first = commit(dir, 'добавил gone.js');
  fs.writeFileSync(gone, 'const a = 2;\nconst b = 3;\n');
  const edited = commit(dir, 'правил gone.js');
  fs.rmSync(gone);
  const removed = commit(dir, 'удалил gone.js');
  fs.writeFileSync(gone, 'const a = 1;\n');
  const back = commit(dir, 'вернул gone.js');
  fs.rmSync(gone);
  const removedAgain = commit(dir, 'удалил gone.js снова');

  const res = runSize(dir, ['--config', configWith(tmp, 'gone', (cfg) => {
    cfg.columns = cfg.columns.concat([{ label: 'gone.js', paths: ['src/gone.js'] }]);
  }), '--json']);
  assert.equal(res.code, 0, 'the history with a deleted file is not built: ' + res.stderr.trim().split('\n')[0]);
  assert.equal(/carrying the state/.test(res.stderr), false,
    'the comparison took a deleted file for a lost state:\n' + res.stderr);

  const data = JSON.parse(res.stdout);
  const i = data.columns.findIndex((c) => c.label === 'gone.js');
  assert.notEqual(i, -1, 'the column got lost in the data');
  const reported = {};
  data.rows.forEach((row) => { reported[row.sha] = row.cells[i] === null ? null : row.cells[i].raw; });
  // The size comes from git rather than from the same code: the blob of the revision holding the
  // file.
  const blobSize = (sha) => Number(gitIn(dir, ['cat-file', '-s', sha + ':src/gone.js']).trim());
  assert.deepEqual(
    [reported[first], reported[edited], reported[removed], reported[back], reported[removedAgain]],
    [blobSize(first), blobSize(edited), null, blobSize(back), null],
    'the numbers of the column diverged from the git history');
  assert.equal(reported[first], reported[back],
    'bringing the same file back is counted differently from its first appearance');
});

/* The third witness of the comparison is a lost **removal**: the state remembers the file while the
 * tree has none. Here the file is removed in the merge only (by hand, as the merge is brought to a
 * commit), so the mutated engine again learns nothing of it and has to refuse, while the whole engine
 * assembles the same history. */
test('a lost deletion of a file is caught by the state against the tree', () => {
  const dir = initRepo(path.join(tmp, 'deleted-in-merge'));
  fs.writeFileSync(path.join(dir, 'src', 'keep.js'), 'export const keep = 1;\n');
  fs.writeFileSync(path.join(dir, 'src', 'gone.js'), 'export const gone = 2;\n');
  commit(dir, 'начало');
  gitIn(dir, ['checkout', '-q', '-b', 'side']);
  // The branch edits a non-column: the merge has to be a real one, while the mutated engine must not
  // lose other columns — or the refusal would come about something else.
  fs.writeFileSync(path.join(dir, 'NOTES.md'), 'ветка\n');
  commit(dir, 'заметка в ветке');
  gitIn(dir, ['checkout', '-q', 'main']);
  fs.writeFileSync(path.join(dir, 'src', 'keep.js'), 'export const keep = 1;\nexport const more = 2;\n');
  commit(dir, 'правка ствола');
  gitIn(dir, ['merge', '-q', '--no-commit', '--no-ff', 'side']);
  fs.rmSync(path.join(dir, 'src', 'gone.js'));
  commit(dir, 'слияние: файл удалён при разрешении');

  const file = ownConfig('deleted-in-merge', [
    { label: 'keep.js', paths: ['src/keep.js'] },
    { label: 'gone.js', paths: ['src/gone.js'] }
  ]);

  const ok = runSize(dir, ['--config', file, '--json']);
  assert.equal(ok.code, 0, 'the history with a deletion in a merge is not built: '
    + ok.stderr.trim().split('\n')[0]);

  const res = runTool(engineWithoutMergePaths(), dir, ['--config', file, '--json']);
  assert.notEqual(res.code, 0, 'the lost deletion slipped past the comparison');
  assert.match(res.stderr, /in the tree: the file is absent/,
    'the refusal did not name the tree side: ' + res.stderr.trim().split('\n')[0]);
  assert.match(res.stderr, /in the state: src\/gone\.js/,
    'the refusal did not name the state side: ' + res.stderr.trim().split('\n')[0]);
});

/* A trap of someone else's environment: with rename detection off, git hands over **both** paths of
 * a renamed file in one commit — the old name and the new one. A column with two aliases used to take
 * the first in the settings' order, that is, the one that had disappeared, and the state lost the
 * file: the comparison refused a lawful case. The choice goes by what the commit really holds, so the
 * run has to assemble and the numbers have to agree with the blob in git. */
test('a rename inside the aliases of a column does not bring the run down', () => {
  const dir = cloneFixture(path.join(tmp, 'alias-rename'));
  gitIn(dir, ['mv', 'src/modern.js', 'src/legacy.js']);
  commit(dir, 'имя файла вернулось к legacy.js');
  // git's default (a rename is one path) and someone else's environment: both have to work.
  const env = gitConfig({ 'diff.renames': 'false' });
  const plain = runFixtureWith(PACKAGE, dir, ['--json']);
  assert.equal(plain.code, 0, 'the history with a rename is not built: '
    + plain.stderr.trim().split('\n')[0]);
  const res = runFixtureWith(PACKAGE, dir, ['--json'], env);
  assert.equal(res.code, 0, 'the rename brings the run down with diff.renames=false: '
    + res.stderr.trim().split('\n')[0]);

  const data = JSON.parse(res.stdout);
  const i = data.columns.findIndex((c) => c.label === 'modern.js');
  const last = data.rows[data.rows.length - 1];
  assert.notEqual(last.cells[i], null, 'the column is empty on the last row: the file is lost');
  // The size comes from git: in that revision the file lies under one of the aliases, and that is its
  // blob.
  const blobSize = (sha) => {
    const found = ['src/modern.js', 'src/legacy.js'].filter((p) => {
      try { gitIn(dir, ['cat-file', '-e', sha + ':' + p]); return true; } catch (_e) { return false; }
    });
    assert.equal(found.length, 1, 'in the revision ' + sha.slice(0, 7) + ' the file is not alone or is missing');
    return Number(gitIn(dir, ['cat-file', '-s', sha + ':' + found[0]]).trim());
  };
  assert.equal(last.cells[i].raw, blobSize(last.sha),
    'the number of the column diverged from the git blob on the row ' + last.sha.slice(0, 7));
});

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

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CONFIG, PACKAGE, PACKAGE_BIN, ROOT, cloneCrlf, cloneFixture, gitConfig, gitIn, initRepo,
  readJson, runFixtureWith, runSize, runTool, tempDir
} from '../tools/harness.js';

const tmp = tempDir('disk');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// A commit in the fixture's clone: the identity and the address are set right here so that git does
// not ask.
function commit(dir, subject) {
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local', 'commit', '-qm', subject]);
  return gitIn(dir, ['rev-parse', 'HEAD']).trim();
}

// The reference settings with a column added: the history and the other columns stay as they are.
function configWith(name, columns) {
  const cfg = readJson(CONFIG);
  cfg.columns = cfg.columns.concat(columns);
  const file = path.join(tmp, name + '.json');
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  return file;
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
  assert.notEqual(mutated, source, 'мутация не применилась: ' + part + ' переписан, мутацию пора обновить');
  const dir = path.join(tmp, 'engine-' + name);
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'src'), path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', part), mutated);
  fs.copyFileSync(PACKAGE_BIN, path.join(dir, 'bin', 'size.js'));
  return { name: 'мутированный движок', file: path.join(dir, 'bin', 'size.js'), env: null };
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
    'в выкладке «' + label + '» правка попала в статус git: файл выпал бы из сверки как грязный, и проверять нечего');
  const res = runFixtureWith(PACKAGE, dir, ['--json']);
  assert.notEqual(res.code, 0, 'сверка пропустила правку, которой нет в истории (' + label + ')');
  assert.match(res.stderr, /правка есть только на диске/,
    'сверка отказалась по другой причине: ' + res.stderr.trim().split('\n')[0]);

  /* The refusal's advice is a command and has to work: `git checkout -- <path>` returns the file to
   * HEAD, and the same call answers zero afterwards. */
  assert.match(res.stderr, /починка: закоммитьте правку или откатите её: git checkout -- /,
    'совет не называет, как вернуть файл: ' + res.stderr.trim());
  gitIn(dir, ['checkout', '--', 'src/code.js']);
  const after = runFixtureWith(PACKAGE, dir, ['--json']);
  assert.equal(after.code, 0, 'совет «git checkout -- src/code.js» не починил состояние (' + label + '): '
    + (after.stderr || after.stdout).trim().split('\n')[0]);
}

test('правка файла только на диске ловится — и в обычной выкладке, и в CRLF', () => {
  assertCatchesDiskEdit(cloneFixture(path.join(tmp, 'edit-plain')), 'обычная выкладка');
  assertCatchesDiskEdit(cloneCrlf(path.join(tmp, 'edit-crlf')), 'выкладка CRLF');
});

/* The second half of the comparison — the state against the commit's tree — exists for an edit lost
 * while the state was carried between commits. The first witness: a conflict resolution falls out of
 * the state (the mutation above) while remaining in the tree. */
test('потерянная правка merge-коммита ловится состоянием против дерева', () => {
  const dir = cloneFixture(path.join(tmp, 'mutated-clone'));
  const tool = engineWithoutMergePaths();
  const res = runTool(tool, dir, ['--config', reconfig(), '--json']);
  assert.notEqual(res.code, 0, 'потерянная правка merge-коммита прошла мимо сверки');
  assert.match(res.stderr, /перенос состояния между коммитами пропустил правку/,
    'сверка отказалась по другой причине: ' + res.stderr.trim().split('\n')[0]);

  /* This refusal's advice is no repair command, and the text says so: the discrepancy lies in the
   * carrying of the state itself, and a rebuild will not change it. Both halves are checked: the
   * diagnostic command runs, while the rebuild does not remove the refusal — otherwise the advice's
   * text would be untrue. */
  assert.match(res.stderr, /починка: пересборкой это не лечится/,
    'совет обещает то, чего пересборка не делает, или не назван:\n' + res.stderr.trim());
  assert.match(res.stderr, /Разбор: git show HEAD:/,
    'совет не называет, чем это показать:\n' + res.stderr.trim());
  const shown = spawnSync('bash', ['-c', 'git show HEAD:src/code.js'], { cwd: dir, encoding: 'utf8' });
  assert.equal(shown.status, 0, 'совет зовёт git show на то, что git не показывает: '
    + (shown.stderr || '').trim().split('\n')[0]);
  const rebuild = spawnSync('bash', ['-c', fixCommand(reconfig())], { cwd: dir, encoding: 'utf8' });
  assert.equal(rebuild.status, 0, 'команда пересборки из настроек не работает: '
    + (rebuild.stderr || '').trim().split('\n')[0]);
  const after = runTool(tool, dir, ['--config', reconfig(), '--json']);
  assert.notEqual(after.code, 0, 'пересборка убрала расхождение — тогда текст совета неверен');
});

/* The second witness: a file that appears **in the merge itself** — how a resolution looks when the
 * file is created anew (neither parent has it). The same mutated engine learns nothing of its
 * appearance, and the state comes out empty where the tree holds a file — another case of the same
 * comparison: a lost creation. The first run is with the whole engine: such a history has to
 * assemble. */
test('потерянное создание файла ловится состоянием против дерева', () => {
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
  assert.equal(parents.length, 2, 'слияния не вышло: у HEAD один родитель, и проверять нечего');
  parents.forEach((parent) => {
    assert.throws(() => gitIn(dir, ['cat-file', '-e', parent + ':src/only-in-merge.js']),
      'файл есть у родителя ' + parent.slice(0, 7) + ': создание произошло не в слиянии');
  });

  const file = ownConfig('created-in-merge', [
    { label: 'base.js', paths: ['src/base.js'] },
    { label: 'side.js', paths: ['src/side.js'] },
    { label: 'only-in-merge.js', paths: ['src/only-in-merge.js'] }
  ]);

  const ok = runSize(dir, ['--config', file, '--json']);
  assert.equal(ok.code, 0, 'история с созданием файла в слиянии не собирается: '
    + ok.stderr.trim().split('\n')[0]);

  const res = runTool(engineWithoutMergePaths(), dir, ['--config', file, '--json']);
  assert.notEqual(res.code, 0, 'потерянное создание файла прошло мимо сверки');
  assert.match(res.stderr, /в дереве src\/only-in-merge\.js/,
    'отказ не назвал сторону дерева: ' + res.stderr.trim().split('\n')[0]);
  assert.match(res.stderr, /в состоянии файла нет/,
    'отказ не назвал сторону состояния: ' + res.stderr.trim().split('\n')[0]);
});

/* The other side of the same comparison: a column whose file lived in the history and was removed
 * before HEAD is no lost state. The run has to assemble, and the column's numbers have to agree with
 * what git shows (the blob's size at every commit). */
test('файл, удалённый до HEAD, не роняет прогон и числа сходятся с историей', () => {
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

  const res = runSize(dir, ['--config', configWith('gone', [{ label: 'gone.js', paths: ['src/gone.js'] }]), '--json']);
  assert.equal(res.code, 0, 'история с удалённым файлом не собирается: ' + res.stderr.trim().split('\n')[0]);
  assert.equal(/перенос состояния/.test(res.stderr), false,
    'сверка приняла удалённый файл за потерянное состояние:\n' + res.stderr);

  const data = JSON.parse(res.stdout);
  const i = data.columns.findIndex((c) => c.label === 'gone.js');
  assert.notEqual(i, -1, 'колонка потерялась в данных');
  const reported = {};
  data.rows.forEach((row) => { reported[row.sha] = row.cells[i] === null ? null : row.cells[i].raw; });
  // The size comes from git rather than from the same code: the blob of the revision holding the
  // file.
  const blobSize = (sha) => Number(gitIn(dir, ['cat-file', '-s', sha + ':src/gone.js']).trim());
  assert.deepEqual(
    [reported[first], reported[edited], reported[removed], reported[back], reported[removedAgain]],
    [blobSize(first), blobSize(edited), null, blobSize(back), null],
    'числа колонки разошлись с историей git');
  assert.equal(reported[first], reported[back],
    'возврат того же файла посчитан иначе, чем его первое появление');
});

/* The third witness of the comparison is a lost **removal**: the state remembers the file while the
 * tree has none. Here the file is removed in the merge only (by hand, as the merge is brought to a
 * commit), so the mutated engine again learns nothing of it and has to refuse, while the whole engine
 * assembles the same history. */
test('потерянное удаление файла ловится состоянием против дерева', () => {
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
  assert.equal(ok.code, 0, 'история с удалением в слиянии не собирается: '
    + ok.stderr.trim().split('\n')[0]);

  const res = runTool(engineWithoutMergePaths(), dir, ['--config', file, '--json']);
  assert.notEqual(res.code, 0, 'потерянное удаление прошло мимо сверки');
  assert.match(res.stderr, /в дереве файла нет/,
    'отказ не назвал сторону дерева: ' + res.stderr.trim().split('\n')[0]);
  assert.match(res.stderr, /в состоянии src\/gone\.js/,
    'отказ не назвал сторону состояния: ' + res.stderr.trim().split('\n')[0]);
});

/* A trap of someone else's environment: with rename detection off, git hands over **both** paths of
 * a renamed file in one commit — the old name and the new one. A column with two aliases used to take
 * the first in the settings' order, that is, the one that had disappeared, and the state lost the
 * file: the comparison refused a lawful case. The choice goes by what the commit really holds, so the
 * run has to assemble and the numbers have to agree with the blob in git. */
test('переименование внутри псевдонимов колонки не роняет прогон', () => {
  const dir = cloneFixture(path.join(tmp, 'alias-rename'));
  gitIn(dir, ['mv', 'src/modern.js', 'src/legacy.js']);
  commit(dir, 'имя файла вернулось к legacy.js');
  // git's default (a rename is one path) and someone else's environment: both have to work.
  const env = gitConfig({ 'diff.renames': 'false' });
  const plain = runFixtureWith(PACKAGE, dir, ['--json']);
  assert.equal(plain.code, 0, 'история с переименованием не собирается: '
    + plain.stderr.trim().split('\n')[0]);
  const res = runFixtureWith(PACKAGE, dir, ['--json'], env);
  assert.equal(res.code, 0, 'переименование роняет прогон при diff.renames=false: '
    + res.stderr.trim().split('\n')[0]);

  const data = JSON.parse(res.stdout);
  const i = data.columns.findIndex((c) => c.label === 'modern.js');
  const last = data.rows[data.rows.length - 1];
  assert.notEqual(last.cells[i], null, 'колонка пуста на последней строке: файл потерян');
  // The size comes from git: in that revision the file lies under one of the aliases, and that is its
  // blob.
  const blobSize = (sha) => {
    const found = ['src/modern.js', 'src/legacy.js'].filter((p) => {
      try { gitIn(dir, ['cat-file', '-e', sha + ':' + p]); return true; } catch (_e) { return false; }
    });
    assert.equal(found.length, 1, 'в ревизии ' + sha.slice(0, 7) + ' файл не один или его нет');
    return Number(gitIn(dir, ['cat-file', '-s', sha + ':' + found[0]]).trim());
  };
  assert.equal(last.cells[i].raw, blobSize(last.sha),
    'число колонки разошлось с блобом git на строке ' + last.sha.slice(0, 7));
});

/* Сверка с рабочим деревом: две её стороны и свидетели, ради которых она
 * написана.
 *
 *   - правка файла только на диске (git о ней молчит) обязана ловиться — иначе
 *     «починка» свелась бы к удалению сверки;
 *   - потеря при переносе между коммитами (`--diff-merges=first-parent` у
 *     merge-коммита) видна только при сравнении состояния с деревом коммита, и
 *     теряется она тремя способами: правкой, созданием файла и его удалением;
 *   - колонка, чей файл удалён до HEAD, и переименование внутри её псевдонимов —
 *     не потеря: прогон обязан собраться, а числа — сойтись с git.
 *
 * Клоны здесь свои у каждой проверки: они правят файлы, и общий клон после этого
 * не годится никому (одна проверка подсунула бы другой свою правку).
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CONFIG, PACKAGE, PACKAGE_BIN, ROOT, cloneCrlf, cloneFixture, gitConfig, gitIn, readJson,
  runFixtureWith, runSize, runTool, tempDir
} from '../tools/harness.js';

const tmp = tempDir('disk');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// Коммит в клоне фикстуры: подпись и адрес задаются тут же, чтобы git не спрашивал.
function commit(dir, subject) {
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local', 'commit', '-qm', subject]);
  return gitIn(dir, ['rev-parse', 'HEAD']).trim();
}

// Копия эталонных настроек с добавленной колонкой: история и остальные колонки те же.
function configWith(name, columns) {
  const cfg = readJson(CONFIG);
  cfg.columns = cfg.columns.concat(columns);
  const file = path.join(tmp, name + '.json');
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  return file;
}

/* Настройки под свой репозиторий: в них только то, что описывает проект, —
 * остальное досыпают умолчания движка. Так проверка не зависит от того, какие
 * колонки в фикстуре. */
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

/* Настройки, у которых `fixCommand` — настоящая команда: отказ цитирует её в совете,
 * и проверить совет значит выполнить её. Сам совет берётся из текста отказа, а не из
 * этих настроек: настройки — только источник команды починки. */
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

/* Мутированный движок — **копия** исходников, а не живое дерево: наборы идут по
 * файлам параллельно, и сломанный `git.js` в живом дереве был бы мутацией у
 * соседа. Замена проверяется: если она перестала применяться, мутацию пора
 * переписать, а не считать прогон доказательством. */
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

/* Потеря при переносе состояния: у merge-коммита отнят список изменённых путей,
 * поэтому в состояние не попадает то, что пришло слиянием. */
function engineWithoutMergePaths() {
  return mutatedEngine('without-merge-paths', 'git.js', "'--diff-merges=first-parent', ", '');
}

/* Подпись и настройки в своём репозитории: одинаковые во всех проверках этого
 * файла, где репозиторий собирается с нуля. */
function initRepo(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  gitIn(dir, ['init', '-q', '-b', 'main']);
  ['user.name', 'user.email', 'commit.gpgsign'].forEach((key, i) => {
    gitIn(dir, ['config', key, ['fixture', 'fixture@local', 'false'][i]]);
  });
  return dir;
}

/* Проверка проверки: правка файла на диске, о которой git молчит (файл помечен
 * «предполагается неизменным»), обязана быть поймана. */
function assertCatchesDiskEdit(dir, label) {
  gitIn(dir, ['update-index', '--assume-unchanged', 'src/code.js']);
  fs.appendFileSync(path.join(dir, 'src', 'code.js'), '// правка, которой нет в git\n');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '',
    'в выкладке «' + label + '» правка попала в статус git: файл выпал бы из сверки как грязный, и проверять нечего');
  const res = runFixtureWith(PACKAGE, dir, ['--json']);
  assert.notEqual(res.code, 0, 'сверка пропустила правку, которой нет в истории (' + label + ')');
  assert.match(res.stderr, /правка есть только на диске/,
    'сверка отказалась по другой причине: ' + res.stderr.trim().split('\n')[0]);

  /* Совет отказа — команда, и она обязана работать: `git checkout -- <путь>`
   * возвращает файл к HEAD, и тот же зов после этого отвечает нулём. */
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

/* Вторая половина сверки — состояние против дерева коммита — существует ради
 * правки, потерянной при переносе между коммитами. Первый свидетель: правка
 * разрешения конфликта выпадает из состояния (мутация выше), а в дереве остаётся. */
test('потерянная правка merge-коммита ловится состоянием против дерева', () => {
  const dir = cloneFixture(path.join(tmp, 'mutated-clone'));
  const tool = engineWithoutMergePaths();
  const res = runTool(tool, dir, ['--config', reconfig(), '--json']);
  assert.notEqual(res.code, 0, 'потерянная правка merge-коммита прошла мимо сверки');
  assert.match(res.stderr, /перенос состояния между коммитами пропустил правку/,
    'сверка отказалась по другой причине: ' + res.stderr.trim().split('\n')[0]);

  /* Совет этого отказа — не команда починки, и это сказано в тексте: расхождение в
   * самом переносе состояния, и пересборка его не изменит. Проверяются обе
   * половины: команда разбора выполняется, а пересборка отказа не убирает — иначе
   * текст совета был бы неверен. */
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

/* Второй свидетель: файл, который появляется **только в самом слиянии** — так
 * выглядит разрешение, при котором файл заводят заново (ни у одного родителя его
 * нет). Тот же мутированный движок не узнаёт о его появлении, и состояние
 * оказывается пустым там, где в дереве есть файл, — это другой случай той же
 * сверки: потерянное создание. Первый прогон — целым движком: такая история
 * обязана собираться. */
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
  // Слияние доводится до коммита руками: файл заводится в самом слиянии.
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

/* Обратная сторона той же сверки: колонка, чей файл жил в истории и был удалён до
 * HEAD, — не потерянное состояние. Прогон обязан собраться, а числа колонки —
 * сойтись с тем, что видно в git (размер блоба на каждом коммите). */
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
  // Размер — у git, а не у того же кода: блоб той ревизии, где файл есть.
  const blobSize = (sha) => Number(gitIn(dir, ['cat-file', '-s', sha + ':src/gone.js']).trim());
  assert.deepEqual(
    [reported[first], reported[edited], reported[removed], reported[back], reported[removedAgain]],
    [blobSize(first), blobSize(edited), null, blobSize(back), null],
    'числа колонки разошлись с историей git');
  assert.equal(reported[first], reported[back],
    'возврат того же файла посчитан иначе, чем его первое появление');
});

/* Третий свидетель сверки — потерянное **удаление**: состояние помнит файл, а в
 * дереве его нет. Здесь файл удаляется только в слиянии (руками, при доведении
 * слияния до коммита), поэтому мутированный движок снова ничего о нём не узнаёт
 * и обязан отказать; целый движок ту же историю собирает. */
test('потерянное удаление файла ловится состоянием против дерева', () => {
  const dir = initRepo(path.join(tmp, 'deleted-in-merge'));
  fs.writeFileSync(path.join(dir, 'src', 'keep.js'), 'export const keep = 1;\n');
  fs.writeFileSync(path.join(dir, 'src', 'gone.js'), 'export const gone = 2;\n');
  commit(dir, 'начало');
  gitIn(dir, ['checkout', '-q', '-b', 'side']);
  // В ветке правится не-колонка: слияние должно быть настоящим, но чужие
  // колонки мутированный движок терять не должен — иначе отказ придёт не о том.
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

/* Ловушка чужого окружения: при выключенном распознавании переименований git
 * отдаёт в одном коммите **оба** пути переименованного файла — и старое имя, и
 * новое. Колонка с двумя псевдонимами выбирала первый по порядку настроек, то
 * есть исчезнувший, и состояние теряло файл: сверка отказывала на законном
 * случае. Выбор идёт по тому, что в коммите действительно есть, поэтому прогон
 * обязан собраться, а числа — сойтись с блобом из git. */
test('переименование внутри псевдонимов колонки не роняет прогон', () => {
  const dir = cloneFixture(path.join(tmp, 'alias-rename'));
  gitIn(dir, ['mv', 'src/modern.js', 'src/legacy.js']);
  commit(dir, 'имя файла вернулось к legacy.js');
  // Умолчание git (переименование — один путь) и чужое окружение: оба обязаны работать.
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
  // Размер — у git: у ревизии файл лежит по одному из псевдонимов, и это его блоб.
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

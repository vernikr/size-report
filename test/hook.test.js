/* Хук `post-commit` (`size install-hook` / `uninstall-hook` / `hook-run`): отчёт
 * пересобирается сам после коммита, а если он лежит в git — ложится отдельным
 * коммитом. Требование §7.1–§7.3 (автообновление, защита от зацикливания,
 * отключаемость) и шаг 5 плана.
 *
 * Проверяется не форма файла хука, а поведение git-репозитория вокруг него, и
 * каждый случай — в свежем клоне маленького проекта, а не в рабочем дереве пакета:
 * хук живёт в `.git`, то есть у каждого клона свой, и «установлено» проверять
 * больше негде. Проект именно маленький: хук проверяется на трёх коммитах, а не на
 * истории с ловушками, — цена каждого запуска здесь не предмет проверки (бюджет —
 * `REFACTOR.md` §3).
 *
 * Что здесь считается доказательством:
 *
 * - установка — только явной командой, и до неё репозиторий не меняется ничем
 *   (хук лежит в `.git/hooks`, `git status` его не видит);
 * - правка кода даёт **отдельный** коммит с одним лишь отчётом — это и есть ответ
 *   на ловушку «правка кода и таблицы в одном коммите»;
 * - повторный запуск (и хук, запущенный собственным коммитом отчёта) не порождает
 *   следующего: отчёт — путь, который строки не получает, поэтому байты те же;
 * - чужая незакоммиченная работа и индекс не тронуты (`git commit --only`);
 * - отказ инструмента не роняет коммит: причина — одной строкой и в записи, которую
 *   показывает `size doctor`;
 * - там, где обновлять нечего (CI, выключатель, отделённый HEAD, отчёт вне git,
 *   чужой клон без установки), хук молчит и ничего не коммитит;
 * - снятие возвращает проект к прежнему поведению, а чужой `post-commit` и
 *   `core.hooksPath` не перезаписываются вовсе.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { firstLine, gitIn, gitTry, hasStack, runSize, tempDir } from '../tools/harness.js';

const tmp = tempDir('hook');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const REPORT = 'docs/size-table.html';
const CONFIG = 'size-table.config.json';

const SOURCE = path.join(tmp, 'source');
let built = false;

/* Проект-образец: одна колонка кода, отчёт в git, покрытие полное (README и сам
 * конфиг объявлены исключениями). Отчёт собирается инструментом, а не пишется
 * руками: иначе первый же запуск хука переписывал бы его и «хук ничего не сломал»
 * доказывалось бы на разных байтах. */
function source() {
  if (built) return SOURCE;
  fs.mkdirSync(path.join(SOURCE, 'src'), { recursive: true });
  gitIn(SOURCE, ['init', '-q', '-b', 'main']);
  ['user.name', 'user.email', 'commit.gpgsign'].forEach((key, i) => {
    gitIn(SOURCE, ['config', key, ['fixture', 'fixture@local', 'false'][i]]);
  });
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
  assert.equal(runSize(SOURCE, ['--write']).code, 0, 'отчёт образца не собрался');
  gitIn(SOURCE, ['add', REPORT]);
  gitIn(SOURCE, ['commit', '-qm', 'chore: отчёт']);
  built = true;
  return SOURCE;
}

// Свежий клон: хук в него приехать не может (`.git/hooks` не клонируется), а
// жёсткие ссылки выключены — иначе `--write` в клоне правил бы файлы образца.
function clone(name) {
  const dir = path.join(tmp, name);
  gitIn(null, ['clone', '-q', '--no-hardlinks', source(), dir]);
  ['user.name', 'user.email', 'commit.gpgsign'].forEach((key, i) => {
    gitIn(dir, ['config', key, ['fixture', 'fixture@local', 'false'][i]]);
  });
  return dir;
}

function install(dir) {
  const res = runSize(dir, ['--config', CONFIG, 'install-hook']);
  assert.equal(res.code, 0, 'установка хука не прошла: ' + firstLine(res.stdout + res.stderr));
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

// Коммит правки — только названных файлов: индекс чужой работы он не забирает,
// иначе «хук не тронул чужое» проверялось бы на пустом индексе.
function commit(dir, subject, files) {
  files.forEach((f) => fs.appendFileSync(path.join(dir, f), '// ' + subject + '\n'));
  gitIn(dir, ['commit', '-qm', subject, '--'].concat(files));
}

/* ---------- установка ---------- */

test('хук ставится только явной командой и до неё проект не меняется', () => {
  const dir = clone('install');

  // Обычные режимы хук не ставят: автоматика — решение проекта, а не побочный
  // эффект запуска. Отчёт при этом остаётся тем же файлом (иначе первая же правка
  // хука переписывала бы чужие байты).
  assert.equal(runSize(dir, ['--config', CONFIG, '--write']).code, 0);
  assert.equal(runSize(dir, ['--config', CONFIG, 'doctor', '--json']).code, 0,
    'диагностика здорового проекта не зелёная');
  assert.equal(fs.existsSync(hookFileOf(dir)), false, 'хук появился до явной установки');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'проект грязный до установки');

  const res = install(dir);
  assert.ok(fs.existsSync(hookFileOf(dir)), 'файла хука нет: ' + hookFileOf(dir));
  assert.ok((fs.statSync(hookFileOf(dir)).mode & 0o111) !== 0, 'хук не исполняемый: git его не позовёт');
  assert.ok(fs.readFileSync(hookFileOf(dir), 'utf8').indexOf('size-report') >= 0, 'в хуке нет метки инструмента');
  assert.ok(fs.existsSync(path.join(dir, '.git', 'hooks', 'post-merge')),
    'нет хука пост-слияния: git не зовёт post-commit на слияние, отчёт остался бы stale');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '',
    'установка что-то изменила в проекте: хук обязан жить только в `.git`');
  assert.match(res.stdout, /hooks.*enabled/, 'установка не сказала, чем выключается автоматика');

  // Повторная установка — «уже стоит», а не второй файл.
  const again = install(dir);
  assert.match(again.stdout, /установлен/, 'повторная установка не сказала, что уже стоит');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'повторная установка оставила грязь');
});

/* ---------- обновление ---------- */

test('правка кода даёт пересобранный отчёт отдельным коммитом', () => {
  const dir = clone('update');
  install(dir);

  commit(dir, 'feat: правка кода', ['src/code.js']);
  const parent = gitIn(dir, ['rev-parse', 'HEAD^']).trim();

  assert.deepEqual(subjects(dir, 2), ['chore(report): отчёт пересобран после ' + parent.slice(0, 7),
    'feat: правка кода'], 'отчёт не лёг отдельным коммитом сразу после коммита кода');
  assert.deepEqual(gitIn(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'), [REPORT],
    'в коммите отчёта оказалось что-то кроме отчёта');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'после хука рабочее дерево грязное');

  // В коммит легли те же байты, что собирает `--write`: иначе отчёт в истории и
  // отчёт на диске разошлись бы, и проверка «таблица совпадает с историей» — тоже.
  const committed = fs.readFileSync(path.join(dir, REPORT), 'utf8');
  assert.equal(runSize(dir, ['--config', CONFIG, '--write']).code, 0);
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), committed,
    'хук положил в коммит не то, что собирает `--write`');
  assert.equal(runSize(dir, ['--config', CONFIG]).code, 0, 'отчёт в git разошёлся с историей');

  const state = hookState(dir);
  assert.equal(state.result, 'committed', 'хук не записал, что закоммитил: ' + JSON.stringify(state));
  assert.equal(state.head, parent, 'в записи хука не тот коммит');
  assert.equal(runSize(dir, ['--config', CONFIG, 'check', '--json']).code, 0,
    'коммит отчёта сломал полноту покрытия');
});

test('повторный запуск и коммит без изменений ничего не порождают', () => {
  const dir = clone('repeat');
  install(dir);
  commit(dir, 'feat: правка кода', ['src/code.js']);
  assert.match(subjects(dir, 1)[0], /^chore\(report\): /);

  // Пустой коммит: строки от него отчёту не положено, значит и коммита не будет.
  gitIn(dir, ['commit', '-q', '--allow-empty', '-m', 'chore: пусто']);
  assert.equal(subjects(dir, 1)[0], 'chore: пусто', 'хук создал коммит там, где отчёт не менялся');
  assert.equal(gitIn(dir, ['log', '--format=%s']).split('\n').filter((s) => /^chore\(report\)/.test(s)).length, 1,
    'после коммита без изменений появился второй коммит отчёта');

  // И руками тот же ответ: «менять было нечего».
  const res = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(res.code, 0, 'повторный запуск вернул отказ: ' + firstLine(res.stderr));
  assert.equal(res.stdout.trim() + res.stderr.trim(), '', 'повторный запуск напечатал лишнее');
  assert.equal(hookState(dir).result, 'unchanged', 'повторный запуск нашёл что менять');
});

/* На слиянии хук ведёт себя как на любом коммите, но попадает туда другим файлом:
 * git создаёт коммит слияния сам и `post-commit` при этом не зовёт — зовётся
 * `post-merge` (проверено на git 2.50). Отчёт правится в обеих ветвях, поэтому
 * слияние конфликтует — это свойство «отчёта в git», и здесь он разрешается в пользу
 * текущей ветви, как это сделал бы человек.
 *
 * Строки о слиянии в отчёте здесь ждать нечего: она появляется по общему правилу
 * только когда слияние само сдвинуло объём, а правка ветви уже посчитана. Поэтому
 * проверяется то, за что отвечает хук: отчёт после слияния пересобран отдельным
 * коммитом и совпадает с тем, что собирается из истории и дерева. */
test('на слиянии хук ведёт себя как на любом коммите', () => {
  const dir = clone('merge');
  install(dir);

  gitIn(dir, ['checkout', '-q', '-b', 'side']);
  commit(dir, 'feat: правка сбоку', ['src/other.js']);
  gitIn(dir, ['checkout', '-q', 'main']);
  commit(dir, 'feat: правка в основной', ['src/code.js']);
  gitIn(dir, ['merge', '-q', '--no-ff', '--no-edit', '-X', 'ours', 'side']);
  // Хук уже отработал: HEAD — коммит отчёта, а сам merge-коммит — его родитель.
  const merge = gitIn(dir, ['rev-parse', 'HEAD^']).trim();
  assert.equal(gitIn(dir, ['rev-list', '--parents', '-n1', merge]).trim().split(' ').length, 3,
    'слияние не создало merge-коммит: проверять нечего');

  assert.equal(subjects(dir, 1)[0], 'chore(report): отчёт пересобран после ' + merge.slice(0, 7),
    'после слияния отчёт не пересобрался отдельным коммитом');
  assert.deepEqual(gitIn(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'), [REPORT],
    'в коммит отчёта после слияния попало что-то кроме отчёта');
  assert.equal(runSize(dir, ['--config', CONFIG]).code, 0, 'отчёт после слияния разошёлся с историей');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'после слияния дерево грязное');
});

test('чужая незакоммиченная работа и индекс не тронуты', () => {
  const dir = clone('stage');
  install(dir);

  // Отложенная в индексе правка, грязный файл вне индекса и коммит кода: хук
  // обязан оставить всё это как было, а закоммитить только отчёт.
  fs.appendFileSync(path.join(dir, 'src', 'other.js'), '// отложенная правка\n');
  gitIn(dir, ['add', 'src/other.js']);
  fs.appendFileSync(path.join(dir, 'README.md'), 'грязная правка\n');
  commit(dir, 'feat: правка кода', ['src/code.js']);

  // `trim` съел бы значимый ведущий пробел первой строки (« M» — правка вне индекса).
  const status = gitIn(dir, ['status', '--porcelain']).replace(/\n+$/, '').split('\n').sort();
  assert.deepEqual(status, [' M README.md', 'M  src/other.js'],
    'хук тронул чужую работу или индекс: ' + JSON.stringify(status));
  assert.deepEqual(gitIn(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'), [REPORT],
    'в коммит отчёта попала чужая правка');
});

/* ---------- там, где обновлять нечего ---------- */

test('хук молчит в CI, по выключателю и на отделённом HEAD', () => {
  const dir = clone('quiet');
  install(dir);
  commit(dir, 'feat: правка кода', ['src/code.js']);
  const report = fs.readFileSync(path.join(dir, REPORT), 'utf8');

  // Правка на диске: если хук отработает, отчёт изменится — по этому и видно.
  fs.appendFileSync(path.join(dir, 'src', 'code.js'), '// ещё правка\n');
  const env = runSize(dir, ['--config', CONFIG, 'hook-run'], { CI: '1' });
  assert.equal(env.code, 0, 'хук в CI ответил отказом: ' + firstLine(env.stderr));
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'хук обновил отчёт в CI');
  assert.match(hookState(dir).why, /CI/, 'хук не сказал, почему пропустил: ' + JSON.stringify(hookState(dir)));

  const off = runSize(dir, ['--config', CONFIG, 'hook-run'], { SIZE_REPORT_NO_HOOK: '1' });
  assert.equal(off.code, 0);
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'рубильник окружения не сработал');

  // Выключатель в настройках: файл читается с диска, коммитить его не нужно.
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, CONFIG), 'utf8'));
  cfg.hooks = { enabled: false };
  fs.writeFileSync(path.join(dir, CONFIG), JSON.stringify(cfg, null, 2) + '\n');
  const disabled = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(disabled.code, 0);
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'выключатель в настройках не сработал');
  assert.match(hookState(dir).why, /hooks\.enabled/, 'причина пропуска не названа');

  // Выключенный хук виден в диагностике как дело, а не как норма.
  const doc = JSON.parse(runSize(dir, ['--config', CONFIG, 'doctor', '--json']).stdout);
  assert.equal(doc.hooks.installed, true, 'диагностика не видит установленный хук');
  assert.equal(doc.hooks.enabled, false, 'диагностика не видит выключатель');
  assert.ok(doc.findings.some((f) => f.level === 'action' && /хук/.test(f.what)),
    'диагностика молчит о выключенном хуке: ' + JSON.stringify(doc.findings));

  cfg.hooks = { enabled: true };
  fs.writeFileSync(path.join(dir, CONFIG), JSON.stringify(cfg, null, 2) + '\n');
  gitIn(dir, ['checkout', '-q', '--detach']);
  const detached = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(detached.code, 0);
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'на отделённом HEAD отчёт пересобран');
  assert.match(hookState(dir).why, /HEAD отделён/, 'отделённый HEAD назван не своей причиной');
});

test('отказ инструмента не роняет коммит, а причина видна в диагностике', () => {
  // Обрезанная история — отказ самого инструмента (код 3), а не хука.
  const dir = path.join(tmp, 'shallow');
  const shallow = gitTry(null, ['clone', '-q', '--depth', '1', '--no-hardlinks', 'file://' + source(), dir]);
  assert.equal(shallow.status, 0, 'не удалось собрать обрезанную выкладку: ' + firstLine(shallow.stderr));
  ['user.name', 'user.email', 'commit.gpgsign'].forEach((key, i) => {
    gitIn(dir, ['config', key, ['fixture', 'fixture@local', 'false'][i]]);
  });
  install(dir);

  const refused = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(refused.code, 0, 'хук вернул отказ вместо нуля: ' + firstLine(refused.stderr));
  assert.equal(hasStack(refused.stderr), false, 'хук напечатал стек');
  assert.match(refused.stderr.split('\n')[0], /^✗ size-report: /, 'причина не названа строкой: ' + refused.stderr);
  assert.equal(hookState(dir).result, 'refused', 'отказ не записан: ' + JSON.stringify(hookState(dir)));

  // Коммит на месте и он один: отчёта в истории нет, дерево чистое.
  commit(dir, 'feat: правка кода', ['src/code.js']);
  assert.equal(subjects(dir, 1)[0], 'feat: правка кода', 'хук создал коммит после отказа');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'после отказа осталась грязь');

  const doc = JSON.parse(runSize(dir, ['--config', CONFIG, 'doctor', '--json']).stdout);
  assert.equal(doc.hooks.last.result, 'refused', 'диагностика не видит отказа хука');
  assert.ok(doc.findings.some((f) => f.level === 'action' && /хук/.test(f.what)),
    'диагностика не называет сломанный хук делом: ' + JSON.stringify(doc.findings));
});

test('отчёт вне git: хук пересобирает и не коммитит', () => {
  const dir = clone('untracked');
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, CONFIG), 'utf8'));
  cfg.output = '.size-report/report.html';
  fs.writeFileSync(path.join(dir, CONFIG), JSON.stringify(cfg, null, 2) + '\n');
  fs.rmSync(path.join(dir, REPORT));
  install(dir);

  commit(dir, 'feat: правка кода', ['src/code.js']);
  assert.equal(subjects(dir, 1)[0], 'feat: правка кода', 'хук закоммитил отчёт, которого нет в git');
  assert.ok(fs.existsSync(path.join(dir, '.size-report', 'report.html')), 'отчёт вне git не пересобрался');
  assert.equal(hookState(dir).result, 'rebuilt', 'хук не сказал, что пересобрал без коммита');

  // А в свежем клоне хука нет вовсе — это и есть ответ «на чужой машине и в CI».
  assert.equal(fs.existsSync(hookFileOf(clone('fresh'))), false, 'хук приехал вместе с историей');
});

/* ---------- снятие и чужие файлы ---------- */

test('снятие возвращает проект к прежнему поведению', () => {
  const dir = clone('uninstall');
  install(dir);
  commit(dir, 'feat: правка кода', ['src/code.js']);
  assert.match(subjects(dir, 1)[0], /^chore\(report\): /);
  const report = fs.readFileSync(path.join(dir, REPORT), 'utf8');

  const gone = runSize(dir, ['--config', CONFIG, 'uninstall-hook']);
  assert.equal(gone.code, 0, 'снятие не прошло: ' + firstLine(gone.stderr));
  assert.equal(fs.existsSync(hookFileOf(dir)), false, 'файл хука остался');
  assert.equal(fs.existsSync(path.join(dir, '.git', 'hooks', 'post-merge')), false, 'файл хука слияния остался');
  assert.equal(fs.existsSync(path.join(dir, '.git', 'size-report')), false, 'состояние хука осталось');

  commit(dir, 'feat: ещё правка', ['src/code.js']);
  assert.equal(subjects(dir, 1)[0], 'feat: ещё правка', 'снятый хук продолжает коммитить');
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report,
    'снятый хук продолжает пересобирать отчёт');
  assert.equal(runSize(dir, ['--config', CONFIG, 'uninstall-hook']).code, 0, 'повторное снятие — отказ');
});

test('чужой хук и чужой каталог хуков не перезаписываются', () => {
  const dir = clone('foreign');
  const file = hookFileOf(dir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const foreign = '#!/bin/sh\necho чужой хук\n';
  fs.writeFileSync(file, foreign);
  fs.chmodSync(file, 0o755);

  const res = runSize(dir, ['--config', CONFIG, 'install-hook']);
  assert.equal(res.code, 2, 'установка поверх чужого хука не отказ');
  assert.equal(hasStack(res.stderr), false, 'отказ напечатал стек');
  assert.match(res.stderr, /hook-run/, 'отказ не даёт готовой строки для чужого хука:\n' + res.stderr);
  assert.equal(fs.readFileSync(file, 'utf8'), foreign, 'чужой хук переписан');
  assert.equal(runSize(dir, ['--config', CONFIG, 'uninstall-hook']).code, 2, 'снятие тронуло чужой хук');

  fs.rmSync(file);
  gitIn(dir, ['config', 'core.hooksPath', '.githooks']);
  const custom = runSize(dir, ['--config', CONFIG, 'install-hook']);
  assert.equal(custom.code, 2, 'при чужом core.hooksPath установка не отказ');
  assert.match(custom.stderr, /core\.hooksPath/, 'отказ не назвал причину:\n' + custom.stderr);
  assert.equal(fs.existsSync(path.join(dir, '.githooks')), false, 'инструмент создал чужой каталог хуков');
});

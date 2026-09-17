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

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { firstLine, gitIn, hasStack, runSize, shallowClone, tempDir } from '../tools/harness.js';

/* The check sets the environment itself rather than taking the machine's: `CI` and
 * `SIZE_REPORT_NO_HOOK` are the hook's switches and are set for the whole suite in integration, so
 * every scenario would stay silent "for the CI reason" while the hook looked guilty. The scenario
 * about the switches sets them itself — in the call rather than in the process environment. */
delete process.env.CI;
delete process.env.SIZE_REPORT_NO_HOOK;

const tmp = tempDir('hook');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

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

// A fresh clone: no hook can travel into it (`.git/hooks` is not cloned), and hard links are off —
// otherwise `--write` in the clone would edit the sample's files.
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

// A commit of an edit — of the named files alone: it does not take someone else's work from the
// index, or "the hook touched nothing foreign" would be checked on an empty index.
function commit(dir, subject, files) {
  files.forEach((f) => fs.appendFileSync(path.join(dir, f), '// ' + subject + '\n'));
  gitIn(dir, ['commit', '-qm', subject, '--'].concat(files));
}

/* ---------- installation ---------- */

test('хук ставится сам при первом запуске, а ставится ли — решает проект', () => {
  const dir = clone('install');
  const file = hookFileOf(dir);

  // A fresh clone has no hook: `.git/hooks` is not cloned, and nothing can install it before the
  // first run — a manual step is absent on purpose.
  assert.equal(fs.existsSync(file), false, 'хук появился в клоне до первого запуска');

  // The first ordinary run is enough.
  assert.equal(runSize(dir, ['--config', CONFIG, '--write']).code, 0, 'отчёт не собрался');
  assert.ok(fs.existsSync(file), 'первый запуск не поставил хук: ' + file);
  assert.ok((fs.statSync(file).mode & 0o111) !== 0, 'хук не исполняемый: git его не позовёт');
  assert.ok(fs.readFileSync(file, 'utf8').indexOf('size-report') >= 0, 'в хуке нет метки инструмента');
  assert.ok(fs.existsSync(path.join(dir, '.git', 'hooks', 'post-merge')),
    'нет хука пост-слияния: git не зовёт post-commit на слияние, отчёт остался бы stale');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '',
    'постановка что-то изменила в проекте: хук обязан жить только в `.git`');

  // The diagnostics rearrange nothing: it reports rather than repairs.
  const before = fs.readFileSync(file, 'utf8');
  assert.equal(runSize(dir, ['--config', CONFIG, 'doctor', '--json']).code, 0,
    'диагностика здорового проекта не зелёная');
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'диагностика переписала хук');

  // The explicit installation says what a person needs: it is already there, here is what switches
  // it off, here is how it is removed.
  const again = install(dir);
  assert.match(again.stdout, /already installed/, 'установка не сказала, что хук уже стоит');
  assert.match(again.stdout, /hooks.*enabled/, 'установка не сказала, чем выключается автоматика');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'повторная установка оставила грязь');
});

/* The automation is a background service rather than a side effect: where a project does not want it
 * or it cannot be installed, it does not appear and does not get in the way. Checked by a run (the
 * first one in the clone) rather than by reading a condition in the code. */
test('там, где автоматику выключили или поставить нельзя, хук не появляется', () => {
  const off = clone('install-off');
  const offCfg = JSON.parse(fs.readFileSync(path.join(off, CONFIG), 'utf8'));
  offCfg.hooks = { enabled: false };
  fs.writeFileSync(path.join(off, CONFIG), JSON.stringify(offCfg, null, 2) + '\n');
  assert.equal(runSize(off, ['--config', CONFIG, '--write']).code, 0, 'запись с выключателем не прошла');
  assert.equal(fs.existsSync(hookFileOf(off)), false, 'хук поставлен вопреки hooks.enabled: false');

  const foreignDir = clone('install-foreign');
  const foreignFile = hookFileOf(foreignDir);
  fs.mkdirSync(path.dirname(foreignFile), { recursive: true });
  fs.writeFileSync(foreignFile, '#!/bin/sh\necho чужой хук\n');
  fs.chmodSync(foreignFile, 0o755);
  assert.equal(runSize(foreignDir, ['--config', CONFIG, '--write']).code, 0);
  assert.match(fs.readFileSync(foreignFile, 'utf8'), /чужой хук/, 'чужой хук переписан постановкой');

  const customDir = clone('install-custom');
  gitIn(customDir, ['config', 'core.hooksPath', '.githooks']);
  assert.equal(runSize(customDir, ['--config', CONFIG, '--write']).code, 0);
  assert.equal(fs.existsSync(path.join(customDir, '.githooks')), false,
    'постановка создала каталог чужого core.hooksPath');
});

/* ---------- updating ---------- */

test('правка кода даёт пересобранный отчёт отдельным коммитом', () => {
  const dir = clone('update');
  install(dir);

  commit(dir, 'feat: правка кода', ['src/code.js']);
  const parent = gitIn(dir, ['rev-parse', 'HEAD^']).trim();

  assert.deepEqual(subjects(dir, 2), ['chore(report): report rebuilt after ' + parent.slice(0, 7),
    'feat: правка кода'], 'отчёт не лёг отдельным коммитом сразу после коммита кода');
  assert.deepEqual(gitIn(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'), [REPORT],
    'в коммите отчёта оказалось что-то кроме отчёта');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'после хука рабочее дерево грязное');

  // The commit carries the very bytes `--write` assembles: otherwise the report in history and the
  // report on disk would diverge, and so would the check "the table agrees with history".
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

  // An empty commit: it earns the report no row, hence no commit either.
  gitIn(dir, ['commit', '-q', '--allow-empty', '-m', 'chore: пусто']);
  assert.equal(subjects(dir, 1)[0], 'chore: пусто', 'хук создал коммит там, где отчёт не менялся');
  assert.equal(gitIn(dir, ['log', '--format=%s']).split('\n').filter((s) => /^chore\(report\)/.test(s)).length, 1,
    'после коммита без изменений появился второй коммит отчёта');

  // And by hand the answer is the same: there was nothing to change.
  const res = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(res.code, 0, 'повторный запуск вернул отказ: ' + firstLine(res.stderr));
  assert.equal(res.stdout.trim() + res.stderr.trim(), '', 'повторный запуск напечатал лишнее');
  assert.equal(hookState(dir).result, 'unchanged', 'повторный запуск нашёл что менять');
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
test('на слиянии хук ведёт себя как на любом коммите', () => {
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
    'слияние не создало merge-коммит: проверять нечего');

  assert.equal(subjects(dir, 1)[0], 'chore(report): report rebuilt after ' + merge.slice(0, 7),
    'после слияния отчёт не пересобрался отдельным коммитом');
  assert.deepEqual(gitIn(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'), [REPORT],
    'в коммит отчёта после слияния попало что-то кроме отчёта');
  assert.equal(runSize(dir, ['--config', CONFIG]).code, 0, 'отчёт после слияния разошёлся с историей');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'после слияния дерево грязное');
});

test('чужая незакоммиченная работа и индекс не тронуты', () => {
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
    'хук тронул чужую работу или индекс: ' + JSON.stringify(status));
  assert.deepEqual(gitIn(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'), [REPORT],
    'в коммит отчёта попала чужая правка');
});

/* ---------- where there is nothing to update ---------- */

test('хук молчит в CI, по выключателю и на отделённом HEAD', () => {
  const dir = clone('quiet');
  install(dir);
  commit(dir, 'feat: правка кода', ['src/code.js']);
  const report = fs.readFileSync(path.join(dir, REPORT), 'utf8');

  // An edit on disk: if the hook does run, the report changes — which is how it shows.
  fs.appendFileSync(path.join(dir, 'src', 'code.js'), '// ещё правка\n');
  const env = runSize(dir, ['--config', CONFIG, 'hook-run'], { CI: '1' });
  assert.equal(env.code, 0, 'хук в CI ответил отказом: ' + firstLine(env.stderr));
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'хук обновил отчёт в CI');
  assert.match(hookState(dir).why, /CI/, 'хук не сказал, почему пропустил: ' + JSON.stringify(hookState(dir)));

  const off = runSize(dir, ['--config', CONFIG, 'hook-run'], { SIZE_REPORT_NO_HOOK: '1' });
  assert.equal(off.code, 0);
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'рубильник окружения не сработал');

  // The switch in the settings: the file is read off the disk and need not be committed.
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, CONFIG), 'utf8'));
  cfg.hooks = { enabled: false };
  fs.writeFileSync(path.join(dir, CONFIG), JSON.stringify(cfg, null, 2) + '\n');
  const disabled = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(disabled.code, 0);
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'выключатель в настройках не сработал');
  assert.match(hookState(dir).why, /hooks\.enabled/, 'причина пропуска не названа');

  // A switched-off hook shows in the diagnostics as something to act on rather than as the norm.
  const doc = JSON.parse(runSize(dir, ['--config', CONFIG, 'doctor', '--json']).stdout);
  assert.equal(doc.hooks.installed, true, 'диагностика не видит установленный хук');
  assert.equal(doc.hooks.enabled, false, 'диагностика не видит выключатель');
  assert.ok(doc.findings.some((f) => f.level === 'action' && /hook/.test(f.what)),
    'диагностика молчит о выключенном хуке: ' + JSON.stringify(doc.findings));

  cfg.hooks = { enabled: true };
  fs.writeFileSync(path.join(dir, CONFIG), JSON.stringify(cfg, null, 2) + '\n');
  gitIn(dir, ['checkout', '-q', '--detach']);
  const detached = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(detached.code, 0);
  assert.equal(fs.readFileSync(path.join(dir, REPORT), 'utf8'), report, 'на отделённом HEAD отчёт пересобран');
  assert.match(hookState(dir).why, /detached HEAD/, 'отделённый HEAD назван не своей причиной');
});

test('отказ инструмента не роняет коммит, а причина видна в диагностике', () => {
  // A shallow history is a refusal of the tool itself (code 3) rather than of the hook.
  const dir = shallowClone(source(), path.join(tmp, 'shallow'));
  ['user.name', 'user.email', 'commit.gpgsign'].forEach((key, i) => {
    gitIn(dir, ['config', key, ['fixture', 'fixture@local', 'false'][i]]);
  });
  install(dir);

  const refused = runSize(dir, ['--config', CONFIG, 'hook-run']);
  assert.equal(refused.code, 0, 'хук вернул отказ вместо нуля: ' + firstLine(refused.stderr));
  assert.equal(hasStack(refused.stderr), false, 'хук напечатал стек');
  assert.match(refused.stderr.split('\n')[0], /^✗ size-report: /, 'причина не названа строкой: ' + refused.stderr);
  assert.equal(hookState(dir).result, 'refused', 'отказ не записан: ' + JSON.stringify(hookState(dir)));

  // The commit is there and it is the only one: no report in history, a clean tree.
  commit(dir, 'feat: правка кода', ['src/code.js']);
  assert.equal(subjects(dir, 1)[0], 'feat: правка кода', 'хук создал коммит после отказа');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '', 'после отказа осталась грязь');

  const doc = JSON.parse(runSize(dir, ['--config', CONFIG, 'doctor', '--json']).stdout);
  assert.equal(doc.hooks.last.result, 'refused', 'диагностика не видит отказа хука');
  assert.ok(doc.findings.some((f) => f.level === 'action' && /hook/.test(f.what)),
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

  // And a fresh clone has no hook at all — which is the answer for "someone else's machine and
  // integration".
  assert.equal(fs.existsSync(hookFileOf(clone('fresh'))), false, 'хук приехал вместе с историей');
});

/* ---------- removal and someone else's files ---------- */

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

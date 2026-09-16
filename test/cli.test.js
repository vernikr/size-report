/* Refusals of the command line: every dead end has to name the command that leads out of it, and
 * the exit code comes from the engine's table (`EXIT` in `src/size-table.js` — an agent branches on
 * the code, a person reads the command). No stack goes outwards: it suggests no fix while leaking
 * the machine's paths.
 *
 * Here are the help, the settings and the exit codes; what the tool writes and what it checks are in
 * the neighbouring suite (`cli-paths.test.js`). The suites are split by cost rather than by subject:
 * checks inside a file run in sequence, and the work here is spawning processes, so a file of its
 * own keeps this cost out of the fast run.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CONFIG, MAX_BUF, cloneFixture, commandIn, firstLine, gitIn, hasStack, refusal, runSize, tempDir
} from '../tools/harness.js';

const tmp = tempDir('cli');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* ---------- the help ---------- */

test('--help отвечает справкой, кодом 0 и без настроек вовсе', () => {
  const res = runSize(tmp, ['--help']);
  assert.equal(res.code, 0, 'справка не ответила успехом: ' + firstLine(res.stderr));
  assert.equal(hasStack(res.stdout + res.stderr), false, 'в справке стек:\n' + res.stdout);
  ['--init', '--write', '--data', '--json', '--config'].forEach((flag) => {
    assert.ok(res.stdout.indexOf(flag) >= 0, 'в справке нет режима ' + flag);
  });
  assert.match(res.stdout, /Exit codes/, 'справка не называет коды выхода');
});

/* ---------- no settings ---------- */

/* With no settings file the tool no longer refuses: it derives them from the project itself and
 * says so — a file is not worth creating for a first run. A **named** file still is a refusal:
 * `--config` asks about one particular file, and its absence (a typo in the path, someone else's
 * project) must not be covered silently by a guess. */
test('без настроек инструмент работает на выведенных и говорит, чем их закрепить', () => {
  const dir = cloneFixture(path.join(tmp, 'no-config'));
  const res = runSize(dir, []);
  assert.match(res.stderr, /settings derived from the project/,
    'запуск без настроек не сказал, откуда они взялись: ' + firstLine(res.stderr));

  const cmd = commandIn(res.stderr);
  assert.ok(cmd !== null, 'в выводе нет команды, которой настройки закрепляются:\n' + res.stderr);
  assert.equal(cmd.flag, '--init', 'совет ведёт не к закреплению настроек: ' + cmd.flag);
  assert.ok(fs.existsSync(cmd.file), 'совет указывает на несуществующий файл: ' + cmd.file);

  // A named settings file still has to exist — or a typo in the path would give silently different
  // numbers.
  refusal(runSize(dir, ['--config', 'нет-такого.json']), 2, 'названный файл настроек');

  const wrote = runSize(dir, ['--write']);
  assert.equal(wrote.code, 0, 'без настроек инструмент не собрался: ' + firstLine(wrote.stderr));
  assert.ok(fs.existsSync(path.join(dir, 'docs', 'size-table.html')),
    'без настроек таблица не собралась');

  const fix = spawnSync(process.execPath, [cmd.file, '--init'],
    { cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF });
  assert.equal(fix.status, 0, 'команда из вывода не сработала: ' + firstLine(fix.stderr || fix.stdout));
  assert.ok(fs.existsSync(path.join(dir, 'size-table.config.json')),
    'команда из вывода завершилась успехом, но настроек не создала');

  const again = runSize(dir, []);
  assert.equal(/settings derived from the project/.test(again.stderr), false,
    'после закрепления настроек про них всё ещё говорится как о выведенных: ' + firstLine(again.stderr));

  // An advice is closed only when it is really followed: what was pinned has to pass the very check
  // the next run meets it with.
  const second = runSize(dir, ['--write']);
  assert.equal(second.code, 0, 'после закрепления инструмент не работает: ' + firstLine(second.stderr));

  const third = runSize(dir, ['--init']);
  refusal(third, 2, 'повторный --init');
  assert.match(third.stderr, /--force/, 'отказ не говорит, как перезаписать настройки');
});

/* What is derived has to work **right now**: the repair command is quoted by the report's caption
 * and by refusals, so a project's own call is taken only when the script is declared — otherwise the
 * installed package inside the project is named. The commit link is derived from the origin address
 * and only for hosts whose link shape is known: for a foreign one it stays empty, since a link to
 * the wrong place is worse than no link. */
test('команда починки и ссылка на коммит выводятся из проекта', () => {
  const dir = path.join(tmp, 'derived-profile');
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  gitIn(dir, ['init', '-q', '-b', 'main']);
  gitIn(dir, ['config', 'user.name', 'fixture']);
  gitIn(dir, ['config', 'user.email', 'fixture@local']);
  gitIn(dir, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"demo","version":"1.0.0"}\n');
  fs.writeFileSync(path.join(dir, 'src', 'code.js'), '// начало\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'начало']);
  gitIn(dir, ['remote', 'add', 'origin', 'git@github.com:owner/repo.git']);

  // The pinning is what the project works by without a file, so the pinning itself is read: the
  // file is the derived profile.
  const derived = () => {
    const init = runSize(dir, ['--init', '--force']);
    assert.equal(init.code, 0, '--init не закрепил настройки: ' + firstLine(init.stderr));
    return JSON.parse(fs.readFileSync(path.join(dir, 'size-table.config.json'), 'utf8'));
  };

  const first = derived();
  assert.match(first.fixCommand, /bin\/size\.js --write$/, 'команда починки зовёт скрипт,'
    + ' которого в проекте нет (ответит «нет такого скрипта»): ' + first.fixCommand);
  assert.equal(first.links.commitUrl, 'https://github.com/owner/repo/commit/{sha}',
    'ссылка на коммит не выведена из адреса origin: ' + first.links.commitUrl);

  // A declared script is taken: the report's caption leads to what the project builds itself with.
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  pkg.scripts = { sizes: 'size --write' };
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  assert.equal(derived().fixCommand, 'npm run sizes', 'объявленный скрипт проекта не взят');

  // A foreign host is no reason to guess the shape of a link.
  gitIn(dir, ['remote', 'set-url', 'origin', 'git@bitbucket.org:owner/repo.git']);
  assert.equal(derived().links.commitUrl, '',
    'ссылка выведена у хозяина, чей вид ссылки неизвестен');
});

/* A report lying in the history (that is, in a project that has already connected the tool) cannot
 * be a column — or the draft would do exactly what its own check forbids, and the next run would
 * refuse to work. */
test('черновик настроек не делает колонкой саму таблицу', () => {
  const dir = cloneFixture(path.join(tmp, 'init-columns'));
  const init = runSize(dir, ['--init']);
  assert.equal(init.code, 0, 'черновик не создался: ' + firstLine(init.stderr));

  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'size-table.config.json'), 'utf8'));
  assert.equal(cfg.columns.some((c) => c.paths.indexOf(cfg.output) >= 0), false,
    'черновик предложил файл таблицы (' + cfg.output + ') колонкой');
  assert.ok(cfg.columns.length > 0, 'черновик вышел без колонок');

  const res = runSize(dir, ['--json']);
  assert.equal(res.code, 0, 'по черновику инструмент не работает: ' + firstLine(res.stderr));
});

/* ---------- settings that do not parse ---------- */

test('сломанные настройки: код 2, назван файл и что править', () => {
  const dir = cloneFixture(path.join(tmp, 'bad-json'));
  fs.writeFileSync(path.join(dir, 'size-table.config.json'), '{ "output": }');
  const broken = runSize(dir, ['--data']);
  refusal(broken, 2, 'настройки не разобраны');
  assert.ok(broken.stderr.indexOf(path.join(dir, 'size-table.config.json')) >= 0,
    'отказ не называет файл настроек:\n' + broken.stderr);

  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  cfg.metrics = ['nonexistent'];
  fs.writeFileSync(path.join(dir, 'size-table.config.json'), JSON.stringify(cfg, null, 2));
  const wrong = runSize(dir, ['--data']);
  refusal(wrong, 2, 'неизвестная метрика в настройках');
  assert.match(wrong.stderr, /nonexistent/, 'отказ не называет виновника:\n' + wrong.stderr);
});

/* ---------- words and flags the tool does not know ---------- */

test('незнакомый ключ, ключ без значения и лишнее слово — отказ, а не тишина', () => {
  const dir = cloneFixture(path.join(tmp, 'args'));

  // A typo in a flag must not look like a healthy run: a word nobody reads means answering zero
  // while doing nothing.
  ['--wite', '--dta', '--forse'].forEach((typo) => {
    const res = runSize(dir, [typo]);
    refusal(res, 2, 'опечатка в ключе ' + typo);
    assert.ok(res.stderr.indexOf(typo) >= 0, 'отказ не называет ключ ' + typo + ':\n' + res.stderr);
    assert.ok(commandIn(res.stderr) !== null, 'в отказе нет команды починки:\n' + res.stderr);
  });

  // A flag that takes a value but was given none is a silent pass-through too: the settings would
  // fall back to their defaults instead of the ones the person named.
  const noValue = runSize(dir, ['--config']);
  refusal(noValue, 2, 'ключ --config без значения');
  assert.match(noValue.stderr, /"--config"/, 'отказ не называет ключ:\n' + noValue.stderr);

  const force = runSize(dir, ['--force']);
  refusal(force, 2, 'ключ --force без --init');
  assert.match(force.stderr, /--force/, 'отказ не называет ключ:\n' + force.stderr);

  // A word after a flag that takes a value is superfluous, and blaming it as an "unknown command"
  // would name the wrong reason.
  const extra = runSize(dir, ['--write', 'a.html', 'b.html']);
  refusal(extra, 2, 'лишнее слово после ключа со значением');
  assert.match(extra.stderr, /the extra word "b\.html"/, 'отказ назвал не то слово:\n' + extra.stderr);

  const stray = runSize(dir, ['check', 'extra']);
  refusal(stray, 2, 'лишнее слово у команды');
  assert.match(stray.stderr, /"extra" is extra/, 'отказ назвал не причину:\n' + stray.stderr);

  // Lone dashes are no flags and do not slip past the parsing either.
  ['-', '--'].forEach((lonely) => {
    const res = runSize(dir, [lonely]);
    refusal(res, 2, 'одинокий ' + lonely);
    assert.ok(res.stderr.indexOf('"' + lonely + '"') >= 0, 'отказ не называет ' + lonely + ':\n' + res.stderr);
  });

  // The other side: lawful calls stay lawful — a flag's value is not confused with a superfluous
  // word, and a command and flags read in any order.
  const legal = [
    ['--init', 'draft.json', '--force'],
    ['--write', 'out.html', '--config', CONFIG],
    ['explain', gitIn(dir, ['rev-parse', 'HEAD']).trim(), '--config', CONFIG],
    ['--json', '--config', CONFIG],
    ['--data', '--config', CONFIG],
    ['--write', '--config', CONFIG]
  ];
  legal.forEach((args) => {
    const res = runSize(dir, args);
    assert.equal(res.code, 0, 'законный зов «' + args.join(' ') + '» отвергнут: ' + firstLine(res.stderr));
  });
  assert.ok(fs.existsSync(path.join(dir, 'out.html')), 'значение «--write» не дошло до записи');
});

/* A second kind of silent pass-through is a mode rather than a word: `--write --data` answered zero
 * while writing the report and handing over no data — as indistinguishable from a healthy run as a
 * typo. The rule "one mode" lives in the argument parsing, so the check enumerates rather than
 * giving examples: every pair of modes, flags that do not work together, and a flag named twice. */
test('два режима сразу и несовместимые ключи — отказ, а не тишина', () => {
  const dir = cloneFixture(path.join(tmp, 'mode-clash'));
  const modes = ['--init', '--write', '--data'];
  for (let i = 0; i < modes.length; i++) {
    for (let j = i + 1; j < modes.length; j++) {
      const res = runSize(dir, [modes[i], modes[j]]);
      refusal(res, 2, 'два режима: ' + modes[i] + ' ' + modes[j]);
      assert.ok(res.stderr.indexOf('"' + modes[i] + '"') >= 0 && res.stderr.indexOf('"' + modes[j] + '"') >= 0,
        'отказ не называет оба режима:\n' + res.stderr);
      assert.ok(commandIn(res.stderr) !== null, 'в отказе нет команды починки:\n' + res.stderr);
    }
  }

  // Data and writing are different things, and `--json` here is the former shape of the data rather
  // than a command's answer: beside a mode it gets lost just as quietly.
  const dataAndWrite = runSize(dir, ['--json', '--write']);
  refusal(dataAndWrite, 2, '--json рядом с режимом');
  assert.ok(dataAndWrite.stderr.indexOf('"--json"') >= 0 && dataAndWrite.stderr.indexOf('"--write"') >= 0,
    'отказ не называет оба ключа:\n' + dataAndWrite.stderr);

  // A command beside a mode, an answer that is no JSON, a draft file named in two ways.
  const cases = [
    [['check', '--data'], /"check"/],
    [['install-hook', '--json'], /has no answer in JSON/],
    [['--config', CONFIG, '--init', 'draft.json'], /"--init"/],
    [['--write', '--write'], /twice/],
    [['--config', CONFIG, '--config', CONFIG], /twice/]
  ];
  cases.forEach(([args, probe]) => {
    const res = runSize(dir, args);
    refusal(res, 2, 'несовместимый зов «' + args.join(' ') + '»');
    assert.match(res.stderr, probe, 'отказ объясняет не то:\n' + res.stderr);
  });

  // No branch of these refusals may touch the project: parsing happens before the tree is read, so a
  // stray file here would mean the order of the branches still decides.
  assert.equal(fs.existsSync(path.join(dir, 'draft.json')), false,
    'отвергнутый зов всё-таки записал файл');
});

/* `--json` is a shape of an answer rather than a mode, and it follows one rule: exactly four calls
 * have an answer. The check enumerates because the rule is about all of them: with every command and
 * every mode `--json` either answers with data or is refused with the culprit named. The latter is
 * the promise — asking for JSON where it never comes must not look like a healthy run. */
test('--json отвечает ровно там, где у вызова есть ответ', () => {
  const dir = cloneFixture(path.join(tmp, 'json-rule'));
  // The settings are put into the project rather than handed over by a flag: `--config` beside
  // `--init` is a refusal of its own, and the rule's check would be replaced by a check of that
  // refusal.
  fs.copyFileSync(CONFIG, path.join(dir, 'size-table.config.json'));
  const sha = gitIn(dir, ['rev-parse', 'HEAD']).trim();

  // The four calls that have an answer: with no command and no mode the former shape of the data
  // (frozen by the parity golden), and three commands with answers of their own.
  [[], ['check'], ['doctor'], ['explain', sha]].forEach((args) => {
    const res = runSize(dir, args.concat('--json'));
    assert.equal(hasStack(res.stderr), false,
      'зов «' + args.concat('--json').join(' ') + '» упал стеком:\n' + res.stderr);
    const rep = JSON.parse(res.stdout);
    assert.equal(typeof rep, 'object', 'зов «' + args.join(' ') + ' --json» не ответил данными');
  });

  // The modes: their answer is already one thing — a write or a draft — and JSON is not asked of it.
  ['--init', '--write', '--data'].forEach((mode) => {
    const res = runSize(dir, [mode, '--json']);
    refusal(res, 2, '--json рядом с режимом ' + mode);
    assert.ok(res.stderr.indexOf('"--json"') >= 0 && res.stderr.indexOf('"' + mode + '"') >= 0,
      'отказ не называет оба виновника:\n' + res.stderr);
  });

  // The commands: these three have no answer at all.
  ['install-hook', 'uninstall-hook', 'hook-run'].forEach((verb) => {
    const res = runSize(dir, [verb, '--json']);
    refusal(res, 2, '--json у команды ' + verb);
    assert.match(res.stderr, /has no answer in JSON/, 'отказ объясняет не то:\n' + res.stderr);
  });

  // And no refused call touched the project: parsing happens before the tree is read.
  const page = path.join(dir, 'refused-page.html');
  refusal(runSize(dir, ['--write', page, '--json']), 2, '--json рядом с --write');
  assert.equal(fs.existsSync(page), false, 'отвергнутый зов всё-таки записал отчёт');
});

/* ---------- the table of exit codes ---------- */

test('коды выхода совпадают с таблицей плана', async () => {
  const { EXIT } = await import('../src/size-table.js');
  assert.deepEqual(EXIT, { OK: 0, VIOLATION: 1, CONFIG: 2, SHALLOW: 3, SENSOR: 4, INTERNAL: 5 },
    'коды выхода разошлись с PLAN.md §4.1');
});

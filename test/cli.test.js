/* Отказы командной строки: каждый тупик обязан называть команду, которой из него
 * выходят, и код выхода — по таблице `PLAN.md` §4.1 (агент ветвится по коду,
 * человек читает команду). Стек наружу не идёт: он не подсказывает починку и
 * выдаёт пути машины.
 *
 * Здесь справка, настройки и коды выхода; где инструмент пишет и что проверяет —
 * в соседнем наборе (`cli-paths.test.js`). Наборы разделены не по смыслу
 * проверок, а по времени: внутри файла проверки идут последовательно, а работа
 * здесь — запуск процессов, поэтому раскладка по файлам отдаёт проверкам ядра.
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

/* ---------- справка ---------- */

test('--help отвечает справкой, кодом 0 и без настроек вовсе', () => {
  const res = runSize(tmp, ['--help']);
  assert.equal(res.code, 0, 'справка не ответила успехом: ' + firstLine(res.stderr));
  assert.equal(hasStack(res.stdout + res.stderr), false, 'в справке стек:\n' + res.stdout);
  ['--init', '--write', '--data', '--page', '--json', '--config'].forEach((flag) => {
    assert.ok(res.stdout.indexOf(flag) >= 0, 'в справке нет режима ' + flag);
  });
  assert.match(res.stdout, /Коды выхода/, 'справка не называет коды выхода');
});

/* ---------- нет настроек ---------- */

test('без настроек отказ называет команду, которой настройки создаются', () => {
  const dir = cloneFixture(path.join(tmp, 'no-config'));
  const res = runSize(dir, []);
  refusal(res, 2, 'запуск без файла настроек');
  assert.match(res.stderr, /нет файла настроек/, 'отказ объясняет не то: ' + firstLine(res.stderr));

  const cmd = commandIn(res.stderr);
  assert.ok(cmd !== null, 'в отказе нет команды починки:\n' + res.stderr);
  assert.equal(cmd.flag, '--init', 'команда починки ведёт не к созданию настроек: ' + cmd.flag);
  assert.ok(fs.existsSync(cmd.file), 'команда починки указывает на несуществующий файл: ' + cmd.file);

  const fix = spawnSync(process.execPath, [cmd.file, '--init'],
    { cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF });
  assert.equal(fix.status, 0, 'команда из отказа не сработала: ' + firstLine(fix.stderr || fix.stdout));
  assert.ok(fs.existsSync(path.join(dir, 'size-table.config.json')),
    'команда из отказа завершилась успехом, но настроек не создала');

  const again = runSize(dir, []);
  assert.equal(/нет файла настроек/.test(again.stderr), false,
    'после починки отказ повторяется: ' + firstLine(again.stderr));

  // Подсказка закрыта только тогда, когда по ней действительно работают: черновик
  // обязан проходить собственную проверку настроек.
  const wrote = runSize(dir, ['--write']);
  assert.equal(wrote.code, 0, 'после подсказки инструмент не работает: ' + firstLine(wrote.stderr));
  assert.ok(fs.existsSync(path.join(dir, 'docs', 'size-table.html')),
    'после подсказки таблица не собралась');

  const second = runSize(dir, ['--init']);
  refusal(second, 2, 'повторный --init');
  assert.match(second.stderr, /--force/, 'отказ не говорит, как перезаписать настройки');
});

/* Таблица, лежащая в истории (то есть в проекте, который уже подключил
 * инструмент), не может быть колонкой — иначе черновик делает ровно то, что
 * запрещает его же проверка, и следующий запуск отказывается работать. */
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

/* ---------- настройки не разобраны ---------- */

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

/* ---------- слова и ключи, которых инструмент не знает ---------- */

test('незнакомый ключ, ключ без значения и лишнее слово — отказ, а не тишина', () => {
  const dir = cloneFixture(path.join(tmp, 'args'));

  // Опечатка в ключе не имеет права выглядеть исправным прогоном: прежде такое
  // слово просто не читалось, и инструмент отвечал нулём, ничего не сделав.
  ['--wite', '--dta', '--forse'].forEach((typo) => {
    const res = runSize(dir, [typo]);
    refusal(res, 2, 'опечатка в ключе ' + typo);
    assert.ok(res.stderr.indexOf(typo) >= 0, 'отказ не называет ключ ' + typo + ':\n' + res.stderr);
    assert.ok(commandIn(res.stderr) !== null, 'в отказе нет команды починки:\n' + res.stderr);
  });

  // Ключ со значением без значения — тоже молчаливый пропуск: настройки были бы
  // взяты по умолчанию, а не те, что назвал человек.
  const noValue = runSize(dir, ['--config']);
  refusal(noValue, 2, 'ключ --config без значения');
  assert.match(noValue.stderr, /«--config»/, 'отказ не называет ключ:\n' + noValue.stderr);

  const force = runSize(dir, ['--force']);
  refusal(force, 2, 'ключ --force без --init');
  assert.match(force.stderr, /--force/, 'отказ не называет ключ:\n' + force.stderr);

  // Слово после ключа со значением — лишнее, и обвинять его как «неизвестную
  // команду» значит назвать не ту причину.
  const extra = runSize(dir, ['--page', 'a.html', 'b.html']);
  refusal(extra, 2, 'лишнее слово после ключа со значением');
  assert.match(extra.stderr, /лишнее слово «b\.html»/, 'отказ назвал не то слово:\n' + extra.stderr);

  const stray = runSize(dir, ['check', 'extra']);
  refusal(stray, 2, 'лишнее слово у команды');
  assert.match(stray.stderr, /«extra» лишний/, 'отказ назвал не причину:\n' + stray.stderr);

  // Одинокие дефисы ключами не являются и мимо разбора тоже не проходят.
  ['-', '--'].forEach((lonely) => {
    const res = runSize(dir, [lonely]);
    refusal(res, 2, 'одинокий ' + lonely);
    assert.ok(res.stderr.indexOf('«' + lonely + '»') >= 0, 'отказ не называет ' + lonely + ':\n' + res.stderr);
  });

  // Обратная сторона: законные зовы остаются законными — значение ключа не
  // путается с лишним словом, а команда и ключи читаются в любом порядке.
  const legal = [
    ['--init', 'draft.json', '--force'],
    ['--page', 'out.html', '--config', CONFIG],
    ['explain', gitIn(dir, ['rev-parse', 'HEAD']).trim(), '--config', CONFIG],
    ['--json', '--config', CONFIG],
    ['--data', '--config', CONFIG],
    ['--write', '--config', CONFIG]
  ];
  legal.forEach((args) => {
    const res = runSize(dir, args);
    assert.equal(res.code, 0, 'законный зов «' + args.join(' ') + '» отвергнут: ' + firstLine(res.stderr));
  });
  assert.ok(fs.existsSync(path.join(dir, 'out.html')), 'значение «--page» не дошло до записи');
});

/* Второй род молчаливого пропуска — не слово, а режим: `--write --data` отвечал
 * нулём, записав таблицу и не отдав данные, и от исправного запуска это так же
 * неотличимо. Правило «режим один» живёт в разборе аргументов, поэтому проверка
 * идёт перебором, а не примерами: все сочетания режимов, ключи, которые друг с
 * другом не работают, и ключ, названный дважды. */
test('два режима сразу и несовместимые ключи — отказ, а не тишина', () => {
  const dir = cloneFixture(path.join(tmp, 'mode-clash'));
  const modes = ['--init', '--write', '--data', '--page'];
  for (let i = 0; i < modes.length; i++) {
    for (let j = i + 1; j < modes.length; j++) {
      const res = runSize(dir, [modes[i], modes[j]]);
      refusal(res, 2, 'два режима: ' + modes[i] + ' ' + modes[j]);
      assert.ok(res.stderr.indexOf('«' + modes[i] + '»') >= 0 && res.stderr.indexOf('«' + modes[j] + '»') >= 0,
        'отказ не называет оба режима:\n' + res.stderr);
      assert.ok(commandIn(res.stderr) !== null, 'в отказе нет команды починки:\n' + res.stderr);
    }
  }

  // Данные и запись — разное, и `--json` тут не ответ команды, а прежняя форма
  // данных: рядом с режимом он теряется так же молча.
  const dataAndWrite = runSize(dir, ['--json', '--write']);
  refusal(dataAndWrite, 2, '--json рядом с режимом');
  assert.ok(dataAndWrite.stderr.indexOf('«--json»') >= 0 && dataAndWrite.stderr.indexOf('«--write»') >= 0,
    'отказ не называет оба ключа:\n' + dataAndWrite.stderr);

  // Команда и режим, чужой ответ в JSON, файл черновика дважды описанным способом.
  const cases = [
    [['check', '--data'], /«check»/],
    [['install-hook', '--json'], /нет ответа в JSON/],
    [['--config', CONFIG, '--init', 'draft.json'], /«--init»/],
    [['--write', '--write'], /дважды/],
    [['--config', CONFIG, '--config', CONFIG], /дважды/]
  ];
  cases.forEach(([args, probe]) => {
    const res = runSize(dir, args);
    refusal(res, 2, 'несовместимый зов «' + args.join(' ') + '»');
    assert.match(res.stderr, probe, 'отказ объясняет не то:\n' + res.stderr);
  });

  // Ни одна ветка этих отказов не должна была тронуть проект: разбор идёт до
  // чтения дерева, и лишний файл здесь означал бы, что порядок ветвлений всё ещё
  // решает.
  assert.equal(fs.existsSync(path.join(dir, 'draft.json')), false,
    'отвергнутый зов всё-таки записал файл');
});

/* ---------- таблица кодов ---------- */

test('коды выхода совпадают с таблицей плана', async () => {
  const { EXIT } = await import('../src/size-table.js');
  assert.deepEqual(EXIT, { OK: 0, VIOLATION: 1, CONFIG: 2, SHALLOW: 3, SENSOR: 4, INTERNAL: 5 },
    'коды выхода разошлись с PLAN.md §4.1');
});

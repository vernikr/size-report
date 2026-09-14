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
  CONFIG, MAX_BUF, cloneFixture, commandIn, firstLine, hasStack, refusal, runSize, tempDir
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

/* ---------- таблица кодов ---------- */

test('коды выхода совпадают с таблицей плана', async () => {
  const { EXIT } = await import('../src/size-table.js');
  assert.deepEqual(EXIT, { OK: 0, VIOLATION: 1, CONFIG: 2, SHALLOW: 3, SENSOR: 4, INTERNAL: 5 },
    'коды выхода разошлись с PLAN.md §4.1');
});

/* Вторая половина проверок командной строки: где инструмент пишет (каталога
 * может не быть — это обычный запуск, а не ошибка пользователя), что он делает с
 * неполной историей и с расхождением рабочего дерева, и что бывает при запуске
 * вне репозитория. Отказы здесь те же: код выхода и готовая команда, без стека.
 *
 * Справка, настройки и коды выхода — в соседнем наборе (`cli.test.js`); разделены
 * они по времени: внутри файла проверки идут последовательно, а работа здесь —
 * запуск процессов, поэтому раскладка по файлам отдаёт проверкам ядра.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG, cloneFixture, firstLine, gitIn, gitTry, hasStack, refusal, runFixture, runSize, tempDir
} from '../tools/harness.js';

const tmp = tempDir('cli-paths');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* ---------- обрезанная история ---------- */

test('обрезанная история: код 3 и команда докачки', () => {
  const base = cloneFixture(path.join(tmp, 'shallow-source'));
  const dir = path.join(tmp, 'shallow');
  const clone = gitTry(null, ['clone', '-q', '--depth', '1', 'file://' + base, dir]);
  assert.equal(clone.status, 0, 'не удалось собрать обрезанную выкладку: ' + firstLine(clone.stderr));
  assert.equal(gitIn(dir, ['rev-parse', '--is-shallow-repository']).trim(), 'true',
    'выкладка вышла полной: проверять нечего');

  const res = runFixture(dir, ['--data']);
  refusal(res, 3, 'запуск на обрезанной истории');
  assert.match(res.stderr, /--unshallow/, 'отказ не называет команду докачки:\n' + res.stderr);
});

/* ---------- вывод в каталог, которого нет ---------- */

test('--page создаёт недостающий каталог', () => {
  const dir = cloneFixture(path.join(tmp, 'page-dir'));
  const target = path.join('.size-report', 'report.html');
  const res = runFixture(dir, ['--page', target]);
  assert.equal(res.code, 0, '--page отказался работать: ' + firstLine(res.stderr));
  assert.equal(hasStack(res.stderr), false, '--page упал стеком:\n' + res.stderr);
  assert.ok(fs.existsSync(path.join(dir, target)), 'страницы нет по указанному пути: ' + target);
});

test('--write создаёт недостающий каталог, названный в настройках', () => {
  const dir = cloneFixture(path.join(tmp, 'write-dir'));
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  cfg.output = path.join('.size-report', 'table.html');
  fs.writeFileSync(path.join(dir, 'size-table.config.json'), JSON.stringify(cfg, null, 2));

  const res = runSize(dir, ['--write']);
  assert.equal(res.code, 0, '--write отказался работать: ' + firstLine(res.stderr));
  assert.equal(hasStack(res.stderr), false, '--write упал стеком:\n' + res.stderr);
  assert.ok(fs.existsSync(path.join(dir, cfg.output)), 'таблицы нет по указанному пути');
});

/* ---------- расхождение с рабочим деревом ---------- */

test('правка только на диске: код 1 и что с ней делать', () => {
  const dir = cloneFixture(path.join(tmp, 'disk-edit'));
  gitIn(dir, ['update-index', '--assume-unchanged', 'src/code.js']);
  fs.appendFileSync(path.join(dir, 'src', 'code.js'), '// правка, которой нет в git\n');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '',
    'правка попала в статус git: файл выпал бы из сверки, и проверять нечего');

  const res = runFixture(dir, ['--data']);
  refusal(res, 1, 'правка, которой нет в истории');
  assert.match(res.stderr, /правка есть только на диске/, 'отказ объясняет не то:\n' + res.stderr);
  assert.match(res.stderr, /починка/, 'отказ не говорит, что делать:\n' + res.stderr);
});

/* ---------- запуск вне репозитория ---------- */

test('вне git-репозитория отказ объясняется, а не падает стеком', () => {
  const res = runSize(tmp, ['--data']);
  refusal(res, 2, 'запуск вне репозитория');
});

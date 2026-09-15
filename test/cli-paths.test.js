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
  CONFIG, cloneFixture, firstLine, gitIn, gitTry, hasStack, initRepo, refusal, runFixture, runSize,
  tempDir
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

/* Проект без настроек и без каталога `docs` — тот случай, ради которого пакет и
 * ставят: отчёт обязан появиться в `docs/` (каталог создаётся сам), а не в корне.
 * Проверка появилась по замеру: первая редакция вывода выбирала корень, если
 * каталога нет, и в свежем проекте отчёт оказывался там, где его никто не ищет. */
test('в свежем проекте отчёт ложится в docs, который создаётся сам', () => {
  const dir = initRepo(path.join(tmp, 'fresh'));
  fs.writeFileSync(path.join(dir, 'README.md'), '# свежий проект\n');
  fs.writeFileSync(path.join(dir, 'code.js'), 'var a = 1;\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'feat: начало']);
  assert.equal(fs.existsSync(path.join(dir, 'docs')), false, 'каталог docs уже есть: случай не тот');

  const res = runSize(dir, ['--write']);
  assert.equal(res.code, 0, 'запуск без настроек не собрал отчёт: ' + firstLine(res.stderr));
  const report = path.join(dir, 'docs', 'size-report.html');
  assert.ok(fs.existsSync(report), 'отчёта нет в docs/ — в выведенном профиле он ложится туда');
  assert.equal(fs.existsSync(path.join(dir, 'size-report.html')), false,
    'отчёт лёг и в корне тоже: место у него одно');
  assert.equal(runSize(dir, []).code, 0, 'контрольный режим на своём отчёте красный');
});

test('--write создаёт недостающий каталог, названный ключом', () => {
  const dir = cloneFixture(path.join(tmp, 'page-dir'));
  const target = path.join('.size-report', 'report.html');
  const res = runFixture(dir, ['--write', target]);
  assert.equal(res.code, 0, '--write отказался работать: ' + firstLine(res.stderr));
  assert.equal(hasStack(res.stderr), false, '--write упал стеком:\n' + res.stderr);
  assert.ok(fs.existsSync(path.join(dir, target)), 'отчёта нет по указанному пути: ' + target);
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
  // Совет обязан быть командой: отказ без починки читателю не поможет.
  assert.match(res.stderr, /^\s*починка: .*git init$/m,
    'отказ не назвал команду починки:\n' + res.stderr);
});

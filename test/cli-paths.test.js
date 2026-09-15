/* The second half of the command line's checks: where the tool writes (the directory may be absent —
 * that is an ordinary run rather than a user's mistake), what it does with an incomplete history and
 * with a disagreement with the working tree, and what happens when it is run outside a repository.
 * The refusals here are the same shape: an exit code and a ready command, no stack.
 *
 * The help, the settings and the exit codes are in the neighbouring suite (`cli.test.js`), split by
 * cost: checks inside a file run in sequence, and the work here is spawning processes, so a file of
 * its own keeps this cost out of the fast run.
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

/* ---------- a shallow history ---------- */

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

/* ---------- output into a directory that does not exist ---------- */

/* A project with no settings and no `docs` directory — the case the package is installed for: the
 * report has to appear in `docs/` (the directory is created by itself) rather than in the root. The
 * check exists by measurement: the first version of the derived profile chose the root when the
 * directory was absent, so in a fresh project the report landed where nobody looks for it. */
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

/* ---------- a disagreement with the working tree ---------- */

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

/* ---------- a run outside a repository ---------- */

test('вне git-репозитория отказ объясняется, а не падает стеком', () => {
  const res = runSize(tmp, ['--data']);
  refusal(res, 2, 'запуск вне репозитория');
  // The advice has to be a command: a refusal without a fix helps no reader.
  assert.match(res.stderr, /^\s*починка: .*git init$/m,
    'отказ не назвал команду починки:\n' + res.stderr);
});

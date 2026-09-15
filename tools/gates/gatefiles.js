#!/usr/bin/env node
/* Защита гейт-файлов: пороги, базы, правила датчиков и саму обвязку проверок нельзя
 * править молча. Правка возможна, но она осознанная и видимая: в сообщении коммита
 * обязана стоять строка `Gate-Change: <причина>`.
 *
 * Класс дефекта, ради которого это заведено, простой: гейт, который можно ослабить
 * тем же коммитом, который он валит, — не гейт. Всё остальное (пороги из замеров,
 * храповик вместо идеала) держится на том, что ослабление видно в истории.
 *
 * Где зовётся: `commit-msg` (проверка ставится при коммите) и CI (по каждому коммиту
 * диапазона — чтобы обойти локальный хук не удалось).
 *
 * Запуск: `node tools/gates/gatefiles.js --commit-msg <файл>` (хук),
 * `node tools/gates/gatefiles.js --range origin/main` (гейт). Коды выхода: 0 — чисто,
 * 1 — правка гейта без трейлера.
 */

import fs from 'node:fs';
import { bad, git, ok, parseArgs } from './common.js';

/* Каталог, в котором читается git: рабочий репозиторий, а в проверках датчика —
 * временный репозиторий. Гейт в CI и хуке зовётся без ключа, то есть по рабочему
 * дереву. `git` из общей обвязки: настройки чтения закреплены (`src/git.js`), иначе
 * `core.quotePath` закавычил бы не-английский путь и правило его не узнало. */
const args = parseArgs(process.argv.slice(2), ['--commit-msg', '--range', '--cwd'], []);
const read = (argv) => git(argv, args.flags['--cwd'] ? { cwd: args.flags['--cwd'] } : {});

/* Что защищается: всё, чем датчик настроен или погашен. Список — часть самого
 * скрипта, поэтому его правка тоже требует трейлера (самозащита не декоративная). */
const GATE_FILES = [
  /^package\.json$/, // скрипты, зависимости, пиннинг версий
  /^pnpm-lock\.yaml$/,
  /^eslint\.config\.js$/, /^eslint\.metrics\.config\.js$/, /^\.eslint-suppressions\.json$/,
  /^\.jscpd\.json$/, /^dup-baseline\.json$/,
  /^\.dependency-cruiser\.cjs$/, /^\.dependency-cruiser-known-violations\.json$/,
  /^\.c8rc\.json$/, /^coverage-baseline\.json$/,
  /^\.github\/workflows\//,
  /^\.githooks\//,
  /^tools\/gates\//,
  /^tools\/suites\.js$/, // разделение набора: быстрое и полное — тоже решение гейта
  /^test\/gates-[a-z-]+\.test\.js$/ // проверки самих датчиков
];

/* Трейлер с причиной, а не пометка: «Gate-Change: ok» — это не обоснование. */
const TRAILER = /^Gate-Change: (\S.*)$/m;

function gateFilesAmong(files) {
  return files.filter((f) => GATE_FILES.some((p) => p.test(f))).sort();
}

function hasTrailer(message) {
  const m = message.match(TRAILER);
  return m !== null && m[1].trim().length >= 12;
}

function report(what, files, message) {
  if (files.length === 0) return true;
  if (hasTrailer(message)) {
    console.log('  ✓ ' + what + ': гейт-файлов ' + files.length + ', трейлер Gate-Change: есть');
    return true;
  }
  bad(what + ': правка гейта без трейлера Gate-Change:');
  files.forEach((f) => console.error('    ' + f));
  console.error('    добавьте в сообщение коммита строку «Gate-Change: <причина>» —'
    + ' пороги и базы меняет человек осознанно');
  return false;
}

if (args.flags['--commit-msg'] !== undefined) {
  const message = fs.readFileSync(args.flags['--commit-msg'], 'utf8');
  const staged = read(['diff', '--cached', '--name-only', '--diff-filter=ACDMR'])
    .stdout.split('\n').filter((f) => f !== '');
  if (report('gatefiles', gateFilesAmong(staged), message)) {
    console.log('✓ gatefiles: коммит можно ставить (' + staged.length + ' файлов, гейт-файлов '
      + gateFilesAmong(staged).length + ')');
  }
} else if (args.flags['--range'] !== undefined) {
  /* По каждому коммиту диапазона: правку гейта в одном коммите нельзя прикрыть
   * трейлером из соседнего. */
  const base = args.flags['--range'];
  const log = read(['log', '--format=%H%x00%B%x1e', base + '..HEAD']).stdout;
  const commits = log.split('\x1e').map((c) => c.trim()).filter((c) => c !== '');
  let clean = true;
  let checked = 0;
  commits.forEach((entry) => {
    const at = entry.indexOf('\x00');
    const sha = entry.slice(0, at);
    const message = entry.slice(at + 1);
    const names = read(['diff-tree', '--no-commit-id', '--name-only', '-r', sha])
      .stdout.split('\n').filter((f) => f !== '');
    checked++;
    if (!report('gatefiles ' + sha.slice(0, 7), gateFilesAmong(names), message)) clean = false;
  });
  if (clean) ok('gatefiles: в диапазоне ' + base + '..HEAD коммитов ' + checked + ', гейт-файлы без трейлера не менялись');
} else {
  bad('gatefiles: не назван режим — `--commit-msg <файл>` (хук) или `--range <рефа>` (CI)');
}

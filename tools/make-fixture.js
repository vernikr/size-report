#!/usr/bin/env node
/* Собирает синтетическую фикстуру size-report: маленький репозиторий с историей,
 * в которой собраны ловушки настоящих проектов, плюс bundle для переноса.
 *
 * Зачем. Проверять движок на истории живого проекта нельзя: она меняется, она
 * большая, и половины ловушек в ней нет. Фикстура детерминирована — автор, даты и
 * содержимое зафиксированы, поэтому sha коммитов воспроизводимы. Эталонные числа
 * (`golden.json`) снимаются с текущего инструмента один раз, и дальше перенос
 * обязан их воспроизвести.
 *
 * Запуск (из корня репозитория size-report):
 *   node tools/make-fixture.js                       # бандл + конфиг + эталон
 *   node tools/make-fixture.js --legacy-tool <путь>   # инструмент, с которого снимаем
 *   node tools/make-fixture.js --bundle-only          # только бандл (без эталона)
 *   node tools/make-fixture.js --keep                 # не удалять временный репозиторий
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'fixtures', 'synthetic');
const DEFAULT_LEGACY = path.join(ROOT, '..', 'figma', 'safe-resets', 'tools', 'size-table.js');
const MAX_BUF = 256 * 1024 * 1024;
const ARTIFACT = 'docs/size-table.html';

// --- детерминированное время и личность автора ------------------------------

const BASE_MS = Date.UTC(2026, 0, 1, 7, 0, 0); // 2026-01-01 10:00:00 +03:00
const HOUR = 3600 * 1000;
let tick = 0;

function stamp() {
  const d = new Date(BASE_MS + (tick++) * HOUR + 3 * HOUR); // та же зона, что в подписи
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + 'T'
    + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + '+03:00';
}

const AUTHOR = {
  GIT_AUTHOR_NAME: 'size-report fixture',
  GIT_AUTHOR_EMAIL: 'fixture@size-report.invalid',
  GIT_COMMITTER_NAME: 'size-report fixture',
  GIT_COMMITTER_EMAIL: 'fixture@size-report.invalid'
};

function git(dir, args, env) {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: MAX_BUF,
    env: Object.assign({}, process.env, AUTHOR, env || {})
  });
}

function commit(dir, subject) {
  git(dir, ['add', '-A']);
  const when = stamp();
  git(dir, ['commit', '-q', '--no-verify', '-m', subject],
    { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when });
}

function write(dir, rel, text) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, 'utf8');
}

function remove(dir, rel) {
  fs.rmSync(path.join(dir, rel));
}

// --- содержимое фикстуры ----------------------------------------------------

const README = [
  '# Фикстура',
  '',
  'Репозиторий для проверок: маленький, но с ловушками (список — в README рядом).',
  'Читается по буквам: «—» — файла нет, 0 Б — файл есть и пуст.',
  ''
].join('\n');

const CODE_1 = [
  '/* Заголовок файла: комментарий, который метрика min обязана снять */',
  "'use strict';",
  '// строчный комментарий',
  "var url = 'http://example.invalid/a//b';      // «//» внутри строки — не комментарий",
  'var re = /\\/+/g;                              // регексп с экранированным слэшем',
  'var tpl = `x${1 + 2}z`;                       // шаблон с выражением',
  'var half = 10 / 2 / 5;                        // деление, а не регексп',
  'function label(name) {',
  "  return '<' + name + '>';",
  '}',
  'module.exports = { label: label };',
  ''
].join('\n');

const CODE_2 = CODE_1.replace('function label(name) {', 'var extra = 1;\nfunction label(name) {');
const CODE_3 = CODE_2.replace('var extra = 1;', 'var extra = 1;\nvar mixed = 2;');
const CODE_4 = CODE_3.replace('var mixed = 2;', 'var mixed = 2;\nvar markup = \'<a href="x">y & z</a>\';');
// Замена символа на символ: объём не меняется ни в одной метрике — строки быть не
// должно (иначе строка без единого числа читалась бы как поломка).
const CODE_5 = CODE_4.replace('var extra = 1;', 'var extra = 2;');
// Ветки правят одну и ту же строку, поэтому слияние разрешается вручную. Размер
// у каждой версии свой: иначе коммит не сдвинул бы ни одного числа и строки бы не
// получил — а нам нужна именно строка слияния.
const CODE_BRANCH = CODE_5.replace('var half = 10 / 2 / 5;', 'var half = 20 / 2 / 5;');
const CODE_MAIN = CODE_5.replace('var half = 10 / 2 / 5;', 'var half = 10 / 2 / 50;');
const CODE_MERGED = CODE_5.replace('var half = 10 / 2 / 5;', 'var half = 20 / 2 / 50 + 1;');

const LEGACY_JS = [
  '// остаток от переезда: файл, который потом переименуют',
  'var DEPRECATED = true;',
  'module.exports = DEPRECATED;',
  ''
].join('\n');

const LEGACY_JS_2 = LEGACY_JS.replace('var DEPRECATED = true;', 'var DEPRECATED = true; // и правят до переименования');
const MODERN_JS = LEGACY_JS_2.replace('// остаток от переезда: файл, который потом переименуют',
  '// переехал: старое имя больше не существует, а колонка находит файл по алиасу');

const CONFIG_MJS_1 = [
  '// служебный модуль: `export` в vm.Script не компилируется, его проверяет Node',
  'export default {',
  "  name: 'fixture',",
  '  level: 1',
  '};',
  ''
].join('\n');

const CONFIG_MJS_2 = CONFIG_MJS_1.replace('level: 1', 'level: 2');

const NOTES_1 = [
  '# Заметки',
  '',
  'Файл с не-английским именем: путь приходит из git, и его цитирование зависит',
  'от локали (`core.quotePath`), поэтому колонка обязана его находить.',
  ''
].join('\n');

const NOTES_2 = NOTES_1 + '\n- вторая правка заметок\n';

const HTML_1 = [
  '<!doctype html>',
  '<html lang="ru"><head><meta charset="utf-8"><title>Фикстура</title></head>',
  '<body><p>Артефакт фикстуры: его обновляют отдельным коммитом.</p></body></html>',
  ''
].join('\n');

const HTML_2 = HTML_1.replace('отдельным коммитом', 'отдельным коммитом (и это ловушка)');

const PACKAGE_JSON = JSON.stringify({
  name: 'fixture',
  version: '1.0.0',
  private: true,
  type: 'commonjs'
}, null, 2) + '\n';

const STYLE_CSS = [
  '/* Фикстура: стили — метрика min снимает комментарии CSS */',
  '.note { color: #333; }',
  '.note > .inner { padding: 2px; }',
  ''
].join('\n');

const TABLE_TOML = [
  '# Незнакомый формат: метрика min снимает только отступы и пустые строки —',
  '# комментарии в синтаксисе, которого инструмент не знает, трогать нельзя.',
  '[table]',
  'name = "fixture"',
  'rows = 3',
  ''
].join('\n');

const WORKLOG_1 = [
  '# Журнал фикстуры',
  '',
  '## 1. 2026-01-01 — первый раздел',
  '',
  '1.1. Первый раздел заведён первым коммитом.',
  ''
].join('\n');

const WORKLOG_2 = WORKLOG_1 + [
  '',
  '## 2. 2026-01-01 — второй раздел',
  '',
  '2.1. Второй раздел заведён правкой кода.',
  ''
].join('\n');

const WORKLOG_3 = WORKLOG_2 + [
  '',
  '## 3. 2026-01-01 — третий раздел',
  '',
  '3.1. Третий раздел заведён коммитом, который тронул только журнал.',
  ''
].join('\n');

/* История фикстуры: каждая строка — коммит и то, что он делает. Ловушки
 * перечислены в README, который скрипт пишет рядом с бандлом. */
const HISTORY = [
  {
    subject: 'fixture: первый коммит — код, заметки, служебные файлы',
    do: (dir) => {
      write(dir, 'README.md', README);
      write(dir, 'src/code.js', CODE_1);
      write(dir, 'src/legacy.js', LEGACY_JS);
      write(dir, 'src/config.mjs', CONFIG_MJS_1);
      write(dir, 'docs/заметки.md', NOTES_1);
      write(dir, 'notes/crlf.txt', Buffer.from('первая строка\r\nвторая строка\r\n', 'utf8'));
      write(dir, 'package.json', PACKAGE_JSON);
      write(dir, 'WORKLOG.md', WORKLOG_1);
    }
  },
  {
    subject: 'fixture: правка кода и раздел 2 в журнале',
    do: (dir) => {
      write(dir, 'src/code.js', CODE_2);
      write(dir, 'WORKLOG.md', WORKLOG_2);
    }
  },
  {
    subject: 'fixture: только отчёт',
    do: (dir) => write(dir, ARTIFACT, HTML_1)
  },
  {
    subject: 'fixture: смешанный коммит — отчёт вместе с кодом',
    do: (dir) => {
      write(dir, ARTIFACT, HTML_2);
      write(dir, 'src/code.js', CODE_3);
    }
  },
  {
    subject: 'fixture: правка файла под старым именем',
    do: (dir) => write(dir, 'src/legacy.js', LEGACY_JS_2)
  },
  {
    subject: 'fixture: переименование legacy.js в modern.js',
    do: (dir) => {
      git(dir, ['mv', 'src/legacy.js', 'src/modern.js']);
      write(dir, 'src/modern.js', MODERN_JS);
    }
  },
  {
    subject: 'fixture: подпись с <, &, " и > — проверка экранирования',
    do: (dir) => write(dir, 'src/code.js', CODE_4)
  },
  {
    subject: 'fixture: замена символа без изменения объёма',
    do: (dir) => write(dir, 'src/code.js', CODE_5)
  }
];

function buildRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.name', AUTHOR.GIT_AUTHOR_NAME]);
  git(dir, ['config', 'user.email', AUTHOR.GIT_AUTHOR_EMAIL]);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'tag.gpgsign', 'false']);
  // Переводы строк в фикстуре — часть содержимого, а не авто-правка рабочего дерева.
  git(dir, ['config', 'core.autocrlf', 'false']);
  git(dir, ['config', 'core.safecrlf', 'false']);

  HISTORY.forEach((step) => { step.do(dir); commit(dir, step.subject); });

  // Ветка: правка той же строки, что и на main, — слияние разрешается вручную,
  // поэтому у merge-коммита есть собственные изменения поверх первого родителя.
  git(dir, ['checkout', '-q', '-b', 'feature']);
  write(dir, 'src/code.js', CODE_BRANCH);
  write(dir, 'docs/заметки.md', NOTES_2);
  commit(dir, 'fixture: ветка — правка кода и заметок');

  git(dir, ['checkout', '-q', 'main']);
  write(dir, 'src/code.js', CODE_MAIN);
  write(dir, 'src/config.mjs', CONFIG_MJS_2);
  commit(dir, 'fixture: правка той же строки и служебного модуля');

  const merged = spawnSync('git', ['merge', '--no-commit', '--no-ff', 'feature'], {
    cwd: dir, encoding: 'utf8', env: Object.assign({}, process.env, AUTHOR)
  });
  if (merged.status === 0) throw new Error('слияние в фикстуре прошло без конфликта');
  write(dir, 'src/code.js', CODE_MERGED);
  commit(dir, 'fixture: слияние ветки с правкой разрешения конфликта');

  remove(dir, 'notes/crlf.txt');
  commit(dir, 'fixture: удаление файла');

  write(dir, 'notes/crlf.txt', Buffer.from('вернули файл\r\nс другим содержимым\r\n', 'utf8'));
  commit(dir, 'fixture: возврат файла');

  write(dir, 'WORKLOG.md', WORKLOG_3);
  commit(dir, 'fixture: только журнал — раздел 3');

  write(dir, 'src/style.css', STYLE_CSS);
  write(dir, 'data/table.toml', TABLE_TOML);
  commit(dir, 'fixture: разметка, стили и незнакомый формат');

  write(dir, 'src/empty.js', '');
  commit(dir, 'fixture: пустой файл');
}

// --- конфиг фикстуры --------------------------------------------------------

const CONFIG = {
  output: ARTIFACT,
  locale: 'ru',
  title: 'Объём файлов по коммитам — фикстура',
  heading: 'Фикстура: история с ловушками',
  fixCommand: 'node tools/size-table.js --write',
  metrics: ['raw', 'min'],
  columns: [
    { label: 'code.js', paths: ['src/code.js'] },
    { label: 'modern.js', paths: ['src/modern.js', 'src/legacy.js'] },
    { label: 'config.mjs', paths: ['src/config.mjs'] },
    { label: 'заметки.md', paths: ['docs/заметки.md'] },
    { label: 'crlf.txt', paths: ['notes/crlf.txt'] },
    { label: 'package.json', paths: ['package.json'] },
    { label: 'style.css', paths: ['src/style.css'] },
    { label: 'table.toml', paths: ['data/table.toml'] },
    { label: 'empty.js', paths: ['src/empty.js'] },
    { label: 'WORKLOG.md', paths: ['WORKLOG.md'] }
  ],
  journal: {
    path: 'WORKLOG.md',
    url: '../WORKLOG.md',
    pattern: '^## (?<id>\\d+)\\.\\s+(?<title>.+?)\\s*$',
    anchor: 'heading'
  },
  links: { commitUrl: '' },
  rows: { merges: true, sha: true },
  skip: []
};

// --- эталон -----------------------------------------------------------------

function runLegacy(legacyTool, dir, cfgPath, args, env) {
  const res = spawnSync(process.execPath, [legacyTool, '--config', cfgPath].concat(args), {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: MAX_BUF,
    env: Object.assign({}, process.env, env || {})
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const TRAPS = [
  '`//` внутри строки, регексп с экранированным слэшем, шаблон с выражением, деление — стриппер JS',
  'комментарий в начале файла и блок-комментарий посреди кода',
  '`.mjs` с `export` — гард компиляции идёт через `node --check`, а не через `vm.Script`',
  'не-английское имя файла (`docs/заметки.md`) — путь приходит из git, и его цитирование зависит от локали',
  'CRLF в текстовом файле',
  'правка файла до переименования и само переименование — колонка с алиасами путей находит файл и под старым именем, и под новым',
  'коммит «только отчёт» — строки не получает',
  'смешанный коммит (отчёт + код) — строку получает, сборка предупреждает',
  'слияние с правкой разрешения конфликта — строка считается по первому родителю',
  'замена символа без изменения объёма — строки не получает',
  'удаление файла и его возврат — «—» в клетке вместо нуля',
  'подпись коммита с `<`, `&`, `"`, `>` — экранирование в артефакте',
  'журнал: новый раздел (`§N`) и раздел, заведённый коммитом только журнала',
  'незнакомое расширение (`.toml`) — снимаются только отступы и пустые строки',
  'пустой файл (0 Б) — это «файл есть», а не «файла нет»',
  'разметка и стили (`.css`) — снятие комментариев в своём синтаксисе'
];

function fixtureNote(ctx) {
  return [
    '# Синтетическая фикстура',
    '',
    'Маленький репозиторий с историей, собранный `tools/make-fixture.js`. Фикстура',
    'детерминирована: автор, даты и содержимое зафиксированы, поэтому sha коммитов',
    'воспроизводимы — именно они и есть личность фикстуры. Байты `history.bundle`',
    'могут отличаться между версиями git; свериться надо по sha коммитов.',
    '',
    '| Файл | Что внутри |',
    '|---|---|',
    '| `history.bundle` | Вся история фикстуры (git bundle, ветки `main` и `feature`) |',
    '| `config.json` | Настройки инструмента для фикстуры (10 колонок, журнал, метрики raw/min) |',
    '| `golden.json` | Эталонный вывод `--json` на этой истории |',
    '| `artifact.sha256` | Хеш собранного артефакта — форма отчёта доказывается побайтово |',
    '| `manifest.json` | HEAD, sha всех коммитов, хеши файлов, флаги устойчивости |',
    '',
    '## Ловушки в истории',
    '',
    TRAPS.map((t) => '- ' + t).join('\n'),
    '',
    '## Как пользоваться',
    '',
    '```bash',
    'git clone fixtures/synthetic/history.bundle /tmp/size-report-fixture',
    'node tools/make-fixture.js            # пересобрать (нужен инструмент, с которого снят эталон)',
    '```',
    '',
    'HEAD: `' + ctx.head + '` (' + ctx.commits.length + ' коммитов).',
    ctx.localeStable
      ? 'Проверка при снятии эталона: числа при `LC_ALL=C` совпали с текущей локалью,'
        + ' то есть в этой среде пути вне ASCII читаются одинаково.'
      : 'ВНИМАНИЕ: эталон зависит от локали (`core.quotePath` в git): числа при '
        + '`LC_ALL=C` отличаются. Это дефект инструмента, а не фикстуры — он должен '
        + 'быть закрыт на шаге 1 (читать пути с `-c core.quotePath=false` или `-z`).',
    ''
  ].join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return null;
    const v = args[i + 1];
    return v === undefined || v.indexOf('--') === 0 ? true : v;
  };
  const out = path.resolve(flag('--out') === true || flag('--out') === null
    ? OUT : String(flag('--out')));
  const legacy = flag('--legacy-tool');
  const legacyTool = typeof legacy === 'string' ? path.resolve(legacy) : DEFAULT_LEGACY;
  const bundleOnly = args.indexOf('--bundle-only') >= 0;
  const keep = args.indexOf('--keep') >= 0;

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-fixture-'));
  const repo = path.join(work, 'repo');
  const clone = path.join(work, 'clone');
  try {
    buildRepo(repo);

    const log = git(repo, ['log', '--reverse', '--date=format:%Y-%m-%d %H:%M', '--pretty=format:%H' + '\u0001' + '%ad' + '\u0001' + '%s'])
      .split('\n').filter((l) => l !== '').map((line) => {
        const f = line.split('\u0001');
        return { sha: f[0], when: f[1], subject: f[2] };
      });
    const head = git(repo, ['rev-parse', 'HEAD']).trim();
    if (log.length === 0 || log[log.length - 1].sha !== head) {
      throw new Error('история фикстуры собрана неверно');
    }

    fs.mkdirSync(out, { recursive: true });
    const bundlePath = path.join(out, 'history.bundle');
    git(repo, ['bundle', 'create', bundlePath, '--all']);
    const configPath = path.join(out, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(CONFIG, null, 2) + '\n', 'utf8');

    const ctx = { head, commits: log, localeStable: true, bundleOnly, legacy: null };

    if (!bundleOnly) {
      if (!fs.existsSync(legacyTool)) {
        throw new Error('нет инструмента, с которого снимать эталон: ' + legacyTool
          + ' (укажите --legacy-tool <путь>)');
      }
      git(work, ['clone', '-q', bundlePath, clone]);
      const json = runLegacy(legacyTool, clone, configPath, ['--json']);
      if (json.code !== 0) throw new Error('инструмент не отдал --json: ' + json.stderr.trim());
      const data = JSON.parse(json.stdout);
      const dataBytes = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8');
      fs.writeFileSync(path.join(out, 'golden.json'), dataBytes, 'utf8');

      const wrote = runLegacy(legacyTool, clone, configPath, ['--write']);
      if (wrote.code !== 0) throw new Error('инструмент не собрал артефакт: ' + wrote.stderr.trim());
      const artifact = fs.readFileSync(path.join(clone, CONFIG.output));
      fs.writeFileSync(path.join(out, 'artifact.sha256'),
        sha256(artifact) + '  ' + CONFIG.output + '\n', 'utf8');

      // Контрольный режим обязан быть зелёным: эталон снят с согласованного артефакта.
      const checked = runLegacy(legacyTool, clone, configPath, []);
      if (checked.code !== 0) throw new Error('контрольный режим на фикстуре красный: ' + checked.stderr.trim());

      // Пути вне ASCII: git цитирует их в зависимости от локали, и если числа от
      // этого меняются, эталон непереносим — это надо знать до, а не после.
      const cLocale = runLegacy(legacyTool, clone, configPath, ['--json'], { LC_ALL: 'C', LANG: 'C' });
      const cData = cLocale.code === 0 ? JSON.parse(cLocale.stdout) : null;
      ctx.localeStable = !!cData && JSON.stringify(cData) === JSON.stringify(data);

      ctx.legacy = {
        file: path.relative(ROOT, legacyTool),
        sha256: sha256(fs.readFileSync(legacyTool)),
        rows: data.rows.length,
        columns: data.columns.length,
        metrics: data.metrics,
        skipped: data.skipped.length,
        artifactBytes: artifact.length,
        artifactSha256: sha256(artifact),
        goldenSha256: sha256(dataBytes)
      };
    }

    fs.writeFileSync(path.join(out, 'README.md'), fixtureNote(ctx), 'utf8');
    const manifest = {
      schema: 1,
      kind: 'synthetic',
      head,
      commits: log,
      files: fs.readdirSync(out).sort().reduce((acc, name) => {
        const full = path.join(out, name);
        if (fs.statSync(full).isFile() && name !== 'manifest.json') {
          acc[name] = { bytes: fs.statSync(full).size, sha256: sha256(fs.readFileSync(full)) };
        }
        return acc;
      }, {}),
      localeStable: ctx.localeStable,
      legacy: ctx.legacy
    };
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    console.log('✓ фикстура: ' + path.relative(ROOT, out));
    console.log('  коммитов ' + log.length + ', HEAD ' + head.slice(0, 7)
      + ', bundle ' + fs.statSync(bundlePath).size + ' Б');
    if (ctx.legacy) {
      console.log('  эталон: ' + ctx.legacy.rows + ' строк × ' + ctx.legacy.columns + ' колонок, '
        + ctx.legacy.skipped + ' коммитов без строки, артефакт ' + ctx.legacy.artifactBytes + ' Б');
      console.log('  инструмент ' + ctx.legacy.file + ' sha256 ' + ctx.legacy.sha256.slice(0, 12));
    }
    if (!ctx.localeStable) {
      console.log('  ! эталон зависит от локали: числа при LC_ALL=C отличаются (см. README фикстуры)');
    }
  } finally {
    if (keep) console.log('  временный каталог: ' + work);
    else fs.rmSync(work, { recursive: true, force: true });
  }
}

try {
  main();
} catch (e) {
  console.error('✗ ' + (e && e.message ? e.message : e));
  if (e && e.stderr) console.error(String(e.stderr).trim());
  process.exitCode = 1;
}

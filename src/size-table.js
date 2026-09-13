'use strict';
/* Таблица объёма файлов по коммитам — переносимый генератор.
 *
 * Зачем. Объём проекта обсуждается числами регулярно (здесь — WORKLOG §19–§21),
 * и каждый раз это был ручной замер двух ревизий. Генератор делает замер
 * непрерывным: строка — коммит, колонка — файл, в клетке — изменение к
 * предыдущему коммиту по каждой метрике (`raw` — файл как он есть,
 * `min` — форма без комментариев и отступов), а абсолютные размеры стоят один
 * раз, в верхней строке «сейчас» (иначе крупное число повторялось бы в каждой
 * строке, и колонки расползались бы на экраны вширь).
 *
 * Источник правды — сам git: размеры берутся из блобов коммитов, а не из
 * рабочего дерева. Поэтому таблица не зависит от того, что открыто в редакторе,
 * и собирается заново по всей истории, а не дописывается инкрементально
 * (инкрементальный файл пришлось бы чинить после любой правки старых чисел).
 *
 * **Проектное — в конфиге, механика — здесь.** Этот файл не знает ни имён
 * файлов проекта, ни имени журнала, ни языка подписей: колонки, метрики,
 * журнал, локаль, куда писать — всё в `size-table.config.json` рядом с корнем
 * репозитория (`--config` — другой путь). Поэтому пакет подключается к новому
 * проекту как зависимость, а `size --init` подбирает там черновик конфига
 * (какие расширения в проекте, где журнал, куда писать), который дальше
 * правится глазами.
 *
 * Строку получает коммит, сдвинувший хотя бы одно число, включая merge: у
 * слияния берётся дифф к первому родителю, поэтому его правки видны и в строке,
 * и в переносе состояния. Не получают строку коммиты, тронувшие лишь сам файл
 * таблицы (и всё, что перечислено в `skip`) — строка про коммит не может лежать
 * внутри самого коммита (sha на момент сборки ещё неизвестен), поэтому
 * обновление таблицы — отдельный коммит, — и коммиты, у которых все клетки
 * вышли нулевыми (слияние, разрешённое ровно в то, что уже дала ветка): строка
 * без единого числа читается как поломка. Отсюда же
 * требование к конфигу: колонки обязаны покрывать всё, что коммит может
 * изменить. Коммит мимо колонок дал бы строку без единого числа, а пустая
 * клетка в таблице означает «файла в этой ревизии ещё нет» — читается как
 * поломка (это стережёт тест).
 * Если в конфиге выключить sha в строках (`rows.sha: false`), тот же инвариант
 * начинает работать и для стратегии «пересобрать и дописать в тот же коммит»:
 * без sha артефакт становится неподвижной точкой сборки.
 *
 * Запуск (из любого места репозитория; `size` — когда пакет установлен, иначе
 * `node bin/size.js`):
 *   size                    проверка: таблица совпадает с историей (CI)
 *   size --write            перегенерировать таблицу
 *   size --json             строки как JSON в stdout
 *   size --data             данные для страницы и агента в stdout
 *   size --page [файл]      собрать страницу отчёта
 *   size --init [файл]      черновик конфига для нового проекта
 *   size --config <путь>    другой файл настроек
 *   size --help             справка и коды выхода
 *
 * Требуется полная история: на обрезанном клоне (shallow) скрипт отказывается
 * работать, а не пишет молча короткую таблицу. В CI — `fetch-depth: 0`.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

// Пакет — модуль, а подсказка в `loadConfig` цитирует путь самого движка: в ESM
// `__filename` нет, поэтому путь берётся от `import.meta.url`.
const __filename = fileURLToPath(import.meta.url);

const CONFIG_NAME = 'size-table.config.json';
const MAX_BUF = 256 * 1024 * 1024;
const FIELD = '\u0001'; // разделитель полей в формате git log

/* Имя и версия пакета — из его же манифеста, чтобы не держать вторую копию; без
 * файла (чужaя сборка) остаётся заглушка: версия нужна только в данных, и
 * отсутствие манифеста не повод не собирать таблицу. */
let TOOL_PKG = { name: 'size-report', version: '0.0.0' };
try {
  TOOL_PKG = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
} catch (_e) {}

// --- отказ ------------------------------------------------------------------

/* Отказ — это код выхода и одна строка с готовой командой починки: по коду
 * ветвится агент (таблица кодов в `PLAN.md` §4.1), по тексту — человек. Стек
 * наружу не отдаётся вовсе: подсказки в нём нет, зато есть пути машины. */
const EXIT = { OK: 0, VIOLATION: 1, CONFIG: 2, SHALLOW: 3, SENSOR: 4, INTERNAL: 5 };

class Refusal extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function refuse(code, message) {
  throw new Refusal(code, message);
}

/* Команда починки цитирует точку входа, а не сам движок: при импорте движок
 * ничего не запускает, поэтому `--init` работает только через команду. Путь
 * считается от места движка, а не от текущего каталога, — сообщение обязано
 * работать из любого места проекта. */
function cliCommand(flag) {
  const bin = path.resolve(path.dirname(__filename), '..', 'bin', 'size.js');
  const shown = path.relative(process.cwd(), bin);
  return 'node ' + (shown === '' || shown.indexOf('..') === 0 ? bin : shown) + ' ' + flag;
}

const USAGE = [
  'size-report — таблица объёма файлов по коммитам.',
  '',
  'Запуск: node bin/size.js [режим] [ключи]',
  '',
  'Режимы:',
  '  --init [файл]   черновик настроек (--force — перезаписать существующий)',
  '  --write         собрать таблицу в файл из настроек',
  '  --data          данные контракта в stdout — для страницы и для агента',
  '  --page [файл]   страница отчёта (по умолчанию рядом с таблицей)',
  '  --json          прежняя форма данных в stdout',
  '  (без режима)    проверить, что таблица совпадает с историей',
  '',
  'Ключи: --config <файл> — другие настройки; --help — эта справка.',
  '',
  'Коды выхода: 0 — всё хорошо, 1 — расхождение с историей, 2 — настройки или',
  'окружение, 3 — неполная история, 4 — нет датчика, 5 — внутренняя ошибка.',
  ''
].join('\n');

// --- конфиг -----------------------------------------------------------------

const DEFAULT_CONFIG = {
  output: 'size-table.html',
  locale: 'ru',
  title: '',          // по умолчанию — заголовок из локали
  heading: '',
  fixCommand: 'npx size-table --write',
  metrics: ['raw', 'min'],
  columns: [],
  minify: { ext: {}, guard: ['.js', '.mjs', '.cjs'] },
  journal: null,
  links: { commitUrl: '' },
  // Слияние — обычный коммит: у него есть правки разрешения конфликта, и без
  // строки они не попали бы в сумму дельт над текущим размером.
  rows: { merges: true, sha: true },
  skip: []
};

function argValue(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const v = args[i + 1];
  return v === undefined || v.indexOf('--') === 0 ? '' : v;
}

function gitRoot() {
  try {
    return execFileSync('git', gitArgv(['rev-parse', '--show-toplevel']), {
      encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv()
    }).trim();
  } catch (_e) {
    refuse(EXIT.CONFIG, 'не git-репозиторий (или git недоступен): таблица собирается по истории git.\n'
      + '  запустите команду из каталога проекта; если истории ещё нет — создайте её: git init');
  }
}

/* Настройки читаются как есть и досыпаются значениями по умолчанию: у проекта,
 * который только подключил генератор, конфиг может быть в три строки. */
function loadConfig(file) {
  if (!fs.existsSync(file)) {
    refuse(EXIT.CONFIG, 'нет файла настроек ' + file + '\n  создайте его: ' + cliCommand('--init'));
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    refuse(EXIT.CONFIG, 'не разобран ' + file + ': ' + e.message
      + '\n  починка: правьте ' + file + '; образец настроек даёт ' + cliCommand('--init') + ' в пустом каталоге');
  }
  const cfg = Object.assign({}, DEFAULT_CONFIG, raw);
  cfg.minify = Object.assign({}, DEFAULT_CONFIG.minify, raw.minify);
  cfg.links = Object.assign({}, DEFAULT_CONFIG.links, raw.links);
  cfg.rows = Object.assign({}, DEFAULT_CONFIG.rows, raw.rows);
  cfg.path = file;
  validateConfig(cfg);
  return cfg;
}

function validateConfig(cfg) {
  const fail = (msg) => refuse(EXIT.CONFIG, 'конфиг ' + cfg.path + ': ' + msg + '\n  починка: правьте ' + cfg.path);
  if (!cfg.columns || cfg.columns.length === 0) fail('не задано ни одной колонки (columns)');
  const labels = new Set();
  cfg.columns.forEach((c, i) => {
    if (!c || !c.label || !Array.isArray(c.paths) || c.paths.length === 0) {
      fail('колонка №' + (i + 1) + ' должна быть {label, paths: [...]}');
    }
    if (labels.has(c.label)) fail('метка колонки «' + c.label + '» повторяется');
    if (c.category !== undefined && CATEGORY_ORDER.indexOf(c.category) < 0) {
      fail('категория «' + c.category + '» у колонки «' + c.label + '» неизвестна: '
        + CATEGORY_ORDER.join(', '));
    }
    labels.add(c.label);
  });
  if (!Array.isArray(cfg.metrics) || cfg.metrics.length === 0) fail('не заданы метрики (metrics)');
  cfg.metrics.forEach((m) => {
    if (!METRICS[m]) fail('неизвестная метрика «' + m + '» (есть: ' + Object.keys(METRICS).join(', ') + ')');
  });
  if (!LOCALES[cfg.locale]) fail('неизвестная локаль «' + cfg.locale + '» (есть: ' + Object.keys(LOCALES).join(', ') + ')');
  // Файл таблицы не может быть её колонкой: размер артефакта зависит от числа
  // строк, то есть от самого себя.
  cfg.columns.forEach((c) => {
    if (c.paths.indexOf(cfg.output) >= 0) fail('файл таблицы (' + cfg.output + ') не может быть колонкой');
  });
  if (!cfg.output) fail('не задан output');
  if (cfg.journal) {
    if (!cfg.journal.path) fail('journal.path не задан');
    if (!cfg.journal.pattern) fail('journal.pattern не задан');
    try { new RegExp(cfg.journal.pattern); } catch (e) { fail('journal.pattern не компилируется: ' + e.message); }
  }
}

// --- локали -----------------------------------------------------------------

/* Тексты артефакта: колонка, метрики и служебные слова. Механика (заголовки
 * таблицы, клетки, дельты) от локали не зависит, поэтому перевод — это словарь,
 * а не отдельный рендер. */
const LOCALES = {
  ru: {
    html: 'ru',
    heading: 'Объём файлов по коммитам',
    commit: 'Коммит',
    total: 'Общий объём',
    now: 'сейчас',
    categories: { code: 'Код', docs: 'Документация', chore: 'Служебные', assets: 'Ресурсы' },
    page: {
      metrics: 'Метрики',
      note: 'В клетке — изменение к предыдущему коммиту, пустая клетка — не менялось, '
        + '«—» — файла в той ревизии ещё нет. Абсолютные размеры стоят один раз, в строке «{now}». '
        + 'Собрано из истории git: {command}.'
    },
    note: {
      intro: 'Строка — коммит, колонка — файл. ',
      metricSep: ', ',
      metricEnd: '. ',
      numbers: 'В клетке — изменение к предыдущему коммиту (он идёт строкой ниже): '
        + '<span class="up">рост</span> / <span class="down">спад</span>, пустая клетка — '
        + 'не менялось, <code>—</code> — файла в той ревизии ещё нет. Абсолютные размеры '
        + 'стоят один раз: в верхней строке «{now}» — текущий размер. ',
      journal: 'Описание ведёт в раздел {journal}: <code>§N</code> — раздел заведён этим коммитом, '
        + '<code>§N*</code> — коммит правил уже существующий раздел, <code>—</code> — {journal} не трогал. ',
      noJournal: 'Описание — коммит; раздел журнала задаётся в конфиге (journal). ',
      columns: 'Колонки таблицы: {columns}. ',
      rows: 'Строк: {rows}. Собрано из истории git: <code>{command}</code>. '
        + 'Строк не получают коммиты, тронувшие только этот файл, и коммиты без изменения объёма.',
      noJournalMark: 'этот коммит {journal} не трогал'
    }
  },
  en: {
    html: 'en',
    heading: 'File size by commit',
    commit: 'Commit',
    total: 'Total',
    now: 'now',
    categories: { code: 'Code', docs: 'Documentation', chore: 'Chores', assets: 'Assets' },
    page: {
      metrics: 'Metrics',
      note: 'A cell holds the change against the previous commit, an empty cell — no change, '
        + '“—” — the file does not exist in that revision yet. Absolute sizes appear once, in the '
        + '“{now}” row. Collected from git history: {command}.'
    },
    note: {
      intro: 'A row is a commit, a column is a file. ',
      metricSep: ', ',
      metricEnd: '. ',
      numbers: 'A cell holds the change against the previous commit (the row below): '
        + '<span class="up">growth</span> / <span class="down">fall</span>, an empty cell — '
        + 'no change, <code>—</code> — the file does not exist in that revision yet. Absolute '
        + 'sizes appear once, in the top “{now}” row. ',
      journal: 'The description links to a {journal} section: <code>§N</code> — the section was opened '
        + 'by this commit, <code>§N*</code> — the commit edited an existing section, '
        + '<code>—</code> — {journal} was not touched. ',
      noJournal: 'The description is the commit itself; a journal is set by the `journal` config key. ',
      columns: 'Columns: {columns}. ',
      rows: 'Rows: {rows}. Collected from git history: <code>{command}</code>. '
        + 'Commits touching only this file get no row, as do commits changing no number.',
      noJournalMark: 'this commit did not touch {journal}'
    }
  }
};

function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (_m, k) => (vars[k] === undefined ? '' : String(vars[k])));
}

// --- граница вызова git -----------------------------------------------------

/* Всё, что движок читает у git, читается с явно заданными настройками: их
 * значения по умолчанию берутся из настроек машины и меняют то, что попадает в
 * разбор. Без `core.quotePath=false` не-английские пути приходят закавыченными и
 * экранированными (`"docs/\320\267..."`): колонка с таким путём не находит файла,
 * а коммит, у которого она была единственным изменением объёма, теряет строку.
 * Остальные закрепления закрывают тот же класс — раскраска и блок подписи
 * подмешались бы в разбираемый поток, а перекодировка подписей — в подписи строк
 * отчёта. Закрепление задаётся здесь, а не в каждом вызове: иначе его забудет
 * следующий вызов.
 *
 * Локаль закрепляется заодно: разбор не должен зависеть от того, какие переводы
 * стоят на машине. Цена — сообщения самого git в неожиданных отказах идут
 * по-английски; сообщения инструмента остаются русскими. */
const GIT_PINS = [
  'core.quotePath=false',
  'color.ui=never',
  'log.showSignature=false',
  'i18n.logOutputEncoding=UTF-8'
];

function gitArgv(args) {
  const out = ['--no-pager'];
  GIT_PINS.forEach((pin) => { out.push('-c', pin); });
  return out.concat(args);
}

function gitEnv() {
  return Object.assign({}, process.env, { LC_ALL: 'C', LANG: 'C' });
}

function git(root, args) {
  return execFileSync('git', gitArgv(args), {
    cwd: root, encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv()
  });
}

/* Чтение блобов пачкой. `git cat-file --batch-check` отвечает про список пар
 * `ревизия:путь` (sha объекта и размер), `--batch` отдаёт содержимое. Один-два
 * процесса на всю историю вместо спавна `git show` на каждый файл — на тысячах
 * коммитов это разница между минутами и секундой. Побочно размер объекта
 * оказывается дешевле его чтения: метрике `raw` содержимое не нужно вовсе.
 *
 * Ответы позиционные (строка на запрос), поэтому запросы и ответы сопоставляются
 * по порядку — `ревизия:путь` git в ответе не повторяет. */
const BLOB_CHUNK = 1000; // спек на пачку: ограничивает и stdin, и память

function catFileCheck(root, specs) {
  const out = execFileSync('git', gitArgv(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)']), {
    cwd: root, encoding: 'utf8', input: specs.join('\n') + '\n', maxBuffer: MAX_BUF, env: gitEnv()
  });
  return out.split('\n');
}

function catFileBatch(root, shas) {
  const buf = execFileSync('git', gitArgv(['cat-file', '--batch']), {
    cwd: root, input: shas.join('\n') + '\n', maxBuffer: MAX_BUF, env: gitEnv()
  });
  const out = new Map();
  let i = 0;
  while (i < buf.length) {
    const nl = buf.indexOf(10, i);
    if (nl < 0) break;
    const f = buf.toString('utf8', i, nl).split(' ');
    i = nl + 1;
    if (f.length < 3) continue; // «<спека> missing»
    const size = Number(f[2]);
    out.set(f[0], { size: size, text: buf.toString('utf8', i, i + size) });
    i += size + 1; // перевод строки после содержимого
  }
  return out;
}

/* Блобы для списка пар «ревизия:путь». `needText` — читать ли содержимое: метрике
 * `raw` хватает размера объекта, и тогда `--batch` не вызывается вовсе.
 * Одинаковые спеки и одинаковые блобы запрашиваются один раз (кэш по sha). */
function readBlobs(root, specs, needText) {
  const uniq = [...new Set(specs)];
  const out = new Map();
  const texts = new Map(); // sha блоба → содержимое
  for (let start = 0; start < uniq.length; start += BLOB_CHUNK) {
    const part = uniq.slice(start, start + BLOB_CHUNK);
    const lines = catFileCheck(root, part);
    const want = [];
    part.forEach((spec, i) => {
      const line = lines[i] === undefined ? '' : lines[i];
      if (line === '' || line.slice(-8) === ' missing') return;
      const f = line.split(' ');
      if (f.length < 3 || f[1] !== 'blob') return;
      out.set(spec, { sha: f[0], size: Number(f[2]), text: null });
      if (texts.has(f[0])) return;
      want.push(f[0]);
    });
    if (!needText || want.length === 0) continue;
    catFileBatch(root, [...new Set(want)]).forEach((b, sha) => { texts.set(sha, b.text); });
  }
  if (needText) out.forEach((b) => { if (texts.has(b.sha)) b.text = texts.get(b.sha); });
  return out;
}

/* Дерево HEAD: sha блобов всех файлов коммита. Это правда о содержимом HEAD,
 * добытая не тем же способом, что состояние движка (то читает блобы пачкой),
 * поэтому расхождение с ней и означает потерянную при переносе правку. Один вызов
 * на прогон; разбор идёт по NUL (`-z`), иначе пути с пробелами пришлось бы
 * раскодировать. */
function headTree(root) {
  const out = new Map();
  const tree = execFileSync('git', gitArgv(['ls-tree', '-r', '-z', 'HEAD']), {
    cwd: root, encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv()
  });
  tree.split('\u0000').forEach((rec) => {
    const tab = rec.indexOf('\t');
    if (tab < 0) return;
    out.set(rec.slice(tab + 1), rec.slice(0, tab).split(' ')[2]);
  });
  return out;
}

/* Файлы на диске — такими, какими их видит git: `hash-object` пропускает каждый
 * файл через те же переводы строк и фильтры, что и `git add` (`.gitattributes`,
 * `core.autocrlf`). Поэтому «файл на диске соответствует коммиту» — это сравнение
 * хешей, а не размеров: размер зависит от выкладки (при `core.autocrlf=true` на
 * диске CRLF, в git LF). Пути приходят списком, ответы позиционные — как у
 * `cat-file`. */
function diskHashes(root, paths) {
  const out = new Map();
  const lines = execFileSync('git', gitArgv(['hash-object', '--stdin-paths']), {
    cwd: root, encoding: 'utf8', input: paths.join('\n') + '\n', maxBuffer: MAX_BUF, env: gitEnv()
  }).split('\n');
  paths.forEach((p, i) => { out.set(p, lines[i] === undefined ? '' : lines[i].trim()); });
  return out;
}

/* Обратный перевод: то, что git выложил бы на диск для блоба этой ревизии и пути
 * (`--filters` применяет фильтры выкладки). Нужен там, где переводы строк git не
 * возвращает обратно: файл, в котором CRLF лежат в самом коммите, при
 * `core.autocrlf=true` выкладывается как есть, а «очистка» вернула бы LF, — сам
 * git про такие файлы предупреждает, а на диск кладёт именно это. */
function diskForm(root, rev, p) {
  return execFileSync('git', gitArgv(['cat-file', '--filters', rev + ':' + p]), {
    cwd: root, maxBuffer: MAX_BUF, env: gitEnv()
  });
}

// Содержимое файла в ревизии или null, если файла там нет.
function blobAt(root, rev, p) {
  const blobs = readBlobs(root, [rev + ':' + p], true);
  const blob = blobs.get(rev + ':' + p);
  return blob === undefined ? null : blob.text;
}

/* История одним вызовом: заголовок коммита и список изменённых им путей.
 * `%ad` — дата автора в его собственной зоне (не в зоне машины), иначе таблица
 * собиралась бы в CI по UTC и расходилась бы с локальной сборкой.
 * `--diff-merges=first-parent` — иначе у merge-коммита списка путей нет вовсе
 * (git не показывает дифф слияния, пока не попросишь): правки разрешения
 * конфликта выпали бы и из строки, и из переноса состояния, а состояние на HEAD
 * разошлось бы с содержимым файла в дереве. С первым родителем у слияния видно
 * ровно то, что оно привнесло поверх своей ветки. */
function readHistory(root) {
  const log = git(root, [
    'log', '--reverse', '--name-only', '--diff-merges=first-parent', '--date=format:%Y-%m-%d %H:%M',
    '--pretty=format:commit' + FIELD + '%H' + FIELD + '%ad' + FIELD + '%P' + FIELD + '%s'
  ]);
  const commits = [];
  let cur = null;
  log.split('\n').forEach((line) => {
    if (line.indexOf('commit' + FIELD) === 0) {
      const f = line.split(FIELD);
      cur = { sha: f[1], when: f[2], parents: f[3] ? f[3].split(' ') : [], subject: f[4], files: [] };
      commits.push(cur);
      return;
    }
    if (line !== '' && cur) cur.files.push(line);
  });
  return commits;
}

function assertFullHistory(root) {
  if (git(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    refuse(EXIT.SHALLOW, 'история обрезана (shallow clone): таблица строится по всей истории коммитов.\n'
      + '  локально: git fetch --unshallow\n'
      + '  в CI: actions/checkout с fetch-depth: 0');
  }
}

// --- метрики ----------------------------------------------------------------

function byteLen(text) {
  return Buffer.byteLength(text, 'utf8');
}

/* Снятие комментариев и отступов — метрика «объём без балласта», а не
 * минификация: пробелы внутри строк и порядок токенов не трогаются (это позволит
 * сравнивать числа между языками и не зависит от чужого инструмента, которого в
 * проекте нет). Строки и шаблоны проходят насквозь, блочный комментарий
 * заменяется пробелом, чтобы `a` и `b` из `a` + блочный комментарий + `b` не
 * склеились в одно имя, перевод строки после `//` сохраняется — он разделяет
 * токены. */
function stripJs(src) {
  let out = '';
  let i = 0;
  let last = '';   // последний значимый символ вывода: по нему решается, оператор «/» или регексп
  let word = '';   // хвост последнего слова: после `return` идёт выражение, а не деление
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    // Комментарные пары проверяются до регекси: ни `/`, ни `*` не могут быть
    // первым символом литерала регекспа, а вот `/*` в начале файла — обычное дело.
    if (ch === '/' && next === '/') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      out += ' ';
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (ch === '/' && regexAllowed(last, word)) {
      const end = endOfRegex(src, i);
      out += src.slice(i, end);
      i = end;
      last = '/';
      word = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = endOfString(src, i, ch);
      out += src.slice(i, end);
      i = end;
      last = ch;
      word = '';
      continue;
    }
    out += ch;
    if (ch.trim() !== '') {
      last = ch;
      word = /[\w$]/.test(ch) ? word + ch : '';
    }
    i++;
  }
  return out;
}

/* Регексп начинается там, где ожидается операнд: после оператора, открывающей
 * скобки или ключевого слова. Признак грубый, но его хватает: без него
 * `replace(/\//g, …)` читалось бы как начало строчного комментария и резало
 * строку (проверено гардом компиляции). */
const REGEX_KEYWORDS = ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else', 'yield', 'await'];

function regexAllowed(last, word) {
  if (last === '') return true;
  if (REGEX_KEYWORDS.indexOf(word) !== -1) return true;
  return '([{,;:=!&|?+-*%~^<>'.indexOf(last) !== -1;
}

function endOfRegex(src, start) {
  let i = start + 1;
  let inClass = false;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '\n') return start + 1; // наткнулись на строку — значит, это был не регексп
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) return i + 1;
    i++;
  }
  return start + 1;
}

function endOfString(src, start, quote) {
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === quote) return i + 1;
    // В шаблоне `${…}` живёт выражение, а в нём — свои строки.
    if (quote === '`' && ch === '$' && src[i + 1] === '{') { i = endOfTemplateExpr(src, i + 2); continue; }
    i++;
  }
  return src.length;
}

function endOfTemplateExpr(src, start) {
  let depth = 1;
  let i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') { depth--; i++; if (depth === 0) return i; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { i = endOfString(src, i, ch); continue; }
    i++;
  }
  return src.length;
}

function stripCss(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/* HTML: комментарии разметки (включая маркеры вклеек `<!--icon …-->` и
 * `<!--/icon-->`), комментарии внутри <script> как JS и внутри <style> как CSS. */
function stripHtml(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_m, open, body, close) => open + stripJs(body) + close)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open, body, close) => open + stripCss(body) + close);
}

function stripLines(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => l !== '').join('\n');
}

function compactJson(text) {
  try { return JSON.stringify(JSON.parse(text)); } catch (_e) { return stripLines(text); }
}

/* Стратегия по расширению. Незнакомое расширение получает снятие отступов и
 * пустых строк — безопасный минимум: снимать комментарии «на глаз» в синтаксисе,
 * которого генератор не знает (например, `#` в YAML или отступы в Python),
 * значило бы мерить уже другой файл. */
const MINIFY_BY_EXT = {
  '.js': 'strip-js', '.mjs': 'strip-js', '.cjs': 'strip-js',
  '.html': 'strip-html', '.htm': 'strip-html',
  '.css': 'strip-css', '.scss': 'strip-css', '.less': 'strip-css',
  '.json': 'json', '.json5': 'json'
};
const STRATEGIES = ['strip-js', 'strip-html', 'strip-css', 'json', 'strip-lines', 'none'];

function strategyFor(file, cfg) {
  const ext = path.extname(file).toLowerCase();
  return (cfg.minify.ext && cfg.minify.ext[ext]) || MINIFY_BY_EXT[ext] || 'strip-lines';
}

function minifyForm(text, file, cfg) {
  const how = strategyFor(file, cfg);
  if (how === 'none') return text;
  if (how === 'strip-js') return stripLines(stripJs(text));
  if (how === 'strip-html') return stripLines(stripHtml(text));
  if (how === 'strip-css') return stripLines(stripCss(text));
  if (how === 'json') return compactJson(text);
  if (how === 'strip-lines') return stripLines(text);
  throw new Error('неизвестная стратегия минификации «' + how + '» (есть: ' + STRATEGIES.join(', ') + ')');
}

/* Гард стриппера: он не имеет права выбросить что-то кроме комментариев и
 * отступов, поэтому результат обязан компилироваться. Проверяем только те
 * расширения, где содержимое — валидный JavaScript (список в конфиге,
 * `minify.guard`): TypeScript или JSX хостом не проверяются, и делать вид, что
 * проверили, было бы хуже, чем не проверять.
 *
 * Модуль (`export`/`import`, расширение `.mjs`) в `vm.Script` не компилируется —
 * его разбирают как скрипт и падают на самом `export`. Такой файл проверяет сам
 * Node: формат она определяет по расширению, поэтому текст кладётся в временный
 * файл с тем же расширением. Иначе конфиг вида `eslint.config.mjs` оставался бы
 * без гарда, а без гарда его правка могла бы испортить «объём» молча. */
const MODULE_EXT = ['.mjs'];
function assertCompilable(min, rev, p) {
  const bad = (why) => new Error('стриппер испортил ' + p + ' на ' + rev.slice(0, 7) + ': ' + why);
  if (MODULE_EXT.indexOf(path.extname(p).toLowerCase()) >= 0) {
    const tmp = path.join(os.tmpdir(), 'size-table-guard-' + process.pid + path.extname(p));
    try {
      fs.writeFileSync(tmp, min);
      execFileSync(process.execPath, ['--check', tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      // В stderr Node сначала эхо строки с ошибкой, потом сам SyntaxError и стек.
      const lines = String((e && e.stderr) || (e && e.message) || e).split('\n')
        .map((l) => l.trim()).filter((l) => l !== '');
      const detail = lines.find((l) => /^\w*Error\b/.test(l)) || lines[0];
      throw bad(detail || 'модуль не компилируется');
    } finally {
      fs.rmSync(tmp, { force: true });
    }
    return;
  }
  try {
    new vm.Script(min, { filename: p });
  } catch (e) {
    throw bad(e.message);
  }
}

/* Метрика объявляет, нужен ли ей текст блоба: `needsText: false` вместе с
 * `fromSize: true` означает «хватит размера объекта», и тогда содержимое не
 * читается вовсе (`git cat-file --batch` не вызывается). */
const METRICS = {
  raw: {
    label: 'raw',
    needsText: false,
    fromSize: true,
    note: { ru: 'файл как он есть', en: 'the file as it is' },
    method: {
      ru: 'размер объекта git',
      en: 'the size of the git object'
    },
    accuracy: 'exact',
    measure: (text) => byteLen(text)
  },
  min: {
    label: 'min',
    needsText: true,
    note: { ru: 'та же форма без комментариев и отступов', en: 'the same form without comments and indentation' },
    // Не минификация: имена не сокращаются, и число означает «объём без балласта»,
    // а не то, что получит сборщик. Поэтому метрика честно помечена приближением.
    method: {
      ru: 'снятие комментариев и отступов (не минификация: имена не сокращаются)',
      en: 'comments and indentation stripped (not minification: names are not shortened)'
    },
    accuracy: 'approximate',
    measure: (text, file, cfg, rev) => {
      const min = minifyForm(text, file, cfg);
      const ext = path.extname(file).toLowerCase();
      if (strategyFor(file, cfg) === 'strip-js' && cfg.minify.guard.indexOf(ext) >= 0) assertCompilable(min, rev, file);
      return byteLen(min);
    }
  },
  gzip: {
    label: 'gzip',
    needsText: true,
    note: { ru: 'сжатый поток (zlib, уровень 9)', en: 'compressed stream (zlib, level 9)' },
    method: { ru: 'zlib, уровень 9', en: 'zlib, level 9' },
    accuracy: 'exact',
    measure: (text) => zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 }).length
  }
};

/* Одно место, где решается, читать метрику из размера объекта или из текста:
 * метрика без текста на недогруженном блобе — ошибка, а не молчаливый ноль. */
function measureBlob(name, blob, file, cfg, rev) {
  const metric = METRICS[name];
  if (metric.fromSize) return blob.size;
  if (blob.text === null) {
    throw new Error('метрике «' + name + '» нужно содержимое ' + file + ' на ' + rev.slice(0, 7) + ', а оно не прочитано');
  }
  return metric.measure(blob.text, file, cfg, rev);
}

// --- журнал -----------------------------------------------------------------

/* Журнал (WORKLOG/CHANGELOG/…): раздел, к которому относится коммит. Формат
 * заголовков задаётся регуляркой в конфиге; именованные группы `id` (короткий
 * номер для `§N`) и `title` необязательны — без них номер берётся первым словом. */
function parseSections(text, pattern) {
  const re = new RegExp(pattern);
  const list = [];
  let cur = null;
  text.split('\n').forEach((line) => {
    const m = re.exec(line);
    if (m) {
      const g = m.groups || {};
      const head = line.replace(/^#+\s*/, '').trim();
      const id = g.id === undefined ? head.split(/\s+/)[0] : g.id;
      cur = { id: id, head: head, body: '' };
      list.push(cur);
      return;
    }
    if (cur) cur.body += line + '\n';
  });
  return list;
}

/* Раздел, к которому относится коммит: сначала вновь заведённый, иначе —
 * последний из отредактированных (журналы ведутся по возрастанию, так что правка
 * почти всегда касается хвоста). */
function touchedSection(prevText, nowText, pattern) {
  const prev = new Map(parseSections(prevText, pattern).map((s) => [s.head, s.body]));
  const now = parseSections(nowText, pattern);
  const added = now.filter((s) => !prev.has(s.head));
  if (added.length > 0) {
    const s = added[added.length - 1];
    return { id: s.id, head: s.head, added: true };
  }
  const edited = now.filter((s) => prev.get(s.head) !== s.body);
  if (edited.length > 0) {
    const s = edited[edited.length - 1];
    return { id: s.id, head: s.head, added: false };
  }
  return null;
}

/* Якорь — как у GitHub (github-slugger): пунктуация снимается целиком, каждый
 * пробел становится дефисом. Отсюда «13 — эфф» → «13--эфф» (два дефиса: тире
 * выброшено, пробелы остались каждый своим). Дефис, подчёркивание и буквы
 * (включая кириллицу) сохраняются, остальные пробельные символы — нет. */
function anchor(head) {
  return head.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');
}

function sectionLink(section, cfg) {
  if (!section || !cfg.journal) return null;
  const what = cfg.journal.anchor === 'title' ? section.id : section.head;
  return cfg.journal.url + '#' + anchor(what);
}

/* Ссылка строки: на раздел журнала, если раздел есть, иначе на сам коммит (шаблон
 * из настроек). Одно место для артефакта и для данных страницы: адрес раздела —
 * правило GitHub, и второе его воплощение разъехалось бы с первым. */
function rowHref(section, sha, cfg) {
  if (section) return sectionLink(section, cfg);
  if (!cfg.links.commitUrl) return null;
  return cfg.links.commitUrl.replace(/\{sha\}/g, sha).replace(/\{short\}/g, sha.slice(0, 7));
}

// --- измерение --------------------------------------------------------------

/* Сдвинул ли коммит хотя бы одно число. Сравниваются числа, а не список файлов:
 * правка в пробелах или комментариях размера не меняет, и строка про неё была бы
 * пустой, а у слияния клетки выходят нулевыми всегда, когда разрешение конфликта
 * совпало с тем, что уже дала ветка. Колонка, которой коммит не касался,
 * остаётся тем же объектом состояния. */
function changesVolume(state, before, columns, metrics) {
  return columns.some((_col, i) => {
    const a = state[i], b = before[i];
    if (a === b) return false;
    if (a === null || b === null) return true;
    return metrics.some((m) => a.cells[m] !== b.cells[m]);
  });
}

/* Проход по истории. Состояние колонки переносится вперёд, а перезамер делается
 * только для изменившихся в коммите файлов. Читается всё сразу: сначала план
 * «какие пары ревизия:путь понадобятся», затем один поход в git (`readBlobs`),
 * затем собственно измерение — иначе на каждый коммит приходилось бы по
 * git-вызову на колонку. Значения метрик кэшируются по sha блоба: ревизия с тем
 * же содержимым (откат, повторный merge) не пересчитывается. */
function measureHistory(cfg, root) {
  const commits = readHistory(root);
  const metrics = cfg.metrics;
  // Текст журнала нужен всегда: ссылка в раздел — не метрика, но тоже чтение.
  const needText = !!cfg.journal || metrics.some((m) => METRICS[m].needsText);
  const skipPaths = [cfg.output].concat(cfg.skip || []);
  const state = cfg.columns.map(() => null);
  const rows = [];
  const skipped = [];
  const mixed = [];
  let journalPrev = '';

  const plan = commits.map((c) => {
    const changed = new Set(c.files);
    const picks = cfg.columns.map((col) => {
      const p = col.paths.find((cand) => changed.has(cand));
      return p === undefined ? null : { path: p, spec: c.sha + ':' + p };
    });
    const journal = cfg.journal && changed.has(cfg.journal.path) ? c.sha + ':' + cfg.journal.path : null;
    return { picks: picks, journal: journal };
  });

  const specs = [];
  plan.forEach((p) => {
    p.picks.forEach((pick) => { if (pick !== null) specs.push(pick.spec); });
    if (p.journal !== null) specs.push(p.journal);
  });
  const blobs = readBlobs(root, specs, needText);

  const measured = new Map(); // sha блоба + метрика → число
  const measure = (name, blob, file, rev) => {
    const key = blob.sha + '\u0000' + name;
    if (measured.has(key)) return measured.get(key);
    const value = measureBlob(name, blob, file, cfg, rev);
    measured.set(key, value);
    return value;
  };

  commits.forEach((c, ci) => {
    let section = null;
    if (plan[ci].journal !== null) {
      const journalBlob = blobs.get(plan[ci].journal);
      if (journalBlob !== undefined) {
        section = touchedSection(journalPrev, journalBlob.text, cfg.journal.pattern);
        journalPrev = journalBlob.text;
      }
    }

    const before = state.slice();
    plan[ci].picks.forEach((pick, i) => {
      if (pick === null) return;
      const blob = blobs.get(pick.spec);
      if (blob === undefined) { state[i] = null; return; }
      const cells = {};
      metrics.forEach((m) => { cells[m] = measure(m, blob, pick.path, c.sha); });
      state[i] = { path: pick.path, sha: blob.sha, cells: cells };
    });

    if (c.parents.length > 1 && !cfg.rows.merges) { skipped.push(c.sha.slice(0, 7) + ' (merge)'); return; }
    if (c.files.length > 0 && c.files.every((f) => skipPaths.indexOf(f) >= 0)) {
      skipped.push(c.sha.slice(0, 7) + ' (только таблица)');
      return;
    }
    if (!changesVolume(state, before, cfg.columns, metrics)) {
      skipped.push(c.sha.slice(0, 7) + ' (без изменения объёма)');
      return;
    }
    if (c.files.some((f) => f === cfg.output)) mixed.push(c.sha.slice(0, 7));

    rows.push({
      sha: c.sha,
      when: c.when,
      subject: c.subject,
      section: section,
      cells: state.map((s) => (s === null ? null : s.cells))
    });
  });

  return { rows, skipped, mixed, state };
}

function totalsOf(cells, metrics) {
  const out = {};
  metrics.forEach((m) => {
    out[m] = cells.reduce((acc, c) => (c === null ? acc : acc + c[m]), 0);
  });
  return out;
}

/* Сверка с рабочим деревом отвечает на два вопроса, и оба обязательны: состояние
 * движка на HEAD совпадает с деревом коммита, и файл на диске соответствует тому
 * же содержимому. Первый ловит правку, потерянную при переносе состояния между
 * коммитами (например, у merge-коммита, которого нет в списке изменённых путей),
 * — и по содержимому, и по составу: колонка, у которой в состоянии файла нет,
 * обязана быть пустой и в дереве (иначе потеряно создание файла). Второй — правку,
 * которой в истории нет вовсе. Размеры для этого не годятся: на
 * диске они зависят от выкладки (при `core.autocrlf=true` — значение по умолчанию
 * в установке Git для Windows — CRLF против LF), и инструмент отказывался
 * работать там, где всё в порядке. Файлы, изменённые в дереве, из сверки с диском
 * выпадают: их содержимое в коммите и на диске различается законно. */
function assertMatchesDisk(state, cfg, root) {
  const dirty = new Set(git(root, ['status', '--porcelain']).split('\n')
    .map((l) => l.trim()).filter((l) => l !== '').map((l) => l.replace(/^\S+\s+/, '').replace(/^.* -> /, '')));
  const tree = headTree(root);
  const clean = [];
  cfg.columns.forEach((col, i) => {
    const p = state[i] === null ? col.paths.filter((alias) => tree.has(alias))[0] : state[i].path;
    if (p === undefined || tree.get(p) !== (state[i] === null ? null : state[i].sha)) {
      refuse(EXIT.VIOLATION, 'состояние «' + col.label + '» на HEAD не совпало с деревом коммита ('
        + (p === undefined ? 'файла нет' : p + ' ' + tree.get(p).slice(0, 7)) + ' вместо '
        + (state[i] === null ? 'файла нет' : state[i].path + ' ' + state[i].sha.slice(0, 7))
        + '): перенос состояния между коммитами пропустил правку'
        + '\n  починка: пересоберите таблицу (' + cfg.fixCommand + ') и закоммитьте ' + cfg.output);
    }
    if (!dirty.has(p) && clean.indexOf(p) < 0) clean.push(p);
  });
  if (clean.length === 0) return;
  const onDisk = diskHashes(root, clean);
  clean.forEach((p) => {
    if (onDisk.get(p) === tree.get(p)) return; // git считает файл неизменным
    if (fs.readFileSync(path.join(root, p)).equals(diskForm(root, 'HEAD', p))) return; // переводы строк необратимы
    refuse(EXIT.VIOLATION, 'содержимое ' + p + ' на диске разошлось с HEAD (' + onDisk.get(p).slice(0, 7)
      + ' вместо ' + tree.get(p).slice(0, 7) + '), хотя git не считает файл изменённым: правка есть только на диске'
      + '\n  починка: закоммитьте правку или откатите её: git checkout -- ' + p);
  });
}

// --- категории ---------------------------------------------------------------

/* Категория файла — только для быстрых кнопок «включить/выключить группу» на
 * странице: на числа она не влияет. Правило одно — расширение даёт категорию, всё
 * остальное считается кодом; категория, заданная в настройках колонки, старше
 * правила, и в данных видно, откуда она взялась (`categoryBy`): ручное решение
 * объяснимо, а таблица расширений — догадка по имени файла. */
const CATEGORY_EXTS = {
  docs: ['.md', '.markdown', '.rst', '.txt', '.adoc'],
  chore: ['.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.lock', '.editorconfig'],
  assets: ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf']
};
const CATEGORY_ORDER = ['code', 'docs', 'chore', 'assets'];

function categoryOf(col) {
  if (col.category) return { key: col.category, by: 'config' };
  const ext = path.extname(col.paths[col.paths.length - 1]).toLowerCase();
  const known = CATEGORY_ORDER.find((key) => (CATEGORY_EXTS[key] || []).indexOf(ext) >= 0);
  return { key: known === undefined ? 'code' : known, by: 'auto' };
}

// --- данные (контракт со страницей) ------------------------------------------

/* Контракт между движком и страницей: абсолютные значения и устройство таблицы —
 * и ни одной производной величины. Дельты, суммы, «сейчас» и фильтры считает
 * страница: движок не знает, что включено в просмотр, поэтому заранее посчитать
 * сумму он не может. Числа в контракте те же, что в артефакте, — это та же правда,
 * разложенная по полям.
 *
 * Причины пропущенных коммитов пока идут строками движка: разложить их по полям —
 * вместе с командой объяснения (план, §5, шаг 5). */
function reportData(cfg, root) {
  const { rows, state, skipped } = build(cfg, root);
  const loc = LOCALES[cfg.locale];
  const files = cfg.columns.map((col, i) => {
    const cat = categoryOf(col);
    return {
      label: col.label,
      path: state[i] === null ? null : state[i].path,
      paths: col.paths,
      category: cat.key,
      categoryBy: cat.by
    };
  });
  return {
    schema: 1,
    tool: { name: TOOL_PKG.name, version: TOOL_PKG.version },
    report: {
      locale: cfg.locale,
      title: cfg.title || loc.heading,
      heading: cfg.heading || loc.heading,
      artifact: cfg.output,
      fixCommand: cfg.fixCommand,
      journal: cfg.journal === null ? null : { path: cfg.journal.path },
      showSha: cfg.rows.sha
    },
    metrics: cfg.metrics.map((key) => ({
      key: key,
      label: METRICS[key].label,
      note: METRICS[key].note[cfg.locale],
      method: METRICS[key].method[cfg.locale],
      accuracy: METRICS[key].accuracy
    })),
    categories: CATEGORY_ORDER.filter((key) => files.some((f) => f.category === key))
      .map((key) => ({ key: key, label: loc.categories[key] })),
    files: files,
    rows: rows.map((r) => ({
      sha: r.sha,
      when: r.when,
      subject: r.subject,
      section: r.section === null ? null : { id: r.section.id, head: r.section.head, added: r.section.added },
      href: rowHref(r.section, r.sha, cfg),
      values: r.cells
    })),
    now: state.map((s) => (s === null ? null : s.cells)),
    skipped: skipped
  };
}

// --- рендер -----------------------------------------------------------------

const CSS = `
:root { color-scheme: light dark; }
/* Фон и цвет текста заданы явно и одной парой (Canvas/CanvasText): без этого
 * страница берёт цвет текста из схемы, а фон — нет, и в тёмной схеме числа
 * оказывались белыми на белом. */
body { margin: 0; padding: 20px; background: Canvas; color: CanvasText; font: 12.5px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
h1 { margin: 0 0 6px; font-size: 16px; }
.note { margin: 0 0 14px; max-width: 80em; opacity: .75; font-size: 12px; }
.note code { background: rgba(127, 127, 127, .15); padding: 0 3px; border-radius: 3px; }
/* Гарнитура одна на всю таблицу; числа выравниваются по разрядам за счёт
 * tabular-nums, а не за счёт моноширинного шрифта. */
table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 2px 7px; border-bottom: 1px solid rgba(127, 127, 127, .25); white-space: nowrap; }
/* Шапка из двух строк: обе липкие, поэтому вторая сдвинута ровно на высоту первой
 * (line-height 20 + 2px нижней границы), иначе строки накладывались бы друг на друга. */
thead th { position: sticky; top: 0; z-index: 3; background: Canvas; text-align: center; line-height: 20px; padding: 0 7px; }
thead tr:first-child th { border-bottom-width: 2px; }
thead tr:last-child th { top: 22px; }
.num { text-align: right; }
.g { border-left: 1px solid rgba(127, 127, 127, .35); }
/* Липкая левая колонка: фон непрозрачный (Canvas), иначе при скролле вправо под
 * клеткой были бы видны числа. Ярус выше соседних клеток (2) и ниже шапки (3);
 * угол шапки — выше всех, иначе группы колонок наползают на «Коммит». */
.c-commit { position: sticky; left: 0; z-index: 2; background: Canvas; text-align: left; font-weight: 400; }
.c-commit a { color: inherit; }
thead .c-commit { z-index: 6; }
/* Ширину колонки задаёт этот блок. Без него содержимое ячейки выходило за её
 * границы и рисовалось поверх соседних чисел: у ячейки таблицы нет обрезки. */
.clip { display: flex; align-items: baseline; gap: 6px; width: 300px; }
.when { flex: none; opacity: .7; }
.subj { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; display: block; }
.subj.plain { opacity: .7; }
.sect { flex: none; opacity: .7; font-size: 11px; text-decoration: none; border-bottom: 1px dotted currentColor; }
/* Рост зелёный, спад красный — по договорённости с заказчиком (рост — «больше
 * логики», а не тревога). */
.up { color: #1e8449; }
.down { color: #c0392b; }
.miss { opacity: .5; }
/* Верхняя строка — текущие размеры: она же и объясняет, к чему относятся дельты. */
tr.now th, tr.now td { border-bottom: 2px solid rgba(127, 127, 127, .35); }
tr.now .c-commit { font-weight: 600; }
/* Подсветка строки — наложением, а не подменой фона: липкая колонка обязана
 * оставаться непрозрачной, иначе под ней при скролле видны числа. */
tbody tr:hover th, tbody tr:hover td { background-image: linear-gradient(rgba(127, 127, 127, .08), rgba(127, 127, 127, .08)); }
`.trim();

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Разряды тонкими пробелами: toLocaleString зависит от ICU сборки Node, а строка
// таблицы обязана совпадать побайтово на любой машине.
function group(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
}

/* Клетка строки-коммита — только дельта: абсолютные числа стоят один раз в
 * верхней строке, иначе крупное число повторялось бы в каждой строке и колонки
 * расползались бы. Пустая клетка — «не менялось», `—` — файла в ревизии нет. */
function cell(value, delta, cls) {
  const classes = 'num' + (cls ? ' ' + cls : '');
  if (value === null) return '<td class="' + classes + ' miss">—</td>';
  if (!delta) return '<td class="' + classes + '"></td>';
  const dir = delta > 0 ? 'up' : 'down';
  return '<td class="' + classes + '"><span class="delta ' + dir + '">'
    + (delta > 0 ? '+' : '-') + group(Math.abs(delta)) + '</span></td>';
}

// Клетка верхней строки: текущий размер, без дельты.
function cellNow(value, cls) {
  const classes = 'num' + (cls ? ' ' + cls : '');
  if (value === null) return '<td class="' + classes + ' miss">—</td>';
  return '<td class="' + classes + '">' + group(value) + '</td>';
}

function commitCell(row, index, cfg) {
  const loc = LOCALES[cfg.locale];
  const short = cfg.rows.sha ? row.sha.slice(0, 7) : '';
  const when = '<span class="when">' + esc(row.when) + '</span>';
  const title = esc(short ? row.subject + ' · ' + short : row.subject);
  const href = sectionLink(row.section, cfg);
  let body;
  let mark;
  if (row.section) {
    body = href
      ? '<a class="subj" title="' + title + '" href="' + href + '">' + esc(row.subject) + '</a>'
      : '<span class="subj" title="' + title + '">' + esc(row.subject) + '</span>';
    mark = '<span class="sect" title="' + esc(row.section.head) + '">§' + esc(row.section.id)
      + (row.section.added ? '' : '*') + '</span>';
  } else {      const commitHref = rowHref(null, row.sha, cfg) || '';
      body = commitHref
      ? '<a class="subj" title="' + title + '" href="' + esc(commitHref) + '">' + esc(row.subject) + '</a>'
      : '<span class="subj plain" title="' + title + '">' + esc(row.subject) + '</span>';
    mark = '<span class="sect" title="'
      + (cfg.journal
        ? esc(fill(loc.note.noJournalMark, { journal: cfg.journal.path }))
        : esc(loc.note.noJournal))
      + '">—</span>';
  }
  const id = cfg.rows.sha ? 'c-' + row.sha.slice(0, 7) : 'c-' + (index + 1);
  return '<th class="c-commit" id="' + id + '">'
    + '<div class="clip">' + when + body + mark + '</div></th>';
}

function noteText(rows, cfg) {
  const loc = LOCALES[cfg.locale];
  const metrics = cfg.metrics.map((m) => '<b>' + METRICS[m].label + '</b> — ' + METRICS[m].note[cfg.locale]).join(loc.note.metricSep);
  const journal = cfg.journal ? loc.note.journal : loc.note.noJournal;
  return loc.note.intro + metrics + loc.note.metricEnd + fill(loc.note.numbers, { now: loc.now })
    + (cfg.journal ? fill(journal, { journal: cfg.journal.path }) : journal)
    + fill(loc.note.columns, { columns: cfg.columns.map((c) => c.label).join(', ') })
    + fill(loc.note.rows, { rows: rows.length, command: cfg.fixCommand });
}

/* Верхняя строка — текущие размеры: абсолютное число стоит в таблице один раз,
 * и именно с ним сходятся все дельты под ним. */
function nowCells(row, metrics) {
  const total = totalsOf(row.cells, metrics);
  const cells = metrics.map((m, mi) => cellNow(total[m], mi === 0 ? 'g' : ''));
  row.cells.forEach((c) => {
    metrics.forEach((m, mi) => cells.push(cellNow(c === null ? null : c[m], mi === 0 ? 'g' : '')));
  });
  return cells.join('');
}

function render(rows, cfg) {
  const loc = LOCALES[cfg.locale];
  const metrics = cfg.metrics;
  const groupHead = (label, cls) => '<th colspan="' + metrics.length + '" class="' + cls + '">' + esc(label) + '</th>';
  const subHead = () => metrics.map((m, i) => '<th' + (i === 0 ? ' class="g"' : '') + '>'
    + esc(METRICS[m].label) + '</th>').join('');
  const head = '<tr>'
    + '<th rowspan="2" class="c-commit">' + esc(loc.commit) + '</th>'
    + groupHead(loc.total, 'g')
    + cfg.columns.map((c) => groupHead(c.label, 'g')).join('')
    + '</tr>\n<tr>'
    + subHead()
    + cfg.columns.map(() => subHead()).join('')
    + '</tr>';

  /* Дельта считается к предыдущему коммиту (в списке ниже он идёт строкой ниже),
   * а появление файла — рост на весь его объём: иначе сумма дельт по колонке не
   * сходилась бы с текущим размером, и верхняя строка была бы недоказуемой. */
  const d = (now, before) => (before === null || before === undefined ? now : now - before);
  const body = rows.map((row, i) => {
    const prev = i === 0 ? null : rows[i - 1];
    const total = totalsOf(row.cells, metrics);
    const prevTotal = prev === null ? null : totalsOf(prev.cells, metrics);
    const cells = metrics.map((m, mi) => cell(total[m],
      d(total[m], prevTotal === null ? null : prevTotal[m]), mi === 0 ? 'g' : ''));
    row.cells.forEach((c, ci) => {
      const p = prev === null ? null : prev.cells[ci];
      metrics.forEach((m, mi) => {
        const value = c === null ? null : c[m];
        cells.push(cell(value,
          value === null ? null : d(value, p === null ? null : p[m]), mi === 0 ? 'g' : ''));
      });
    });
    return '<tr>' + commitCell(row, i, cfg) + cells.join('') + '</tr>';
  }).reverse().join('\n');

  const nowRow = rows.length === 0 ? '' : '<tr class="now">'
    + '<th class="c-commit">' + esc(loc.now) + '</th>'
    + nowCells(rows[rows.length - 1], metrics)
    + '</tr>';

  /* Подпись называет только то, что не меняется от самих служебных коммитов:
   * число строк и список колонок. Иначе таблица считалась бы устаревшей сразу
   * после собственного коммита — из-за пересчитанного «пропущено N» в тексте. */
  return `<!doctype html>
<html lang="${loc.html}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.title || loc.heading)}</title>
<style>
${CSS}
</style>
</head>
<body>
<h1>${esc(cfg.heading || loc.heading)}</h1>
<p class="note">${noteText(rows, cfg)}</p>
<table>
<thead>
${head}
</thead>
<tbody>
${nowRow}
${body}
</tbody>
</table>
</body>
</html>
`;
}

// --- страница отчёта --------------------------------------------------------

/* Вычислительная часть страницы: из абсолютных значений контракта получаются все
 * производные — дельты, итоги, «сейчас». Живёт текстом, потому что страница —
 * один файл без внешних ссылок: скрипт в неё вклеивается, а не подключается. Тест
 * прогоняет именно этот текст (`test/contract.test.js`), поэтому числа страницы
 * проверены не на глаз, а сверены с числами артефакта. */
const APP_MATH = `
function appMetrics(data, view) {
  return data.metrics.filter(function (m) { return view.metrics[m.key]; });
}
function appOn(data, view) {
  return data.files.map(function (f, i) { return view.files[i]; });
}
function appValue(row, i, key) {
  const v = row.values[i];
  return v === null ? null : v[key];
}
/* Итог: сумма по включённым файлам. Выключенный файл не участвует ни в таблице,
 * ни в сумме. */
function appTotals(values, metrics, on) {
  const total = {};
  metrics.forEach(function (m) { total[m.key] = 0; });
  values.forEach(function (v, i) {
    if (v === null || !on[i]) return;
    metrics.forEach(function (m) { total[m.key] += v[m.key]; });
  });
  return total;
}
/* Дельта к предыдущему коммиту; появление файла — рост на весь его объём, иначе
 * сумма дельт по колонке не сошлась бы с текущим размером. */
function appDelta(now, before) {
  if (now === null) return null;
  if (before === null || before === undefined) return now;
  return now - before;
}
// Разряды тонкими пробелами: toLocaleString зависит от машины, а страница обязана
// показывать те же числа, что артефакт.
function appGroup(n) {
  return String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '\\u2009');
}
`;

/* Оболочка страницы: панель выбора и таблица. Всё производное берётся из функций
 * выше, поэтому включение метрики, категории или файла пересчитывает и дельты, и
 * итоги — без обращения к движку. Отделка (дерево папок, запоминание выбора,
 * тёмная схема) — следующий проход. */
const APP_DOM = `
const appData = JSON.parse(document.getElementById('data').textContent);
const appUi = JSON.parse(document.getElementById('ui').textContent);
const appView = { metrics: {}, files: [] };
appData.metrics.forEach((m) => { appView.metrics[m.key] = true; });
appData.files.forEach(() => { appView.files.push(true); });

function appEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

function appBox(label, title, checked, onChange) {
  const box = appEl('label', 'box');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  if (title) input.title = title;
  input.addEventListener('change', onChange);
  box.appendChild(input);
  box.appendChild(appEl('span', null, label));
  return box;
}

/* Категория — не отдельное состояние, а способ переставить галочки файлов сразу:
 * сама она ничего не помнит, иначе одно и то же решалось бы в двух местах. */
function appPanel() {
  const panel = document.getElementById('panel');
  panel.textContent = '';
  const mrow = appEl('div', 'row');
  mrow.appendChild(appEl('span', 'cap', appUi.metrics));
  appData.metrics.forEach((m) => {
    mrow.appendChild(appBox(m.label, m.note + ' · способ: ' + m.method + ' (' + m.accuracy + ')',
      appView.metrics[m.key], (e) => {
        appView.metrics[m.key] = e.target.checked;
        appRender();
      }));
  });
  panel.appendChild(mrow);
  appData.categories.forEach((cat) => {
    const idx = [];
    appData.files.forEach((f, i) => { if (f.category === cat.key) idx.push(i); });
    const row = appEl('div', 'row');
    row.appendChild(appBox(cat.label, 'все файлы категории', idx.every((i) => appView.files[i]), (e) => {
      idx.forEach((i) => { appView.files[i] = e.target.checked; });
      appRender();
    }));
    idx.forEach((i) => {
      const f = appData.files[i];
      const where = f.path === null ? f.paths[0] + ' (нет на HEAD)' : f.path;
      row.appendChild(appBox(f.label, where + ' · категория: '
        + (f.categoryBy === 'config' ? 'из настроек' : 'по расширению'), appView.files[i], (e) => {
        appView.files[i] = e.target.checked;
        appRender();
      }));
    });
    panel.appendChild(row);
  });
}

function appDeltaCell(value, before, cls) {
  const td = appEl('td', 'num' + (cls ? ' ' + cls : ''));
  if (value === null) { td.className += ' miss'; td.textContent = '—'; return td; }
  const delta = appDelta(value, before);
  if (delta === 0) return td;
  const span = appEl('span', 'delta ' + (delta > 0 ? 'up' : 'down'),
    (delta > 0 ? '+' : '−') + appGroup(Math.abs(delta)));
  td.appendChild(span);
  return td;
}

function appCommit(row) {
  const th = appEl('th', 'c-commit');
  const short = appData.report.showSha ? ' ' + row.sha.slice(0, 7) : '';
  const name = row.href ? appEl('a', 'subj', row.subject) : appEl('span', 'subj', row.subject);
  if (row.href) name.href = row.href;
  name.title = row.subject + short;
  th.appendChild(appEl('span', 'when', row.when));
  th.appendChild(name);
  const mark = row.section === null
    ? '—'
    : '§' + row.section.id + (row.section.added ? '' : '*');
  th.appendChild(appEl('span', 'sect', mark));
  return th;
}

function appSubHead(metrics) {
  const tr = appEl('tr');
  metrics.forEach((m, mi) => tr.appendChild(appEl('th', mi === 0 ? 'g' : '', m.label)));
  return tr;
}

function appTable() {
  const metrics = appMetrics(appData, appView);
  const on = appOn(appData, appView);
  const files = [];
  appData.files.forEach((f, i) => { if (on[i]) files.push(i); });
  const table = document.getElementById('grid');
  table.textContent = '';

  const head = appEl('tr');
  const commit = appEl('th', 'c-commit', appUi.commit);
  commit.rowSpan = 2;
  head.appendChild(commit);
  const total = appEl('th', 'g', appUi.total);
  total.colSpan = metrics.length;
  head.appendChild(total);
  files.forEach((i) => {
    const th = appEl('th', 'g', appData.files[i].label);
    th.colSpan = metrics.length;
    head.appendChild(th);
  });
  const subs = appSubHead(metrics);
  files.forEach(() => {
    const more = appSubHead(metrics);
    while (more.firstChild) subs.appendChild(more.firstChild);
  });
  const thead = appEl('thead');
  thead.appendChild(head);
  thead.appendChild(subs);

  const body = appEl('tbody');
  for (let r = appData.rows.length - 1; r >= 0; r--) {
    const row = appData.rows[r];
    const prev = r === 0 ? null : appData.rows[r - 1];
    const totals = appTotals(row.values, metrics, on);
    const prevTotals = prev === null ? null : appTotals(prev.values, metrics, on);
    const tr = appEl('tr');
    tr.appendChild(appCommit(row));
    metrics.forEach((m, mi) => {
      tr.appendChild(appDeltaCell(totals[m.key], prevTotals === null ? null : prevTotals[m.key],
        mi === 0 ? 'g' : ''));
    });
    files.forEach((i) => {
      metrics.forEach((m, mi) => {
        tr.appendChild(appDeltaCell(appValue(row, i, m.key),
          prev === null ? null : appValue(prev, i, m.key), mi === 0 ? 'g' : ''));
      });
    });
    body.appendChild(tr);
  }

  /* Верхняя строка — «сейчас»: абсолютные размеры на HEAD. Дельты под ней сходятся
   * с ней, поэтому она и стоит первой. */
  const now = appEl('tr', 'now');
  now.appendChild(appEl('th', 'c-commit', appUi.now));
  const nowTotals = appTotals(appData.now, metrics, on);
  metrics.forEach((m, mi) => { now.appendChild(appEl('td', 'num' + (mi === 0 ? ' g' : ''), appGroup(nowTotals[m.key]))); });
  files.forEach((i) => {
    metrics.forEach((m, mi) => {
      const v = appData.now[i];
      const td = appEl('td', 'num' + (mi === 0 ? ' g' : ''));
      if (v === null) { td.className += ' miss'; td.textContent = '—'; } else { td.textContent = appGroup(v[m.key]); }
      now.appendChild(td);
    });
  });
  body.insertBefore(now, body.firstChild);

  table.appendChild(thead);
  table.appendChild(body);
  document.getElementById('note').textContent = appUi.note.replace('{command}', appData.report.fixCommand);
}

function appRender() {
  appPanel();
  appTable();
}
appRender();
`;

const APP_CSS = `
:root { color-scheme: light dark; }
body { margin: 0; padding: 20px; background: Canvas; color: CanvasText; font: 12.5px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
h1 { margin: 0 0 6px; font-size: 16px; }
.note { margin: 12px 0 0; max-width: 90em; opacity: .75; font-size: 12px; }
#panel { margin: 0 0 14px; font-size: 12px; }
#panel .row { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; margin: 2px 0; }
#panel .cap { font-weight: 600; opacity: .8; }
#panel .box { display: inline-flex; gap: 4px; align-items: center; }
table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 2px 7px; border-bottom: 1px solid rgba(127, 127, 127, .25); white-space: nowrap; }
th { text-align: center; }
.num { text-align: right; }
.g { border-left: 1px solid rgba(127, 127, 127, .35); }
.miss { opacity: .5; }
.c-commit { text-align: left; font-weight: 400; }
.c-commit a { color: inherit; }
.when { opacity: .6; margin-right: 6px; }
.sect { margin-left: 6px; opacity: .6; }
.delta.up { color: #b04a00; }
.delta.down { color: #1a7f37; }
tr.now th, tr.now td { border-bottom: 2px solid rgba(127, 127, 127, .35); }
tr.now .c-commit { font-weight: 600; }
`.trim();

/* Страница отчёта — один файл: данные лежат в нём же, скрипт вклеен, внешних
 * ссылок нет. Поэтому она открывается двойным щелчком и работает без сети.
 * `<` в данных экранируется: иначе подпись коммита или путь закрыли бы тег
 * раньше времени (в JSON такой экранированный символ читается как обычный). */
function pageHtml(data, cfg) {
  const loc = LOCALES[cfg.locale];
  return '<!doctype html>\n<html lang="' + esc(loc.html) + '">\n<head>\n<meta charset="utf-8">\n'
    + '<title>' + esc(data.report.title) + '</title>\n<style>\n' + APP_CSS + '\n</style>\n</head>\n<body>\n'
    + '<h1>' + esc(data.report.heading) + '</h1>\n'
    + '<div id="panel"></div>\n<table id="grid"></table>\n<p id="note" class="note"></p>\n'
    + '<script type="application/json" id="data">'
    + jsonInHtml(data)
    + '</script>\n<script type="application/json" id="ui">'
    + jsonInHtml({
      commit: loc.commit,
      total: loc.total,
      now: loc.now,
      metrics: loc.page.metrics,
      note: loc.page.note.replace(/\{now\}/g, loc.now) // {command} подставляет страница
    })
    + '</script>\n<script>\n' + APP_MATH + APP_DOM + '</script>\n</body>\n</html>\n';
}

/* JSON внутри страницы: `<` экранируется, иначе подпись коммита или путь закрыли
 * бы тег раньше времени (в JSON такой экранированный символ читается как самый
 * обычный). */
function jsonInHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

// --- проверка и режимы ------------------------------------------------------

function kmb(bytes) {
  return Math.round(bytes / 1024) + ' КБ';
}

function check(cfg, want, root) {
  const out = path.join(root, cfg.output);
  if (!fs.existsSync(out)) {
    console.error('✗ таблица размеров: нет файла ' + cfg.output + ' — соберите её: ' + cfg.fixCommand);
    return 1;
  }
  const have = fs.readFileSync(out, 'utf8');
  if (have === want) return 0;

  const a = have.split('\n');
  const b = want.split('\n');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  console.error('✗ таблица размеров: ' + cfg.output + ' расходится с историей git (строка ' + (i + 1) + '):');
  console.error('    в файле:    ' + (a[i] === undefined ? '<строк нет>' : a[i].trim().slice(0, 160)));
  console.error('    по истории: ' + (b[i] === undefined ? '<строк нет>' : b[i].trim().slice(0, 160)));
  const missing = [...want.matchAll(/id="c-([^"]+)"/g)].map((m) => m[1])
    .filter((id) => have.indexOf('id="c-' + id + '"') === -1);
  if (missing.length > 0) {
    console.error('  строк нет в файле: ' + missing.length + ' (' + missing.slice(0, 5).join(', ')
      + (missing.length > 5 ? ', …' : '') + ')');
  }
  console.error('  починка: ' + cfg.fixCommand + ' — и закоммитить ' + cfg.output + ' отдельным коммитом.');
  return 1;
}

function build(cfg, root) {
  assertFullHistory(root);
  const measured = measureHistory(cfg, root);
  assertMatchesDisk(measured.state, cfg, root);
  if (measured.mixed.length > 0) {
    console.error('! таблицу обновляли вместе с кодом: ' + measured.mixed.join(', ')
      + ' — так строка коммита не может попасть в сам коммит; обновляйте таблицу отдельным коммитом.');
  }
  return measured;
}

/* Запись вывода, у которого может не быть каталога: `--page .size-report/report.html`
 * в свежем проекте — обычный запуск, а не ошибка пользователя. */
function writeFileEnsured(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function writeMode(cfg, root) {
  const { rows, skipped, state } = build(cfg, root);
  const html = render(rows, cfg);
  writeFileEnsured(path.join(root, cfg.output), html);
  console.log('✓ ' + cfg.output + ': ' + rows.length + ' строк × ' + cfg.columns.length + ' файлов, '
    + kmb(byteLen(html)) + ' (пропущено без строки: ' + skipped.length + ' — '
    + skipped.join(', ') + ')');
  console.log('  состояние на HEAD: ' + cfg.columns.map((c, i) => c.label + ' '
    + (state[i] === null ? '—' : cfg.metrics.map((m) => state[i].cells[m]).join('/'))).join(', '));
  return 0;
}

function checkMode(cfg, root) {
  const { rows } = build(cfg, root);
  const html = render(rows, cfg);
  const code = check(cfg, html, root);
  if (code === 0) {
    console.log('✓ таблица размеров: ' + rows.length + ' коммитов × ' + cfg.columns.length + ' файлов '
      + 'совпадает с историей (' + cfg.output + ', ' + kmb(byteLen(html)) + ')');
  }
  return code;
}

/* Данные контракта в stdout — для страницы и для агента: та же правда, что в
 * артефакте, но без вёрстки и без производных величин. Прежняя форма `--json`
 * остаётся нетронутой: она заморожена эталоном паритета (fixtures/parity). */
function dataMode(cfg, root) {
  process.stdout.write(JSON.stringify(reportData(cfg, root), null, 2) + '\n');
  return 0;
}

/* Страница отчёта: собирается тем же проходом по истории, что и артефакт — иначе
 * два отчёта могли бы показывать разные числа. Файл кладётся рядом с таблицей,
 * потому что он из неё и растёт. */
const PAGE_NAME = 'size-report.html';

function pageMode(cfg, root, file) {
  const data = reportData(cfg, root);
  const target = file ? path.resolve(file) : path.join(root, path.dirname(cfg.output), PAGE_NAME);
  const html = pageHtml(data, cfg);
  writeFileEnsured(target, html);
  console.log('✓ ' + path.relative(root, target) + ': ' + data.rows.length + ' строк × '
    + data.files.length + ' файлов, ' + kmb(byteLen(html)));
  return 0;
}

function jsonMode(cfg, root) {
  const { rows, skipped } = build(cfg, root);
  process.stdout.write(JSON.stringify({
    columns: cfg.columns.map((c) => ({ label: c.label, paths: c.paths })),
    metrics: cfg.metrics,
    rows: rows.map((r) => ({
      sha: r.sha, when: r.when, subject: r.subject,
      section: r.section === null ? null : { id: r.section.id, head: r.section.head, added: r.section.added },
      cells: r.cells,
      totals: totalsOf(r.cells, cfg.metrics)
    })),
    skipped: skipped
  }, null, 2) + '\n');
  return 0;
}

/* Черновик конфига для нового проекта: колонки — по расширениям, которые в
 * проекте реально есть (крупнейшие по объёму), журнал — по знакомым именам,
 * output — рядом с доками. Дальше конфиг правят глазами: угадать, какие файлы
 * важны, инструмент не может. */
const INIT_EXTS = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.scss', '.json', '.py', '.rb', '.go', '.rs', '.sh'];
const INIT_JOURNALS = ['WORKLOG.md', 'CHANGELOG.md', 'CHANGES.md', 'HISTORY.md'];
const INIT_SKIP_NAMES = [/package-lock\.json$/, /\.min\./, /\.map$/, /yarn\.lock$/, /composer\.lock$/];

/* `skip` — пути, которые колонками быть не могут (файл самой таблицы: его размер
 * зависит от числа строк, то есть от самого себя). */
function sniffColumns(root, limit, skip) {
  const listed = git(root, ['ls-files', '-s']).split('\n').filter((l) => l !== '');
  const sizes = new Map();
  const shas = listed.map((l) => l.split(/\s+/)[1]);
  if (shas.length > 0) {
    const checked = execFileSync('git', gitArgv(['cat-file', '--batch-check=%(objectname)\t%(objectsize)']), {
      cwd: root, encoding: 'utf8', input: shas.join('\n') + '\n', maxBuffer: MAX_BUF, env: gitEnv()
    });
    checked.split('\n').forEach((l) => {
      const [sha, size] = l.split('\t');
      sizes.set(sha, Number(size));
    });
  }
  const byExt = new Map();
  const skipped = skip || [];
  listed.forEach((line) => {
    const f = line.split('\t')[1];
    if (skipped.indexOf(f) >= 0) return;
    if (INIT_SKIP_NAMES.some((re) => re.test(f))) return;
    const ext = path.extname(f).toLowerCase();
    if (INIT_EXTS.indexOf(ext) < 0) return;
    const size = sizes.get(line.split(/\s+/)[1]) || 0;
    if (size > 512 * 1024) return; // собранный или сгенерированный файл, а не исходник
    const group = byExt.get(ext) || { ext: ext, bytes: 0, files: [] };
    group.bytes += size;
    group.files.push({ p: f, size: size });
    byExt.set(ext, group);
  });
  const groups = [...byExt.values()].sort((a, b) => b.bytes - a.bytes);
  const columns = [];
  groups.forEach((g) => {
    g.files.sort((a, b) => b.size - a.size).slice(0, limit).forEach((f) => {
      columns.push({ label: path.basename(f.p), paths: [f.p] });
    });
  });
  return { columns: columns.slice(0, limit), exts: groups.map((g) => g.ext), total: byExt.size };
}

function initMode(root, file, force) {
  const target = file ? path.resolve(root, file) : path.join(root, CONFIG_NAME);
  if (fs.existsSync(target) && !force) {
    refuse(EXIT.CONFIG, 'конфиг уже есть: ' + target + '\n  починка: правьте его или перезапишите черновиком: '
      + cliCommand('--init --force'));
  }
  const journalPath = INIT_JOURNALS.find((p) => fs.existsSync(path.join(root, p))) || '';
  const outDir = fs.existsSync(path.join(root, 'docs')) ? 'docs/' : '';
  const sniffed = sniffColumns(root, 12, [outDir + 'size-table.html']);
  if (sniffed.columns.length === 0) {
    console.error('✗ не нашлось файлов с известными расширениями (' + INIT_EXTS.join(' ') + ')\n'
      + '  впишите колонки в конфиг руками');
  }
  // Подпись артефакта цитирует команду починки, поэтому в проекте без
  // package.json она должна указывать на саму команду: иначе таблица ссылалась
  // бы на npm-скрипт, которого там нет.
  const hasPkg = fs.existsSync(path.join(root, 'package.json'));
  // Менеджер пакетов — по lock-файлу, а не предположением: подпись артефакта
  // цитирует команду починки, и она обязана существовать в чужом проекте.
  const manager = fs.existsSync(path.join(root, 'pnpm-lock.yaml')) ? 'pnpm'
    : fs.existsSync(path.join(root, 'yarn.lock')) ? 'yarn' : 'npm';
  const cfg = {
    output: outDir + 'size-table.html',
    locale: 'ru',
    title: 'Объём файлов по коммитам',
    heading: 'Объём файлов по коммитам',
    fixCommand: hasPkg ? manager + ' run sizes' : 'npx size-report --write',
    metrics: ['raw', 'min'],
    columns: sniffed.columns,
    journal: journalPath
      ? { path: journalPath, url: '../' + journalPath, pattern: '^## (?<id>\\S+)\\s+(?<title>.+?)\\s*$', anchor: 'heading' }
      : null,
    links: { commitUrl: '' },
    rows: { merges: true, sha: true },
    skip: []
  };
  // Черновик обязан проходить ту же проверку, которой его встретит первый запуск:
  // иначе отказ из подсказки приводит в новый тупик. Проект без знакомых
  // расширений — исключение: колонок нет вовсе, и черновик правят руками.
  if (cfg.columns.length > 0) validateConfig(Object.assign({}, cfg, { path: target }));
  writeFileEnsured(target, JSON.stringify(cfg, null, 2) + '\n');
  console.log('✓ черновик конфига: ' + path.relative(root, target));
  console.log('  расширения в проекте: ' + (sniffed.exts.join(' ') || '—'));
  console.log('  колонок: ' + sniffed.columns.length + ' (крупнейшие файлы по расширениям)');
  console.log('  журнал: ' + (journalPath || 'не найден — ссылки строк будут без разделов'));
  console.log('  дальше: 1) поправьте колонки и метрики — какие файлы важны, знает только проект');
  console.log('          2) ' + (hasPkg
    ? 'добавьте в package.json: "sizes": "size --write", "test:sizes": "size"'
    : 'запуск: ' + cfg.fixCommand + ' (проверка — без --write)'));
  console.log('          3) ' + (hasPkg ? 'добавьте ' + manager + ' run test:sizes в CI' : 'добавьте проверку в CI')
    + '; сами проверки едут вместе с пакетом');
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) {
    process.stdout.write(USAGE);
    return EXIT.OK;
  }
  try {
    const root = gitRoot();
    if (args.indexOf('--init') >= 0) return initMode(root, argValue(args, '--init'), args.indexOf('--force') >= 0);
    const cfg = loadConfig(argValue(args, '--config') ? path.resolve(argValue(args, '--config')) : path.join(root, CONFIG_NAME));
    if (args.indexOf('--json') >= 0) return jsonMode(cfg, root);
    if (args.indexOf('--data') >= 0) return dataMode(cfg, root);
    if (args.indexOf('--page') >= 0) return pageMode(cfg, root, argValue(args, '--page'));
    if (args.indexOf('--write') >= 0) return writeMode(cfg, root);
    return checkMode(cfg, root);
  } catch (e) {
    if (e instanceof Refusal) {
      console.error('✗ ' + e.message);
      return e.code;
    }
    // Непредвиденное — это дефект инструмента, а не тупик пользователя: стек здесь
    // нужен целиком, иначе такой отказ нечем разбирать.
    console.error('✗ внутренняя ошибка: ' + e.stack);
    return EXIT.INTERNAL;
  }
}

/* Наружу отдаём и механику, и то, что от неё можно проверить отдельно
 * (`test/` пакета): стрипперы на образцах, разбор журнала, якоря,
 * реестр метрик и рендер на синтетических строках. `main` — для точки входа
 * `bin/size.js`: сам движок при импорте ничего не запускает. */
export {
  EXIT, USAGE, Refusal, refuse, cliCommand,
  CONFIG_NAME, DEFAULT_CONFIG, LOCALES, METRICS, STRATEGIES,
  loadConfig, validateConfig, argValue,
  gitRoot, readHistory, blobAt, readBlobs, measureBlob, assertFullHistory,
  stripJs, stripHtml, stripCss, stripLines, compactJson, minifyForm, strategyFor,
  parseSections, touchedSection, anchor, sectionLink, rowHref,
  CATEGORY_EXTS, CATEGORY_ORDER, categoryOf,
  reportData, dataMode, pageMode, pageHtml, APP_MATH, APP_DOM,
  measureHistory, totalsOf, render, noteText, initMode, sniffColumns,
  group, check, main
};

import fs from 'fs';
import { execFileSync } from 'child_process';
import { MAX_BUF, gitArgv, gitEnv } from './git.js';
import { cliCommand, refuseCause } from './refusal.js';
import { LOCALES } from './locales.js';
import { METRICS, MINIFY_ENGINES } from './metrics.js';
import { TOKEN_DEFAULTS, TOKEN_FAMILIES } from './tokens.js';
import { CATEGORY_ORDER } from './data.js';

/* Настройки проекта-потребителя: значения по умолчанию, чтение и проверка.
 * Настройки описывают проект, а не механику, поэтому проверка стоит здесь же и
 * без неё не идёт ни один режим. */

export const CONFIG_NAME = 'size-table.config.json';

export const DEFAULT_CONFIG = {
  output: 'size-table.html',
  locale: 'ru',
  title: '',          // по умолчанию — заголовок из локали
  heading: '',
  fixCommand: 'npx size-report --write',
  metrics: ['raw', 'min'],
  columns: [],
  // `engine` — чем считается метрика `min`: снятием балласта (умолчание, под ним
  // сняты замороженные эталоны) или настоящим сжатием минификатором.
  minify: { engine: 'strip', ext: {}, guard: ['.js', '.mjs', '.cjs'] },
  // Токены: каким словарём считать. Семейство — про модели, кодировка — про число.
  tokens: Object.assign({}, TOKEN_DEFAULTS),
  // Автоматика хука: хук ставится только явной командой (`install-hook`), а этот
  // ключ — её выключатель (`.size-report/…` не нужен: снятие хука возвращает
  // проект к прежнему поведению).
  hooks: { enabled: true },
  journal: null,
  links: { commitUrl: '' },
  // Слияние — обычный коммит: у него есть правки разрешения конфликта, и без
  // строки они не попали бы в сумму дельт над текущим размером.
  rows: { merges: true, sha: true },
  skip: []
};

export function argValue(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const v = args[i + 1];
  return v === undefined || v.indexOf('--') === 0 ? '' : v;
}

export function gitRoot() {
  try {
    return execFileSync('git', gitArgv(['rev-parse', '--show-toplevel']), {
      encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv()
    }).trim();
  } catch (_e) {
    refuseCause('не git-репозиторий', 'не git-репозиторий (или git недоступен): таблица собирается по истории git.\n'
      + '  запустите команду из каталога проекта; если истории ещё нет — создайте её: git init');
  }
}

/* Настройки читаются как есть и досыпаются значениями по умолчанию: у проекта,
 * который только подключил генератор, конфиг может быть в три строки. */
export function loadConfig(file) {
  if (!fs.existsSync(file)) {
    refuseCause('нет файла настроек', 'нет файла настроек ' + file
      + '\n  создайте его: ' + cliCommand('--init'));
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    refuseCause('настройки не разобраны', 'не разобран ' + file + ': ' + e.message
      + '\n  починка: правьте ' + file + '; образец настроек даёт ' + cliCommand('--init') + ' в пустом каталоге');
  }
  const cfg = Object.assign({}, DEFAULT_CONFIG, raw);
  cfg.minify = Object.assign({}, DEFAULT_CONFIG.minify, raw.minify);
  cfg.tokens = Object.assign({}, DEFAULT_CONFIG.tokens, raw.tokens);
  cfg.hooks = Object.assign({}, DEFAULT_CONFIG.hooks, raw.hooks);
  cfg.links = Object.assign({}, DEFAULT_CONFIG.links, raw.links);
  cfg.rows = Object.assign({}, DEFAULT_CONFIG.rows, raw.rows);
  cfg.path = file;
  validateConfig(cfg);
  return cfg;
}

export function validateConfig(cfg) {
  const fail = (msg) => refuseCause('настройки неверны',
    'конфиг ' + cfg.path + ': ' + msg + '\n  починка: правьте ' + cfg.path);
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
  if (MINIFY_ENGINES.indexOf(cfg.minify.engine) < 0) {
    fail('неизвестный способ минификации «' + cfg.minify.engine + '» (есть: ' + MINIFY_ENGINES.join(', ') + ')');
  }
  const family = TOKEN_FAMILIES[cfg.tokens.family];
  if (family === undefined) {
    fail('неизвестное семейство токенизатора «' + cfg.tokens.family + '» (есть: '
      + Object.keys(TOKEN_FAMILIES).join(', ') + ')');
  }
  if (family.encodings.indexOf(cfg.tokens.encoding) < 0) {
    fail('неизвестная кодировка токенизатора «' + cfg.tokens.encoding + '» у семейства '
      + cfg.tokens.family + ' (есть: ' + family.encodings.join(', ') + ')');
  }
  if (!LOCALES[cfg.locale]) fail('неизвестная локаль «' + cfg.locale + '» (есть: ' + Object.keys(LOCALES).join(', ') + ')');
  // Выключатель хука — «да/нет», а не «правда/ложь»: `false` от случайной строки
  // отличать обязан инструмент, иначе выключенная автоматика осталась бы включённой.
  if (typeof cfg.hooks.enabled !== 'boolean') {
    fail('hooks.enabled — не «да/нет»: ' + JSON.stringify(cfg.hooks.enabled));
  }
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

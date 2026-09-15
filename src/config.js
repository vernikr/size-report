import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { MAX_BUF, gitArgv, gitEnv } from './git.js';
import { advicePath, cliCommand, invocation, refuseCause } from './refusal.js';
import { LOCALES } from './locales.js';
import { METRICS, MINIFY_ENGINES } from './metrics.js';
import { TOKEN_DEFAULTS, TOKEN_FAMILIES } from './tokens.js';
import { CATEGORY_ORDER } from './data.js';
import { projectConfig } from './project.js';

/* Настройки проекта-потребителя: значения по умолчанию, чтение и проверка.
 * Настройки описывают проект, а не механику, поэтому проверка стоит здесь же и
 * без неё не идёт ни один режим. */

export const CONFIG_NAME = 'size-table.config.json';

export const DEFAULT_CONFIG = {
  output: 'size-report.html',
  locale: 'ru',
  title: '',          // по умолчанию — заголовок из локали
  heading: '',
  // Починка — зов, который не может уйти в реестр: путь внутри проекта. Имя
  // пакета здесь не годится (`npx <имя>` в проекте без пакета — чужой код).
  fixCommand: invocation() + ' --write',
  metrics: ['raw', 'min'],
  columns: [],
  // `engine` — чем считается метрика `min`: снятием балласта (умолчание, под ним
  // сняты замороженные эталоны) или настоящим сжатием минификатором.
  minify: { engine: 'strip', ext: {}, guard: ['.js', '.mjs', '.cjs'] },
  // Токены: каким словарём считать. Семейство — про модели, кодировка — про число.
  tokens: Object.assign({}, TOKEN_DEFAULTS),
  // Автоматика хука: хук обновляет отчёт после каждого коммита и ставится сам —
  // после установки пакета (`bin/postinstall.js`) и при первом запуске в проекте
  // (`src/hook.js`); этот ключ — её выключатель (`.size-report/…` не нужен: снятие
  // хука возвращает проект к прежнему поведению).
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
  } catch (e) {
    // Два тупика с разной починкой — «git не запустился» и «репозитория здесь нет»,
    // — и расходятся они по тому, что сказал сам git, а не по догадке: ENOENT
    // значит, что не нашлась программа. Один текст на оба случая («не git-репозиторий
    // или git недоступен») не называл ни одного из них.
    if (e.code === 'ENOENT') {
      refuseCause('нет git', 'git не запустился: его нет в PATH (таблица собирается по его'
        + ' истории, а смотрю я в ' + process.cwd() + ').\n'
        + '  починка: поставьте git (https://git-scm.com) и повторите команду');
    }
    refuseCause('не git-репозиторий', 'git не видит здесь репозитория: таблица собирается по его'
      + ' истории (сейчас смотрю в ' + process.cwd() + ').\n'
      + '  смотрите: запущена ли команда из каталога проекта\n'
      + '  починка: если истории ещё нет — создайте её: git init');
  }
}

/* Настроек нет — их выводит сам проект (`src/project.js`), и работа начинается сразу:
 * заводить файл ради первого запуска незачем, а `--init` закрепляет выведенное
 * файлом, когда его хотят править. Так бывает только с умолчательным именем: файл,
 * названный ключом `--config`, — это уже запрос про конкретный файл, и его
 * отсутствие остаётся отказом (иначе опечатка в пути молча дала бы чужие настройки).
 * `path` назван словами, а не путём: файла нет, и текст «правьте <путь>» привёл бы
 * человека к тому, чего в проекте не лежит. */
export function derivedConfig(root) {
  const cfg = derivedProfile(root);
  cfg.path = 'настройки, выведенные из проекта';
  cfg.derived = true;
  validateConfig(cfg);
  return cfg;
}

/* Выведенное из проекта + умолчания — то, чем проект работает без файла, и то,
 * что закрепляет `--init`. Одно место на две роли (иначе «файл» и «работа без
 * файла» разошлись бы колонкой или числом), а сам вывод (`src/project.js`) о
 * умолчаниях не знает: он говорит только то, что видит в проекте. */
export function derivedProfile(root) {
  return withDefaults(projectConfig(root));
}

/* Настройки поверх умолчаний — одним местом на два источника (файл и проект):
 * вложенное досыпается по ключам, потому что `minify: {engine: …}` не значит «у
 * `minify` больше нет других полей», а значило бы, что снятие балласта потеряло
 * список расширений. */
function withDefaults(raw) {
  const cfg = Object.assign({}, DEFAULT_CONFIG, raw);
  ['minify', 'tokens', 'hooks', 'links', 'rows'].forEach((key) => {
    cfg[key] = Object.assign({}, DEFAULT_CONFIG[key], raw[key]);
  });
  return cfg;
}

/* Настройки читаются как есть и досыпаются значениями по умолчанию: у проекта,
 * который только подключил генератор, конфиг может быть в три строки. */
export function loadConfig(file, root) {
  if (!fs.existsSync(file)) {
    // Совет называет тот же файл, о котором шла речь: `--init` без файла записал бы
    // черновик под умолчательным именем в корне проекта — то есть починил бы не то,
    // о чём спросили. Имя не называем ровно тогда, когда оно и так умолчательное.
    const dflt = root !== undefined && path.resolve(root, CONFIG_NAME) === path.resolve(file);
    if (dflt) return derivedConfig(root);
    refuseCause('нет файла настроек', 'нет файла настроек ' + file
      + '\n  создайте его: ' + cliCommand('--init ' + advicePath(file))
      + '\n  смотрите: без «--config» настройки не нужны — они выводятся из проекта');
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    refuseCause('настройки не разобраны', 'не разобран ' + file + ': ' + e.message
      + '\n  починка: правьте ' + file + '; образец настроек даёт ' + cliCommand('--init') + ' в пустом каталоге');
  }
  const cfg = withDefaults(raw);
  cfg.path = file;
  validateConfig(cfg);
  return cfg;
}

/* Колонки: метка и пути — имена, а не что попало: путь числом или объектом молча не
 * совпадает ни с чем, и колонка отчитывается нулём строк за успех. Отказ обязан
 * случиться здесь, а не превратиться в пустой отчёт. */
function checkColumns(cfg, fail) {
  if (!cfg.columns || cfg.columns.length === 0) fail('не задано ни одной колонки (columns)');
  const labels = new Set();
  cfg.columns.forEach((c, i) => {
    const pathsAreNames = c && Array.isArray(c.paths)
      && c.paths.length > 0 && c.paths.every((p) => typeof p === 'string' && p !== '');
    if (!c || typeof c.label !== 'string' || c.label === '' || !pathsAreNames) {
      fail('колонка №' + (i + 1) + ' должна быть {label, paths: [...]} из непустых строк: '
        + JSON.stringify(c).slice(0, 90) + '\n  смотрите: черновик с готовыми колонками даёт '
        + cliCommand('--init <файл>'));
    }
    if (labels.has(c.label)) fail('метка колонки «' + c.label + '» повторяется');
    if (c.category !== undefined && CATEGORY_ORDER.indexOf(c.category) < 0) {
      fail('категория «' + c.category + '» у колонки «' + c.label + '» неизвестна: '
        + CATEGORY_ORDER.join(', '));
    }
    labels.add(c.label);
  });
}

function checkMetrics(cfg, fail) {
  if (!Array.isArray(cfg.metrics) || cfg.metrics.length === 0) fail('не заданы метрики (metrics)');
  cfg.metrics.forEach((m) => {
    if (!METRICS[m]) fail('неизвестная метрика «' + m + '» (есть: ' + Object.keys(METRICS).join(', ') + ')');
  });
}

function checkMinify(cfg, fail) {
  if (MINIFY_ENGINES.indexOf(cfg.minify.engine) < 0) {
    fail('неизвестный способ минификации «' + cfg.minify.engine + '» (есть: ' + MINIFY_ENGINES.join(', ') + ')');
  }
}

function checkTokens(cfg, fail) {
  const family = TOKEN_FAMILIES[cfg.tokens.family];
  if (family === undefined) {
    fail('неизвестное семейство токенизатора «' + cfg.tokens.family + '» (есть: '
      + Object.keys(TOKEN_FAMILIES).join(', ') + ')');
  }
  if (family.encodings.indexOf(cfg.tokens.encoding) < 0) {
    fail('неизвестная кодировка токенизатора «' + cfg.tokens.encoding + '» у семейства '
      + cfg.tokens.family + ' (есть: ' + family.encodings.join(', ') + ')');
  }
}

/* Файл таблицы не может быть её колонкой: размер артефакта зависит от числа строк,
 * то есть от самого себя. */
function checkOutput(cfg, fail) {
  cfg.columns.forEach((c) => {
    if (c.paths.indexOf(cfg.output) >= 0) fail('файл таблицы (' + cfg.output + ') не может быть колонкой');
  });
  if (!cfg.output) fail('не задан output');
}

function checkJournal(cfg, fail) {
  if (!cfg.journal) return;
  if (!cfg.journal.path) fail('journal.path не задан');
  if (!cfg.journal.pattern) fail('journal.pattern не задан');
  try { new RegExp(cfg.journal.pattern); } catch (e) { fail('journal.pattern не компилируется: ' + e.message); }
}

/* Что настройки говорят про путь: `columns` — его отслеживает колонка, `excluded` — он
 * объявлен исключением (`skip` и сам файл отчёта), `outside` — мимо того и другого.
 * Суждение одно на два ответа: `check` спрашивает его про всю историю, `explain` — про
 * один коммит. Знакомство считается по колонкам целиком, а не по метке: у колонки путей
 * может быть несколько (переименование), и любой из них — она сама. */
export function pathRoles(cfg) {
  const tracked = new Set();
  cfg.columns.forEach((col) => col.paths.forEach((p) => tracked.add(p)));
  const excluded = new Set([cfg.output].concat(cfg.skip || []));
  return (file) => {
    if (tracked.has(file)) return 'columns';
    return excluded.has(file) ? 'excluded' : 'outside';
  };
}

/* Починка «мимо колонок» — один текст на два ответа, и он называет пути: команда без
 * имён не команда. Текст собирается из имён, а не приписывает их по ветке, поэтому и
 * предусматривать тут нечего: коммит без файлов вовсе починки не получает — на пустом
 * списке её не зовут (см. `fixFor` в `src/explain.js`). */
export function outsideFix(paths) {
  return 'допишите эти пути колонкой или в «skip» файла ' + CONFIG_NAME + ': ' + paths.join(', ');
}

export function validateConfig(cfg) {
  const fail = (msg) => refuseCause('настройки неверны',
    'конфиг ' + cfg.path + ': ' + msg + '\n  починка: правьте ' + cfg.path);
  checkColumns(cfg, fail);
  checkMetrics(cfg, fail);
  checkMinify(cfg, fail);
  checkTokens(cfg, fail);
  if (!LOCALES[cfg.locale]) fail('неизвестная локаль «' + cfg.locale + '» (есть: ' + Object.keys(LOCALES).join(', ') + ')');
  // Выключатель хука — «да/нет», а не «правда/ложь»: `false` от случайной строки
  // отличать обязан инструмент, иначе выключенная автоматика осталась бы включённой.
  if (typeof cfg.hooks.enabled !== 'boolean') {
    fail('hooks.enabled — не «да/нет»: ' + JSON.stringify(cfg.hooks.enabled));
  }
  checkOutput(cfg, fail);
  checkJournal(cfg, fail);
}

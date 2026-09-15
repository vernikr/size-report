import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { MAX_BUF, git, gitArgv, gitEnv, gitTry, readHistory } from './git.js';
import { cliCommand, invocation } from './refusal.js';

/* Настройки, выведенные из самого проекта: что считать, где журнал, куда писать и
 * что колонкой быть не может.
 *
 * Зачем отдельно от `src/config.js`. Тот читает **готовые** настройки и только
 * затем их проверяет, а этот смотрит на проект впервые и почти всё о нём
 * догадывается — та же работа, что была у черновика (`--init`). Отсюда две роли
 * одного вывода: без файла настроек он и есть настройки (проект работает сразу,
 * ничего не заводив), а с `--init` он же ложится файлом, который дальше правят.
 * Второго вывода «как угадать проект» в пакете нет.
 *
 * Два правила, из которых выведено всё остальное.
 *
 * **Колонка — это файл.** Состояние движка хранит на колонку один путь, а список
 * путей колонки — её переименования (в ревизии берётся тот, который в ней есть).
 * Поэтому «папка целиком» колонкой быть не может, и профиль выбирает файлы, а не
 * группы путей.
 *
 * **Профиль обязан проходить ту же проверку, которой его встретит первый запуск**
 * (BLOCKERS §N2, REFACTOR R-0.4): путь, не ставший колонкой и не объявленный
 * исключением, — это код 1 на первом же прогоне. Поэтому `skip` называет и то,
 * что колонкой быть не может (сам отчёт, замки зависимостей, карты, собранное), и
 * то, что в колонки не поместилось: так первый `check` зелёный, а что не попало в
 * отчёт — сказано в файле, а не умолчано.
 */

/* Что вообще берётся колонкой: текстовые формы, с которыми движок умеет работать.
 * Файл без знакомого расширения (`LICENSE`, `.gitignore`) колонкой не становится и
 * называется исключением. */
const KNOWN_EXTS = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.scss',
  '.json', '.yaml', '.yml', '.toml', '.md', '.txt', '.py', '.rb', '.go', '.rs', '.sh'];

const JOURNALS = ['WORKLOG.md', 'CHANGELOG.md', 'CHANGES.md', 'HISTORY.md'];

/* Порог по размеру — предохранитель: очень крупный файл в истории обычно собран или
 * сгенерирован, и в отчёте он перевесил бы весь проект. */
const MAX_BYTES = 512 * 1024;

/* Сколько файлов идут колонками: отчёт читают глазами, а сотня колонок читается
 * хуже, чем скачок. Остальное остаётся на виду — в `skip`, откуда его берут
 * колонкой, когда оно важно. */
const COLUMN_LIMIT = 12;

/* Индекс — путь и размер: `ls-files -s` даёт объекты, размер спрашивается у них
 * одной пачкой (`cat-file --batch-check`), а не чтением содержимого. */
function indexFiles(root) {
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
  return listed.map((line) => ({ p: line.split('\t')[1], size: sizes.get(line.split(/\s+/)[1]) || 0 }));
}

/* История — объединение путей всех коммитов, тем же чтением, которым пользуется
 * полнота (`readHistory`): иначе профиль и `check` считали бы разные истории. Файл,
 * живущий только в истории, в отчёте просто пуст на HEAD — это не потеря, а факт, и
 * колонкой (или исключением) он быть обязан. */
function historyPaths(root) {
  const seen = new Set();
  try {
    readHistory(root).forEach((c) => c.files.forEach((f) => seen.add(f)));
  } catch (e) {
    // У репозитория без коммитов истории нет вовсе: `git log` там отказывает, и
    // это состояние проекта, а не дефект инструмента — `--init` обязан работать и
    // в нём (первый запуск бывает и до первого коммита).
    if (/does not have any commits/.test(String(e.stderr))) return seen;
    throw e;
  }
  return seen;
}

// Дерево и история — одним списком: колонкой становится всё, что тронула история.
function allPaths(root) {
  const files = indexFiles(root);
  const known = new Set(files.map((f) => f.p));
  historyPaths(root).forEach((p) => {
    if (!known.has(p)) files.push({ p: p, size: 0 });
  });
  return files;
}

// Наличие каталога решает, куда ляжет отчёт: рядом с доками или в корне.
function exists(root, p) {
  return fs.existsSync(path.join(root, p));
}

/* Куда ложится отчёт — одно на пакет: `docs/size-report.html`, и каталог создаётся
 * сам. Прежняя развилка («в доки, если они есть, иначе в корень») убрана по замеру:
 * в свежем проекте каталога `docs` ещё нет, и отчёт оказывался в корне — то есть
 * ни в том месте, где его ищут, ни в том, куда его хочет положить человек,
 * который ставит пакет ради отчёта. Каталог здесь не признак проекта, а часть
 * адреса; создавать его — работа того, кто пишет файл (`writeFileEnsured`). */
function outputOf() {
  return 'docs/size-report.html';
}

/* Менеджер пакетов — по lock-файлу, а не догадкой: команда обязана существовать
 * в чужом проекте. Один на два места (команду починки и подсказку `--init`). */
export function packageManager(root) {
  if (exists(root, 'pnpm-lock.yaml')) return 'pnpm';
  return exists(root, 'yarn.lock') ? 'yarn' : 'npm';
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_e) {
    return null;
  }
}

/* Подпись артефакта и отказы цитируют эту команду, поэтому она обязана работать
 * здесь и сейчас: свой скрипт — только если он объявлен (иначе `npm run sizes`
 * отвечает «нет такого скрипта», а совет, который не работает, — худшая подсказка),
 * иначе — установленный пакет внутри проекта. Имени пакета в команде нет намеренно:
 * `npx <имя>` без установленного пакета уходит в реестр и запускает чужой код
 * (REFACTOR R-4.21). */
function fixCommandOf(root) {
  const pkg = readJson(path.join(root, 'package.json')) || {};
  const script = pkg.scripts === undefined ? '' : pkg.scripts.sizes;
  if (typeof script !== 'string' || script === '') return invocation() + ' --write';
  return packageManager(root) + ' run sizes';
}

/* Ссылка на коммит — из адреса origin: два хозяина собирают её одним правилом из
 * владельца и пути к репозиторию (у GitLab в пути бывают подгруппы, поэтому путь
 * берётся целиком), а всякий третий хозяин — догадка, которая ведёт не туда.
 * Remote нет или он не тот — ссылок нет: пустой шаблон строка просто не несёт. */
const REMOTE_RE = /^\S+?(?:@|\/\/)(?:[^@/]*@)?(github\.com|gitlab\.com)[/:]+((?:[^/\s]+\/)*[^/\s]+?)(?:\.git)?$/;

function commitUrlOf(root) {
  const m = gitTry(root, ['remote', 'get-url', 'origin']).stdout.trim().match(REMOTE_RE);
  if (m === null) return '';
  const shape = m[1] === 'github.com' ? '/commit/{sha}' : '/-/commit/{sha}';
  return 'https://' + m[1] + '/' + m[2] + shape;
}

function journalOf(root) {
  return JOURNALS.find((p) => exists(root, p)) || '';
}

/* Колонкой не становится: сам отчёт (его размер зависит от числа строк, то есть от
 * себя), замки зависимостей (их размер — про чужие пакеты), карты и собранное (их
 * сделала сборка, а не человек) и всё, чего движок не умеет читать. */
function generated(p, output) {
  const ext = path.extname(p).toLowerCase();
  return p === output || KNOWN_EXTS.indexOf(ext) < 0
    || /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|npm-shrinkwrap\.json|yarn\.lock|composer\.lock|bun\.lockb)$/.test(p)
    || /\.min\./.test(p) || /\.map$/.test(p);
}

/* Метка колонки — имя файла; совпадение имён в разных папках разводится путём, а
 * если и путь занят — числом. Повтор метки проверка настроек не пропустит. */
function labelFor(used, p) {
  const candidates = [path.basename(p), p];
  const free = candidates.find((name) => used.indexOf(name) < 0);
  if (free !== undefined) return free;
  let n = 2;
  while (used.indexOf(p + ' (' + n + ')') >= 0) n++;
  return p + ' (' + n + ')';
}

/* Выбор колонок: по кругу от каждого расширения берётся его крупнейший файл — иначе
 * в отчёте оказались бы одни крупные `.md`, и ни один `.js` не попал бы под
 * настоящее сжатие (первый отчёт нового проекта обязан быть точным, а не
 * приближённым). Порядок круга — по весу расширения: сперва то, чего в проекте
 * больше всего. */
function columnsOf(files, journal) {
  const byExt = new Map();
  files.forEach((f) => {
    const ext = path.extname(f.p).toLowerCase();
    const list = byExt.get(ext) || [];
    list.push(f);
    byExt.set(ext, list);
  });
  const rings = [...byExt.values()].map((list) => list.sort((a, b) => b.size - a.size));
  const used = [];
  const columns = [];
  const take = (p) => {
    columns.push({ label: labelFor(used, p), paths: [p] });
    used.push(columns[columns.length - 1].label);
  };
  if (journal !== '' && files.some((f) => f.p === journal)) take(journal);
  for (let round = 0; columns.length < COLUMN_LIMIT; round++) {
    const before = columns.length;
    rings.forEach((ring) => {
      const f = ring[round];
      if (f !== undefined && columns.length < COLUMN_LIMIT && f.p !== journal) take(f.p);
    });
    if (columns.length === before) break;
  }
  return columns;
}

export function projectConfig(root) {
  const output = outputOf(root);
  const journal = journalOf(root);
  const files = allPaths(root);
  const readable = files.filter((f) => !generated(f.p, output) && f.size <= MAX_BYTES);
  const columns = columnsOf(readable, journal);
  const taken = new Set(columns.reduce((all, c) => all.concat(c.paths), []));
  // Язык, заголовок, порядок строк и выключатель хука не выводятся ни из чего:
  // они берутся из умолчаний (`DEFAULT_CONFIG`), а не выдаются за вывод из проекта.
  return {
    output: output,
    fixCommand: fixCommandOf(root),
    metrics: ['raw', 'min', 'tok'],
    // Настоящее сжатие и настоящий словарь, а не приближения: новый проект не должен
    // начинать с чисел, которые честны наполовину. Без необязательной зависимости
    // метрика отступает к другому счёту и прогон возвращает код 4 — это сказано
    // подписью метрики, а не умолчанием.
    minify: { engine: 'esbuild' },
    tokens: { family: 'openai', encoding: 'o200k_base' },
    columns: columns,
    journal: journal === '' ? null : {
      path: journal,
      url: (path.dirname(output) === '.' ? '' : '../') + journal,
      pattern: '^## (?<id>\\S+)\\s+(?<title>.+?)\\s*$',
      anchor: 'heading'
    },
    links: { commitUrl: commitUrlOf(root) },
    // Исключения — всё, что колонкой не стало: и то, что ею быть не может, и то, что
    // в отчёт не поместилось. Так первый запуск полон, а непоместившееся названо.
    skip: [output].concat(files.filter((f) => !taken.has(f.p)).map((f) => f.p))
      .filter((p, i, all) => all.indexOf(p) === i)
  };
}

/* Имя черновика (`sniffColumns`) осталось публичным: на него опираются те, кто звал
 * вывод колонок (`test/api.test.js` держит список имён), и форма ответа та же —
 * колонки, знакомые расширения проекта и сколько путей всего. */
export function sniffColumns(root) {
  const files = allPaths(root);
  const exts = [...new Set(files.map((f) => path.extname(f.p).toLowerCase()))]
    .filter((e) => KNOWN_EXTS.indexOf(e) >= 0).sort();
  return { columns: projectConfig(root).columns, exts: exts, total: files.length };
}

/* Что сказать человеку, когда настроек нет и работать пришлось на выведенных: одна
 * строка про то, что вышло, и одна — про то, чем это закрепить. Текст — тем же
 * списком, что и находка `doctor`: два ответа об одном не должны разойтись словами. */
export function derivedSummary(cfg) {
  const labels = cfg.columns.map((c) => c.label);
  return 'настройки выведены из проекта (файла нет): колонок ' + cfg.columns.length
    + ' (' + labels.slice(0, 5).join(', ') + (labels.length > 5 ? ', …' : '') + '),'
    + ' исключено путей ' + cfg.skip.length;
}

export function derivedLines(cfg) {
  return [
    '! ' + derivedSummary(cfg),
    '  закрепить их файлом (дальше правьте как удобно; иначе состав колонок меняется'
      + ' от прогона к прогону): ' + cliCommand('--init')
  ];
}

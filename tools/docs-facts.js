/* Чтение фактов из документации — одна копия на четыре проверки
 * (`test/docs-paths`, `docs-commands`, `docs-numbers`, `docs-pin`). Класс дефекта,
 * ради которого всё это заведено, один и повторился четырежды: документ называет
 * то, чего уже нет — путь после переезда, число проверок, команду или ключ,
 * которых инструмент не знает, «пересобирается побайтово» про мёртвую команду.
 * Прозой это не гарантируется, поэтому проверка идёт по фактам: дерево git,
 * история фикстуры, справка инструмента (`USAGE`), объявления проверок в наборах,
 * разделы документов-целей.
 *
 * Что остаётся человеку, и это названо, а не спрятано: формулировки и смысл,
 * обещания о будущем, верность описания роли файла (таблица сверяется с деревом
 * на существование и полноту, но не на то, что роль описана правильно) и
 * совпадение счёта объявлений с числом проверок в выводе раннера — оно держится
 * тем, что проверок нет нигде, кроме начала строки (это сторож тоже проверяет).
 *
 * Вне проверки два документа, и по делу: `WORKLOG.md` — журнал прошлого (числа и
 * пути там снимок на момент записи, и они обязаны стареть), `docs/module-design.md`
 * — проект выноса, то есть описание цели, а не сегодняшнего дерева. Ссылки на их
 * разделы при этом проверяются: они цель, а не источник утверждений.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, gitIn } from './harness.js';
import { USAGE } from '../src/size-table.js';

/* Документы, которые описывают **сегодняшнее** состояние репозитория. */
export const DOCS = ['README.md', 'PLAN.md', 'REFACTOR.md', 'BLOCKERS.md', 'templates/README.md', 'CHANGELOG.md'];

/* Пути, которых в репозитории нет и быть не должно: чужие или плановые. Список
 * ведёт человек — проверка требует лишь, чтобы новый такой путь попал сюда
 * осознанно, а не проскочил молча. */
export const FOREIGN = [
  // проект-потребитель: его файлы, настройки и скрипты
  'size-table.config.json', 'docs/size-table.html', 'docs/size-report.html',
  '.github/workflows/size-report.yml', 'node_modules/size-report/templates/ci.yml',
  'tools/size-table.js', 'tests/size-table.js',
  '../figma/safe-resets/docs/ROADMAP.md', '../figma/safe-resets/docs/TESTING.md', '../figma/safe-resets/AGENTS.md',
  // плановое: то, что описано как цель, а не как факт
  'dist/app.js', '.size-report/report.html', '.size-report/data.json',
  'docs/METHODS.md', 'docs/DATA-FORMAT.md', 'docs/ARCHITECTURE.md',
  'docs/ROADMAP.md', 'docs/TESTING.md', 'tests/harness.js', 'tests/doc-sync.js',
  // пример в тексте: так выглядит отказ инструмента на чужой поломке (§B3)
  'src/only-in-merge.js'
];

/* Документы, на разделы которых ссылаются остальные, — цель ссылки, а не
 * источник утверждений. Имя берётся по basename: в тексте пишут и `PLAN.md`, и
 * `docs/requirements.md`. */
export const TARGETS = [
  'README.md', 'PLAN.md', 'REFACTOR.md', 'BLOCKERS.md', 'WORKLOG.md',
  'docs/requirements.md', 'docs/module-design.md'
];

export const tracked = gitIn(ROOT, ['ls-files']).split('\n').filter((l) => l !== '');
export const dirs = new Set();
tracked.forEach((f) => {
  const parts = f.split('/');
  for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
});
/* Путь существует, если он есть в дереве или под ним лежит отслеживаемый файл.
 * Документ вправе назвать путь не от корня (`page/app.js` рядом с `src/page/`) —
 * имя должно существовать, а длина префикса — его личное дело. */
export const inTree = (p) => tracked.indexOf(p) >= 0 || dirs.has(p.replace(/\/$/, ''))
  || tracked.some((f) => f.slice(-(p.length + 1)) === '/' + p);

export function read(doc) {
  return fs.readFileSync(path.join(ROOT, doc), 'utf8');
}

/* Раздел целиком: от заголовка до следующего такого же уровня или до конца. */
export function withoutSection(text, title) {
  return text.replace(new RegExp('## ' + title + '[\\s\\S]*?(?=\\n## |$)'), '');
}

/* Утверждение о сегодняшнем дне — это текст без того, что называет
 * **отсутствующее** (раздел «Чего ещё нет» и строка-примечание `>`, которая
 * объясняет оговорку): проверять их как обещания — придирка к формулировке.
 * Раздел же о подключении чужого проекта выкидывается только там, где речь о
 * **путях**: пути в нём чужие, а команды — наши, и они обязаны быть живыми. */
export const NOT_TODAY = { 'README.md': ['Чего ещё нет', 'Для ИИ-агента'] };
export const OWN_PROJECT = { 'README.md': ['Как подключить к своему проекту'] };
export function facts(doc, sections) {
  let text = read(doc);
  (sections || []).forEach((title) => { text = withoutSection(text, title); });
  return text.replace(/^>.*$/gm, '');
}

// Код-спаны документа: в них и живут пути, команды и ключи.
export function spans(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

/* Похоже ли слово на **файл** в репозитории: есть слэш и расширение у последнего
 * куска. Каталоги проверка не берёт: `dist/`, `build/`, `node_modules/` в тексте —
 * это категория («результаты сборки»), а не утверждение о репозитории, и требовать
 * их существования были бы придиркой. Перечисление расширений (`.md/.toml/.txt`) и
 * адреса (`file://…`) — не пути. */
export function looksLikePath(tok) {
  if (tok.indexOf('/') < 0 || tok.indexOf('://') >= 0 || tok.indexOf('//') >= 0) return false;
  if (/[{<*…«»\\}]/.test(tok) || tok.indexOf(' ') >= 0) return false;
  const parts = tok.split('/');
  if (parts.some((p) => p === '')) return false;
  if (parts.every((p) => /^\.\w+$/.test(p))) return false;
  return /\.\w{1,6}$/.test(parts[parts.length - 1]);
}

/* Команды и ключи — из справки инструмента: отдельного их списка нет и заводить
 * его нельзя, иначе сторож и справка разойдутся молча. */
export const usageCommands = USAGE.split('\nКоманды:\n')[1].split('\n\n')[0]
  .split('\n').map((l) => l.trim().split(/\s+/)[0]).filter((w) => w !== '');
export const usageFlags = [...USAGE.matchAll(/--[a-z][a-z-]*/g)].map((m) => m[0]);

/* Зов инструмента: либо код-спан, либо строка блока кода (там, где его запускают,
 * а не упоминают в прозе). Хвост после `#` — комментарий примера, не аргументы. */
export function invocations(text) {
  const lines = text.split('\n').filter((l) => /^\s*(?:size|pnpm exec size|npx size-report|node bin\/size\.js)\s/.test(l))
    .map((l) => l.split('#')[0].trim());
  return spans(text).concat(lines);
}

/* Слова зова без имени инструмента: `pnpm exec size check --json` → ['check', …]. */
export function callWords(call) {
  return call.replace(/^pnpm exec /, '').replace(/^npx size-report/, 'size')
    .replace(/^node bin\/size\.js/, 'size').trim().split(/\s+/).slice(1);
}

/* Команды, которые зовёт инструкция: первое слово зова — только оно и может быть
 * командой. Список берётся из тех же зовов, что проверяет соседняя проверка:
 * второй парсер неизбежно разошёлся бы с первым. */
export function calledCommands() {
  const out = new Set();
  ['README.md', 'templates/README.md'].forEach((doc) => {
    invocations(facts(doc, NOT_TODAY[doc])).forEach((call) => {
      const words = callWords(call);
      if (words.length > 0 && usageCommands.indexOf(words[0]) >= 0) out.add(words[0]);
    });
  });
  return out;
}

/* Команды из справки закреплённой ревизии: файл читается из истории git, а не из
 * дерева, потому что справка там — другая. Секция «Команды» — список строковых
 * литералов, и имя команды в каждом — первое слово. */
export function commandsAt(rev) {
  const src = gitIn(ROOT, ['show', rev + ':src/refusal.js']);
  const section = src.split("'Команды:'")[1];
  if (section === undefined) return null;
  return [...section.split("'Режимы:'")[0].matchAll(/^\s*'\s+([a-z][a-z-]*)/gm)].map((m) => m[1]);
}

/* Прогоны набора, как их называет README: команда, сколько проверок она берёт и
 * какова цель. Читается таблицей, потому что это утверждение о числах, а не проза
 * (и потому что одно и то же число в двух формулировках стареет дважды). Сверяют
 * его два сторожа: документации — что документ не врёт, и разделения — что
 * объявленные прогоны совпадают с этими числами. */
export function publishedRuns() {
  const text = read('README.md');
  const quick = text.match(/^\|\s*Быстрый[^|]*\|\s*`pnpm test`\s*\|\s*\*\*(\d+) из (\d+)\*\*\s*\|\s*\*\*≤ (\d+) с\*\*/m);
  const long = text.match(/^\|\s*Полный[^|]*\|\s*`pnpm test:all`\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*≤ (\d+) с\*\*/m);
  return {
    fast: quick === null ? null : {
      checks: Number(quick[1]), total: Number(quick[2]), budget: Number(quick[3])
    },
    full: long === null ? null : { checks: Number(long[1]), budget: Number(long[2]) }
  };
}

/* Разделы документа: заголовок (`## 4.5.`, `## B1.`), нумерованный пункт внутри
 * раздела (`4.8.4` — четвёртый пункт §4.8), строка плана (`| R-4.12 |`) и заметка
 * (`- **N8.`). Всё это адреса, по которым документ ссылается на себя. */
export function sectionsOf(text) {
  const keys = new Set();
  let heading = '';
  text.split('\n').forEach((line) => {
    let m = line.match(/^#{2,4}\s*(?:(\d+(?:\.\d+)*)\.|([BN]\d+)\.)/);
    if (m) {
      heading = m[1] || m[2];
      keys.add(heading);
      return;
    }
    // Пункт с полным номером (`25.5.`, `4.8.4.`) и пункт без него под разделом
    // (`4.` внутри §4.8 — это §4.8.4). Закрытая заметка остаётся зачёркнутой, но
    // адресом быть не перестаёт.
    m = line.match(/^(\d+(?:\.\d+)+)\.\s/);
    if (m) keys.add(m[1]);
    m = line.match(/^(\d+)\.\s/);
    if (m && /^\d+(\.\d+)*$/.test(heading)) keys.add(heading + '.' + m[1]);
    m = line.match(/^\|\s*(R-\d+\.\d+)\s*\|/);
    if (m) keys.add(m[1]);
    m = line.match(/^\s*-\s+(?:~~)?\*\*([BN]\d+)\./);
    if (m) keys.add(m[1]);
  });
  return keys;
}

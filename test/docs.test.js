/* Сторож документации: то, что документ утверждает о репозитории, проверяется
 * машинно. Класс дефекта один и повторился четырежды — документ называет то, чего
 * уже нет: путь после переезда, число проверок, команду или ключ, которых
 * инструмент не знает, «пересобирается побайтово» про мёртвую команду. Прозой это
 * не гарантируется, поэтому проверка идёт по фактам: дерево git, справка
 * инструмента, объявления проверок в наборах, разделы документов.
 *
 * Что остаётся человеку, и это названо, а не спрятано: формулировки и смысл,
 * обещания о будущем, верность описания роли файла (таблица сверяется с деревом на
 * существование и полноту, но не на то, что роль описана правильно) и совпадение
 * счёта объявлений с числом проверок в выводе раннера — оно держится тем, что
 * проверок нет нигде, кроме начала строки (это сторож тоже проверяет).
 *
 * Вне проверки два документа, и по делу: `WORKLOG.md` — журнал прошлого (числа и
 * пути там снимок на момент записи, и они обязаны стареть), `docs/module-design.md`
 * — проект выноса, то есть описание цели, а не сегодняшнего дерева. Ссылки на их
 * разделы при этом проверяются: они цель, а не источник утверждений.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, gitIn, gitTry, sharedClone, tempDir } from '../tools/harness.js';
import { USAGE } from '../src/size-table.js';

const tmp = tempDir('docs');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* Документы, которые описывают **сегодняшнее** состояние репозитория. */
const DOCS = ['README.md', 'PLAN.md', 'REFACTOR.md', 'BLOCKERS.md', 'templates/README.md'];

/* Пути, которых в репозитории нет и быть не должно: чужие или плановые. Список
 * ведёт человек — проверка требует лишь, чтобы новый такой путь попал сюда
 * осознанно, а не проскочил молча. */
const FOREIGN = [
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
const TARGETS = [
  'README.md', 'PLAN.md', 'REFACTOR.md', 'BLOCKERS.md', 'WORKLOG.md',
  'docs/requirements.md', 'docs/module-design.md'
];

const tracked = gitIn(ROOT, ['ls-files']).split('\n').filter((l) => l !== '');
const dirs = new Set();
tracked.forEach((f) => {
  const parts = f.split('/');
  for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
});
/* Путь существует, если он есть в дереве или под ним лежит отслеживаемый файл.
 * Документ вправе назвать путь не от корня (`page/app.js` рядом с `src/page/`) —
 * имя должно существовать, а длина префикса — его личное дело. */
const inTree = (p) => tracked.indexOf(p) >= 0 || dirs.has(p.replace(/\/$/, ''))
  || tracked.some((f) => f.slice(-(p.length + 1)) === '/' + p);

function read(doc) {
  return fs.readFileSync(path.join(ROOT, doc), 'utf8');
}

/* Раздел целиком: от заголовка до следующего такого же уровня или до конца. */
function withoutSection(text, title) {
  return text.replace(new RegExp('## ' + title + '[\\s\\S]*?(?=\\n## |$)'), '');
}

/* Утверждение о сегодняшнем дне — это текст без того, что называет
 * **отсутствующее** (раздел «Чего ещё нет» и строка-примечание `>`, которая
 * объясняет оговорку): проверять их как обещания — придирка к формулировке.
 * Раздел же о подключении чужого проекта выкидывается только там, где речь о
 * **путях**: пути в нём чужие, а команды — наши, и они обязаны быть живыми. */
const NOT_TODAY = { 'README.md': ['Чего ещё нет', 'Для ИИ-агента'] };
const OWN_PROJECT = { 'README.md': ['Как подключить к своему проекту'] };
function facts(doc, sections) {
  let text = read(doc);
  (sections || []).forEach((title) => { text = withoutSection(text, title); });
  return text.replace(/^>.*$/gm, '');
}

// Код-спаны документа: в них и живут пути, команды и ключи.
function spans(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

/* Похоже ли слово на **файл** в репозитории: есть слэш и расширение у последнего
 * куска. Каталоги проверка не берёт: `dist/`, `build/`, `node_modules/` в тексте —
 * это категория («результаты сборки»), а не утверждение о репозитории, и требовать
 * их существования были бы придиркой. Перечисление расширений (`.md/.toml/.txt`) и
 * адреса (`file://…`) — не пути. */
function looksLikePath(tok) {
  if (tok.indexOf('/') < 0 || tok.indexOf('://') >= 0 || tok.indexOf('//') >= 0) return false;
  if (/[{}<*…«»\\]/.test(tok) || tok.indexOf(' ') >= 0) return false;
  const parts = tok.split('/');
  if (parts.some((p) => p === '')) return false;
  if (parts.every((p) => /^\.\w+$/.test(p))) return false;
  return /\.\w{1,6}$/.test(parts[parts.length - 1]);
}

/* Команды и ключи — из справки инструмента: отдельного их списка нет и заводить
 * его нельзя, иначе сторож и справка разойдутся молча. */
const usageCommands = USAGE.split('\nКоманды:\n')[1].split('\n\n')[0]
  .split('\n').map((l) => l.trim().split(/\s+/)[0]).filter((w) => w !== '');
const usageFlags = [...USAGE.matchAll(/--[a-z][a-z-]*/g)].map((m) => m[0]);

/* Зов инструмента: либо код-спан, либо строка блока кода (там, где его запускают,
 * а не упоминают в прозе). Хвост после `#` — комментарий примера, не аргументы. */
function invocations(text) {
  const lines = text.split('\n').filter((l) => /^\s*(?:size|pnpm exec size|npx size-report|node bin\/size\.js)\s/.test(l))
    .map((l) => l.split('#')[0].trim());
  return spans(text).concat(lines);
}

test('пути, названные документацией, есть в дереве', () => {
  // Файлы, которые знала фикстура: её история — не одно дерево, и документация
  // вправе называть файл по имени, жившему до переименования.
  const fixture = new Set(gitIn(sharedClone('plain', tmp), ['log', '--name-only', '--pretty=format:'])
    .split('\n').filter((l) => l !== ''));
  const foreign = new Set(FOREIGN);
  const missing = [];
  DOCS.forEach((doc) => {
    spans(facts(doc, (NOT_TODAY[doc] || []).concat(OWN_PROJECT[doc] || []))).forEach((tok) => {
      if (!looksLikePath(tok)) return;
      if (inTree(tok) || foreign.has(tok) || fixture.has(tok)) return;
      missing.push(doc + ': ' + tok);
    });
  });
  assert.deepEqual(missing, [],
    'документация называет пути, которых нет ни в дереве, ни в фикстуре, ни среди чужих:\n  '
    + missing.join('\n  '));
});

test('таблица файлов README совпадает с деревом в обе стороны', () => {
  const named = [];
  const table = read('README.md').match(/## Что в репозитории[\s\S]*?(?=\n## |$)/)[0];
  table.split('\n').forEach((line) => {
    if (line.indexOf('|') !== 0) return;
    const first = line.split('|')[1];
    if (first === undefined || first.trim() === 'Файл' || /^-+$/.test(first.trim())) return;
    first.split(',').forEach((cell) => {
      const tok = cell.replace(/`/g, '').trim();
      if (tok !== '' && tok !== 'Файл' && tok.indexOf('—') < 0) named.push(tok);
    });
  });
  assert.ok(named.length > 0, 'таблица файлов README не разобралась');

  const absent = named.filter((p) => !inTree(p));
  assert.deepEqual(absent, [], 'README называет файлы, которых нет:\n  ' + absent.join('\n  '));

  // Обратная сторона: файл, которого в таблице нет, — пробел, которого не
  // заметили. Каталог покрывает всё, что под ним; сама таблица себя не
  // перечисляет, потому что это её шапка, а не строка содержимого.
  const covered = (f) => named.some((p) => p === f || (p.slice(-1) === '/' && f.indexOf(p) === 0)
    || (dirs.has(p) && f.indexOf(p + '/') === 0));
  const undescribed = tracked.filter((f) => f !== 'README.md' && !covered(f));
  assert.deepEqual(undescribed, [],
    'в дереве есть файлы, которых нет в таблице README:\n  ' + undescribed.join('\n  '));
});

test('документация зовёт только существующие команды и ключи', () => {
  // Проверяются инструкции — README пакета и записка в шаблонах: их читает тот,
  // кто собирается что-то запустить. `PLAN.md` и `REFACTOR.md` называют целевую
  // поверхность (`size init`, `size measure`, `--out`) — это план, и требовать от
  // них сегодняшнего CLI значило бы запретить планировать.
  const bad = [];
  ['README.md', 'templates/README.md'].forEach((doc) => {
    invocations(facts(doc, NOT_TODAY[doc])).forEach((call) => {
      if (!/^(?:size|pnpm exec size|npx size-report|node bin\/size\.js)(\s|$)/.test(call)) return;
      const words = call.replace(/^pnpm exec /, '').replace(/^npx size-report/, 'size')
        .replace(/^node bin\/size\.js/, 'size').trim().split(/\s+/).slice(1);
      if (words.length === 0) return;
      const known = usageCommands.indexOf(words[0]) >= 0;
      if (!known && words[0][0] !== '-') {
        // Первое слово может быть только командой или ключом режима; всё
        // остальное — зов несуществующей команды (но только если это слово, а
        // не, скажем, `…` или `<sha>` из шаблона).
        if (/^[a-z][a-z-]*$/.test(words[0])) {
          bad.push(doc + ': команда «' + words[0] + '» (в «' + call + '»)');
        }
        return;
      }
      (known ? words.slice(1) : words).forEach((w) => {
        if (w[0] !== '-' || usageFlags.indexOf(w) >= 0) return;
        bad.push(doc + ': ключ ' + w + ' в «' + call + '»');
      });
    });
  });
  assert.deepEqual(bad, [], 'документация зовёт то, чего инструмент не знает:\n  ' + bad.join('\n  '));
});

/* Команды, которые зовёт инструкция: первое слово зова — только оно и может быть
 * командой. Список берётся из тех же зовов, что проверяет соседний тест: второй
 * парсер неизбежно разошёлся бы с первым. */
function calledCommands() {
  const out = new Set();
  ['README.md', 'templates/README.md'].forEach((doc) => {
    invocations(facts(doc, NOT_TODAY[doc])).forEach((call) => {
      const words = call.replace(/^pnpm exec /, '').replace(/^npx size-report/, 'size')
        .replace(/^node bin\/size\.js/, 'size').trim().split(/\s+/).slice(1);
      if (words.length > 0 && usageCommands.indexOf(words[0]) >= 0) out.add(words[0]);
    });
  });
  return out;
}

/* Команды из справки закреплённой ревизии: файл читается из истории git, а не из
 * дерева, потому что справка там — другая. Секция «Команды» — список строковых
 * литералов, и имя команды в каждом — первое слово. */
function commandsAt(rev) {
  const src = gitIn(ROOT, ['show', rev + ':src/refusal.js']);
  const section = src.split("'Команды:'")[1];
  if (section === undefined) return null;
  return [...section.split("'Режимы:'")[0].matchAll(/^\s*'\s+([a-z][a-z-]*)/gm)].map((m) => m[1]);
}

/* Пример установки — тоже утверждение о репозитории, и проверяемое: пин обязан
 * вести на ревизию этого репозитория, в справке которой есть все команды,
 * названные в тексте. Иначе документированный путь ведёт в пустоту: инструмент той
 * ревизии лишнего слова не читает, и `size doctor` отвечает нулём, ничего не сделав. */
test('пример установки ведёт на ревизию, чья справка знает названные команды', () => {
  const pin = read('README.md').match(/github:vernikr\/size-report#([\w./-]+)/);
  assert.ok(pin, 'README не называет ревизию в примере установки — сверить нечего');
  const rev = pin[1];

  const type = gitTry(ROOT, ['cat-file', '-t', rev]).stdout.trim();
  assert.ok(type === 'commit' || type === 'tag',
    'пример установки ссылается на «' + rev + '», а такой ревизии в этом репозитории нет');
  const commit = gitIn(ROOT, ['rev-parse', rev + '^{commit}']).trim();

  const commands = commandsAt(commit);
  assert.ok(commands !== null && commands.length > 0,
    'у ревизии «' + rev + '» нет справки с разделом «Команды» — она старше того, чему учит текст');

  const unknown = [...calledCommands()].filter((c) => commands.indexOf(c) < 0);
  assert.deepEqual(unknown, [],
    'ревизия «' + rev + '» не знает команд, которым учит текст: ' + unknown.join(', ')
      + '\n  в справке той ревизии: ' + commands.join(', '));
});

test('числа проверок и целей в документации совпадают с фактом', () => {
  // Объявлений проверок — по файлам набора. Счёт держится на том, что проверка
  // объявляется в начале строки: объявление внутри цикла сделало бы число выводом
  // из кода, и документации было бы не на что опираться.
  const declared = [];
  const nested = [];
  fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /\.test\.js$/.test(f)).forEach((f) => {
    read(path.join('test', f)).split('\n').forEach((line, i) => {
      if (/^test\(/.test(line)) declared.push('test/' + f);
      if (/^\s+test\(/.test(line)) nested.push('test/' + f + ':' + (i + 1));
    });
  });
  assert.deepEqual(nested, [],
    'проверка объявлена не в начале строки — число проверок нельзя прочесть по файлам:\n  '
    + nested.join('\n  '));

  const claimed = read('README.md').match(/при (\d+) проверках/);
  assert.ok(claimed, 'README не называет числа проверок — сверить нечего');
  assert.equal(Number(claimed[1]), declared.length,
    'README обещает ' + claimed[1] + ' проверок, а в наборах их ' + declared.length);

  // Бюджет времени: строк в таблице REFACTOR про сегодняшний набор может быть
  // несколько (история целей), сверить обязан последнюю — она и есть действующая.
  const rows = [...read('REFACTOR.md').matchAll(/^\| `pnpm test` \((\d+) провер[а-я]*[^|]*\|[^|]*\| \*\*≤ (\d+) с\*\*/gm)];
  assert.ok(rows.length > 0, 'в REFACTOR нет строки бюджета про `pnpm test`');
  const last = rows[rows.length - 1];
  assert.equal(Number(last[1]), declared.length,
    'последняя строка бюджета REFACTOR — про ' + last[1] + ' проверок, а в наборах их ' + declared.length);
  const goal = read('README.md').match(/цель — `pnpm test`\s*\*\*≤ (\d+) с\*\*/);
  assert.ok(goal, 'README не называет цели по времени — сверить нечего');
  assert.equal(goal[1], last[2],
    'README обещает цель ≤ ' + goal[1] + ' с, а бюджет REFACTOR — ≤ ' + last[2] + ' с');
});

/* Разделы документа: заголовок (`## 4.5.`, `## B1.`), нумерованный пункт внутри
 * раздела (`4.8.4` — четвёртый пункт §4.8), строка плана (`| R-4.12 |`) и заметка
 * (`- **N8.`). Всё это адреса, по которым документ ссылается на себя. */
function sectionsOf(text) {
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

test('ссылки на разделы ведут в существующие разделы', () => {
  const sections = {};
  TARGETS.forEach((f) => { sections[path.basename(f)] = sectionsOf(read(f)); });

  const bad = [];
  DOCS.forEach((doc) => {
    read(doc).split('\n').forEach((line) => {
      [...line.matchAll(/§\s*(\d+(?:\.\d+)*|[BN]\d+)/g)].forEach((m) => {
        const key = m[1];
        const before = line.slice(0, m.index);
        // Ближайшее имя документа: сразу за ссылкой («§4.3 `module-design.md`»)
        // или перед ней («`PLAN.md` §5»). Без имени ссылка на раздел требований —
        // так на них и ссылаются («требование §4.2»).
        const after = line.slice(m.index + m[0].length).match(/^\s*`?([\w.-]+\.md)`?/);
        const named = (after && sections[after[1]] !== undefined && after[1])
          || [...before.matchAll(/`?([\w.-]+\.md)`?/g)].reverse().map((n) => n[1])
            .find((n) => sections[n] !== undefined)
          || (/(?:требовани|требований)/.test(line) ? 'requirements.md' : null);
        // Ссылка без имени документа — это § журнала или плана, и разрешать её
        // нечем: планировать и нумеровать всякий волен по-своему. Молчание тут
        // честнее догадки.
        if (named === null || sections[named] === undefined) return;
        if (!sections[named].has(key)) bad.push(doc + ': §' + key + ' → ' + named);
      });
    });
  });
  assert.deepEqual(bad, [], 'ссылки ведут в несуществующие разделы:\n  ' + bad.join('\n  '));
});

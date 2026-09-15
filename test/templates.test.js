/* Шаблоны для подключаемого проекта: черновик настроек и описание проверки в CI.
 *
 * Они лежат в поставке как обещание — «возьми и положи, правок не требуется», —
 * и исполняет их чужой проект, а не этот репозиторий. Поэтому обещание
 * проверяется здесь, иначе шаблон сгниёт молча: черновик обязан пройти проверку
 * настроек (ту самую, которой его встретит первый запуск) и собрать настоящий
 * отчёт, а описание проверки — разобраться и звать только те команды и ключи,
 * которые в инструменте действительно есть.
 *
 * Проверка берёт файлы из репозитория, а не из тарболла: доезжает ли шаблон до
 * поставки — дело `tools/pack-check.js`, и там он сверяется побайтово.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONFIG, USAGE, loadConfig } from '../src/size-table.js';
import { ROOT, cloneFixture, readJson, runSize, tempDir } from '../tools/harness.js';
import { PKG } from '../tools/docs-facts.js';

/* Имя пакета — из манифеста: шаблон обязан называть то же имя, что и подсказки
 * инструмента (`node_modules/<имя>/bin/size.js`), и переименование пакета должно
 * ломать эти проверки, а не делать их пустыми. */
const PKG_RE = PKG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const INSTALL_RE = new RegExp('^node node_modules/' + PKG_RE + '/bin/size\\.js\\s');
const BY_NAME_RE = new RegExp('(^|\\s)(?:npx|npm exec|yarn)\\s+' + PKG_RE + '(\\s|$)');

const tmp = tempDir('templates');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const TEMPLATES = path.join(ROOT, 'templates');
const DRAFT = path.join(TEMPLATES, 'size-report.config.json');
const WORKFLOW = path.join(TEMPLATES, 'ci.yml');
const NOTE = path.join(TEMPLATES, 'README.md');

/* Ключи, которые инструмент знает: справка — единственное место, где они
 * объявлены для человека, поэтому ключ шаблона, которого там нет, — это команда
 * из будущего или опечатка, и оба случая лучше поймать здесь. */
function knownFlags() {
  return [...USAGE.matchAll(/--[a-z][a-z-]*/g)].map((m) => m[0]);
}

// Ключи инструмента, названные в команде: `…/bin/size.js --write` → ['--write'].
function flagsOf(command) {
  return [...command.matchAll(/--[a-z][a-z-]*/g)].map((m) => m[0]);
}

/* Разбор подмножества YAML, которого хватает описанию проверки: отображения по
 * отступу, элементы списка `- `, скалярные значения и потоковый список (`[a, b]`).
 * Выход за подмножество — явная ошибка, а не молча пропущенная строка: описание,
 * которое перестало разбираться, обязано ронять проверку, а не проходить её. */
function parseWorkflow(src) {
  const lines = [];
  src.split('\n').forEach((raw, i) => {
    const text = raw.replace(/#.*$/, '').trimEnd();
    if (text.trim() === '') return;
    lines.push({ indent: text.length - text.trimStart().length, text: text.trim(), line: i + 1 });
  });
  for (const l of lines) {
    if (/\s$/.test(l.text) || l.text.indexOf('\t') >= 0) {
      throw new Error('строка ' + l.line + ': отступ или хвостовые пробелы вне подмножества');
    }
  }
  let at = 0;
  const scalar = (text) => {
    if (text[0] === '[') {
      if (text[text.length - 1] !== ']') throw new Error('потоковый список не закрыт: ' + text);
      return text.slice(1, -1).split(',').map((s) => s.trim());
    }
    if (/^\d+$/.test(text)) return Number(text);
    return text;
  };
  function map(indent) {
    const out = {};
    while (at < lines.length && lines[at].indent === indent && lines[at].text[0] !== '-') {
      const head = lines[at];
      const cut = head.text.indexOf(':');
      if (cut < 0) throw new Error('строка ' + head.line + ': не ключ и не элемент списка');
      const key = head.text.slice(0, cut).trim();
      const value = head.text.slice(cut + 1).trim();
      at++;
      if (value !== '') out[key] = scalar(value);
      else if (at < lines.length && lines[at].indent > indent) out[key] = node(lines[at].indent);
      else out[key] = null;
    }
    return out;
  }
  function list(indent) {
    const out = [];
    while (at < lines.length && lines[at].indent === indent && lines[at].text[0] === '-') {
      const head = lines[at];
      const rest = head.text.slice(1).trim();
      at++;
      if (rest === '') {
        out.push(node(head.indent + 2));
        continue;
      }
      /* Элемент-отображение записан первой строкой (`- name: …`), остальные его
       * ключи стоят на два пробела глубже. */
      const cut = rest.indexOf(':');
      if (cut < 0) throw new Error('строка ' + head.line + ': элемент списка не отображение');
      const item = {};
      const value = rest.slice(cut + 1).trim();
      const key = rest.slice(0, cut).trim();
      if (value !== '') item[key] = scalar(value);
      else if (at < lines.length && lines[at].indent > head.indent) item[key] = node(lines[at].indent);
      else item[key] = null;
      const more = at < lines.length && lines[at].indent > head.indent && lines[at].text[0] !== '-'
        ? map(head.indent + 2) : {};
      out.push(Object.assign(item, more));
    }
    return out;
  }
  function node(indent) {
    const first = lines[at];
    if (first === undefined || first.indent < indent) return null;
    if (first.text[0] === '-') return list(first.indent);
    if (first.indent > indent) throw new Error('строка ' + first.line + ': отступ глубже ожидаемого');
    return map(first.indent);
  }
  const doc = map(lines[0].indent);
  if (at !== lines.length) throw new Error('разбор кончился на строке ' + lines[at].line);
  return doc;
}

test('черновик настроек проходит проверку инструмента', () => {
  const draft = readJson(DRAFT);
  const known = Object.keys(DEFAULT_CONFIG);
  Object.keys(draft).forEach((key) => {
    assert.ok(known.indexOf(key) >= 0, 'в черновике ключ, которого инструмент не знает: ' + key);
  });

  /* Проверка настроек — та же самая, которой черновик встретит первый запуск:
   * `loadConfig` читает файл, досыпает умолчания и проверяет то, что получилось. */
  const cfg = loadConfig(DRAFT);
  assert.ok(cfg.columns.length > 0, 'в черновике нет ни одной колонки');
  assert.equal(cfg.output.indexOf('..'), -1, 'файл таблицы выведен за пределы проекта');

  /* Команды, названные в черновике, обязаны существовать: `fixCommand` цитируют
   * подпись отчёта и отказы, и команда из будущего увела бы читателя в тупик. */
  const known2 = knownFlags();
  flagsOf(cfg.fixCommand).forEach((flag) => {
    assert.ok(known2.indexOf(flag) >= 0, 'черновик зовёт ключ, которого нет в справке: ' + flag);
  });

  /* Форма самого зова: путь внутри проекта, а не имя из реестра. Имя в команде
   * (`npx <имя>`) в проекте без установленного пакета уходит в реестр и тянет
   * пакет по сети — совет, который должен выручать, зависел бы от реестра
   * (REFACTOR.md R-4.21). */
  assert.match(cfg.fixCommand, INSTALL_RE,
    'черновик советует не путь внутри проекта: ' + cfg.fixCommand);
  assert.equal(BY_NAME_RE.test(cfg.fixCommand), false,
    'черновик советует зов по имени пакета: ' + cfg.fixCommand);

  /* Записка о шаблонах — то, чем проект и пользуется: файл, о котором она молчит
   * (или которого нет), — это описание, разошедшееся с поставкой. */
  const note = fs.readFileSync(NOTE, 'utf8');
  ['size-report.config.json', 'ci.yml'].forEach((file) => {
    assert.ok(fs.existsSync(path.join(TEMPLATES, file)), 'в шаблонах нет ' + file);
    assert.ok(note.indexOf(file) >= 0, 'записка о шаблонах не называет ' + file);
  });
  assert.ok(note.indexOf('AGENTS.md') >= 0,
    'записка молчит о том, чего в шаблонах нет намеренно: это читатель ищет там первым делом');
});

test('описание проверки в CI разбирается и запускает то, что заявлено', () => {
  const src = fs.readFileSync(WORKFLOW, 'utf8');
  const wf = parseWorkflow(src);
  assert.equal(wf.name, 'size-report', 'у проверки нет имени');
  assert.deepEqual(wf.on, ['push', 'pull_request'], 'проверка идёт не на пуш и не на запрос правки');

  const jobs = Object.keys(wf.jobs);
  assert.equal(jobs.length, 1, 'в описании больше одного job — читать и запускать это дороже');
  const job = wf.jobs[jobs[0]];
  assert.ok(job['runs-on'], 'у job нет runs-on');
  assert.ok(Array.isArray(job.steps) && job.steps.length > 0, 'в job нет шагов');

  /* История целиком: без `fetch-depth: 0` инструмент откажет кодом 3 — то есть
   * проверка падала бы на самой себе, а не на расхождении чисел. */
  const checkout = job.steps.find((s) => typeof s.uses === 'string' && s.uses.indexOf('actions/checkout') === 0);
  assert.ok(checkout, 'в описании нет шага checkout');
  assert.equal(checkout.with['fetch-depth'], 0,
    'история клонируется обрезанной: таблица строится по коммитам и обрежется вместе с ней');

  const runs = job.steps.filter((s) => typeof s.run === 'string');
  const tool = runs.filter((s) => new RegExp('(^|\\s)(pnpm exec size|node node_modules/'
    + PKG_RE + '/bin/size\\.js)(\\s|$)').test(s.run));
  assert.ok(tool.length >= 2, 'проверка не зовёт команду инструмента хотя бы дважды');

  /* Шаг с пакетом ставит его до проверки, но зов по имени пакета всё равно не
   * годится: та же строка, скопированная в проект без установленного пакета,
   * уходит в реестр и тянет пакет по сети (REFACTOR.md R-4.21). */
  const byName = runs.filter((s) => BY_NAME_RE.test(s.run));
  assert.deepEqual(byName.map((s) => s.run), [],
    'шаг проверки зовёт инструмент по имени пакета, а не локальным бинарём');

  /* Две среды — это один и тот же вызов: снимок чисел без настроек машины и
   * обычный, а затем их сравнение. Иначе «две среды» были бы разными командами. */
  const nulled = tool.filter((s) => s.env && s.env.GIT_CONFIG_GLOBAL === '/dev/null');
  assert.equal(nulled.length, 1, 'в описании не ровно одна среда без настроек git');
  assert.ok(runs.some((s) => /^diff\s/.test(s.run)),
    'снимки не сверяются: числа двух сред разошлись бы молча');
  const snapshots = tool.filter((s) => s.run.indexOf('>') >= 0).map((s) => s.run.replace(/\s*>\s*\S+$/, ''));
  assert.equal(snapshots.length, 2, 'в описании не два снимка чисел');
  assert.equal(snapshots[0], snapshots[1],
    'две среды снимают числа разными командами, а должны одной и той же');
  assert.equal(snapshots[0].indexOf('--data') >= 0, true,
    'снимок снимается не командой данных: сравнивать было бы нечего');

  /* Секретов шаблон не требует: ключ проекта, если он нужен, живёт в секретах и
   * добавлен закомментированным примером — здесь это проверяется по тексту без
   * комментариев, чтобы пример не считался требованием. */
  const live = src.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.equal(/secrets\.[A-Za-z_]/.test(live), false,
    'описание требует секрет: шаблон не должен заводить их за проект');

  /* Ключи инструмента — из справки, а не из головы автора шаблона. */
  const known = knownFlags();
  tool.forEach((step) => {
    flagsOf(step.run).forEach((flag) => {
      assert.ok(known.indexOf(flag) >= 0,
        'описание зовёт ключ, которого нет в справке: ' + flag + ' (шаг «' + step.name + '»)');
    });
  });
});

/* Черновик проверяется не только на бумаге: с ним действительно собирается отчёт.
 * История — фикстура, колонки шаблона (`README.md`, `package.json`) в ней есть,
 * поэтому это и есть первый запуск в новом проекте, а не проверка формы файла. */
test('черновик собирает настоящий отчёт', () => {
  const dir = cloneFixture(path.join(tmp, 'draft'));
  const res = runSize(dir, ['--config', DRAFT, '--data']);
  assert.equal(res.code, 0, 'черновик не собрал отчёт (код ' + res.code + '): ' + res.stderr.trim());
  const data = JSON.parse(res.stdout);
  assert.equal(data.files.length, 2, 'колонок в отчёте не две — черновик разошёлся сам с собой');
  assert.ok(data.rows.length > 0, 'в отчёте нет ни одной строки коммита');
  assert.deepEqual(data.metrics.map((m) => m.key), ['raw', 'min', 'tok'],
    'черновик объявил не те метрики, что должен');
  data.now.forEach((cells, i) => {
    assert.ok(cells.raw > 0, 'колонка «' + data.files[i].label + '» пуста: черновик не измеряет то, что называет');
  });
});

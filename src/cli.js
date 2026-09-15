import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { EXIT, Refusal, USAGE, advicePath, cliCommand, invocation, refuseCause } from './refusal.js';
import { CONFIG_NAME, gitRoot, loadConfig, validateConfig } from './config.js';
import { MAX_BUF, git, gitArgv, gitEnv } from './git.js';
import { byteLen } from './strip.js';
import { build, skipLine } from './history.js';
import { reportData } from './data.js';
import { coverage, coverageText } from './check.js';
import { explainCommit, explainText } from './explain.js';
import { doctor, doctorText } from './doctor.js';
import { hookRun, installHook, uninstallHook } from './hook.js';
import { rebuild } from './artifact.js';
import { sensorGaps } from './metrics.js';
import { render } from './render.js';
import { totalsOf } from './derived.js';
import { pageHtml } from './page/build.js';

/* Режимы командной строки: проверка полноты, объяснение пропущенной строки,
 * проверка таблицы, сборка, данные, страница, черновик настроек и разбор
 * аргументов. Единственный модуль, который знает про все остальные сразу, — потому
 * ему и позволено их связывать. */

function kmb(bytes) {
  return Math.round(bytes / 1024) + ' КБ';
}

/* Деградация — не ошибка, а факт отчёта: числа получены другим счётом (упрощение
 * вместо сжатия, оценка вместо точного счёта), потому что необязательной
 * зависимости нет. Факт печатается один раз на датчик и становится кодом 4 — иначе
 * приближение уезжало бы в CI как успех. */
function note(gaps) {
  gaps.forEach((gap) => console.error('! ' + gap.why + '\n  починка: ' + gap.fix));
  return gaps.length === 0 ? EXIT.OK : EXIT.SENSOR;
}

function sensorNote(cfg) {
  return note(sensorGaps(cfg));
}

export function check(cfg, want, root) {
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

/* Запись вывода, у которого может не быть каталога: `--page .size-report/report.html`
 * в свежем проекте — обычный запуск, а не ошибка пользователя. */
function writeFileEnsured(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function writeMode(cfg, root) {
  const { rows, dropped, state, html } = rebuild(cfg, root);
  console.log('✓ ' + cfg.output + ': ' + rows.length + ' строк × ' + cfg.columns.length + ' файлов, '
    + kmb(byteLen(html)) + ' (пропущено без строки: ' + dropped.length + ' — '
    + dropped.map(skipLine).join(', ') + ')');
  console.log('  состояние на HEAD: ' + cfg.columns.map((c, i) => c.label + ' '
    + (state[i] === null ? '—' : cfg.metrics.map((m) => state[i].cells[m]).join('/'))).join(', '));
  return sensorNote(cfg);
}

function checkMode(cfg, root) {
  const { rows } = build(cfg, root);
  const html = render(rows, cfg);
  const code = check(cfg, html, root);
  if (code === 0) {
    console.log('✓ таблица размеров: ' + rows.length + ' коммитов × ' + cfg.columns.length + ' файлов '
      + 'совпадает с историей (' + cfg.output + ', ' + kmb(byteLen(html)) + ')');
    return sensorNote(cfg);
  }
  return code;
}

/* Полнота покрытия (`size check`): настройки, история, пути, датчики. Не путать с
 * `checkMode` выше — тот про таблицу и историю («файл совпадает с тем, что
 * сосчитано»), а этот про то, что сосчитано **всё**: ни один путь истории не
 * прошёл мимо колонок. Разные вопросы, поэтому и разные команды: держать отчёт в
 * git не обязательно, а вот полноту терять нельзя — она той же проверкой и
 * заменяется. */
function coverageMode(cfg, root, configFile, asJson) {
  const rep = coverage(cfg, root, configFile);
  if (asJson) process.stdout.write(JSON.stringify(rep, null, 2) + '\n');
  else console.log(coverageText(rep));
  if (!rep.ok) return EXIT.VIOLATION;
  return note(rep.sensors);
}

/* Диагностика одним ответом (`size doctor`): окружение, зависимости, настройки и
 * покрытие — сборкой из тех же кусков, что и остальные режимы. Код выхода — не
 * «что-то не так», а первый по важности (настройки → история → покрытие →
 * приближение): по нему агент ветвится, а текст читает человек. */
function doctorMode(root, configFile, asJson) {
  const rep = doctor(root, configFile);
  if (asJson) process.stdout.write(JSON.stringify(rep, null, 2) + '\n');
  else console.log(doctorText(rep));
  return rep.exit;
}

/* Хук: установка, снятие и то, что он зовёт сам. Ставится и снимается только
 * явной командой; `hook-run` зовётся хуком и всегда отвечает кодом 0 — коммит уже
 * сделан, и валить его нечем (устройство и причины — `src/hook.js`). Строка о
 * сделанном идёт в stderr: она часть вывода git, а не данных инструмента. */
function hookMode(verb, root, configFile) {
  if (verb === 'hook-run') {
    const rep = hookRun(root, configFile);
    if (rep.note !== '') console.error(rep.note);
    return rep.code;
  }
  const rep = verb === 'install-hook' ? installHook(root, loadConfig(configFile, root)) : uninstallHook(root);
  rep.lines.forEach((line) => console.log(line));
  return rep.code;
}

/* Объяснение пропущенной строки (`size explain <коммит>`): ответ есть у любого
 * коммита, поэтому код выхода 0 и у «строка есть», и у «строки нет»; 2 — только
 * когда названного коммита в истории нет или префикс подходит нескольким. */
function explainMode(cfg, root, target, asJson) {
  const rep = explainCommit(cfg, root, target);
  if (asJson) process.stdout.write(JSON.stringify(rep, null, 2) + '\n');
  else console.log(explainText(rep));
  return EXIT.OK;
}

/* Грамматика командной строки: один разбор на входе, до чтения проекта. Он решает
 * всё сразу — какой режим запрошен, совместим ли он с командой и с остальными
 * ключами, все ли ключи получили значение, нет ли лишних слов, — и отвечает либо
 * планом, либо отказом. Порядок ветвлений в `main` поэтому ничего не решает:
 * правило «так нельзя» это значение, а не место в коде, и наружу оно выходит одним
 * способом — отказом с названным виновником и готовой командой.
 *
 * Ключи трёх родов: режимы (взаимоисключающие — они задают, что делать), ключи со
 * значением (забирают следующий аргумент) и переключатели. Команда — первое слово
 * вне ключей: её чтение не зависит от места в строке, поэтому и `size check
 * --config x`, и `size --config x check` — одно и то же. */
const MODES = ['--init', '--write', '--data', '--page'];
const VALUE_FLAGS = ['--config', '--init', '--page'];
const FLAGS = ['--help', '-h'].concat(MODES, VALUE_FLAGS, ['--json', '--force']);
const COMMANDS = ['check', 'explain', 'doctor', 'install-hook', 'uninstall-hook', 'hook-run'];
const ANSWER_COMMANDS = ['check', 'explain', 'doctor'];
const HOOK_COMMANDS = ['install-hook', 'uninstall-hook', 'hook-run'];

function parseArgs(args) {
  // Справка отвечает всегда и первой: она и есть выход из любой опечатки.
  if (args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) return { help: true };
  const seen = new Set();
  const modes = [];
  const values = {};
  const words = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a[0] !== '-') {
      words.push(a);
      continue;
    }
    if (FLAGS.indexOf(a) < 0) {
      refuseCause('незнакомый ключ', 'незнакомый ключ «' + a + '»\n  починка: ' + cliCommand('--help'));
    }
    if (seen.has(a)) {
      refuseCause('повтор ключа', 'ключ «' + a + '» назван дважды\n  починка: ' + cliCommand('--help'));
    }
    seen.add(a);
    if (VALUE_FLAGS.indexOf(a) >= 0) {
      const next = args[i + 1];
      const none = next === undefined || next[0] === '-';
      // У `--init` и `--page` это законное «по умолчанию», а у `--config` —
      // молчаливый пропуск: настройки были бы взяты не те, что назвал человек.
      if (none && a === '--config') {
        refuseCause('ключ без значения', 'у ключа «' + a + '» нет значения: нужен файл настроек'
          + '\n  починка: ' + cliCommand(a + ' <файл>'));
      }
      if (!none) i++;
      values[a] = none ? null : next;
    }
    if (MODES.indexOf(a) >= 0) modes.push(a);
  }
  return Object.assign({ help: false, values: values }, checkArgs(words, seen, values, modes));
}

/* Проверки, которые нельзя сделать по одному аргументу: они про сочетание
 * названного. Отсюда и все правила вида «это с этим не работает» — одним списком,
 * а не разбросанными по ветвлениям. */
function checkArgs(words, seen, values, modes) {
  const verb = words.length > 0 ? words[0] : null;
  const arg = words.slice(1);
  const mode = modes.length > 0 ? modes[0] : null;
  /* Совет повторяет настройки, которые человек назвал: без `--config` команда ищет
   * файл под умолчательным именем, в проекте с другим именем не находит его и
   * уводит человека во второй отказ — про файл настроек, которого у него нет. */
  const given = typeof values['--config'] === 'string'
    ? '--config ' + advicePath(values['--config']) + ' ' : '';
  const advice = (rest) => cliCommand(given + rest);
  if (modes.length > 1) {
    refuseCause('два режима сразу', 'два режима сразу: «' + modes[0] + '» и «' + modes[1] + '» — режим один'
      + '\n  починка: ' + advice(modes[0]));
  }
  if (seen.has('--force') && mode !== '--init') {
    refuseCause('несовместимый ключ', 'ключ «--force» работает только с «--init»'
      + '\n  починка: ' + cliCommand('--init --force'));
  }
  if (seen.has('--config') && mode === '--init') {
    refuseCause('несовместимый ключ', 'у «--init» свой файл, а «--config» называет настройки проекта'
      + '\n  починка: ' + cliCommand('--init <файл>'));
  }
  if (verb !== null && COMMANDS.indexOf(verb) < 0) {
    // Слово после режима со значением (`--init`, `--page`) — не «неизвестная
    // команда»: команды здесь никто не звал, а виновато лишнее значение, и отказ
    // обязан назвать виновника своим именем. У `--config` остаток — именно
    // команда, и зов её разбирается ниже.
    const valued = MODES.find((f) => VALUE_FLAGS.indexOf(f) >= 0 && typeof values[f] === 'string');
    if (valued !== undefined) {
      refuseCause('лишнее слово', 'лишнее слово «' + verb + '»: «' + valued + '» принимает одно значение'
        + '\n  починка: ' + advice(valued + ' ' + advicePath(values[valued])));
    }
    refuseCause('неизвестная команда', 'неизвестная команда «' + verb + '»\n  починка: ' + cliCommand('--help'));
  }
  if (verb !== null && mode !== null) {
    refuseCause('команда и режим', 'команда «' + verb + '» и режим «' + mode + '» — разное, вместе они не работают'
      + '\n  починка: ' + advice(verb));
  }
  // Коммит либо не назван, либо назван не один раз — тупика два, а починка одна.
  if (verb === 'explain' && arg.length === 0) {
    refuseCause('нет коммита', 'команде «explain» нужен коммит: имя ревизии (HEAD, ветка, тег),'
      + ' sha или его начало'
      + '\n  починка: ' + advice('explain <коммит>'));
  }
  if (verb === 'explain' && arg.length > 1) {
    refuseCause('лишнее слово', 'команда «explain» принимает один коммит, а не ' + arg.length
      + ': «' + arg.slice(1).join('», «') + '» лишние\n  починка: ' + advice('explain <коммит>'));
  }
  if (verb !== null && verb !== 'explain' && arg.length > 0) {
    refuseCause('лишнее слово', 'команда «' + verb + '» аргументов не принимает: «' + arg[0] + '» лишний'
      + '\n  починка: ' + advice(verb));
  }
  // `--json` — не режим, а форма ответа, и правило у него одно: ответ бывает
  // ровно у четырёх вызовов. Без команды и режима это прежняя форма данных
  // (заморожена эталоном паритета — убрать её нельзя), три команды отвечают
  // своим. У команды без ответа просить нечего, а у режима ответ уже один —
  // запись; оба случая — отказ, и каждый называет своего виновника.
  if (seen.has('--json') && verb !== null && ANSWER_COMMANDS.indexOf(verb) < 0) {
    refuseCause('нет ответа в JSON', 'у команды «' + verb + '» нет ответа в JSON'
      + '\n  починка: ' + advice(verb));
  }
  if (seen.has('--json') && verb === null && mode !== null) {
    refuseCause('два ответа сразу', '«--json» и режим «' + mode + '» — разное: данные или запись, но не оба'
      + '\n  починка: ' + advice(mode));
  }
  return {
    verb: verb,
    mode: mode,
    arg: arg,
    json: seen.has('--json'),
    force: seen.has('--force')
  };
}

/* Данные контракта в stdout — для страницы и для агента: та же правда, что в
 * артефакте, но без вёрстки и без производных величин. Прежняя форма `--json`
 * остаётся нетронутой: она заморожена эталоном паритета (fixtures/parity). */
export function dataMode(cfg, root) {
  process.stdout.write(JSON.stringify(reportData(cfg, root), null, 2) + '\n');
  return sensorNote(cfg);
}

/* Страница отчёта: собирается тем же проходом по истории, что и артефакт — иначе
 * два отчёта могли бы показывать разные числа. Файл кладётся рядом с таблицей,
 * потому что он из неё и растёт. */
const PAGE_NAME = 'size-report.html';

export function pageMode(cfg, root, file) {
  const data = reportData(cfg, root);
  const target = file ? path.resolve(file) : path.join(root, path.dirname(cfg.output), PAGE_NAME);
  const html = pageHtml(data, cfg);
  writeFileEnsured(target, html);
  console.log('✓ ' + path.relative(root, target) + ': ' + data.rows.length + ' строк × '
    + data.files.length + ' файлов, ' + kmb(byteLen(html)));
  return sensorNote(cfg);
}

function jsonMode(cfg, root) {
  const { rows, dropped } = build(cfg, root);
  process.stdout.write(JSON.stringify({
    columns: cfg.columns.map((c) => ({ label: c.label, paths: c.paths })),
    metrics: cfg.metrics,
    rows: rows.map((r) => ({
      sha: r.sha, when: r.when, subject: r.subject,
      section: r.section === null ? null : { id: r.section.id, head: r.section.head, added: r.section.added },
      cells: r.cells,
      totals: totalsOf(r.cells, cfg.metrics)
    })),
    skipped: dropped.map(skipLine)
  }, null, 2) + '\n');
  return sensorNote(cfg);
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
export function sniffColumns(root, limit, skip) {
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

export function initMode(root, file, force) {
  const target = file ? path.resolve(root, file) : path.join(root, CONFIG_NAME);
  if (fs.existsSync(target) && !force) {
    // Совет называет тот же файл, о котором шла речь: `--init --force` без файла
    // перезаписал бы черновиком умолчательное имя, а не тот файл, что человек звал.
    const name = file === undefined || file === null ? CONFIG_NAME : advicePath(file);
    refuseCause('конфиг уже есть', 'конфиг уже есть: ' + target
      + '\n  починка: правьте его или перезапишите черновиком: ' + cliCommand('--init ' + name + ' --force'));
  }
  const journalPath = INIT_JOURNALS.find((p) => fs.existsSync(path.join(root, p))) || '';
  const outDir = fs.existsSync(path.join(root, 'docs')) ? 'docs/' : '';
  const sniffed = sniffColumns(root, 12, [outDir + 'size-table.html']);
  if (sniffed.columns.length === 0) {
    // Черновик всё равно записывается, и это не отказ: работа сделана, а колонки
    // за человека не выберет никто. Поэтому «!», а не «✗»: знак и код выхода не
    // имеют права говорить разное.
    console.error('! не нашлось файлов с известными расширениями (' + INIT_EXTS.join(' ')
      + '): черновик записан без колонок\n  впишите их руками в ' + path.relative(root, target)
      + ' — без колонок проверка настроек скажет «не задано ни одной колонки»');
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
    // Ни в одной ветви нет имени пакета как команды: без манифеста скрипта нет,
    // а имя в реестре — чужой пакет (§refusal.js, invocation).
    fixCommand: hasPkg ? manager + ' run sizes' : invocation() + ' --write',
    metrics: ['raw', 'min', 'tok'],
    // Настоящее сжатие и настоящий словарь, а не приближения: новый проект не
    // должен начинать с приближённых чисел. Плата названа в подсказке ниже: без
    // необязательной зависимости метрика честно отступает к другому счёту и
    // прогон возвращает код 4.
    minify: { engine: 'esbuild' },
    tokens: { family: 'openai', encoding: 'o200k_base' },
    columns: sniffed.columns,
    journal: journalPath
      ? { path: journalPath, url: '../' + journalPath, pattern: '^## (?<id>\\S+)\\s+(?<title>.+?)\\s*$', anchor: 'heading' }
      : null,
    links: { commitUrl: '' },
    rows: { merges: true, sha: true },
    hooks: { enabled: true },
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
  console.log('  метрика min: настоящее сжатие (esbuild); без него — честное упрощение и код 4');
  console.log('  метрика tok: словарь o200k_base (gpt-tokenizer); без него — оценка по длине и код 4');
  console.log('  журнал: ' + (journalPath || 'не найден — ссылки строк будут без разделов'));
  console.log('  дальше: 1) поправьте колонки и метрики — какие файлы важны, знает только проект');
  console.log('          2) ' + (hasPkg
    ? 'добавьте в package.json: "sizes": "size --write", "test:sizes": "size"'
    : 'запуск: ' + cfg.fixCommand + ' (проверка — без --write)'));
  console.log('          3) ' + (hasPkg ? 'добавьте ' + manager + ' run test:sizes в CI' : 'добавьте проверку в CI')
    + '; проверка — команда пакета, своих файлов в проект она не приносит');
  return 0;
}

/* Команды — словами, режимы — ключами: словами называются те два ответа, которых
 * у ключей не было («всё ли посчитано» и «почему нет строки»), а прежние ключи
 * остаются собой. Отказ до этой функции не доходит: разбор либо вернул готовый
 * план, либо уже бросил, и бросил до того, как проект был прочитан. */
export function main() {
  try {
    const cmd = parseArgs(process.argv.slice(2));
    if (cmd.help) {
      process.stdout.write(USAGE);
      return EXIT.OK;
    }
    const root = gitRoot();
    if (cmd.mode === '--init') return initMode(root, cmd.values['--init'], cmd.force);
    const named = cmd.values['--config'];
    const configFile = named ? path.resolve(named) : path.join(root, CONFIG_NAME);
    if (cmd.verb === 'doctor') return doctorMode(root, configFile, cmd.json);
    if (HOOK_COMMANDS.indexOf(cmd.verb) >= 0) return hookMode(cmd.verb, root, configFile);
    const cfg = loadConfig(configFile, root);
    if (cmd.verb === 'check') return coverageMode(cfg, root, configFile, cmd.json);
    if (cmd.verb === 'explain') return explainMode(cfg, root, cmd.arg[0], cmd.json);
    if (cmd.mode === '--data') return dataMode(cfg, root);
    if (cmd.mode === '--page') return pageMode(cfg, root, cmd.values['--page']);
    if (cmd.mode === '--write') return writeMode(cfg, root);
    if (cmd.json) return jsonMode(cfg, root);
    return checkMode(cfg, root);
  } catch (e) {
    if (e instanceof Refusal) {
      console.error('✗ ' + e.message);
      return e.code;
    }
    // Непредвиденное — дефект инструмента, а не тупик пользователя: так это и
    // сказано в тексте (иначе человек ищет ошибку у себя), а стек нужен целиком,
    // иначе такой отказ нечем разбирать.
    console.error('✗ внутренняя ошибка (это дефект инструмента, а не проекта —'
      + ' пришлите, пожалуйста, этот текст целиком):\n' + e.stack);
    return EXIT.INTERNAL;
  }
}


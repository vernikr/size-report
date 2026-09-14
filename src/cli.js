import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { EXIT, Refusal, USAGE, cliCommand, refuse } from './refusal.js';
import { CONFIG_NAME, argValue, gitRoot, loadConfig, validateConfig } from './config.js';
import { MAX_BUF, git, gitArgv, gitEnv } from './git.js';
import { byteLen } from './strip.js';
import { build } from './history.js';
import { reportData } from './data.js';
import { render } from './render.js';
import { totalsOf } from './derived.js';
import { pageHtml } from './page/build.js';

/* Режимы командной строки: проверка, сборка, данные, страница, черновик настроек
 * и разбор аргументов. Единственный модуль, который знает про все остальные
 * сразу, — потому ему и позволено их связывать. */

function kmb(bytes) {
  return Math.round(bytes / 1024) + ' КБ';
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
export function dataMode(cfg, root) {
  process.stdout.write(JSON.stringify(reportData(cfg, root), null, 2) + '\n');
  return 0;
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

export function main() {
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


import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { CONFIG_NAME, validateConfig } from './config.js';
import { advicePath, cliCommand, invocation, refuseCause } from './refusal.js';
import { MAX_BUF, git, gitArgv, gitEnv } from './git.js';
import { writeFileEnsured } from './artifact.js';

/* Черновик настроек для нового проекта: колонки — по расширениям, которые в
 * проекте реально есть (крупнейшие по объёму), журнал — по знакомым именам,
 * output — рядом с доками. Дальше конфиг правят глазами: угадать, какие файлы
 * важны, инструмент не может.
 *
 * Отдельным файлом, а не в `src/config.js`: тот читает и проверяет настройки
 * готового проекта, а этот смотрит на чужой проект впервые и почти всё о нём
 * угадывает. Требование к себе здесь одно и оно жёсткое: **черновик обязан
 * проходить ту же проверку, которой его встретит первый запуск** — иначе отказ из
 * подсказки приводит человека в новый тупик (BLOCKERS §N2, REFACTOR R-0.4).
 */

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

/* Настройки черновика. Подпись артефакта цитирует команду починки, поэтому в
 * проекте без манифеста она указывает на саму команду (иначе таблица ссылалась бы
 * на npm-скрипт, которого там нет), а менеджер пакетов берётся по lock-файлу, а не
 * предположением: команда обязана существовать в чужом проекте. */
function draftConfig(root, outDir, sniffed, journalPath) {
  const hasPkg = fs.existsSync(path.join(root, 'package.json'));
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
  return { cfg: cfg, hasPkg: hasPkg, manager: manager };
}

/* Что сказать человеку после записи: те же строки, что и в подсказке, — что
 * записано, чем заменятся приближения и что делать дальше. Строки собираются
 * списком, а не печатаются по ходу: тогда «что сказано» читается целиком. */
function draftLines(root, target, sniffed, journalPath, draft) {
  const hasPkg = draft.hasPkg;
  return [
    '✓ черновик конфига: ' + path.relative(root, target),
    '  расширения в проекте: ' + (sniffed.exts.join(' ') || '—'),
    '  колонок: ' + sniffed.columns.length + ' (крупнейшие файлы по расширениям)',
    '  метрика min: настоящее сжатие (esbuild); без него — честное упрощение и код 4',
    '  метрика tok: словарь o200k_base (gpt-tokenizer); без него — оценка по длине и код 4',
    '  журнал: ' + (journalPath || 'не найден — ссылки строк будут без разделов'),
    '  дальше: 1) поправьте колонки и метрики — какие файлы важны, знает только проект',
    '          2) ' + (hasPkg
      ? 'добавьте в package.json: "sizes": "size --write", "test:sizes": "size"'
      : 'запуск: ' + draft.cfg.fixCommand + ' (проверка — без --write)'),
    '          3) ' + (hasPkg ? 'добавьте ' + draft.manager + ' run test:sizes в CI' : 'добавьте проверку в CI')
      + '; проверка — команда пакета, своих файлов в проект она не приносит'
  ];
}

/* Черновик без колонок — не отказ, а примечание: работа сделана, а колонки за
 * человека не выберет никто. Поэтому «!», а не «✗»: знак и код выхода не имеют
 * права говорить разное (каталог отказов считает такие знаки отдельно). */
function noteNoColumns(root, target, sniffed) {
  if (sniffed.columns.length > 0) return;
  console.error('! не нашлось файлов с известными расширениями (' + INIT_EXTS.join(' ')
    + '): черновик записан без колонок\n  впишите их руками в ' + path.relative(root, target)
    + ' — без колонок проверка настроек скажет «не задано ни одной колонки»');
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
  const draft = draftConfig(root, outDir, sniffed, journalPath);
  noteNoColumns(root, target, sniffed);
  // Черновик обязан проходить ту же проверку, которой его встретит первый запуск:
  // иначе отказ из подсказки приводит в новый тупик. Проект без знакомых
  // расширений — исключение: колонок нет вовсе, и черновик правят руками.
  if (draft.cfg.columns.length > 0) validateConfig(Object.assign({}, draft.cfg, { path: target }));
  writeFileEnsured(target, JSON.stringify(draft.cfg, null, 2) + '\n');
  draftLines(root, target, sniffed, journalPath, draft).forEach((line) => console.log(line));
  return 0;
}

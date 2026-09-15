#!/usr/bin/env node
/* Собирает синтетическую фикстуру size-report: маленький репозиторий с историей,
 * в которой собраны ловушки настоящих проектов, плюс bundle для переноса.
 *
 * Зачем. Проверять движок на истории живого проекта нельзя: она меняется, она
 * большая, и половины ловушек в ней нет. Фикстура детерминирована — автор, даты и
 * содержимое зафиксированы, поэтому sha коммитов воспроизводимы. Эталонные числа
 * (`golden.json`) снимаются с замороженной копии реализации один раз, и дальше
 * перенос обязан их воспроизвести.
 *
 * Здесь — **вход**: разбор ключей, настройки фикстуры, снятие эталона и манифест.
 * Сюжеты сборки лежат рядом (`tools/synthetic/`), потому что это разные вопросы:
 * `repo.js` — как говорим с git (время, автор, закрепления), `content.js` — что
 * лежит в файлах, `history.js` — какие коммиты из этого получаются, `note.js` — что
 * об этом читает человек. Список ловушек — в записке, а не в коде: он её часть.
 *
 * Инструмент и окружение снятия закреплены. Копия берётся из истории
 * (`fixtures/legacy/size-table.cjs`, `REFACTOR.md` R-1.5), поэтому пересъём не
 * зависит от того, держит ли проект-потребитель свою копию. Окружение — `core.quotePath=false`: у копии
 * нет починки B1, и машина с настройками git по умолчанию потеряла бы в фикстуре
 * строку с не-английским именем файла — эталон молча стал бы короче.
 *
 * Запуск (из корня репозитория size-report):
 *   node tools/make-fixture.js                       # бандл + конфиг + эталон
 *   node tools/make-fixture.js --legacy-tool <путь>   # другой инструмент, если он нужен
 *   node tools/make-fixture.js --bundle-only          # только бандл (без эталона)
 *   node tools/make-fixture.js --keep                 # не удалять временный репозиторий
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LEGACY_PATH, MAX_BUF, gitConfig, legacyTool as legacyCopy, sha256 } from './harness.js';
/* Значение ключа читается тем же способом, что у движка пакета (`src/config.js`),
 * а не своим разбором: «ключ без значения» — общий вопрос, и вторая его копия
 * разошлась бы с первой так же тихо, как расходятся любые две копии (нашёл `dup`). */
import { argValue } from '../src/config.js';
import { git } from './synthetic/repo.js';
import { buildRepo } from './synthetic/history.js';
import { ARTIFACT } from './synthetic/content.js';
import { fixtureNote } from './synthetic/note.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'fixtures', 'synthetic');

/* Окружение снятия эталона — то же, что у проверок замороженной копии
 * (`harness.FROZEN`): без закрепления чтения путей эталон снимается другим. */
const FROZEN_ENV = gitConfig({ 'core.quotePath': 'false' });

// --- конфиг фикстуры --------------------------------------------------------

const CONFIG = {
  output: ARTIFACT,
  locale: 'ru',
  title: 'Объём файлов по коммитам — фикстура',
  heading: 'Фикстура: история с ловушками',
  fixCommand: 'node tools/size-table.js --write',
  metrics: ['raw', 'min'],
  columns: [
    { label: 'code.js', paths: ['src/code.js'] },
    { label: 'modern.js', paths: ['src/modern.js', 'src/legacy.js'] },
    { label: 'config.mjs', paths: ['src/config.mjs'] },
    { label: 'заметки.md', paths: ['docs/заметки.md'] },
    { label: 'crlf.txt', paths: ['notes/crlf.txt'] },
    { label: 'package.json', paths: ['package.json'] },
    { label: 'style.css', paths: ['src/style.css'] },
    { label: 'table.toml', paths: ['data/table.toml'] },
    { label: 'empty.js', paths: ['src/empty.js'] },
    { label: 'WORKLOG.md', paths: ['WORKLOG.md'] }
  ],
  journal: {
    path: 'WORKLOG.md',
    url: '../WORKLOG.md',
    pattern: '^## (?<id>\\d+)\\.\\s+(?<title>.+?)\\s*$',
    anchor: 'heading'
  },
  links: { commitUrl: '' },
  rows: { merges: true, sha: true },
  skip: []
};

/* --- ключи, история и эталон ------------------------------------------------- */

function options(args) {
  /* Пустое значение — это «ключ назван без значения», то есть значение не названо:
   * `--out` без пути берёт умолчание, `--legacy-tool` без пути — встроенную копию. */
  const out = argValue(args, '--out');
  const legacy = argValue(args, '--legacy-tool');
  const named = typeof legacy === 'string' && legacy !== '';
  const tool = named ? path.resolve(legacy) : legacyCopy();
  /* В записи о происхождении называется путь, под которым копия лежала, а не сегодняшнее
   * место её байтов: запись — это история эталона, и она обязана сходиться с тем, что
   * записано в снятом манифесте, а его не переписывает никакой переезд. */
  return {
    out: path.resolve(out === null || out === '' ? OUT : out),
    tool: tool,
    name: named ? path.relative(ROOT, tool) : LEGACY_PATH,
    bundleOnly: args.indexOf('--bundle-only') >= 0,
    keep: args.indexOf('--keep') >= 0
  };
}

function commitLog(repo) {
  return git(repo, ['log', '--reverse', '--date=format:%Y-%m-%d %H:%M',
    '--pretty=format:%H' + '\u0001' + '%ad' + '\u0001' + '%s'])
    .split('\n').filter((l) => l !== '').map((line) => {
      const f = line.split('\u0001');
      return { sha: f[0], when: f[1], subject: f[2] };
    });
}

function runLegacy(tool, dir, cfgPath, args, env) {
  const res = spawnSync(process.execPath, [tool, '--config', cfgPath].concat(args), {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: MAX_BUF,
    env: Object.assign({}, process.env, FROZEN_ENV, env || {})
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/* Артефакт собирается на клоне, а не в собранном репозитории: `--write` пишет файл,
 * и в фикстуре он обязан остаться неотслеживаемым, а не восемнадцатым коммитом. */
function takeArtifact(paths, clone) {
  const wrote = runLegacy(paths.tool, clone, paths.config, ['--write']);
  if (wrote.code !== 0) throw new Error('инструмент не собрал артефакт: ' + wrote.stderr.trim());
  const artifact = fs.readFileSync(path.join(clone, CONFIG.output));
  fs.writeFileSync(path.join(paths.out, 'artifact.sha256'),
    sha256(artifact) + '  ' + CONFIG.output + '\n', 'utf8');
  return artifact;
}

/* Пути вне ASCII: git цитирует их в зависимости от локали, и если числа от этого
 * меняются, эталон непереносим — это надо знать до, а не после. */
function localeStable(paths, clone, data) {
  const cLocale = runLegacy(paths.tool, clone, paths.config, ['--json'], { LC_ALL: 'C', LANG: 'C' });
  const cData = cLocale.code === 0 ? JSON.parse(cLocale.stdout) : null;
  return !!cData && JSON.stringify(cData) === JSON.stringify(data);
}

function takeGolden(paths, ctx) {
  if (!fs.existsSync(paths.tool)) {
    throw new Error('нет инструмента, с которого снимать эталон: ' + paths.tool
      + ' (укажите --legacy-tool <путь>)');
  }
  const clone = path.join(paths.work, 'clone');
  git(paths.work, ['clone', '-q', paths.bundle, clone]);
  const json = runLegacy(paths.tool, clone, paths.config, ['--json']);
  if (json.code !== 0) throw new Error('инструмент не отдал --json: ' + json.stderr.trim());
  const data = JSON.parse(json.stdout);
  const golden = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(paths.out, 'golden.json'), golden, 'utf8');

  const artifact = takeArtifact(paths, clone);
  // Контрольный режим обязан быть зелёным: эталон снят с согласованного артефакта.
  const checked = runLegacy(paths.tool, clone, paths.config, []);
  if (checked.code !== 0) throw new Error('контрольный режим на фикстуре красный: ' + checked.stderr.trim());

  ctx.localeStable = localeStable(paths, clone, data);
  ctx.legacy = {
    file: paths.name,
    sha256: sha256(fs.readFileSync(paths.tool)),
    rows: data.rows.length,
    columns: data.columns.length,
    metrics: data.metrics,
    skipped: data.skipped.length,
    artifactBytes: artifact.length,
    artifactSha256: sha256(artifact),
    goldenSha256: sha256(golden)
  };
}

/* Манифест — личность фикстуры: sha коммитов и хеши всех файлов рядом. Сам себя
 * он в список не берёт (иначе манифест зависел бы от манифеста). */
function writeManifest(out, ctx) {
  const files = fs.readdirSync(out).sort().reduce((acc, name) => {
    const full = path.join(out, name);
    if (fs.statSync(full).isFile() && name !== 'manifest.json') {
      acc[name] = { bytes: fs.statSync(full).size, sha256: sha256(fs.readFileSync(full)) };
    }
    return acc;
  }, {});
  const manifest = {
    schema: 1,
    kind: 'synthetic',
    head: ctx.head,
    commits: ctx.commits,
    files: files,
    localeStable: ctx.localeStable,
    legacy: ctx.legacy
  };
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

function announce(bundle, ctx) {
  console.log('✓ фикстура: ' + path.relative(ROOT, path.dirname(bundle)));
  console.log('  коммитов ' + ctx.commits.length + ', HEAD ' + ctx.head.slice(0, 7)
    + ', bundle ' + fs.statSync(bundle).size + ' Б');
  if (ctx.legacy) {
    console.log('  эталон: ' + ctx.legacy.rows + ' строк × ' + ctx.legacy.columns + ' колонок, '
      + ctx.legacy.skipped + ' коммитов без строки, артефакт ' + ctx.legacy.artifactBytes + ' Б');
    console.log('  инструмент ' + ctx.legacy.file + ' sha256 ' + ctx.legacy.sha256.slice(0, 12));
  }
  if (!ctx.localeStable) {
    console.log('  ! эталон зависит от локали: числа при LC_ALL=C отличаются (см. README фикстуры)');
  }
}

function main() {
  const opts = options(process.argv.slice(2));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-fixture-'));
  try {
    const repo = path.join(work, 'repo');
    buildRepo(repo);
    const log = commitLog(repo);
    const head = git(repo, ['rev-parse', 'HEAD']).trim();
    if (log.length === 0 || log[log.length - 1].sha !== head) {
      throw new Error('история фикстуры собрана неверно');
    }

    fs.mkdirSync(opts.out, { recursive: true });
    const bundle = path.join(opts.out, 'history.bundle');
    git(repo, ['bundle', 'create', bundle, '--all']);
    const config = path.join(opts.out, 'config.json');
    fs.writeFileSync(config, JSON.stringify(CONFIG, null, 2) + '\n', 'utf8');

    const ctx = { head: head, commits: log, localeStable: true, legacy: null };
    if (!opts.bundleOnly) {
      takeGolden({ tool: opts.tool, name: opts.name, out: opts.out, work: work,
        bundle: bundle, config: config }, ctx);
    }
    fs.writeFileSync(path.join(opts.out, 'README.md'), fixtureNote(ctx), 'utf8');
    writeManifest(opts.out, ctx);
    announce(bundle, ctx);
  } finally {
    if (opts.keep) console.log('  временный каталог: ' + work);
    else fs.rmSync(work, { recursive: true, force: true });
  }
}

try {
  main();
} catch (e) {
  console.error('✗ ' + (e && e.message ? e.message : e));
  if (e && e.stderr) console.error(String(e.stderr).trim());
  process.exitCode = 1;
}

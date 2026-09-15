#!/usr/bin/env node
/* Снимает эталон паритета: как замороженная копия реализации
 * (`fixtures/legacy/size-table.cjs`, байты которой лежат в истории — `REFACTOR.md`
 * R-1.5) считает числа и собирает артефакт на той ревизии проекта-потребителя,
 * которая записана в манифесте эталона.
 *
 * Зачем. «Перенос ничего не сломал» — утверждение, которое надо доказывать. Для
 * этого фиксируются три вещи: полный вывод `--json` (числа строк и клеток), хеш
 * собранного артефакта (форма отчёта) и хеш самого инструмента (какая именно
 * ревизия этот эталон дала).
 *
 * Обе стороны пары закреплены. Инструмент — встроенная копия, поэтому пересъём
 * не зависит от того, держит ли проект свою копию. Ревизия — из манифеста:
 * эталон неподвижен, иначе пересъём уезжал бы следом за чужим проектом, а
 * сверять с ним стало бы нечего; сдвинуть ревизию — осознанное действие
 * (`--at`). Окружение снятия закреплено тем же способом, что и у проверок
 * (`core.quotePath=false`): у копии нет починки B1, и на машине с настройками
 * git по умолчанию эталон молча потерял бы строку.
 *
 * Артефакт не берётся из ревизии, а собирается копией и сверяется с лежащим в
 * ревизии: так эталон доказывает, что форма отчёта снята тем же инструментом, а
 * не просто описана рядом. Контрольный режим копии на своём артефакте обязан
 * быть зелёным — иначе эталон описывает несогласованный отчёт.
 *
 * Проект открывается только на чтение и только на клоне: в потребителе не
 * трогается ничего.
 *
 * Запуск (из корня репозитория size-report):
 *   node tools/parity-freeze.js [путь-к-проекту] [--at <sha>] [--out <каталог>]
 *
 * По умолчанию проект — записанный в манифесте, каталог — `fixtures/parity`.
 * Перезапись эталона — осознанное действие: молча он не обновляется ничем.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LEGACY_PATH, MAX_BUF, gitConfig, legacyTool, sha256 } from './harness.js';
import { CONFIG_NAME } from '../src/config.js';
import { gitArgv, gitEnv } from '../src/git.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PROJECT = path.join(ROOT, '..', 'figma', 'safe-resets');
const DEFAULT_OUT = path.join(ROOT, 'fixtures', 'parity');

/* stderr задан явно, хотя он и не читается: без этого `execFileSync` дублирует его
 * в наш stderr, и замечание самого git (`hint: Using 'master' …`) становится
 * первой строкой нашего сообщения об отказе, а причина — невидимой. */
/* Закрепления — тот же список, что у движка и проверок: эталон снимается одним и
 * тем же чтением git независимо от машины. */
function git(dir, args) {
  return execFileSync('git', gitArgv(args),
    { cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv(), stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitBytes(dir, args) {
  return execFileSync('git', gitArgv(args),
    { cwd: dir, maxBuffer: MAX_BUF, env: gitEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
}

/* Копия запускается закреплённым окружением — тем же, что у проверок
 * (`harness.FROZEN`): без него эталон снимается другими числами. */
function legacy(dir, args) {
  const res = spawnSync(process.execPath, [legacyTool(), '--config', path.join(dir, CONFIG_NAME)].concat(args), {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: MAX_BUF,
    env: Object.assign({}, process.env, gitConfig({ 'core.quotePath': 'false' }))
  });
  if (res.status !== 0) {
    throw new Error('копия не отработала (' + (args.join(' ') || 'контрольный режим')
      + ', код ' + res.status + '): ' + (res.stderr || '').trim());
  }
  return res.stdout || '';
}

/* Разбор аргументов: флагу может принадлежать значение, поэтому позиционный
 * аргумент — это тот, что не является ни флагом, ни значением флага. */
function parseArgs(args) {
  const out = { positional: null, flags: {} };
  for (let i = 0; i < args.length; i++) {
    if (args[i].indexOf('--') === 0) {
      const next = args[i + 1];
      if (next !== undefined && next.indexOf('--') !== 0) { out.flags[args[i]] = next; i++; }
      else out.flags[args[i]] = true;
      continue;
    }
    if (out.positional === null) out.positional = args[i];
  }
  return out;
}

/* Описание эталона для человека: что лежит рядом и что с этим делать. Пересъём не
 * требует аргументов — проект и ревизия записаны в манифесте. */
function manifestNote(ctx) {
  return [
    '# Эталон паритета',
    '',
    'Снято с проекта-потребителя замороженной копией реализации скриптом',
    '`tools/parity-freeze.js`. Не правим руками: любое расхождение с этим эталоном —',
    'это либо найденная ошибка переноса, либо осознанное изменение формы отчёта, и',
    'тогда эталон переснимают.',
    '',
    '| Файл | Что внутри |',
    '|---|---|',
    '| `data.json` | Полный вывод `--json` замороженной копии на этой ревизии проекта |',
    '| `config.json` | Копия настроек проекта на той же ревизии |',
    '| `artifact.sha256` | Хеш собранного артефакта — форма отчёта доказывается побайтово |',
    '| `manifest.json` | sha коммита, число коммитов, хеши инструмента и эталонных файлов |',
    '',
    'Проект: `' + ctx.project.name + '`, HEAD `' + ctx.project.head.slice(0, 12) + '`',
    '(' + ctx.project.commits + ' коммитов, дата автора HEAD: ' + ctx.project.headDate + ').',
    'Инструмент: `' + ctx.tool.file + '`, sha256 `' + ctx.tool.sha256.slice(0, 12) + '`.',
    'Строк в эталоне: ' + ctx.data.rows + ', колонок: ' + ctx.data.columns
      + ', метрики: ' + ctx.data.metrics.join(', ') + '.',
    '',
    'Переснять: `node tools/parity-freeze.js`; сдвинуть ревизию — `--at <sha>`.'
  ].join('\n') + '\n';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = path.resolve(args.flags['--out'] || DEFAULT_OUT);
  const manifestFile = path.join(out, 'manifest.json');
  const frozen = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
  const project = path.resolve(args.positional || (frozen ? frozen.project.path : DEFAULT_PROJECT));
  const want = args.flags['--at'] || (frozen ? frozen.project.head : null);

  if (!fs.existsSync(project)) {
    throw new Error('проект не найден: ' + project
      + '\n  укажите путь: node tools/parity-freeze.js <путь-к-проекту>');
  }
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-parity-'));
  try {
    const clone = path.join(work, 'clone');
    git(work, ['clone', '-q', '--no-hardlinks', project, clone]);
    /* Обрезанность проверяется у клона, а не у источника: источником может быть
     * и бандл истории (файл), у которого своего рабочего дерева нет. */
    if (git(clone, ['rev-parse', '--is-shallow-repository']) === 'true') {
      throw new Error('история проекта обрезана (shallow): эталон снимается только с полной истории');
    }
    const at = want || git(clone, ['rev-parse', 'HEAD']);
    try {
      git(clone, ['checkout', '-q', at]);
    } catch (_e) {
      throw new Error('в проекте нет ревизии ' + at + ' — эталон снимается только с той, что в нём есть');
    }
    const head = git(clone, ['rev-parse', 'HEAD']);
    const short = head.slice(0, 7);

    if (!fs.existsSync(path.join(clone, CONFIG_NAME))) {
      throw new Error('в ревизии ' + short + ' нет ' + CONFIG_NAME + ' — эталону нечего описывать');
    }
    const cfg = JSON.parse(fs.readFileSync(path.join(clone, CONFIG_NAME), 'utf8'));
    const headDate = git(clone, ['log', '-1', '--date=format:%Y-%m-%d %H:%M', '--pretty=format:%ad', head]);
    const commits = Number(git(clone, ['rev-list', '--count', head]));
    const data = JSON.parse(legacy(clone, ['--json']));

    legacy(clone, ['--write']);
    const artifact = fs.readFileSync(path.join(clone, cfg.output));
    if (!artifact.equals(gitBytes(clone, ['show', head + ':' + cfg.output]))) {
      throw new Error('копия собрала не тот артефакт, что лежит в ревизии ' + short
        + ' — эталон снимается не этой ревизией инструмента');
    }
    legacy(clone, []);

    fs.mkdirSync(out, { recursive: true });
    const write = (name, bytes) => fs.writeFileSync(path.join(out, name), bytes);
    const dataBytes = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8');
    const configBytes = Buffer.from(JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    write('data.json', dataBytes);
    write('config.json', configBytes);
    write('artifact.sha256', sha256(artifact) + '  ' + cfg.output + '\n');

    const ctx = {
      schema: 1,
      kind: 'parity',
      project: { path: project, name: path.basename(project), head, headDate, commits },
      tool: { file: LEGACY_PATH, sha256: sha256(fs.readFileSync(legacyTool())) },
      artifact: { path: cfg.output, bytes: artifact.length, sha256: sha256(artifact) },
      data: {
        rows: data.rows.length,
        columns: data.columns.length,
        metrics: data.metrics,
        sha256: sha256(dataBytes)
      },
      config: { sha256: sha256(configBytes) }
    };
    write('manifest.json', Buffer.from(JSON.stringify(ctx, null, 2) + '\n', 'utf8'));
    write('README.md', Buffer.from(manifestNote(ctx), 'utf8'));

    console.log('✓ эталон паритета: ' + path.relative(ROOT, out));
    console.log('  проект ' + ctx.project.name + ' на ' + head.slice(0, 7) + ': '
      + commits + ' коммитов, ' + data.rows.length + ' строк × ' + data.columns.length + ' колонок');
    console.log('  артефакт ' + cfg.output + ': ' + artifact.length + ' Б, sha256 '
      + ctx.artifact.sha256.slice(0, 12));
    console.log('  инструмент ' + ctx.tool.file + ' sha256 ' + ctx.tool.sha256.slice(0, 12)
      + ' — эталон привязан к этой ревизии');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

try {
  main();
} catch (e) {
  console.error('✗ ' + (e && e.message ? e.message : e));
  process.exitCode = 1;
}

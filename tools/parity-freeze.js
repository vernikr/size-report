#!/usr/bin/env node
/* Снимает эталон паритета: как текущий инструмент (tools/size-table.js проекта-
 * потребителя) считает числа и собирает артефакт на своём HEAD.
 *
 * Зачем. «Перенос ничего не сломал» — утверждение, которое надо доказывать. Для
 * этого фиксируются три вещи: полный вывод `--json` (числа строк и клеток), хеш
 * собранного артефакта (форма отчёта) и хеш самого инструмента (какая именно
 * ревизия этот эталон дала). Шаг 1 плана обязан воспроизвести их побайтово.
 *
 * Запуск (из корня репозитория size-report):
 *   node tools/parity-freeze.js [путь-к-проекту] [--out <каталог>]
 *
 * По умолчанию проект — `../figma/safe-resets`, каталог — `fixtures/parity`.
 * Перезапись эталона — осознанное действие: молча он не обновляется ничем.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PROJECT = path.join(ROOT, '..', 'figma', 'safe-resets');
const MAX_BUF = 256 * 1024 * 1024;

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF }).trim();
}

function node(dir, argv) {
  return execFileSync(process.execPath, argv, { cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF });
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

/* Описание эталона для человека: что лежит рядом и что с этим делать. */
function manifestNote(ctx) {
  return [
    '# Эталон паритета',
    '',
    'Снято с проекта-потребителя скриптом `tools/parity-freeze.js`. Не правим руками:',
    'любое расхождение с этим эталоном на шаге 1 плана — это либо найденная ошибка',
    'переноса, либо осознанное изменение формы отчёта, и тогда эталон переснимают.',
    '',
    '| Файл | Что внутри |',
    '|---|---|',
    '| `data.json` | Полный вывод `--json` текущего инструмента на этом HEAD |',
    '| `config.json` | Копия настроек проекта на тот же HEAD |',
    '| `artifact.sha256` | Хеш собранного артефакта — форма отчёта доказывается побайтово |',
    '| `manifest.json` | sha коммита, число коммитов, хеши инструмента и эталонных файлов |',
    '',
    'Проект: `' + ctx.project.name + '`, HEAD `' + ctx.project.head.slice(0, 12) + '`',
    '(' + ctx.project.commits + ' коммитов, дата автора HEAD: ' + ctx.project.headDate + ').',
    'Инструмент: `' + ctx.tool.file + '`, sha256 `' + ctx.tool.sha256.slice(0, 12) + '`.',
    'Строк в эталоне: ' + ctx.data.rows + ', колонок: ' + ctx.data.columns
      + ', метрики: ' + ctx.data.metrics.join(', ') + '.',
    '',
    'Переснять: `node tools/parity-freeze.js ' + ctx.project.path + '`.'
  ].join('\n') + '\n';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const project = path.resolve(args.positional || DEFAULT_PROJECT);
  const out = path.resolve(args.flags['--out'] || path.join(ROOT, 'fixtures', 'parity'));

  const toolFile = path.join(project, 'tools', 'size-table.js');
  const cfgFile = path.join(project, 'size-table.config.json');
  if (!fs.existsSync(toolFile) || !fs.existsSync(cfgFile)) {
    throw new Error('в ' + project + ' нет tools/size-table.js или size-table.config.json');
  }
  if (git(project, ['rev-parse', '--is-shallow-repository']) === 'true') {
    throw new Error('история проекта обрезана (shallow): эталон снимается только с полной истории');
  }

  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  const head = git(project, ['rev-parse', 'HEAD']);
  const headDate = git(project, ['log', '-1', '--date=format:%Y-%m-%d %H:%M', '--pretty=format:%ad']);
  const commits = Number(git(project, ['rev-list', '--count', 'HEAD']));
  const data = JSON.parse(node(project, ['tools/size-table.js', '--json']));

  const artifactPath = path.join(project, cfg.output);
  if (!fs.existsSync(artifactPath)) {
    throw new Error('нет артефакта ' + cfg.output + ' — соберите его перед снятием эталона');
  }
  const artifact = fs.readFileSync(artifactPath);

  fs.mkdirSync(out, { recursive: true });
  const write = (name, text) => fs.writeFileSync(path.join(out, name), text);
  const dataBytes = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8');
  const configBytes = Buffer.from(JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  write('data.json', dataBytes);
  write('config.json', configBytes);
  write('artifact.sha256', sha256(artifact) + '  ' + cfg.output + '\n');

  const ctx = {
    schema: 1,
    kind: 'parity',
    project: { path: project, name: path.basename(project), head, headDate, commits },
    tool: { file: 'tools/size-table.js', sha256: sha256(fs.readFileSync(toolFile)) },
    artifact: { path: cfg.output, bytes: artifact.length, sha256: sha256(artifact) },
    data: {
      rows: data.rows.length,
      columns: data.columns.length,
      metrics: data.metrics,
      sha256: sha256(dataBytes)
    },
    config: { sha256: sha256(configBytes) }
  };
  write('manifest.json', JSON.stringify(ctx, null, 2) + '\n');
  write('README.md', manifestNote(ctx));

  console.log('✓ эталон паритета: ' + path.relative(ROOT, out));
  console.log('  проект ' + ctx.project.name + ' на ' + head.slice(0, 7) + ': '
    + commits + ' коммитов, ' + data.rows.length + ' строк × ' + data.columns.length + ' колонок');
  console.log('  артефакт ' + cfg.output + ': ' + artifact.length + ' Б, sha256 ' + ctx.artifact.sha256.slice(0, 12));
  console.log('  инструмент sha256 ' + ctx.tool.sha256.slice(0, 12) + ' — эталон привязан к этой ревизии');
}

try {
  main();
} catch (e) {
  console.error('✗ ' + (e && e.message ? e.message : e));
  process.exitCode = 1;
}

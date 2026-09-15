/* Общее для датчиков: корень, разбор ключей, запуск процесса, машинные отчёты.
 * Одна копия на пять датчиков — иначе разбор ключей и запись отчёта разъезжаются
 * так же, как разъезжались два расчёта отчёта до R-1.1.
 *
 * Отчёты — машинные (JSON, две пробела, перевод строки в конце: диффится по
 * строкам) и лежат в `reports/`, а он в `.gitignore`: отчёт — это то, что смотрит
 * человек, а не то, что хранит история.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitArgv, gitEnv } from '../../src/git.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPORTS = path.join(ROOT, 'reports');

/* Что вообще сканируется: настоящий код пакета. Конфиги в корне — датчики, они
 * сканируются собой же, и попадание их в свой обход дало бы самоссылку. */
export const CODE = ['src', 'bin', 'tools', 'test'];

/* Ключи разбираются одним способом на все датчики: `--ключ значение` и ключи-флаги;
 * всё остальное — пути. */
export function parseArgs(args, values, bools) {
  const out = { flags: {}, rest: [] };
  for (let i = 0; i < args.length; i++) {
    if (values.indexOf(args[i]) >= 0) { out.flags[args[i]] = args[i + 1]; i++; continue; }
    if (bools.indexOf(args[i]) >= 0) { out.flags[args[i]] = true; continue; }
    out.rest.push(args[i]);
  }
  return out;
}

export function pathsOf(args, fallback) {
  const named = args.flags['--paths'];
  if (named !== undefined) return named.split(',').filter((p) => p !== '');
  return args.rest.length === 0 ? (fallback || CODE) : args.rest;
}

export function run(cmd, argv, options) {
  return spawnSync(cmd, argv, Object.assign({
    cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024
  }, options || {}));
}

/* Чтение git — через границу пакета (`src/git.js`), а не как есть: там закреплены
 * настройки, которые меняют прочитанное (`core.quotePath` закавычивает не-английские
 * пути, локаль меняет разбор). Датчики читают имена файлов и сверяют их с правилами,
 * поэтому незакреплённое чтение было бы зелено здесь и красно на машине с настройками
 * по умолчанию (`BLOCKERS.md` §B1, `test/git-pins.test.js`). */
export function git(args, options) {
  return run('git', gitArgv(args), Object.assign({ env: gitEnv() }, options || {}));
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/* Запись отчёта: каталог создаётся, а старый отчёт перезаписывается целиком —
 * «доклеенного» прошлого прогона в отчёте быть не должно. */
export function writeReport(name, data) {
  fs.mkdirSync(REPORTS, { recursive: true });
  const file = path.join(REPORTS, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return file;
}

export function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

export function ok(text) {
  console.log('✓ ' + text);
}

/* Красный — это код возврата 1 и строка в stderr: у датчика один язык отчёта, и
 * он же язык отказа инструмента (`src/refusal.js`). */
export function bad(text) {
  console.error('✗ ' + text);
  process.exitCode = 1;
}

export function indent(text) {
  return String(text).split('\n').map((l) => '    ' + l).join('\n');
}

/* Обвязка проб датчиков (`test/gates-*.test.js`): датчик зовётся **командой**, а не
 * импортом — импорт не проверяет ни разбор ключей, ни код выхода, то есть не
 * проверяет ровно то, чем датчик и работает. Каталог, запуск и разбор ответа —
 * в одном месте: пять копий разошлись бы так же тихо, как расходились две копии
 * расчёта отчёта до R-1.1.
 *
 * Проба искусственного нарушения — не украшение: датчик, который нельзя сделать
 * красным, ничего не стережёт, а «зелено» от него ничего не значит.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitArgv, gitEnv } from '../src/git.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* Запуск чего угодно с общим буфером и разбором ответа. Ответ склеивается из stdout и
 * stderr нарочно: датчик пишет вердикт в stdout, а причины — в stderr, и проверке
 * нужны обе половины. */
export function exec(cmd, argv, options) {
  const res = spawnSync(cmd, argv, Object.assign({
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  }, options || {}));
  return { code: res.status === null ? 1 : res.status, out: (res.stdout || '') + (res.stderr || '') };
}

/* Датчик — по имени файла из `tools/gates/`: `probe('dup', ['--update'])`. */
export function probe(gate, argv, options) {
  return exec(process.execPath, ['tools/gates/' + gate + '.js'].concat(argv || []), options);
}

/* git в пробах — с тем же закреплением настроек, что у пакета (`src/git.js`):
 * незакреплённое чтение зелено здесь и красно на машине с настройками по умолчанию,
 * а для проб это ровно та же ложная сеть (`test/git-pins.test.js`). */
export function git(args, options) {
  return exec('git', gitArgv(args), Object.assign({ env: gitEnv() }, options || {}));
}

/* Временный каталог — по настоящему пути: на macOS `/tmp` — ссылка на `/private/tmp`,
 * и разборщик связей считает один и тот же файл двумя модулями (в пробе это дало
 * ложную «сироту»: у одной копии пути связь была, у другой — нет). */
export function tempDir(prefix) {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-' + prefix + '-')));
}

export function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function pkg() {
  return readJson(path.join(ROOT, 'package.json'));
}

/* Вердикт датчика — код возврата: 0 — зелено, иначе красный. Разбор вывода нужен
 * проверкам отдельно, поэтому наружу идут оба. */
export function red(result) {
  return result.code !== 0;
}

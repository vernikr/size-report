/* Общая часть проверок на фикстуре: пути, свежий клон и запуск инструмента так,
 * как его зовёт пользователь. Это не набор проверок, а помощник для них.
 *
 * Лежит в `tools/`, а не в `test/`: раннер Node считает набором любой `.js` в
 * каталоге `test/` (и любой `test-*.js` где угодно), исполнил бы помощник как
 * пустой набор и уронил бы счётчики. Здесь он просто модуль, который наборы
 * импортируют.
 *
 * Два набора, написанных раньше, держат свои копии этих помощников; их перевод
 * сюда — отдельный пункт (`REFACTOR.md` R-3.1). */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SYNTH = path.join(ROOT, 'fixtures', 'synthetic');
export const BUNDLE = path.join(SYNTH, 'history.bundle');
export const CONFIG = path.join(SYNTH, 'config.json');
export const PACKAGE_BIN = path.join(ROOT, 'bin', 'size.js');
export const MAX_BUF = 256 * 1024 * 1024;

export function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-' + name + '-'));
}

/* Клон фикстуры без общей истории файлов: он же рабочее дерево для проверок,
 * которые правят файлы. */
export function cloneFixture(into) {
  execFileSync('git', ['clone', '-q', '--no-hardlinks', BUNDLE, into],
    { encoding: 'utf8', maxBuffer: MAX_BUF });
  return into;
}

/* Запуск команды как её видит пользователь: `node bin/size.js …`.
 * `env` досыпается к окружению процесса — так проверяются чужие настройки git. */
export function runSize(dir, args, env) {
  const res = spawnSync(process.execPath, [PACKAGE_BIN].concat(args), {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: MAX_BUF,
    env: env ? Object.assign({}, process.env, env) : process.env
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// Тот же запуск, но с эталонными настройками фикстуры — их читает большинство проверок.
export function runFixture(dir, args, env) {
  return runSize(dir, ['--config', CONFIG].concat(args), env);
}

export function gitIn(dir, args) {
  return execFileSync('git', ['-C', dir].concat(args), { encoding: 'utf8', maxBuffer: MAX_BUF });
}

export function firstLine(text) {
  return text.trim().split('\n')[0];
}

/* Стек наружу не отдаётся: в нём нет подсказки починки, зато есть пути машины.
 * Кадры V8 начинаются с отступа и `at `. */
export function hasStack(text) {
  return /^\s+at /.test(text);
}

// Команда починки из сообщения: `node <путь> --init`.
export function commandIn(text) {
  const m = /node\s+(\S+)\s+(--\S+)/.exec(text);
  return m === null ? null : { file: m[1], flag: m[2] };
}

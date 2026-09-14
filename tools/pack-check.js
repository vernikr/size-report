#!/usr/bin/env node
/* Работает ли движок из собранного пакета, а не только из репозитория.
 *
 * Зачем отдельно. Пакет читает соседние исходники с диска: сборка страницы
 * вклеивает `derived.js` и `page/app.js`, а модули ссылаются друг на друга
 * относительными путями. Такой модуль легко сделать работающим в репозитории и
 * ломающимся у того, кто его установил: достаточно, чтобы файл не доехал в
 * тарболл (`files` в `package.json`) или чтобы путь считался не от места модуля.
 * Поэтому проверка идёт с распакованного тарболла, а не из рабочего дерева.
 *
 * Что сверяется: все исходники доехали; `--json` из пакета равен выводу движка из
 * репозитория; собранные артефакт и страница — побайтово равны.
 *
 * Работает на клонах фикстуры: ни репозиторий, ни `docs/` проекта не трогаются.
 *
 * Запуск:
 *   node tools/pack-check.js
 *
 * Коды выхода: 0 — пакет работает, 1 — расхождение, 2 — нет инструментов сборки.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTH = path.join(ROOT, 'fixtures', 'synthetic');
const BUNDLE = path.join(SYNTH, 'history.bundle');
const CONFIG = path.join(SYNTH, 'config.json');
const MAX_BUF = 256 * 1024 * 1024;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-pack-'));
let failed = 0;

function ok(what, detail) {
  console.log('  ✓ ' + what + (detail ? ': ' + detail : ''));
}

function bad(what, detail) {
  console.log('  ✗ ' + what + (detail ? ': ' + detail : ''));
  failed++;
}

function run(bin, cwd, args) {
  const res = spawnSync(process.execPath, [bin, '--config', CONFIG].concat(args),
    { cwd: cwd, encoding: 'utf8', maxBuffer: MAX_BUF });
  if (res.status !== 0) {
    throw new Error(path.basename(bin) + ' ' + args.join(' ') + ': код ' + res.status + '\n' + (res.stderr || '').trim());
  }
  return res.stdout;
}

function clone(name) {
  const dir = path.join(tmp, name);
  execFileSync('git', ['clone', '-q', BUNDLE, dir], { maxBuffer: MAX_BUF });
  return dir;
}

try {
  const tarball = execFileSync('npm', ['pack', '--silent', '--pack-destination', tmp],
    { cwd: ROOT, encoding: 'utf8' }).trim();
  const unpacked = path.join(tmp, 'unpacked');
  fs.mkdirSync(unpacked);
  execFileSync('tar', ['-xzf', path.join(tmp, tarball), '-C', unpacked]);
  const pkg = path.join(unpacked, 'package');
  ok('собран пакет', tarball);

  /* Файлы: сравнение по составу, а не по числу — иначе потеря и лишний файл
   * могли бы уравновесить друг друга. */
  const inRepo = fs.readdirSync(path.join(ROOT, 'src')).sort();
  const packedSrc = path.join(pkg, 'src');
  if (!fs.existsSync(packedSrc)) {
    throw new Error('в тарболле нет каталога src: проверьте список files в package.json');
  }
  const inPack = fs.readdirSync(packedSrc).sort();
  const missing = inRepo.filter((f) => inPack.indexOf(f) < 0);
  if (missing.length > 0) bad('в пакет не доехали исходники', missing.join(' '));
  else ok('все исходники в пакете', inRepo.length + ' записей');

  const repoBin = path.join(ROOT, 'bin', 'size.js');
  const packBin = path.join(pkg, 'bin', 'size.js');
  const repoClone = clone('from-repo');
  const packClone = clone('from-package');

  const jsonRepo = run(repoBin, repoClone, ['--json']);
  const jsonPack = run(packBin, packClone, ['--json']);
  if (jsonRepo !== jsonPack) bad('--json из пакета не совпал с выводом репозитория');
  else ok('--json из пакета совпадает побайтово');

  [repoBin, packBin].forEach((bin, i) => {
    const dir = i === 0 ? repoClone : packClone;
    run(bin, dir, ['--write']);
    run(bin, dir, ['--page']);
  });

  [['docs/size-table.html', 'артефакт'], ['docs/size-report.html', 'страница']].forEach(([rel, what]) => {
    const a = fs.readFileSync(path.join(repoClone, rel));
    const b = fs.readFileSync(path.join(packClone, rel));
    if (!a.equals(b)) bad(what + ' из пакета не совпал(а) с репозиторием');
    else ok(what + ' из пакета совпадает побайтово', b.length + ' Б');
  });
} catch (e) {
  bad('проверка не прошла', e.message);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failed === 0) console.log('✓ пакет работает из собранного тарболла');
else console.error('✗ проверок провалено: ' + failed);
process.exitCode = failed === 0 ? 0 : 1;

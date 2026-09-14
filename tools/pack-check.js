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
import { pathToFileURL } from 'node:url';
import { BUNDLE, CONFIG, MAX_BUF, ROOT, gitIn } from './harness.js';

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
  gitIn(null, ['clone', '-q', BUNDLE, dir]);
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

  /* Список `files` — обещание поставки, и проверяется оно с двух сторон: в нём не
   * должно быть того, чего в репозитории нет (забытый файл или пустой каталог
   * доезжает до выпуска как обещание), а в тарболл не должно попасть то, чего он
   * не обещает. */
  const promised = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).files;
  const absent = promised.filter((entry) => !fs.existsSync(path.join(ROOT, entry)));
  if (absent.length > 0) bad('в files названо то, чего в репозитории нет', absent.join(' '));
  else ok('список files называет только существующее', promised.join(' '));

  /* Часть файлов npm кладёт в тарболл сам, мимо списка (манифест, README,
   * лицензии) — они не считаются лишними, иначе проверка ругалась бы на
   * обещанный планом `LICENSE`. */
  const AUTO = /^(package\.json|README(\..*)?|LICEN[SC]E(\..*)?)$/i;
  const extra = fs.readdirSync(pkg).filter((entry) => !AUTO.test(entry) && promised.indexOf(entry) < 0);
  if (extra.length > 0) bad('в пакет попало то, что files не обещает', extra.join(' '));
  else ok('постороннего в пакете нет', fs.readdirSync(pkg).length + ' записей');

  /* Файлы: сравнение по составу, а не по числу — иначе потеря и лишний файл
   * могли бы уравновесить друг друга. Шаблоны проверяются наравне с исходниками:
   * они и есть обещание «возьми и положи», а шаблон, не доехавший в поставку, —
   * это обещание, которого нет. */
  [['src', 'исходники'], ['templates', 'шаблоны']].forEach(([dir, what]) => {
    const packed = path.join(pkg, dir);
    if (!fs.existsSync(packed)) {
      throw new Error('в тарболле нет каталога ' + dir + ': проверьте список files в package.json');
    }
    const inRepo = fs.readdirSync(path.join(ROOT, dir)).sort();
    const inPack = fs.readdirSync(packed).sort();
    const missing = inRepo.filter((f) => inPack.indexOf(f) < 0);
    if (missing.length > 0) bad('в пакет не доехали ' + what, missing.join(' '));
    else ok('все ' + what + ' в пакете', inRepo.length + ' записей');
  });

  /* Шаблон проект берёт как есть, поэтому он обязан доехать побайтово: правка
   * шаблона после сборки иначе разошлась бы с тем, что проект у себя видит. */
  fs.readdirSync(path.join(ROOT, 'templates')).forEach((f) => {
    const a = fs.readFileSync(path.join(ROOT, 'templates', f));
    const b = fs.readFileSync(path.join(pkg, 'templates', f));
    if (!a.equals(b)) bad('шаблон изменился при упаковке', f);
    else ok('шаблон в пакете побайтово тот же', f);
  });

  /* Разбор модуля держится на файле рядом с собой (`parse-worker.js`), а не на
   * пути от корня репозитория: из установленного пакета поток обязан подняться
   * так же — иначе пользователь платит запуск Node на каждую клетку. */
  const parse = await import(pathToFileURL(path.join(pkg, 'src', 'parse.js')).href);
  parse.moduleError('export const a = 1;');
  if (parse.parseMode() !== 'thread') bad('разбор модуля в пакете ушёл в запуск, а не в поток');
  else ok('разбор модуля в пакете идёт потоком');

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

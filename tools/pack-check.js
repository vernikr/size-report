#!/usr/bin/env node
/* Whether the engine works from an assembled package rather than from the repository alone.
 *
 * Why apart from the rest. The package reads neighbouring sources from disk: the page assembly glues
 * in `derived.js` and `page/app.js`, and modules refer to each other by relative paths. Such a module
 * is easy to make work in the repository and break in whoever installed it: a file that did not make
 * it into the tarball (`files` in `package.json`) is enough, or a path counted from the wrong place.
 * Hence the check runs from an unpacked tarball rather than from the working tree.
 *
 * What is compared: every source arrived; `--json` from the package equals the engine's output from
 * the repository; the assembled report is equal byte for byte (its path comes from the settings
 * rather than a guess: a consumer has its own).
 *
 * It works on clones of the fixture: neither the repository nor the project's `docs/` is touched.
 *
 * Run:
 *   node tools/pack-check.js
 *
 * Exit codes: 0 — the package works, 1 — a divergence or a failed check (a missing build tool among
 * them: its absence is caught by the same handler).
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

/* The directory's contents come from git rather than from disk: what is compared is the promise of
 * the delivery ("every source arrived"), while the directory holds someone else's files beside them
 * — the service files of Finder and of editors. On those the check used to say "sources did not make
 * it into the package", that is, it named the wrong cause and turned the profile red for nothing
 * (`worklog/archive/WORKLOG.md` §71). */
function trackedEntries(dir) {
  const names = gitIn(ROOT, ['ls-files', dir]).split('\n').filter((l) => l !== '')
    .map((p) => p.slice(dir.length + 1).split('/')[0]);
  return [...new Set(names)].sort();
}

try {
  const tarball = execFileSync('npm', ['pack', '--silent', '--pack-destination', tmp],
    { cwd: ROOT, encoding: 'utf8' }).trim();
  const unpacked = path.join(tmp, 'unpacked');
  fs.mkdirSync(unpacked);
  execFileSync('tar', ['-xzf', path.join(tmp, tarball), '-C', unpacked]);
  const pkg = path.join(unpacked, 'package');
  ok('собран пакет', tarball);

  /* The `files` list is the promise of the delivery, and it is checked from both sides: it must not
   * name what the repository does not have (a forgotten file or an empty directory travels to the
   * release as a promise), and the tarball must not carry what the list does not promise. */
  const promised = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).files;
  const absent = promised.filter((entry) => !fs.existsSync(path.join(ROOT, entry)));
  if (absent.length > 0) bad('в files названо то, чего в репозитории нет', absent.join(' '));
  else ok('список files называет только существующее', promised.join(' '));

  /* Some files npm puts into the tarball on its own, past the list (the manifest, and by npm's rules
   * README and licences) — they are not counted as foreign, or the check would complain about what
   * npm itself added. */
  const AUTO = /^(package\.json|README(\..*)?|LICEN[SC]E(\..*)?)$/i;
  const extra = fs.readdirSync(pkg).filter((entry) => !AUTO.test(entry) && promised.indexOf(entry) < 0);
  if (extra.length > 0) bad('в пакет попало то, что files не обещает', extra.join(' '));
  else ok('постороннего в пакете нет', fs.readdirSync(pkg).length + ' записей');

  /* Files: compared by content, not by count — otherwise a loss and an extra file could balance each
   * other out. Templates are checked alongside the sources: they are the "take it and put it down"
   * promise, and a template that did not make it into the delivery is a promise that is not there. */
  [['src', 'исходники'], ['templates', 'шаблоны']].forEach(([dir, what]) => {
    const packed = path.join(pkg, dir);
    if (!fs.existsSync(packed)) {
      throw new Error('в тарболле нет каталога ' + dir + ': проверьте список files в package.json');
    }
    const inRepo = trackedEntries(dir);
    const inPack = fs.readdirSync(packed).sort();
    const missing = inRepo.filter((f) => inPack.indexOf(f) < 0);
    if (missing.length > 0) bad('в пакет не доехали ' + what, missing.join(' '));
    else ok('все ' + what + ' в пакете', inRepo.length + ' записей');
  });

  /* A project takes a template as it is, so it has to arrive byte for byte: an edit made after the
   * assembly would otherwise differ from what the project has in hand. */
  trackedEntries('templates').forEach((f) => {
    const a = fs.readFileSync(path.join(ROOT, 'templates', f));
    const b = fs.readFileSync(path.join(pkg, 'templates', f));
    if (!a.equals(b)) bad('шаблон изменился при упаковке', f);
    else ok('шаблон в пакете побайтово тот же', f);
  });

  /* Module parsing leans on the file beside it (`parse-worker.js`) rather than on a path from the
   * repository root: from an installed package the thread has to rise the same way — otherwise the
   * user pays a Node launch for every cell. */
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

  [repoBin, packBin].forEach((bin, i) => run(bin, i === 0 ? repoClone : packClone, ['--write']));

  const rel = JSON.parse(fs.readFileSync(CONFIG, 'utf8')).output;
  const a = fs.readFileSync(path.join(repoClone, rel));
  const b = fs.readFileSync(path.join(packClone, rel));
  if (!a.equals(b)) bad('отчёт из пакета не совпал с репозиторием');
  else ok('отчёт из пакета совпадает побайтово', b.length + ' Б');
} catch (e) {
  bad('проверка не прошла', e.message);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failed === 0) console.log('✓ пакет работает из собранного тарболла');
else console.error('✗ проверок провалено: ' + failed);
process.exitCode = failed === 0 ? 0 : 1;

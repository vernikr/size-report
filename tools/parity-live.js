#!/usr/bin/env node
/* Сверяет движок пакета с эталоном, снятым с живого проекта: числа (`--json`) и
 * собранный артефакт (sha256) на том же коммите.
 *
 * Зачем отдельно от теста. Фикстура доказывает перенос на маленькой истории, где
 * все ловушки под контролем. Живой проект доказывает то, чего фикстура не может:
 * на настоящей истории в 149 коммитов и 27 колонок перенос не сдвинул ни одного
 * числа и ни одного байта артефакта. Идёт это десятки секунд, поэтому живёт
 * командой `pnpm run parity:live`, а не в общем прогоне тестов.
 *
 * Работает на клоне: проект-потребитель не открывается на запись — иначе проверка
 * подменяла бы в нём собранный отчёт.
 *
 * Запуск:
 *   node tools/parity-live.js [--repo <путь-к-проекту>] [--bin <путь-к-движку>]
 *
 * Коды выхода: 0 — паритет, 1 — расхождение, 2 — нет доступа к эталону или проекту.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARITY = path.join(ROOT, 'fixtures', 'parity');
const CONFIG = path.join(PARITY, 'config.json');
const DEFAULT_REPO = path.join(ROOT, '..', 'figma', 'safe-resets');
const DEFAULT_BIN = path.join(ROOT, 'bin', 'size.js');
const MAX_BUF = 256 * 1024 * 1024;

function parseArgs(args) {
  const out = { flags: {} };
  for (let i = 0; i < args.length; i++) {
    if (args[i].indexOf('--') === 0) {
      const next = args[i + 1];
      if (next !== undefined && next.indexOf('--') !== 0) { out.flags[args[i]] = next; i++; }
      else out.flags[args[i]] = true;
    }
  }
  return out;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function firstDiff(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) {
      return 'строка ' + (i + 1) + '\n    в выводе: ' + JSON.stringify((la[i] || '').slice(0, 160))
        + '\n    в эталоне: ' + JSON.stringify((lb[i] || '').slice(0, 160));
    }
  }
  return 'различие в байтах при одинаковых строках';
}

function runCli(bin, dir, args) {
  const res = spawnSync(process.execPath, [bin, '--config', CONFIG].concat(args), {
    cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = path.resolve(typeof args.flags['--repo'] === 'string' ? args.flags['--repo'] : DEFAULT_REPO);
  const bin = path.resolve(typeof args.flags['--bin'] === 'string' ? args.flags['--bin'] : DEFAULT_BIN);

  for (const [what, file] of [['эталон', path.join(PARITY, 'manifest.json')], ['движок', bin]]) {
    if (!fs.existsSync(file)) {
      console.error('✗ нет ' + what + 'а: ' + file + ' — нечего сверять');
      return 2;
    }
  }
  if (!fs.existsSync(repo)) {
    console.error('✗ проект-потребитель не найден: ' + repo
      + '\n  укажите путь: node tools/parity-live.js --repo <путь>');
    return 2;
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(PARITY, 'manifest.json'), 'utf8'));
  const head = manifest.project.head;
  const data = fs.readFileSync(path.join(PARITY, 'data.json'));
  const artifactSha = fs.readFileSync(path.join(PARITY, 'artifact.sha256'), 'utf8').split(/\s+/)[0];

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-live-'));
  try {
    // Клон без жёстких ссылок: проверка только читает проект и не должна делить с
    // ним объекты даже формально.
    execFileSync('git', ['clone', '-q', '--no-hardlinks', repo, path.join(tmp, 'c')],
      { encoding: 'utf8', maxBuffer: MAX_BUF });
    const dir = path.join(tmp, 'c');
    execFileSync('git', ['checkout', '-q', head], { cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF });

    let bad = 0;

    const json = runCli(bin, dir, ['--json']);
    if (json.code !== 0) {
      console.error('✗ движок не отдал --json (код ' + json.code + '): ' + json.stderr.trim());
      return 1;
    }
    if (json.stdout === data.toString('utf8')) {
      console.log('✓ числа совпали с эталоном побайтово');
    } else {
      bad++;
      console.error('✗ числа разошлись с эталоном: ' + firstDiff(json.stdout, data.toString('utf8')));
    }

    const wrote = runCli(bin, dir, ['--write']);
    if (wrote.code !== 0) {
      console.error('✗ движок не собрал артефакт: ' + wrote.stderr.trim());
      return 1;
    }
    const artifact = fs.readFileSync(path.join(dir, manifest.artifact.path));
    if (sha256(artifact) === artifactSha) {
      console.log('✓ артефакт совпал побайтово: ' + artifact.length + ' Б, sha256 ' + artifactSha.slice(0, 12));
    } else {
      bad++;
      console.error('✗ артефакт разошёлся: sha256 ' + sha256(artifact).slice(0, 12)
        + ' против эталонного ' + artifactSha.slice(0, 12));
    }

    const checked = runCli(bin, dir, []);
    if (checked.code === 0) {
      console.log('✓ контрольный режим на своём артефакте зелёный');
    } else {
      bad++;
      console.error('✗ контрольный режим красный: ' + checked.stderr.trim());
    }

    const rows = JSON.parse(data.toString('utf8')).rows.length;
    console.log((bad === 0 ? '✓ паритет с живым проектом' : '✗ паритет с живым проектом нарушен')
      + ': проект ' + manifest.project.name + ' на ' + head.slice(0, 7) + ', '
      + rows + ' строк × ' + manifest.data.columns + ' колонок');
    return bad === 0 ? 0 : 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

try {
  process.exitCode = main();
} catch (e) {
  console.error('✗ ' + (e && e.message ? e.message : e));
  process.exitCode = 2;
}

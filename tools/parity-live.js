#!/usr/bin/env node
/* Сверяет движок пакета с эталоном, снятым с живого проекта: числа (`--json`) и
 * собранный артефакт (sha256) на том же коммите — в двух окружениях сразу.
 *
 * Зачем отдельно от теста. Фикстура доказывает перенос на маленькой истории, где
 * все ловушки под контролем. Живой проект доказывает то, чего фикстура не может:
 * на настоящей истории в 149 коммитов и 27 колонок перенос не сдвинул ни одного
 * числа и ни одного байта артефакта. Идёт это десятки секунд, поэтому живёт
 * командой `pnpm run parity:live`, а не в общем прогоне тестов.
 *
 * Два окружения. Сверка идёт и как есть, и с нечитаемыми настройками машины
 * (`GIT_CONFIG_GLOBAL=/dev/null`): вывод обязан совпасть с эталоном в обоих.
 * Одного зелёного прогона мало — он доказывает, что числа совпали *здесь*, а не
 * что они не зависят от того, у кого какие настройки git.
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

/* Среды сверки: обычная и с чужими настройками. У живого проекта пути только
 * ASCII, поэтому `core.quotePath` здесь ни при чём — проверяется сам факт
 * независимости вывода от настроек машины. */
const PROFILES = [
  { label: 'обычное окружение', env: null },
  { label: 'настройки машины не читаются (GIT_CONFIG_GLOBAL=/dev/null)', env: { GIT_CONFIG_GLOBAL: '/dev/null' } }
];

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
      return 'строка ' + (i + 1) + '\n      в выводе: ' + JSON.stringify((la[i] || '').slice(0, 160))
        + '\n      в эталоне: ' + JSON.stringify((lb[i] || '').slice(0, 160));
    }
  }
  return 'различие в байтах при одинаковых строках';
}

function runCli(bin, dir, args, env) {
  const res = spawnSync(process.execPath, [bin, '--config', CONFIG].concat(args), {
    cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF, env: Object.assign({}, process.env, env || {})
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/* Контракт данных обязан нести ту же правду, что замороженные числа: это одна и та
 * же история, разложенная по полям. Сверяется на живой истории — там, где
 * фикстура не может: строки, абсолютные значения, «сейчас» и итоги, которые
 * страница считает сама. Колонки, где файл удаляли и возвращали, из сверки дельт
 * выпадают и называются вслух (`BLOCKERS.md` §N4). */
function checkContract(bin, dir, env, frozen) {
  const res = runCli(bin, dir, ['--data'], env);
  if (res.code !== 0) return { errors: ['--data не отдался (код ' + res.code + '): ' + res.stderr.trim()] };
  const got = JSON.parse(res.stdout);
  const errors = [];

  if (got.schema !== 1) errors.push('схема данных не объявлена');
  if (got.rows.length !== frozen.rows.length) errors.push('строк ' + got.rows.length + ' вместо ' + frozen.rows.length);
  if (got.files.length !== frozen.columns.length) errors.push('файлов ' + got.files.length + ' вместо ' + frozen.columns.length);
  if (JSON.stringify(got.now) !== JSON.stringify(frozen.rows[frozen.rows.length - 1].cells)) {
    errors.push('«сейчас» разошлось с последней строкой эталона');
  }

  got.rows.forEach((row, r) => {
    if (r >= frozen.rows.length) return;
    if (row.sha !== frozen.rows[r].sha) { errors.push('строка ' + (r + 1) + ': sha разошёлся'); return; }
    if (JSON.stringify(row.values) !== JSON.stringify(frozen.rows[r].cells)) {
      errors.push('строка ' + (r + 1) + ': абсолютные значения разошлись с эталоном');
      return;
    }
    got.metrics.forEach((m) => {
      let sum = 0;
      row.values.forEach((v) => { if (v !== null) sum += v[m.key]; });
      if (sum !== frozen.rows[r].totals[m.key]) {
        errors.push('строка ' + (r + 1) + '/' + m.key + ': итог ' + sum + ' вместо ' + frozen.rows[r].totals[m.key]);
      }
    });
  });

  const value = (r, i, key) => (r < 0 || got.rows[r].values[i] === null ? null : got.rows[r].values[i][key]);
  const gaps = [];
  got.files.forEach((f, i) => {
    let deleted = false;
    got.rows.forEach((row, r) => {
      if (r > 0 && got.rows[r - 1].values[i] !== null && row.values[i] === null) deleted = true;
    });
    if (deleted) { gaps.push(f.label); return; }
    got.metrics.forEach((m) => {
      let sum = 0;
      got.rows.forEach((row, r) => {
        const now = value(r, i, m.key);
        if (now === null) return;
        const before = value(r - 1, i, m.key);
        sum += before === null ? now : now - before;
      });
      const at = got.now[i] === null ? 0 : got.now[i][m.key];
      if (sum !== at) {
        errors.push('колонка «' + f.label + '»/' + m.key + ': дельты не сходятся с текущим размером');
      }
    });
  });

  return { errors: errors, gaps: gaps, rows: got.rows.length, files: got.files.length };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = path.resolve(typeof args.flags['--repo'] === 'string' ? args.flags['--repo'] : DEFAULT_REPO);
  const bin = path.resolve(typeof args.flags['--bin'] === 'string' ? args.flags['--bin'] : DEFAULT_BIN);

  for (const [what, file] of [['эталона', path.join(PARITY, 'manifest.json')], ['движка', bin]]) {
    if (!fs.existsSync(file)) {
      console.error('✗ нет ' + what + ': ' + file + ' — нечего сверять');
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
  const data = fs.readFileSync(path.join(PARITY, 'data.json')).toString('utf8');
  const frozen = JSON.parse(data);
  const artifactSha = fs.readFileSync(path.join(PARITY, 'artifact.sha256'), 'utf8').split(/\s+/)[0];
  const rows = frozen.rows.length;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-live-'));
  try {
    // Клон без жёстких ссылок: проверка только читает проект и не должна делить с
    // ним объекты даже формально.
    execFileSync('git', ['clone', '-q', '--no-hardlinks', repo, path.join(tmp, 'c')],
      { encoding: 'utf8', maxBuffer: MAX_BUF });
    const dir = path.join(tmp, 'c');
    execFileSync('git', ['checkout', '-q', head], { cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF });

    let bad = 0;

    PROFILES.forEach((profile) => {
      console.log('— ' + profile.label);

      const json = runCli(bin, dir, ['--json'], profile.env);
      if (json.code !== 0) {
        bad++;
        console.error('    ✗ движок не отдал --json (код ' + json.code + '): ' + json.stderr.trim());
        return;
      }
      if (json.stdout === data) {
        console.log('    ✓ числа совпали с эталоном побайтово');
      } else {
        bad++;
        console.error('    ✗ числа разошлись с эталоном: ' + firstDiff(json.stdout, data));
      }

      const wrote = runCli(bin, dir, ['--write'], profile.env);
      if (wrote.code !== 0) {
        bad++;
        console.error('    ✗ движок не собрал артефакт: ' + wrote.stderr.trim());
        return;
      }
      const artifact = fs.readFileSync(path.join(dir, manifest.artifact.path));
      if (sha256(artifact) === artifactSha) {
        console.log('    ✓ артефакт совпал побайтово: ' + artifact.length + ' Б, sha256 ' + artifactSha.slice(0, 12));
      } else {
        bad++;
        console.error('    ✗ артефакт разошёлся: sha256 ' + sha256(artifact).slice(0, 12)
          + ' против эталонного ' + artifactSha.slice(0, 12));
      }

      const checked = runCli(bin, dir, [], profile.env);
      if (checked.code === 0) {
        console.log('    ✓ контрольный режим на своём артефакте зелёный');
      } else {
        bad++;
        console.error('    ✗ контрольный режим красный: ' + checked.stderr.trim());
      }

      const contract = checkContract(bin, dir, profile.env, frozen);
      if (contract.errors.length === 0) {
        console.log('    ✓ контракт данных несёт те же числа: ' + contract.rows + ' строк, '
          + contract.files + ' файлов, итоги и дельты сходятся с «сейчас»'
          + (contract.gaps.length === 0 ? '' : ' (кроме колонок с возвратом файла: ' + contract.gaps.join(', ') + ')'));
      } else {
        bad++;
        contract.errors.slice(0, 3).forEach((e) => console.error('    ✗ контракт данных: ' + e));
      }
    });

    console.log((bad === 0 ? '✓ паритет с живым проектом' : '✗ паритет с живым проектом нарушен')
      + ': проект ' + manifest.project.name + ' на ' + head.slice(0, 7) + ', '
      + rows + ' строк × ' + manifest.data.columns + ' колонок, сред ' + PROFILES.length);
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

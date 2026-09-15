#!/usr/bin/env node
/* Сверяет движок пакета с эталоном, снятым с живого проекта: числа (`--json`) и
 * собранный отчёт на том же коммите — в двух окружениях сразу.
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
 * Окружения идут вперемешку (у каждого свой клон), потому что каждое — это
 * отдельный процесс на своём ядре, а команды внутри окружения ждут друг друга:
 * проверка контрольного режима смотрит на артефакт, который только что собрал
 * `--write`. Клон у каждого окружения свой именно поэтому — общий клон и запись в
 * него из двух окружений одновременно были бы гонкой.
 *
 * Работает на клонах: проект-потребитель не открывается на запись — иначе проверка
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
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectOutput, gitIn } from './harness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARITY = path.join(ROOT, 'fixtures', 'parity');
const CONFIG = path.join(PARITY, 'config.json');
const DEFAULT_REPO = path.join(ROOT, '..', 'figma', 'safe-resets');
const DEFAULT_BIN = path.join(ROOT, 'bin', 'size.js');

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

/* Отсутствие файла — тоже ответ («отчёта нет»), и он должен быть строкой сверки, а
 * не исключением на середине прогона. */
function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (_e) {
    return null;
  }
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

/* Запуск без ожидания: окружения идут вперемешку, поэтому `spawn`, а не
 * `spawnSync`. Вывод собирается целиком — сверяется он побайтово — и склейка
 * кусков живёт в обвязке (`collectOutput`), а не здесь. */
function runCli(bin, dir, args, env) {
  return collectOutput(spawn(process.execPath, [bin, '--config', CONFIG].concat(args), {
    cwd: dir,
    env: Object.assign({}, process.env, env || {})
  }));
}

/* Контракт данных обязан нести ту же правду, что замороженные числа: это одна и та
 * же история, разложенная по полям. Сверяется на живой истории — там, где
 * фикстура не может: строки, абсолютные значения, «сейчас» и итоги, которые
 * страница считает сама. Колонки, где файл удаляли и возвращали, из сверки дельт
 * выпадают и называются вслух (`BLOCKERS.md` §N4). */
async function checkContract(bin, dir, env, frozen) {
  const res = await runCli(bin, dir, ['--data'], env);
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

/* Одна сверка: строка о результате и признак «плохо» (0 или 1). Строки копятся в
 * общем списке окружения, а не печатаются по ходу: окружения идут вперемешку, и
 * живая печать перемешала бы два отчёта в один нечитаемый. */
function verdict(lines, ok, good, bad) {
  lines.push('    ' + (ok ? '✓ ' : '✗ ') + (ok ? good : bad));
  return ok ? 0 : 1;
}

/* Прогон не отдал ответа вовсе — сверять дальше нечего: окружение закрывается
 * сразу, но провал считается вместе с уже найденными. */
function broken(lines, bad, why) {
  lines.push('    ✗ ' + why);
  return { bad: bad + 1, lines: lines };
}

/* Контракт данных — не побайтовая сверка, а раскладка той же истории по полям; его
 * ошибки печатаются не все, а первые три: остальные — следствие первой. */
function contractLines(lines, contract) {
  if (contract.errors.length === 0) {
    lines.push('    ✓ контракт данных несёт те же числа: ' + contract.rows + ' строк, '
      + contract.files + ' файлов, итоги и дельты сходятся с «сейчас»'
      + (contract.gaps.length === 0 ? '' : ' (кроме колонок с возвратом файла: ' + contract.gaps.join(', ') + ')'));
    return 0;
  }
  contract.errors.slice(0, 3).forEach((e) => lines.push('    ✗ контракт данных: ' + e));
  return 1;
}

/* Одно окружение целиком: свой клон, свои прогоны, свой список строк вывода. */
async function checkProfile(profile, expected, tmp) {
  const { bin, repo, head, data, frozen, artifactRel } = expected;
  const lines = ['— ' + profile.label];
  let bad = 0;

  const dir = path.join(tmp, 'clone-' + PROFILES.indexOf(profile));
  gitIn(null, ['clone', '-q', '--no-hardlinks', repo, dir]);
  gitIn(dir, ['checkout', '-q', head]);

  const json = await runCli(bin, dir, ['--json'], profile.env);
  if (json.code !== 0) return broken(lines, bad, 'движок не отдал --json (код ' + json.code + '): ' + json.stderr.trim());
  bad += verdict(lines, json.stdout === data, 'числа совпали с эталоном побайтово',
    'числа разошлись с эталоном: ' + firstDiff(json.stdout, data));

  /* Отчёт — самодостаточная страница, а эталон снят с прежней статической таблицы:
   * побайтовой сверки здесь больше нет, и это не потеря, а другой предмет. Верным
   * обязано оставаться другое: файл появился по тому пути, который назвал сам
   * потребитель, и ничего не тянет со стороны (внешняя ссылка сделала бы его
   * неоткрываемым без сети — а он за тем и собирается, чтобы открываться с диска). */
  const wrote = await runCli(bin, dir, ['--write'], profile.env);
  if (wrote.code !== 0) return broken(lines, bad, 'движок не собрал отчёт: ' + wrote.stderr.trim());
  const artifact = readIfExists(path.join(dir, artifactRel));
  const external = artifact === null ? [] : ['src="', '<link '].filter((m) => artifact.indexOf(m) >= 0);
  const selfMade = artifact !== null && external.length === 0 && artifact.indexOf('id="data"') >= 0;
  bad += verdict(lines, selfMade,
    'отчёт самодостаточен: ' + artifactRel + ', ' + artifact.length + ' Б, без внешних ссылок',
    artifact === null ? 'отчёта нет по пути из настроек: ' + artifactRel
      : 'отчёт не самодостаточен: ' + (external.length > 0 ? 'внешние ссылки ' + external.join(', ')
        : 'в нём нет данных'));

  const checked = await runCli(bin, dir, [], profile.env);
  bad += verdict(lines, checked.code === 0, 'контрольный режим на своём артефакте зелёный',
    'контрольный режим красный: ' + checked.stderr.trim());

  bad += contractLines(lines, await checkContract(bin, dir, profile.env, frozen));
  return { bad: bad, lines: lines };
}

async function main() {
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
  const rows = frozen.rows.length;
  const expected = {
    bin: bin, repo: repo, head: head, data: data, frozen: frozen,
    artifactRel: manifest.artifact.path
  };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-live-'));
  try {
    const results = await Promise.all(PROFILES.map((profile) => checkProfile(profile, expected, tmp)));
    results.forEach((r) => r.lines.forEach((line) => console.log(line)));

    const bad = results.reduce((sum, r) => sum + r.bad, 0);
    console.log((bad === 0 ? '✓ паритет с живым проектом' : '✗ паритет с живым проектом нарушен')
      + ': проект ' + manifest.project.name + ' на ' + head.slice(0, 7) + ', '
      + rows + ' строк × ' + manifest.data.columns + ' колонок, сред ' + PROFILES.length);
    return bad === 0 ? 0 : 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().then((code) => { process.exitCode = code; }).catch((e) => {
  console.error('✗ ' + (e && e.message ? e.message : e));
  process.exitCode = 2;
});

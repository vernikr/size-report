#!/usr/bin/env node
/* Датчик покрытия: храповик по файлам, а не абсолютный порог на весь репозиторий.
 *
 * **Почему храповик, а не процент.** Доля покрытия — не мера качества: она растёт
 * от пустых тестов и падает от новых тестов тоже. Поэтому база — не «сколько-то
 * процентов», а снимок по каждому файлу: упало ниже своего же — красный (значит,
 * код приехал без проверки), выросло — тихо хорошо.
 *
 * **Почему полный набор.** Быстрый прогон файлов хука и диска не гоняет вовсе, и
 * покрытие по нему падало бы от кода, проверенного в полном наборе, — то есть гейт
 * валил бы исправную работу. Поэтому покрытие снимается на полном наборе и живёт в
 * slow-профиле (`pnpm run verify:slow`), а не на каждой правке: полный набор под c8
 * стоит десятки секунд.
 *
 * Запуск: `pnpm run cover` (храповик), `pnpm run baseline:coverage` (перезапись базы —
 * человеческое действие, трейлер `Gate-Change:` обязателен),
 * `node tools/gates/coverage.js --summary <файл> --baseline <файл>` (вердикт по
 * готовому отчёту — этим пользуются проверки датчика). Коды выхода: 0 — храповик
 * стоит, 1 — просадка или новый непокрытый файл.
 */

import fs from 'node:fs';
import path from 'node:path';
import { REPORTS, ROOT, bad, indent, ok, parseArgs, readJson, rel, run } from './common.js';

const BASELINE = 'coverage-baseline.json';
const METRICS = ['lines', 'branches', 'functions'];

/* Сравнение базы со снятым покрытием: ниже базы по любой метрике — просадка; новый
 * файл, который ни разу не выполнился, — тоже: код без проверки не должен появляться
 * тихо. Файл, пропавший из отчёта, называется, но гейт не валит — его могли удалить.
 *
 * Сравниваются два словаря одного вида — «путь от корня проекта → три доли»: тот же
 * вид, что записан в базу. Иначе храповик сравнивал бы базу с отчётом по разным
 * ключам (c8 отдаёт абсолютные пути) и объявлял бы просадкой всё дерево сразу —
 * ложный красный на живом прогоне, который нашёлся только на slow-профиле. */
function compare(baseline, now) {
  const regressions = [];
  const newFiles = [];
  Object.keys(now).sort().forEach((file) => {
    const was = baseline.files[file];
    if (was === undefined) {
      if (now[file].lines === 0) regressions.push({ file: file, metric: 'lines', was: null, now: 0 });
      else newFiles.push(file);
      return;
    }
    METRICS.forEach((m) => {
      if (now[file][m] !== undefined && now[file][m] < was[m]) {
        regressions.push({ file: file, metric: m, was: was[m], now: now[file][m] });
      }
    });
  });
  const gone = Object.keys(baseline.files).filter((f) => now[f] === undefined);
  return { regressions: regressions, newFiles: newFiles, gone: gone };
}

const args = parseArgs(process.argv.slice(2), ['--summary', '--baseline'], ['--update']);
const named = args.flags['--baseline'] || BASELINE;
const baselineFile = path.isAbsolute(named) ? named : path.join(ROOT, named);
let summary = null;

if (args.flags['--summary']) {
  /* Покрытие уже снято кем-то другим — здесь только вердикт. */
  summary = readJson(args.flags['--summary']);
} else {
  const res = run('pnpm', ['exec', 'c8', 'node', 'tools/run-tests.js', 'full']);
  const summaryFile = path.join(REPORTS, 'coverage', 'coverage-summary.json');
  if (res.error || !fs.existsSync(summaryFile)) {
    bad('cover: покрытие не снялось (' + (res.error ? res.error.message : 'нет отчёта')
      + ')\n' + indent((res.stderr || '').trim()));
    process.exit();
  }
  summary = readJson(summaryFile);
}

const shape = (point) => ({ lines: point.lines.pct, branches: point.branches.pct, functions: point.functions.pct });
const files = {};
Object.keys(summary).filter((f) => f !== 'total').sort().forEach((f) => { files[rel(f)] = shape(summary[f]); });

if (args.flags['--update']) {
  fs.writeFileSync(baselineFile, JSON.stringify({
    schema: 1,
    suite: 'full',
    note: 'База покрытия: снимок по файлам, снятый с полного набора (`pnpm run cover`).'
      + ' Обновляется человеком. Нуль бывает честным: главы программы страницы'
      + ' (`src/page/*.js`) node не исполняет — они вклеиваются в собранную страницу,'
      + ' и их стерегут наборы страницы.',
    files: files
  }, null, 2) + '\n');
  ok('cover: база обновлена — ' + Object.keys(files).length + ' файлов в ' + BASELINE);
  console.log('  обновление базы — человеческое действие: приложите причину трейлером Gate-Change:');
  process.exit();
}

if (!fs.existsSync(baselineFile)) {
  bad('cover: базы нет (' + BASELINE + ') — соберите её: pnpm run baseline:coverage');
  process.exit();
}

const baseline = readJson(baselineFile);
const verdict = compare(baseline, files);
fs.mkdirSync(REPORTS, { recursive: true });
fs.writeFileSync(path.join(REPORTS, 'coverage-verdict.json'), JSON.stringify({
  schema: 1,
  baseline: path.basename(baselineFile),
  total: shape(summary.total),
  regressions: verdict.regressions,
  newFiles: verdict.newFiles,
  gone: verdict.gone
}, null, 2) + '\n');

console.log('cover: всего ' + summary.total.lines.pct + '% строк, '
  + summary.total.branches.pct + '% ветвей, ' + summary.total.functions.pct + '% функций');
if (verdict.regressions.length > 0) {
  bad('cover: просадок ' + verdict.regressions.length + ' (в базе '
    + Object.keys(baseline.files).length + ' файлов)');
  verdict.regressions.forEach((r) => {
    console.error('    ' + r.file + ' — ' + r.metric + ': было '
      + (r.was === null ? 'не в базе' : r.was) + ', стало ' + r.now);
  });
  console.error('    чинить проверки или код, а не базу');
} else {
  ok('cover: просадок нет (в базе ' + Object.keys(baseline.files).length + ' файлов)');
}
verdict.gone.forEach((f) => console.log('  — из отчёта ушёл: ' + f));
verdict.newFiles.forEach((f) => console.log('  — новый файл в отчёте: ' + f));

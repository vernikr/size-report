#!/usr/bin/env node
/* The coverage sensor: a ratchet per file rather than one absolute threshold over the repository.
 *
 * **Why a ratchet rather than a percentage.** A coverage share is no measure of quality: it grows from
 * empty tests and falls from new tests just as well. Hence the baseline is not "some percent" but a
 * snapshot per file: below its own — red (that is, code arrived without a check), above — quietly fine.
 *
 * **Why the full suite.** The fast run does not run the hook and disk files at all, so coverage over it
 * would fall from code that the full suite does cover — that is, the gate would fail working code.
 * Coverage is therefore measured on the full suite and lives in the slow profile
 * (`pnpm run verify:slow`) rather than on every edit.
 *
 * Run: `pnpm run cover` (the ratchet), `pnpm run baseline:coverage` (baseline rewrite — a human action,
 * the `Gate-Change:` trailer required), `node tools/gates/coverage.js --summary <file> --baseline <file>`
 * (a verdict over a ready report — what the sensor's own probes use). Exit codes: 0 — the ratchet
 * stands, 1 — a regression or a new uncovered file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { REPORTS, ROOT, bad, indent, ok, parseArgs, readJson, rel, run } from './common.js';

const BASELINE = 'coverage-baseline.json';
const METRICS = ['lines', 'branches', 'functions'];

/* Comparing the baseline with the measured coverage: below the baseline on any metric is a regression,
 * and so is a new file that never executed — code without a check must not appear quietly. A file gone
 * from the report is named but does not fail the gate: it may have been deleted.
 *
 * Both sides are dictionaries of one shape — "path from the project root → three shares", the shape
 * recorded in the baseline. Otherwise the ratchet would compare the baseline with the report under
 * different keys (c8 hands out absolute paths) and call the whole tree a regression at once — a false
 * red found only on the slow profile. */
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
  /* Coverage has already been measured by someone else: the verdict only. */
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

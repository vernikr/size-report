#!/usr/bin/env node
/* The coverage sensor: a ratchet per file rather than one absolute threshold over the repository.
 *
 * **Why a ratchet rather than a percentage.** A coverage share is no measure of quality: it grows from
 * empty tests and falls from new tests just as well. Hence the baseline is not "some percent" but a
 * snapshot per file: below its own — red (that is, code arrived without a check), above — quietly fine.
 *
 * **Why the unit is a count rather than a share.** The ratchet compares **how many lines, branches and
 * functions actually executed**, taken from c8's own `covered` numbers (`json-summary`, `.c8rc.json`),
 * rather than their shares. A share falls when a file merely grows — a literal split into a two-line
 * concatenation adds a line to the total and moves no execution — so a share-based ratchet reddens on a
 * reformatting and stays quiet about nothing. A count moves only when code stops being run: that is the
 * defect the sensor exists for ("code arrived without a check"), and it is what the unit is chosen to
 * match. The price of the choice is named: a file that grows *and* executes stays put instead of rising,
 * so the ratchet is a floor over execution rather than a promise about the share. The same reasoning
 * holds for branches and functions, which is why all three are counts of the same kind — one shape for
 * the file, no mixing of units inside it.
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
/* The shape of the baseline and of the verdict report: 1 was shares per file, 2 is executed counts.
 * A reader of either file can tell which one they are holding. */
const SCHEMA = 2;
const UNIT = 'executed lines, branches and functions per file';

/* Comparing the baseline with the measured coverage: below the baseline on any metric is a regression,
 * and so is a new file that never executed — code without a check must not appear quietly. A file gone
 * from the report is named but does not fail the gate: it may have been deleted.
 *
 * Both sides are dictionaries of one shape — "path from the project root → three executed counts", the
 * shape recorded in the baseline. Otherwise the ratchet would compare the baseline with the report under
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
    bad('cover: the coverage was not taken (' + (res.error ? res.error.message : 'no report')
      + ')\n' + indent((res.stderr || '').trim()));
    process.exit();
  }
  summary = readJson(summaryFile);
}

/* What the ratchet compares: how much executed, per file. */
const counts = (point) => ({ lines: point.lines.covered, branches: point.branches.covered, functions: point.functions.covered });
/* What a person is shown about the whole set: the shares, which the ratchet does not use. */
const shares = (point) => ({ lines: point.lines.pct, branches: point.branches.pct, functions: point.functions.pct });
/* The totals in the verdict report keep c8's own numbers rather than a projection of them: a reader of
 * the machine report gets both units, which is what a file carrying a unit change has to offer. */
const raw = (point) => ({ lines: point.lines, branches: point.branches, functions: point.functions });

const files = {};
Object.keys(summary).filter((f) => f !== 'total').sort().forEach((f) => { files[rel(f)] = counts(summary[f]); });

if (args.flags['--update']) {
  fs.writeFileSync(baselineFile, JSON.stringify({
    schema: SCHEMA,
    suite: 'full',
    unit: UNIT,
    note: 'A baseline of coverage: a snapshot per file, taken from the whole set (`pnpm run cover`).'
      + ' The unit is the count of what executed rather than a share, so a file that merely grew does'
      + ' not move the ratchet while code that stopped being run does. Updated by a person. A zero can'
      + ' be honest: the chapters of the page program (`src/page/*.js`) node never executes — they are'
      + ' pasted into the assembled page, and those chapters are guarded by the page suites.',
    files: files
  }, null, 2) + '\n');
  ok('cover: the baseline is re-taken — ' + Object.keys(files).length + ' files in ' + BASELINE
    + ' (schema ' + SCHEMA + ', ' + UNIT + ')');
  console.log('  re-taking the baseline is a human action: attach a reason with the `Gate-Change:` trailer');
  process.exit();
}

if (!fs.existsSync(baselineFile)) {
  bad('cover: there is no baseline (' + BASELINE + ') — collect it: pnpm run baseline:coverage');
  process.exit();
}

const baseline = readJson(baselineFile);
const verdict = compare(baseline, files);
fs.mkdirSync(REPORTS, { recursive: true });
fs.writeFileSync(path.join(REPORTS, 'coverage-verdict.json'), JSON.stringify({
  schema: SCHEMA,
  baseline: path.basename(baselineFile),
  unit: UNIT,
  total: raw(summary.total),
  regressions: verdict.regressions,
  newFiles: verdict.newFiles,
  gone: verdict.gone
}, null, 2) + '\n');

const total = shares(summary.total);
console.log('cover: lines ' + total.lines + '%, branches ' + total.branches + '%, functions '
  + total.functions + '% of the set (the ratchet compares executed counts per file)');
if (verdict.regressions.length > 0) {
  bad('cover: regressions ' + verdict.regressions.length + ' (the baseline holds '
    + Object.keys(baseline.files).length + ' files)');
  verdict.regressions.forEach((r) => {
    console.error('    ' + r.file + ' — ' + r.metric + ': was '
      + (r.was === null ? 'not in the baseline' : r.was) + ', now ' + r.now);
  });
  console.error('    fix the checks or the code, not the baseline');
} else {
  ok('cover: no regressions (the baseline holds ' + Object.keys(baseline.files).length + ' files)');
}
verdict.gone.forEach((f) => console.log('  — gone from the report: ' + f));
verdict.newFiles.forEach((f) => console.log('  — a new file in the report: ' + f));

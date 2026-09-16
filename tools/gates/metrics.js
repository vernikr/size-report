#!/usr/bin/env node
/* The growth sensor: the size and complexity of functions, the size of modules, duplicated branches,
 * the weight of tests, debt markers. The rules and thresholds live in `eslint.metrics.config.js`; here
 * there is only the launch and the ratchet.
 *
 * **The ratchet is ESLint's own suppressions** (`.eslint-suppressions.json`): what is above the
 * threshold today sits in the baseline and blocks no work; what appears tomorrow is named one by one
 * and fails the gate. A suppression is counted per file and rule rather than per line number, so
 * shifting lines does not turn the baseline into rubbish. The baseline is updated by a person only
 * (`pnpm run baseline:metrics`) and only with the `Gate-Change:` trailer — otherwise it would be a way
 * to pass the gate without fixing code. A stale entry (the violation fixed, the line kept) does not
 * fail the gate: cleaning the baseline is a person's business rather than an obstacle to whoever is
 * fixing the code.
 *
 * Run: `pnpm run metrics` (the gate), `pnpm run verify:fast` (the same in the fast profile).
 * Exit codes: 0 — no new violations, 1 — there are some (or the run did not happen).
 */

import fs from 'node:fs';
import path from 'node:path';
import { REPORTS, ROOT, bad, indent, ok, parseArgs, pathsOf, readJson, rel, run } from './common.js';

/* The baseline has a name of its own rather than ESLint's default (`eslint-suppressions.json`):
 * otherwise the strict formatting linter (`eslint .`) picks it up too, has none of these rules, and
 * fails on "suppressions that are no longer used". */
const BASELINE = '.eslint-suppressions.json';
const args = parseArgs(process.argv.slice(2), ['--paths', '--baseline'], []);
const baselineName = args.flags['--baseline'] || BASELINE;
const paths = pathsOf(args);
const report = path.join(REPORTS, 'metrics.json');
fs.mkdirSync(REPORTS, { recursive: true });

const res = run('pnpm', ['exec', 'eslint', '--config', 'eslint.metrics.config.js',
  '--suppressions-location', baselineName, '--pass-on-unpruned-suppressions',
  '--format', 'json', '--output-file', rel(report)].concat(paths));
if (res.error || !fs.existsSync(report)) {
  bad('metrics: the linter did not run (' + (res.error ? res.error.message : 'no report')
    + ')\n' + indent((res.stderr || '').trim()));
  process.exit();
}

/* The report is sorted by file, line and rule: two runs over one tree give one and the same file, so
 * it is visible in a diff. */
const found = [];
readJson(report).forEach((file) => {
  file.messages.forEach((m) => {
    found.push({ file: rel(file.filePath), line: m.line, column: m.column, rule: m.ruleId, message: m.message });
  });
});
found.sort((a, b) => (a.file + ':' + a.line + ':' + a.rule).localeCompare(b.file + ':' + b.line + ':' + b.rule));

/* The size of the baseline is part of the verdict: it shows whether the ratchet is growing or being
 * paid off. */
const suppressions = fs.existsSync(path.join(ROOT, baselineName)) ? readJson(path.join(ROOT, baselineName)) : {};
let inBaseline = 0;
let baselineFiles = 0;
Object.keys(suppressions).sort().forEach((file) => {
  baselineFiles++;
  Object.keys(suppressions[file]).forEach((rule) => { inBaseline += suppressions[file][rule].count || 0; });
});

if (found.length > 0) {
  bad('metrics: new violations ' + found.length + ' (the baseline holds ' + inBaseline
    + ' in ' + baselineFiles + ' files)');
  found.slice(0, 30).forEach((f) => {
    console.error('    ' + f.file + ':' + f.line + '  ' + f.rule + '  ' + f.message);
  });
  if (found.length > 30) console.error('    … new violations in all: ' + found.length);
  console.error('    fix the code, not the sensor; a threshold or a baseline is changed by a person');
} else {
  ok('metrics: no new violations (the baseline holds ' + inBaseline + ' in ' + baselineFiles + ' files)');
}

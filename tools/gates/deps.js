#!/usr/bin/env node
/* The dependencies sensor: cycles, orphans, the direction of layers. The rules live in
 * `.dependency-cruiser.cjs`; here is the launch, the printing and the machine report.
 *
 * This sensor's ratchet is built in — `--ignore-known` and the file
 * `.dependency-cruiser-known-violations.json`. It is not needed today and is deliberately not created:
 * the tree is clean, so a finding is new by definition. Should a tolerable finding appear, it goes into
 * the known-violations file, and that is a separate human action (the file is guarded by `gatefiles`:
 * without the `Gate-Change:` trailer it cannot pass).
 *
 * Run: `pnpm run deps`. Exit codes: 0 — no findings, 1 — there are some or the run did not happen.
 */

import fs from 'node:fs';
import { bad, indent, ok, parseArgs, pathsOf, readJson, rel, run, writeReport } from './common.js';

const args = parseArgs(process.argv.slice(2), ['--paths', '--known'], []);
const paths = pathsOf(args);
const report = 'reports/deps.json';

const argv = ['exec', 'depcruise'].concat(paths)
  .concat(['--config', '.dependency-cruiser.cjs', '--output-type', 'json', '--output-to', report])
  .concat(args.flags['--known'] ? ['--ignore-known', args.flags['--known']] : []);
const res = run('pnpm', argv);
if (res.error || !fs.existsSync(report)) {
  bad('deps: разбор связей не состоялся (' + (res.error ? res.error.message : 'нет отчёта')
    + ')\n' + indent((res.stderr || '').trim()));
  process.exit();
}

/* The report is sorted by rule, from and to, so that it diffs and reads in one glance. The `severity`
 * from the report is the verdict: `error` fails the run, `warn` is named. */
const found = readJson(report).summary.violations.map((v) => ({
  rule: v.rule.name,
  severity: v.rule.severity,
  from: rel(v.from),
  to: v.to === undefined ? '' : (v.to.startsWith('node_modules') ? v.to : rel(v.to)),
  comment: v.rule.comment || ''
}));
found.sort((a, b) => (a.rule + a.from + a.to).localeCompare(b.rule + b.from + b.to));
const modules = readJson(report).modules.length;
const deps = readJson(report).modules.reduce((sum, m) => sum + m.dependencies.length, 0);
writeReport('deps.json', { schema: 1, modules: modules, dependencies: deps, violations: found });

const errors = found.filter((v) => v.severity === 'error');
if (errors.length > 0) {
  bad('deps: находок ' + errors.length + ' (' + modules + ' модулей, ' + deps + ' связей)');
  errors.forEach((v) => {
    console.error('    ' + v.rule + ': ' + v.from + (v.to === '' ? '' : ' → ' + v.to));
  });
  console.error('    чинить связи, а не правило');
} else {
  ok('deps: находок нет (' + modules + ' модулей, ' + deps + ' связей)');
}
found.filter((v) => v.severity !== 'error').forEach((v) => {
  console.log('  — к сведению: ' + v.rule + ': ' + v.from + ' → ' + v.to);
});

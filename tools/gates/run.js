#!/usr/bin/env node
/* One command is the source of truth: here and only here is it spelled out what "checked" means.
 * Locally and in CI the same steps run in the same order, and a check that is not in a profile cannot
 * be in CI — `test/gates-verify.test.js` watches that (it reads the workflow descriptions and compares
 * them with this list).
 *
 * **There are three profiles, and what separates them is what a step costs, not what it is worth.**
 *
 *   `fast`  — every edit and the pre-commit hook: formatting, the sensors, the fast suite.
 *   `full`  — before sending an edit and in CI: the same plus the whole suite, parity with the live
 *             project, reproducibility of the goldens, the work from an assembled package.
 *   `slow`  — on a schedule: the same plus coverage under c8 and the same full suite in an environment
 *             with no machine git settings at all. Both of those cost tens of seconds, which is why
 *             they are named here and run on a schedule rather than thrown out; no time target is
 *             promised for any profile (`tools/suites.js` says why).
 *
 * The steps run to the end even when an earlier one failed: everything found has to be fixed, not only
 * the one the run tripped over first (each step has a verdict of its own).
 *
 * Run: `pnpm run verify:fast`, `pnpm run verify`, `pnpm run verify:slow`.
 * `node tools/gates/run.js --list full` prints a profile's commands (the CI parity check and a person
 * use that). Exit codes: 0 — all green, 1 — something is not.
 */

import path from 'node:path';
import { bad, ok, parseArgs, run } from './common.js';
import { localeNumber } from '../harness.js';

/* Steps: the name is the name of the script in `package.json`, so that a person can run one step
 * alone. The text is why the step is here (printed in the summary), looked up by script name. */
/* A step with no machine settings is the same full suite with one environment key, which a script of
 * its own cannot carry: an environment key in `package.json` does not travel between shells. Hence a
 * profile entry is a script plus an optional environment. */
const STEPS = {
  'lint:strict': 'formatting: the same rules the diff shows (the package’s existing linter)',
  metrics: 'bloat: the size and complexity of functions, the size of modules, duplicated branches, the weight of checks, debt marks',
  dup: 'duplicates: new clones against the fingerprint baseline and against the `origin/main` tree',
  deps: 'relations: cycles, orphans, the direction of layers',
  test: 'the fast set of checks (the same as `pnpm test`)',
  'test:all': 'the whole set of checks',
  'test:all:hermetic': 'the whole set in an environment with none of the machine’s git settings',
  'parity:live': 'parity with the history of the consumer project, on a clone',
  'check:standards': 'the references reproduce, the working tree stays untouched',
  'pack:check': 'the engine works from the assembled tarball',
  cover: 'coverage: the per-file ratchet (the whole set under c8)'
};

/* The step with no machine settings is the same full suite with one environment key: a script of its
 * own cannot carry it (an environment key in `package.json` does not travel between shells), and in CI
 * it was exactly the same suite with the same key. Hence the pair of script and environment, standing
 * beside the ordinary run in the profile. */
const HERMETIC = { GIT_CONFIG_GLOBAL: '/dev/null' };
const step = (script, env) => ({ script: script, env: env || null });
const steps = (...items) => items.map((i) => (typeof i === 'string' ? step(i) : i));

/* The full profile is spelled out once: slow is that same one plus two expensive steps, and a second
 * list would diverge from the first as quietly as any two copies do. */
const FULL = steps('lint:strict', 'metrics', 'dup', 'deps', 'test:all',
  'parity:live', 'check:standards', 'pack:check');

const PROFILES = {
  fast: steps('lint:strict', 'metrics', 'dup', 'deps', 'test'),
  full: FULL,
  slow: FULL.concat(steps(step('test:all', HERMETIC), 'cover'))
};

/* A step's arguments, by script name: `parity:live` gets a bundle of the history (the runner has no
 * access to the consumer project itself), the rest get nothing. */
const ARGS = { 'parity:live': ['--', '--repo', 'fixtures/live/history.bundle'] };

function labelOf(entry) {
  return entry.script + (entry.env === null ? '' : ':hermetic');
}

const args = parseArgs(process.argv.slice(2), [], ['--list']);
const profile = args.rest[0];

/* A step's command as a person sees it and as the CI parity check compares it: `pnpm run <name>
 * [arguments]`, with the environment key as a prefix. */
function commandOf(entry) {
  const env = entry.env === null ? ''
    : Object.keys(entry.env).map((k) => k + '=' + entry.env[k]).join(' ') + ' ';
  return env + ['pnpm', 'run', entry.script].concat(ARGS[entry.script] || []).join(' ');
}

if (profile === undefined || PROFILES[profile] === undefined) {
  bad('verify: no profile was named, or the name is unknown (there are: '
    + Object.keys(PROFILES).join(', ') + ')\n    for example: pnpm run verify:fast');
} else if (args.flags['--list']) {
  /* The machine-readable view of the profile: one line per command. The local run and CI are compared
   * with it. */
  PROFILES[profile].forEach((entry) => { console.log(commandOf(entry)); });
} else {
  const results = [];
  PROFILES[profile].forEach((entry) => {
    const started = Date.now();
    const argv = ['run', entry.script].concat(ARGS[entry.script] || []);
    console.log('▶ ' + labelOf(entry) + ' — ' + STEPS[entry.script]);
    /* A step's output is not captured: every step has its own report for a person, and gluing it into
     * someone else's summary would serve nothing. What matters here is the exit code. */
    const res = run('pnpm', argv, Object.assign({ stdio: 'inherit' },
      entry.env === null ? {} : { env: Object.assign({}, process.env, entry.env) }));
    const seconds = (Date.now() - started) / 1000;
    const code = res.status === null ? 1 : res.status;
    results.push({ name: labelOf(entry), code: code, seconds: seconds });
  });

  const failed = results.filter((r) => r.code !== 0);
  console.log('\nprofile summary “' + profile + '”:');
  results.forEach((r) => {
    console.log('  ' + (r.code === 0 ? '✓' : '✗') + ' ' + r.name.padEnd(18)
      + localeNumber(r.seconds, 1) + ' s');
  });
  const total = results.reduce((sum, r) => sum + r.seconds, 0);
  console.log('  total ' + localeNumber(total, 1) + ' s ('
    + path.basename(process.cwd()) + ', steps ' + results.length + ')');

  if (failed.length > 0) {
    bad('verify: red steps ' + failed.length + ' of ' + results.length + ': '
      + failed.map((r) => r.name).join(', '));
    console.error('    fix what was found, not the sensor: thresholds, baselines and rules do not belong in this commit');
  } else {
    ok('verify: the “' + profile + '” profile is green throughout (' + results.length + ' steps)');
  }
}

#!/usr/bin/env node
/* The checks' run: `node tools/run-tests.js fast` (the same as `pnpm test`) and `node tools/run-tests.js full` (the same as
 * `pnpm test:all`).
 *
 * Why a run of its own when `node --test` exists. Two things it does not have, and both are what the split needs:
 *
 *   1. **The numbers of checks add up.** The run counts the checks of every file and compares the sum with the number of
 *      `test(` declarations in those same files: a file that did not run is not "fewer checks" but a failure of the run.
 *   2. **Every file's duration is visible.** A file runs in a process of its own, and that process's time is printed. It
 *      is a reference for putting a file into the fast run or the full one (`tools/suites.js`), not a threshold — see
 *      below.
 *
 * **The run is not measured by time and never fails over time.** A machine's load is whatever it is, and a red run for
 * someone else's load would be a lie; hence there is neither a target nor a snapshot of cost to agree with. The seconds are
 * printed as a measurement (together with the window's load — numbers of different windows are not comparable), while the
 * split rests on what a file is about rather than on how long it takes.
 *
 * `measure` prints the same duration by running every file one at a time: numbers from a pool are about the pool, while
 * the reference is needed about the file itself.
 *
 * Extra flags after the run's name go to `node --test`, for example
 * `node tools/run-tests.js fast --test-name-pattern=паритет`.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, checksIn, filesOf, testFiles } from './suites.js';
// Output collection is the harness's own: gluing chunks into a string tears a multi-byte character at a border and spoils
// the numbers read from the output.
import { collectOutput } from './harness.js';

const argv = process.argv.slice(2);
const mode = argv[0];
const extra = argv.slice(1);
const jobs = Number(process.env.SIZE_REPORT_TEST_JOBS || 0) || Math.max(1, os.cpus().length);
const MODES = { fast: 'fast', full: 'full' };

/* The numbers are Russian: a comma in the fraction and the right form of the word, or "1 проверок" beside "5 проверок"
 * reads as a broken counter. */
function sec(n) {
  return n.toFixed(2).replace('.', ',');
}

function plural(n, one, few, many) {
  const ten = n % 100;
  const last = n % 10;
  if (ten >= 11 && ten <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function checks(n) {
  return n + ' ' + plural(n, 'check', 'checks', 'checks');
}

function files(n) {
  return n + ' ' + plural(n, 'file', 'files', 'files');
}

function load() {
  return os.loadavg()[0].toFixed(2).replace('.', ',');
}

/* One file, one process: both the duration and the run's own counters come from it. A file that did not run prints its
 * output in full. */
async function runFile(file, args) {
  const started = process.hrtime.bigint();
  const child = spawn(process.execPath, ['--test', file].concat(args), { stdio: ['ignore', 'pipe', 'pipe'] });
  const res = await collectOutput(child);
  const out = res.stdout + res.stderr;
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const count = (what) => {
    const m = out.match(new RegExp('^# ' + what + ' (\\d+)$', 'm'));
    return m === null ? 0 : Number(m[1]);
  };
  return { file: file, code: res.code, out: out, seconds: seconds, tests: count('tests'), fail: count('fail') };
}

/* A pool over the cores: the files of a suite do not depend on one another, but there are more of them than cores.
 * `together` says how many to start at once: the run goes in a pool while the duration is measured one file at a time, so
 * that the numbers are about the file rather than about the pool and its neighbours. */
async function runAll(list, args, together) {
  const done = [];
  let next = 0;
  const width = Math.max(1, Math.min(together === undefined ? jobs : together, list.length));
  await Promise.all(Array.from({ length: width }, async () => {
    while (next < list.length) {
      const i = next++;
      done[i] = await runFile(list[i], args);
    }
  }));
  return done;
}

function line(result) {
  return '  ' + (result.code === 0 ? '✓' : '✗') + ' ' + result.file.padEnd(28) + ' '
    + checks(result.tests).padEnd(18) + ' ' + sec(result.seconds) + ' s';
}

async function measure(all) {
  console.log('every file measured on its own, one at a time (' + files(all.length) + ', load '
    + load() + '):\n');
  const results = await runAll(all, extra, 1);
  results.slice().sort((a, b) => a.seconds - b.seconds).forEach((r) => {
    console.log('  ' + r.file.padEnd(28) + ' ' + checks(r.tests).padEnd(18) + ' '
      + sec(r.seconds) + ' s' + (r.code === 0 ? '' : ' — FAILED'));
  });
  console.log('\nthe measuring window — load ' + load() + ', numbers of different windows are not comparable.'
    + ' The split is declared by a property of the file — `tools/suites.js`.');
  if (results.some((r) => r.code !== 0)) process.exitCode = 1;
}

async function suite(name) {
  const list = filesOf(name);
  const all = testFiles();
  // A file named in the declaration and not found on disk is an error of the declaration rather than an empty run: there is
  // nothing to count its checks with.
  const missing = list.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length > 0) {
    console.error('✗ a file named in the run declaration is not there: ' + missing.join(', ')
      + '\n  fix the list in `tools/suites.js`');
    process.exitCode = 2;
    return;
  }
  const declared = list.reduce((sum, f) => sum + checksIn(f), 0);
  const total = all.reduce((sum, f) => sum + checksIn(f), 0);

  /* The load is named by a measurement **on the way in** rather than on the way out: the run's pool is itself a noticeable
   * part of the load, and a number taken at the end would say more about the run than about the window. */
  const loadBefore = load();
  console.log((name === 'fast' ? '▶ fast run' : '▶ full run') + ': ' + files(list.length)
    + ', ' + checks(declared)
    + (name === 'fast'
      ? ' of ' + total + ' — the other ' + checks(total - declared) + ' are in the full run (`pnpm test:all`)'
      : ' — the whole set (`pnpm test:all`)')
    + '.');
  console.log('machine load on the way in ' + loadBefore + ', files at once '
    + Math.min(jobs, list.length) + '\n');

  const started = Date.now();
  const results = await runAll(list, extra);
  const seconds = (Date.now() - started) / 1000;

  let bad = 0;
  results.forEach((r) => {
    if (r.code === 0) {
      console.log(line(r));
      return;
    }
    bad++;
    console.error('\n✗ ' + r.file + ' (' + sec(r.seconds) + ' s, code ' + r.code + '):\n');
    console.error(r.out.trimEnd() + '\n');
  });

  const tests = results.reduce((sum, r) => sum + r.tests, 0);
  if (tests !== declared) {
    bad++;
    console.error('✗ ' + checks(tests) + ' ran while ' + checks(declared)
      + ' were declared: a file did not reach the run or the declaration is stale');
  }

  // The duration is a measurement rather than a verdict: it is printed so that "expensive inside the fast run" is visible
  // to the eye, while the run does not turn red over it.
  console.log('\n' + (bad === 0 ? '✓ ' : '✗ ') + MODES[name] + ' run: ' + checks(declared)
    + ', failures ' + bad + ', ' + sec(seconds) + ' s (load at the start ' + loadBefore
    + '; no time target is declared)');

  if (bad > 0) process.exitCode = 1;
}

if (['fast', 'full'].includes(mode)) await suite(mode);
else if (mode === 'measure') await measure(testFiles());
else {
  console.error('No run was named. There are: `fast` (fast, the same as `pnpm test`),'
    + ' `full` (full, `pnpm test:all`), `measure` (measure every file duration).');
  console.error('  for example: node tools/run-tests.js fast');
  process.exitCode = 2;
}

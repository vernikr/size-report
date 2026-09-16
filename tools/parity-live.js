#!/usr/bin/env node
/* Compares the package's engine with the golden taken from a live project: the numbers (`--json`) and
 * the assembled report on one and the same commit, in two environments at once.
 *
 * Why apart from a test. The fixture proves the port on a small history where every trap is under
 * control. A live project proves what the fixture cannot: on a real history of 149 commits and 27
 * columns the port moved not a single number, and the report still comes out at the path the
 * consumer named, carrying its own data and pulling nothing from outside. It needs the consumer
 * project on disk and clones it, which is why it lives in the command `pnpm run parity:live` rather
 * than in the general test run.
 *
 * Two environments. The comparison runs both as things are and with the machine's settings
 * unreadable (`GIT_CONFIG_GLOBAL=/dev/null`): the output has to match the golden in both. One green
 * run is not enough — it proves the numbers matched *here* rather than that they do not depend on
 * whose git settings are in play.
 *
 * The environments interleave (each has its own clone), because each is a separate process and the
 * commands inside one environment wait for each other: the check of the check mode looks at the
 * artifact `--write` has just built. Each environment has its own clone for that very reason — one
 * shared clone written to by both at once would be a race.
 *
 * It works on clones: the consumer project is never opened for writing — otherwise the check would
 * replace the report built in it.
 *
 * Run:
 *   node tools/parity-live.js [--repo <path-to-project>] [--bin <path-to-engine>]
 *
 * Exit codes: 0 — parity, 1 — a divergence, 2 — no access to the golden or the project.
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

/* The environments of the comparison: the usual one and the one with someone else's settings. The
 * live project has ASCII paths only, so `core.quotePath` has nothing to do here — what is checked is
 * the fact itself: the output does not depend on the machine's settings. */
const PROFILES = [
  { label: 'the usual environment', env: null },
  { label: 'the machine settings are not read (GIT_CONFIG_GLOBAL=/dev/null)', env: { GIT_CONFIG_GLOBAL: '/dev/null' } }
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

/* A missing file is an answer too ("there is no report"), and it has to be a line of the comparison
 * rather than an exception in the middle of the run. */
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

/* A launch without waiting: the environments interleave, hence `spawn` rather than `spawnSync`. The
 * output is collected whole — it is compared byte for byte — and the joining of the chunks lives in
 * the harness (`collectOutput`) rather than here. */
function runCli(bin, dir, args, env) {
  return collectOutput(spawn(process.execPath, [bin, '--config', CONFIG].concat(args), {
    cwd: dir,
    env: Object.assign({}, process.env, env || {})
  }));
}

/* The data contract has to carry the same truth as the frozen numbers: it is the same history laid
 * out in fields. It is compared on the live history, where the fixture cannot reach: the rows, the
 * absolute values, "now" and the totals the page counts for itself. Columns where a file was deleted
 * and returned fall out of the delta comparison and are named out loud (`BLOCKERS.md` §N4). */
async function checkContract(bin, dir, env, frozen) {
  const res = await runCli(bin, dir, ['--data'], env);
  if (res.code !== 0) return { errors: ['--data did not come back (code ' + res.code + '): ' + res.stderr.trim()] };
  const got = JSON.parse(res.stdout);
  const errors = [];

  if (got.schema !== 1) errors.push('the data schema is not declared');
  if (got.rows.length !== frozen.rows.length) errors.push(got.rows.length + ' rows instead of ' + frozen.rows.length);
  if (got.files.length !== frozen.columns.length) errors.push(got.files.length + ' files instead of ' + frozen.columns.length);
  if (JSON.stringify(got.now) !== JSON.stringify(frozen.rows[frozen.rows.length - 1].cells)) {
    errors.push('"now" diverged from the last row of the reference');
  }

  got.rows.forEach((row, r) => {
    if (r >= frozen.rows.length) return;
    if (row.sha !== frozen.rows[r].sha) { errors.push('row ' + (r + 1) + ': the sha diverged'); return; }
    if (JSON.stringify(row.values) !== JSON.stringify(frozen.rows[r].cells)) {
      errors.push('row ' + (r + 1) + ': the absolute values diverged from the reference');
      return;
    }
    got.metrics.forEach((m) => {
      let sum = 0;
      row.values.forEach((v) => { if (v !== null) sum += v[m.key]; });
      if (sum !== frozen.rows[r].totals[m.key]) {
        errors.push('row ' + (r + 1) + '/' + m.key + ': the total is ' + sum + ' instead of ' + frozen.rows[r].totals[m.key]);
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
        errors.push('the column "' + f.label + '"/' + m.key + ': the deltas do not add up to the current size');
      }
    });
  });

  return { errors: errors, gaps: gaps, rows: got.rows.length, files: got.files.length };
}

/* One comparison: a line about the result and a mark of "bad" (0 or 1). The lines accumulate in the
 * environment's own list rather than being printed as they come: the environments interleave, and
 * live printing would mix the two reports into one unreadable one. */
function verdict(lines, ok, good, bad) {
  lines.push('    ' + (ok ? '✓ ' : '✗ ') + (ok ? good : bad));
  return ok ? 0 : 1;
}

/* The run gave no answer at all — there is nothing left to compare: the environment closes at once,
 * but the failure is counted together with those already found. */
function broken(lines, bad, why) {
  lines.push('    ✗ ' + why);
  return { bad: bad + 1, lines: lines };
}

/* The data contract is not a byte comparison but the same history laid out in fields; its errors are
 * printed not all at once but three at a time: the rest follow from the first. */
function contractLines(lines, contract) {
  if (contract.errors.length === 0) {
    lines.push('    ✓ the data contract carries the same numbers: ' + contract.rows + ' rows, '
      + contract.files + ' files, the totals and the deltas add up to "now"'
      + (contract.gaps.length === 0 ? '' : ' (except the columns where a file came back: ' + contract.gaps.join(', ') + ')'));
    return 0;
  }
  contract.errors.slice(0, 3).forEach((e) => lines.push('    ✗ the data contract: ' + e));
  return 1;
}

/* One whole environment: its own clone, its own runs, its own list of output lines. */
async function checkProfile(profile, expected, tmp) {
  const { bin, repo, head, data, frozen, artifactRel } = expected;
  const lines = ['— ' + profile.label];
  let bad = 0;

  const dir = path.join(tmp, 'clone-' + PROFILES.indexOf(profile));
  gitIn(null, ['clone', '-q', '--no-hardlinks', repo, dir]);
  gitIn(dir, ['checkout', '-q', head]);

  const json = await runCli(bin, dir, ['--json'], profile.env);
  if (json.code !== 0) return broken(lines, bad, 'the engine gave no --json (code ' + json.code + '): ' + json.stderr.trim());
  bad += verdict(lines, json.stdout === data, 'the numbers matched the reference byte for byte',
    'the numbers diverged from the reference: ' + firstDiff(json.stdout, data));

  /* The report is a self-contained page, while the golden was taken from the former static table:
   * there is no byte comparison here any more, and that is not a loss but another subject. What has
   * to stay true is something else: the file appeared at the path the consumer itself named, and it
   * pulls nothing from outside (an external reference would make it unopenable without a network —
   * and it is built exactly to be opened from disk). */
  const wrote = await runCli(bin, dir, ['--write'], profile.env);
  if (wrote.code !== 0) return broken(lines, bad, 'the engine did not build the report: ' + wrote.stderr.trim());
  const artifact = readIfExists(path.join(dir, artifactRel));
  const external = artifact === null ? [] : ['src="', '<link '].filter((m) => artifact.indexOf(m) >= 0);
  const selfMade = artifact !== null && external.length === 0 && artifact.indexOf('id="data"') >= 0;
  bad += verdict(lines, selfMade,
    'the report is self-contained: ' + artifactRel + ', ' + artifact.length + ' B, no external references',
    artifact === null ? 'there is no report at the path from the settings: ' + artifactRel
      : 'the report is not self-contained: ' + (external.length > 0 ? 'external references ' + external.join(', ')
        : 'it carries no data'));

  const checked = await runCli(bin, dir, [], profile.env);
  bad += verdict(lines, checked.code === 0, 'the check mode on its own artifact is green',
    'the check mode is red: ' + checked.stderr.trim());

  bad += contractLines(lines, await checkContract(bin, dir, profile.env, frozen));
  return { bad: bad, lines: lines };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = path.resolve(typeof args.flags['--repo'] === 'string' ? args.flags['--repo'] : DEFAULT_REPO);
  const bin = path.resolve(typeof args.flags['--bin'] === 'string' ? args.flags['--bin'] : DEFAULT_BIN);

  for (const [what, file] of [['the reference', path.join(PARITY, 'manifest.json')], ['the engine', bin]]) {
    if (!fs.existsSync(file)) {
      console.error('✗ there is no ' + what + ': ' + file + ' — nothing to compare');
      return 2;
    }
  }
  if (!fs.existsSync(repo)) {
    console.error('✗ the consumer project was not found: ' + repo
      + '\n  name the path: node tools/parity-live.js --repo <path>');
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
    console.log((bad === 0 ? '✓ parity with the live project' : '✗ parity with the live project is broken')
      + ': the project ' + manifest.project.name + ' at ' + head.slice(0, 7) + ', '
      + rows + ' rows × ' + manifest.data.columns + ' columns, ' + PROFILES.length + ' environments');
    return bad === 0 ? 0 : 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().then((code) => { process.exitCode = code; }).catch((e) => {
  console.error('✗ ' + (e && e.message ? e.message : e));
  process.exitCode = 2;
});

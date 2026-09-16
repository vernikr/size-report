#!/usr/bin/env node
/* The guard of the gate files: thresholds, baselines, sensor rules and the check harness itself cannot
 * be edited in silence. An edit is possible, but it is deliberate and visible: the commit message has
 * to carry the line `Gate-Change: <reason>`.
 *
 * The defect class it exists for is simple: a gate that can be weakened by the very commit it fails is
 * no gate. Everything else (thresholds taken from measurements, a ratchet instead of an ideal) rests on
 * that weakening being visible in history.
 *
 * Where it is called: the `commit-msg` hook (the check is made at commit time) and the `pre-push` hook
 * over `origin/main..HEAD` (so that a commit made with no local hook does not slip through unseen). It
 * is no profile step, so the range check is the pushing machine's job and CI does not run it — the
 * steps are listed in `run.js`.
 *
 * Run: `node tools/gates/gatefiles.js --commit-msg <file>` (hook),
 * `node tools/gates/gatefiles.js --range origin/main` (the gate itself: any range works for a
 * hand-run). Exit codes: 0 — clean, 1 — a gate edit without the trailer.
 */

import fs from 'node:fs';
import { bad, git, ok, parseArgs } from './common.js';

/* The directory git is read in: the working repository, and in the guard's own probes a temporary
 * repository. The hook calls the gate with no such flag, that is, over the working tree. `git` comes
 * from the shared harness: the read settings are pinned (`src/git.js`), or `core.quotePath` would quote
 * a non-ASCII path and no rule would recognise it. */
const args = parseArgs(process.argv.slice(2), ['--commit-msg', '--range', '--cwd'], []);
const read = (argv) => git(argv, args.flags['--cwd'] ? { cwd: args.flags['--cwd'] } : {});

/* What is protected: everything a sensor is configured or switched off by. The list is part of the
 * script itself, so editing it needs the trailer too (the self-protection is no decoration). */
const GATE_FILES = [
  /^package\.json$/, // scripts, dependencies, version pinning
  /^pnpm-lock\.yaml$/,
  /^eslint\.config\.js$/, /^eslint\.metrics\.config\.js$/, /^\.eslint-suppressions\.json$/,
  /^\.jscpd\.json$/, /^dup-baseline\.json$/,
  /^\.dependency-cruiser\.cjs$/, /^\.dependency-cruiser-known-violations\.json$/,
  /^\.c8rc\.json$/, /^coverage-baseline\.json$/,
  /^\.github\/workflows\//,
  /^\.githooks\//,
  /^tools\/gates\//,
  /^tools\/suites\.js$/, // the split into fast and full runs is a gate decision too
  /^test\/gates-[a-z-]+\.test\.js$/ // the sensors' own probes
];

/* A trailer with a reason, not a mark: "Gate-Change: ok" is no justification. */
const TRAILER = /^Gate-Change: (\S.*)$/m;

function gateFilesAmong(files) {
  return files.filter((f) => GATE_FILES.some((p) => p.test(f))).sort();
}

function hasTrailer(message) {
  const m = message.match(TRAILER);
  return m !== null && m[1].trim().length >= 12;
}

function report(what, files, message) {
  if (files.length === 0) return true;
  if (hasTrailer(message)) {
    console.log('  ✓ ' + what + ': gate files ' + files.length + ', the Gate-Change: trailer is there');
    return true;
  }
  bad(what + ': a gate edit with no Gate-Change: trailer');
  files.forEach((f) => console.error('    ' + f));
  console.error('    add a line `Gate-Change: <reason>` to the commit message —'
    + ' thresholds and baselines are changed by a person on purpose');
  return false;
}

if (args.flags['--commit-msg'] !== undefined) {
  const message = fs.readFileSync(args.flags['--commit-msg'], 'utf8');
  const staged = read(['diff', '--cached', '--name-only', '--diff-filter=ACDMR'])
    .stdout.split('\n').filter((f) => f !== '');
  if (report('gatefiles', gateFilesAmong(staged), message)) {
    console.log('✓ gatefiles: the commit can be made (' + staged.length + ' files, gate files '
      + gateFilesAmong(staged).length + ')');
  }
} else if (args.flags['--range'] !== undefined) {
  /* Commit by commit across the range: a gate edit in one commit cannot be covered by the trailer of
   * the one beside it. */
  const base = args.flags['--range'];
  const log = read(['log', '--format=%H%x00%B%x1e', base + '..HEAD']).stdout;
  const commits = log.split('\x1e').map((c) => c.trim()).filter((c) => c !== '');
  let clean = true;
  let checked = 0;
  commits.forEach((entry) => {
    const at = entry.indexOf('\x00');
    const sha = entry.slice(0, at);
    const message = entry.slice(at + 1);
    const names = read(['diff-tree', '--no-commit-id', '--name-only', '-r', sha])
      .stdout.split('\n').filter((f) => f !== '');
    checked++;
    if (!report('gatefiles ' + sha.slice(0, 7), gateFilesAmong(names), message)) clean = false;
  });
  if (clean) ok('gatefiles: across ' + base + '..HEAD there are ' + checked + ' commits, none of them touched a gate file without the trailer');
} else {
  bad('gatefiles: no mode was named — `--commit-msg <file>` (the hook) or `--range <ref>` (CI)');
}

/* Shared by the four sensors, the profile runner and the gate guard: the root, argument parsing,
 * running a process, machine reports. One copy, since argument parsing and report writing drift apart
 * otherwise the way any two copies do.
 *
 * The reports are machine-readable (JSON, two spaces, a trailing newline: they are diffed line by
 * line) and live in `reports/`, which is in `.gitignore`: a report is what a person looks at, not what
 * history keeps.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitArgv, gitEnv } from '../../src/git.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPORTS = path.join(ROOT, 'reports');

/* What is scanned at all: the code of the package. The root configs stay out: they configure these
 * very sensors, and a sensor measuring the file its own thresholds live in would be measuring
 * itself. */
export const CODE = ['src', 'bin', 'tools', 'test'];

/* Arguments are parsed one way for every sensor: `--flag value` and flag-only switches; everything
 * else is a path. */
export function parseArgs(args, values, bools) {
  const out = { flags: {}, rest: [] };
  for (let i = 0; i < args.length; i++) {
    if (values.indexOf(args[i]) >= 0) { out.flags[args[i]] = args[i + 1]; i++; continue; }
    if (bools.indexOf(args[i]) >= 0) { out.flags[args[i]] = true; continue; }
    out.rest.push(args[i]);
  }
  return out;
}

export function pathsOf(args, fallback) {
  const named = args.flags['--paths'];
  if (named !== undefined) return named.split(',').filter((p) => p !== '');
  return args.rest.length === 0 ? (fallback || CODE) : args.rest;
}

export function run(cmd, argv, options) {
  return spawnSync(cmd, argv, Object.assign({
    cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024
  }, options || {}));
}

/* Reading git goes through the package's boundary (`src/git.js`) rather than as it comes: the settings
 * that change what is read are pinned there (`core.quotePath` quotes non-ASCII paths, the locale
 * changes the parsing). The sensors read file names and compare them with rules, so an unpinned read
 * would be green here and red on a machine with default settings (`BLOCKERS.md` §B1,
 * `test/git-pins.test.js`). */
export function git(args, options) {
  return run('git', gitArgv(args), Object.assign({ env: gitEnv() }, options || {}));
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/* Writing a report: the directory is created and an old report is overwritten whole — a report must
 * not carry a past run glued into it. */
export function writeReport(name, data) {
  fs.mkdirSync(REPORTS, { recursive: true });
  const file = path.join(REPORTS, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return file;
}

export function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

export function ok(text) {
  console.log('✓ ' + text);
}

/* Red means exit code 1 and a line on stderr: a sensor has one language for its report, the same one
 * the tool refuses in (`src/refusal.js`). */
export function bad(text) {
  console.error('✗ ' + text);
  process.exitCode = 1;
}

export function indent(text) {
  return String(text).split('\n').map((l) => '    ' + l).join('\n');
}

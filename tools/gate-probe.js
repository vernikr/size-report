/* The harness of the sensor probes (`test/gates-*.test.js`): a sensor is called as a **command**,
 * not imported — an import checks neither argument parsing nor the exit code, that is, it checks
 * nothing of what a sensor actually does. The directory, the launch and the reading of the answer
 * live in one place: a copy per probe would diverge as quietly as the two copies of the report
 * calculation once did.
 *
 * A probe of a deliberate violation is not decoration: a sensor that cannot be made red guards
 * nothing, and its "green" means nothing.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitArgv, gitEnv } from '../src/git.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* Running anything with one buffer and one reading of the answer. The answer joins stdout and
 * stderr on purpose: a sensor writes its verdict to stdout and its reasons to stderr, and a check
 * needs both halves. */
export function exec(cmd, argv, options) {
  const res = spawnSync(cmd, argv, Object.assign({
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  }, options || {}));
  return { code: res.status === null ? 1 : res.status, out: (res.stdout || '') + (res.stderr || '') };
}

/* A sensor is named by its file in `tools/gates/`: `probe('dup', ['--update'])`. */
export function probe(gate, argv, options) {
  return exec(process.execPath, ['tools/gates/' + gate + '.js'].concat(argv || []), options);
}

/* git in a probe runs with the same pinned settings as the package (`src/git.js`): an unpinned
 * read is green here and red on a machine with default settings, and for a probe that is the same
 * false net (`test/git-pins.test.js`). */
export function git(args, options) {
  return exec('git', gitArgv(args), Object.assign({ env: gitEnv() }, options || {}));
}

/* A temporary directory by its real path: on macOS `/tmp` is a link to `/private/tmp`, and the
 * dependency resolver takes one and the same file for two modules (in a probe that produced a
 * false orphan: one copy of the path had a link, the other did not). */
export function tempDir(prefix) {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-' + prefix + '-')));
}

export function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function pkg() {
  return readJson(path.join(ROOT, 'package.json'));
}

/* A sensor's verdict is its exit code: 0 is green, anything else is red. Checks read the output
 * separately, so both go out. */
export function red(result) {
  return result.code !== 0;
}

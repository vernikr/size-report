/* The checks' shared part: paths, fresh clones of the fixture, running the tool the way a user calls it, and the small
 * helpers of comparison (hashes, JSON parsing, the first difference). It is not a suite but a helper for suites.
 *
 * It lives in `tools/` rather than in `test/`: the Node runner counts every `.js` under a `test/` directory (and every
 * `test-*.js` anywhere) as a suite, would execute this helper as an empty one and would break the counters. Here it is
 * simply a module the suites import.
 *
 * Two rules are why the harness keeps clones and a cache at all:
 *
 *   1. One clone of the fixture per environment (`sharedClone`) rather than one per check: a clone costs time, but a run
 *      of the tool costs more.
 *   2. The same command in the same environment is not run twice for two different checks (`readRun`). Only read-only
 *      runs are cached: `--write` and the control mode depend on the state of the tree, and a cache for them would be a
 *      lie.
 *
 * Checks that edit files take a clone of their own (`cloneFixture`) and never enter the shared ones: a neighbouring
 * check in the same file would get someone else's edit.
 *
 * The third rule is about git: checks and tools call it with the pins of the engine (`gitIn`, or `gitTry` where the exit
 * code is needed), and the settings come from the one list `src/git.js` pins. The one deliberately unpinned call
 * (`gitBare`) exists to measure the environment itself, and the guard `test/git-pins.test.js` requires every direct git
 * call to go through that list — listing the two files where a bare call is a decision rather than an oversight.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitArgv, gitEnv } from '../src/git.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SYNTH = path.join(ROOT, 'fixtures', 'synthetic');
export const PARITY = path.join(ROOT, 'fixtures', 'parity');
export const BUNDLE = path.join(SYNTH, 'history.bundle');
export const CONFIG = path.join(SYNTH, 'config.json');
export const PACKAGE_BIN = path.join(ROOT, 'bin', 'size.js');
export const MAX_BUF = 256 * 1024 * 1024;

/* The tools under check: the engine's package and the frozen copy both fixtures were taken with. The copy carries an
 * environment of its own — the one the fixture was taken in, `core.quotePath=false`: the copy predates the pin the
 * engine sets for itself, so under a machine's default settings it would reproduce with a line missing. */
export const PACKAGE = { name: 'the package engine', file: PACKAGE_BIN, env: null };

/* The frozen copy of the implementation, with which both fixtures were taken, does not lie in the tree: it is a rarely
 * needed past rather than a working copy of the package, and the place for such a past is the history, from where its
 * bytes are fetched on demand. The path is the one the copy lay under: it is recorded in the origins of both fixtures and
 * stays their record rather than today's tree. */
export const LEGACY_PATH = 'fixtures/legacy/size-table.cjs';

let legacyFile = null;

/* The copy's bytes come from the commit that **added** it (the last one, if it was introduced more than once): that way
 * the material is not tied to a hand-written sha and survives any move of the history. What is fetched is compared with
 * the hash the fixture's origin recorded: otherwise "the very same copy" would silently stop being it. */
export function legacyTool() {
  if (legacyFile !== null) return legacyFile;
  const added = gitIn(ROOT, ['log', '--diff-filter=A', '--format=%H', '--', LEGACY_PATH])
    .split('\n').filter((line) => line !== '')[0];
  if (added === undefined) {
    throw new Error('the history has no ' + LEGACY_PATH
      + ': the copy the reference was taken with is nowhere to be had');
  }
  const bytes = execFileSync('git', gitArgv(['-C', ROOT, 'show', added + ':' + LEGACY_PATH]),
    { maxBuffer: MAX_BUF, env: gitEnv() });
  const want = JSON.parse(fs.readFileSync(path.join(PARITY, 'manifest.json'), 'utf8')).tool.sha256;
  assert.equal(sha256(bytes), want, 'the copy from the history (' + added.slice(0, 7) + ') diverged from'
    + ' the one recorded by the origin of the reference: there would be nothing left to compare');
  legacyFile = path.join(tempDir('legacy'), 'size-table.cjs');
  fs.writeFileSync(legacyFile, bytes);
  return legacyFile;
}

export function frozenTarget() {
  return {
    name: 'the frozen copy of the implementation',
    file: legacyTool(),
    env: gitConfig({ 'core.quotePath': 'false' })
  };
}

export function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-' + name + '-'));
}

/* git settings through the environment (git ≥ 2.31): that way a check hands the machine rules of its own without touching
 * either its config or the fixture. */
export function gitConfig(pairs) {
  const env = { GIT_CONFIG_COUNT: String(Object.keys(pairs).length) };
  Object.keys(pairs).forEach((key, i) => {
    env['GIT_CONFIG_KEY_' + i] = key;
    env['GIT_CONFIG_VALUE_' + i] = pairs[key];
  });
  return env;
}

/* A clone of the fixture with no shared hard links: it is also the working tree for the checks that edit files. */
export function cloneFixture(into) {
  gitIn(null, ['clone', '-q', '--no-hardlinks', BUNDLE, into]);
  return into;
}

/* A clone laid out with newline normalisation: that is how a working tree looks under `core.autocrlf=true`, the default of
 * Git's installer for Windows. On disk CRLF, in git LF, and git counts the tree as clean. */
export function cloneCrlf(into) {
  gitIn(null, ['-c', 'core.autocrlf=true', 'clone', '-q', '--no-hardlinks', BUNDLE, into]);
  gitIn(into, ['config', 'core.autocrlf', 'true']);
  return into;
}

/* A project from scratch: an empty repository with an `src` directory and a given identity — without it git refuses to
 * commit and cannot ask. One for every suite that needs a project of its own rather than a clone of the fixture
 * (measured: three suites had grown this separately). */
export function initRepo(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  gitIn(dir, ['init', '-q', '-b', 'main']);
  ['user.name', 'user.email', 'commit.gpgsign'].forEach((key, i) => {
    gitIn(dir, ['config', key, ['fixture', 'fixture@local', 'false'][i]]);
  });
  return dir;
}

/* Everything committed in a repository of one's own, with the identity git cannot ask for and therefore refuses
 * without (the five commands every suite that builds a project repeats). It is not `initRepo`: that one lays out an
 * empty scaffold and commits nothing, while this one commits what already lies there — and the author name is a
 * parameter, because a suite checking what a non-ASCII one does to the parse names its own. */
export function commitAll(dir, name, email, subject) {
  gitIn(dir, ['init', '-q']);
  gitIn(dir, ['config', 'user.name', name]);
  gitIn(dir, ['config', 'user.email', email]);
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', subject]);
  return dir;
}

/* The frozen numbers the port has to reproduce: the text is compared byte for byte and the parsed form is what a check
 * reads counts out of. Read here rather than in each suite — this is the one place that knows where the golden lies. */
export function golden() {
  const text = fs.readFileSync(path.join(SYNTH, 'golden.json'), 'utf8');
  return { text: text, json: JSON.parse(text) };
}

/* A fresh project with a settings draft of its own, ready for a run: two suites start from exactly this
 * state (the minifier's way and the tokens'), and the state is shared rather than copied — a copied block
 * is what the `dup` sensor counts, and a copy is what it was: the same commands with the same assertion
 * between them. The file's text is the caller's: the suites differ in what they measure, not in the setup. */
export function draftedRepo(dir, code) {
  initRepo(dir);
  fs.writeFileSync(path.join(dir, 'src', 'code.js'), code);
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'the first commit']);
  const made = runSize(dir, ['--init']);
  assert.equal(made.code, 0, 'the draft was not built: ' + made.stderr.trim());
  return { dir: dir, file: path.join(dir, 'size-table.config.json') };
}

/* A working tree whose history is cut: what `git clone --depth 1` gives. Two suites need exactly this state — the
 * command line and the doctor both have to name the command that fills the history in rather than count coverage over
 * it, and both start from the same cut clone. The assertions are the ones both suites had written out: the clone went
 * through and the history really is shallow, otherwise there would be nothing to check. */
export function shallowClone(source, into) {
  const clone = gitTry(null, ['clone', '-q', '--depth', '1', 'file://' + source, into]);
  assert.equal(clone.status, 0, 'the truncated working tree was not assembled: ' + firstLine(clone.stderr));
  assert.equal(gitIn(into, ['rev-parse', '--is-shallow-repository']).trim(), 'true',
    'the working tree came out complete: there is nothing to check');
  return into;
}

/* One shared clone per environment for read-only runs. It is created on first use: suites that need no environment pay
 * nothing for it. */
const shared = new Map();
export function sharedClone(kind, tempRoot) {
  if (!shared.has(kind)) {
    const dir = path.join(tempRoot, 'shared-' + kind);
    shared.set(kind, kind === 'crlf' ? cloneCrlf(dir) : cloneFixture(dir));
  }
  return shared.get(kind);
}

/* The pinned way into git for checks and tools: the pins and the locale are shared with the engine (`src/git.js`), so that
 * the list of settings is one for the package. `dir === null` means the command is not about a directory (a clone,
 * reading a bundle). */
export function gitIn(dir, args) {
  return execFileSync('git', gitArgv((dir === null ? [] : ['-C', dir]).concat(args)),
    { encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv() });
}

// The same, but with the exit code: where a refusal is an expected answer (a merge, a clone).
export function gitTry(dir, args) {
  const res = spawnSync('git', gitArgv((dir === null ? [] : ['-C', dir]).concat(args)),
    { encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv() });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/* A deliberately unpinned call — and it is the only one in the package: a check that measures the environment itself
 * (whether git takes settings from the environment and whether a command-line key outranks them) is hindered by the pins
 * exactly as they help everywhere else. Hence a name that says what it does rather than "this happened by accident". */
export function gitBare(args, opts) {
  return spawnSync('git', args, Object.assign({ encoding: 'utf8', maxBuffer: MAX_BUF }, opts || {}));
}

/* A tool may be missing (a build not made, the frozen copy not taken) — then the checks have to say so in words rather
 * than hand back "code null". */
export function requireTarget(target) {
  assert.ok(fs.existsSync(target.file),
    'there is no ' + path.relative(ROOT, target.file) + ' — nothing to check');
}

/* A refusal has to explain itself: the exit code from the table, a message with text and without a stack. */
export function refusal(res, code, what) {
  assert.equal(res.code, code, what + ': expected code ' + code + ', got ' + res.code
    + ' — ' + firstLine(res.stderr));
  assert.equal(hasStack(res.stderr + res.stdout), false,
    what + ': the refusal printed a stack instead of a message:\n' + res.stderr);
  assert.notEqual(res.stderr.trim(), '', what + ': the refusal explained nothing');
}

/* Running a command the way a user sees it: `node <file> …`.
 * `env` is added on top of the process's environment — that is how someone else's git settings are checked. */
export function runTool(target, dir, args, env) {
  const res = spawnSync(process.execPath, [target.file].concat(args),
    {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: MAX_BUF,
      env: Object.assign({}, process.env, target.env || {}, env || {})
    });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// A run of the engine's package, which needs neither the frozen copy nor the fixture.
export function runSize(dir, args, env) {
  return runTool({ name: 'the package engine', file: PACKAGE_BIN, env: null }, dir, args, env);
}

// The same run, but with the fixture's settings — what most checks read.
export function runFixture(dir, args, env) {
  return runSize(dir, ['--config', CONFIG].concat(args), env);
}

// The same run with the fixture's settings, for any of the tools under check.
export function runFixtureWith(target, dir, args, env) {
  return runTool(target, dir, ['--config', CONFIG].concat(args), env);
}

/* A number for a person to read: printed in the locale the machine runs in, with a fixed number of decimals. The
 * separator belongs to the locale rather than to a sentence, while the words around the number stay English — an
 * explicitly pinned locale would raise a question nothing here asks: which language the repository's own tooling
 * prints in. The decimals are the reader's: hundredths in the checks' run, tenths in a profile's summary. */
export function localeNumber(n, digits) {
  return new Intl.NumberFormat(undefined,
    { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/* Collecting output without waiting for the end: needed where runs are interleaved and cannot be awaited one by one
 * (`tools/parity-live.js`). Chunks are kept as buffers rather than glued to a string: a chunk arrives from the stream
 * wherever the kernel returned it, and a multi-byte character may fall on the border between chunks. A string built from
 * a chunk would decode both halves apart and give two replacement characters instead of one letter — the comparison would
 * fail at a random place rather than at a difference (guarded by `test/runner.test.js`). */
export function collectOutput(child) {
  return new Promise((resolve) => {
    const out = [];
    const err = [];
    let size = 0;
    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size < MAX_BUF) out.push(chunk);
      else child.kill();
    });
    child.stderr.on('data', (chunk) => { err.push(chunk); });
    child.on('close', (code) => resolve({
      code: code,
      stdout: Buffer.concat(out).toString('utf8'),
      stderr: Buffer.concat(err).toString('utf8')
    }));
  });
}

/* A cache of read-only runs: the key is the tool, the directory, the flags and the environment. Only for commands that
 * write nothing and do not depend on what has already been written. */
const cache = new Map();
export function readRun(target, dir, args, env) {
  const key = [target.file, dir, args.join(' '), JSON.stringify(env || {})].join('\u0000');
  if (!cache.has(key)) cache.set(key, runFixtureWith(target, dir, args, env));
  return cache.get(key);
}

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// A hash recorded in the `sha256sum` format: "<hash>  <file>".
export function shaFileLine(file) {
  return fs.readFileSync(file, 'utf8').split(/\s+/)[0];
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function firstLine(text) {
  return text.trim().split('\n')[0];
}

/* A difference has to explain itself: the number of the first diverging line and both lines in full — otherwise "the JSON
 * did not match" says nothing about the cause. */
export function firstDiff(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) {
      return 'line ' + (i + 1) + '\n    in the output: ' + JSON.stringify((la[i] || '').slice(0, 160))
        + '\n    in the reference: ' + JSON.stringify((lb[i] || '').slice(0, 160));
    }
  }
  return 'the bytes differ although the lines are identical (line endings or encoding)';
}

/* A stack is never handed out: it holds no hint of a fix while it does hold the machine's paths. V8 frames start with an
 * indent and `at `. */
export function hasStack(text) {
  return /^\s+at /.test(text);
}

// The fix command taken out of a message: `node <path> --init`.
export function commandIn(text) {
  const m = /node\s+(\S+)\s+(--\S+)/.exec(text);
  return m === null ? null : { file: m[1], flag: m[2] };
}

/* Flags of a tool's own command line: `--name value` and flag-only switches, everything else positional (the first
 * one wins). The engine reads its line in `src/args.js` and the sensors theirs in `tools/gates/common.js`; the tools
 * here need this third shape, and one copy of it keeps them from drifting apart. */
export function flagArgs(args) {
  const out = { positional: null, flags: {} };
  for (let i = 0; i < args.length; i++) {
    if (args[i].indexOf('--') === 0) {
      const next = args[i + 1];
      if (next !== undefined && next.indexOf('--') !== 0) { out.flags[args[i]] = next; i++; continue; }
      out.flags[args[i]] = true;
      continue;
    }
    if (out.positional === null) out.positional = args[i];
  }
  return out;
}

/* The reference settings with an edit, written beside the caller's own temporary directory: the history and the other
 * settings stay as they are, so numbers and causes are comparable between cases rather than "roughly alike". */
export function configWith(dir, name, edit) {
  const cfg = JSON.parse(JSON.stringify(readJson(CONFIG)));
  edit(cfg);
  const file = path.join(dir, name.endsWith('.json') ? name : name + '.json');
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  return file;
}

/* The tail of a tool's own script: `main` answers with an exit code (or with nothing, meaning success), while a
 * failure is one line rather than a stack — these commands are run by people and print verdicts of their own. */
export function runMain(main, failCode) {
  Promise.resolve().then(main).then(
    (code) => { process.exitCode = code === undefined ? 0 : code; },
    (e) => {
      console.error('✗ ' + (e && e.message ? e.message : e));
      if (e && e.stderr) console.error(String(e.stderr).trim());
      process.exitCode = failCode;
    }
  );
}

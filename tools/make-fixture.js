#!/usr/bin/env node
/* Builds the synthetic size-report fixture: a small repository whose history collects the traps
 * real projects have, plus a bundle to carry it around.
 *
 * Why. The engine cannot be checked against a live project's history: it changes, it is big, and
 * half the traps are not in it. The fixture is determined — author, dates and contents are fixed,
 * so the commit shas are reproducible. The golden numbers (`golden.json`) are taken from the frozen
 * copy of the implementation once, and from then on the port has to reproduce them.
 *
 * This file is the **entry**: flag reading, the fixture's settings, taking the golden and the
 * manifest. The build stories live next door (`tools/synthetic/`) because they answer other
 * questions: `repo.js` how we talk to git (time, author, pins), `content.js` what lies in the files,
 * `history.js` what commits come of it, `note.js` what a person reads about it. The list of traps
 * belongs to the note rather than to the code: it is part of the note.
 *
 * The tool and the environment of the taking are pinned. The copy comes from the history
 * (`tools/harness.js`, `legacyTool`), so a re-take does not depend on whether the consumer project
 * keeps a copy of its own. The environment is `core.quotePath=false`: the copy predates the pin the
 * engine sets for itself, and a machine with default git settings would lose the fixture's line with
 * a non-ASCII file name — a shorter golden, silently.
 *
 * Run (from the size-report repository root):
 *   node tools/make-fixture.js                        # bundle + config + golden
 *   node tools/make-fixture.js --legacy-tool <path>    # another tool, if one is needed
 *   node tools/make-fixture.js --bundle-only           # bundle only (no golden)
 *   node tools/make-fixture.js --keep                  # keep the temporary repository
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LEGACY_PATH, MAX_BUF, gitConfig, legacyTool as legacyCopy, sha256 } from './harness.js';
/* A flag's value is read the same way the package's engine reads it (`src/config.js`) rather than
 * by a parser of its own: "a flag with no value" is a shared question, and a second copy of it would
 * diverge from the first as quietly as any two copies do (the `dup` sensor found it). */
import { argValue } from '../src/config.js';
import { git } from './synthetic/repo.js';
import { buildRepo } from './synthetic/history.js';
import { ARTIFACT } from './synthetic/content.js';
import { fixtureNote } from './synthetic/note.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'fixtures', 'synthetic');

/* The environment of the taking is the one the frozen-copy checks use (`tools/harness.js`,
 * `frozenTarget`): without the path reading pinned, the golden is taken by another one. */
const FROZEN_ENV = gitConfig({ 'core.quotePath': 'false' });

// --- the fixture's settings -------------------------------------------------

const CONFIG = {
  output: ARTIFACT,
  locale: 'ru',
  title: 'Объём файлов по коммитам — фикстура',
  heading: 'Фикстура: история с ловушками',
  fixCommand: 'node tools/size-table.js --write',
  metrics: ['raw', 'min'],
  columns: [
    { label: 'code.js', paths: ['src/code.js'] },
    { label: 'modern.js', paths: ['src/modern.js', 'src/legacy.js'] },
    { label: 'config.mjs', paths: ['src/config.mjs'] },
    { label: 'заметки.md', paths: ['docs/заметки.md'] },
    { label: 'crlf.txt', paths: ['notes/crlf.txt'] },
    { label: 'package.json', paths: ['package.json'] },
    { label: 'style.css', paths: ['src/style.css'] },
    { label: 'table.toml', paths: ['data/table.toml'] },
    { label: 'empty.js', paths: ['src/empty.js'] },
    { label: 'WORKLOG.md', paths: ['WORKLOG.md'] }
  ],
  journal: {
    path: 'WORKLOG.md',
    url: '../WORKLOG.md',
    pattern: '^## (?<id>\\d+)\\.\\s+(?<title>.+?)\\s*$',
    anchor: 'heading'
  },
  links: { commitUrl: '' },
  rows: { merges: true, sha: true },
  skip: []
};

/* --- flags, history and the golden ------------------------------------------ */

function options(args) {
  /* An empty value means "the flag was named without a value", that is, no value was given:
   * `--out` without a path takes the default, `--legacy-tool` without one the built-in copy. */
  const out = argValue(args, '--out');
  const legacy = argValue(args, '--legacy-tool');
  const named = typeof legacy === 'string' && legacy !== '';
  const tool = named ? path.resolve(legacy) : legacyCopy();
  /* The origin records the path the copy lay under rather than where its bytes live today: the
   * record is the golden's history, and it has to agree with what the manifest holds — and no move
   * rewrites the manifest. */
  return {
    out: path.resolve(out === null || out === '' ? OUT : out),
    tool: tool,
    name: named ? path.relative(ROOT, tool) : LEGACY_PATH,
    bundleOnly: args.indexOf('--bundle-only') >= 0,
    keep: args.indexOf('--keep') >= 0
  };
}

function commitLog(repo) {
  return git(repo, ['log', '--reverse', '--date=format:%Y-%m-%d %H:%M',
    '--pretty=format:%H' + '\u0001' + '%ad' + '\u0001' + '%s'])
    .split('\n').filter((l) => l !== '').map((line) => {
      const f = line.split('\u0001');
      return { sha: f[0], when: f[1], subject: f[2] };
    });
}

function runLegacy(tool, dir, cfgPath, args, env) {
  const res = spawnSync(process.execPath, [tool, '--config', cfgPath].concat(args), {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: MAX_BUF,
    env: Object.assign({}, process.env, FROZEN_ENV, env || {})
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/* The artifact is built on a clone rather than in the assembled repository: `--write` writes a file,
 * and in the fixture it has to stay untracked rather than become one commit more. */
function takeArtifact(paths, clone) {
  const wrote = runLegacy(paths.tool, clone, paths.config, ['--write']);
  if (wrote.code !== 0) throw new Error('the tool did not build the artifact: ' + wrote.stderr.trim());
  const artifact = fs.readFileSync(path.join(clone, CONFIG.output));
  fs.writeFileSync(path.join(paths.out, 'artifact.sha256'),
    sha256(artifact) + '  ' + CONFIG.output + '\n', 'utf8');
  return artifact;
}

/* Paths outside ASCII: git quotes them depending on the locale, and if the numbers change with it
 * the golden is not portable — worth knowing before rather than after. */
function localeStable(paths, clone, data) {
  const cLocale = runLegacy(paths.tool, clone, paths.config, ['--json'], { LC_ALL: 'C', LANG: 'C' });
  const cData = cLocale.code === 0 ? JSON.parse(cLocale.stdout) : null;
  return !!cData && JSON.stringify(cData) === JSON.stringify(data);
}

function takeGolden(paths, ctx) {
  if (!fs.existsSync(paths.tool)) {
    throw new Error('there is no tool to take the reference with: ' + paths.tool
      + ' (name it with --legacy-tool <path>)');
  }
  const clone = path.join(paths.work, 'clone');
  git(paths.work, ['clone', '-q', paths.bundle, clone]);
  const json = runLegacy(paths.tool, clone, paths.config, ['--json']);
  if (json.code !== 0) throw new Error('the tool gave no --json: ' + json.stderr.trim());
  const data = JSON.parse(json.stdout);
  const golden = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(paths.out, 'golden.json'), golden, 'utf8');

  const artifact = takeArtifact(paths, clone);
  // The check mode must be green: the golden was taken from an agreed artifact.
  const checked = runLegacy(paths.tool, clone, paths.config, []);
  if (checked.code !== 0) throw new Error('the check mode on the fixture is red: ' + checked.stderr.trim());

  ctx.localeStable = localeStable(paths, clone, data);
  ctx.legacy = {
    file: paths.name,
    sha256: sha256(fs.readFileSync(paths.tool)),
    rows: data.rows.length,
    columns: data.columns.length,
    metrics: data.metrics,
    skipped: data.skipped.length,
    artifactBytes: artifact.length,
    artifactSha256: sha256(artifact),
    goldenSha256: sha256(golden)
  };
}

/* The manifest is the fixture's identity: the commit shas and the hashes of every file beside them.
 * It does not list itself (the manifest would then depend on the manifest). */
function writeManifest(out, ctx) {
  const files = fs.readdirSync(out).sort().reduce((acc, name) => {
    const full = path.join(out, name);
    if (fs.statSync(full).isFile() && name !== 'manifest.json') {
      acc[name] = { bytes: fs.statSync(full).size, sha256: sha256(fs.readFileSync(full)) };
    }
    return acc;
  }, {});
  const manifest = {
    schema: 1,
    kind: 'synthetic',
    head: ctx.head,
    commits: ctx.commits,
    files: files,
    localeStable: ctx.localeStable,
    legacy: ctx.legacy
  };
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

function announce(bundle, ctx) {
  console.log('✓ the fixture: ' + path.relative(ROOT, path.dirname(bundle)));
  console.log('  ' + ctx.commits.length + ' commits, HEAD ' + ctx.head.slice(0, 7)
    + ', bundle ' + fs.statSync(bundle).size + ' B');
  if (ctx.legacy) {
    console.log('  the reference: ' + ctx.legacy.rows + ' rows × ' + ctx.legacy.columns + ' columns, '
      + ctx.legacy.skipped + ' commits without a row, artifact ' + ctx.legacy.artifactBytes + ' B');
    console.log('  the tool ' + ctx.legacy.file + ' sha256 ' + ctx.legacy.sha256.slice(0, 12));
  }
  if (!ctx.localeStable) {
    console.log('  ! the reference depends on the locale: the numbers under LC_ALL=C differ (see the fixture README)');
  }
}

function main() {
  const opts = options(process.argv.slice(2));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-fixture-'));
  try {
    const repo = path.join(work, 'repo');
    buildRepo(repo);
    const log = commitLog(repo);
    const head = git(repo, ['rev-parse', 'HEAD']).trim();
    if (log.length === 0 || log[log.length - 1].sha !== head) {
      throw new Error('the fixture history was assembled wrong');
    }

    fs.mkdirSync(opts.out, { recursive: true });
    const bundle = path.join(opts.out, 'history.bundle');
    git(repo, ['bundle', 'create', bundle, '--all']);
    const config = path.join(opts.out, 'config.json');
    fs.writeFileSync(config, JSON.stringify(CONFIG, null, 2) + '\n', 'utf8');

    const ctx = { head: head, commits: log, localeStable: true, legacy: null };
    if (!opts.bundleOnly) {
      takeGolden({ tool: opts.tool, name: opts.name, out: opts.out, work: work,
        bundle: bundle, config: config }, ctx);
    }
    fs.writeFileSync(path.join(opts.out, 'README.md'), fixtureNote(ctx), 'utf8');
    writeManifest(opts.out, ctx);
    announce(bundle, ctx);
  } finally {
    if (opts.keep) console.log('  the temporary directory: ' + work);
    else fs.rmSync(work, { recursive: true, force: true });
  }
}

try {
  main();
} catch (e) {
  console.error('✗ ' + (e && e.message ? e.message : e));
  if (e && e.stderr) console.error(String(e.stderr).trim());
  process.exitCode = 1;
}

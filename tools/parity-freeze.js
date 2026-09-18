#!/usr/bin/env node
/* Takes the parity golden: how the frozen copy of the implementation (`fixtures/legacy/size-table.cjs`,
 * whose bytes lie in the history — `tools/harness.js`, `legacyTool`) counts numbers and builds the
 * artifact on the revision of the consumer project that the golden's manifest records.
 *
 * Why. "The port broke nothing" is a claim that needs proof. Three things are fixed for it: the whole
 * `--json` output (row and cell counts), the hash of the built artifact (the report's form) and the
 * hash of the tool itself (which revision produced this golden).
 *
 * Both sides of the pair are pinned. The tool is the built-in copy, so a re-take does not depend on
 * whether the project keeps a copy of its own. The revision comes from the manifest: the golden is
 * motionless — otherwise a re-take would follow someone else's project and there would be nothing to
 * compare against; moving the revision is a deliberate act (`--at`). The environment of the taking is
 * pinned the way the checks pin theirs (`core.quotePath=false`): the copy predates the pin the engine
 * sets for itself, and on a machine with default git settings the golden would silently lose a line.
 *
 * The artifact is not taken from the revision but built by the copy and compared with the one lying in
 * the revision: that is how the golden proves the report's form was taken by the same tool rather than
 * merely described beside it. The copy's check mode on its own artifact must be green — otherwise the
 * golden describes an inconsistent report.
 *
 * The project is opened read-only and only through a clone: nothing in the consumer is touched.
 *
 * Run (from the size-report repository root):
 *   node tools/parity-freeze.js [path-to-project] [--at <sha>] [--out <dir>]
 *
 * By default the project is the one recorded in the manifest and the directory is `fixtures/parity`.
 * Rewriting the golden is a deliberate act: nothing updates it silently.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LEGACY_PATH, MAX_BUF, flagArgs, gitConfig, legacyTool, runMain, sha256 } from './harness.js';
import { CONFIG_NAME } from '../src/config.js';
import { gitArgv, gitEnv } from '../src/git.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PROJECT = path.join(ROOT, '..', 'figma', 'safe-resets');
const DEFAULT_OUT = path.join(ROOT, 'fixtures', 'parity');

/* stderr is set explicitly although it is never read: without that `execFileSync` duplicates it
 * into our stderr, and git's own remark (`hint: Using 'master' …`) becomes the first line of our
 * refusal message while the cause stays invisible. */
/* The pinning is the same list the engine and the checks use: the golden is taken by one and the
 * same reading of git, whatever the machine. */
function git(dir, args) {
  return execFileSync('git', gitArgv(args),
    { cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv(), stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitBytes(dir, args) {
  return execFileSync('git', gitArgv(args),
    { cwd: dir, maxBuffer: MAX_BUF, env: gitEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
}

/* The copy runs in a pinned environment — the one the checks use (`tools/harness.js`,
 * `frozenTarget`): without it the golden is taken with other numbers. */
function legacy(dir, args) {
  const res = spawnSync(process.execPath, [legacyTool(), '--config', path.join(dir, CONFIG_NAME)].concat(args), {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: MAX_BUF,
    env: Object.assign({}, process.env, gitConfig({ 'core.quotePath': 'false' }))
  });
  if (res.status !== 0) {
    throw new Error('the copy did not run (' + (args.join(' ') || 'the check mode')
      + ', code ' + res.status + '): ' + (res.stderr || '').trim());
  }
  return res.stdout || '';
}

/* A description of the standard for a person: what lies beside it and what to do with it. Its text goes into
 * the fixture's own README, so it is the standard's data rather than this file's documentation and stays Russian
 * as the fixture holds it — `check:standards` compares `data.json`, `config.json` and `artifact.sha256` byte for
 * byte and deliberately leaves the description alone (it records the path the fixture was taken from). Re-taking
 * needs no arguments: the project and the revision are recorded in the manifest. */
function manifestNote(ctx) {
  return [
    '# Эталон паритета',
    '',
    'Снято с проекта-потребителя замороженной копией реализации скриптом',
    '`tools/parity-freeze.js`. Не правим руками: любое расхождение с этим эталоном —',
    'это либо найденная ошибка переноса, либо осознанное изменение формы отчёта, и',
    'тогда эталон переснимают.',
    '',
    '| Файл | Что внутри |',
    '|---|---|',
    '| `data.json` | Полный вывод `--json` замороженной копии на этой ревизии проекта |',
    '| `config.json` | Копия настроек проекта на той же ревизии |',
    '| `artifact.sha256` | Хеш собранного артефакта — форма отчёта доказывается побайтово |',
    '| `manifest.json` | sha коммита, число коммитов, хеши инструмента и эталонных файлов |',
    '',
    'Проект: `' + ctx.project.name + '`, HEAD `' + ctx.project.head.slice(0, 12) + '`',
    '(' + ctx.project.commits + ' коммитов, дата автора HEAD: ' + ctx.project.headDate + ').',
    'Инструмент: `' + ctx.tool.file + '`, sha256 `' + ctx.tool.sha256.slice(0, 12) + '`.',
    'Строк в эталоне: ' + ctx.data.rows + ', колонок: ' + ctx.data.columns
      + ', метрики: ' + ctx.data.metrics.join(', ') + '.',
    '',
    'Переснять: `node tools/parity-freeze.js`; сдвинуть ревизию — `--at <sha>`.'
  ].join('\n') + '\n';
}

/* What to take and where to: the directory, the project and the revision. By default the revision
 * and the project come from the manifest: the golden is motionless until someone deliberately
 * re-takes it. */
function plan() {
  const args = flagArgs(process.argv.slice(2));
  const out = path.resolve(args.flags['--out'] || DEFAULT_OUT);
  const manifestFile = path.join(out, 'manifest.json');
  const frozen = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
  const project = path.resolve(args.positional || (frozen ? frozen.project.path : DEFAULT_PROJECT));
  const want = args.flags['--at'] || (frozen ? frozen.project.head : null);
  if (!fs.existsSync(project)) {
    throw new Error('the project was not found: ' + project
      + '\n  name the path: node tools/parity-freeze.js <path-to-project>');
  }
  return { out: out, project: project, want: want };
}

/* The taking on a clone: the revision, the settings, the numbers, the artifact. The copy runs three
 * times — `--json`, `--write` and the check mode on its own artifact: the golden describes an agreed
 * report rather than a set of files lying beside each other. */
function take(work, project, want) {
  const clone = path.join(work, 'clone');
  git(work, ['clone', '-q', '--no-hardlinks', project, clone]);
  /* Shallow-ness is checked on the clone rather than on the source: the source may be a history
   * bundle (a file), which has no working tree of its own. */
  if (git(clone, ['rev-parse', '--is-shallow-repository']) === 'true') {
    throw new Error('the project history is truncated (shallow): the reference is taken from a full history only');
  }
  const at = want || git(clone, ['rev-parse', 'HEAD']);
  try {
    git(clone, ['checkout', '-q', at]);
  } catch (_e) {
    throw new Error('the project has no revision ' + at + ' — the reference is taken from one it holds');
  }
  const head = git(clone, ['rev-parse', 'HEAD']);
  const short = head.slice(0, 7);
  if (!fs.existsSync(path.join(clone, CONFIG_NAME))) {
    throw new Error('the revision ' + short + ' has no ' + CONFIG_NAME + ' — the reference would have nothing to describe');
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(clone, CONFIG_NAME), 'utf8'));
  const headDate = git(clone, ['log', '-1', '--date=format:%Y-%m-%d %H:%M', '--pretty=format:%ad', head]);
  const commits = Number(git(clone, ['rev-list', '--count', head]));
  const data = JSON.parse(legacy(clone, ['--json']));

  legacy(clone, ['--write']);
  const artifact = fs.readFileSync(path.join(clone, cfg.output));
  if (!artifact.equals(gitBytes(clone, ['show', head + ':' + cfg.output]))) {
    throw new Error('the copy built an artifact other than the one the revision ' + short + ' holds'
      + ' — the reference is not taken with this revision of the tool');
  }
  legacy(clone, []);
  return { head: head, headDate: headDate, commits: commits, cfg: cfg, data: data, artifact: artifact };
}

/* Writing the golden: the data, the settings, the artifact's hash, the manifest and the explanation
 * beside them. */
function store(out, project, taken) {
  const { head, headDate, commits, cfg, data, artifact } = taken;
  fs.mkdirSync(out, { recursive: true });
  const write = (name, bytes) => fs.writeFileSync(path.join(out, name), bytes);
  const dataBytes = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8');
  const configBytes = Buffer.from(JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  write('data.json', dataBytes);
  write('config.json', configBytes);
  write('artifact.sha256', sha256(artifact) + '  ' + cfg.output + '\n');

  const ctx = {
    schema: 1,
    kind: 'parity',
    project: { path: project, name: path.basename(project), head, headDate, commits },
    tool: { file: LEGACY_PATH, sha256: sha256(fs.readFileSync(legacyTool())) },
    artifact: { path: cfg.output, bytes: artifact.length, sha256: sha256(artifact) },
    data: {
      rows: data.rows.length,
      columns: data.columns.length,
      metrics: data.metrics,
      sha256: sha256(dataBytes)
    },
    config: { sha256: sha256(configBytes) }
  };
  write('manifest.json', Buffer.from(JSON.stringify(ctx, null, 2) + '\n', 'utf8'));
  write('README.md', Buffer.from(manifestNote(ctx), 'utf8'));

  console.log('✓ the parity reference: ' + path.relative(ROOT, out));
  console.log('  the project ' + ctx.project.name + ' at ' + head.slice(0, 7) + ': '
    + commits + ' commits, ' + data.rows.length + ' rows × ' + data.columns.length + ' columns');
  console.log('  the artifact ' + cfg.output + ': ' + artifact.length + ' B, sha256 '
    + ctx.artifact.sha256.slice(0, 12));
  console.log('  the tool ' + ctx.tool.file + ' sha256 ' + ctx.tool.sha256.slice(0, 12)
    + ' — the reference is tied to this revision');
}

function main() {
  const opts = plan();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-parity-'));
  try {
    store(opts.out, opts.project, take(work, opts.project, opts.want));
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

runMain(main, 1);

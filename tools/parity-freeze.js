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
import { LEGACY_PATH, MAX_BUF, gitConfig, legacyTool, sha256 } from './harness.js';
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
    throw new Error('копия не отработала (' + (args.join(' ') || 'контрольный режим')
      + ', код ' + res.status + '): ' + (res.stderr || '').trim());
  }
  return res.stdout || '';
}

/* Argument reading: a flag may own a value, so a positional argument is the one that is neither a
 * flag nor a flag's value. */
function parseArgs(args) {
  const out = { positional: null, flags: {} };
  for (let i = 0; i < args.length; i++) {
    if (args[i].indexOf('--') === 0) {
      const next = args[i + 1];
      if (next !== undefined && next.indexOf('--') !== 0) { out.flags[args[i]] = next; i++; }
      else out.flags[args[i]] = true;
      continue;
    }
    if (out.positional === null) out.positional = args[i];
  }
  return out;
}

/* Описание эталона для человека: что лежит рядом и что с этим делать. Пересъём не
 * требует аргументов — проект и ревизия записаны в манифесте. */
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
  const args = parseArgs(process.argv.slice(2));
  const out = path.resolve(args.flags['--out'] || DEFAULT_OUT);
  const manifestFile = path.join(out, 'manifest.json');
  const frozen = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
  const project = path.resolve(args.positional || (frozen ? frozen.project.path : DEFAULT_PROJECT));
  const want = args.flags['--at'] || (frozen ? frozen.project.head : null);
  if (!fs.existsSync(project)) {
    throw new Error('проект не найден: ' + project
      + '\n  укажите путь: node tools/parity-freeze.js <путь-к-проекту>');
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
    throw new Error('история проекта обрезана (shallow): эталон снимается только с полной истории');
  }
  const at = want || git(clone, ['rev-parse', 'HEAD']);
  try {
    git(clone, ['checkout', '-q', at]);
  } catch (_e) {
    throw new Error('в проекте нет ревизии ' + at + ' — эталон снимается только с той, что в нём есть');
  }
  const head = git(clone, ['rev-parse', 'HEAD']);
  const short = head.slice(0, 7);
  if (!fs.existsSync(path.join(clone, CONFIG_NAME))) {
    throw new Error('в ревизии ' + short + ' нет ' + CONFIG_NAME + ' — эталону нечего описывать');
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(clone, CONFIG_NAME), 'utf8'));
  const headDate = git(clone, ['log', '-1', '--date=format:%Y-%m-%d %H:%M', '--pretty=format:%ad', head]);
  const commits = Number(git(clone, ['rev-list', '--count', head]));
  const data = JSON.parse(legacy(clone, ['--json']));

  legacy(clone, ['--write']);
  const artifact = fs.readFileSync(path.join(clone, cfg.output));
  if (!artifact.equals(gitBytes(clone, ['show', head + ':' + cfg.output]))) {
    throw new Error('копия собрала не тот артефакт, что лежит в ревизии ' + short
      + ' — эталон снимается не этой ревизией инструмента');
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

  console.log('✓ эталон паритета: ' + path.relative(ROOT, out));
  console.log('  проект ' + ctx.project.name + ' на ' + head.slice(0, 7) + ': '
    + commits + ' коммитов, ' + data.rows.length + ' строк × ' + data.columns.length + ' колонок');
  console.log('  артефакт ' + cfg.output + ': ' + artifact.length + ' Б, sha256 '
    + ctx.artifact.sha256.slice(0, 12));
  console.log('  инструмент ' + ctx.tool.file + ' sha256 ' + ctx.tool.sha256.slice(0, 12)
    + ' — эталон привязан к этой ревизии');
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

try {
  main();
} catch (e) {
  console.error('✗ ' + (e && e.message ? e.message : e));
  process.exitCode = 1;
}

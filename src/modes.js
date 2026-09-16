import fs from 'fs';
import path from 'path';
import { EXIT } from './refusal.js';
import { loadConfig } from './config.js';
import { byteLen } from './strip.js';
import { build, skipLine } from './history.js';
import { reportData, rowShape } from './data.js';
import { coverage, coverageText } from './check.js';
import { explainCommit, explainText } from './explain.js';
import { doctor, doctorText } from './doctor.js';
import { hookRun, installHook, uninstallHook } from './hook.js';
import { artifact, rebuild } from './artifact.js';
import { sensorGaps } from './metrics.js';
import { totalsOf } from './derived.js';

/* Modes: what the tool does on request. The arguments are parsed in `src/args.js`, and a
 * ready plan arrives here — which mode, which flag, what to print. Their shared bits live
 * here too (the "!" note about a different count, the verdict, a size in words), one owner
 * for all modes, so that one count and one mark cannot diverge between `--write`, `--data`,
 * `check` and the rest. Knowing every other module at once is this file's job: it ties them
 * into one command.
 */

function kmb(bytes) {
  return Math.round(bytes / 1024) + ' KB';
}

/* Degradation is a fact of the report, not an error: the numbers came from a different
 * method (stripping instead of minification, an estimate instead of an exact count) because
 * an optional dependency is missing. The fact is printed once per sensor and becomes code
 * 4 — otherwise an approximation would travel into CI as success. */
function note(gaps) {
  gaps.forEach((gap) => console.error('! ' + gap.why + '\n  fix: ' + gap.fix));
  return gaps.length === 0 ? EXIT.OK : EXIT.SENSOR;
}

function sensorNote(cfg) {
  return note(sensorGaps(cfg));
}

/* The mode's verdict together with the sensor notes: the note is printed always — silence
 * about a different count reads as an exact number, and a disagreement would be left without
 * a cause — while the code stays the more important one. A violation outranks an
 * approximation (the same order as in `check` and `doctor`): code 4 claims the numbers are
 * honest but counted differently, and when the table disagrees nobody checked that — the
 * disagreement may be a real edit that went past the report. */
function verdict(code, gaps) {
  const sensors = note(gaps);
  return code === EXIT.OK ? sensors : code;
}

export function check(cfg, want, root) {
  const out = path.join(root, cfg.output);
  if (!fs.existsSync(out)) {
    console.error('✗ size table: no file ' + cfg.output + ' — build it: ' + cfg.fixCommand);
    return 1;
  }
  const have = fs.readFileSync(out, 'utf8');
  if (have === want) return 0;

  const a = have.split('\n');
  const b = want.split('\n');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  console.error('✗ size table: ' + cfg.output + ' diverged from the git history (line ' + (i + 1) + '):');
  console.error('    in the file:    ' + (a[i] === undefined ? '<no rows>' : a[i].trim().slice(0, 160)));
  console.error('    by the history: ' + (b[i] === undefined ? '<no rows>' : b[i].trim().slice(0, 160)));
  const missing = [...want.matchAll(/id="c-([^"]+)"/g)].map((m) => m[1])
    .filter((id) => have.indexOf('id="c-' + id + '"') === -1);
  if (missing.length > 0) {
    console.error('  rows missing in the file: ' + missing.length + ' (' + missing.slice(0, 5).join(', ')
      + (missing.length > 5 ? ', …' : '') + ')');
  }
  console.error('  fix: ' + cfg.fixCommand + ' — and commit ' + cfg.output + ' in a commit of its own.');
  return 1;
}

/* A path named on the command line (`--write <file>`) is this run's `output` setting: the
 * report has to name itself by the path it lies at, or the note inside it would point
 * somewhere else. */
function withOutput(cfg, root, file) {
  if (typeof file !== 'string') return cfg;
  return Object.assign({}, cfg, { output: path.relative(root, path.resolve(file)) });
}

export function writeMode(cfg, root, file) {
  const out = rebuild(withOutput(cfg, root, file), root);
  const { rows, files, now, skipped } = out.data;
  console.log('✓ ' + path.relative(root, out.file) + ': ' + rows.length + ' rows × ' + files.length + ' files, '
    + kmb(byteLen(out.html)) + ' (skipped without a row: ' + skipped.length + ' — '
    + skipped.join(', ') + ')');
  console.log('  state at HEAD: ' + files.map((f, i) => f.label + ' '
    + (now[i] === null ? '—' : cfg.metrics.map((m) => now[i][m]).join('/'))).join(', '));
  return sensorNote(cfg);
}

export function checkMode(cfg, root) {
  const out = artifact(cfg, root);
  const code = check(cfg, out.html, root);
  if (code === 0) {
    console.log('✓ report: ' + out.data.rows.length + ' commits × ' + out.data.files.length + ' files '
      + 'matches the history (' + cfg.output + ', ' + kmb(byteLen(out.html)) + ')');
  }
  return verdict(code, sensorGaps(cfg));
}

/* A command's answer: `--json` is the machine form of the same answer, not a second one.
 * Shared by three commands so that "who prints and in which shape" cannot diverge between
 * them — that can only diverge here, and the bytes of the answer are what an agent consumes.
 * The text comes as a function: the machine form does not need it at all. */
function answer(rep, asJson, text) {
  if (asJson) process.stdout.write(JSON.stringify(rep, null, 2) + '\n');
  else console.log(text(rep));
  return rep;
}

/* Coverage (`size check`): settings, history, paths, sensors. Not to be confused with
 * `checkMode` above, which asks whether the file matches what was computed; this one asks
 * whether **everything** was computed — no path of the history went past the columns.
 * Different questions, hence different commands: keeping the report in git is optional,
 * losing completeness is not — and this command is what replaces that check. */
export function coverageMode(cfg, root, configFile, asJson) {
  const rep = answer(coverage(cfg, root, configFile), asJson, coverageText);
  return verdict(rep.ok ? EXIT.OK : EXIT.VIOLATION, rep.sensors);
}

/* Diagnostics in one answer (`size doctor`): environment, dependencies, settings and
 * coverage, assembled from the same pieces as the other modes. The exit code is not
 * "something is wrong" but the first by importance (settings → history → coverage →
 * approximation): an agent branches on it, a human reads the text. */
export function doctorMode(root, configFile, asJson) {
  return answer(doctor(root, configFile), asJson, doctorText).exit;
}

/* The hook: installing, removing, and the call the hook itself makes. Installing and
 * removing happen by explicit command only; `hook-run` is called by the hook and always
 * answers 0 — the commit is already made and there is nothing to fail it for (design and
 * reasons: `src/hook.js`). What it did goes to stderr: it is part of git's output, not tool
 * data. */
export function hookMode(verb, root, configFile) {
  if (verb === 'hook-run') {
    const rep = hookRun(root, configFile);
    if (rep.note !== '') console.error(rep.note);
    return rep.code;
  }
  const rep = verb === 'install-hook' ? installHook(root, loadConfig(configFile, root)) : uninstallHook(root);
  rep.lines.forEach((line) => console.log(line));
  return rep.code;
}

/* Explaining a skipped row (`size explain <commit>`): any resolvable commit has an answer,
 * so the exit code is 0 both when the row is there and when it is not; 2 belongs to a commit
 * that cannot be resolved — an unknown name, an ambiguous prefix, or one outside the
 * history. */
export function explainMode(cfg, root, target, asJson) {
  answer(explainCommit(cfg, root, target), asJson, explainText);
  return EXIT.OK;
}

/* Contract data on stdout — for the page and for an agent: the same truth as in the
 * artifact, without markup and without derived numbers. The older `--json` form stays
 * untouched: the parity fixture freezes it (`fixtures/parity`). */
export function dataMode(cfg, root) {
  process.stdout.write(JSON.stringify(reportData(cfg, root), null, 2) + '\n');
  return sensorNote(cfg);
}

export function jsonMode(cfg, root) {
  const { rows, dropped } = build(cfg, root);
  process.stdout.write(JSON.stringify({
    columns: cfg.columns.map((c) => ({ label: c.label, paths: c.paths })),
    metrics: cfg.metrics,
    rows: rows.map((r) => Object.assign(rowShape(r),
      { cells: r.cells, totals: totalsOf(r.cells, cfg.metrics) })),
    skipped: dropped.map(skipLine)
  }, null, 2) + '\n');
  return sensorNote(cfg);
}

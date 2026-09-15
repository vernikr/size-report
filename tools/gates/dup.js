#!/usr/bin/env node
/* The duplication sensor: copy-paste (Type-1/2) and token twins (Type-3, `similarity`). The settings
 * live in `.jscpd.json`; here are the ratchet and the machine report.
 *
 * **The fingerprint is its own, taken from the content rather than jscpd's own.** A clone is
 * fingerprinted by a hash of its own text (fragment + lines + tokens): a moved file, shifted lines or
 * another checkout do not shift the fingerprint, while a new duplicate shows up at once. The baseline
 * file is the project's own as well — JSON with a schema, the config name and a note a person reads, and
 * `gatefiles` guards it — which is what a file of jscpd's own cannot be: that one carries a version and
 * fingerprints and nothing else, and no gate protects it. Measured, since the opposite once stood here:
 * a jscpd baseline keeps the same tree green in another directory, renames and shifted lines included,
 * and reddens on a genuinely new copy; what reports every clone as new is jscpd being handed the
 * project's own file (`missing field `version``).
 *
 * **The ratchet** is the baseline of fingerprints (`dup-baseline.json`): the clones living today sit in
 * the baseline and do not fail the gate, while a new one is named and does fail. The baseline is
 * updated by a person only (`pnpm run baseline:dup`) and is guarded by `gatefiles`: without the
 * `Gate-Change:` trailer it cannot pass.
 *
 * **Two looks, and the second matters more.** The first is against the baseline file (locally that is
 * the ratchet). The second is against the tree of `origin/main` unpacked into a temporary directory:
 * that tree's clones are counted from scratch, so editing the baseline inside the branch cannot hide a
 * new clone. The second look is skipped by `--no-ref` or when the ref is missing; a missing ref prints
 * a line, since a silent "green" must not read as a comparison.
 *
 * **A limit, named by a probe.** A copy of a stretch of code is caught only if that stretch parses:
 * jscpd compares pairs by parse tree and drops a file that does not parse, so half a function is
 * invisible to it. Code reaching a commit parses, hence this is no hole for the gate; but the sensor's
 * own probe has to copy a whole file, or it proves something other than what runs
 * (`test/gates-dup.test.js`).
 *
 * Run: `pnpm run dup` (the gate), `pnpm run dup:ci` (the same with the ref named explicitly),
 * `pnpm run baseline:dup` (baseline update). Exit codes: 0 — no new clones, 1 — there are some or the
 * run did not happen.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { REPORTS, ROOT, bad, git, indent, ok, parseArgs, pathsOf, readJson, rel, run, writeReport } from './common.js';

const BASELINE = 'dup-baseline.json';
const args = parseArgs(process.argv.slice(2), ['--paths', '--baseline', '--ref'], ['--update', '--no-ref']);
const paths = pathsOf(args);
const baselineName = args.flags['--baseline'] || BASELINE;
const baselineFile = path.isAbsolute(baselineName) ? baselineName : path.join(ROOT, baselineName);

/* A clone's fingerprint: content, not place. The hash is taken over the fragment text, the line count
 * and the token count, so two identical clones share one and merely similar ones differ. */
function fingerprint(clone) {
  const text = clone.fragment + '\n' + clone.lines + ':' + clone.tokens;
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

/* One run over a directory: jscpd hands out the whole list of clones, and the report is read from this
 * run's own directory, so that a file left from another run cannot stand in for the numbers. */
function scan(label, root, dirs) {
  const out = path.join(REPORTS, 'dup', label);
  fs.rmSync(out, { recursive: true, force: true });
  const list = dirs.map((d) => (path.isAbsolute(d) ? d : path.join(root, d)))
    .filter((d) => fs.existsSync(d));
  const res = run('pnpm', ['exec', 'jscpd', '--config', '.jscpd.json', '--output', rel(out)].concat(list));
  const reportFile = path.join(out, 'jscpd-report.json');
  if (!fs.existsSync(reportFile)) {
    return { failed: true, why: (res.stderr || res.stdout || 'нет отчёта').trim(), total: 0, clones: [], counts: {}, sample: {} };
  }
  const report = readJson(reportFile);
  const counts = {};
  const sample = {};
  report.duplicates.slice().forEach((d) => {
    const fp = fingerprint(d);
    counts[fp] = (counts[fp] || 0) + 1;
    if (sample[fp] === undefined) {
      sample[fp] = {
        first: shown(d.firstFile.name, root) + ':' + d.firstFile.start,
        second: shown(d.secondFile.name, root) + ':' + d.secondFile.start,
        lines: d.lines, tokens: d.tokens
      };
    }
  });
  return {
    failed: false, total: report.duplicates.length, counts: counts, sample: sample,
    lines: report.statistics.total.duplicatedLines
  };
}

/* A file name in the report carries no scan path: for the branch look that path is a temporary
 * directory, which is of no use to whoever reads the output. */
function shown(name, root) {
  const abs = path.resolve(root, name);
  return rel(abs);
}

/* New fingerprints: those absent from the baseline or grown in number. Counted by counters rather than
 * by presence: three identical clones where there was one are two new ones. */
function newer(baselineCounts, counts) {
  const list = [];
  Object.keys(counts).sort().forEach((fp) => {
    const extra = counts[fp] - (baselineCounts[fp] || 0);
    if (extra > 0) list.push({ fp: fp, extra: extra });
  });
  return list;
}

/* The branch look: the ref's tree is unpacked into a temporary directory (`git archive`) and scanned
 * with the same config, its clones being the only ones the report keeps. */
function refTree(ref, work) {
  const dir = path.join(work, 'ref');
  fs.mkdirSync(dir, { recursive: true });
  const archive = git(['archive', ref], { encoding: 'buffer' });
  if (archive.status !== 0) return null;
  const tar = run('tar', ['-x', '-C', dir], { input: archive.stdout });
  if (tar.status !== 0) return null;
  return dir;
}

const current = scan('current', ROOT, paths);
if (current.failed) {
  bad('dup: прогон не состоялся\n' + indent(current.why));
  process.exit();
}

if (args.flags['--update']) {
  fs.writeFileSync(baselineFile, JSON.stringify({
    schema: 1,
    config: '.jscpd.json',
    note: 'База дублей: отпечатки по содержимому клона (фрагмент + строки + токены),'
      + ' поэтому переезд файлов и выкладки её не сдвигает. Обновляется человеком.',
    fingerprints: current.counts
  }, null, 2) + '\n');
  ok('dup: база обновлена — ' + Object.keys(current.counts).length + ' отпечатков в '
    + baselineName + ' (клонов ' + current.total + ', строк ' + (current.lines || 0) + ')');
  console.log('  обновление базы — человеческое действие: приложите причину трейлером Gate-Change:');
  process.exit();
}

if (!fs.existsSync(baselineFile)) {
  bad('dup: базы нет (' + baselineName + ') — соберите её: pnpm run baseline:dup');
  process.exit();
}
const baseline = readJson(baselineFile).fingerprints || {};

const runs = [{
  against: 'файл базы',
  total: current.total,
  new: newer(baseline, current.counts).map((n) => Object.assign({ against: 'файл базы' }, sample(current, n)))
}];

/* The whole branch look: unpacking, the run over that tree, the verdict. A function of its own rather
 * than a branch inside a branch, since four levels of nesting is what this very sensor catches
 * (`max-depth`). */
function refLook(wantRef) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-dup-'));
  try {
    const dir = refTree(wantRef, work);
    if (dir === null) return 'dup: дерево ' + wantRef + ' не распаковалось — сравнение с базой ветки не выполнено';
    const ref = scan('ref', dir, paths);
    if (ref.failed) {
      bad('dup: прогон по дереву ' + wantRef + ' не состоялся\n' + indent(ref.why));
      return null;
    }
    const against = 'против ' + wantRef;
    runs.push({
      against: against,
      total: ref.total,
      new: newer(ref.counts, current.counts).map((n) => Object.assign({ against: against }, sample(current, n)))
    });
    return null;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const wantRef = args.flags['--ref'] || (args.flags['--no-ref'] ? null : 'origin/main');
let refNote = null;
if (wantRef !== null) {
  const has = git(['rev-parse', '--verify', '--quiet', wantRef + '^{commit}']);
  refNote = has.status === 0 ? refLook(wantRef)
    : 'dup: ' + wantRef + ' нет — сравнение с базой ветки не выполнено';
}

writeReport('dup.json', {
  schema: 1,
  config: '.jscpd.json',
  baseline: { file: baselineName, fingerprints: Object.keys(baseline).length },
  current: { clones: current.total, duplicatedLines: current.lines || 0 },
  runs: runs.map((r) => ({ against: r.against, total: r.total, new: r.new.length, clones: r.new }))
});

function sample(scanResult, entry) {
  return Object.assign({ fingerprint: entry.fp, extra: entry.extra }, scanResult.sample[entry.fp] || {});
}

const newClones = runs.reduce((sum, r) => sum + r.new.length, 0);
if (newClones > 0) {
  bad('dup: новых клонов ' + newClones + ' (в базе ' + Object.keys(baseline).length + ' отпечатков,'
    + ' в дереве ' + current.total + ')');
  runs.forEach((r) => r.new.slice(0, 10).forEach((c) => {
    console.error('    ' + (c.lines || '?') + ' строк, ' + (c.tokens || '?') + ' токенов: '
      + (c.first || '?') + ' ↔ ' + (c.second || '?') + '  [' + c.against + ']');
  }));
  console.error('    чинить код (вынести общее), а не базу');
} else {
  ok('dup: новых клонов нет (клонов ' + current.total + ', строк ' + (current.lines || 0)
    + ', в базе ' + Object.keys(baseline).length + ' отпечатков; взглядов ' + runs.length
    + ': ' + runs.map((r) => r.against).join(', ') + ')');
}
if (refNote !== null) console.log('  — ' + refNote);

#!/usr/bin/env node
/* Both fixtures reproduce: a re-take goes into a temporary directory and is compared with what is committed, so the working
 * tree stays clean.
 *
 * Why apart from `pnpm test`. The suite checks that the engine's package yields the same numbers as the fixture — that is,
 * it reads the fixture. Here the other direction is checked: that the fixture itself is taken anew by the same tools. A
 * fixture edited by hand, a broken taking and a dependence of the taking on the machine's settings are visible only this
 * way, and the first of those the suite never catches.
 *
 * The live history comes from a bundle (`fixtures/live/history.bundle`): the consumer's project is private, this check has
 * no key for it, and the bundle carries exactly the revision recorded in the fixture.
 *
 * Only what we write ourselves is compared byte by byte. The bundle is written by git, and its packaging depends on its
 * version, so the bundle is compared by content — branches, the tip and the number of commits, that is, what makes the
 * bundle a replacement for the project. The manifest is compared by fields for the same reason: it records the bundle's
 * hash. A byte-by-byte comparison would have been green on one version of git and red on another — which is exactly what
 * happened in CI.
 *
 * Run: `node tools/check-standards.js` or `pnpm run check:standards`.
 * Exit codes: 0 — everything matched, 1 — a difference.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MAX_BUF, PARITY, ROOT, SYNTH, firstDiff, gitIn, tempDir } from './harness.js';

const LIVE = path.join(ROOT, 'fixtures', 'live', 'history.bundle');
const BUNDLE = 'history.bundle';

/* The files we write ourselves: they have to match byte for byte. */
const FIXTURE_FILES = ['README.md', 'artifact.sha256', 'config.json', 'golden.json'];

/* The parity description records the path the fixture was taken from, while a re-take from the bundle has a path of its
 * own — a difference there is legitimate, which is why the description itself is not compared. */
const PARITY_FILES = ['data.json', 'config.json', 'artifact.sha256'];

let bad = 0;

function fail(text) {
  bad++;
  console.log(text);
}

function indent(text, limit) {
  const lines = String(text).trim().split('\n');
  const head = lines.slice(0, limit).map((line) => '      ' + line);
  if (lines.length > limit) head.push('      … всего строк: ' + lines.length);
  return head.join('\n');
}

/* A tool's refusal is printed in full rather than as its first line: the first line is sometimes git's own remark
 * (`hint: Using 'master' …`), and the real cause would stay invisible. */
function snapshot(what, args) {
  try {
    execFileSync(process.execPath, args,
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: MAX_BUF });
    return true;
  } catch (e) {
    fail('  ✗ ' + what + ':\n' + indent((e && e.stderr) || e.message, 12));
    return false;
  }
}

/* A difference names the line: "the JSON did not match" says nothing about the cause. */
function differ(name, made, committed) {
  const a = fs.readFileSync(path.join(made, name));
  const b = fs.readFileSync(path.join(committed, name));
  return (a.indexOf(0) < 0 && b.indexOf(0) < 0)
    ? firstDiff(a.toString('utf8'), b.toString('utf8'))
    : 'байты: ' + a.length + ' Б против ' + b.length + ' Б';
}

function compareFiles(names, made, committed) {
  let same = 0;
  names.forEach((name) => {
    const a = fs.readFileSync(path.join(made, name));
    if (a.equals(fs.readFileSync(path.join(committed, name)))) same++;
    else fail('  ✗ ' + name + ': пересъём не совпал с закоммиченным\n'
      + indent(differ(name, made, committed), 4));
  });
  return same;
}

/* The manifest is a record rather than a fixture: the bundle's hash in it depends on the version of git. The fields are
 * compared, except the record about the bundle itself. */
function compareManifest(made, committed) {
  const a = JSON.parse(fs.readFileSync(path.join(made, 'manifest.json'), 'utf8'));
  const b = JSON.parse(fs.readFileSync(path.join(committed, 'manifest.json'), 'utf8'));
  [a, b].forEach((m) => { if (m.files) delete m.files[BUNDLE]; });
  const keys = Object.keys(b).concat(Object.keys(a).filter((k) => !(k in b)));
  const diff = keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  diff.forEach((k) => fail('  ✗ manifest.json: поле ' + k + ' разошлось\n'
    + indent(firstDiff(JSON.stringify(a[k], null, 2), JSON.stringify(b[k], null, 2)), 4)));
  return diff.length === 0;
}

/* The bundle's content: packaging differs between versions of git while the history does not. The table of contents is read
 * from the file itself rather than from a clone: a clone guesses the branch from HEAD, and guesses differently on different
 * versions of git — a check built on a guess would be green on one machine and red on another. The clone here is proof that
 * the packaging reads, and nothing more: the number of commits is counted over everything reachable rather than over the
 * branch that was laid out. */
function bundleFacts(file) {
  const listed = gitIn(null, ['bundle', 'list-heads', file]).trim().split('\n');
  const heads = {};
  listed.filter((line) => line !== '').forEach((line) => {
    const at = line.indexOf(' ');
    heads[line.slice(at + 1)] = line.slice(0, at);
  });
  const dir = tempDir('bundle');
  try {
    gitIn(null, ['clone', '-q', '--no-hardlinks', file, dir]);
    heads['*'] = gitIn(dir, ['rev-list', '--count', '--all']).trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return heads;
}

function describeRefs(heads) {
  return Object.keys(heads).sort().map((ref) => (ref === '*' ? '' : ref + ' → ')
    + heads[ref].slice(0, 7)).filter((line) => line !== '').join(', ')
    + ', коммитов ' + heads['*'];
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-standards-'));
try {
  const synthetic = path.join(tmp, 'synthetic');
  if (snapshot('фикстура не снялась', ['tools/make-fixture.js', '--out', synthetic])) {
    const same = compareFiles(FIXTURE_FILES, synthetic, SYNTH);
    const manifestOk = compareManifest(synthetic, SYNTH);
    const made = bundleFacts(path.join(synthetic, BUNDLE));
    const kept = bundleFacts(path.join(SYNTH, BUNDLE));
    const bundleOk = JSON.stringify(made) === JSON.stringify(kept);
    if (!bundleOk) {
      fail('  ✗ ' + BUNDLE + ': пересъём несёт другую историю\n'
        + indent('снято сейчас: ' + describeRefs(made) + '\nзакоммичено: ' + describeRefs(kept), 4));
    }
    if (same === FIXTURE_FILES.length && manifestOk && bundleOk) {
      console.log('  ✓ фикстура: ' + same + ' из ' + FIXTURE_FILES.length
        + ' файлов побайтово, манифест по полям, бандл несёт ' + made['*'] + ' коммитов');
    }
  }

  const parity = path.join(tmp, 'parity');
  if (snapshot('эталон паритета не снялся', ['tools/parity-freeze.js', LIVE, '--out', parity])) {
    console.log('  ✓ паритет: снят из истории потребителя, '
      + compareFiles(PARITY_FILES, parity, PARITY) + ' из ' + PARITY_FILES.length
      + ' файлов совпали побайтово');
  }

  /* The bundle is a replacement for the project, and it has to be one without reservations: it declares both `HEAD` and the
   * branch `main`, both at the fixture's revision. Without `HEAD` a clone decides for itself which branch to lay out, and
   * different versions of git decide differently. */
  const frozen = JSON.parse(fs.readFileSync(path.join(PARITY, 'manifest.json'), 'utf8'));
  const live = bundleFacts(LIVE);
  if (live.HEAD !== frozen.project.head || live['refs/heads/main'] !== frozen.project.head
      || live['*'] !== String(frozen.project.commits)) {
    fail('  ✗ ' + BUNDLE + ' истории потребителя больше не заменяет проект:\n'
      + indent('сейчас: ' + describeRefs(live) + '\nожидалось: HEAD и refs/heads/main на '
        + frozen.project.head + ', коммитов ' + frozen.project.commits, 4));
  } else {
    console.log('  ✓ бандл истории: HEAD и ветка main на '
      + frozen.project.head.slice(0, 7) + ', ' + live['*'] + ' коммитов');
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (bad === 0) console.log('✓ эталоны воспроизводятся, рабочее дерево не тронуто');
else console.error('✗ расхождений: ' + bad);
process.exitCode = bad === 0 ? 0 : 1;

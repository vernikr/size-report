/* The guard on the boundary of git calls: the settings that change what is read have one place, and
 * that place is shared by the engine and the checks. The defect class is the one of B1, only found in
 * the harness rather than the engine: `git log --name-only` on a machine with default settings returns
 * non-English paths quoted, and a check reading git "as is" is green here and red there — a false net,
 * worse than none.
 *
 * Two checks close two halves: the first reads the sources and requires that no direct git call skips
 * the shared list of pins (that is the answer to "a new place cannot appear unpinned"), the second
 * shows the pins work — by witness rather than by hope in the settings of the machine it ran on.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, gitBare, gitConfig, gitIn, tempDir } from '../tools/harness.js';

const tmp = tempDir('git-pins');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// Directories with real code: the engine, the entry point, the tools, the checks.
const CODE = ['src', 'bin', 'tools', 'test'];

/* Two files where an unpinned call is a decision rather than an oversight: the boundary itself
 * (`tools/harness.js`, where `gitBare` lives) and the check measuring inherited settings
 * (`test/environment.test.js`), which the pins hinder just as much as they help everywhere else. The
 * list is kept by a human — a new file lands here deliberately. */
const BARE_ALLOWED = ['tools/harness.js', 'test/environment.test.js'];

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : jsFiles(full);
    return /\.js$/.test(entry.name) ? [full] : [];
  });
}

test('прямой вызов git идёт только через общий список закреплений', () => {
  // A process call: a helper name with git as the first argument — as a single word or as a whole
  // command line (`'git clone …'`).
  const CALL = /\b(?:execFileSync|execFile|spawnSync|spawn|execSync|exec)\s*\(\s*(['"])(git[^'"\n]*)\1([^\n]*)/g;
  const bad = [];
  CODE.forEach((part) => {
    jsFiles(path.join(ROOT, part)).forEach((file) => {
      const rel = path.relative(ROOT, file);
      if (BARE_ALLOWED.indexOf(rel) >= 0) return;
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        [...line.matchAll(CALL)].forEach((m) => {
          if (/gitArgv\(|gitBare\(/.test(m[3])) return;
          bad.push(rel + ':' + (i + 1) + ' — «' + m[2].slice(0, 40)
            + '» без общего списка закреплений: настройки унаследуются от машины');
        });
      });
    });
  });
  assert.deepEqual(bad, [],
    'git зовётся в обход общего списка закреплений:\n  ' + bad.join('\n  '));
});

/* The witness: unpinned reading quoted the path, the shared one does not. That way the check proves
 * its point both in an environment without machine settings and in an ordinary one. */
test('общее чтение git не зависит от того, какие настройки унаследованы', () => {
  const dir = path.join(tmp, 'repo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'заметки.md'), '# заметки\n');
  gitIn(dir, ['init', '-q']);
  gitIn(dir, ['config', 'user.email', 'test@example.com']);
  gitIn(dir, ['config', 'user.name', 'Тест']);
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'заметки']);

  const read = ['log', '--name-only', '--pretty=format:'];
  const pinned = gitIn(dir, read);
  assert.ok(pinned.indexOf('заметки.md') >= 0,
    'общее чтение закавычило не-английский путь: ' + JSON.stringify(pinned.trim()));

  // The same reading unpinned: with `core.quotePath=true`, as on a default machine, the path is escaped.
  const bare = gitBare(read, {
    cwd: dir,
    env: Object.assign({}, process.env, gitConfig({ 'core.quotePath': 'true' }))
  });
  assert.equal(bare.status, 0, 'свидетель не отработал: ' + (bare.stderr || '').trim());
  assert.ok(bare.stdout.indexOf('заметки.md') < 0,
    'незакреплённое чтение вернуло путь как есть: закрепление не доказывает ничего');
});

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { MAX_BUF } from '../harness.js';
import { gitArgv, gitEnv } from '../../src/git.js';

/* The fixture's deterministic repository: time, author and the git harness.
 *
 * **Time and identity are pinned** — or the commit shas would not be reproducible, and they are the
 * fixture's identity: both the golden numbers and the move checks rest on them. Time is counted from
 * the commit number (`tick`), so the order of `commit` calls is the order of dates as well:
 * reordering the history's steps would shift the numbers.
 *
 * **The git settings are pinned the way the engine and the checks have them**: the fixture is built
 * by the same git, and its bytes must not depend on the machine that built it. Hence
 * `core.autocrlf=false` at build time too: line endings are part of the fixture's content rather
 * than an auto-edit of the working tree.
 */

const BASE_MS = Date.UTC(2026, 0, 1, 7, 0, 0); // 2026-01-01 10:00:00 +03:00
const HOUR = 3600 * 1000;
let tick = 0;

export function stamp() {
  const d = new Date(BASE_MS + (tick++) * HOUR + 3 * HOUR); // the same zone as in the stamp
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + 'T'
    + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + '+03:00';
}

export const AUTHOR = {
  GIT_AUTHOR_NAME: 'size-report fixture',
  GIT_AUTHOR_EMAIL: 'fixture@size-report.invalid',
  GIT_COMMITTER_NAME: 'size-report fixture',
  GIT_COMMITTER_EMAIL: 'fixture@size-report.invalid'
};

export function git(dir, args, env) {
  return execFileSync('git', gitArgv(args), {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: MAX_BUF,
    env: Object.assign({}, gitEnv(), AUTHOR, env || {})
  });
}

/* Build settings: no signatures (they depend on the machine), no line-ending rewriting (line
 * endings are content). The list is part of the fixture's identity rather than a detail. */
export function initRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.name', AUTHOR.GIT_AUTHOR_NAME]);
  git(dir, ['config', 'user.email', AUTHOR.GIT_AUTHOR_EMAIL]);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'tag.gpgsign', 'false']);
  git(dir, ['config', 'core.autocrlf', 'false']);
  git(dir, ['config', 'core.safecrlf', 'false']);
}

export function commit(dir, subject) {
  git(dir, ['add', '-A']);
  const when = stamp();
  git(dir, ['commit', '-q', '--no-verify', '-m', subject],
    { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when });
}

/* The merge is driven up to an open edit (`--no-commit`), and that is the fixture checking itself:
 * had git merged on its own, the trap "a merge with a conflict resolution" would no longer exist
 * while the history would still converge. */
export function mergeConflicted(dir, branch) {
  const res = spawnSync('git', gitArgv(['merge', '--no-commit', '--no-ff', branch]), {
    cwd: dir, encoding: 'utf8', env: Object.assign({}, gitEnv(), AUTHOR)
  });
  if (res.status === 0) throw new Error('слияние в фикстуре прошло без конфликта');
}

export function write(dir, rel, text) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, 'utf8');
}

export function remove(dir, rel) {
  fs.rmSync(path.join(dir, rel));
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EXIT, Refusal, cliCommand, refuseCause } from './refusal.js';
import { installSpec } from './tool.js';
import { git, gitTry } from './git.js';
import { loadConfig } from './config.js';
import { TOOL_PKG } from './tool.js';
import { rebuild } from './artifact.js';

/* The `post-commit` and `post-merge` hooks: after every commit and merge the report rebuilds itself and, when it is tracked
 * by git, lands as a commit of its own.
 *
 * What it does, and why exactly so:
 *
 * - **It installs itself** — after the package is installed (`bin/postinstall.js`) and on the first run in a project
 *   (`autoInstall`, called from the entry point): a person needs neither a manual step nor a settings file, or he would
 *   never see the first rebuild at all. It installs where that is safe (an ordinary `.git/hooks`, no one else's hook,
 *   something to call the tool with, not CI) and stays silent where it is not. It is removed by an explicit command
 *   (`uninstall-hook`), which returns the project to its previous behaviour: both the installing and the removing live in
 *   one place of state (`git-dir`). The manual command (`install-hook`) stays as well: it names the cause when installing
 *   failed, while the silent path explains nothing.
 * - **It creates no commits of its own** — with one exception: a report tracked by git is committed separately from the
 *   code. A person used to do that (hence the trap of an edit of code and of the report in one commit), and the hook
 *   exists so that the manual step is gone. One rule for the two states of a project: the report in git is a commit of its
 *   own, the report outside git is a rebuild alone — a rebuild produces no commit.
 * - **It commits the report's path alone**: the tree comes from HEAD with exactly the report's path replaced in it, so
 *   nothing else can physically enter the commit — neither the index nor someone's uncommitted work.
 * - **A merge is the same case as an ordinary commit**, with one correction to what git calls: a merge does not run
 *   `post-commit` (git creates the merge commit itself), hence the second hook file, `post-merge`. The merge's row lands
 *   in the report by the usual rule (`rows.merges`), and the second file behaves like a repeated run: there is nothing to
 *   rebuild — there is no new commit.
 * - **A loop is impossible for two reasons.** The report's commit is assembled with plumbing (`commit-tree`), which calls
 *   no hooks at all — a nested run cannot happen by construction rather than by a flag in the environment. And the report
 *   itself is a path that gets no row (the invariant "a row about a commit cannot lie inside that commit"), so the same
 *   rebuild yields the same bytes and there will be no second commit. A lock is there besides, so that two hooks do not
 *   run at once.
 * - **A refusal by the tool does not bring the commit down.** The commit has been made already and there is nothing to
 *   block in it — the tool only shows. The cause is printed as one line and remembered: `size doctor` shows it
 *   (`src/doctor.js`).
 * - **In environments where the report needs no updating** (integration, someone else's machine, no dependencies) the hook
 *   stays silent: the hook file itself does not travel in git — it lies in `.git`, so every clone has one of its own —
 *   while the body checks whether there is anything to call the tool with.
 *
 * The state lives in the git directory (`<git-dir>/size-report/`) rather than in the working tree: otherwise the lock and
 * the record of a run would stand out in `git status` as untracked files. The state is local to a clone, as the hook
 * itself is. */

// The second switch: an environment where auto-updating is not wanted at all (CI, someone else's machine) — and an explicit
// lever for those who would rather not edit the settings.
const NO_HOOK = 'SIZE_REPORT_NO_HOOK';
/* Two files rather than one: git calls `post-commit` for an ordinary commit, while a merge only runs `post-merge`
 * (`post-commit` is not run for `git merge` at all — checked on git 2.50 in `test/hook.test.js`). Both share one entry
 * point, so a spare run does not happen: whichever fires second sees there is nothing to change and stays silent. */
const HOOKS = ['post-commit', 'post-merge'];
// The mark "this file is ours": the hook differs by it from someone else's, which must not be overwritten, and the removal
// reads it to know what to delete.
const MARK = '# size-report: hook';
const STATE = 'hook.json';
const LOCK = 'hook.lock';

function gitDir(root) {
  return git(root, ['rev-parse', '--absolute-git-dir']).trim();
}

function stateDir(root) {
  return path.join(gitDir(root), 'size-report');
}

/* Where git reads hooks from. `core.hooksPath` overrides `.git/hooks`, and that is someone else's setting: such a
 * directory often lies in another repository and is versioned, while inserting a line into someone else's script means
 * editing someone else's file. Hence with a custom path the install refuses and names a ready line. */
function hooksDir(root) {
  const custom = gitTry(root, ['config', '--get', 'core.hooksPath']);
  if (custom.status === 0 && custom.stdout.trim() !== '') {
    return { dir: path.resolve(root, custom.stdout.trim()), custom: true };
  }
  return { dir: path.join(gitDir(root), 'hooks'), custom: false };
}

function hookFile(root, name) {
  return path.join(hooksDir(root).dir, name);
}

/* The engine the hook calls the tool with — the one the install itself would have found. The path is written into the
 * script at install time: in a monorepo `node_modules` may lie above the project root, where a common relative path does
 * not work. The path is quoted: it may hold a space, and a hook is sh rather than a list of arguments. */
function hookEntry(root) {
  const candidates = [
    path.join(root, 'node_modules', TOOL_PKG.name, 'bin', 'size.js'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'size.js')
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found === undefined) return null;
  const rel = path.relative(root, found);
  const shown = rel !== '' && rel.indexOf('..') !== 0 ? './' + rel : found;
  return { path: shown, quoted: shQuote(shown) };
}

function shQuote(text) {
  return '"' + text.replace(/(["\\$`])/g, '\\$1') + '"';
}

// A ready line for someone else's hook: it is copied as it stands, which is why it carries no mark.
function runLine(entry) {
  return 'node ' + entry.path + ' hook-run';
}

/* The hook's body. The checks before the run are the answer to "what it does NOT do where there is nothing to update":
 * without `node` (a git GUI client with a trimmed PATH) and without the engine (dependencies not installed, a clone
 * without an install) the hook exits silently — noise after every commit would be worse than no automation. */
function script(entry) {
  return '#!/bin/sh\n'
    + MARK + ': the report is refreshed after a commit.\n'
    + '# Installed and removed by the commands `size install-hook` / `size uninstall-hook`;\n'
    + '# edits in this file do not survive — the command overwrites it whole.\n'
    + '# The hook makes no commits of its own: the rebuild and the commit of the report are in `size hook-run`.\n'
    + 'command -v node >/dev/null 2>&1 || exit 0\n'
    + '[ -f ' + entry.quoted + ' ] || exit 0\n'
    + 'exec node ' + entry.quoted + ' hook-run\n';
}

/* The hook's state for `size doctor`: whether it is installed and how its last run ended. It counts nothing and commits
 * to nothing. */
export function hookStatus(root) {
  const files = HOOKS.map((name) => hookFile(root, name));
  return {
    files: files.map((f) => path.relative(root, f)),
    installed: files.some((f) => fs.existsSync(f)),
    last: hookState(root)
  };
}

function isOurs(file) {
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').indexOf(MARK) >= 0;
}

/* The record of the last run. A missing file means "the hook has not run yet" rather than an error: before a first commit
 * there is nothing to record. */
function hookState(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(stateDir(root), STATE), 'utf8'));
  } catch (_e) {
    return null;
  }
}

export function installHook(root, cfg) {
  const entry = hookEntry(root);
  if (entry === null) {
    // The advice names the very installation the README teaches — the git link pinned to this release, so that the advice
    // cannot drift from the release the documentation describes.
    const spec = installSpec();
    refuseCause('no way to invoke the tool', 'nothing to call the tool with: without it the hook would stay silent'
      + ' after every commit.\n'
      + '  fix: install the package as a dependency of the project'
      + (spec === null ? '' : ' (the way it is installed in this project: pnpm add -D ' + spec + ')')
      + ' and repeat the installation');
  }
  const hooks = hooksDir(root);
  if (hooks.custom) {
    refuseCause('foreign core.hooksPath', 'the project sets core.hooksPath (' + hooks.dir + '): that directory may lie'
      + ' in another repository, and the tool will not edit it.\n'
      + '  fix: write the line "' + runLine(entry) + '" into your own hook');
  }
  const files = HOOKS.map((name) => path.join(hooks.dir, name));
  const rels = files.map((f) => path.relative(root, f));
  files.forEach((file, i) => {
    if (fs.existsSync(file) && !isOurs(file)) {
      refuseCause('foreign hook', 'the hook ' + rels[i] + ' is already there and was not put there by this tool (it carries no mark).\n'
        + '  fix: call the tool from your own hook with the line "' + runLine(entry) + '"'
        + ' — the tool deliberately does not rewrite what it did not write');
    }
  });
  if (files.every(isOurs)) {
    return { code: EXIT.OK, lines: [
      '· the hook is already installed: ' + rels.join(', '),
      '  the automation works after every commit and merge',
      '  to switch it off without removing it: "hooks": {"enabled": false} in the settings file',
      '  to remove it: ' + cliCommand('uninstall-hook')
    ] };
  }
  fs.mkdirSync(hooks.dir, { recursive: true });
  files.forEach((file) => {
    fs.writeFileSync(file, script(entry));
    fs.chmodSync(file, 0o755);
  });

  const lines = [
    '✓ hook: ' + rels.join(', '),
    '  after every commit and merge it rebuilds ' + cfg.output
      + ' and, if that file is in git, lands it as a commit of its own',
    '  it commits nothing but the report: the index and your uncommitted work are untouched',
    '  to switch it off without removing it: "hooks": {"enabled": false} in the settings file',
    '  to remove it: ' + cliCommand('uninstall-hook')
  ];
  if (cfg.hooks.enabled === false) {
    lines.push('! the automation is switched off by the hooks.enabled setting right now — the hook will stay silent');
  }
  return { code: EXIT.OK, lines: lines };
}

/* Installing without being asked. It answers with the list of paths when it installed and with `null` when it touched
 * nothing — the second answer is the norm rather than an error: this service is a background one, and where it does not
 * belong it simply is not there. Hence everything that prevents installing is settled by silence rather than by a refusal:
 * a refusal of background work after every run would be noise, while the cause is already named by the exact command
 * (`install-hook`).
 *
 * Someone else's `core.hooksPath` belongs here too: that directory is versioned and often lies in another repository —
 * writing a line into someone else's file on one's own initiative is not for the tool, and the person takes the line from
 * `install-hook` (ready and without a mark). */
export function autoInstall(root, cfg) {
  if (process.env.CI || process.env[NO_HOOK]) return null;
  if (cfg !== null && cfg.hooks.enabled === false) return null;
  try {
    const hooks = hooksDir(root);
    const entry = hookEntry(root);
    if (hooks.custom || entry === null) return null;
    const files = HOOKS.map((name) => path.join(hooks.dir, name));
    if (files.some((f) => fs.existsSync(f) && !isOurs(f))) return null;
    if (files.every(isOurs)) return null;
    fs.mkdirSync(hooks.dir, { recursive: true });
    files.forEach((file) => {
      fs.writeFileSync(file, script(entry));
      fs.chmodSync(file, 0o755);
    });
    return files.map((f) => path.relative(root, f));
  } catch (_e) {
    /* Not a git repository, no rights on `.git`, a foreign format — all of it means one thing: there will be no automation
     * here, while the tool's work does not depend on it. */
    return null;
  }
}

/* Removing takes away only what we installed. A file is not "like ours" but carries the mark, or someone else's hook would
 * be wiped in silence. */
export function uninstallHook(root) {
  const files = HOOKS.map((name) => hookFile(root, name));
  const rels = files.map((f) => path.relative(root, f));
  const present = files.filter((f) => fs.existsSync(f));
  if (present.length === 0) {
    return { code: EXIT.OK, lines: ['· the hook is not installed: ' + rels.join(', ')] };
  }
  present.forEach((file) => {
    if (!isOurs(file)) {
      refuseCause('foreign hook', 'the hook ' + path.relative(root, file) + ' was not put there by this tool — I leave it alone.\n'
        + '  fix: take the line with "hook-run" out of it, if it is there');
    }
  });
  present.forEach((file) => fs.rmSync(file));
  fs.rmSync(stateDir(root), { recursive: true, force: true });
  return { code: EXIT.OK, lines: ['✓ hook removed: ' + rels.join(', ') + ' (the project behaves as it did before the install)'] };
}

/* The lock: two hooks at once (a commit from two terminals, say) must not rebuild one file. A lock with a live owner means
 * "already running"; a lock left by a killed process is taken over — otherwise a run interrupted once would forbid the hook
 * forever. */
function acquire(root) {
  const file = path.join(stateDir(root), LOCK);
  fs.mkdirSync(stateDir(root), { recursive: true });
  const take = () => {
    fs.writeFileSync(file, String(process.pid) + '\n', { flag: 'wx' });
    return { ok: true, file: file, release: () => fs.rmSync(file, { force: true }) };
  };
  try {
    return take();
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  let owner = null;
  try {
    owner = Number(fs.readFileSync(file, 'utf8').trim());
  } catch (_e) {
    owner = null;
  }
  if (owner !== null && owner > 0 && alive(owner)) return { ok: false, file: file };
  fs.rmSync(file, { force: true });
  return take();
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (_e) {
    return false;
  }
}

/* The record of a run for `size doctor`. Its failure (no rights, no directory) must not become noise after a commit: the
 * record is not what a hook is run for. */
function record(root, fields, note) {
  const state = Object.assign({ schema: 1, at: new Date().toISOString() }, fields);
  try {
    fs.mkdirSync(stateDir(root), { recursive: true });
    fs.writeFileSync(path.join(stateDir(root), STATE), JSON.stringify(state, null, 2) + '\n');
  } catch (_e) {
    // See above: the record is not the goal of the run.
  }
  return { code: EXIT.OK, note: note === undefined ? '' : note };
}

/* The report's commit is assembled with plumbing rather than `git commit --only`: `--only` refuses during a merge ("cannot
 * do a partial commit during a merge" — MERGE_HEAD is alive while the `post-merge` hook runs), while a fork of "the
 * ordinary case this way, a merge that way" would leave one of the two paths almost untested. The tree comes from HEAD with
 * exactly the report's path replaced in it, so neither the index nor someone else's edit can enter the commit, and
 * `commit-tree` calls no hooks — a nested run cannot happen by construction. No signature is asked for the commit: a
 * machine's setting must not stop a commit. The index used here is a temporary one: the real index is touched once, and
 * only with the report's own entry, or the tree would be left dirty after the commit. */
function commitReport(root, job) {
  const { rel, file, message, branch, head } = job;
  const fail = (why) => ({ ok: false, why: why });
  const blob = gitTry(root, ['hash-object', '-w', '--', file]);
  if (blob.status !== 0) return fail('git hash-object: ' + blob.stderr.trim());
  const listed = gitTry(root, ['ls-files', '-s', '--', rel]);
  const mode = listed.stdout.trim().split(' ')[0] || '100644';
  const indexFile = path.join(stateDir(root), 'commit-index');
  const env = { GIT_INDEX_FILE: indexFile };
  const entry = [mode, blob.stdout.trim(), rel].join(',');
  fs.rmSync(indexFile, { force: true });
  try {
    const read = gitTry(root, ['read-tree', head], env);
    if (read.status !== 0) return fail('git read-tree: ' + read.stderr.trim());
    const put = gitTry(root, ['update-index', '--add', '--cacheinfo', entry], env);
    if (put.status !== 0) return fail('git update-index: ' + put.stderr.trim());
    const tree = gitTry(root, ['write-tree'], env);
    if (tree.status !== 0) return fail('git write-tree: ' + tree.stderr.trim());
    const made = gitTry(root, ['commit-tree', tree.stdout.trim(), '-p', head, '-m', message]);
    if (made.status !== 0) return fail('git commit-tree: ' + made.stderr.trim());
    const moved = gitTry(root, ['update-ref', '-m', message, branch, made.stdout.trim(), head]);
    if (moved.status !== 0) return fail('git update-ref: ' + moved.stderr.trim());
    const synced = gitTry(root, ['update-index', '--add', '--cacheinfo', entry]);
    if (synced.status !== 0) return fail('git update-index: ' + synced.stderr.trim());
    return { ok: true, sha: made.stdout.trim().slice(0, 7) };
  } finally {
    fs.rmSync(indexFile, { force: true });
  }
}

export function hookRun(root, configFile) {
  if (process.env.CI || process.env[NO_HOOK]) {
    return record(root, {
      result: 'skipped',
      why: 'an environment without auto-updating (' + (process.env.CI ? 'CI' : NO_HOOK) + ')'
    });
  }
  const head = gitTry(root, ['rev-parse', 'HEAD']);
  const sha = head.status === 0 ? head.stdout.trim() : null;
  const lock = acquire(root);
  if (!lock.ok) {
    return record(root, {
      result: 'skipped',
      head: sha,
      why: 'a rebuild is already running (lock ' + path.relative(root, lock.file) + ')'
    });
  }
  try {
    return runLocked(root, configFile, sha);
  } finally {
    lock.release();
  }
}

function runLocked(root, configFile, sha) {
  let cfg;
  try {
    cfg = loadConfig(configFile, root);
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    return record(root, { result: 'skipped', head: sha, why: 'the settings cannot be read: ' + e.message });
  }
  if (cfg.hooks.enabled === false) {
    return record(root, { result: 'skipped', head: sha, report: cfg.output, why: 'switched off by the hooks.enabled setting' });
  }
  /* A detached HEAD means rebase, cherry-pick and bisect: committing into such a state is not allowed (the record would
   * land on no branch), and nobody is there to rebuild the report from an intermediate state. It does not hinder a merge:
   * `post-merge` comes once the merge commit has been created. */
  const branch = gitTry(root, ['symbolic-ref', '-q', 'HEAD']).stdout.trim();
  if (branch === '') {
    return record(root, { result: 'skipped', head: sha, report: cfg.output, why: 'detached HEAD (rebase, cherry-pick, bisect)' });
  }

  let out;
  try {
    out = rebuild(cfg, root);
  } catch (e) {
    /* A refusal by the tool (no history, an unparsed file, no settings) is not a refusal by the hook: the commit has been
     * made, and there is nothing and no reason to bring it down. The cause goes to `size doctor`, while one line is enough
     * for a person. An unexpected error is a defect of the tool and its stack is printed: otherwise there is nothing to
     * investigate it with. */
    if (e instanceof Refusal) {
      return record(root, { result: 'refused', head: sha, report: cfg.output, why: e.message }, '✗ size-report: ' + e.message.split('\n')[0]);
    }
    return record(root, { result: 'failed', head: sha, report: cfg.output, why: String(e.message) },
      '✗ size-report: internal error: ' + e.stack);
  }

  return storeReport(root, cfg, branch, sha, out.file);
}

/* Storing the report after a rebuild: not tracked — say so in words, unchanged — do nothing, changed — commit it. */
function storeReport(root, cfg, branch, head, file) {
  const rel = path.relative(root, file);
  if (gitTry(root, ['ls-files', '--error-unmatch', '--', rel]).status !== 0) {
    return record(root, {
      result: 'rebuilt',
      head: head,
      report: cfg.output,
      why: 'the report is not tracked by git: rebuilt, no commit'
    });
  }
  const diff = gitTry(root, ['diff', '--quiet', 'HEAD', '--', rel]);
  if (diff.status === 0) {
    return record(root, { result: 'unchanged', head: head, report: cfg.output });
  }
  if (diff.status !== 1) {
    return record(root, { result: 'failed', head: head, report: cfg.output, why: 'git diff: ' + diff.stderr.trim() },
      '✗ size-report: git diff -- ' + rel + ': ' + diff.stderr.trim());
  }

  const message = 'chore(report): report rebuilt after ' + head.slice(0, 7);
  const commit = commitReport(root, { rel: rel, file: file, message: message, branch: branch, head: head });
  if (!commit.ok) {
    return record(root, { result: 'refused', head: head, report: cfg.output, why: commit.why },
      '✗ size-report: the report commit did not go through: ' + commit.why);
  }
  return record(root, { result: 'committed', head: head, report: cfg.output, commit: commit.sha },
    '✓ size-report: ' + cfg.output + ' rebuilt and committed (' + commit.sha + ')');
}

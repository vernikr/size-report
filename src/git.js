import { execFileSync, spawnSync } from 'child_process';
import { EXIT, refuse } from './refusal.js';

/* The single boundary of git calls: pinned settings, blobs in batches, the history, and the
 * comparison against the disk. Everything the tool knows about the repository's content comes
 * from here — which is why the pins are set here rather than in every call. */

export const MAX_BUF = 256 * 1024 * 1024;
const FIELD = '\u0001'; // field separator of the `git log` format

/* Everything the engine reads from git is read with explicitly pinned settings: their defaults
 * come from the machine and change what ends up in the parse. Without `core.quotePath=false`
 * non-English paths arrive quoted and escaped (`"docs/\320\267..."`): a column holding such a
 * path finds no file, and a commit whose only change of volume it was loses its row. The other
 * pins close the same class of defect — colouring and a signature block would mix into the parsed
 * stream, and signature re-encoding into the row labels of the report. A pin is set here rather
 * than in every call, or the next call would forget it.
 *
 * The locale is pinned along with them: the parse must not depend on which translations the
 * machine has. The price is that git's own messages in unexpected refusals come out in English,
 * while the tool's own messages stay as they are. */
export const GIT_PINS = [
  'core.quotePath=false',
  'color.ui=never',
  'log.showSignature=false',
  'i18n.logOutputEncoding=UTF-8'
];

export function gitArgv(args) {
  const out = ['--no-pager'];
  GIT_PINS.forEach((pin) => { out.push('-c', pin); });
  return out.concat(args);
}

export function gitEnv() {
  return Object.assign({}, process.env, { LC_ALL: 'C', LANG: 'C' });
}

export function git(root, args) {
  return execFileSync('git', gitArgv(args), {
    cwd: root, encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv()
  });
}

/* The same read, but with the exit code: where a non-zero code is an expected answer rather than
 * a refusal (`git diff --quiet` answers 1 on a difference), an exception would mean the tool
 * refusing where a simple question was asked. `env` is added on top of the boundary's
 * environment — the hook builds the report commit in a separate index with it, leaving the real
 * one untouched (`src/hook.js`). */
export function gitTry(root, args, env) {
  const res = spawnSync('git', gitArgv(args), {
    cwd: root, encoding: 'utf8', maxBuffer: MAX_BUF,
    env: Object.assign(gitEnv(), env || {})
  });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/* Reading blobs in batches. `git cat-file --batch-check` answers about a list of `revision:path`
 * pairs (the object sha and its size), `--batch` returns the content. One or two processes for
 * the whole history instead of spawning `git show` per file: across thousands of commits that is
 * the difference between minutes and a second. As a side effect the object size turns out cheaper
 * than reading the object — the `raw` metric needs no content at all.
 *
 * The answers are positional (one line per request), so requests and answers are matched by
 * order: git does not repeat the `revision:path` in an answer. */
const BLOB_CHUNK = 1000; // specs per batch: it bounds both stdin and memory

function catFileCheck(root, specs) {
  const out = execFileSync('git', gitArgv(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)']), {
    cwd: root, encoding: 'utf8', input: specs.join('\n') + '\n', maxBuffer: MAX_BUF, env: gitEnv()
  });
  return out.split('\n');
}

function catFileBatch(root, shas) {
  const buf = execFileSync('git', gitArgv(['cat-file', '--batch']), {
    cwd: root, input: shas.join('\n') + '\n', maxBuffer: MAX_BUF, env: gitEnv()
  });
  const out = new Map();
  let i = 0;
  while (i < buf.length) {
    const nl = buf.indexOf(10, i);
    if (nl < 0) break;
    const f = buf.toString('utf8', i, nl).split(' ');
    i = nl + 1;
    if (f.length < 3) continue; // "<spec> missing"
    const size = Number(f[2]);
    out.set(f[0], { size: size, text: buf.toString('utf8', i, i + size) });
    i += size + 1; // the newline that follows the content
  }
  return out;
}

/* Blobs for a list of `revision:path` pairs. `needText` decides whether the content is read: the
 * `raw` metric lives happily with the object size alone, and then `--batch` is not called at all.
 * Identical specs and identical blobs are requested once (the cache is keyed by sha). */
export function readBlobs(root, specs, needText) {
  const uniq = [...new Set(specs)];
  const out = new Map();
  const texts = new Map(); // blob sha → content
  for (let start = 0; start < uniq.length; start += BLOB_CHUNK) {
    const part = uniq.slice(start, start + BLOB_CHUNK);
    const lines = catFileCheck(root, part);
    const want = [];
    part.forEach((spec, i) => {
      const line = lines[i] === undefined ? '' : lines[i];
      if (line === '' || line.slice(-8) === ' missing') return;
      const f = line.split(' ');
      if (f.length < 3 || f[1] !== 'blob') return;
      out.set(spec, { sha: f[0], size: Number(f[2]), text: null });
      if (texts.has(f[0])) return;
      want.push(f[0]);
    });
    if (!needText || want.length === 0) continue;
    catFileBatch(root, [...new Set(want)]).forEach((b, sha) => { texts.set(sha, b.text); });
  }
  if (needText) out.forEach((b) => { if (texts.has(b.sha)) b.text = texts.get(b.sha); });
  return out;
}

/* The HEAD tree: the blob shas of every file of the commit. This is the truth about the content
 * of HEAD obtained by another route than the engine's state (which reads blobs in batches), so a
 * disagreement with it means an edit lost while the state was carried forward. One call per run;
 * the output is split by NUL (`-z`), or paths with spaces would have to be unquoted. */
export function headTree(root) {
  const out = new Map();
  const tree = execFileSync('git', gitArgv(['ls-tree', '-r', '-z', 'HEAD']), {
    cwd: root, encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv()
  });
  tree.split('\u0000').forEach((rec) => {
    const tab = rec.indexOf('\t');
    if (tab < 0) return;
    out.set(rec.slice(tab + 1), rec.slice(0, tab).split(' ')[2]);
  });
  return out;
}

/* The files on disk as git sees them: `hash-object` runs each file through the same line-ending
 * conversions and filters as `git add` (`.gitattributes`, `core.autocrlf`). So "the file on disk
 * matches the commit" is a comparison of hashes rather than of sizes — a size depends on the
 * checkout (`core.autocrlf=true` gives CRLF on disk and LF inside git). Paths come as a list and
 * the answers are positional, as with `cat-file`. */
export function diskHashes(root, paths) {
  const out = new Map();
  const lines = execFileSync('git', gitArgv(['hash-object', '--stdin-paths']), {
    cwd: root, encoding: 'utf8', input: paths.join('\n') + '\n', maxBuffer: MAX_BUF, env: gitEnv()
  }).split('\n');
  paths.forEach((p, i) => { out.set(p, lines[i] === undefined ? '' : lines[i].trim()); });
  return out;
}

/* The reverse conversion: what git would write to disk for a blob of this revision and path
 * (`--filters` applies the checkout filters). Needed where git does not undo its line endings: a
 * file whose CRLF sits in the commit itself is written out as it is under `core.autocrlf=true`,
 * while "cleaning" would turn it back into LF — git warns about such files and puts exactly this
 * on disk. */
export function diskForm(root, rev, p) {
  return execFileSync('git', gitArgv(['cat-file', '--filters', rev + ':' + p]), {
    cwd: root, maxBuffer: MAX_BUF, env: gitEnv()
  });
}

// The content of a file in a revision, or null when the file is not there.
export function blobAt(root, rev, p) {
  const blobs = readBlobs(root, [rev + ':' + p], true);
  const blob = blobs.get(rev + ':' + p);
  return blob === undefined ? null : blob.text;
}

/* A revision name → the commit sha: `HEAD`, a branch, a tag, `HEAD~1`, a short or a full sha. The
 * rules of names stay with git instead of being rewritten here: our own would part ways with it on
 * the first `main~2` or `HEAD@{1}`, while `^{commit}` cuts off names that lead somewhere other
 * than a commit (a tag on a blob, a path in the tree). A name starting with a dash never reaches
 * git: in `rev-parse` it would be a flag rather than a revision.
 * Unresolved gives `null`: "no such name" and "the name is ambiguous" are told apart by the
 * caller, which has the commit list for that. */
export function resolveCommit(root, name) {
  if (name === '' || name.charAt(0) === '-') return null;
  const res = gitTry(root, ['rev-parse', '--verify', '--quiet', name + '^{commit}']);
  const sha = res.stdout.trim();
  return res.status === 0 && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

/* The history in one call: the commit header and the list of paths it changed. `%ad` is the
 * author's date in the author's own zone rather than the machine's, or the table would be built in
 * UTC in CI and disagree with a local build. `--diff-merges=first-parent` is there because a merge
 * commit otherwise has no path list at all (git shows a merge diff only on request): edits made
 * while resolving a conflict would drop out of both the row and the carried state, and the state
 * at HEAD would disagree with the file content in the tree. Against the first parent a merge shows
 * exactly what it brought on top of its branch. */
export function readHistory(root) {
  const log = git(root, [
    'log', '--reverse', '--name-only', '--diff-merges=first-parent', '--date=format:%Y-%m-%d %H:%M',
    '--pretty=format:commit' + FIELD + '%H' + FIELD + '%ad' + FIELD + '%P' + FIELD + '%s'
  ]);
  const commits = [];
  let cur = null;
  log.split('\n').forEach((line) => {
    if (line.indexOf('commit' + FIELD) === 0) {
      const f = line.split(FIELD);
      cur = { sha: f[1], when: f[2], parents: f[3] ? f[3].split(' ') : [], subject: f[4], files: [] };
      commits.push(cur);
      return;
    }
    if (line !== '' && cur) cur.files.push(line);
  });
  return commits;
}

export function assertFullHistory(root) {
  if (git(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    refuse(EXIT.SHALLOW, 'история обрезана (shallow clone): таблица строится по всей истории коммитов.\n'
      + '  локально: git fetch --unshallow\n'
      + '  в CI: actions/checkout с fetch-depth: 0');
  }
}

/* The promise that **the install example leads to a revision that can do what the text teaches**. The
 * pin is a revision of this repository — forty characters (pnpm resolves a short sha only through
 * visible refs, that is, while the revision is the tip of a branch) — and its help holds every command
 * the instructions call. Otherwise the documented path leads into emptiness: a revision that silently
 * ignores a word it does not know answers zero having done nothing.
 *
 * The revision's help is read from git history (`git show <pin>:src/refusal.js`) rather than from the
 * tree: in the tree it is the one beside us, and checking it here would mean checking ourselves.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, gitIn, gitTry } from '../tools/harness.js';
import { calledCommands, commandsAt, read } from '../tools/docs-facts.js';
import { installSpec } from '../src/tool.js';

test('the install example leads to a revision whose help knows the commands it names', () => {
  const pin = read('README.md').match(/github:vernikr\/size-report#([\w./-]+)/);
  assert.notEqual(pin, null, 'README does not name a revision in the install example — there is nothing to compare');
  const rev = pin[1];

  /* The tool teaches installing the package by **that same** link: that way the document and the advice
   * cannot drift apart, and a release that raises the version has to raise the pin too (`src/tool.js`,
   * `installSpec`). A name from the registry would not do here: it names whatever the registry serves as
   * the latest revision, while the document describes this very one. */
  assert.ok(installSpec() !== null, 'the manifest carries no repository address: the advice about'
    + ' the install has nothing to name — that is repaired by the manifest rather than the documentation');
  assert.ok(read('README.md').indexOf(installSpec()) >= 0,
    'the install example does not match what the tool teaches (' + installSpec() + ')');

  // pnpm resolves a short sha only through visible refs, and `git ls-remote` hands over branch tips
  // alone: while the revision is a tip it resolves, and on the next commit the install fails with
  // "Could not resolve … to a commit". So the pin is either forty characters or a branch (tag) name —
  // checked here rather than remembered.
  if (/^[0-9a-f]+$/.test(rev)) {
    assert.equal(rev.length, 40, 'the pin «' + rev + '» is a short sha: pnpm resolves it'
      + ' only while the revision is the tip of a branch; write forty characters');
  } else {
    assert.equal(gitTry(ROOT, ['rev-parse', '--verify', '--quiet', rev + '^{commit}']).status, 0,
      'the pin «' + rev + '» is neither a revision nor a branch (tag) of this repository');
  }

  const type = gitTry(ROOT, ['cat-file', '-t', rev]).stdout.trim();
  const shallow = gitTry(ROOT, ['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true';
  assert.ok(type === 'commit' || type === 'tag',
    'the install example refers to «' + rev + '», and this repository holds no such revision'
      + (shallow
        ? ' — but the clone is truncated, so it would not be found either: this guard needs the history'
          + ' (`fetch-depth: 0` on checkout, `git fetch --unshallow` by hand)'
        : ''));
  const commit = gitIn(ROOT, ['rev-parse', rev + '^{commit}']).trim();

  const commands = commandsAt(commit);
  assert.ok(commands !== null && commands.length > 0,
    'the revision «' + rev + '» has no help with a section «Команды» — it is older than what the text teaches');

  const unknown = [...calledCommands()].filter((c) => commands.indexOf(c) < 0);
  assert.deepEqual(unknown, [],
    'the revision «' + rev + '» does not know the commands the text teaches: ' + unknown.join(', ')
      + '\n  in the help of that revision: ' + commands.join(', '));
});

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

test('пример установки ведёт на ревизию, чья справка знает названные команды', () => {
  const pin = read('README.md').match(/github:vernikr\/size-report#([\w./-]+)/);
  assert.notEqual(pin, null, 'README не называет ревизию в примере установки — сверить нечего');
  const rev = pin[1];

  /* The tool teaches installing the package by **that same** link: that way the document and the advice
   * cannot drift apart, and a release that raises the version has to raise the pin too (`src/tool.js`,
   * `installSpec`). A name from the registry would not do here: it names whatever the registry serves as
   * the latest revision, while the document describes this very one. */
  assert.ok(installSpec() !== null, 'у манифеста нет адреса репозитория: совету об'
    + ' установке нечего назвать — это правится не документацией, а манифестом');
  assert.ok(read('README.md').indexOf(installSpec()) >= 0,
    'пример установки не совпадает с тем, чему учит инструмент (' + installSpec() + ')');

  // pnpm resolves a short sha only through visible refs, and `git ls-remote` hands over branch tips
  // alone: while the revision is a tip it resolves, and on the next commit the install fails with
  // "Could not resolve … to a commit". So the pin is either forty characters or a branch (tag) name —
  // checked here rather than remembered.
  if (/^[0-9a-f]+$/.test(rev)) {
    assert.equal(rev.length, 40, 'пин «' + rev + '» — короткий sha: pnpm разрешает его'
      + ' только пока ревизия является верхушкой ветки; пишите сорок знаков');
  } else {
    assert.equal(gitTry(ROOT, ['rev-parse', '--verify', '--quiet', rev + '^{commit}']).status, 0,
      'пин «' + rev + '» — не ревизия и не ветка (тег) этого репозитория');
  }

  const type = gitTry(ROOT, ['cat-file', '-t', rev]).stdout.trim();
  const shallow = gitTry(ROOT, ['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true';
  assert.ok(type === 'commit' || type === 'tag',
    'пример установки ссылается на «' + rev + '», а такой ревизии в этом репозитории нет'
      + (shallow
        ? ' — но клон обрезан, поэтому и не найдётся: сторожу нужна история'
          + ' (`fetch-depth: 0` у checkout, `git fetch --unshallow` руками)'
        : ''));
  const commit = gitIn(ROOT, ['rev-parse', rev + '^{commit}']).trim();

  const commands = commandsAt(commit);
  assert.ok(commands !== null && commands.length > 0,
    'у ревизии «' + rev + '» нет справки с разделом «Команды» — она старше того, чему учит текст');

  const unknown = [...calledCommands()].filter((c) => commands.indexOf(c) < 0);
  assert.deepEqual(unknown, [],
    'ревизия «' + rev + '» не знает команд, которым учит текст: ' + unknown.join(', ')
      + '\n  в справке той ревизии: ' + commands.join(', '));
});

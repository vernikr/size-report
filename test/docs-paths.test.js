/* The promise that **what the documentation names exists**. A path from a code span is in the git tree,
 * in the fixture's history (that history is not one tree, and the document may name a file that lived
 * before a rename) or in the list of foreign ones, which a person keeps. The file table of `README.md`
 * has to agree with the tree **both ways**: a file missing from it is a gap nobody noticed.
 *
 * What stays with a person is said in the header of `tools/docs-facts.js`: the check takes existence and
 * completeness, not whether a file's role is described correctly.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gitIn, sharedClone, tempDir } from '../tools/harness.js';
import {
  DOCS, FOREIGN, NOT_TODAY, OWN_PROJECT, dirs, facts, inTree, looksLikePath, read, spans, tracked
} from '../tools/docs-facts.js';

const tmp = tempDir('docs-paths');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('пути, названные документацией, есть в дереве', () => {
  // The files the fixture knew: its history is not one tree, and the documentation may name a file
  // under a name that lived before a rename.
  const fixture = new Set(gitIn(sharedClone('plain', tmp), ['log', '--name-only', '--pretty=format:'])
    .split('\n').filter((l) => l !== ''));
  const foreign = new Set(FOREIGN);
  const missing = [];
  DOCS.forEach((doc) => {
    spans(facts(doc, (NOT_TODAY[doc] || []).concat(OWN_PROJECT[doc] || []))).forEach((tok) => {
      if (!looksLikePath(tok)) return;
      if (inTree(tok) || foreign.has(tok) || fixture.has(tok)) return;
      missing.push(doc + ': ' + tok);
    });
  });
  assert.deepEqual(missing, [],
    'документация называет пути, которых нет ни в дереве, ни в фикстуре, ни среди чужих:\n  '
    + missing.join('\n  '));
});

test('таблица файлов README совпадает с деревом в обе стороны', () => {
  const named = [];
  const table = read('README.md').match(/## What is in the repository[\s\S]*?(?=\n## |$)/)[0];
  table.split('\n').forEach((line) => {
    if (line.indexOf('|') !== 0) return;
    const first = line.split('|')[1];
    if (first === undefined || first.trim() === 'File' || /^-+$/.test(first.trim())) return;
    first.split(',').forEach((cell) => {
      const tok = cell.replace(/`/g, '').trim();
      if (tok !== '' && tok !== 'File' && tok.indexOf('—') < 0) named.push(tok);
    });
  });
  assert.ok(named.length > 0, 'таблица файлов README не разобралась');

  const absent = named.filter((p) => !inTree(p));
  assert.deepEqual(absent, [], 'README называет файлы, которых нет:\n  ' + absent.join('\n  '));

  // The other side: a file missing from the table is a gap nobody noticed. A directory covers everything
  // beneath it; the table does not list itself, because that is its heading rather than a row of
  // content.
  const covered = (f) => named.some((p) => p === f || (p.slice(-1) === '/' && f.indexOf(p) === 0)
    || (dirs.has(p) && f.indexOf(p + '/') === 0));
  const undescribed = tracked.filter((f) => f !== 'README.md' && !covered(f));
  assert.deepEqual(undescribed, [],
    'в дереве есть файлы, которых нет в таблице README:\n  ' + undescribed.join('\n  '));
});

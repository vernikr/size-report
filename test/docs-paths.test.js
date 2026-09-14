/* Первое обещание документации: **то, что она называет, существует**. Путь из
 * код-спана есть в дереве git, в истории фикстуры (её история — не одно дерево, и
 * документ вправе назвать файл, живший до переименования) или в списке чужих,
 * который ведёт человек. Таблица файлов `README.md` при этом сходится с деревом
 * **в обе стороны**: файл, которого в ней нет, — пробел, которого не заметили.
 *
 * Что остаётся человеку — в шапке `tools/docs-facts.js`: проверка берёт
 * существование и полноту, но не верность описания роли файла.
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
  // Файлы, которые знала фикстура: её история — не одно дерево, и документация
  // вправе называть файл по имени, жившему до переименования.
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
  const table = read('README.md').match(/## Что в репозитории[\s\S]*?(?=\n## |$)/)[0];
  table.split('\n').forEach((line) => {
    if (line.indexOf('|') !== 0) return;
    const first = line.split('|')[1];
    if (first === undefined || first.trim() === 'Файл' || /^-+$/.test(first.trim())) return;
    first.split(',').forEach((cell) => {
      const tok = cell.replace(/`/g, '').trim();
      if (tok !== '' && tok !== 'Файл' && tok.indexOf('—') < 0) named.push(tok);
    });
  });
  assert.ok(named.length > 0, 'таблица файлов README не разобралась');

  const absent = named.filter((p) => !inTree(p));
  assert.deepEqual(absent, [], 'README называет файлы, которых нет:\n  ' + absent.join('\n  '));

  // Обратная сторона: файл, которого в таблице нет, — пробел, которого не
  // заметили. Каталог покрывает всё, что под ним; сама таблица себя не
  // перечисляет, потому что это её шапка, а не строка содержимого.
  const covered = (f) => named.some((p) => p === f || (p.slice(-1) === '/' && f.indexOf(p) === 0)
    || (dirs.has(p) && f.indexOf(p + '/') === 0));
  const undescribed = tracked.filter((f) => f !== 'README.md' && !covered(f));
  assert.deepEqual(undescribed, [],
    'в дереве есть файлы, которых нет в таблице README:\n  ' + undescribed.join('\n  '));
});

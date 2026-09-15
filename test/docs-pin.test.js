/* Пятое обещание документации, и оно своё у каждой инструкции: **пример установки
 * ведёт на ревизию, которая умеет то, чему учит текст**. Пин — ревизия этого
 * репозитория, сорок знаков (короткий sha pnpm разрешает только через видимые
 * рефы, то есть пока ревизия — верхушка ветки), и в её справке есть все команды,
 * которые зовёт инструкция. Иначе документированный путь ведёт в пустоту:
 * инструмент той ревизии лишнего слова не читает, и `size doctor` отвечает нулём,
 * ничего не сделав.
 *
 * Справка ревизии читается из истории git (`git show <пин>:src/refusal.js`), а не
 * из дерева: в дереве она своя, и проверять её здесь значило бы проверять себя.
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

  // Короткий sha pnpm разрешает только через видимые рефы, а `git ls-remote` отдаёт
  // одни верхушки веток: пока ревизия — верхушка, она разрешается, а на следующем
  // коммите установка падает с «Could not resolve … to a commit». Поэтому пин либо
  // сорок знаков, либо имя ветки или тега — и это проверяется здесь, а не памятью.
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

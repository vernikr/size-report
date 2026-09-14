/* Сверка с рабочим деревом: две её стороны и два свидетеля, ради которых она
 * написана.
 *
 *   - правка файла только на диске (git о ней молчит) обязана ловиться — иначе
 *     «починка» свелась бы к удалению сверки;
 *   - правка, потерянная при переносе между коммитами (`--diff-merges=first-parent`
 *     у merge-коммита), видна только при сравнении состояния с деревом коммита.
 *
 * Клоны здесь свои у каждой проверки: они правят файлы, и общий клон после этого
 * не годится никому (одна проверка подсунула бы другой свою правку).
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PACKAGE, PACKAGE_BIN, ROOT, cloneCrlf, cloneFixture, gitIn, runFixtureWith, tempDir
} from '../tools/harness.js';

const tmp = tempDir('disk');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* Проверка проверки: правка файла на диске, о которой git молчит (файл помечен
 * «предполагается неизменным»), обязана быть поймана. */
function assertCatchesDiskEdit(dir, label) {
  gitIn(dir, ['update-index', '--assume-unchanged', 'src/code.js']);
  fs.appendFileSync(path.join(dir, 'src', 'code.js'), '// правка, которой нет в git\n');
  assert.equal(gitIn(dir, ['status', '--porcelain']).trim(), '',
    'в выкладке «' + label + '» правка попала в статус git: файл выпал бы из сверки как грязный, и проверять нечего');
  const res = runFixtureWith(PACKAGE, dir, ['--json']);
  assert.notEqual(res.code, 0, 'сверка пропустила правку, которой нет в истории (' + label + ')');
  assert.match(res.stderr, /правка есть только на диске/,
    'сверка отказалась по другой причине: ' + res.stderr.trim().split('\n')[0]);
}

test('правка файла только на диске ловится — и в обычной выкладке, и в CRLF', () => {
  assertCatchesDiskEdit(cloneFixture(path.join(tmp, 'edit-plain')), 'обычная выкладка');
  assertCatchesDiskEdit(cloneCrlf(path.join(tmp, 'edit-crlf')), 'выкладка CRLF');
});

/* Вторая половина сверки — состояние против дерева коммита — существует ради
 * правки, потерянной при переносе между коммитами. Мутация убирает из чтения
 * истории слияния, то есть воспроизводит ровно ту ошибку, от которой сверка и
 * защищает: правка разрешения конфликта выпадает из состояния, а в дереве
 * остаётся. Мутируется копия исходников, поэтому рабочее дерево не трогается. */
test('потерянная правка merge-коммита ловится состоянием против дерева', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'git.js'), 'utf8');
  const mutated = source.replace("'--diff-merges=first-parent', ", '');
  assert.notEqual(mutated, source,
    'мутация не применилась: движок больше не читает слияния первым родителем — мутацию пора переписать');

  /* Мутированную сборку собираем целиком: движок читает соседние исходники
   * (`derived.js`, `page/app.js`), и без них отказ был бы «модуль не найден»,
   * то есть проверка проверяла бы не то. */
  const dir = path.join(tmp, 'engine-without-merge-paths');
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'src'), path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'git.js'), mutated);
  fs.copyFileSync(PACKAGE_BIN, path.join(dir, 'bin', 'size.js'));

  const res = runFixtureWith({ name: 'мутированный движок', file: path.join(dir, 'bin', 'size.js'), env: null },
    cloneFixture(path.join(tmp, 'mutated-clone')), ['--json']);
  assert.notEqual(res.code, 0, 'потерянная правка merge-коммита прошла мимо сверки');
  assert.match(res.stderr, /перенос состояния между коммитами пропустил правку/,
    'сверка отказалась по другой причине: ' + res.stderr.trim().split('\n')[0]);
});

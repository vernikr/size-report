/* The choice panel — the project's file tree: folders come from the paths (not only from the
 * columns), a folder has three states, its switch takes the whole subtree with it, and a file the
 * report does not hold stands in its place with the reason in words. Here too is how far the
 * reader got: a rebuild of the panel puts that back, or every switch would start from the bottom.
 *
 * Checked against the assembled page in a real DOM (jsdom) rather than against a description. The
 * numbers, the pasted program and the empty states are a neighbouring suite (`page-view`), and the
 * memory of a choice is `page-choice`: the file is split by subject rather than by size.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueParts } from '../src/size-table.js';
import {
  fileBox, nowCells, nowTotal, pageMath, pageReady, stored, toggleBox
} from '../tools/page-harness.js';

/* The expected totals are computed by the same calculation the page carries (`pageMath` of the
 * harness): the check has no rule of its own about what a subtree weighs. */
const { data, openPage } = pageReady('tree');

const allOn = () => data.files.map(() => true);

const where = (f) => (f.path === null ? f.paths[0] : f.path);
const dirs = (doc) => [...doc.querySelectorAll('#panel .box.dir')];
const dirBox = (doc, prefix) => dirs(doc).find((b) => b.textContent.indexOf(prefix) === 0);
const dirInput = (doc, prefix) => dirBox(doc, prefix).querySelector('input');
const leaves = (doc) => [...doc.querySelectorAll('#panel .tree .box:not(.dir):not(.plain)')];
const plains = (doc) => [...doc.querySelectorAll('#panel .tree .box.plain:not(.dir)')];
/* Files of the project that the report does not hold: they never became a column. The "column"
 * mark in the catalogue is an empty reason, and a column is named by the same rule the panel
 * uses. */
const notMeasured = () => data.catalog.filter((e) =>
  !data.files.some((f) => where(f) === e.path));

/* The tree's folders are exactly those in the project's file paths (not only in the columns), and
 * its leaves are every measurable file. */
function foldersMatchPaths(doc) {
  const paths = data.catalog.map((e) => e.path).concat(data.files.map(where));
  const expected = [...new Set(paths.map((p) => p.split('/').slice(0, -1).join('/')))]
    .filter((d) => d !== '').sort();
  assert.deepEqual(dirs(doc).map((b) => b.textContent.replace(/\/\d+(\/\d+)?$/, '')).sort(), expected,
    'папки дерева разошлись с путями файлов проекта');
  assert.equal(leaves(doc).length, data.files.length, 'в дереве не все измеряемые файлы');
  data.files.forEach((f) => assert.ok(leaves(doc)
    .some((b) => b.querySelector('input').title.indexOf(where(f)) === 0),
  'в дереве нет файла ' + where(f)));
}

/* A folder's three states: all its files on — checked; some — the third state; none — the folder
 * is simply unchecked and must not look partial. */
function folderStates(doc) {
  const leafOf = (prefix) => dirBox(doc, prefix).closest('li')
    .querySelector('.box:not(.dir):not(.plain) input');
  assert.equal(dirInput(doc, 'src/').checked, true, 'папка не отмечена вместе со своими файлами');
  toggleBox(doc, leafOf('src/'), false);
  assert.equal(dirInput(doc, 'src/').indeterminate, true,
    'папка с частью выключенных файлов не показала третье состояние');
  assert.equal(dirInput(doc, 'src/').checked, false, 'частично выключенная папка отмечена как целая');
  toggleBox(doc, dirInput(doc, 'src/'), true);
  assert.equal(dirInput(doc, 'src/').indeterminate, false, 'третье состояние осталось после включения всех файлов');

  assert.equal(dirInput(doc, 'notes/').checked, true, 'папка с единственным файлом не отмечена вместе с ним');
  toggleBox(doc, leafOf('notes/'), false);
  assert.equal(dirInput(doc, 'notes/').indeterminate, false,
    'папка без включённых файлов показана как частичная');
  assert.equal(dirInput(doc, 'notes/').checked, false, 'папка без включённых файлов осталась отмеченной');
  toggleBox(doc, dirInput(doc, 'notes/'), true);
  assert.equal(dirInput(doc, 'notes/').checked, true, 'включение папки не включило её файл');
}

/* A folder's switch takes the whole subtree with it: exactly its files and their columns leave
 * the table and the total. The quick category buttons and the tree are one state: switching a
 * category off shows on the folder holding its files and leaves other files alone. */
function subtreeAndCategories(doc) {
  const inSrc = [];
  data.files.forEach((f, i) => { if (where(f).indexOf('src/') === 0) inSrc.push(i); });
  assert.ok(inSrc.length > 1, 'в фикстуре нет папки с несколькими файлами');

  const all = allOn();
  const rawOf = (on) => pageMath.totalsOf(data.now, ['raw'], on).raw;
  assert.equal(dirBox(doc, 'src/').querySelector('.n').textContent, String(inSrc.length),
    'счётчик файлов у папки не тот');
  assert.equal(nowTotal(doc), valueParts(rawOf(all)).text, 'итог до выключения папки не тот');
  toggleBox(doc, dirInput(doc, 'src/'), false);
  const off = all.map((_on, i) => inSrc.indexOf(i) < 0);
  assert.equal(nowTotal(doc), valueParts(rawOf(off)).text, 'выключение папки не убрало её файлы из итога');
  assert.equal(nowCells(doc), (off.filter(Boolean).length + 1) * data.metrics.length,
    'выключение папки не убрало её колонки');

  const chore = [...doc.querySelectorAll('#panel .row .box.all')]
    .find((b) => b.textContent === data.categories.find((c) => c.key === 'chore').label);
  assert.notEqual(chore, undefined, 'в панели нет быстрой кнопки категории');
  toggleBox(doc, chore.querySelector('input'), false);
  assert.equal(dirInput(doc, 'data/').checked, false,
    'выключение категории не отразилось на папке с её файлами');
  assert.equal(dirInput(doc, 'docs/').checked, true, 'выключение категории выключило чужие файлы');
  toggleBox(doc, chore.querySelector('input'), true);
  assert.equal(dirInput(doc, 'data/').checked, true, 'включение категории не вернуло её файлы');
}

test('дерево файлов: папки по путям, три состояния и всё поддерево', () => {
  const doc = openPage().window.document;
  foldersMatchPaths(doc);
  folderStates(doc);
  subtreeAndCategories(doc);
});

/* The tree is the project's tree rather than a list of columns: a file the report does not hold
 * stands in its place, but its box is off and disabled (there are no numbers to switch), and the
 * reason is in the tooltip — or the reader would think the file was lost. The reason arrives from
 * the engine as a mark: "such a file cannot be a column" is the package's rule, "not in the set of
 * columns" is the project's choice. A folder of mixed content counts a share: how many of how
 * many are in the report. */
test('дерево показывает все файлы проекта, а вне отчёта — со снятой галочкой', () => {
  const doc = openPage().window.document;
  const others = notMeasured();
  assert.ok(others.length > 0, 'в фикстуре нет ни одного файла вне колонок — проверять нечего');
  assert.equal(plains(doc).length, others.length, 'в дереве не все файлы проекта');
  others.forEach((entry) => assert.ok(plains(doc).some((b) => b.title.indexOf(entry.path + ' · ') === 0),
    'в дереве нет файла проекта ' + entry.path));
  plains(doc).forEach((b) => {
    const input = b.querySelector('input');
    assert.notEqual(input, null, 'у файла вне отчёта нет галочки: строка выбилась из ряда');
    assert.equal(input.disabled, true,
      'галочку файла вне отчёта можно переключить: переключать нечего, а вид обещает обратное');
    assert.equal(input.checked, false, 'галочка файла вне отчёта отмечена');
    assert.match(b.title, /не измеряется: /, 'подпись не говорит, почему файла нет в отчёте');
  });

  /* Two reasons are two answers: the report itself cannot be a column, while an ordinary text file
   * simply was not chosen as one. Words alone cannot say this — the reader would not know whether
   * something in the settings needs fixing. */
  const at = (path) => plains(doc).find((b) => b.title.indexOf(path + ' · ') === 0);
  const artifact = others.find((e) => e.path === data.report.artifact);
  assert.equal(artifact.why, 'rule', 'у самого отчёта причина не та: ' + JSON.stringify(artifact));
  const choosable = others.find((e) => e.why === 'choice');
  assert.notEqual(choosable, undefined, 'в фикстуре нет файла, который мог бы быть колонкой');
  assert.notEqual(at(choosable.path).title, at(artifact.path).title,
    'две разные причины вне отчёта названы одними словами');

  /* A folder of mixed content: both a share in its counter and a box only for what is
   * measurable. */
  const inside = (p) => p.indexOf('docs/') === 0;
  const inDocs = others.filter((e) => inside(e.path)).length;
  const measuredDocs = data.files.filter((f) => inside(where(f))).length;
  assert.ok(measuredDocs > 0 && inDocs > 0, 'в фикстуре нет папки со смешанным составом');
  assert.equal(dirBox(doc, 'docs/').querySelector('.n').textContent,
    measuredDocs + '/' + (measuredDocs + inDocs),
    'счётчик папки не сказал, сколько её файлов осталось вне отчёта');
  toggleBox(doc, dirInput(doc, 'docs/'), false);
  assert.equal(nowCells(doc), (data.files.length - measuredDocs + 1) * data.metrics.length,
    'галочка папки увела из таблицы не только её измеряемые файлы');


});

/* A folder with nothing to switch stays in place, but its box is off and disabled too: every row
 * looks alike, and the reason is in the tooltip. The order within a level is checked as well:
 * everything the report does not hold comes after what it holds rather than being mixed in — or
 * the report would have to be searched among strangers.
 *
 * The set of "folders with nothing to measure" is computed from the data rather than read off the
 * markup: otherwise the check would confirm itself and miss a folder marked unavailable for no
 * reason. */
test('папки вне отчёта — со снятой галочкой и после тех, что в отчёте', () => {
  const doc = openPage().window.document;
  const measured = data.files.map(where);
  const empty = [...new Set(data.catalog.map((e) => e.path.split('/').slice(0, -1).join('/')))]
    .filter((d) => d !== '' && !measured.some((p) => p.indexOf(d + '/') === 0)).sort();
  const plain = [...doc.querySelectorAll('#panel .box.dir.plain')];
  assert.deepEqual(plain.map((b) => b.querySelector('span').textContent.replace(/\/$/, '')).sort(),
    empty, 'недоступные папки разошлись с теми, где измерять нечего');
  plain.forEach((b) => {
    assert.equal(b.querySelector('input').disabled, true, 'галочка папки вне отчёта переключается');
    assert.equal(b.querySelector('input').checked, false, 'папка вне отчёта отмечена галочкой');
  });

  [...doc.querySelectorAll('#panel ul.tree')].forEach((ul) => {
    const rows = [...ul.children].map((li) => {
      const input = li.querySelector(':scope > .box input');
      return input !== null && input.disabled === false;
    });
    const outside = rows.indexOf(false);
    if (outside >= 0) {
      assert.equal(rows.slice(outside).indexOf(true), -1,
        'строка отчёта стоит после строк, которых в нём нет');
    }
  });
});

/* Folding is how much of the tree is visible, and it must not touch the numbers: the box is
 * responsible for what is counted, the folder's mark for what is visible. So folding and the
 * memory of it are checked where it shows that the table has not moved and that the tree comes back
 * folded on the next visit — in a tree of any length that is the only way to reach its middle. */
test('папку дерева можно сложить, и сложенное помнится на следующем заходе', () => {
  const dom = openPage();
  const doc = dom.window.document;
  const fold = (d, prefix) => dirBox(d, prefix).closest('li').querySelector(':scope > .fold');
  const row = (d, prefix) => dirBox(d, prefix).closest('li');
  const before = nowCells(doc);
  const table = doc.querySelector('#grid tbody tr');

  fold(doc, 'src/').dispatchEvent(new dom.window.Event('click'));
  assert.equal(row(doc, 'src/').classList.contains('folded'), true,
    'строка папки не помечена сложенной: поддерево не спрятать оформлением');
  assert.equal(dirInput(doc, 'src/').checked, true,
    'складывание папки поменяло её выбор: знак отвечает за вид, а галочка — за числа');
  assert.equal(nowCells(doc), before, 'складывание папки убрало числа из таблицы');
  assert.equal(fold(doc, 'src/').textContent, '▸', 'знак сложенной папки не сказал, что она сложена');
  /* Folding is pure appearance: the table stays the very same markup afterwards rather than being
   * assembled again. Otherwise every click on the mark would count all rows and columns, and a tree
   * with a long history would answer with a visible delay. */
  assert.equal(doc.querySelector('#grid tbody tr'), table,
    'клик по знаку пересобрал таблицу: складывание считает числа, которых не меняет');

  /* Memory: the next visit opens with the same folded tree and the full choice. Folding has a key
   * of its own — otherwise it would travel into the link, and a link is sent for the numbers
   * rather than for how somebody arranged their tree. */
  const seed = stored(dom);
  const next = openPage(seed).window.document;
  assert.equal(fold(next, 'src/').textContent, '▸',
    'сложенная папка разложилась на следующем заходе');
  assert.equal(row(next, 'src/').classList.contains('folded'), true,
    'память помнит знак, но не саму сложенность');
  assert.equal(fold(next, 'data/').textContent, '▾', 'чужая папка сложилась вместе с этой');
  assert.deepEqual([...next.querySelectorAll('#panel input')].filter((b) => !b.checked && !b.disabled), [],
    'память сложенного унесла с собой выключенные файлы');
  assert.deepEqual(Object.keys(seed).length, 1, 'запись о дереве легла не туда: ' + JSON.stringify(seed));
  assert.ok(Object.keys(seed)[0].indexOf(':tree') > 0,
    'складывание легло в запись выбора: ' + Object.keys(seed)[0]);
});

/* jsdom does not lay the page out, so its elements always scroll by zero and writing to
 * `scrollTop` means nothing. To check that a rebuild does not lose the scroll, the window is given
 * a memory of it: the same `scrollTop`, only remembered. This stands in for layout, not for
 * behaviour — the page reads and writes the same property as in a browser. */
function scrollMemory(dom) {
  Object.defineProperty(dom.window.Element.prototype, 'scrollTop', {
    configurable: true,
    get() { return this.appTop === undefined ? 0 : this.appTop; },
    set(top) { this.appTop = top; }
  });
}

/* A click on a box redraws the whole panel, and the scroll of the list is what the reader set up
 * (how far they got): a rebuild has to bring it back, while the field under the keyboard must not
 * drag the list towards itself. Both the panel's scroll and the list's are checked: in a wide
 * window the panel scrolls, in a narrow one the list. */
test('прокрутка панели и списка файлов переживает пересборку', () => {
  const dom = openPage();
  const doc = dom.window.document;
  scrollMemory(dom);
  const panel = doc.getElementById('panel');
  const list = () => doc.querySelector('#panel .files');
  panel.scrollTop = 137;
  list().scrollTop = 48;

  toggleBox(doc, fileBox(doc, 'src/code.js'), false);

  assert.equal(panel.scrollTop, 137,
    'пересборка панели вернула её прокрутку к началу: нижние метрики снова искать заново');
  assert.equal(list().scrollTop, 48,
    'пересборка вернула список файлов к началу: до нижних файлов дерева не добраться');
});

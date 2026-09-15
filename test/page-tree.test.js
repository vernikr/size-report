/* Панель выбора — дерево файлов проекта: папки берутся из путей (а не только из
 * колонок), у папки три состояния, переключатель ведёт за собой всё поддерево, а
 * файл вне отчёта стоит на своём месте подписью с причиной. Здесь же место, до
 * которого дошёл читатель: пересборка панели его возвращает, иначе каждое
 * переключение начиналось бы снизу.
 *
 * Проверяется по собранной странице в настоящем DOM (jsdom), а не по описанию.
 * Числа, вклейка программы и состояния пустоты — соседний набор (`page-view`):
 * файл разделён по предмету, а не по размеру. Память выбора — `page-choice`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueParts } from '../src/size-table.js';
import {
  fileBox, nowCells, nowTotal, pageMath, pageReady, stored, toggleBox
} from '../tools/page-harness.js';

/* Ожидаемые итоги считает та же вычислительная часть, что вклеена в страницу
 * (`pageMath` обвязки): своего правила «сколько весит поддерево» у проверки нет. */
const { data, openPage } = pageReady('tree');

const allOn = () => data.files.map(() => true);

const where = (f) => (f.path === null ? f.paths[0] : f.path);
const dirs = (doc) => [...doc.querySelectorAll('#panel .box.dir')];
const dirBox = (doc, prefix) => dirs(doc).find((b) => b.textContent.indexOf(prefix) === 0);
const dirInput = (doc, prefix) => dirBox(doc, prefix).querySelector('input');
const leaves = (doc) => [...doc.querySelectorAll('#panel .tree .box:not(.dir):not(.plain)')];
const plains = (doc) => [...doc.querySelectorAll('#panel .tree .box.plain:not(.dir)')];
/* Файлы проекта, которых нет в отчёте: колонкой они не стали. Знак «колонка» в
 * каталоге — пустая причина, а имя колонки берётся тем же правилом, что в панели. */
const notMeasured = () => data.catalog.filter((e) =>
  !data.files.some((f) => where(f) === e.path));

/* Папки дерева — ровно те, что есть в путях файлов проекта (а не только колонок),
 * и листья — все измеряемые файлы. */
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

/* Три состояния папки: все её файлы включены — отметка; часть — третье
 * состояние; ни одного — папка просто не отмечена, но не выглядит частичной. */
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

/* Переключатель папки ведёт за собой всё поддерево: из таблицы и из итога
 * уходят ровно её файлы и их колонки. Быстрые кнопки категорий и дерево — одно
 * состояние: выключение категории видно на папке, где лежат её файлы, и не
 * трогает чужие. */
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

/* Дерево — дерево проекта, а не список колонок: файл, который в отчёт не попал,
 * стоит на своём месте, но его галочка снята и недоступна (чисел для него не
 * измеряли, и переключать нечего), а причина названа во всплывающей строке — иначе
 * читатель решил бы, что файл потерялся. Причина приходит от движка знаком: «такой
 * файл колонкой быть не может» — это правило пакета, «в набор колонок не попал» —
 * выбор проекта. Счётчик папки со смешанным составом — доля: сколько в отчёте из
 * сколько. */
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

  /* Две причины — два ответа: сам отчёт колонкой быть не может, а обычный текстовый
   * файл просто не выбран в колонки. Одними словами это назвать нельзя — читатель
   * не поймёт, надо ли что-то править в настройках. */
  const at = (path) => plains(doc).find((b) => b.title.indexOf(path + ' · ') === 0);
  const artifact = others.find((e) => e.path === data.report.artifact);
  assert.equal(artifact.why, 'rule', 'у самого отчёта причина не та: ' + JSON.stringify(artifact));
  const choosable = others.find((e) => e.why === 'choice');
  assert.notEqual(choosable, undefined, 'в фикстуре нет файла, который мог бы быть колонкой');
  assert.notEqual(at(choosable.path).title, at(artifact.path).title,
    'две разные причины вне отчёта названы одними словами');

  /* Папка со смешанным составом: и доля в счётчике, и галочка только по измеряемым. */
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

/* Папка, у которой включать нечего, остаётся на месте, но её галочка тоже снята и
 * недоступна: вид у всех строк один, а причина — во всплывающей строке. Заодно
 * проверяется порядок уровня: всё, чего в отчёте нет, стоит после того, что в нём
 * есть, а не вперемешку — иначе искать в отчёте пришлось бы среди чужого.
 *
 * Набор «папок, где измерять нечего» считается по данным, а не по разметке: иначе
 * проверка подтверждала бы сама себя и пропустила бы папку, помеченную недоступной
 * зря. */
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

/* Складывание — это то, сколько дерева видно, и оно не должно трогать числа:
 * галочка отвечает за то, что считается, а знак папки — за то, что видно. Поэтому
 * складывание и память о нём проверяются там, где видно, что таблица не сдвинулась,
 * а на следующем заходе дерево осталось сложенным: у 148 путей проекта это
 * единственный способ добраться до его середины. */
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
  /* Складывание — чистый вид: таблица после него остаётся той же самой разметкой, а
   * не собранной заново. Иначе каждый клик по знаку считал бы все строки и колонки,
   * и дерево с длинной историей отвечало бы на него заметной задержкой. */
  assert.equal(doc.querySelector('#grid tbody tr'), table,
    'клик по знаку пересобрал таблицу: складывание считает числа, которых не меняет');

  /* Память: следующий заход открывается с тем же сложенным деревом и с полным
   * выбором. Ключ у складывания свой — иначе оно уехало бы в ссылку, а ссылку
   * отправляют ради чисел, а не ради того, как у кого разложено дерево. */
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

/* jsdom не раскладывает страницу, поэтому прокрутка у её элементов всегда ноль, а
 * запись в `scrollTop` ничего не значит. Чтобы проверить, что пересборка панели
 * прокрутку не теряет, окну даётся память о ней: тот же `scrollTop`, только
 * запоминаемый. Это подмена раскладки, а не поведения — страница читает и пишет то
 * же свойство, что и в браузере. */
function scrollMemory(dom) {
  Object.defineProperty(dom.window.Element.prototype, 'scrollTop', {
    configurable: true,
    get() { return this.appTop === undefined ? 0 : this.appTop; },
    set(top) { this.appTop = top; }
  });
}

/* Клик по галочке перерисовывает панель целиком, и прокрутка списка — это то, что
 * читатель в ней настроил (до какого файла дошёл): пересборка обязана её вернуть, а
 * поле под клавиатурой — не тянуть список к себе. Прокрутка панели и списка
 * проверяются обе: в широком окне прокручивается панель, в узком — список. */
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

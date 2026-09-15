/* The report page — what a person reads: one self-contained file that opens from disk, counts
 * with the engine's own calculation and recounts by the reader's choice.
 *
 * Checked against the assembled output in a real DOM (jsdom) rather than against a description:
 * the pasted program is the engine's calculation first, with no module syntax, and the shell has
 * grown no calculating function of its own; the file is self-contained (no external links, no
 * network calls) and carries the contract data; switching a metric or a file recounts the table
 * and the total; approximate cells are marked and the total takes the worst of those on; the
 * styling is shared and the delta colour is set in one place; panel switches are one click target
 * and a rebuild does not take the focus.
 *
 * Neighbouring suites, split by subject rather than by size: the file tree and the panel rebuild —
 * `page-tree`; the memory of a choice and the link — `page-choice`; the contract itself and its
 * derived values — `contract-data` and `contract-derived`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { pageScript, stripModules, valueParts } from '../src/size-table.js';
import { PAGE_PARTS, pagePayload } from '../src/page/build.js';
import { PAGE_CSS, TABLE_CSS } from '../src/css.js';
import { ROOT } from '../tools/harness.js';
import {
  allCells, derivedSrc, fileBox, metricBox, nowCells, nowTotal, pageMath, pageReady, panelInputs,
  toggleBox
} from '../tools/page-harness.js';

const { data, pageText, openPage } = pageReady('view');

/* The page's program is assembled from the sources on disk: the shell's chapters
 * (`src/page/*.js`, the list comes from the builder itself). The checks below read those very
 * files, so that what the page carries is compared with what the repository holds rather than with
 * what the engine says about itself. */
const appSrc = PAGE_PARTS
  .map((part) => fs.readFileSync(path.join(ROOT, 'src', 'page', part.slice(2)), 'utf8'))
  .join('');

const allOn = () => data.files.map(() => true);

/* A second, independent calculation must not appear quietly: the page gets the calculation's text
 * from the engine itself, and the shell may only build nodes — its own totals, deltas or formatting
 * would already be that second calculation. */
test('вычислительная часть страницы — код движка, а не копия', () => {
  const script = pageScript();
  const defined = (src) => [...src.matchAll(/\nfunction\s+(\w+)/g)].map((m) => m[1]);

  // The page carries exactly the text of two files (with the module syntax stripped).
  assert.deepEqual(defined(script).sort(), defined(stripModules(derivedSrc))
    .concat(defined(stripModules(appSrc))).sort(),
  'в программе страницы есть функция не из своих исходников');
  assert.equal(script.indexOf(stripModules(derivedSrc)), 0,
    'программа страницы начинается не с общего расчёта');
  assert.equal(/^\s*(import|export)\s/m.test(script), false,
    'в вклеенной программе остался модульный синтаксис: страница с диска его не разрешит');
  /* The module syntax is stripped line by line, so a multi-line `import` would leave a
   * `} from '…'` tail in the page — a line nothing resembles — and the page would break silently
   * and whole. Hence the module name is looked for rather than a line start: this same breakage
   * must not have a second shape. */
  assert.equal(/from\s+['"]/.test(script), false,
    'в вклеенной программе остался хвост импорта: импорт должен быть одной строкой');
  assert.ok(pageText.indexOf(script) > 0, 'страница собрана не из общей программы');

  /* The shell's list of functions is closed: a new one is either markup or a calculation that came
   * back by its own road; the first is fixed here, the second is better not to do at all. The
   * chapters are read as they reach the page — with the module syntax stripped. */
  assert.deepEqual(defined('\n' + stripModules(appSrc)).sort(), [
    'appAll', 'appApply', 'appApprox', 'appBody', 'appBox', 'appCell', 'appCellClass', 'appCommit', 'appCount',
    'appDir', 'appDirHead', 'appEl', 'appFileAt', 'appFileBox', 'appFoldBox', 'appFoldRead', 'appFoldSet',
    'appHash', 'appHead', 'appIndexes', 'appLeaf', 'appLeafAt', 'appLeaves', 'appLinkRead', 'appLinkUse', 'appNode',
    'appNotice', 'appOffBox', 'appPanel',
    'appPassport', 'appRead', 'appRecord', 'appRecordOk', 'appRender', 'appRow',
    'appScrollBack', 'appScrollTop', 'appState', 'appSubHead',
    'appTable', 'appTree', 'appTreeList', 'appUnknown', 'appUnmeasuredBox', 'appValueCell', 'appWrite'
  ], 'оболочка страницы завела свою функцию: расчёт должен жить в вычислительной части');
  assert.equal(/\breduce\(|Math\.abs/.test(appSrc), false,
    'оболочка страницы считает итоги или знак дельты сама');
  ['rowModel', 'nowModel', 'commitParts', 'cellParts', 'valueParts'].forEach((name) => {
    assert.ok(appSrc.indexOf(name + '(') >= 0, 'оболочка страницы не пользуется ' + name);
  });
});

/* The order of columns is about the reader rather than about numbers: the report is rebuilt after
 * every commit, and the first question is what this edit brought. So the columns the last commit
 * touched stand first, in the order of the settings, and the rest follow, in that same order. The
 * check reads this off the header, which is where the reader sees it. */
test('колонки последнего коммита идут впереди остальных, порядок настроек устоял', () => {
  const doc = openPage().window.document;
  // The first two header cells are not columns: the commit's caption and the overall total.
  const heads = headers(doc);
  const where = (i) => (data.files[i].path === null ? data.files[i].paths[0] : data.files[i].path);
  const indexes = data.files.map((_f, i) => i);
  const labels = (list) => list.map((i) => data.files[i].label);
  const touched = indexes.filter((i) => data.last[i] === true);
  const rest = indexes.filter((i) => data.last[i] !== true);
  assert.ok(touched.length > 0,
    'в фикстуре последний коммит не тронул ни одной колонки — проверять нечего');
  assert.deepEqual(heads, labels(touched.concat(rest)),
    'колонки идут не так: сперва те, что тронул последний коммит, затем остальные в порядке настроек');

  /* The same on a live choice: the reader switches a file off, and the order has to stay the same
   * — or it would depend on how many files are on. */
  const last = touched[touched.length - 1];
  toggleBox(doc, fileBox(doc, where(last)), false);
  assert.deepEqual(headers(doc), labels(touched.slice(0, -1).concat(rest)),
    'выключение файла сдвинуло порядок колонок');
});

test('страница самодостаточна и несёт данные контракта', () => {
  assert.equal(/https?:\/\//.test(pageText), false,
    'в странице есть внешняя ссылка: без сети она не откроется');
  assert.equal(/<link|<img|src=/.test(pageText), false, 'страница тянет что-то со стороны');

  /* One file and three tags: two with data and the program. The program is pasted exactly as the
   * engine hands it over and without the module syntax: the page opens from disk rather than from
   * a server, and nothing there can resolve `import`. */
  assert.equal((pageText.match(/<script/g) || []).length, 3,
    'в странице не три тега script: вклейка изменилась, и файлов могло стать больше одного');

  /* No ability of the page touches the network: the memory and the link are the browser rather
   * than a request. The check is by names (an external link may be absent while a call is
   * present), and it is literal: the word must not occur in the page even inside a comment — which
   * is why the sources say "dynamic import" in words. */
  ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'import('].forEach((api) => {
    assert.equal(pageText.indexOf(api), -1,
      'в странице появилось обращение к сети: ' + api + ' — так она не работает с диска');
  });
  assert.ok(pageText.indexOf('<script>\n' + pageScript() + '</script>') > 0,
    'программа страницы вклеена не целиком или не тем текстом, который отдаёт движок');
  assert.equal(/type="module"/.test(pageText), false, 'программа страницы объявлена модулем');

  const dom = new JSDOM(pageText);
  const embedded = JSON.parse(dom.window.document.getElementById('data').textContent);
  assert.deepEqual(embedded, pagePayload(data), 'в странице лежат не те данные, что отдаёт --data');

  /* What the file does not carry is said by code rather than by a comment: the list of skipped
   * commits changes with the report's own commit, so it cannot be in the file — the file would
   * stop being a fixed point and the hook would commit it forever (the hook's check is
   * `test/hook.test.js`). Outwards the list still goes: `--data` and `--json`. */
  assert.deepEqual(Object.keys(data).filter((key) => !(key in embedded)), ['skipped'],
    'из страницы пропало что-то, кроме объявленного в сборке (NOT_IN_FILE)');
});

test('страница считает то же, что артефакт, и пересчитывается по выбору', () => {
  const doc = openPage().window.document;
  const rows = doc.querySelectorAll('#grid tbody tr');
  assert.equal(rows.length, data.rows.length + 1,
    'в таблице ' + rows.length + ' строк вместо ' + (data.rows.length + 1) + ' (строки коммитов и «сейчас»)');

  assert.equal(rows[0].querySelectorAll('td').length, allCells(data), 'в строке «сейчас» не все колонки');
  const totalRaw = pageMath.totalsOf(data.now, ['raw'], allOn()).raw;
  assert.equal(nowTotal(doc), valueParts(totalRaw).text,
    'итог на странице не совпал с итогом артефакта: ' + nowTotal(doc));

  /* Switching the min metric off: its columns have to disappear while raw stays the same. */
  const minBox = metricBox(doc);
  assert.notEqual(minBox, undefined, 'в панели нет переключателя метрики min');
  toggleBox(doc, minBox, false);

  const afterRows = doc.querySelectorAll('#grid tbody tr');
  assert.equal(afterRows.length, data.rows.length + 1, 'таблица перестала строиться');
  assert.equal(afterRows[0].querySelectorAll('td').length, data.files.length + 1,
    'выключенная метрика осталась в таблице');
  assert.equal(nowTotal(doc), valueParts(totalRaw).text, 'выключение метрики сдвинуло чужой итог');

  /* Switching a file off: it leaves the table, and the total drops by exactly it. */
  const fileIndex = data.files.findIndex((f) => f.path === 'src/code.js');
  const box = fileBox(doc, 'src/code.js');
  assert.notEqual(box, undefined, 'в панели нет переключателя файла src/code.js');
  toggleBox(doc, box, false);

  assert.equal(nowCells(doc), data.files.length, 'выключенный файл остался в таблице');
  const expected = totalRaw - data.now[fileIndex].raw;
  assert.equal(nowTotal(doc), valueParts(expected).text,
    'итог после выключения файла не совпал с суммой без него');
});

/* A row's cells: first the total per metric, then a block per file, a metric in each. A file's
 * place comes from the table's header rather than from its number in the settings: the last
 * commit's columns stand first, so the settings' order is no longer the table's. */
const cellsOf = (tr) => [...tr.querySelectorAll('td')];
const at = (doc, tr, file, mi) => cellsOf(tr)
  [(headers(doc).indexOf(data.files[file].label) + 1) * data.metrics.length + mi];
const total = (tr, mi) => cellsOf(tr)[mi];
const headers = (doc) => [...doc.querySelectorAll('#grid thead tr')[0].querySelectorAll('th')]
  .map((th) => th.textContent).slice(2);

/* Precision on the page: an approximate cell is underlined and explained in words, an exact one is
 * left alone, and the total's mark is the worst of the files summed into it (a sum cannot promise
 * accuracy its terms do not have). The page takes the marks from the engine's data, so the number
 * of marked cells is compared with the row of marks the engine handed over rather than with the
 * markup. */
test('приближённые клетки помечены, а итог берёт худшее из включённых', () => {
  const doc = openPage().window.document;
  const ui = JSON.parse(doc.getElementById('ui').textContent);
  const first = () => doc.querySelectorAll('#grid tbody tr')[0];

  /* The page's marks are exactly the engine's marks, cell by cell, and the total's mark follows
   * its terms. */
  data.metrics.forEach((m, mi) => {
    const marks = data.approx[m.key];
    const ones = marks === undefined ? 0 : (marks.now.match(/1/g) || []).length;
    let marked = 0;
    data.files.forEach((_f, i) => { if (at(doc, first(), i, mi).classList.contains('approx')) marked++; });
    assert.equal(marked, ones,
      'метрика «' + m.key + '»: помечено ' + marked + ' клеток вместо ' + ones);
    assert.equal(total(first(), mi).classList.contains('approx'), ones > 0,
      'знак итога метрики «' + m.key + '» разошёлся с её слагаемыми');
  });

  /* A mixed fixture: an exact cell is unmarked, an approximate one is marked and names the way its
   * number was obtained. */
  const md = data.files.findIndex((f) => f.label === 'заметки.md');
  const json = data.files.findIndex((f) => f.label === 'package.json');
  const minAt = data.metrics.findIndex((m) => m.key === 'min');
  const min = data.metrics[minAt];
  assert.equal(at(doc, first(), json, minAt).classList.contains('approx'), false,
    'точная клетка помечена приближением');
  assert.equal(at(doc, first(), md, minAt).classList.contains('approx'), true,
    'приближённая клетка не помечена: точность метрики до клетки не доехала');
  assert.equal(at(doc, first(), md, minAt).title, ui.approxCell + min.method,
    'пометка клетки не называет способ, которым получено число');

  /* The way and the precision are visible in the panel as text rather than only in a tooltip: the
   * dictionary and the minifier are chosen by the run's settings, and the reader has nothing on the
   * page to switch them with. */
  const about = [...doc.querySelectorAll('#panel .about')].map((p) => p.textContent);
  assert.equal(about.length, data.metrics.length, 'под метриками нет подписи способа');
  assert.ok(about.some((line) => line.indexOf(min.method) >= 0),
    'способ метрики min назван не тот: ' + about.join(' | '));
  /* No legend under the file tree: it took the room beside the numbers, while its meaning belongs
   * to what it explains — the colour names a number's sign, the way and the precision stand under
   * the switches, and the skip mark is in a cell's tooltip. */
  assert.equal(doc.querySelectorAll('#panel .legend').length, 0,
    'под деревом файлов снова завелась расшифровка: место у чисел, а смысл — у клеток');

  /* The total is recounted by the choice: leave one exact file, and the mark comes off the total.
   * Otherwise "the worst of those on" would be said but not done. */
  const box = (f) => fileBox(doc, f.path === null ? f.paths[0] : f.path);
  data.files.forEach((f, i) => { if (i !== json) toggleBox(doc, box(f), false); });
  assert.equal(total(first(), minAt).classList.contains('approx'), false,
    'итог остался приближённым, хотя все слагаемые точные');
  assert.equal(cellsOf(first()).filter((td) => td.classList.contains('approx')).length, 0,
    'с точными слагаемыми остались помеченные клетки');
});

/* Styling: the table's shared part is carried into the page verbatim and is frozen by the bytes of
 * the artifact, while the delta colour is set once. Checked against the files and the assembled
 * page rather than on trust: a second set of styles or a second delta colour is exactly what makes
 * two reports of one history look different. */
test('оформление таблицы одно на оба вывода, и цвет дельт задан в одном месте', () => {
  assert.ok(pageText.indexOf(TABLE_CSS) > 0, 'страница не несёт общую часть оформления дословно');
  assert.equal(pageText.indexOf(TABLE_CSS), pageText.lastIndexOf(TABLE_CSS),
    'общая часть оформления вклеена в страницу дважды');
  assert.ok(pageText.indexOf(PAGE_CSS) > 0, 'страница собрана не из своего оформления');

  /* The page's own styling must bring no rules for what the shared part already sets, or it is a
   * second set of the same table. The list of shared selectors comes from the shared part itself
   * rather than being copied here, so a rule added there is guarded here. The exception is the
   * adaptations to a narrow window: there the divergence is deliberate (the shared part is frozen
   * by the artifact's bytes) and has to sit inside `@media`, which is why `@media` blocks drop out
   * of the comparison. */
  const own = fs.readFileSync(path.join(ROOT, 'src', 'page', 'app.css'), 'utf8')
    .replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
  const heads = (css) => [...css.matchAll(/(?:^|\})\s*([^{}@]+)\{/g)].map((m) => m[1].trim());
  const clash = heads(own).filter((head) => heads(TABLE_CSS).indexOf(head) >= 0);
  assert.deepEqual(clash, [],
    'своё оформление страницы повторило правила общей части: ' + clash.join(' | '));

  // The delta colour: the pair of values lives in the shared part, and the sheets carry no others.
  const hex = (text) => [...text.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
  assert.deepEqual([...new Set(hex(TABLE_CSS))].sort(), ['#1e8449', '#c0392b'],
    'соглашение о цвете дельт изменилось — его надо записать заново (src/css.js)');
  assert.deepEqual(hex(PAGE_CSS), [],
    'оформление страницы завело свой цвет: цвет дельт должен быть один на пакет');
  hex(TABLE_CSS).forEach((color) => assert.equal(pageText.split(color).length - 1, 1,
    'цвет ' + color + ' встречается в странице не один раз: он уехал из общей части'));

  // No legend swatches are left in the styling, while the category row sticks: as long as the list
  // needs scrolling, scrolling it and keeping that row in sight are one and the same.
  assert.equal(pageText.indexOf('.swatch'), -1, 'в оформлении страницы остались образцы расшифровки');
  assert.match(pageText, /\.panel \.cats\s*\{[^}]*position:\s*sticky/,
    'строка категорий не остаётся на виду, когда листается список файлов');
});

/* Empty states: with no metrics there is nothing to assemble a table from, so the page says so in
 * words rather than showing a grid without columns; with no files the overall total is left, and
 * that is said too. Neither state may leave a `colspan="0"` behind. */
test('состояния пустоты: без метрик — слова вместо сетки, без файлов — только общий объём', () => {
  const doc = openPage().window.document;
  const ui = JSON.parse(doc.getElementById('ui').textContent);
  const inputs = panelInputs(doc);
  const metricsOn = [...doc.querySelectorAll('#panel .box.metric input')];

  metricsOn.forEach((b) => toggleBox(doc, b, false));
  assert.equal(doc.getElementById('state').hidden, false,
    'без метрик страница молчит вместо того, чтобы объяснить пустоту');
  assert.equal(doc.getElementById('state').textContent, ui.empty, 'объяснение пустоты не то');
  assert.equal(doc.getElementById('shell').hidden, true, 'сетка без метрик осталась на виду');
  assert.equal(doc.querySelectorAll('#grid tbody tr').length, 0, 'таблица без метрик всё ещё строится');
  assert.equal(doc.querySelectorAll('[colspan="0"]').length, 0, 'в разметке остался colspan="0"');

  metricsOn.forEach((b) => toggleBox(doc, b, true));
  inputs.filter((b) => metricsOn.indexOf(b) < 0).forEach((b) => toggleBox(doc, b, false));
  assert.equal(doc.getElementById('shell').hidden, false, 'сетка пропала, хотя метрики выбраны');
  assert.equal(doc.getElementById('state').textContent, ui.noFiles, 'про пустой выбор файлов не сказано');
  const onlyTotal = doc.querySelectorAll('#grid tbody tr');
  assert.equal(onlyTotal.length, data.rows.length + 1, 'без файлов таблица перестала строиться');
  assert.equal(onlyTotal[0].querySelectorAll('td').length, data.metrics.length,
    'с выключенными файлами в строке остались чужие колонки');
  assert.equal(doc.querySelectorAll('[colspan="0"]').length, 0, 'в разметке остался colspan="0"');
});

/* The panel's switches as the keyboard sees them: the input lies inside its label (one target for
 * mouse and keyboard) and is reachable with Tab, while a full rebuild of the panel must not take
 * the focus — or every switch would start with walking the panel again. */
test('переключатели панели: одна цель нажатия и фокус, который не теряется', () => {
  const doc = openPage().window.document;
  const inputs = () => panelInputs(doc);
  const first = inputs();

  first.forEach((b) => {
    const label = b.closest('label');
    assert.ok(label && label.querySelector('input') === b,
      'переключатель вне метки: подпись и поле — две разные цели нажатия');
    assert.equal(b.tabIndex, 0, 'переключатель недостижим с клавиатуры');
  });

  inputs()[2].focus();
  assert.equal(doc.activeElement, inputs()[2], 'фокус не встал на переключатель');
  toggleBox(doc, inputs()[2], false);
  assert.equal(inputs().length, first.length, 'пересборка панели изменила набор переключателей');
  assert.equal(doc.activeElement, inputs()[2],
    'после пересборки панели фокус потерян: клавиатура начинает обход заново');
});

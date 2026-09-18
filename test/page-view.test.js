/* The report page — what a person reads: one self-contained file that opens from disk, counts with the engine's own
 * calculation and recounts by the reader's choice.
 *
 * Checked against the assembled output in a real DOM (jsdom) rather than against a description: the pasted program is the
 * engine's calculation first, with no module syntax and no comment, and the shell has grown no calculating function of its
 * own; the file is self-contained and carries the contract data; switching a metric or a file recounts the grid and the
 * total; the page marks no cell and judges no number; the styling is the shared part squeezed, its delta colour set once;
 * the empty states say what they are; a click is one target that does not take the focus.
 *
 * The page's table is a window of the grid now (`src/page/table.js`), so what belongs to the window — what is built, how
 * far it reaches, the geometry the styling and the script share — is a suite of its own (`page-grid`), and the columns
 * are `page-cols`. This file reads the page as a whole: the choice applied to it, whichever window stands in it.
 *
 * Neighbouring suites, split by subject rather than by size: the file tree and the panel — `page-tree`; the memory of a
 * choice and the link — `page-choice`; the contract itself and its derived values — `contract-data` and
 * `contract-derived`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cellParts, pageScript, stripModules, valueParts } from '../src/size-table.js';
import { PAGE_KEYS, PAGE_PARTS, pagePayload, squeezedCss, squeezedJs } from '../src/page/build.js';
import { PAGE_CSS, TABLE_CSS } from '../src/css.js';
import { ROOT } from '../tools/harness.js';
import {
  allCells, catInput, derivedSrc, dirInput, fileBox, gridRows, metricBox, metricTitle, nowCells, nowRow, nowTotal,
  pageBlock, pageMath, pageReady, panelInputs, rowNumbers, toggleBox, where
} from '../tools/page-harness.js';

const { data, pageText, openPage } = pageReady('view');

/* The page's program is assembled from the sources on disk (the list of chapters comes from the builder itself),
 * and the checks below read those very files: what the page carries is compared with what the repository holds
 * rather than with what the engine says about itself. */
const appSrc = PAGE_PARTS
  .map((part) => fs.readFileSync(path.join(ROOT, 'src', 'page', part.slice(2)), 'utf8'))
  .join('');

const allOn = () => data.files.map(() => true);

/* A second, independent calculation must not appear quietly: the page gets the calculation's text
 * from the engine itself, and the shell may only build nodes — its own totals, deltas or formatting
 * would already be that second calculation. */
test('the computational part of the page is the engine’s code, not a copy', () => {
  const script = pageScript();
  // A declaration starts a line in both forms; `async` is part of the form rather than decoration (see `appUnpack`).
  const defined = (src) => [...src.matchAll(/^[ \t]*(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1]);

  // The page carries exactly the text of two files (with the module syntax stripped).
  assert.deepEqual(defined(script).sort(), defined(stripModules(derivedSrc))
    .concat(defined(stripModules(appSrc))).sort(),
  'the page program holds a function that is not from its own sources');
  assert.equal(script.indexOf(squeezedJs(stripModules(derivedSrc))), 0,
    'the page program does not start with the shared computation');
  assert.equal(/^\s*(import|export)\s/m.test(script), false,
    'module syntax is left in the pasted program: a page on disk will not resolve it');
  /* The module syntax is stripped line by line, so a multi-line `import` would leave a
   * `} from '…'` tail in the page — a line nothing resembles — and the page would break silently
   * and whole. Hence the module name is looked for rather than a line start: this same breakage
   * must not have a second shape. */
  assert.equal(/from\s+['"]/.test(script), false,
    'a tail of an import is left in the pasted program: an import has to be a single line');
  assert.ok(pageText.indexOf(script) > 0, 'the page is not assembled from the shared program');

  // The promise of the paste: no comment reaches the artifact. Counted by syntax — `/*` and a line starting `//`.
  const comments = (text) => (text.match(/\/\*/g) || []).length
    + text.split('\n').filter((l) => /^\s*\/\//.test(l)).length;
  assert.equal(comments(script), 0, 'a comment survived into the pasted program: the squeeze is not applied');

  /* The shell's list of functions is closed: a new one is either markup or a calculation that came
   * back by its own road; the first is fixed here, the second is better not to do at all. The
   * chapters are read as they reach the page — with the module syntax stripped. */
  assert.deepEqual(defined('\n' + stripModules(appSrc)).sort(), [
    'appAll', 'appApply', 'appBegin', 'appBoot', 'appBox', 'appBytes', 'appCaption', 'appCatOf', 'appCatState',
    'appCell', 'appCells', 'appChanged', 'appCommit', 'appCounts', 'appDecode', 'appDir', 'appDirHead', 'appDirPath',
    'appDirState', 'appEl', 'appFileAt', 'appFileBox', 'appFirst', 'appFoldBox', 'appFoldRead',
    'appFoldSet', 'appHead', 'appHeadNew', 'appJoined', 'appKeep', 'appLeaf', 'appLeafAt', 'appLeaves',
    'appLinkRead', 'appLinkUse', 'appList', 'appLoad', 'appName', 'appNode', 'appNotice',
    'appNum', 'appOffBox', 'appOrder', 'appPaint', 'appPanel', 'appPanelAll', 'appPanelState',
    'appPlace', 'appRank', 'appReach', 'appRead', 'appRecord', 'appRecordOk', 'appRow',
    'appRowBoxes', 'appRowOf', 'appSpan', 'appState', 'appStep', 'appStrip', 'appSub', 'appSweep', 'appSwitch',
    'appSwitchGroup',
    'appSwitchMetric', 'appTable', 'appText', 'appTree', 'appTreeList', 'appUnknown', 'appUnmeasuredBox',
    'appUnpack', 'appUnroll', 'appValue', 'appWindow', 'appWrite'
  ], 'the page’s shell started a function of its own: the computation has to live in the computational part');
  /* The parts are pasted into one scope, so a name declared twice does not collide loudly: the later declaration wins
   * and the earlier one is never called. The sorted lists above cannot see that, hence the count beside them. */
  const names = defined(script);
  assert.equal(new Set(names).size, names.length,
    'two of the page’s parts declare one and the same function: in one scope the later one wins in silence');
  assert.equal(/\breduce\(|Math\.abs/.test(appSrc), false,
    'the page’s shell computes totals or the delta sign itself');
  ['rowModel', 'nowModel', 'commitParts', 'cellParts', 'valueParts'].forEach((name) => {
    assert.ok(appSrc.indexOf(name + '(') >= 0, 'the page’s shell does not use ' + name);
  });
});

test('the page is self-contained and carries the contract’s data', () => {
  assert.equal(/https?:\/\//.test(pageText), false,
    'the page holds an external reference: without a network it will not open');
  assert.equal(/<link|<img|src=/.test(pageText), false, 'the page pulls something from outside');

  /* One file and three tags: two with data and the program. The program is pasted exactly as the engine hands it
   * over (module syntax and comments squeezed out): the page opens from disk, where nothing can resolve `import`. */
  assert.equal((pageText.match(/<script/g) || []).length, 3,
    'the page does not hold three script tags: the pasting changed, and there could be more than one file');

  /* No ability of the page touches the network: checked by names (an external link may be absent while a call is
   * present) and literally — the word must not occur at all, which the sources answer by saying “dynamic import”. */
  ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'import('].forEach((api) => {
    assert.equal(pageText.indexOf(api), -1,
      'a network call appeared in the page: ' + api + ' — that way it does not work from disk');
  });
  assert.ok(pageText.indexOf('<script>\n' + pageScript() + '</script>') > 0,
    'the page program is pasted not in full or not as the text the engine hands out');
  assert.equal(/type="module"/.test(pageText), false, 'the page program is declared a module');

  // The data tag is read the way the page reads it, so that a build that stopped packing shows up here too.
  const embedded = pageBlock(pageText);
  assert.deepEqual(embedded, pagePayload(data), 'the page holds data other than what --data hands out');

  /* The block is the contract in sparse form (`src/page/payload.js`) rather than the contract: its fields are a
   * closed list, and `schema: 2` marks the block's own form. The skipped commits are absent as before — that list
   * changes with the report's own commit, so the file would stop being a fixed point (outwards it still goes, in
   * `--data` and `--json`). */
  assert.deepEqual(Object.keys(embedded), PAGE_KEYS,
    'the sparse block’s fields diverged from the declared shape');
  assert.equal(embedded.schema, 2, 'the page carries the contract itself rather than the sparse block');
});

test('the page counts the same as the artifact and recounts by the choice', async () => {
  const doc = (await openPage()).window.document;
  const totalRaw = pageMath.totalsOf(data.now, ['raw'], allOn()).raw;

  assert.equal(nowCells(doc), allCells(data), 'the “now” row does not hold every column');
  assert.equal(nowTotal(doc), valueParts(totalRaw).text,
    'the total on the page did not match the artifact total: ' + nowTotal(doc));

  /* Switching the min metric off: its columns leave the window, while raw stays the same. */
  const rawOnly = data.metrics.filter((m) => m.key !== 'min');
  toggleBox(doc, metricBox(doc), false);
  assert.equal(nowCells(doc), allCells(data, rawOnly), 'a switched-off metric stayed in the window');
  assert.equal(nowTotal(doc), valueParts(totalRaw).text, 'switching a metric off moved the total of others');

  /* Switching a file off: it leaves the window, and the total drops by exactly it. The file is named the way the panel
   * names it (`where`), which is its path at HEAD, or the last of the settings where it is gone from there. */
  const fileIndex = data.files.findIndex((f) => where(f) === 'src/code.js');
  toggleBox(doc, fileBox(doc, 'src/code.js'), false);
  assert.equal(nowCells(doc), data.files.length * rawOnly.length,
    'a switched-off file stayed in the window');
  const expected = totalRaw - data.now[fileIndex].raw;
  assert.equal(nowTotal(doc), valueParts(expected).text,
    'the total after the file was switched off did not match the sum without it');
});

/* A choice the page never painted as a whole — the min metric off, a folder and a category off — is the one place where
 * the grid's own arithmetic could part from the shared calculation, so every total of every row of the window is held
 * against `rowModel` over the same set of files rather than against a paraphrase of it. The metric is switched off on
 * purpose: a total of a metric that is not shown is still a total, and the comparison says so. */
test('every total of the window is the sum of the choice, for a choice never painted whole', async () => {
  const doc = (await openPage()).window.document;
  const off = data.files.map((_f, i) => i)
    .filter((i) => where(data.files[i]).indexOf('src/') === 0 || data.files[i].category === 'chore');
  assert.ok(off.length > 0, 'the fixture has not a single file to switch off — there is nothing to check');
  const on = data.files.map((_f, i) => off.indexOf(i) < 0);
  const cat = data.categories.find((c) => c.key === 'chore');

  toggleBox(doc, metricBox(doc), false);
  toggleBox(doc, dirInput(doc, 'src/'), false);
  toggleBox(doc, catInput(doc, cat), false);
  const keys = data.metrics.map((m) => m.key).filter((k) => k !== 'min');

  const now = pageMath.totalsOf(data.now, keys, on);
  keys.forEach((key, mi) => assert.equal(rowNumbers(nowRow(doc))[mi], valueParts(now[key]).text,
    'the “now” row is not the sum of the choice for ' + key));
  gridRows(doc).forEach((row, r) => {
    /* The first row of the grid is the state at HEAD, which the check above holds; the rows below it are the commits,
     * newest first — the same order the contract keeps, read from its end. */
    if (r === 0) return;
    const i = data.rows.length - r;
    const model = pageMath.rowModel(data.rows[i].values, i === 0 ? null : data.rows[i - 1].values, keys, on);
    const nums = rowNumbers(row);
    model.total.forEach((cell, mi) => assert.equal(nums[mi], cellParts(cell.value, cell.delta, '−').text,
      'the total of commit ' + i + ' for ' + keys[mi] + ' is not the sum of the choice'));
  });
});

/* How a number was obtained is not the page's business: it prints the method the engine handed over and keeps no rule of
 * its own, so there is no mark on a cell, no tooltip built from a metric and no word of precision in the page's
 * dictionary. Checked against the assembled page rather than on trust: a rule of precision left in the markup would be
 * the page's second answer about one and the same number. */
test('the page marks no cell and judges no number, while the method stands in the panel', async () => {
  const doc = (await openPage()).window.document;
  const ui = JSON.parse(doc.getElementById('ui').textContent);

  ['exact', 'approximate', 'approxCell'].forEach((key) => {
    assert.equal(Object.prototype.hasOwnProperty.call(ui, key), false,
      'the page’s dictionary still holds the word “' + key + '”');
  });
  assert.equal(doc.querySelectorAll('#grid .approx').length, 0,
    'a cell is still marked by a rule of precision');
  const first = rowNumbers(nowRow(doc));
  assert.equal(first.length, allCells(data), 'the first row of the window does not hold every column');
  assert.equal(gridRows(doc).filter((row) => [...row.querySelectorAll('.cells > span')]
    .some((span) => span.hasAttribute('title'))).length, 0,
  'a cell explains a number the page did not count');

  /* What a metric is and how it was counted is told in the tooltip of its own switch: the dictionary and the minifier
   * come from the run's settings, and the box is where the reader looks. */
  const metricTitles = data.metrics.map((m) => metricTitle(doc, m.label));
  assert.equal(metricTitles.length, data.metrics.length, 'a metric has no tooltip of its own');
  data.metrics.forEach((m, i) => {
    assert.ok(metricTitles[i].indexOf(m.method) >= 0,
      'the method of the metric ' + m.key + ' is not in the tooltip of its own switch: ' + metricTitles[i]);
    assert.ok(metricTitles[i].indexOf(m.note) >= 0,
      'what the metric ' + m.key + ' is is not in the tooltip of its own switch: ' + metricTitles[i]);
  });
  assert.equal(doc.querySelectorAll('#panel .about').length, 0,
    'the lines under the switches are back: the way of counting lives in the tooltip of the box');
  /* No legend under the file tree: it took the room beside the numbers, while its meaning belongs to what it explains —
   * the colour names a number's sign, the way of counting stands under the switches, and the mark of a gap lives in the
   * cell's own text. */
  assert.equal(doc.querySelectorAll('#panel .legend').length, 0,
    'a legend appeared under the file tree again: numbers live there, and meaning lives in the cells');
});

/* Styling: the table's shared part is carried into the page squeezed and is frozen by the bytes of the artifact, while the
 * delta colour is set once. Checked against the files and the assembled page rather than on trust: a second set of styles
 * or a second delta colour is exactly what makes two reports of one history look different. The squeeze is on the way in,
 * not in the file — `src/table.css` stays the readable source a person edits. */
test('the table’s styling is one for both outputs, and the delta colour is set in one place', () => {
  const tableCss = squeezedCss(TABLE_CSS);
  const pageCss = squeezedCss(PAGE_CSS);
  assert.notEqual(tableCss, TABLE_CSS, 'the page carries the styling file itself: the squeeze is not applied');
  assert.equal(tableCss.split('/*').length, 1, 'a comment survived into the pasted styling');
  assert.ok(pageText.indexOf(tableCss) > 0, 'the page does not carry the shared part of the styling squeezed');
  assert.equal(pageText.indexOf(tableCss), pageText.lastIndexOf(tableCss),
    'the shared part of the styling is pasted into the page twice');
  assert.ok(pageText.indexOf(pageCss) > 0, 'the page is not assembled from its own styling');

  /* The page's own styling must bring no rules for what the shared part already sets, or it is a second set of the same
   * table. The list of shared selectors comes from the shared part itself rather than being copied here, so a rule added
   * there is guarded here. The exception is the adaptations to a narrow window: there the divergence is deliberate (the
   * shared part is frozen by the artifact's bytes) and has to sit inside `@media`, which is why `@media` blocks drop out
   * of the comparison. */
  const own = fs.readFileSync(path.join(ROOT, 'src', 'page', 'app.css'), 'utf8')
    .replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
  const heads = (css) => [...css.matchAll(/(?:^|\})\s*([^{}@]+)\{/g)].map((m) => m[1].trim());
  const clash = heads(own).filter((head) => heads(TABLE_CSS).indexOf(head) >= 0);
  assert.deepEqual(clash, [],
    'the page’s own styling repeated rules of the shared part: ' + clash.join(' | '));

  // The delta colour: the pair of values lives in the shared part, and the sheets carry no others.
  const hex = (text) => [...text.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
  assert.deepEqual([...new Set(hex(TABLE_CSS))].sort(), ['#1e8449', '#c0392b'],
    'the delta colour convention changed — it has to be recorded anew (src/css.js)');
  assert.deepEqual(hex(PAGE_CSS), [],
    'the page’s styling started a colour of its own: the delta colour has to be one per package');
  hex(TABLE_CSS).forEach((color) => assert.equal(pageText.split(color).length - 1, 1,
    'the colour ' + color + ' occurs in the page more than once: it left the shared part'));

  // Every rule of the shared part is the table's: the page's own rules must not be caught by it (`#grid` is the border).
  assert.match(pageText, /#grid\s*\{[^}]*--col:/, 'the shared part lost the geometry of the window');
  assert.equal(pageText.indexOf('.swatch'), -1, 'samples of the legend stayed in the page’s styling');
  assert.match(pageText, /\.panel \.cats\s*\{[^}]*position:\s*sticky/,
    'the row of categories does not stay in view when the file list is scrolled');
});

/* Empty states: with no metrics there is nothing to assemble a window from, so the page says so in words rather than
 * showing a grid without columns; with no files the overall total is left, and that is said too. The window is built as
 * the choice asks (a column that is off is not built at all), so an empty choice yields an empty window rather than a
 * markup nothing hides. */
test('empty states: without metrics words instead of a grid, without files only the total', async () => {
  const doc = (await openPage()).window.document;
  const ui = JSON.parse(doc.getElementById('ui').textContent);
  const inputs = panelInputs(doc);
  const metricsOn = [...doc.querySelectorAll('#panel .box.metric input')];

  metricsOn.forEach((b) => toggleBox(doc, b, false));
  assert.equal(doc.getElementById('state').hidden, false,
    'without metrics the page stays silent instead of explaining the emptiness');
  assert.equal(doc.getElementById('state').textContent, ui.empty, 'the explanation of the emptiness is not the one');
  assert.equal(doc.getElementById('shell').hidden, true, 'the grid without metrics stayed in view');
  assert.equal(gridRows(doc).length, 0, 'rows are built although no metric is chosen: they have no columns');
  assert.equal(doc.querySelectorAll('#grid .hmetrics > span').length, 0,
    'captions of metrics stand over a window with no columns');

  metricsOn.forEach((b) => toggleBox(doc, b, true));
  inputs.filter((b) => metricsOn.indexOf(b) < 0).forEach((b) => toggleBox(doc, b, false));
  assert.equal(doc.getElementById('shell').hidden, false, 'the grid disappeared although metrics are chosen');
  assert.equal(doc.getElementById('state').textContent, ui.noFiles, 'nothing was said about an empty choice of files');
  assert.equal(gridRows(doc).length, data.rows.length + 1, 'without files the window stopped being built');
  assert.equal(nowCells(doc), data.metrics.length,
    'with every file switched off, columns of others stayed in the row');
});

/* The panel's switches as the keyboard sees them: the input lies inside its label (one target for mouse and
 * keyboard) and is reachable with Tab, while a click must leave the field that had the keyboard where it was. */
test('the panel’s switches: one click target and a focus that is not lost', async () => {
  const doc = (await openPage()).window.document;
  const inputs = () => panelInputs(doc);
  const first = inputs();
  const cat = data.categories.find((c) => c.key === 'chore');

  first.forEach((b) => {
    const label = b.closest('label');
    assert.ok(label && label.querySelector('input') === b,
      'a switch outside the label: the caption and the field are two different click targets');
    assert.equal(b.tabIndex, 0, 'the switch is out of reach from the keyboard');
  });

  /* Every kind of switch, not only the metric: the field that had the keyboard keeps it, and it keeps it as the very
   * node rather than by being found again by its ordinal number among `#panel input` — which is how a redraw used to put
   * the focus back, and what makes a walk with `Tab` and `Space` start from the beginning otherwise. */
  const kinds = [
    ['метрика', metricBox(doc)],
    ['файл', fileBox(doc, 'src/code.js')],
    ['папка', dirInput(doc, 'src/')],
    ['категория', catInput(doc, cat)]
  ];
  kinds.forEach(([what, box]) => {
    /* The switch is put back where it was: a group is switched per file, and a half-switched panel would leave the next
     * kind of switch checking something other than the state every file began in. */
    const was = box.checked;
    box.focus();
    assert.equal(doc.activeElement, box, 'поле не получило клавиатуру');
    toggleBox(doc, box, !was);
    assert.equal(doc.activeElement, box,
      'после переключения «' + what + '» клавиатура потеряна: поле приходится искать заново');
    assert.equal(inputs().length, first.length, 'набор переключателей изменился после «' + what + '»');
    toggleBox(doc, box, was);
  });
  assert.equal(nowCells(doc), allCells(data), 'the switches back and forth left the window incomplete');
});

/* The step that was measured and not built, with its measurement kept where the styling is read. `content-visibility:
 * auto` is not honoured on a table row in this Chrome (153: a page of 200 `<tr>` in a scroll container reports 0 skipped,
 * while 200 plain `<div>` in the same box report 138), so a declaration here would be dead bytes in a report that
 * measures its own bytes — the answer was to build less (`src/page/table.js` says what was measured, and
 * `probes/archive/step-12-columns.mjs` how).
 *
 * What is read is the styling **with its comments taken out** (`squeezedCss`, the same stripping the paste into the page
 * uses), so writing the reason down in `src/table.css` — the natural thing to do — does not redden this. A browser that
 * starts honouring the property on a plain grid is the reason to delete the check; `probes/archive/step-10-tables.mjs` is how
 * that is settled. */
test('the styling declares no content-visibility: the property is dead where it was tried', () => {
  [['the shared', TABLE_CSS], ['the page’s own', PAGE_CSS]].forEach(([what, css]) => {
    assert.equal(/content-visibility\s*:/.test(squeezedCss(css)), false,
      what + ' styling declares content-visibility: Chrome 153 does not honour it here, so re-measure before it is '
      + 'added (probes/archive/step-10-tables.mjs) rather than shipping a promise nothing keeps');
  });
});

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
test('the computational part of the page is the engine’s code, not a copy', () => {
  const script = pageScript();
  const defined = (src) => [...src.matchAll(/\nfunction\s+(\w+)/g)].map((m) => m[1]);

  // The page carries exactly the text of two files (with the module syntax stripped).
  assert.deepEqual(defined(script).sort(), defined(stripModules(derivedSrc))
    .concat(defined(stripModules(appSrc))).sort(),
  'the page program holds a function that is not from its own sources');
  assert.equal(script.indexOf(stripModules(derivedSrc)), 0,
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
  ], 'the page’s shell started a function of its own: the computation has to live in the computational part');
  assert.equal(/\breduce\(|Math\.abs/.test(appSrc), false,
    'the page’s shell computes totals or the delta sign itself');
  ['rowModel', 'nowModel', 'commitParts', 'cellParts', 'valueParts'].forEach((name) => {
    assert.ok(appSrc.indexOf(name + '(') >= 0, 'the page’s shell does not use ' + name);
  });
});

/* The order of columns is about the reader rather than about numbers: the report is rebuilt after
 * every commit, and the first question is what this edit brought. So the columns the last commit
 * touched stand first, in the order of the settings, and the rest follow, in that same order. The
 * check reads this off the header, which is where the reader sees it. */
test('the columns of the last commit come before the rest, while the settings’ order holds', () => {
  const doc = openPage().window.document;
  // The first two header cells are not columns: the commit's caption and the overall total.
  const heads = headers(doc);
  const where = (i) => (data.files[i].path === null ? data.files[i].paths[0] : data.files[i].path);
  const indexes = data.files.map((_f, i) => i);
  const labels = (list) => list.map((i) => data.files[i].label);
  const touched = indexes.filter((i) => data.last[i] === true);
  const rest = indexes.filter((i) => data.last[i] !== true);
  assert.ok(touched.length > 0,
    'in the fixture the last commit touched no column — there is nothing to check');
  assert.deepEqual(heads, labels(touched.concat(rest)),
    'the columns come in the wrong order: first those the last commit touched, then the rest in the settings’ order');

  /* The same on a live choice: the reader switches a file off, and the order has to stay the same
   * — or it would depend on how many files are on. */
  const last = touched[touched.length - 1];
  toggleBox(doc, fileBox(doc, where(last)), false);
  assert.deepEqual(headers(doc), labels(touched.slice(0, -1).concat(rest)),
    'switching a file off moved the order of the columns');
});

test('the page is self-contained and carries the contract’s data', () => {
  assert.equal(/https?:\/\//.test(pageText), false,
    'the page holds an external reference: without a network it will not open');
  assert.equal(/<link|<img|src=/.test(pageText), false, 'the page pulls something from outside');

  /* One file and three tags: two with data and the program. The program is pasted exactly as the
   * engine hands it over and without the module syntax: the page opens from disk rather than from
   * a server, and nothing there can resolve `import`. */
  assert.equal((pageText.match(/<script/g) || []).length, 3,
    'the page does not hold three script tags: the pasting changed, and there could be more than one file');

  /* No ability of the page touches the network: the memory and the link are the browser rather
   * than a request. The check is by names (an external link may be absent while a call is
   * present), and it is literal: the word must not occur in the page even inside a comment — which
   * is why the sources say "dynamic import" in words. */
  ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'import('].forEach((api) => {
    assert.equal(pageText.indexOf(api), -1,
      'a network call appeared in the page: ' + api + ' — that way it does not work from disk');
  });
  assert.ok(pageText.indexOf('<script>\n' + pageScript() + '</script>') > 0,
    'the page program is pasted not in full or not as the text the engine hands out');
  assert.equal(/type="module"/.test(pageText), false, 'the page program is declared a module');

  const dom = new JSDOM(pageText);
  const embedded = JSON.parse(dom.window.document.getElementById('data').textContent);
  assert.deepEqual(embedded, pagePayload(data), 'the page holds data other than what --data hands out');

  /* What the file does not carry is said by code rather than by a comment: the list of skipped
   * commits changes with the report's own commit, so it cannot be in the file — the file would
   * stop being a fixed point and the hook would commit it forever (the hook's check is
   * `test/hook.test.js`). Outwards the list still goes: `--data` and `--json`. */
  assert.deepEqual(Object.keys(data).filter((key) => !(key in embedded)), ['skipped'],
    'something besides what the assembly declares (NOT_IN_FILE) disappeared from the page');
});

test('the page counts the same as the artifact and recounts by the choice', () => {
  const doc = openPage().window.document;
  const rows = doc.querySelectorAll('#grid tbody tr');
  assert.equal(rows.length, data.rows.length + 1,
    'the table holds ' + rows.length + ' rows instead of ' + (data.rows.length + 1) + ' (rows of commits and “now”)');

  assert.equal(rows[0].querySelectorAll('td').length, allCells(data), 'the “now” row does not hold every column');
  const totalRaw = pageMath.totalsOf(data.now, ['raw'], allOn()).raw;
  assert.equal(nowTotal(doc), valueParts(totalRaw).text,
    'the total on the page did not match the artifact total: ' + nowTotal(doc));

  /* Switching the min metric off: its columns have to disappear while raw stays the same. */
  const minBox = metricBox(doc);
  assert.notEqual(minBox, undefined, 'the panel has no switch for the metric min');
  toggleBox(doc, minBox, false);

  const afterRows = doc.querySelectorAll('#grid tbody tr');
  assert.equal(afterRows.length, data.rows.length + 1, 'the table stopped being built');
  assert.equal(afterRows[0].querySelectorAll('td').length, data.files.length + 1,
    'a switched-off metric stayed in the table');
  assert.equal(nowTotal(doc), valueParts(totalRaw).text, 'switching a metric off moved the total of others');

  /* Switching a file off: it leaves the table, and the total drops by exactly it. */
  const fileIndex = data.files.findIndex((f) => f.path === 'src/code.js');
  const box = fileBox(doc, 'src/code.js');
  assert.notEqual(box, undefined, 'the panel has no switch for the file src/code.js');
  toggleBox(doc, box, false);

  assert.equal(nowCells(doc), data.files.length, 'a switched-off file stayed in the table');
  const expected = totalRaw - data.now[fileIndex].raw;
  assert.equal(nowTotal(doc), valueParts(expected).text,
    'the total after the file was switched off did not match the sum without it');
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
test('approximate cells are marked, and the total takes the worst of those switched on', () => {
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
      'metric “' + m.key + '”: ' + marked + ' cells are marked instead of ' + ones);
    assert.equal(total(first(), mi).classList.contains('approx'), ones > 0,
      'the mark of the total of metric “' + m.key + '” diverged from its summands');
  });

  /* A mixed fixture: an exact cell is unmarked, an approximate one is marked and names the way its
   * number was obtained. */
  const md = data.files.findIndex((f) => f.label === 'заметки.md');
  const json = data.files.findIndex((f) => f.label === 'package.json');
  const minAt = data.metrics.findIndex((m) => m.key === 'min');
  const min = data.metrics[minAt];
  assert.equal(at(doc, first(), json, minAt).classList.contains('approx'), false,
    'an exact cell is marked as an approximation');
  assert.equal(at(doc, first(), md, minAt).classList.contains('approx'), true,
    'an approximate cell is not marked: the metric’s accuracy did not reach the cell');
  assert.equal(at(doc, first(), md, minAt).title, ui.approxCell + min.method,
    'the cell’s mark does not name the method by which the number was obtained');

  /* The way and the precision are visible in the panel as text rather than only in a tooltip: the
   * dictionary and the minifier are chosen by the run's settings, and the reader has nothing on the
   * page to switch them with. */
  const about = [...doc.querySelectorAll('#panel .about')].map((p) => p.textContent);
  assert.equal(about.length, data.metrics.length, 'there is no caption of the method under the metrics');
  assert.ok(about.some((line) => line.indexOf(min.method) >= 0),
    'the method of the metric min is not the one: ' + about.join(' | '));
  /* No legend under the file tree: it took the room beside the numbers, while its meaning belongs
   * to what it explains — the colour names a number's sign, the way and the precision stand under
   * the switches, and the skip mark is in a cell's tooltip. */
  assert.equal(doc.querySelectorAll('#panel .legend').length, 0,
    'a legend appeared under the file tree again: numbers live there, and meaning lives in the cells');

  /* The total is recounted by the choice: leave one exact file, and the mark comes off the total.
   * Otherwise "the worst of those on" would be said but not done. */
  const box = (f) => fileBox(doc, f.path === null ? f.paths[0] : f.path);
  data.files.forEach((f, i) => { if (i !== json) toggleBox(doc, box(f), false); });
  assert.equal(total(first(), minAt).classList.contains('approx'), false,
    'the total stayed approximate although every summand is exact');
  assert.equal(cellsOf(first()).filter((td) => td.classList.contains('approx')).length, 0,
    'marked cells stayed beside exact summands');
});

/* Styling: the table's shared part is carried into the page verbatim and is frozen by the bytes of
 * the artifact, while the delta colour is set once. Checked against the files and the assembled
 * page rather than on trust: a second set of styles or a second delta colour is exactly what makes
 * two reports of one history look different. */
test('the table’s styling is one for both outputs, and the delta colour is set in one place', () => {
  assert.ok(pageText.indexOf(TABLE_CSS) > 0, 'the page does not carry the shared part of the styling verbatim');
  assert.equal(pageText.indexOf(TABLE_CSS), pageText.lastIndexOf(TABLE_CSS),
    'the shared part of the styling is pasted into the page twice');
  assert.ok(pageText.indexOf(PAGE_CSS) > 0, 'the page is not assembled from its own styling');

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
    'the page’s own styling repeated rules of the shared part: ' + clash.join(' | '));

  // The delta colour: the pair of values lives in the shared part, and the sheets carry no others.
  const hex = (text) => [...text.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
  assert.deepEqual([...new Set(hex(TABLE_CSS))].sort(), ['#1e8449', '#c0392b'],
    'the delta colour convention changed — it has to be recorded anew (src/css.js)');
  assert.deepEqual(hex(PAGE_CSS), [],
    'the page’s styling started a colour of its own: the delta colour has to be one per package');
  hex(TABLE_CSS).forEach((color) => assert.equal(pageText.split(color).length - 1, 1,
    'the colour ' + color + ' occurs in the page more than once: it left the shared part'));

  // No legend swatches are left in the styling, while the category row sticks: as long as the list
  // needs scrolling, scrolling it and keeping that row in sight are one and the same.
  assert.equal(pageText.indexOf('.swatch'), -1, 'samples of the legend stayed in the page’s styling');
  assert.match(pageText, /\.panel \.cats\s*\{[^}]*position:\s*sticky/,
    'the row of categories does not stay in view when the file list is scrolled');
});

/* Empty states: with no metrics there is nothing to assemble a table from, so the page says so in
 * words rather than showing a grid without columns; with no files the overall total is left, and
 * that is said too. Neither state may leave a `colspan="0"` behind. */
test('empty states: without metrics words instead of a grid, without files only the total', () => {
  const doc = openPage().window.document;
  const ui = JSON.parse(doc.getElementById('ui').textContent);
  const inputs = panelInputs(doc);
  const metricsOn = [...doc.querySelectorAll('#panel .box.metric input')];

  metricsOn.forEach((b) => toggleBox(doc, b, false));
  assert.equal(doc.getElementById('state').hidden, false,
    'without metrics the page stays silent instead of explaining the emptiness');
  assert.equal(doc.getElementById('state').textContent, ui.empty, 'the explanation of the emptiness is not the one');
  assert.equal(doc.getElementById('shell').hidden, true, 'the grid without metrics stayed in view');
  assert.equal(doc.querySelectorAll('#grid tbody tr').length, 0, 'the table is still built without metrics');
  assert.equal(doc.querySelectorAll('[colspan="0"]').length, 0, 'colspan="0" is left in the markup');

  metricsOn.forEach((b) => toggleBox(doc, b, true));
  inputs.filter((b) => metricsOn.indexOf(b) < 0).forEach((b) => toggleBox(doc, b, false));
  assert.equal(doc.getElementById('shell').hidden, false, 'the grid disappeared although metrics are chosen');
  assert.equal(doc.getElementById('state').textContent, ui.noFiles, 'nothing was said about an empty choice of files');
  const onlyTotal = doc.querySelectorAll('#grid tbody tr');
  assert.equal(onlyTotal.length, data.rows.length + 1, 'without files the table stopped being built');
  assert.equal(onlyTotal[0].querySelectorAll('td').length, data.metrics.length,
    'with every file switched off, columns of others stayed in the row');
  assert.equal(doc.querySelectorAll('[colspan="0"]').length, 0, 'colspan="0" is left in the markup');
});

/* The panel's switches as the keyboard sees them: the input lies inside its label (one target for
 * mouse and keyboard) and is reachable with Tab, while a full rebuild of the panel must not take
 * the focus — or every switch would start with walking the panel again. */
test('the panel’s switches: one click target and a focus that is not lost', () => {
  const doc = openPage().window.document;
  const inputs = () => panelInputs(doc);
  const first = inputs();

  first.forEach((b) => {
    const label = b.closest('label');
    assert.ok(label && label.querySelector('input') === b,
      'a switch outside the label: the caption and the field are two different click targets');
    assert.equal(b.tabIndex, 0, 'the switch is out of reach from the keyboard');
  });

  inputs()[2].focus();
  assert.equal(doc.activeElement, inputs()[2], 'the focus did not land on the switch');
  toggleBox(doc, inputs()[2], false);
  assert.equal(inputs().length, first.length, 'the panel’s rebuild changed the set of switches');
  assert.equal(doc.activeElement, inputs()[2],
    'the focus is lost after the panel’s rebuild: the keyboard starts its walk again');
});

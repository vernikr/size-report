/* The promise that **the version in `CHANGELOG.md` is the one in the manifest, and the "what will
 * change in the numbers" section is a measurement rather than a retelling**.
 *
 * The defect class is the same as for the other guards (`tools/docs-facts.js`): a document asserts what
 * the repository does not have. For a release that costs more than for an instruction: the promise
 * "your numbers will not move" is read before an update, and the numbers table ages in silence — the
 * numbers are changed by the next edit of a sensor rather than by the release. So the table is held
 * against a live run of the tool on the fixture: as many columns, the same labels and the same values,
 * and the total row equal to the sum of the rows.
 *
 * What stays with a person, said out loud: the wording of the causes ("why the number moved"), the
 * completeness of the "what is in it" list and the truth of promises about the future are beyond the
 * check; it guards the mechanics, not the meaning.
 *
 * The `min` numbers with `esbuild` and `tok` are reproducible where the optional dependencies (the
 * minifier and the dictionary) are in place: without them the tool honestly counts by simplification and
 * by estimate — other numbers, marked as an approximation. In that case the check says so in words
 * rather than staying silent: `test/minify.test.js` and `test/tokens.test.js` hold the same seam from the
 * engine's side.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG, ROOT, cloneFixture, readJson, runSize, tempDir } from '../tools/harness.js';

const tmp = tempDir('changelog');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const TEXT = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const manifest = readJson(path.join(ROOT, 'package.json'));

/* The top release of the file: from its heading to the next heading of the same level. */
function release() {
  const head = TEXT.match(/^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})$/m);
  assert.notEqual(head, null, 'в CHANGELOG нет строки выпуска вида «## 1.0.0 — 2026-09-14»');
  const from = TEXT.slice(head.index);
  const next = from.slice(1).search(/^## /m);
  return { version: head[1], date: head[2], text: next < 0 ? from : from.slice(0, next + 1) };
}

/* The release's numbers table: a label and four values — `raw`, `min` under stripping, `min` under
 * compression, tokens. It is parsed rather than read by eye: otherwise there would be nothing to check
 * against. */
function numbersTable() {
  const section = TEXT.match(/^### Что изменится в числах$[\s\S]*?(?=\n#{2,3} |(?![\s\S]))/m);
  assert.notEqual(section, null, 'в CHANGELOG нет раздела «Что изменится в числах» — выпуск не отвечает,'
    + ' у кого числа поедут и почему');
  const rows = [];
  section[0].split('\n').forEach((line) => {
    if (line.indexOf('|') !== 0) return;
    const cells = line.split('|').slice(1, -1).map((c) => c.replace(/\*\*/g, '').trim());
    if (cells.length !== 5 || cells[0] === 'Файл' || /^-+$/.test(cells[0])) return;
    const nums = cells.slice(1).map(Number);
    assert.ok(nums.every((n) => Number.isInteger(n) && n >= 0),
      'строка «' + cells[0] + '»: числа не разобрались (' + cells.slice(1).join(' ') + ')');
    rows.push({ label: cells[0], nums: nums });
  });
  assert.ok(rows.length > 1, 'таблица чисел выпуска не разобралась');
  return rows;
}

/* The settings of the measurement: the history and the columns are the reference ones, and only the
 * metrics and the minification way change. Otherwise the release's numbers would be compared with the
 * wrong fixture. */
function configAs(name, metrics, engine) {
  const cfg = readJson(CONFIG);
  cfg.metrics = metrics;
  cfg.minify = { engine: engine, ext: {}, guard: ['.js', '.mjs', '.cjs'] };
  if (metrics.indexOf('tok') >= 0) cfg.tokens = { family: 'openai', encoding: 'o200k_base' };
  const file = path.join(tmp, name + '.json');
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  return file;
}

/* The state at the fixture's tip: what a column shows now. */
function nowState(dir, cfgFile, what) {
  const res = runSize(dir, ['--config', cfgFile, '--data']);
  assert.equal(res.code, 0, what + ': инструмент не отдал данные (код ' + res.code + '): '
    + res.stderr.trim() + '\n  код 4 значит, что минификатора или словаря в установке нет:'
    + ' тогда числа выпуска этой установкой не воспроизводятся');
  const data = JSON.parse(res.stdout);
  return data.files.map((file, i) => ({
    label: file.label,
    cells: ['raw', 'min', 'tok'].map((key) => (data.now[i] === null ? null : data.now[i][key]))
  }));
}

test('версия выпуска в CHANGELOG — версия пакета, и у выпуска названы его числа', () => {
  const top = release();
  assert.equal(top.version, manifest.version,
    'CHANGELOG рассказывает про ' + top.version + ', а в манифесте ' + manifest.version
      + ' — установка по тегу дала бы не то, что описано');
  assert.match(top.text, /^### Что изменится в числах$/m,
    'у выпуска ' + top.version + ' нет раздела про числа: обновляющийся не узнает, что поедет');
});

test('числа выпуска совпадают с прогоном на фикстуре', () => {
  const rows = numbersTable();
  const dir = cloneFixture(path.join(tmp, 'fix'));
  const strip = nowState(dir, configAs('strip', ['raw', 'min'], 'strip'), 'упрощение');
  const full = nowState(dir, configAs('full', ['raw', 'min', 'tok'], 'esbuild'), 'сжатие и токены');

  assert.deepEqual(rows.map((r) => r.label), strip.map((f) => f.label).concat(['ИТОГО']),
    'таблица выпуска называет не те колонки, что фикстура (или называет их в другом порядке)');

  const total = [0, 0, 0, 0];
  rows.slice(0, -1).forEach((row, i) => {
    // The minifier's and the dictionary's columns are counted from the same cells of the same history:
    // one number per cut is expected — `raw`, simplification, compression, tokens. An empty column (the
    // file is absent at HEAD) is four zeros rather than a reason to skip the row.
    const want = [strip[i].cells[0] || 0, strip[i].cells[1] || 0,
      full[i].cells[1] || 0, full[i].cells[2] || 0];
    assert.deepEqual(row.nums, want, 'числа выпуска для «' + row.label + '» разошлись'
      + ' с прогоном: в CHANGELOG ' + row.nums.join(' / ') + ', у инструмента ' + want.join(' / '));
    want.forEach((n, k) => { total[k] += n; });
  });
  assert.deepEqual(rows[rows.length - 1].nums, total,
    'строка итога не равна сумме строк: в CHANGELOG ' + rows[rows.length - 1].nums.join(' / ')
      + ', по строкам ' + total.join(' / '));
  assert.ok(total[2] <= total[1] && total[3] > 0,
    'итог не подтверждает сказанное в выпуске: сжатие должно быть не больше упрощения,'
      + ' а токены — считаться (получено ' + total.join(' / ') + ')');
});

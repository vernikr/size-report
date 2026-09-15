/* Шестое обещание документации, и оно про выпуск: **версия в `CHANGELOG.md` — та,
 * что в манифесте, а раздел «Что изменится в числах» не пересказ, а замер**.
 *
 * Класс дефекта здесь тот же, что у остальных сторожей (`tools/docs-facts.js`):
 * документ утверждает то, чего в репозитории нет. Для выпуска это дороже, чем для
 * инструкции: обещание «у вас числа не поедут» читают перед обновлением, и таблица
 * чисел стареет молча — числа меняет не выпуск, а следующая правка датчика. Поэтому
 * таблица сверяется с живым прогоном инструмента на фикстуре: столько же колонок,
 * те же метки и те же значения, а строка итога — сумма строк.
 *
 * Что остаётся человеку, и это названо: формулировки причин («почему число
 * поехало»), полнота списка «что вошло» и верность обещаний на будущее — проверке
 * недоступны; механику она стережёт, смысл — нет.
 *
 * Числа `min` с `esbuild` и `tok` воспроизводятся там, где необязательные
 * зависимости (минификатор и словарь) на месте: без них инструмент честно считает
 * упрощением и оценкой — другими числами, помеченными приближением. Проверка в этом
 * случае говорит это словами, а не молчит: `test/minify.test.js`, `test/tokens.test.js`
 * держат тот же шов со стороны движка.
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

/* Верхний выпуск в файле: от его заголовка до следующего заголовка того же уровня. */
function release() {
  const head = TEXT.match(/^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})$/m);
  assert.notEqual(head, null, 'в CHANGELOG нет строки выпуска вида «## 1.0.0 — 2026-09-14»');
  const from = TEXT.slice(head.index);
  const next = from.slice(1).search(/^## /m);
  return { version: head[1], date: head[2], text: next < 0 ? from : from.slice(0, next + 1) };
}

/* Таблица чисел выпуска: метка и четыре значения — raw, min со strip, min со сжатием,
 * токены. Разбирается она, а не читается глазами: иначе сверять было бы нечего. */
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

/* Настройки замера: история и колонки — эталонные, меняются только метрики и способ
 * минификации. Иначе числа выпуска сравнивались бы не с той фикстурой. */
function configAs(name, metrics, engine) {
  const cfg = readJson(CONFIG);
  cfg.metrics = metrics;
  cfg.minify = { engine: engine, ext: {}, guard: ['.js', '.mjs', '.cjs'] };
  if (metrics.indexOf('tok') >= 0) cfg.tokens = { family: 'openai', encoding: 'o200k_base' };
  const file = path.join(tmp, name + '.json');
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  return file;
}

/* Состояние на верхушке фикстуры: то, что колонка показывает сейчас. */
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
    // Колонки минификатора и словаря считаются теми же клетками той же истории: ждём
    // по одному числу на разрез — `raw`, упрощение, сжатие, токены. Пустая колонка
    // (файла нет на HEAD) — четыре нуля, а не повод пропустить строку.
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

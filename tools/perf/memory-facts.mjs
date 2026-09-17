// Из чего складывается память страницы: JS-куча данных, состав DOM и площадь раскладки.
// Chrome здесь недоступен, поэтому память DOM и площадь краски — расчётные оценки,
// а куча и состав узлов — замер. Запуск: node --expose-gc tools/perf/memory-facts.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const text = fs.readFileSync(path.join(ROOT, 'docs', 'size-report.html'), 'utf8');
const OPEN = '<script type="application/json" id="data">';
const raw = text.slice(text.indexOf(OPEN) + OPEN.length, text.indexOf('</scr' + 'ipt>', text.indexOf(OPEN)));
const out = [];
const say = (s) => { out.push(s); console.log(s); };
const MB = (n) => (n / 1048576).toFixed(1) + ' МБ';

const heap = () => { global.gc(); global.gc(); return process.memoryUsage().heapUsed; };

// --- 1. Куча: три представления одних и тех же чисел ---
say('== JS-куча: сколько стоят числа (замер в Node) ==');
let h0 = heap();
const data = JSON.parse(raw.replace(/\\u003c/g, '<'));
const h1 = heap();
say(`  JSON.parse текущих данных: ${MB(h1 - h0)}`);

const R = data.rows.length;
const F = data.files.length;
const M = data.metrics.length;
const KEYS = data.metrics.map((m) => m.key);

h0 = heap();
const dense = [];
for (let r = 0; r < R; r++) {
  const row = [];
  for (let i = 0; i < F; i++) {
    const v = data.rows[r].values[i];
    row.push(v === null ? null : { raw: v.raw, min: v.min, tok: v.tok });
  }
  dense.push(row);
}
const h2 = heap();
say(`  копия плотной модели объектами ({raw,min,tok} на клетку): ${MB(h2 - h0)}`);

h0 = heap();
const cols = KEYS.map(() => new Int32Array(R * F));
const exists = new Uint8Array(R * F);
for (let r = 0; r < R; r++) {
  for (let i = 0; i < F; i++) {
    const v = data.rows[r].values[i];
    if (v === null) continue;
    const o = r * F + i;
    exists[o] = 1;
    for (let m = 0; m < M; m++) cols[m][o] = v[KEYS[m]];
  }
}
const h3 = heap();
say(`  те же числа колонками в typed arrays: ${MB(h3 - h0)}`);

h0 = heap();
const uniq = new Map();
for (let r = 0; r < R; r++) for (let i = 0; i < F; i++) {
  const v = data.rows[r].values[i];
  if (v === null) continue;
  const k = v.raw + ',' + v.min + ',' + v.tok;
  if (!uniq.has(k)) uniq.set(k, [v.raw, v.min, v.tok]);
}
const dict = [...uniq.values()];
const ref = new Int32Array(R * F).fill(-1);
const idOf = new Map(uniq);
let id = 0;
for (const k of uniq.keys()) { idOf.set(k, id++); }
for (let r = 0; r < R; r++) for (let i = 0; i < F; i++) {
  const v = data.rows[r].values[i];
  if (v === null) continue;
  ref[r * F + i] = idOf.get(v.raw + ',' + v.min + ',' + v.tok);
}
const h4 = heap();
say(`  словарь из ${dict.length} троек + ссылки: ${MB(h4 - h0)}`);

// --- 2. Состав DOM: сколько узлов и какие ---
say('');
say('== состав таблицы: из чего состоит 170 759 клеток ==');
let empty = 0, dash = 0, withSpan = 0, approxTitles = 0;
const approxRows = data.approx && data.approx.min ? data.approx.min.rows : null;
for (let r = 0; r < R; r++) {
  const prev = r === 0 ? null : data.rows[r - 1].values;
  for (let i = 0; i < F; i++) {
    const v = data.rows[r].values[i];
    for (let m = 0; m < M; m++) {
      if (v === null) { dash++; continue; }
      const was = prev === null || prev[i] === null ? null : prev[i][KEYS[m]];
      const d = was === null ? v[KEYS[m]] : v[KEYS[m]] - was;
      if (!d) empty++; else withSpan++;
    }
  }
  if (approxRows) for (let i = 0; i < F; i++) if (approxRows[r * F + i] === '1') approxTitles += M;
}
say(`  клетки «без изменений» (пустые, без текстового узла): ${empty}`);
say(`  клетки «—» (файла нет в ревизии, текстовый узел): ${dash}`);
say(`  клетки с числом (текстовый узел + span.delta): ${withSpan}`);
say(`  клеток с атрибутом title из-за признака точности: ${approxTitles}`);
say(`  итого текстовых узлов в теле: ~${dash + withSpan * 2}, span.delta: ${withSpan}`);

const stickyHead = 1 + 1 + F + M + F * M;   // thead: обе строки целиком
say('');
say('== липкие элементы (position: sticky) ==');
say(`  th шапки (table.css:7 — top: 0 / top: 22px): ${stickyHead}`);
say(`  th колонки коммита (table.css:15 — left: 0): ${R + 1 + 2}`);
say(`  всего липких элементов: ${stickyHead + R + 3}`);

// --- 3. Площадь раскладки ---
say('');
say('== площадь таблицы в пикселях (оценка по содержимому) ==');
const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
const charPx = 7.5;   // цифра в 12.5px с tabular-nums
const padPx = 14;     // padding: 2px 7px по горизонтали
let totalNumPx = 0;
let widestCol = 0;
for (let i = 0; i < F; i++) {
  let colPx = 0;
  for (let m = 0; m < M; m++) {
    let w = 3 * charPx;   // подпись «raw»/«min»/«tok» во второй строке шапки
    for (let r = 0; r < R; r++) {
      const v = data.rows[r].values[i];
      if (v === null) continue;
      const prev = r === 0 ? null : data.rows[r - 1].values[i];
      const was = prev === null ? null : prev[KEYS[m]];
      const d = was === null ? v[KEYS[m]] : v[KEYS[m]] - was;
      if (!d) continue;
      const len = group(Math.abs(d)).length + 1;   // знак
      w = Math.max(w, len * charPx);
    }
    const labelPx = data.files[i].label.length * 6.5 / M;   // метка растянута на 3 колонки
    colPx += Math.max(w + padPx, labelPx);
  }
  totalNumPx += colPx;
  widestCol = Math.max(widestCol, colPx);
}
const clipPx = 300;
const widthPx = clipPx + totalNumPx;
const rowPx = 25;                    // line-height 20 + padding 4 + граница
const heightPx = (R + 1 + 2) * rowPx;
const surface = widthPx * heightPx;
say(`  ширина: колонка коммита ${clipPx} px + ${F}×${M} числовых = ${Math.round(widthPx)} px`);
say(`  высота: ${R + 3} строк × ${rowPx} px = ${Math.round(heightPx)} px`);
say(`  самая широкая колонка файла (3 метрики): ${Math.round(widestCol)} px`);
say(`  площадь таблицы: ${(surface / 1e6).toFixed(0)} млн px`);
say(`  растр такой площади в 4 байта/px: ${MB(surface * 4)} на один слой`);
say(`  оценка памяти DOM (500–900 байт на узел × 177 163 узла): 85–160 МБ`);

fs.writeFileSync(path.join(ROOT, 'reports', 'memory-facts.txt'), out.join('\n') + '\n');

// --- 4. Сколько ширины задаёт содержимое, а сколько — метки ---
say('');
say('== ширина: содержимое против меток ==');
let contentPx = 0, labelPxTotal = 0;
const labels = [];
for (let i = 0; i < F; i++) {
  let byContent = 0, byLabel = 0;
  for (let m = 0; m < M; m++) {
    let w = 3 * charPx;
    for (let r = 0; r < R; r++) {
      const v = data.rows[r].values[i];
      if (v === null) continue;
      const prev = r === 0 ? null : data.rows[r - 1].values[i];
      const was = prev === null ? null : prev[KEYS[m]];
      const d = was === null ? v[KEYS[m]] : v[KEYS[m]] - was;
      if (!d) continue;
      w = Math.max(w, (group(Math.abs(d)).length + 1) * charPx);
    }
    byContent += w + padPx;
  }
  const lbl = data.files[i].label.length * 6.5;
  byLabel = Math.max(byContent, lbl);
  labels.push([data.files[i].label.length, data.files[i].label]);
  contentPx += byContent;
  labelPxTotal += byLabel - byContent;
}
say(`  ширина от содержимого клеток: ${Math.round(contentPx)} px (+ колонка коммита ${clipPx})`);
say(`  добавка от длинных меток (nowrap в шапке): ${Math.round(labelPxTotal)} px`);
say(`  если меткам разрешить перенос: ${(clipPx + contentPx).toFixed(0)} px вместо ${Math.round(widthPx)} px`);
const area2 = (clipPx + contentPx) * heightPx;
say(`  площадь тогда: ${(area2 / 1e6).toFixed(0)} млн px, растр ${MB(area2 * 4)}`);
labels.sort((a, b) => b[0] - a[0]);
say(`  самые длинные метки: ${labels.slice(0, 5).map((x) => x[1] + ' (' + x[0] + ')').join(', ')}`);

// --- 5. Куча: честный пересчёт каждого представления ---
say('');
say('== JS-куча: пересчёт в изоляции (heapUsed + external) ==');
const total = () => { const m = process.memoryUsage(); return m.heapUsed + m.external; };
const keep = [];
const measure = (label, build) => {
  global.gc(); global.gc();
  const a = total();
  const built = build();
  keep.push(built);            // удерживаем, иначе сборщик съест результат до замера
  global.gc(); global.gc();
  const b = total();
  say(`  ${label}: ${MB(b - a)}`);
};
measure('плотная модель объектами', () => {
  const arr = [];
  for (let r = 0; r < R; r++) {
    const row = [];
    for (let i = 0; i < F; i++) {
      const v = data.rows[r].values[i];
      row.push(v === null ? null : { raw: v.raw, min: v.min, tok: v.tok });
    }
    arr.push(row);
  }
  return arr;
});
measure('колонки в typed arrays', () => {
  const c = KEYS.map(() => new Int32Array(R * F));
  const e = new Uint8Array(R * F);
  return [c, e];
});
measure('словарь троек + Int32Array ссылок', () => {
  const m = new Map();
  for (let r = 0; r < R; r++) for (let i = 0; i < F; i++) {
    const v = data.rows[r].values[i];
    if (v !== null && !m.has(v.raw + ',' + v.min + ',' + v.tok)) m.set(v.raw + ',' + v.min + ',' + v.tok, 1);
  }
  const d = [...m.keys()].map((k) => k.split(',').map(Number));
  return d;
});
say('  для сравнения: весь JSON-текст данных в памяти — ' + MB(raw.length * 2) + ' (UTF-16)');
fs.writeFileSync(path.join(ROOT, 'reports', 'memory-facts.txt'), out.join('\n') + '\n');

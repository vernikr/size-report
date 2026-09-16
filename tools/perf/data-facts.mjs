// Замер фактов о payload страницы: сколько весит каждый блок, сколько в данных шума.
// Читает собранный артефакт (docs/size-report.html) и печатает числа, на которые
// опираются предложения по весу файла. Запуск: node tools/perf/data-facts.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'docs', 'size-report.html'));
const text = html.toString('utf8');

const grab = (open, close) => {
  const i = text.indexOf(open);
  const j = text.indexOf(close, i);
  return text.slice(i + open.length, j);
};
const DATA_OPEN = '<script type="application/json" id="data">';
const UI_OPEN = '<script type="application/json" id="ui">';
const raw = grab(DATA_OPEN, '</script>');
const ui = grab(UI_OPEN, '</script>');
const css = grab('<style>', '</style>');
// последний <script> без атрибутов — программа страницы
const progOpen = text.lastIndexOf('<script>');
const prog = text.slice(progOpen + '<script>'.length, text.indexOf('</script>', progOpen));

const data = JSON.parse(raw.replace(/\\u003c/g, '<'));
const R = data.rows.length;
const F = data.files.length;
const b = (s) => Buffer.byteLength(s, 'utf8');
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

const out = [];
const say = (s) => out.push(s);

say('== артефакт ==');
say(`файл: ${html.length} байт (${(html.length / 1024).toFixed(0)} KiB)`);
const parts = [
  ['данные #data', b(raw)],
  ['программа', b(prog)],
  ['CSS', b(css)],
  ['словарь #ui', b(ui)]
];
let rest = html.length;
for (const [, n] of parts) rest -= n;
for (const [name, n] of parts) say(`  ${name}: ${n} байт (${(100 * n / html.length).toFixed(1)} %)`);
say(`  оболочка + разметка: ${rest} байт (${(100 * rest / html.length).toFixed(1)} %)`);

say('');
say('== блок данных по ключам ==');
const sizeOf = (v) => b(JSON.stringify(v));
let sum = 0;
for (const k of Object.keys(data)) {
  const n = sizeOf(data[k]);
  sum += n;
  say(`  ${k}: ${n} (${(100 * n / b(raw)).toFixed(1)} % данных)`);
}
say(`  (сумма значений ${sum} + ключи/запятые ${b(raw) - sum})`);

say('');
say('== сетка значений ==');
let filled = 0;
let nulls = 0;
const uniq = new Map();
for (let r = 0; r < R; r++) {
  const vals = data.rows[r].values;
  for (let i = 0; i < F; i++) {
    const v = vals[i];
    if (v === null) { nulls++; continue; }
    filled++;
    const key = v.raw + ',' + v.min + ',' + v.tok;
    uniq.set(key, (uniq.get(key) || 0) + 1);
  }
}
say(`строк ${R} × файлов ${F} = ${R * F} клеток`);
say(`непустых ${filled}, null ${nulls}`);
say(`уникальных троек {raw,min,tok}: ${uniq.size} (${(100 * uniq.size / filled).toFixed(1)} % от непустых)`);

// сколько клеток действительно меняется между соседними строками
let changed = 0;
for (let r = 1; r < R; r++) {
  const a = data.rows[r - 1].values;
  const c = data.rows[r].values;
  for (let i = 0; i < F; i++) {
    const x = a[i];
    const y = c[i];
    const kx = x === null ? 'n' : x.raw + ',' + x.min + ',' + x.tok;
    const ky = y === null ? 'n' : y.raw + ',' + y.min + ',' + y.tok;
    if (kx !== ky) changed++;
  }
}
say(`клеток, изменившихся относительно предыдущей строки: ${changed}`);
say(`изменений на строку в среднем: ${(changed / (R - 1)).toFixed(1)}`);

// события по файлу: сколько записей даст «история файла»
let histEntries = 0;
for (let i = 0; i < F; i++) {
  let prev = 'n';
  for (let r = 0; r < R; r++) {
    const v = data.rows[r].values[i];
    const k = v === null ? 'n' : v.raw + ',' + v.min + ',' + v.tok;
    if (k !== prev) { histEntries++; prev = k; }
  }
}
say(`записей в разреженной модели «история файла»: ${histEntries}`);

say('');
say('== approx ==');
if (data.approx) {
  for (const m of Object.keys(data.approx)) {
    const e = data.approx[m];
    say(`  метрика ${m}: rows ${b(JSON.stringify(e.rows))} байт, now ${b(JSON.stringify(e.now))} байт`);
    const ones = (s) => s.split('').filter((c) => c === '1').length;
    say(`    единиц в rows: ${ones(e.rows)} из ${e.rows.length}; в now: ${ones(e.now)} из ${e.now.length}`);
  }
} else say('  нет');

say('');
say('== now против последней строки ==');
const lastVals = data.rows[R - 1].values;
const sameNow = JSON.stringify(data.now) === JSON.stringify(lastVals);
say(`now === values последней строки: ${sameNow}`);
if (!sameNow) {
  let diff = 0;
  for (let i = 0; i < F; i++) if (JSON.stringify(data.now[i]) !== JSON.stringify(lastVals[i])) diff++;
  say(`  различающихся колонок: ${diff} из ${F}`);
}

say('');
say('== sha / href ==');
const withHref = data.rows.filter((r) => typeof r.href === 'string');
say(`строк с href: ${withHref.length} из ${R}`);
if (withHref.length) {
  const r0 = withHref[0];
  const full = data.rows[0].full || null;
  say(`  пример: sha="${r0.sha}" (длина ${r0.sha}), href="${r0.href}"`);
  say(`  ключи строки: ${Object.keys(r0).join(', ')}`);
  const prefix = r0.href.slice(0, r0.href.length - r0.sha.length);
  say(`  href = префикс + sha: ${r0.href === prefix + r0.sha} (префикс "${prefix}")`);
  say(`  общий префикс у всех href: ${withHref.every((r) => r.href.startsWith(prefix))}`);
  say(`  href оканчивается на sha у всех: ${withHref.every((r) => r.href.endsWith(r.sha))}`);
  if (full) say(`  full=${full}`);
}
say(`длина sha в строках: ${[...new Set(data.rows.map((r) => r.sha.length))].join(', ')}`);

say('');
say('== files ==');
let labelIsBase = 0;
for (const f of data.files) {
  const p = f.path === null ? (f.paths && f.paths[0]) : f.path;
  if (p && f.label === p.slice(p.lastIndexOf('/') + 1)) labelIsBase++;
}
say(`файлов ${F}; метка == basename пути: ${labelIsBase} (восстановимых из пути)`);
say(`ключи файла: ${Object.keys(data.files[0]).join(', ')}`);
say(`пример: ${JSON.stringify(data.files[0])}`);
const noPath = data.files.filter((f) => f.path === null).length;
say(`файлов без path (ушли из HEAD): ${noPath}`);
say(`суммарно путей в paths: ${data.files.reduce((a, f) => a + f.paths.length, 0)}`);

say('');
say('== catalog ==');
say(`записей: ${data.catalog.length}, вес ${sizeOf(data.catalog)}`);
const withWhy = data.catalog.filter((c) => c.why).length;
say(`с непустым why: ${withWhy}`);
const paths = new Set();
for (const f of data.files) { if (f.path) paths.add(f.path); for (const p of f.paths) paths.add(p); }
say(`записей каталога, совпадающих с путём колонки: ${data.catalog.filter((c) => paths.has(c.path)).length}`);

say('');
say('== last / metrics / categories ==');
say(`last: true у ${data.last.filter(Boolean).length} файлов`);
say(`метрики: ${data.metrics.map((m) => m.key).join(', ')}`);
say(`ключи метрики: ${Object.keys(data.metrics[0]).join(', ')}`);
say(`категории: ${data.categories.map((c) => c.key).join(', ')}`);
const byCat = {};
for (const f of data.files) byCat[f.category] = (byCat[f.category] || 0) + 1;
say(`файлов по категориям: ${JSON.stringify(byCat)}`);
say(`categoryBy: ${JSON.stringify(data.files.reduce((a, f) => { a[f.categoryBy] = (a[f.categoryBy] || 0) + 1; return a; }, {}))}`);

say('');
say('== сжатие и парсинг ==');
const gz = zlib.gzipSync(Buffer.from(raw), { level: 9 });
say(`данные как есть: ${kb(b(raw))}; gzip lvl9: ${kb(gz.length)}; base64(gzip): ${kb(gz.length * 4 / 3)}`);
let t = performance.now();
const again = JSON.parse(raw.replace(/\\u003c/g, '<'));
say(`JSON.parse данных: ${(performance.now() - t).toFixed(1)} мс (${again.rows.length} строк)`);
t = performance.now();
for (let k = 0; k < 5; k++) JSON.parse(raw.replace(/\\u003c/g, '<'));
say(`JSON.parse × 5: ${((performance.now() - t) / 5).toFixed(1)} мс в среднем`);

// комментарии в программе и CSS
const jsComments = (prog.match(/\/\*[\s\S]*?\*\//g) || []).reduce((a, s) => a + b(s), 0)
  + (prog.match(/^\s*\/\/.*$/gm) || []).reduce((a, s) => a + b(s), 0);
const cssComments = (css.match(/\/\*[\s\S]*?\*\//g) || []).reduce((a, s) => a + b(s), 0);
say('');
say('== комментарии в артефакте ==');
say(`программа: ${b(prog)} байт, из них блочных/строчных комментариев ~${jsComments} байт`);
say(`CSS: ${b(css)} байт, из них комментариев ~${cssComments} байт`);

fs.writeFileSync(path.join(ROOT, 'reports', 'data-facts.txt'), out.join('\n') + '\n');
console.log(out.join('\n'));

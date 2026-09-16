// Сколько весит программа и CSS артефакта сейчас и после каждого вида сжатия.
// Три приёма: только убрать комментарии (детерминированно, без внешних пакетов),
// минификация esbuild (необязательная зависимость проекта) и их сумма.
// Запуск: node tools/perf/asset-weight.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { transformSync } from 'esbuild';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const text = fs.readFileSync(path.join(ROOT, 'docs', 'size-report.html'), 'utf8');
const grab = (open, close) => {
  const i = text.indexOf(open);
  return text.slice(i + open.length, text.indexOf(close, i));
};
const progOpen = text.lastIndexOf('<script>');
const prog = text.slice(progOpen + '<script>'.length, text.indexOf('</script>', progOpen));
const css = grab('<style>', '</style>');

// Убрать комментарии так, как это сделал бы сборщик: блочные /* … */ и строчные // …
// (строковые литералы с «//» в проекте встречаются в ссылках, поэтому сначала блочные,
// затем строчные — по строкам, с проверкой, что «//» не внутри кавычек).
const stripComments = (src) => {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock.split('\n').map((line) => {
    let inS = null;
    for (let i = 0; i < line.length - 1; i++) {
      const c = line[i];
      if (inS) { if (c === inS && line[i - 1] !== '\\') inS = null; continue; }
      if (c === '"' || c === "'" || c === '`') { inS = c; continue; }
      if (c === '/' && line[i + 1] === '/') return line.slice(0, i).replace(/\s+$/, '');
    }
    return line;
  }).filter((l) => l.trim() !== '').join('\n');
};

const b = (s) => Buffer.byteLength(s, 'utf8');
const rows = [];
const add = (name, js, cs) => rows.push([name, b(js), b(cs), b(js) + b(cs)]);

add('сейчас', prog, css);
const progNC = stripComments(prog);
const cssNC = stripComments(css);
add('без комментариев', progNC, cssNC);
const progMin = transformSync(prog, { loader: 'js', minify: true, charset: 'utf8', legalComments: 'none' }).code;
const cssMin = transformSync(css, { loader: 'css', minify: true, charset: 'utf8', legalComments: 'none' }).code;
add('esbuild minify (полный)', progMin, cssMin);
add('без комментариев + esbuild', transformSync(progNC, { loader: 'js', minify: true, charset: 'utf8', legalComments: 'none' }).code,
  transformSync(cssNC, { loader: 'css', minify: true, charset: 'utf8', legalComments: 'none' }).code);

console.log('== программа + CSS в артефакте ==');
for (const [name, js, cs, sum] of rows) {
  console.log(`  ${name.padEnd(28)} JS ${(js / 1024).toFixed(1).padStart(6)} KB | CSS ${(cs / 1024).toFixed(1).padStart(6)} KB | вместе ${(sum / 1024).toFixed(1).padStart(6)} KB`);
}
const base = rows[0][3];
console.log('');
for (const [name, , , sum] of rows.slice(1)) {
  console.log(`  ${name}: −${((base - sum) / 1024).toFixed(1)} KB (−${(100 * (base - sum) / base).toFixed(0)} % от программы+CSS)`);
}
console.log('');
console.log('== проверка, что сжатие не меняет расчёт ==');
// Программа страницы трогает document при загрузке, поэтому сравниваем её расчётную часть:
// src/derived.js — тот же текст, который вклеивается в артефакт (stripModules снимает модульный синтаксис).
const { stripModules } = await import(path.join(ROOT, 'src', 'size-table.js'));
const derived = stripModules(fs.readFileSync(path.join(ROOT, 'src', 'derived.js'), 'utf8'));
const derivedMin = transformSync(derived, { loader: 'js', minify: true, charset: 'utf8', legalComments: 'none' }).code;
const data = JSON.parse(grab('<script type="application/json" id="data">', '</script>').replace(/\\u003c/g, '<'));
const run = (src) => new Function(src + '\nreturn { rowModel: rowModel, totalsOf: totalsOf, group: group, cellParts: cellParts };')();
const a = run(derived);
const c = run(derivedMin);
const on = new Array(data.files.length).fill(true);
const mk = data.metrics.map((m) => m.key);
let same = true;
let cells = 0;
for (let r = 0; r < data.rows.length && same; r++) {
  const prev = r === 0 ? null : data.rows[r - 1].values;
  const x = a.rowModel(data.rows[r].values, prev, mk, on);
  const y = c.rowModel(data.rows[r].values, prev, mk, on);
  if (JSON.stringify(x) !== JSON.stringify(y)) same = false;
  cells += data.files.length * mk.length;
}
console.log(`  derived.js: ${b(derived)} → ${b(derivedMin)} байт после esbuild`);
console.log(`  rowModel совпадает по всем ${data.rows.length} строкам (${cells} клеток): ${same}`);
console.log(`  group(1234567) до/после: "${a.group(1234567)}" / "${c.group(1234567)}"`);
console.log(`  cellParts(5, -3) до/после: ${JSON.stringify(a.cellParts(5, -3, '\u2212'))} / ${JSON.stringify(c.cellParts(5, -3, '\u2212'))}`);
console.log(`  gzip(программа без комментариев): ${(zlib.gzipSync(Buffer.from(progNC), { level: 9 }).length / 1024).toFixed(1)} KB`);

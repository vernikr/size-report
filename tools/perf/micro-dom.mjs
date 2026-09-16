// Микрозамер: из чего складывается стоимость точечных правок DOM в jsdom.
// Нужен, чтобы честно оценить «прячем, а не пересобираем»: сколько стоит одна операция.
// Запуск: node tools/perf/micro-dom.mjs
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const text = fs.readFileSync(path.join(ROOT, 'docs', 'size-report.html'), 'utf8');
const dom = new JSDOM(text, { url: 'https://report.invalid/size-report.html', runScripts: 'dangerously' });
const win = dom.window;
const doc = win.document;
const grid = doc.getElementById('grid');
const rows = [...grid.querySelectorAll('tbody tr')];
const say = (s) => console.log(s);

const bench = (label, n, fn) => {
  fn(0); // прогрев
  const t = performance.now();
  for (let k = 0; k < n; k++) fn(k);
  const dt = (performance.now() - t) / n;
  say(`  ${label}: ${dt.toFixed(4)} ms/операция (${n} повторов)`);
  return dt;
};

const td = rows[5].children[10];
say('== стоимость одной операции в jsdom ==');
bench('classList.toggle на одной клетке', 2000, (k) => td.classList.toggle('off', k % 2 === 0));
bench('textContent на одной клетке', 2000, (k) => { td.textContent = String(k); });
bench('чтение tr.children[i]', 2000, (k) => rows[k % rows.length].children[10].className);
bench('group() (формат числа)', 2000, (k) => win.group(1234567 + k));
bench('classList.toggle на корне таблицы (#grid)', 200, (k) => grid.classList.toggle('m0-off', k % 2 === 0));
bench('classList.toggle на <tbody>', 200, (k) => grid.tBodies[0].classList.toggle('m0-off', k % 2 === 0));

say('');
say('== сколько стоит спрятать колонку файла при разных приёмах ==');
const R = win.eval('appData').rows.length;
const F = win.eval('appData').files.length;

const byWalk = (i, off) => {
  for (const tr of rows) for (let m = 0; m < 3; m++) tr.children[4 + i * 3 + m].classList.toggle('off', off);
};
const refs = [];
for (const tr of rows) refs.push([tr.children[10], tr.children[11], tr.children[12]]);
const byRefs = (off) => {
  for (const c of refs) for (let m = 0; m < 3; m++) c[m].classList.toggle('off', off);
};
let t = performance.now();
byWalk(3, true);
say(`  обход tr.children, 1 файл (${rows.length * 3} клеток): ${(performance.now() - t).toFixed(1)} ms`);
t = performance.now();
byRefs(true);
say(`  заранее собранные ссылки, 1 файл (${rows.length * 3} клеток): ${(performance.now() - t).toFixed(1)} ms`);

say('');
say('== верхняя оценка для Chrome ==');
say(`  клеток в таблице ${grid.querySelectorAll('td, th').length}; в jsdom одна точечная правка — `
  + 'порядка 0.02–0.05 ms, в Chrome обычно на порядок-два дешевле (не измерялось здесь).');
say(`  строк тела ${rows.length}, файлов ${F}, всего клеток колонки файла ${rows.length * 3}`);

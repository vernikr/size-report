// Прототип «прячем, а не пересобираем» на живом DOM настоящего артефакта.
// Ссылки на клетки колонки собираются один раз при загрузке — без этого цена упирается
// в повторное чтение tr.children (см. tools/perf/micro-dom.mjs).
// Запуск: node tools/perf/proto-hide.mjs
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const text = fs.readFileSync(path.join(ROOT, 'docs', 'size-report.html'), 'utf8');
const out = [];
const say = (s) => { out.push(s); console.log(s); };
const ms = (n) => n.toFixed(2) + ' ms';

const dom = new JSDOM(text, {
  url: 'https://report.invalid/size-report.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const win = dom.window;
const doc = win.document;
const D = win.eval('appData');
const R = D.rows.length;
const F = D.files.length;
const M = D.metrics.length;
const grid = doc.getElementById('grid');
const rows = [...grid.querySelectorAll('tbody tr')];

say('== исходное ==');
say(`строк тела ${rows.length} (1 «сейчас» + ${R} коммитов), файлов ${F}, метрик ${M}`);
say(`клеток в таблице: ${grid.querySelectorAll('td, th').length}`);

// Кэш, который собирается один раз при загрузке (в реальной правке — при первом построении).
const t0 = performance.now();
const childrenOf = rows.map((tr) => [...tr.children]);   // массив вместо HTMLCollection
const dataRowOf = rows.map((_, k) => (k === 0 ? null : R - k));
const colOf = (i) => rows.map((_, k) => [
  childrenOf[k][1 + M + i * M], childrenOf[k][2 + M + i * M], childrenOf[k][3 + M + i * M]
]);
const cols = [];
for (let i = 0; i < F; i++) cols.push(colOf(i));
const totalCells = rows.map((_, k) => [childrenOf[k][1], childrenOf[k][2], childrenOf[k][3]]);
const headTop = [...grid.querySelectorAll('thead tr')[0].children];
say(`сбор кэша ссылок (один раз): ${ms(performance.now() - t0)}, ячеек в кэше ${cols.length * rows.length * M}`);

// Итоги, которые поддерживаются инкрементально.
const totals = D.metrics.map(() => new Float64Array(R));
for (let r = 0; r < R; r++) {
  for (let i = 0; i < F; i++) {
    const v = D.rows[r].values[i];
    if (v === null) continue;
    for (let m = 0; m < M; m++) totals[m][r] += v[D.metrics[m].key];
  }
}

const hideFile = (i, off) => {
  const col = cols[i];
  let ops = 0;
  for (let k = 0; k < rows.length; k++) {
    const cells = col[k];
    const r = dataRowOf[k];
    for (let m = 0; m < M; m++) {
      cells[m].classList.toggle('off', off);
      ops++;
      if (r === null) continue;
      const v = D.rows[r].values[i];
      if (v === null) continue;
      const key = D.metrics[m].key;
      totals[m][r] += off ? -v[key] : v[key];
      totalCells[k][m].textContent = win.group(Math.round(totals[m][r]));
      ops++;
    }
  }
  return ops;
};

const timePair = (label, off, on) => {
  let t = performance.now();
  const ops = off();
  const a = performance.now() - t;
  t = performance.now();
  on();
  const b = performance.now() - t;
  say(`  ${label}: off ${ms(a)} | on ${ms(b)} | операций ${ops}`);
  return [a, b];
};

say('');
say('== переключение без пересборки (ссылки из кэша) ==');
const fileIdx = D.files.findIndex((f) => f.label === 'derived.js');
const one = timePair(`один файл ${D.files[fileIdx].label}`,
  () => hideFile(fileIdx, true), () => hideFile(fileIdx, false));

const chore = D.files.map((f, i) => i).filter((i) => D.files[i].category === 'chore');
const cat = timePair(`категория «Служебные» (${chore.length} файлов)`,
  () => chore.reduce((a, i) => a + hideFile(i, true), 0),
  () => chore.reduce((a, i) => a + hideFile(i, false), 0));

const code = D.files.map((f, i) => i).filter((i) => D.files[i].category === 'code');
const cat2 = timePair(`категория «Код» (${code.length} файлов)`,
  () => code.reduce((a, i) => a + hideFile(i, true), 0),
  () => code.reduce((a, i) => a + hideFile(i, false), 0));

const worklog = D.files.map((f, i) => i).filter((i) => (D.files[i].path || '').indexOf('worklog/') === 0);
const dir = timePair(`папка worklog/ (${worklog.length} файлов)`,
  () => worklog.reduce((a, i) => a + hideFile(i, true), 0),
  () => worklog.reduce((a, i) => a + hideFile(i, false), 0));

say('');
say('== метрика: класс на корне таблицы против перебора клеток ==');
const rootMetric = timePair('класс на #grid + colSpan шапки', () => {
  grid.classList.toggle('m0-off', true);
  let ops = 1;
  for (const th of headTop) if (th.colSpan > 1) { th.colSpan = M - 1; ops++; }
  return ops;
}, () => {
  grid.classList.toggle('m0-off', false);
  let ops = 1;
  for (const th of headTop) if (th.colSpan > 0) { th.colSpan = M; ops++; }
  return ops;
});
const cellMetric = timePair(`перебор клеток метрики (${rows.length * (F + 1)} клеток)`, () => {
  let ops = 0;
  for (let k = 0; k < rows.length; k++) {
    for (let i = 0; i <= F; i++) {
      const c = childrenOf[k][1 + i * M];
      if (c) { c.classList.toggle('off', true); ops++; }
    }
  }
  return ops;
}, () => {
  let ops = 0;
  for (let k = 0; k < rows.length; k++) {
    for (let i = 0; i <= F; i++) {
      const c = childrenOf[k][1 + i * M];
      if (c) { c.classList.toggle('off', false); ops++; }
    }
  }
  return ops;
});

say('');
say('== те же действия полным рендером (как сейчас) ==');
const boxOf = (p) => [...doc.querySelectorAll('#panel input')].find((b) => (b.title || '').indexOf(p) === 0);
const cur = (label, p) => {
  let t = performance.now();
  const b1 = boxOf(p); b1.checked = false; b1.dispatchEvent(new win.Event('change'));
  const a = performance.now() - t;
  t = performance.now();
  const b2 = boxOf(p); b2.checked = true; b2.dispatchEvent(new win.Event('change'));
  const bb = performance.now() - t;
  say(`  ${label}: off ${ms(a)} | on ${ms(bb)}`);
  return [a, bb];
};
const curOne = cur(`один файл ${D.files[fileIdx].label}`, D.files[fileIdx].path);

say('');
say('== ускорение (jsdom, off) ==');
say(`  один файл: ${(curOne[0] / one[0]).toFixed(0)}×`);
say(`  метрика (класс на корне): ${(3759.8 / rootMetric[0]).toFixed(0)}×  [полный рендер метрики замерен в click-bench]`);
say(`  узлов создано прототипом за все клики: 0 (узлов в документе ${doc.querySelectorAll('*').length})`);

fs.writeFileSync(path.join(ROOT, 'reports', 'proto-hide.txt'), out.join('\n') + '\n');

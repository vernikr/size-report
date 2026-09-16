// Замер стоимости клика по чекбоксам на настоящем артефакте (docs/size-report.html) в jsdom.
// Считает: стартап, число узлов, стоимость каждого вида клика и разбивку по частям рендера.
// Запуск: node tools/perf/click-bench.mjs
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const text = fs.readFileSync(path.join(ROOT, 'docs', 'size-report.html'), 'utf8');

const out = [];
const say = (s) => { out.push(s); console.log(s); };
const ms = (n) => n.toFixed(1) + ' ms';

let created = 0;
const t0 = performance.now();
const dom = new JSDOM(text, {
  url: 'https://report.invalid/size-report.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    const orig = window.document.createElement.bind(window.document);
    window.document.createElement = (tag) => { created++; return orig(tag); };
    const origNS = window.document.createElementNS.bind(window.document);
    window.document.createElementNS = (ns, tag) => { created++; return origNS(ns, tag); };
  }
});
const startup = performance.now() - t0;
const win = dom.window;
const doc = win.document;

say('== стартап (jsdom, разбор HTML + JSON + первый рендер) ==');
say(`${ms(startup)}, создано узлов: ${created}`);
say(`функции страницы видны как глобальные: appRender=${typeof win.appRender}, appTable=${typeof win.appTable}, `
  + `appPanel=${typeof win.appPanel}, rowModel=${typeof win.rowModel}`);

const grid = doc.getElementById('grid');
const cells = grid.querySelectorAll('td, th').length;
const rows = grid.querySelectorAll('tr').length;
say('');
say('== таблица после первого рендера ==');
say(`строк ${rows}, клеток (td+th) ${cells}`);
say(`всего узлов в документе: ${doc.querySelectorAll('*').length}`);
say(`инпутов в панели: ${doc.querySelectorAll('#panel input').length}`);
say(`узлов в панели: ${doc.querySelectorAll('#panel *').length}`);

const D = win.eval('appData');
say(`данные: ${D.rows.length} строк × ${D.files.length} файлов × ${D.metrics.length} метрик`);

// --- разбивка рендера по частям ---
say('');
say('== разбивка одного полного рендера ==');
const timeIt = (label, fn, n) => {
  const times = [];
  for (let k = 0; k < (n || 1); k++) {
    const t = performance.now();
    fn();
    times.push(performance.now() - t);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  say(`  ${label}: ${ms(avg)}` + (n > 1 ? ` (среднее из ${n})` : ''));
  return avg;
};

const allMetrics = D.metrics.map((m) => m.key);
const allOn = new Array(D.files.length).fill(true);
const tableOnly = timeIt('appTable() целиком', () => win.appTable());
timeIt('appPanel() целиком', () => win.appPanel());
timeIt('математика: rowModel по всем строкам', () => {
  for (let r = 0; r < D.rows.length; r++) {
    const prev = r === 0 ? null : D.rows[r - 1];
    win.rowModel(D.rows[r].values, prev === null ? null : prev.values, allMetrics, allOn);
  }
}, 3);
timeIt('group() по всем непустым значениям × 3 метрики', () => {
  for (let r = 0; r < D.rows.length; r++) {
    for (let i = 0; i < D.files.length; i++) {
      const v = D.rows[r].values[i];
      if (v === null) continue;
      win.group(v.raw); win.group(v.min); win.group(v.tok);
    }
  }
}, 3);
timeIt('appPassport()', () => win.appPassport(), 20);
timeIt('appWrite() (память + адрес)', () => win.appWrite(), 20);

// --- клики ---
say('');
say('== клики (jsdom; off → on) ==');
const inputs = () => [...doc.querySelectorAll('#panel input')];
const fire = (box, checked) => {
  box.checked = checked;
  box.dispatchEvent(new win.Event('change'));
};
const clickCase = (label, find) => {
  const before = created;
  let t = performance.now();
  const boxOff = find();
  fire(boxOff, false);
  const off = performance.now() - t;
  t = performance.now();
  fire(find(), true);
  const on = performance.now() - t;
  say(`  ${label}: off ${ms(off)} | on ${ms(on)} | узлов создано за оба: ${created - before}`);
};

const catBox = (label) => [...doc.querySelectorAll('#panel .box.all')]
  .find((b) => b.textContent === label).querySelector('input');
const fileBox = (p) => inputs().find((b) => (b.title || '').indexOf(p) === 0);
const dirBox = (name) => [...doc.querySelectorAll('#panel .box.dir')]
  .find((b) => b.textContent.indexOf(name) === 0).querySelector('input');
const metricBox = (key) => [...doc.querySelectorAll('#panel .box.metric')]
  .find((b) => b.textContent.trim() === key).querySelector('input');

const cats = [...doc.querySelectorAll('#panel .box.all')].map((b) => b.textContent);
say(`  категории в панели: ${cats.join(' | ')}`);
clickCase('категория «' + cats[0] + '»', () => catBox(cats[0]));
clickCase('метрика raw', () => metricBox('raw'));
const dirs = [...doc.querySelectorAll('#panel .box.dir')].map((b) => b.textContent.split('/')[0]);
say(`  папки верхнего уровня: ${[...new Set(dirs)].join(', ')}`);
const biggest = [...doc.querySelectorAll('#panel .box.dir')]
  .map((b) => ({ name: b.textContent, n: parseInt(b.querySelector('.n').textContent, 10) || 0 }))
  .sort((a, b) => b.n - a.n)[0];
say(`  самая большая папка: ${biggest.name} (${biggest.n} файлов)`);
clickCase('папка ' + biggest.name, () => dirBox(biggest.name));
const someFile = D.files.find((f) => f.label === 'derived.js') || D.files[0];
clickCase('один файл ' + someFile.label, () => fileBox(someFile.path));

say('');
say('== контрольная точка: числа после всех кликов ==');
say(`  итог в строке «сейчас»: ${doc.querySelectorAll('#grid tbody tr')[0].querySelectorAll('td')[0].textContent}`);
say(`  клеток в таблице: ${doc.querySelectorAll('#grid td, #grid th').length}`);

fs.writeFileSync(path.join(ROOT, 'reports', 'click-bench.txt'), out.join('\n') + '\n');

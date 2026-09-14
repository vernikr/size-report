/* Программа страницы отчёта: панель выбора и таблица.
 *
 * Это обычный исходник, а не строка в движке: его видит линтер, и он же
 * вклеивается в собранную страницу (`pageScript` снимает модульный синтаксис —
 * импорт ниже и объявления с `export` из соседнего файла). Расчёт берётся из
 * производных величин, поэтому включение метрики, категории или файла зовёт тот
 * же расчёт, что считает статическую таблицу, и не может дать других чисел.
 *
 * Страница — один файл без внешних ссылок, поэтому здесь нет ни `import()` по
 * требованию, ни загрузки чего-либо по сети.
 *
 * Отделка (дерево папок, запоминание выбора, тёмная схема) — следующий проход. */

/* Импорт — одной строкой: модульный синтаксис снимается при вклейке построчно,
 * и оставшаяся строка `import` попала бы в страницу (её ловит проверка). */
import { cellParts, commitParts, nowModel, rowModel, valueParts } from '../derived.js';

const appData = JSON.parse(document.getElementById('data').textContent);
const appUi = JSON.parse(document.getElementById('ui').textContent);
const appView = { metrics: {}, files: [] };
appData.metrics.forEach((m) => { appView.metrics[m.key] = true; });
appData.files.forEach(() => { appView.files.push(true); });

function appEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

function appBox(label, title, checked, onChange) {
  const box = appEl('label', 'box');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  if (title) input.title = title;
  input.addEventListener('change', onChange);
  box.appendChild(input);
  box.appendChild(appEl('span', null, label));
  return box;
}

/* Категория — не отдельное состояние, а способ переставить галочки файлов сразу:
 * сама она ничего не помнит, иначе одно и то же решалось бы в двух местах. */
function appPanel() {
  const panel = document.getElementById('panel');
  panel.textContent = '';
  const mrow = appEl('div', 'row');
  mrow.appendChild(appEl('span', 'cap', appUi.metrics));
  appData.metrics.forEach((m) => {
    mrow.appendChild(appBox(m.label, m.note + ' · способ: ' + m.method + ' (' + m.accuracy + ')',
      appView.metrics[m.key], (e) => {
        appView.metrics[m.key] = e.target.checked;
        appRender();
      }));
  });
  panel.appendChild(mrow);
  appData.categories.forEach((cat) => {
    const idx = [];
    appData.files.forEach((f, i) => { if (f.category === cat.key) idx.push(i); });
    const row = appEl('div', 'row');
    row.appendChild(appBox(cat.label, 'все файлы категории', idx.every((i) => appView.files[i]), (e) => {
      idx.forEach((i) => { appView.files[i] = e.target.checked; });
      appRender();
    }));
    idx.forEach((i) => {
      const f = appData.files[i];
      const where = f.path === null ? f.paths[0] + ' (нет на HEAD)' : f.path;
      row.appendChild(appBox(f.label, where + ' · категория: '
        + (f.categoryBy === 'config' ? 'из настроек' : 'по расширению'), appView.files[i], (e) => {
        appView.files[i] = e.target.checked;
        appRender();
      }));
    });
    panel.appendChild(row);
  });
}

// Разметка клетки строки-коммита: правила — в cellParts, здесь только узел.
function appCell(cell, first) {
  const parts = cellParts(cell.value, cell.delta, '−');
  const td = appEl('td', 'num' + (first ? ' g' : '') + (parts.miss ? ' miss' : ''));
  if (parts.dir === null) td.textContent = parts.text;
  else td.appendChild(appEl('span', 'delta ' + parts.dir, parts.text));
  return td;
}

// Разметка клетки верхней строки: правила — в valueParts.
function appValueCell(value, first) {
  const parts = valueParts(value);
  const td = appEl('td', 'num' + (first ? ' g' : '') + (parts.miss ? ' miss' : ''));
  td.textContent = parts.text;
  return td;
}

function appCommit(row) {
  const th = appEl('th', 'c-commit');
  const parts = commitParts(row, appData.report.showSha, row.href);
  const name = parts.href ? appEl('a', 'subj', parts.subject) : appEl('span', 'subj', parts.subject);
  if (parts.href) name.href = parts.href;
  name.title = parts.subject + (parts.short ? ' ' + parts.short : '');
  th.appendChild(appEl('span', 'when', parts.when));
  th.appendChild(name);
  th.appendChild(appEl('span', 'sect', parts.mark.text));
  return th;
}

function appSubHead(metrics) {
  const tr = appEl('tr');
  metrics.forEach((m, mi) => tr.appendChild(appEl('th', mi === 0 ? 'g' : '', m.label)));
  return tr;
}

function appTable() {
  const shown = appData.metrics.filter((m) => appView.metrics[m.key]);
  const metrics = shown.map((m) => m.key);
  const on = appView.files;
  const files = [];
  appData.files.forEach((f, i) => { if (on[i]) files.push(i); });
  const table = document.getElementById('grid');
  table.textContent = '';

  const head = appEl('tr');
  const commit = appEl('th', 'c-commit', appUi.commit);
  commit.rowSpan = 2;
  head.appendChild(commit);
  const total = appEl('th', 'g', appUi.total);
  total.colSpan = metrics.length;
  head.appendChild(total);
  files.forEach((i) => {
    const th = appEl('th', 'g', appData.files[i].label);
    th.colSpan = metrics.length;
    head.appendChild(th);
  });
  const subs = appSubHead(shown);
  files.forEach(() => {
    const more = appSubHead(shown);
    while (more.firstChild) subs.appendChild(more.firstChild);
  });
  const thead = appEl('thead');
  thead.appendChild(head);
  thead.appendChild(subs);

  const body = appEl('tbody');
  for (let r = appData.rows.length - 1; r >= 0; r--) {
    const row = appData.rows[r];
    const prev = r === 0 ? null : appData.rows[r - 1];
    const model = rowModel(row.values, prev === null ? null : prev.values, metrics, on);
    const tr = appEl('tr');
    tr.appendChild(appCommit(row));
    model.total.forEach((cell, mi) => tr.appendChild(appCell(cell, mi === 0)));
    model.files.forEach((cells) => cells.forEach((cell, mi) => tr.appendChild(appCell(cell, mi === 0))));
    body.appendChild(tr);
  }

  /* Верхняя строка — «сейчас»: абсолютные размеры на HEAD. Дельты под ней сходятся
   * с ней, поэтому она и стоит первой. */
  const now = appEl('tr', 'now');
  now.appendChild(appEl('th', 'c-commit', appUi.now));
  const nowCells = nowModel(appData.now, metrics, on);
  nowCells.total.forEach((v, mi) => now.appendChild(appValueCell(v, mi === 0)));
  nowCells.files.forEach((cells) => cells.forEach((v, mi) => now.appendChild(appValueCell(v, mi === 0))));
  body.insertBefore(now, body.firstChild);

  table.appendChild(thead);
  table.appendChild(body);
  document.getElementById('note').textContent = appUi.note.replace('{command}', appData.report.fixCommand);
}

function appRender() {
  appPanel();
  appTable();
}
appRender();

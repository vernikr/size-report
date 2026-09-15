import { cellParts, commitParts, nowModel, rowModel, valueParts } from '../derived.js';
import { appEl } from './dom.js';
import { appData, appUi, appView, appMetric } from './state.js';

/* Приближённая клетка: пометка берётся из данных движка, а не выводится здесь из
 * пути файла, — правило точности живёт там же, где считаются числа. У клетки
 * файла это её собственное число, у итога — худшее из вошедших в него, иначе
 * сумма обещала бы точность, которой нет у слагаемых. Возвращается описание
 * метрики (её способ и идёт в подсказку клетки) либо ничего. */
export function appApprox(where, files, key) {
  const marks = appData.approx[key];
  if (marks === undefined) return null;
  const row = where === 'now' ? marks.now : marks.rows;
  const base = where === 'now' ? 0 : where * appData.files.length;
  for (let i = 0; i < files.length; i++) {
    if (row.charAt(base + files[i]) === '1') return appMetric[key];
  }
  return null;
}

/* Класс клетки собирается в одном месте: и пометка приближения, и пропуск
 * («файла нет») — свойства самой клетки, а не её содержимого. */
function appCellClass(first, miss, approx) {
  return 'num' + (first ? ' g' : '') + (miss ? ' miss' : '') + (approx === null ? '' : ' approx');
}

// Разметка клетки строки-коммита: правила — в cellParts, здесь только узел.
export function appCell(cell, first, approx) {
  const parts = cellParts(cell.value, cell.delta, '−');
  const td = appEl('td', appCellClass(first, parts.miss, approx));
  if (approx !== null) td.title = appUi.approxCell + approx.method;
  if (parts.dir === null) td.textContent = parts.text;
  else td.appendChild(appEl('span', 'delta ' + parts.dir, parts.text));
  return td;
}

// Разметка клетки верхней строки: правила — в valueParts.
export function appValueCell(value, first, approx) {
  const parts = valueParts(value);
  const td = appEl('td', appCellClass(first, parts.miss, approx));
  if (approx !== null) td.title = appUi.approxCell + approx.method;
  td.textContent = parts.text;
  return td;
}

/* Подпись коммита — той же разметкой, что в статической таблице: дата, тема,
 * метка раздела журнала. Ширину колонки и обрезку длинной темы задаёт общая часть
 * оформления, поэтому колонка не прыгает при переключении файлов. */
export function appCommit(row) {
  const parts = commitParts(row, appData.report.showSha, row.href);
  const name = parts.href ? appEl('a', 'subj', parts.subject) : appEl('span', 'subj', parts.subject);
  if (parts.href) name.href = parts.href;
  name.title = parts.title;
  const mark = appEl('span', 'sect', parts.mark.text);
  if (parts.mark.title) mark.title = parts.mark.title;

  const clip = appEl('div', 'clip');
  clip.appendChild(appEl('span', 'when', parts.when));
  clip.appendChild(name);
  clip.appendChild(mark);
  const th = appEl('th', 'c-commit');
  th.appendChild(clip);
  return th;
}

export function appSubHead(metrics) {
  const tr = appEl('tr');
  metrics.forEach((m, mi) => tr.appendChild(appEl('th', mi === 0 ? 'g' : '', m.label)));
  return tr;
}

/* Состояния пустоты: когда чисел не будет вовсе, страница говорит об этом словами,
 * а не сеткой без колонок. Файлы можно выключить все — тогда остаётся общий объём,
 * и подсказка объясняет, почему колонок нет. */
export function appState(metricsCount, filesCount) {
  const state = document.getElementById('state');
  const text = metricsCount === 0 ? appUi.empty : (filesCount === 0 ? appUi.noFiles : '');
  state.textContent = text;
  state.hidden = text === '';
  document.getElementById('shell').hidden = metricsCount === 0;
}

/* Шапка: строка групп (итог и файлы) и строка метрик под ней. Метрики повторяются
 * на каждый файл, поэтому подшапка собирается один раз, а дальше её узлы
 * переезжают в следующие — копий разметки не заводится. */
export function appHead(shown, files, metrics) {
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
  return thead;
}

/* Строка-коммит: подпись и числа. Дельты считает общий расчёт (`rowModel`) — тот
 * же, что считает статическую таблицу; здесь только узлы. Пометка приближения —
 * своя у каждой клетки: у итога по всем вошедшим файлам, у файла — по нему самому. */
export function appRow(r, metrics, files) {
  const row = appData.rows[r];
  const prev = r === 0 ? null : appData.rows[r - 1];
  const model = rowModel(row.values, prev === null ? null : prev.values, metrics, appView.files);
  const tr = appEl('tr');
  tr.appendChild(appCommit(row));
  model.total.forEach((cell, mi) => {
    tr.appendChild(appCell(cell, mi === 0, appApprox(r, files, metrics[mi])));
  });
  model.files.forEach((cells, fi) => cells.forEach((cell, mi) => {
    tr.appendChild(appCell(cell, mi === 0, appApprox(r, [files[fi]], metrics[mi])));
  }));
  return tr;
}

/* Тело: строки коммитов снизу вверх (свежие первыми) плюс верхняя строка «сейчас»
 * с абсолютными размерами на HEAD. Дельты под ней сходятся с ней, поэтому она и
 * стоит первой. */
export function appBody(metrics, files) {
  const body = appEl('tbody');
  for (let r = appData.rows.length - 1; r >= 0; r--) body.appendChild(appRow(r, metrics, files));

  const now = appEl('tr', 'now');
  now.appendChild(appEl('th', 'c-commit', appUi.now));
  const nowCells = nowModel(appData.now, metrics, appView.files);
  nowCells.total.forEach((v, mi) => now.appendChild(appValueCell(v, mi === 0,
    appApprox('now', files, metrics[mi]))));
  nowCells.files.forEach((cells, fi) => cells.forEach((v, mi) => {
    now.appendChild(appValueCell(v, mi === 0, appApprox('now', [files[fi]], metrics[mi])));
  }));
  body.insertBefore(now, body.firstChild);
  return body;
}

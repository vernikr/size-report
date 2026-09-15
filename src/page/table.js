import { cellParts, commitParts, nowModel, rowModel, valueParts } from '../derived.js';
import { appEl } from './dom.js';
import { appData, appUi, appView, appMetric } from './state.js';

/* An approximate cell: the mark comes from the engine's data rather than being derived here from a file's path — the rule
 * of accuracy lives where the numbers are counted. For a file's cell it is that number itself, for a total the worst of
 * what went into it, or the sum would promise an accuracy its terms do not have. Returns the metric's description (its way
 * of counting is what goes into the cell's tooltip) or nothing. */
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

/* The cell's class is assembled in one place: both the mark of approximation and the gap ("no such file") are properties
 * of the cell itself rather than of its content. */
function appCellClass(first, miss, approx) {
  return 'num' + (first ? ' g' : '') + (miss ? ' miss' : '') + (approx === null ? '' : ' approx');
}

// The markup of a commit row's cell: the rules live in cellParts, only the node is here.
export function appCell(cell, first, approx) {
  const parts = cellParts(cell.value, cell.delta, '−');
  const td = appEl('td', appCellClass(first, parts.miss, approx));
  if (approx !== null) td.title = appUi.approxCell + approx.method;
  if (parts.dir === null) td.textContent = parts.text;
  else td.appendChild(appEl('span', 'delta ' + parts.dir, parts.text));
  return td;
}

// The markup of the top row's cell: the rules live in valueParts.
export function appValueCell(value, first, approx) {
  const parts = valueParts(value);
  const td = appEl('td', appCellClass(first, parts.miss, approx));
  if (approx !== null) td.title = appUi.approxCell + approx.method;
  td.textContent = parts.text;
  return td;
}

/* A commit's caption: the date, the subject, the journal section's mark. The column's width and the clipping of a long
 * subject come from the shared part of the styling, which is why the column does not jump when files are switched. */
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

/* The empty states: when there will be no numbers at all, the page says so in words rather than showing a grid without
 * columns. Every file can be switched off — then the total volume remains, and the note explains why there are no
 * columns. */
export function appState(metricsCount, filesCount) {
  const state = document.getElementById('state');
  const text = metricsCount === 0 ? appUi.empty : (filesCount === 0 ? appUi.noFiles : '');
  state.textContent = text;
  state.hidden = text === '';
  document.getElementById('shell').hidden = metricsCount === 0;
}

/* The header: a row of groups (the total and the files) and a row of metrics under it. The metrics repeat for every file,
 * so the sub-header is assembled once and its nodes then move on into the following ones — no copies of the markup are
 * made. */
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

/* A commit row: the caption and the numbers. The deltas come from the shared calculation (`rowModel`) rather than from
 * here — two ways to count one row would be two answers. The mark of approximation is each cell's own: for a total it
 * covers every file that went into it, for a file that file alone. */
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

/* The body: the commit rows built from the newest down, plus the "now" row with the absolute sizes at HEAD. The deltas
 * under it add up to it, which is why it stands first. */
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

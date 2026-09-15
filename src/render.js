import { fill, LOCALES } from './locales.js';
import { METRICS, metricView } from './metrics.js';
import { rowHref } from './journal.js';
import { cellParts, commitParts, nowModel, rowModel, valueParts } from './derived.js';
import { ARTIFACT_CSS, TABLE_CSS } from './css.js';

/* Статический отчёт: стили, разметка клетки и таблицы, примечание. Производные
 * величины берёт из общего расчёта («derived.js») — того же, который исполняет
 * страница. */

/* Оформление артефакта — своё плюс общая часть таблицы: ровно тот же текст
 * таблицы получает и страница, поэтому оформление самой таблицы у двух отчётов
 * одно. Что именно входит в каждую часть — в `src/css.js`. */
const CSS = ARTIFACT_CSS + '\n' + TABLE_CSS;

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Разметка клетки строки-коммита: правила — в `cellParts`, здесь только тег и
 * классы. Клетка-дельта: абсолютные числа стоят один раз в верхней строке, иначе
 * крупное число повторялось бы в каждой строке и колонки расползались бы. */
export function cellHtml(cell, first) {
  const parts = cellParts(cell.value, cell.delta, '-');
  const cls = 'num' + (first ? ' g' : '') + (parts.miss ? ' miss' : '');
  if (parts.dir === null) return '<td class="' + cls + '">' + parts.text + '</td>';
  return '<td class="' + cls + '"><span class="delta ' + parts.dir + '">' + parts.text + '</span></td>';
}

// Разметка клетки верхней строки: правила — в `valueParts`.
export function valueHtml(value, first) {
  const parts = valueParts(value);
  return '<td class="num' + (first ? ' g' : '') + (parts.miss ? ' miss' : '') + '">' + parts.text + '</td>';
}

function commitCell(row, index, cfg) {
  const loc = LOCALES[cfg.locale];
  const parts = commitParts(row, cfg.rows.sha, rowHref(row.section, row.sha, cfg));
  const when = '<span class="when">' + esc(parts.when) + '</span>';
  const title = esc(parts.title);
  const plain = row.section === null && parts.href === null;
  const body = parts.href
    ? '<a class="subj" title="' + title + '" href="' + esc(parts.href) + '">' + esc(parts.subject) + '</a>'
    : '<span class="subj' + (plain ? ' plain' : '') + '" title="' + title + '">' + esc(parts.subject) + '</span>';
  const markTitle = parts.mark.title === null
    ? (cfg.journal ? fill(loc.note.noJournalMark, { journal: cfg.journal.path }) : loc.note.noJournal)
    : parts.mark.title;
  const id = cfg.rows.sha ? 'c-' + row.sha.slice(0, 7) : 'c-' + (index + 1);
  return '<th class="c-commit" id="' + id + '">'
    + '<div class="clip">' + when + body
    + '<span class="sect" title="' + esc(markTitle) + '">' + esc(parts.mark.text) + '</span>'
    + '</div></th>';
}

export function noteText(rows, cfg) {
  const loc = LOCALES[cfg.locale];
  const metrics = cfg.metrics.map((m) => {
    const view = metricView(m, cfg);
    return '<b>' + view.label + '</b> — ' + view.note;
  }).join(loc.note.metricSep);
  const journal = cfg.journal ? loc.note.journal : loc.note.noJournal;
  return loc.note.intro + metrics + loc.note.metricEnd + fill(loc.note.numbers, { now: loc.now })
    + (cfg.journal ? fill(journal, { journal: cfg.journal.path }) : journal)
    + fill(loc.note.columns, { columns: cfg.columns.map((c) => c.label).join(', ') })
    + fill(loc.note.rows, { rows: rows.length, command: cfg.fixCommand });
}

/* Шапка таблицы: строка групп (итог и колонки) и под ней строка метрик. */
function tableHead(cfg, loc) {
  const metrics = cfg.metrics;
  const groupHead = (label, cls) => '<th colspan="' + metrics.length + '" class="' + cls + '">' + esc(label) + '</th>';
  const subHead = () => metrics.map((m, i) => '<th' + (i === 0 ? ' class="g"' : '') + '>'
    + esc(METRICS[m].label) + '</th>').join('');
  return '<tr>'
    + '<th rowspan="2" class="c-commit">' + esc(loc.commit) + '</th>'
    + groupHead(loc.total, 'g')
    + cfg.columns.map((c) => groupHead(c.label, 'g')).join('')
    + '</tr>\n<tr>'
    + subHead()
    + cfg.columns.map(() => subHead()).join('')
    + '</tr>';
}

/* Тело таблицы: строки-коммиты сверху вниз — от старых к новым, — а над ними
 * строка «сейчас» с абсолютными размерами.
 *
 * Дельта считается к предыдущему коммиту (в списке ниже он идёт строкой ниже),
 * а появление файла — рост на весь его объём: иначе сумма дельт по колонке не
 * сходилась бы с текущим размером, и верхняя строка была бы недоказуемой. Всё
 * это считает `rowModel` — тот же, что и на странице. */
function tableBody(rows, cfg, loc) {
  const metrics = cfg.metrics;
  const cellsHtml = (make) => (cells) => cells.map((c, mi) => make(c, mi === 0)).join('');
  const rowCells = cellsHtml((c, first) => cellHtml(c, first));
  const nowCells = cellsHtml((v, first) => valueHtml(v, first));
  const blocksHtml = (model, one) => one(model.total) + model.files.map(one).join('');
  const body = rows.map((row, i) => {
    const prev = i === 0 ? null : rows[i - 1];
    return '<tr>' + commitCell(row, i, cfg)
      + blocksHtml(rowModel(row.cells, prev === null ? null : prev.cells, metrics), rowCells)
      + '</tr>';
  }).reverse().join('\n');
  const nowRow = rows.length === 0 ? '' : '<tr class="now">'
    + '<th class="c-commit">' + esc(loc.now) + '</th>'
    + blocksHtml(nowModel(rows[rows.length - 1].cells, metrics), nowCells)
    + '</tr>';
  return nowRow + '\n' + body;
}

export function render(rows, cfg) {
  const loc = LOCALES[cfg.locale];
  /* Подпись называет только то, что не меняется от самих служебных коммитов:
   * число строк и список колонок. Иначе таблица считалась бы устаревшей сразу
   * после собственного коммита — из-за пересчитанного «пропущено N» в тексте. */
  return `<!doctype html>
<html lang="${loc.html}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.title || loc.heading)}</title>
<style>
${CSS}
</style>
</head>
<body>
<h1>${esc(cfg.heading || loc.heading)}</h1>
<p class="note">${noteText(rows, cfg)}</p>
<table>
<thead>
${tableHead(cfg, loc)}
</thead>
<tbody>
${tableBody(rows, cfg, loc)}
</tbody>
</table>
</body>
</html>
`;
}

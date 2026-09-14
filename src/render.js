import { fill, LOCALES } from './locales.js';
import { METRICS } from './metrics.js';
import { rowHref } from './journal.js';
import { cellParts, commitParts, nowModel, rowModel, valueParts } from './derived.js';

/* Статический отчёт: стили, разметка клетки и таблицы, примечание. Производные
 * величины берёт из общего расчёта («derived.js») — того же, который исполняет
 * страница. */

const CSS = `
:root { color-scheme: light dark; }
/* Фон и цвет текста заданы явно и одной парой (Canvas/CanvasText): без этого
 * страница берёт цвет текста из схемы, а фон — нет, и в тёмной схеме числа
 * оказывались белыми на белом. */
body { margin: 0; padding: 20px; background: Canvas; color: CanvasText; font: 12.5px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
h1 { margin: 0 0 6px; font-size: 16px; }
.note { margin: 0 0 14px; max-width: 80em; opacity: .75; font-size: 12px; }
.note code { background: rgba(127, 127, 127, .15); padding: 0 3px; border-radius: 3px; }
/* Гарнитура одна на всю таблицу; числа выравниваются по разрядам за счёт
 * tabular-nums, а не за счёт моноширинного шрифта. */
table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 2px 7px; border-bottom: 1px solid rgba(127, 127, 127, .25); white-space: nowrap; }
/* Шапка из двух строк: обе липкие, поэтому вторая сдвинута ровно на высоту первой
 * (line-height 20 + 2px нижней границы), иначе строки накладывались бы друг на друга. */
thead th { position: sticky; top: 0; z-index: 3; background: Canvas; text-align: center; line-height: 20px; padding: 0 7px; }
thead tr:first-child th { border-bottom-width: 2px; }
thead tr:last-child th { top: 22px; }
.num { text-align: right; }
.g { border-left: 1px solid rgba(127, 127, 127, .35); }
/* Липкая левая колонка: фон непрозрачный (Canvas), иначе при скролле вправо под
 * клеткой были бы видны числа. Ярус выше соседних клеток (2) и ниже шапки (3);
 * угол шапки — выше всех, иначе группы колонок наползают на «Коммит». */
.c-commit { position: sticky; left: 0; z-index: 2; background: Canvas; text-align: left; font-weight: 400; }
.c-commit a { color: inherit; }
thead .c-commit { z-index: 6; }
/* Ширину колонки задаёт этот блок. Без него содержимое ячейки выходило за её
 * границы и рисовалось поверх соседних чисел: у ячейки таблицы нет обрезки. */
.clip { display: flex; align-items: baseline; gap: 6px; width: 300px; }
.when { flex: none; opacity: .7; }
.subj { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; display: block; }
.subj.plain { opacity: .7; }
.sect { flex: none; opacity: .7; font-size: 11px; text-decoration: none; border-bottom: 1px dotted currentColor; }
/* Рост зелёный, спад красный — по договорённости с заказчиком (рост — «больше
 * логики», а не тревога). */
.up { color: #1e8449; }
.down { color: #c0392b; }
.miss { opacity: .5; }
/* Верхняя строка — текущие размеры: она же и объясняет, к чему относятся дельты. */
tr.now th, tr.now td { border-bottom: 2px solid rgba(127, 127, 127, .35); }
tr.now .c-commit { font-weight: 600; }
/* Подсветка строки — наложением, а не подменой фона: липкая колонка обязана
 * оставаться непрозрачной, иначе под ней при скролле видны числа. */
tbody tr:hover th, tbody tr:hover td { background-image: linear-gradient(rgba(127, 127, 127, .08), rgba(127, 127, 127, .08)); }
`.trim();

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
  const title = esc(parts.short ? parts.subject + ' · ' + parts.short : parts.subject);
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
  const metrics = cfg.metrics.map((m) => '<b>' + METRICS[m].label + '</b> — ' + METRICS[m].note[cfg.locale]).join(loc.note.metricSep);
  const journal = cfg.journal ? loc.note.journal : loc.note.noJournal;
  return loc.note.intro + metrics + loc.note.metricEnd + fill(loc.note.numbers, { now: loc.now })
    + (cfg.journal ? fill(journal, { journal: cfg.journal.path }) : journal)
    + fill(loc.note.columns, { columns: cfg.columns.map((c) => c.label).join(', ') })
    + fill(loc.note.rows, { rows: rows.length, command: cfg.fixCommand });
}

export function render(rows, cfg) {
  const loc = LOCALES[cfg.locale];
  const metrics = cfg.metrics;
  const groupHead = (label, cls) => '<th colspan="' + metrics.length + '" class="' + cls + '">' + esc(label) + '</th>';
  const subHead = () => metrics.map((m, i) => '<th' + (i === 0 ? ' class="g"' : '') + '>'
    + esc(METRICS[m].label) + '</th>').join('');
  const head = '<tr>'
    + '<th rowspan="2" class="c-commit">' + esc(loc.commit) + '</th>'
    + groupHead(loc.total, 'g')
    + cfg.columns.map((c) => groupHead(c.label, 'g')).join('')
    + '</tr>\n<tr>'
    + subHead()
    + cfg.columns.map(() => subHead()).join('')
    + '</tr>';

  /* Дельта считается к предыдущему коммиту (в списке ниже он идёт строкой ниже),
   * а появление файла — рост на весь его объём: иначе сумма дельт по колонке не
   * сходилась бы с текущим размером, и верхняя строка была бы недоказуемой. Всё
   * это считает `rowModel` — тот же, что и на странице. */
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
${head}
</thead>
<tbody>
${nowRow}
${body}
</tbody>
</table>
</body>
</html>
`;
}

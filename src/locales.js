/* Тексты отчёта: заголовки, подписи и служебные слова на языке проекта. Это
 * словарь, а не рендер: механика таблицы от языка не зависит. */

/* Тексты артефакта: колонка, метрики и служебные слова. Механика (заголовки
 * таблицы, клетки, дельты) от локали не зависит, поэтому перевод — это словарь,
 * а не отдельный рендер. */
export const LOCALES = {
  ru: {
    html: 'ru',
    heading: 'Объём файлов по коммитам',
    commit: 'Коммит',
    total: 'Общий объём',
    now: 'сейчас',
    categories: { code: 'Код', docs: 'Документация', chore: 'Служебные', assets: 'Ресурсы' },
    page: {
      metrics: 'Метрики',
      note: 'В клетке — изменение к предыдущему коммиту, пустая клетка — не менялось, '
        + '«—» — файла в той ревизии ещё нет. Абсолютные размеры стоят один раз, в строке «{now}». '
        + 'Собрано из истории git: {command}.'
    },
    note: {
      intro: 'Строка — коммит, колонка — файл. ',
      metricSep: ', ',
      metricEnd: '. ',
      numbers: 'В клетке — изменение к предыдущему коммиту (он идёт строкой ниже): '
        + '<span class="up">рост</span> / <span class="down">спад</span>, пустая клетка — '
        + 'не менялось, <code>—</code> — файла в той ревизии ещё нет. Абсолютные размеры '
        + 'стоят один раз: в верхней строке «{now}» — текущий размер. ',
      journal: 'Описание ведёт в раздел {journal}: <code>§N</code> — раздел заведён этим коммитом, '
        + '<code>§N*</code> — коммит правил уже существующий раздел, <code>—</code> — {journal} не трогал. ',
      noJournal: 'Описание — коммит; раздел журнала задаётся в конфиге (journal). ',
      columns: 'Колонки таблицы: {columns}. ',
      rows: 'Строк: {rows}. Собрано из истории git: <code>{command}</code>. '
        + 'Строк не получают коммиты, тронувшие только этот файл, и коммиты без изменения объёма.',
      noJournalMark: 'этот коммит {journal} не трогал'
    }
  },
  en: {
    html: 'en',
    heading: 'File size by commit',
    commit: 'Commit',
    total: 'Total',
    now: 'now',
    categories: { code: 'Code', docs: 'Documentation', chore: 'Chores', assets: 'Assets' },
    page: {
      metrics: 'Metrics',
      note: 'A cell holds the change against the previous commit, an empty cell — no change, '
        + '“—” — the file does not exist in that revision yet. Absolute sizes appear once, in the '
        + '“{now}” row. Collected from git history: {command}.'
    },
    note: {
      intro: 'A row is a commit, a column is a file. ',
      metricSep: ', ',
      metricEnd: '. ',
      numbers: 'A cell holds the change against the previous commit (the row below): '
        + '<span class="up">growth</span> / <span class="down">fall</span>, an empty cell — '
        + 'no change, <code>—</code> — the file does not exist in that revision yet. Absolute '
        + 'sizes appear once, in the top “{now}” row. ',
      journal: 'The description links to a {journal} section: <code>§N</code> — the section was opened '
        + 'by this commit, <code>§N*</code> — the commit edited an existing section, '
        + '<code>—</code> — {journal} was not touched. ',
      noJournal: 'The description is the commit itself; a journal is set by the `journal` config key. ',
      columns: 'Columns: {columns}. ',
      rows: 'Rows: {rows}. Collected from git history: <code>{command}</code>. '
        + 'Commits touching only this file get no row, as do commits changing no number.',
      noJournalMark: 'this commit did not touch {journal}'
    }
  }
};

export function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (_m, k) => (vars[k] === undefined ? '' : String(vars[k])));
}

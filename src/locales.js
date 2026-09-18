/* Texts of the artifact and of the report page: headings, labels and service words, in the
 * language of the project. A dictionary, not a renderer: the mechanics of the table (cells,
 * deltas, headings) do not depend on the language, so translating a report means adding
 * words here rather than writing a second renderer. */
export const LOCALES = {
  ru: {
    html: 'ru',
    heading: 'Объём файлов по коммитам',
    commit: 'Коммит',
    total: 'Общий объём',
    now: 'сейчас',
    categories: { code: 'Код', tests: 'Тесты', docs: 'Документация', chore: 'Служебные', assets: 'Ресурсы' },
    /* The page texts live inside the report file itself (a dictionary of their own, next to
     * the data), so changing a word costs a rebuild of the report — otherwise the file
     * drifts from the history. */
    page: {
      metrics: 'Метрики',
      files: 'Файлы',
      dir: 'все файлы папки {name} ({n})',
      dirNone: 'ни один файл папки {name} в отчёт не попал (в папке {n})',
      /* The fold mark is a click target of its own: the checkbox answers for the numbers,
       * the mark for how much of the tree is visible. */
      foldClose: 'свернуть папку {name}',
      foldOpen: 'развернуть папку {name}',
      /* The reason belongs to a leaf: in the tree it is a label rather than a checkbox,
       * and without these words a reader would think the file was lost. */
      notMeasuredRule: 'не измеряется: такой файл колонкой быть не может'
        + ' (собранный, замок зависимостей, сам отчёт или слишком крупный)',
      notMeasuredChoice: 'не измеряется: в набор колонок отчёта не попал'
        + ' — набор задают настройки (columns)',
      /* The tooltip of a measured file: where the file stands and how its category was decided.
       * A file absent on HEAD is named by the path it came with, and a category comes either from
       * the settings or from the extension — both are answers to the reader's "why so". */
      notOnHead: ' (нет на HEAD)',
      category: ' · категория: ',
      categoryFromConfig: 'из настроек',
      categoryByExtension: 'по расширению',
      all: 'все',
      sub: '{tool} {version} · {artifact}',
      panelMethod: 'способ:',
      emptyMetrics: 'Ни одна метрика не выбрана — таблицу не из чего собрать. '
        + 'Включите хотя бы одну в панели выше: без метрик нет ни одной колонки с числом.',
      noFiles: 'Ни один файл не выбран: в таблице остался только общий объём. '
        + 'Включите файл в панели выше, чтобы увидеть его колонки.',
      linkForeign: 'Ссылка собрана в другом отчёте и не применена: показано то, что '
        + 'выбрано в этом браузере. Адрес не тронут.',
      linkBroken: 'В адресе испорченный выбор — прочитать его не удалось. Показано то, '
        + 'что выбрано в этом браузере.',
      linkExtra: 'Часть ссылки пропущена: в этом отчёте нет {n} названных имён. '
        + 'Остальное применено.',
      unpack: 'Данные отчёта сжаты, а браузер не умеет их распаковать: в нём нет DecompressionStream. '
        + 'Обновите браузер — таблицу показывать не из чего.',
      note: 'Абсолютные размеры стоят один раз — в строке «{now}». Строк: {rows}: коммиты без '
        + 'изменения объёма и коммиты, тронувшие только выключенные файлы, строк не получают. '
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
    categories: { code: 'Code', tests: 'Tests', docs: 'Docs', chore: 'Chores', assets: 'Assets' },
    page: {
      metrics: 'Metrics',
      files: 'Files',
      dir: 'all files in “{name}” ({n})',
      dirNone: 'no file of “{name}” made it into the report ({n} in it)',
      foldClose: 'collapse “{name}”',
      foldOpen: 'expand “{name}”',
      notMeasuredRule: 'not measured: such a file cannot be a column'
        + ' (built, a dependency lock, the report itself, or too large)',
      notMeasuredChoice: 'not measured: it is not in the report’s set of columns'
        + ' — that set comes from the settings (columns)',
      notOnHead: ' (not on HEAD)',
      category: ' · category: ',
      categoryFromConfig: 'from the settings',
      categoryByExtension: 'by extension',
      all: 'all',
      sub: '{tool} {version} · {artifact}',
      panelMethod: 'method:',
      emptyMetrics: 'No metric is selected — there is nothing to build the table from. '
        + 'Turn on at least one above: without metrics there is no column holding a number.',
      noFiles: 'No file is selected: the table shows the total only. '
        + 'Turn on a file above to see its columns.',
      linkForeign: 'The link was built for another report, so it is not applied: you '
        + 'see what this browser has. The address is left as it is.',
      linkBroken: 'The choice in the address is unreadable. You see what this browser '
        + 'has.',
      linkExtra: 'Part of the link is skipped: this report has none of the {n} names '
        + 'it mentions. The rest is applied.',
      /* The report's data lies in the file compressed and the browser unpacks it; this text is what a
       * browser without `DecompressionStream` gets instead of an empty table. */
      unpack: 'The report\u2019s data is compressed and this browser cannot unpack it: there is no '
        + 'DecompressionStream. Update the browser — there is nothing to build the table from.',
      note: 'Absolute sizes appear once — in the “{now}” row. Rows: {rows}: commits that change '
        + 'no number, and commits touching only the disabled files, get no row. '
        + 'Collected from git history: {command}.'
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

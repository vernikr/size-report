import fs from 'fs';
import { fill, LOCALES } from '../locales.js';
import { esc } from '../render.js';
import { PAGE_CSS, TABLE_CSS } from '../css.js';

/* Сборка страницы отчёта: данные и программа в одном файле, внешних ссылок нет.
 * Программа — обычные исходники (app.js рядом и общий расчёт derived.js),
 * вклеенные со снятым модульным синтаксисом; оформление — тоже обычные файлы:
 * общая часть таблицы (`table.css`) и своё оформление страницы (`app.css`). */

/* Программа страницы — обычные исходники (`src/page/app.js` и общий расчёт
 * `src/derived.js`), а не строки в движке: их видит линтер, их же движок
 * вклеивает в страницу. Модульный синтаксис снимается при вклейке: в браузере,
 * открывшем файл с диска, разрешать `import` нечем, а объявления обязаны попасть
 * в общую область видимости в порядке вклейки — сперва расчёт, затем оболочка. */
export function stripModules(src) {
  return src.split('\n')
    .filter((line) => !/^import\s.*;\s*$/.test(line))
    .map((line) => line.replace(/^export\s+(function|const|let|var|class)\s/, '$1 '))
    .join('\n');
}

export function pageSource(file) {
  return stripModules(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
}

export function pageScript() {
  return pageSource('../derived.js') + '\n' + pageSource('./app.js');
}

/* Подпись под заголовком: чем собрана страница и что у неё рядом. Путь к таблице
 * текстом, а не ссылкой: страница открывается с диска и ни от чего не зависит. */
function subText(data, page) {
  return fill(page.sub, {
    tool: data.tool.name,
    version: data.tool.version,
    artifact: data.report.artifact
  });
}

/* Тексты страницы: заголовки колонок, подписи панели, легенда и состояния. В
 * артефакт они не идут — это словарь страницы, а не отчёта. */
function uiText(page, loc) {
  return {
    commit: loc.commit,
    total: loc.total,
    now: loc.now,
    metrics: page.metrics,
    files: page.files,
    dir: page.dir,
    all: page.all,
    linkForeign: page.linkForeign,
    linkBroken: page.linkBroken,
    linkExtra: page.linkExtra,
    legend: [
      { cls: 'up', text: page.legendUp },
      { cls: 'down', text: page.legendDown },
      { cls: 'same', text: page.legendSame },
      { cls: 'miss', text: page.legendMiss }
    ],
    empty: page.emptyMetrics,
    noFiles: page.noFiles,
    /* {command} подставляет страница: у неё есть данные, а {now} — уже здесь. */
    note: page.note.replace(/\{now\}/g, loc.now)
  };
}

/* Страница отчёта — один файл: данные лежат в нём же, скрипт вклеен, внешних
 * ссылок нет. Поэтому она открывается двойным щелчком и работает без сети.
 * `<` в данных экранируется: иначе подпись коммита или путь закрыли бы тег
 * раньше времени (в JSON такой экранированный символ читается как обычный). */
export function pageHtml(data, cfg) {
  const loc = LOCALES[cfg.locale];
  return '<!doctype html>\n<html lang="' + esc(loc.html) + '">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>' + esc(data.report.title) + '</title>\n<style>\n'
    + TABLE_CSS + '\n' + PAGE_CSS + '\n</style>\n</head>\n<body>\n'
    + '<header>\n<h1>' + esc(data.report.heading) + '</h1>\n'
    + '<p class="sub">' + esc(subText(data, loc.page)) + '</p>\n</header>\n'
    + '<div id="panel" class="panel"></div>\n'
    + '<p id="notice" class="notice" hidden></p>\n'
    + '<div id="shell" class="shell"><table id="grid"></table></div>\n'
    + '<p id="state" class="state" hidden></p>\n'
    + '<p id="note" class="note"></p>\n'
    + '<script type="application/json" id="data">' + jsonInHtml(data) + '</script>\n'
    + '<script type="application/json" id="ui">' + jsonInHtml(uiText(loc.page, loc)) + '</script>\n'
    + '<script>\n' + pageScript() + '</script>\n</body>\n</html>\n';
}

/* JSON внутри страницы: `<` экранируется, иначе подпись коммита или путь закрыли
 * бы тег раньше времени (в JSON такой экранированный символ читается как самый
 * обычный). */
function jsonInHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

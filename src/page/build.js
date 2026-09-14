import fs from 'fs';
import { LOCALES } from '../locales.js';
import { esc } from '../render.js';

/* Сборка страницы отчёта: данные и программа в одном файле, внешних ссылок нет.
 * Программа — обычные исходники (app.js рядом и общий расчёт derived.js),
 * вклеенные со снятым модульным синтаксисом. */

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

const APP_CSS = `
:root { color-scheme: light dark; }
body { margin: 0; padding: 20px; background: Canvas; color: CanvasText; font: 12.5px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
h1 { margin: 0 0 6px; font-size: 16px; }
.note { margin: 12px 0 0; max-width: 90em; opacity: .75; font-size: 12px; }
#panel { margin: 0 0 14px; font-size: 12px; }
#panel .row { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; margin: 2px 0; }
#panel .cap { font-weight: 600; opacity: .8; }
#panel .box { display: inline-flex; gap: 4px; align-items: center; }
table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 2px 7px; border-bottom: 1px solid rgba(127, 127, 127, .25); white-space: nowrap; }
th { text-align: center; }
.num { text-align: right; }
.g { border-left: 1px solid rgba(127, 127, 127, .35); }
.miss { opacity: .5; }
.c-commit { text-align: left; font-weight: 400; }
.c-commit a { color: inherit; }
.when { opacity: .6; margin-right: 6px; }
.sect { margin-left: 6px; opacity: .6; }
.delta.up { color: #b04a00; }
.delta.down { color: #1a7f37; }
tr.now th, tr.now td { border-bottom: 2px solid rgba(127, 127, 127, .35); }
tr.now .c-commit { font-weight: 600; }
`.trim();

/* Страница отчёта — один файл: данные лежат в нём же, скрипт вклеен, внешних
 * ссылок нет. Поэтому она открывается двойным щелчком и работает без сети.
 * `<` в данных экранируется: иначе подпись коммита или путь закрыли бы тег
 * раньше времени (в JSON такой экранированный символ читается как обычный). */
export function pageHtml(data, cfg) {
  const loc = LOCALES[cfg.locale];
  return '<!doctype html>\n<html lang="' + esc(loc.html) + '">\n<head>\n<meta charset="utf-8">\n'
    + '<title>' + esc(data.report.title) + '</title>\n<style>\n' + APP_CSS + '\n</style>\n</head>\n<body>\n'
    + '<h1>' + esc(data.report.heading) + '</h1>\n'
    + '<div id="panel"></div>\n<table id="grid"></table>\n<p id="note" class="note"></p>\n'
    + '<script type="application/json" id="data">'
    + jsonInHtml(data)
    + '</script>\n<script type="application/json" id="ui">'
    + jsonInHtml({
      commit: loc.commit,
      total: loc.total,
      now: loc.now,
      metrics: loc.page.metrics,
      note: loc.page.note.replace(/\{now\}/g, loc.now) // {command} подставляет страница
    })
    + '</script>\n<script>\n' + pageScript() + '</script>\n</body>\n</html>\n';
}

/* JSON внутри страницы: `<` экранируется, иначе подпись коммита или путь закрыли
 * бы тег раньше времени (в JSON такой экранированный символ читается как самый
 * обычный). */
function jsonInHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

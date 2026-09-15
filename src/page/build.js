import fs from 'fs';
import { fill, LOCALES } from '../locales.js';
import { PAGE_CSS, TABLE_CSS } from '../css.js';

/* Экранирование текста в разметке — здесь, потому что единственный, кто собирает
 * разметку из данных, — эта сборка: остальное рисует страница узлами. */
export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Сборка страницы отчёта: данные и программа в одном файле, внешних ссылок нет.
 * Оформление — тоже обычные файлы: общая часть таблицы (`table.css`) и своё
 * оформление страницы (`app.css`).
 *
 * Программа страницы — обычные исходники (главы `src/page/*.js` и общий расчёт
 * `src/derived.js`), а не строки в движке: их видит линтер, их же движок
 * вклеивает в страницу. Модульный синтаксис снимается при вклейке: в браузере,
 * открывшем файл с диска, разрешать `import` нечем, а объявления обязаны попасть
 * в общую область видимости в порядке вклейки — сперва расчёт, затем главы.
 *
 * Главы — по предметам страницы, и порядок вклейки (список ниже) — это порядок
 * объявлений в собранной программе: первым идёт расчёт, за ним состояние
 * выбора, узлы, панель, таблица и сборка. Главы — **срезы одного текста**: вклейка
 * склеивает их подряд, поэтому собранная страница осталась бы той же, если бы
 * главы снова стали одним файлом. */
export function stripModules(src) {
  return src.split('\n')
    .filter((line) => !/^import\s.*;\s*$/.test(line))
    .map((line) => line.replace(/^export\s+(function|const|let|var|class)\s/, '$1 '))
    .join('\n');
}

export function pageSource(file) {
  return stripModules(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
}

/* Список глав — здесь же, а не в проверках: он один на сборку и на сторожа
 * (`test/page-view.test.js` читает ту же программу и сверяет её с исходниками). */
export const PAGE_PARTS = ['./state.js', './dom.js', './panel.js', './table.js', './app.js'];

export function pageScript() {
  return pageSource('../derived.js') + '\n' + PAGE_PARTS.map((part) => pageSource(part)).join('');
}

/* Подпись под заголовком: чем собран отчёт и где он лежит. Путь — текстом, а не
 * ссылкой: страница открывается с диска и ни от чего не зависит. */
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
    dirNone: page.dirNone,
    all: page.all,
    linkForeign: page.linkForeign,
    linkBroken: page.linkBroken,
    linkExtra: page.linkExtra,
    /* Точность — двумя словами: подпись метрики говорит про худшее в колонке,
     * подсказка клетки — про её собственное число. */
    exact: page.exact,
    approximate: page.approximate,
    approxCell: page.approximateCell,
    /* Почему файла нет в отчёте — словами: причину называет движок знаком (`why`),
     * а страница одевает знак в текст, как и всё остальное в панели. */
    notMeasuredRule: page.notMeasuredRule,
    notMeasuredChoice: page.notMeasuredChoice,
    methodLabel: page.panelMethod,
    empty: page.emptyMetrics,
    noFiles: page.noFiles,
    /* {command} подставляет страница: у неё есть данные, а {now} — уже здесь. */
    note: page.note.replace(/\{now\}/g, loc.now)
  };
}

/* Что в файл не идёт. Первое — список пропущенных коммитов: он меняется от
 * коммита самого отчёта (тот, кому нечего сказать, попадает в список), и файл
 * перестал бы быть **неподвижной точкой** — пересборка после его же коммита давала
 * бы другие байты, а хук коммитил бы отчёт бесконечно. Странице этот список не
 * нужен вовсе: она его не показывает. Читателю он по-прежнему доступен — `--data`,
 * `--json` и `explain` отвечают этим же проходом. */
const NOT_IN_FILE = ['skipped'];

export function pagePayload(data) {
  const out = Object.assign({}, data);
  NOT_IN_FILE.forEach((key) => delete out[key]);
  return out;
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
    + '<script type="application/json" id="data">' + jsonInHtml(pagePayload(data)) + '</script>\n'
    + '<script type="application/json" id="ui">' + jsonInHtml(uiText(loc.page, loc)) + '</script>\n'
    + '<script>\n' + pageScript() + '</script>\n</body>\n</html>\n';
}

/* JSON внутри страницы: `<` экранируется, иначе подпись коммита или путь закрыли
 * бы тег раньше времени (в JSON такой экранированный символ читается как самый
 * обычный). */
function jsonInHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

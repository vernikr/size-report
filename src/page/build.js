import fs from 'fs';
import { fill, LOCALES } from '../locales.js';
import { PAGE_CSS, TABLE_CSS } from '../css.js';

/* Escaping text for markup lives here, because this builder is the only place that turns data into markup: the rest
 * is drawn as nodes by the page. */
export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Building the report's page: data and program in one file, with no external reference. The styling comes as ordinary
 * files too: the table's shared part (`table.css`) and the page's own (`app.css`).
 *
 * The page's program is ordinary sources (the chapters in `src/page/*.js` and the shared calculation in
 * `src/derived.js`) rather than strings inside the engine: a linter sees them, and the engine pastes them into the
 * page. Module syntax is removed while pasting: in a browser that opened a file from disk there is nothing to resolve
 * `import` with, and the declarations have to reach the shared scope in the order of pasting — the calculation first,
 * then the chapters.
 *
 * The chapters follow the page's subjects, and the order of pasting (the list below) is the order of declarations in
 * the assembled program: the calculation first, then the choice's state, the nodes, the panel, the table and the
 * assembling. The chapters are **slices of one text**: pasting glues them in a row, so the assembled page would stay
 * the same if the chapters became one file again. */
export function stripModules(src) {
  return src.split('\n')
    .filter((line) => !/^import\s.*;\s*$/.test(line))
    .map((line) => line.replace(/^export\s+(function|const|let|var|class)\s/, '$1 '))
    .join('\n');
}

export function pageSource(file) {
  return stripModules(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
}

/* The list of chapters lives here rather than in the tests: one copy for the builder and for the guard
 * (`test/page-view.test.js` reads the same program and compares it with the sources). */
export const PAGE_PARTS = ['./state.js', './dom.js', './panel.js', './table.js', './app.js'];

export function pageScript() {
  return pageSource('../derived.js') + '\n' + PAGE_PARTS.map((part) => pageSource(part)).join('');
}

/* The note under the heading: what built the report and where it lies. The path is plain text rather than a link: the
 * page opens from disk and depends on nothing. */
function subText(data, page) {
  return fill(page.sub, {
    tool: data.tool.name,
    version: data.tool.version,
    artifact: data.report.artifact
  });
}

/* The page's texts: column captions, panel labels, the legend and the empty states. They are the page's dictionary
 * rather than the report's: the data block carries none of them, and the report's own words live in the locale. */
function uiText(page, loc) {
  return {
    commit: loc.commit,
    total: loc.total,
    now: loc.now,
    metrics: page.metrics,
    files: page.files,
    dir: page.dir,
    dirNone: page.dirNone,
    foldClose: page.foldClose,
    foldOpen: page.foldOpen,
    all: page.all,
    linkForeign: page.linkForeign,
    linkBroken: page.linkBroken,
    linkExtra: page.linkExtra,
    /* Accuracy in two words: a metric's caption speaks about the worst in its column, while a cell's tooltip speaks
     * about its own number. */
    exact: page.exact,
    approximate: page.approximate,
    approxCell: page.approximateCell,
    /* Why a file is not in the report, in words: the engine names the reason with a mark (`why`), and the page dresses
     * the mark in text, as it does with everything else in the panel. */
    notMeasuredRule: page.notMeasuredRule,
    notMeasuredChoice: page.notMeasuredChoice,
    /* The tooltip of a file's checkbox: where the file stands and how its category was decided. The
     * panel keeps no words of its own — a Russian report stays Russian in its chrome too, and an
     * English one gets English there. */
    notOnHead: page.notOnHead,
    category: page.category,
    categoryFromConfig: page.categoryFromConfig,
    categoryByExtension: page.categoryByExtension,
    methodLabel: page.panelMethod,
    empty: page.emptyMetrics,
    noFiles: page.noFiles,
    /* {command} is substituted by the page, which holds the data, while {now} is filled in here. */
    note: page.note.replace(/\{now\}/g, loc.now)
  };
}

/* What does not go into the file. First, the list of skipped commits: it changes with the report's own commit (one
 * with nothing to say lands in the list), and the file would stop being a **fixed point** — a rebuild after its own
 * commit would yield different bytes and the hook would commit the report forever. The page has no use for the list
 * at all: it does not show it. It stays available to the reader — `--data`, `--json` and `explain` answer from the
 * same run. */
const NOT_IN_FILE = ['skipped'];

export function pagePayload(data) {
  const out = Object.assign({}, data);
  NOT_IN_FILE.forEach((key) => delete out[key]);
  return out;
}

/* The report's page is one file: the data lies in it, the script is pasted in, there are no external references. Hence
 * it opens with a double click and works without a network. */
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

/* JSON inside the page: `<` is escaped, or a commit's subject or a path would close the tag early (inside a JSON
 * string such an escaped character reads as a most ordinary one). */
function jsonInHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

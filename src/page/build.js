import fs from 'fs';
import zlib from 'zlib';
import { LOCALES } from '../locales.js';
import { PAGE_CSS, TABLE_CSS } from '../css.js';
import { assertCompilable, stripCss, stripJs, stripLines } from '../strip.js';

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
 * What is pasted is **squeezed** on the way in (`squeezedJs`, `squeezedCss`): comments and indentation leave only the
 * copy inside the report, which is read in a browser, while the sources stay the ordinary files a person edits.
 *
 * The chapters follow the page's subjects, and the order of pasting (the list below) is the order of declarations in
 * the assembled program: the calculation first, then the choice's state, the nodes, the panel, the table and the
 * assembling. A chapter that is gone leaves the page with one subject fewer rather than with a hole: the stripe over
 * a long drawing left with the freeze it was drawn for (`src/page/app.js` says what a switch costs now). The
 * chapters are **slices of one text**: pasting glues them in a row, so the assembled page would stay the same if
 * the chapters became one file again. */
export function stripModules(src) {
  return src.split('\n')
    .filter((line) => !/^import\s.*;\s*$/.test(line))
    /* `async` is part of the form rather than a decoration of it: a declaration marked `export async` is as ordinary
     * a source as the rest, and the pasted page has no module syntax to resolve either of them with. */
    .map((line) => line.replace(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s/,
      (head) => head.slice('export '.length)))
    .join('\n');
}

export function pageSource(file) {
  return stripModules(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
}

/* The list of chapters lives here rather than in the tests: one copy for the builder and for the guard
 * (`test/page-view.test.js` reads the same program and compares it with the sources). The payload chapter comes
 * first of the page's own: it is what turns the block into the data everything else reads. */
export const PAGE_PARTS = ['./payload.js', './state.js', './dom.js', './panel.js', './table.js', './app.js'];

/* The form the artifact carries: the same stripping the `min` metric counts (`src/strip.js`) — comments out,
 * indentation and blank lines out — applied to what is pasted, while the sources on disk keep everything: they are
 * read, edited and linted by people, and only the copy inside the report is squeezed. Exported because the checks
 * compare the page with exactly this form rather than with the sources. */
export function squeezedJs(code) {
  return stripLines(stripJs(code));
}

export function squeezedCss(css) {
  return stripLines(stripCss(css));
}

/* The page's program: the chapters glued, the module syntax stripped line by line, the text squeezed — in that
 * order, because the stripping works line by line and a comment could otherwise hide a line's shape. The squeeze
 * may throw away nothing but comments and air, so what comes out has to parse, and the same guard the `min` metric
 * uses says so: with no revision (the text is built here and now) and without the unparsed original, because a text
 * that does not parse at all is not "a damaged file" but a bug of this assembler. */
export function pageScript() {
  const code = squeezedJs(pageSource('../derived.js') + '\n'
    + PAGE_PARTS.map((part) => pageSource(part)).join(''));
  assertCompilable(code, '', 'the page’s program');
  return code;
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
    /* What a host that cannot unpack the block is told: the page's one message about its own file rather than about
     * the report's numbers (see `appBegin`). */
    unpack: page.unpack,
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
    noFiles: page.noFiles
  };
}

/* The page's block is the contract in **sparse form** (`schema: 2`): the history as changes rather than as a snapshot
 * per commit, the texts in a dictionary of their own, and the rows' links cut by the part they share. The dense form
 * stays what `--data` answers with — an agent reads the contract as it is — and the page's own chapter unrolls this
 * one (`src/page/payload.js`, `appDecode`), so the two places it is read are the encoder here and the decoder there.
 * `test/contract-data.test.js` holds the round trip between them.
 *
 * What the block leaves out besides the sparse form are two facts the page does not read. The list of skipped commits
 * changes with the report's own commit (one with nothing to say lands in the list), and the file would stop being a
 * **fixed point** — a rebuild after its own commit would yield different bytes and the hook would commit the report
 * forever; the page does not show it. The other is `last`, the columns the newest commit touched: the page orders the
 * columns by the numbers themselves, which is a different fact (`src/page/table.js` says why), and the block would
 * carry a list nothing asks for. Both stay available to the reader — `--data`, `--json` and `explain` answer from the
 * same run.
 *
 * How much this is worth: the artifact of this repository carried 1 370 627 B of data as a snapshot per commit — 95 %
 * of the whole file — while nine tenths of the cells repeat the row above; the same history as changes is about 84 000
 * B. Reproducibility is untouched: the artifact stays a fixed point, rebuilt byte for byte after its own commit. */

/* The block's fields, in the order the encoder writes them. The shape is closed: a field added here has to be read in
 * the decoder, and the page's checks compare the block with this list rather than with a description of it. */
export const PAGE_KEYS = ['schema', 'tool', 'report', 'hrefPrefix', 'strs', 'metrics', 'cats', 'files',
  'catalog', 'rows', 'hist'];

/* The texts of the block, each written once. The dictionary is extended in the order of the walk `pagePayload` makes
 * — files in the column order, rows in the history order — and the order of the first appearance is what decides an
 * index. That is part of the format rather than a detail: the artifact is rebuilt after every commit and has to come
 * out byte-identical on any machine. */
function dictionary() {
  const list = [];
  const at = new Map();
  function of(text) {
    if (text === null) return null;
    const seen = at.get(text);
    if (seen !== undefined) return seen;
    list.push(text);
    at.set(text, list.length - 1);
    return list.length - 1;
  }
  return { list: list, of: of };
}

/* What the rows' links have in common: for an ordinary row the commit template with the sha cut out, and, when some
 * rows lead to a journal section instead, the part the two kinds share. A row keeps only the rest of its link — which
 * for an ordinary row is the sha the row carries anyway, so a link costs nothing beyond the prefix written once. */
function linkPrefix(rows) {
  const links = rows.map((r) => r.href).filter((href) => href !== null);
  let out = links.length === 0 ? null : links[0];
  links.forEach((href) => {
    let n = 0;
    while (n < out.length && href[n] === out[n]) n++;
    out = out.slice(0, n);
  });
  return out;
}

/* One file between two commits: nothing when the numbers are the same, the absolute numbers when the file was absent
 * before, the deltas when it moved, and a record of the row alone when it is gone — the three shapes the decoder
 * reads. A commit that did not touch a file has no record for it, which is what makes the block small: the numbers are
 * compared rather than the list of paths a commit changed. */
function change(was, nums) {
  if (nums === null) return was === null ? null : [];
  if (was === null) return nums;
  const deltas = nums.map((n, mi) => n - was[mi]);
  return deltas.every((d) => d === 0) ? null : deltas;
}

// The history of every file, in the column order: the rows it appeared in, moved in and disappeared in.
function history(keys, files, rows) {
  const was = files.map(() => null);
  const hist = files.map(() => []);
  rows.forEach((row, r) => {
    row.values.forEach((v, i) => {
      const nums = v === null ? null : keys.map((key) => v[key]);
      const rec = change(was[i], nums);
      if (rec !== null) hist[i].push([r].concat(rec));
      was[i] = nums;
    });
  });
  return hist;
}

export function pagePayload(data) {
  const keys = data.metrics.map((m) => m.key);
  const dict = dictionary();
  const prefix = linkPrefix(data.rows);
  const out = {
    schema: 2,
    tool: data.tool,
    /* The report's own words are the ones the page reads: `heading` is the artifact's `<h1>`, built before the block,
     * `journal` is null today, and `fixCommand` was quoted by the note under the table, which the page no longer has —
     * the page builds no heading, prints no journal and suggests no command. */
    report: {
      locale: data.report.locale,
      title: data.report.title,
      artifact: data.report.artifact,
      showSha: data.report.showSha
    },
    hrefPrefix: prefix,
    strs: dict.list,
    metrics: data.metrics.map((m) => [dict.of(m.key), dict.of(m.label), dict.of(m.note), dict.of(m.method)]),
    cats: data.categories.map((c) => [dict.of(c.key), dict.of(c.label)]),
    files: data.files.map((f) => [dict.of(f.label), dict.of(f.path),
      f.paths.map((p) => dict.of(p)), dict.of(f.category), dict.of(f.categoryBy)]),
    catalog: data.catalog.map((e) => [dict.of(e.path), dict.of(e.why)]),
    rows: data.rows.map((r) => [dict.of(r.sha), dict.of(r.when), dict.of(r.subject),
      r.section === null ? null : dict.of(r.section.id),
      r.section === null ? null : dict.of(r.section.head),
      r.section !== null && r.section.added ? 1 : 0,
      r.href === null ? null : dict.of(r.href.slice(prefix.length))]),
    hist: history(keys, data.files, data.rows)
  };
  return out;
}

/* The block as the artifact carries it: gzip of its JSON, base64. The packing is a **transport, not the shape** —
 * what the page unpacks is the very block it received before (`schema: 2`), and `--data`/`--json` keep answering
 * with the dense contract. It is here because the block is most of the file: this repository's report carried
 * 88 786 B of it against 32 142 B compressed, 42 856 B with base64's third.
 *
 * Level 9 because the block is written once per commit and read by whoever opens the file, not by a server under
 * load. What the fixed point rests on is that the bytes are reproducible: zlib writes no time into the gzip header,
 * so the same text gives the same bytes (the version of zlib is the machine's, like the version of git). Base64 is
 * what makes the bytes survive a text file — a gzip stream is not valid UTF-8, and the report is one. */
export function pagePacked(text) {
  return zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 }).toString('base64');
}

/* The report's page is one file: the data lies in it, the script is pasted in, there are no external references. Hence
 * it opens with a double click and works without a network.
 *
 * The page's chrome is the panel and the table, and nothing stands above the numbers: the report's heading opens the
 * panel (the one place that holds the reader's own controls) rather than a band of its own, and neither the tool, nor the
 * version, nor the artifact's path is printed anywhere — the file is opened from a directory whose name already says
 * where it lies. The panel's card is the markup's and the fields inside it are the script's: `#panel` is emptied and
 * rebuilt on every opening, which is why the heading is the card's other child rather than one more field. */
export function pageHtml(data, cfg) {
  const loc = LOCALES[cfg.locale];
  return '<!doctype html>\n<html lang="' + esc(loc.html) + '">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>' + esc(data.report.title) + '</title>\n<style>\n'
    + squeezedCss(TABLE_CSS) + '\n' + squeezedCss(PAGE_CSS) + '\n</style>\n</head>\n<body>\n'
    + '<div class="panel">\n<h1>' + esc(data.report.heading) + '</h1>\n<div id="panel"></div>\n</div>\n'
    + '<p id="notice" class="notice" hidden></p>\n'
    + '<div id="shell" class="shell"><div id="grid" class="grid"></div></div>\n'
    + '<p id="state" class="state" hidden></p>\n'
    + '<script type="application/octet-stream" id="data" data-pack="base64+gzip">'
    + pagePacked(jsonInHtml(pagePayload(data))) + '</script>\n'
    + '<script type="application/json" id="ui">' + jsonInHtml(uiText(loc.page, loc)) + '</script>\n'
    + '<script>\n' + pageScript() + '</script>\n</body>\n</html>\n';
}

/* JSON inside the page: `<` is escaped, or a commit's subject or a path would close the tag early (inside a JSON
 * string such an escaped character reads as a most ordinary one). */
function jsonInHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

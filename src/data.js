import path from 'path';
import { LOCALES } from './locales.js';
import { metricView } from './metrics.js';
import { rowHref } from './journal.js';
import { build, skipLine } from './history.js';
import { projectTree } from './project.js';
import { TOOL_PKG } from './tool.js';

/* File categories and the contract with the page: absolute values and the shape of the table, with no
 * derived quantity at all. Everything the page counts itself begins where this module ends. */

/* A file's category is only for the page's quick on/off buttons for a group: it does not reach the
 * numbers. The rule is one: the extension gives the category, everything else counts as code; a category
 * set in the column's settings outranks that rule, and the data says where it came from (`categoryBy`) — a
 * manual decision is explainable, while a table of extensions is a guess by file name. */
export const CATEGORY_EXTS = {
  docs: ['.md', '.markdown', '.rst', '.txt', '.adoc'],
  chore: ['.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.lock', '.editorconfig'],
  assets: ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf']
};
export const CATEGORY_ORDER = ['code', 'docs', 'chore', 'assets'];

export function categoryOf(col) {
  if (col.category) return { key: col.category, by: 'config' };
  const ext = path.extname(col.paths[col.paths.length - 1]).toLowerCase();
  const known = CATEGORY_ORDER.find((key) => (CATEGORY_EXTS[key] || []).indexOf(ext) >= 0);
  return { key: known === undefined ? 'code' : known, by: 'auto' };
}

/* The engine-to-page contract: deltas, totals, "now" and the filters are counted by the page — the engine
 * does not know what is switched on in the view, so it cannot total anything up in advance. The numbers
 * here are the same as in the artifact: one truth laid out in fields.
 *
 * The reasons of skipped commits travel as strings and stay strings: they are sentences for a person, and
 * the question behind them (why a commit has no row) is asked by the `explain` command, where the reason is
 * laid out into fields. The page does not carry this list at all, and on purpose: the report's own commit
 * is one of the skipped ones, so the file would never become a fixed point. */
export function reportData(cfg, root) {
  const { rows, state, dropped, last } = build(cfg, root);
  const loc = LOCALES[cfg.locale];
  const files = cfg.columns.map((col, i) => {
    const cat = categoryOf(col);
    return {
      label: col.label,
      path: state[i] === null ? null : state[i].path,
      paths: col.paths,
      category: cat.key,
      categoryBy: cat.by
    };
  });
  return {
    schema: 1,
    tool: { name: TOOL_PKG.name, version: TOOL_PKG.version },
    report: {
      locale: cfg.locale,
      title: cfg.title || loc.heading,
      heading: cfg.heading || loc.heading,
      artifact: cfg.output,
      fixCommand: cfg.fixCommand,
      journal: cfg.journal === null ? null : { path: cfg.journal.path },
      showSha: cfg.rows.sha
    },
    metrics: cfg.metrics.map((key) => Object.assign({ key: key }, metricView(key, cfg))),
    categories: CATEGORY_ORDER.filter((key) => files.some((f) => f.category === key))
      .map((key) => ({ key: key, label: loc.categories[key] })),
    files: files,
    /* The page's tree is the project's tree: every path rather than the columns alone. The numbers belong to
     * columns only, which is why each catalogue entry says what it did not get: `why` empty — the file is
     * measured, otherwise a reason is named. */
    catalog: projectTree(root, cfg.output, files.map((f) => (f.path === null ? f.paths[0] : f.path))),
    rows: rows.map((r) => Object.assign(rowShape(r),
      { href: rowHref(r.section, r.sha, cfg), values: r.cells })),
    now: state.map((s) => (s === null ? null : s.cells)),
    /* Which columns the last commit touched: the page puts those in front by this mark — a reader needs what
     * changed just now rather than the rest. This is a fact from the history rather than a derived quantity:
     * it does not count anything, it says what the edit touched. */
    last: last,
    skipped: dropped.map(skipLine)
  };
}

/* The part of a row shared by both answers: the page's contract (`--data`) and the older `--json` form (frozen
 * by the parity fixture). One place, because these two answers can drift apart exactly here, and **the order
 * of the fields is the bytes of the answer**: the object holds them in the order the frozen form prints. */
export function rowShape(r) {
  return {
    sha: r.sha,
    when: r.when,
    subject: r.subject,
    section: r.section === null ? null : { id: r.section.id, head: r.section.head, added: r.section.added }
  };
}

/* The derived quantities live in `src/derived.js`: the page gets that whole file pasted into itself as text
 * (`pageScript`), while the terminal answers import it. There is no second calculation of the same table, so
 * the page's numbers and the artifact's bytes have nothing to drift apart with — `test/contract-derived.test.js`
 * guards that. */

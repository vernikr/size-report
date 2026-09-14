import path from 'path';
import { LOCALES } from './locales.js';
import { metricView } from './metrics.js';
import { rowHref } from './journal.js';
import { build } from './history.js';
import { TOOL_PKG } from './tool.js';

/* Категории файлов и контракт со страницей: абсолютные значения и устройство
 * таблицы, без единой производной величины. Всё, что страница считает сама,
 * начинается там, где этот модуль заканчивается. */

/* Категория файла — только для быстрых кнопок «включить/выключить группу» на
 * странице: на числа она не влияет. Правило одно — расширение даёт категорию, всё
 * остальное считается кодом; категория, заданная в настройках колонки, старше
 * правила, и в данных видно, откуда она взялась (`categoryBy`): ручное решение
 * объяснимо, а таблица расширений — догадка по имени файла. */
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

/* Контракт между движком и страницей: абсолютные значения и устройство таблицы —
 * и ни одной производной величины. Дельты, суммы, «сейчас» и фильтры считает
 * страница: движок не знает, что включено в просмотр, поэтому заранее посчитать
 * сумму он не может. Числа в контракте те же, что в артефакте, — это та же правда,
 * разложенная по полям.
 *
 * Причины пропущенных коммитов пока идут строками движка: разложить их по полям —
 * вместе с командой объяснения (план, §5, шаг 5). */
export function reportData(cfg, root) {
  const { rows, state, skipped } = build(cfg, root);
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
    rows: rows.map((r) => ({
      sha: r.sha,
      when: r.when,
      subject: r.subject,
      section: r.section === null ? null : { id: r.section.id, head: r.section.head, added: r.section.added },
      href: rowHref(r.section, r.sha, cfg),
      values: r.cells
    })),
    now: state.map((s) => (s === null ? null : s.cells)),
    skipped: skipped
  };
}

/* Производные величины живут в `src/derived.js`: их считает и артефакт (импорт
 * ниже), и страница (получает тот же файл текстом). Второго расчёта той же
 * таблицы нет вовсе, поэтому разойтись молча двум отчётам нечем — это стережёт
 * `test/contract.test.js`. */

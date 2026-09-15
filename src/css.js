import fs from 'node:fs';

/* The report's styling is ordinary `.css` next to the code rather than strings inside modules — the same rule
 * as for the page's program (`src/page/app.js`): an editor sees a real source file instead of a template
 * string. They are read from disk relative to their own place, so they work for whoever installed the package
 * as well.
 *
 * There are two sets, each with a role of its own:
 *
 *   1. `table.css` — the **table**: cell geometry, the sticky header and commit column, a commit's caption,
 *      the colours of the deltas.
 *   2. `page/app.css` — the page's look **on top of the table**: the canvas, the panel of choices, the empty
 *      states and the adaptation to a narrow window.
 *
 * The convention about the colour of a delta is set once, in `table.css`: `.up` green, `.down` red (growth is
 * "more logic" rather than alarm). It has no second place on purpose: growth cannot be shown in different
 * colours in two spots of one page. Changing the convention is two lines in `table.css`.
 *
 * The path given to `readCss` is relative to the `src/` directory: that is how the engine sees it wherever it
 * lies.
 */

export const TABLE_CSS = readCss('./table.css');
export const PAGE_CSS = readCss('./page/app.css');

function readCss(name) {
  return fs.readFileSync(new URL(name, import.meta.url), 'utf8').trim();
}

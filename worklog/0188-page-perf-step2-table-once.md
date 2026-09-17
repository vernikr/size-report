# 0188 — step 2: the table is built once, a click shows and hides

Requested: step 02 (`plans/2026-09-17-page-perf/02-columns-hidden.md`) as written there — the table is
built once and a click changes visibility and rewrites the totals instead of rebuilding the nodes.
Step 03 is not started, virtualization is not touched, and nothing is committed or released.

## What changed

The table is assembled once with every column of every file, in the order the reader sees (the last
commit's columns first, then the settings' order), and everything afterwards changes only what is
visible:

- `src/page/table.js` — rebuilt around one pass. `appTable` returns a cache: the nodes of each file's
  column, the group headings whose `colSpan` follows the enabled metrics, the total cells, the running
  sums and those sums with every column on. `appColumn` toggles a class over a column, `appContribute`
  adds or subtracts a file's own numbers, `appTotals` writes the totals in place, `appTotalsReset` starts
  from the all-on sums and takes the switched-off columns out, `appMetrics` is one class on the grid plus
  the headings' `colSpan`. Every cell of a group now carries `g` and its metric's track (`m0`…), and the
  group's left border is carried by the first *enabled* metric by styling rather than by code.
- `src/page/panel.js` — the panel is built once; a click writes only the fields it reached (the file's
  box, the folders above it, the categories holding it), and nothing is rebuilt.
- `src/page/app.js` — two paths: `appPaint` (the first drawing, a memory record, a link) and `appSwitch`
  / `appSwitchGroup` / `appSwitchMetric`. `appRender`, the scroll save-restore and the focus walk are
  gone; the frozen list of the page's functions now names them as forbidden.
- `src/table.css` — the border/`off` rules in the shared part (the page's own styling may not repeat a
  shared selector); `eslint.config.js` loses the `appRender` global (a gate file: `Gate-Change:` material
  at commit time).

## Measured (2026-09-17)

Both artifacts opened from disk in Chrome and in jsdom — the unit of the report `page-clicks-and-weight-cons.txt`
(`reports/click-bench.mjs`, a throwaway bench in the gitignored `reports/`); 216 commits × 266 files × 3
metrics = 173 817 cells in both versions.

| Interaction | Chrome before → after | jsdom before → after |
|---|---:|---:|
| one file off | 660 → 16 ms | 6 228 → 130 ms |
| one folder off | 516 → 69 ms | 6 231 → 339 ms |
| one metric off | 380 → 7.7 ms | 4 853 → 8.3 ms |
| nodes made by a click | 122 614–182 364 → 0 (metric) / 651 (the totals) | the same |
| startup | 3.30 → 2.85 s | 5.4 → 6.2 s |
| nodes in the document | 181 585 → 182 386 | the same |
| forced layout after a click | 988–2 288 → 339–1 534 ms | — |

- The click is the promise: ×48 (a file) to ×585 (a metric) in jsdom, ~×50 in Chrome, and a metric
  appends nothing at all. The report's ×193/×1710 were jsdom-prototype numbers and land in range here
  only for a folder and a metric.
- Startup: no gain in jsdom (the same 173 817 cells cost 5.0–5.7 s in a bare micro-benchmark in the same
  process — the two figures are within the noise of a loaded machine), a gain in Chrome. Memory does not
  move at all: the full table is in the DOM either way, exactly as the report's §10.4 predicts. What goes
  away is the doubling during a click.
- The floor is now the browser's layout (339–1 534 ms against 988–2 288 for `void body.offsetWidth`
  after a click), not the page's JS: that is steps 09–12, and the report's §9 asked for exactly this
  measurement.
- The artifact: HEAD 1 501 645 → 1 440 325 B (data −57 861 with step 01's `approx` and three new commits,
  styling −3 746, the pasted program +246 net — its code +3 627, its comments −3 381). Step 02 is not a
  weight step: it buys the click and pays ~3.6 KB of code that steps 06–07 would compress.

## Checks

Two checks were added (72 fast of 177; `README.md`'s table of runs moved with them) and four were
rewritten to the new promise instead of being deleted:

- a click makes no table — what a click appends (a metric: nothing; the rest: at most the totals' cells),
  that the rows and the cells are still the same objects, and that putting every switch back restores the
  full table and the full total;
- the totals of a mixed choice (a folder, a category and the `min` metric off) cell by cell against the
  engine's own `rowModel` / `totalsOf` — the guard the risk section asked for;
- the column order after a hidden column, the empty states, the scroll a click does not touch, and the
  frozen function list (now with `appRowCells`, and with the four removed names forbidden).

The red duplication sensor was fixed in the code, not in the baseline: the row-building loop became
`appRowCells`, and the two suites that build a fresh project for `--init` now share
`tools/harness.js`'s `draftedRepo` (the helper the upstream branch grew for the same duplication).
`verify:fast` green (5 steps), `verify` green (8 steps, 177 checks).

## Left open

Not committed and not released, as instructed: the artifact on disk was rebuilt by the local engine
(`node bin/size.js --write`), while `node_modules/@vernikr/size-report` still holds 2.4.0 — until a
release attaches the new copy, the post-commit hook would rebuild the report with the old page program.
Next in the plan: step 03 (the panel in place). Half of it is already here — the panel is built once and
the two workarounds (the scroll save-restore and the focus-by-ordinal walk) are deleted. What remains of
that step is the rest: the index lists computed once at load (`filesByCategory`, `folderFiles`,
`folderParents`, `fileFolders`) instead of the subtree queries the state updates read from the DOM today,
and the drift check that walks the whole panel against the view after a random sequence of clicks.

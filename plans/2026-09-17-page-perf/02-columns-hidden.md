# 02 — Build the table once, toggle visibility

Source: report §2 and §7 step 2. Depends on: 01 (the removed `appApprox` walk is part of the same
render). Independent of 05 (this step does not touch the data). State: **done** (2026-09-17) — what it is
in code, what was measured and what the acceptance answered are at the end of this file.

## Why it works at all

Three invariants, all visible in the code:

1. **A file's cell does not depend on the reader.** What a cell says and how it is coloured comes from
   `cellParts` (commit row) and `valueParts` ("now" row) over the pair (commit, file) and a metric; the
   choice only decides whether the column is visible.
2. **The order of columns is static.** The sort "columns the last commit touched first" (`src/page/app.js`)
   is stable and its key depends on the file alone, so the visible table is always a subsequence of the
   full one — columns can be hidden without being moved.
3. **Only the totals depend on the choice** (≤ 214 rows × ≤ 3 metrics = 642 cells) plus which columns are
   visible.

Measured cost today: `appTable()` is 3 904 ms of ~4 800 ms of a click (81 %), while all the arithmetic of
a render (`rowModel` over 213 rows + `group()` over the non-empty values) is 96 ms (2 %). The price of a
click is creating and destroying DOM nodes, and the nodes hold no information the choice changes.

## What to build

**The full table at load.** All 263 files × 3 metrics in the final order. The number of cells is the same
as today (170 759 in this repository), so startup does not get more expensive — it gets cheaper by one
render, because `appTable()` stops running per click.

**Classes on every cell and header.** `m0`, `m1`, `m2` (the metric's track, in the order of `data.metrics`),
`g` on **every** cell of a group (today only the first one gets it), and `off` while a cell is hidden.

**The group border without a line of JS** (report §2.3). The border is carried by the first *enabled*
metric, which is three rules instead of eight combinations:

```css
#grid .g                          { border-left: 0; }
#grid:not(.m-off-0) .g.m0         { border-left: 1px solid rgba(127,127,127,.35); }
#grid.m-off-0:not(.m-off-1) .g.m1 { border-left: 1px solid rgba(127,127,127,.35); }
#grid.m-off-0.m-off-1 .g.m2       { border-left: 1px solid rgba(127,127,127,.35); }
#grid.m-off-0 .m0, #grid.m-off-1 .m1, #grid.m-off-2 .m2 { display: none; }
```

They replace `.g { border-left }` of `src/table.css` (where the table's geometry lives, so that
`src/page/app.css` does not repeat a shared selector — `test/page-view.test.js` fails on a clash), and
they work for the total's group and every file's group alike, so the border "total | first visible file"
moves by itself. `border-collapse: collapse` is already set, so hiding cells re-lays the column widths
correctly.

**The cache of node references — the condition the trick rests on.** Measured (`micro-dom.mjs`): reading
`tr.children[i]` per cell costs 0.0254 ms against 0.0070 ms for `classList.toggle`, so a naive
implementation spends three quarters of the time reaching the children. The cache is free: the first
render creates every node anyway.

Per file column `i` (646 nodes): 214 rows × 3 metrics of body cells, 1 group `th`, 3 metric `th` of the
second header row. Plus `totalCells[r][mi]` (214 × 3, rewritten rather than hidden), `spanTh` (264 `th`
with `colSpan`) and `rowsData[r]` (a data row number, `null` for the "now" row).

**Incremental totals.** A total is linear, so a delta of the sum is the sum of the deltas:

```js
const v = data.rows[r].values[i];
if (v !== null) {
  totals[mi][r] += on ? v[key] : -v[key];
  totalCells[r][mi].textContent = group(Math.round(totals[mi][r]));
}
```

Cost of a file click: O(rows × metrics) instead of O(rows × files × metrics); a folder of K files is
O(rows × K × metrics). The "now" row is updated by the same accumulator — its values are the last data
row's, so forgetting it is the one divergence a prototype had.

**Cell texts prepared once.** Format all non-empty cells at load (1 169 distinct values in this
repository, 63.6 ms once) instead of on every click.

**Handlers.** A file: set `appView.files[i]`, toggle `off` on its 646 nodes, fix the totals, then update
the checkboxes (03). A folder: iterate the ready index list of its subtree. A category: iterate
`filesByCategory[key]`. A metric: one class on `#grid` plus `colSpan` on 264 headers — measured 2.20 ms /
1.37 ms against 433 ms for walking the metric's 56 496 cells. Folding a folder stays as it is: it already
rebuilds nothing.

**The empty states move unchanged.** `appState(metricsCount, filesCount)` hides `#shell` at zero metrics
and shows `#state` at zero files; the new path calls it instead of `appTable`'s early `return`.

## What it is in code

Written to the shape above; the names and the places as they came out:

- `src/page/table.js` — one built table. `appTable(grid)` fills and returns the cache: `cols[i]` (every node of the
  column of file `i` — its cells and its headings), `spans` (the group headings whose `colSpan` follows the enabled
  metrics), `cells[mi][r]` (the totals), `sums[mi][r]` (the running sums) and `all` (those sums with every column on).
  `appOrder` is the column order, `appColumn` toggles `off` over a column, `appContribute` adds or subtracts a file's
  own numbers, `appTotals` writes the totals where they stand, `appTotalsReset` starts from `all` and takes the
  switched-off columns out, `appMetrics` sets one class on the grid plus the headings' `colSpan`; `appRowCells` is the
  one walk over a row's files, shared by the commit rows and the "now" row, and the empty states (`appState`) moved
  here from `app.js` because that is what now decides them.
- `src/page/panel.js` — built once: `appFields` keeps the nodes of the switches (by metric key, file index, folder path,
  category key), `appPanelState(indexes)` writes only the fields the click reached, and `appDirState` / `appCatState`
  read a folder's or a category's state from the files below it.
- `src/page/app.js` — two paths and no third: `appPaint` (the whole view — the first drawing, a record from the
  browser's memory, a link) and `appSwitch` / `appSwitchGroup` / `appSwitchMetric` per click. `appRender`,
  `appScrollTop`, `appScrollBack` and the focus-by-order-number walk are gone, and the frozen list of the page's
  functions names them as forbidden rather than merely absent.
- `src/table.css` — the group's left border is carried by the first *enabled* metric: four rules (the registry holds
  four metrics: raw, min, tok, gzip) instead of eight combinations, `#grid .off` hides a column, and a group heading has
  its own edge while any metric is on. They live in the shared part rather than in `src/page/app.css`, which may not
  repeat a shared selector.
- `eslint.config.js` — the shared names of the page's chapters lose `appRender`: no click asks for a redraw any more. A
  gate file, so the commit that carries it needs the `Gate-Change:` trailer.

## Acceptance

- A click creates **zero** nodes. Between the plan's two statements the measurement sides with §2.5: a metric switch
  appends nothing at all, while a file, a folder or a category appends the totals' cells and nothing else — the criterion
  cannot be "the count of elements did not change", because the totals are written again.
- Switching a metric is O(1) class + 264 `colSpan` writes — no per-cell pass anywhere.
- The order of columns holds after switching a file off (`test/page-view.test.js` already checks this).
- The numbers the page shows still come from `src/derived.js` alone: the incremental totals are the only
  new arithmetic, and `test/contract-derived.test.js` / `test/page-view.test.js` compare them with the
  full sum for a set of choices.
- `pnpm test:all` and `pnpm run verify:fast` green.

## What was measured (2026-09-17)

Both files opened from disk in Chrome (DevTools, this machine — a loaded host: the load average was 7.8 at the start
of the runs) and in jsdom, the unit the report was measured in (`reports/click-bench.mjs`, a throwaway bench that
lives in the gitignored `reports/`). The table holds 173 817 cells in both versions of the page: 216 commits × 266
files × 3 metrics (the report's own artifact was 213 × 263 × 3).

| Interaction | Chrome, before | Chrome, after | jsdom, before | jsdom, after |
|---|---:|---:|---:|---:|
| nodes in the document after load | 181 585 | 182 386 | 181 585 | 182 386 |
| startup (DOMContentLoaded) | 3 299 / 3 327 ms | 2 821 / 2 899 ms | 5 409 / 5 686 / 5 035 ms | 5 990 / 5 871 / 6 827 ms |
| JS heap after load | 10 MB | 10 MB | — | — |
| one file off / on | 660 / 655 ms | 16 / 11 / 10 ms | 6 228 / 6 527 ms | 130 / 137 ms |
| one folder (`src/`) off / on | 516 / 492 ms | 69 / 58 ms | 6 231 / 6 208 ms | 339 / 361 ms |
| the `min` metric off / on | 380 / 525 ms | 7.7 / 5.7 ms | 4 853 / 6 400 ms | 8.3 / 85 ms |
| nodes made by a click | 122 614–182 364 | 0 (a metric), 645–651 (the totals) | the same | the same |
| forced layout after a click | 988–2 288 ms | 339–1 534 ms | — | — |

Read honestly:

- **The click is where the promise holds.** jsdom: one file 6 228 → 130 ms (×48), one folder 6 231 → 339 ms (×18), a
  metric 4 853 → 8.3 ms (×585). Chrome: one file 660 → ~13 ms (×50), a metric 380 → 7.7 ms (×49). The report's ×193 and
  ×1710 were jsdom-prototype numbers; ×193 comes true in jsdom only for a folder, ×1710 for a metric (and ×585 is
  measured, not estimated).
- **Startup did not get cheaper in jsdom** (5.4 → 6.2 s) and did in Chrome (3.30 → 2.85 s). The cell count is the same,
  and in jsdom the same 173 817 cells cost 5.0–5.7 s in a bare micro-benchmark in the same process — so the two jsdom
  figures are within the noise of a loaded machine, but the honest reading is "no gain". What is left of the startup is
  the nodes themselves: that is steps 09–12.
- **Memory does not move at this step** (heap 10 MB, +801 nodes): exactly what the report's §10.4 predicts — the full
  table is in the DOM either way. What goes away is the doubling during a click: 170 000 nodes used to die while the
  next 170 000 were built.
- **The floor is layout, not JS**: forcing layout after a click (`void body.offsetWidth`) costs 339–1 534 ms on the new
  page against 988–2 288 on the old one — the price of a table ~274 Mpx in area, i.e. the report's §10.3. Step 09
  (`table-layout: fixed`) is now the interesting measurement, and it is cheap to take.

The artifact: HEAD 1 501 645 → 1 440 325 B, of which the data −57 861 (the `approx` block of step 01, against three
commits and three columns added since), the styling −3 746, and the pasted program +246 net — its code part +3 627 B,
its comments part −3 381 B. So step 02 is not a weight step: it buys the click and pays ~3.6 KB of code (caches, metric
tracks, the panel's fields), which step 06 (comments) and 07 (minification) would compress again.

## The checks and the baselines

- **A click makes no table.** Appends are counted by wrapping the page's own `appendChild` / `insertBefore` (an element
  count would move with the deltas the totals draw): a metric — nothing; a file, a folder or a category — at most the
  totals' cells (rows × metrics, 651 here) against 182 364 for a rebuild, ×280. The same check asserts that the rows and
  the cells are still the objects the first drawing made, and that after every switch is put back the whole table shows
  and the total is the full one again.
- **`pnpm test:all` and `pnpm run verify:fast` green** — two checks were added here (the numbers of the runs moved with
  them: 72 checks of 177 at the time, 73 of 178 after step 03's drift guard), the full run 177 then, and
  `pnpm run verify` green through its 8 steps (parity with the live project, the reproducibility of the standards, the
  tarball).
- **The order of the columns holds after a file is switched off** — the existing check was extended: the hidden column
  keeps its place in the header and carries `off`.
- **The numbers still come from `src/derived.js` alone** — a new check compares every total cell of every row with
  `rowModel` / `totalsOf` for a mixed choice (a folder, a category and the `min` metric off) that the page never painted
  as a whole. That is the guard the risk section asked for: a comparison with the full count, not a second copy of the
  formula.
- **The metric tracks of the styling cover the registry** — a new assertion inside the styling check: the shared part
  carries `m0`…`m3`, and a fifth metric in `src/metrics.js` would otherwise come out with no left border and no way to
  be hidden.
- **Baselines untouched** ✓ — `dup` green (5 clones in the tree against 15 fingerprints in the baseline: three of the
  old ones disappeared with the code and two were fixed rather than baselined), `metrics` green, no baseline file in the
  diff.
- **The red duplication sensor was fixed in the code, not in the baseline**: the two near-clones the sensor named were
  the row-building loop of `table.js` (now `appRowCells`) and the two suites that build a fresh project for `--init`
  (now `tools/harness.js`'s `draftedRepo`, the same helper the upstream branch grew).

Not done here, as instructed: nothing is committed and nothing is released. The artifact on disk was rebuilt by the
**local** engine (`node bin/size.js --write`), while `node_modules/@vernikr/size-report` still holds 2.4.0 — so until a
release attaches the new copy, the post-commit hook would rebuild the report with the old page program. The release
order (version, journal section, tag, release, attached copy) is the user's decision.

## Risks

- **The totals accumulator is new arithmetic.** Guarded as planned: a check recomputes every total cell from scratch
  (`rowModel` / `totalsOf`) for a mixed choice and compares — no second copy of the formula in the page.
- **The frozen function list.** `test/page-view.test.js` holds the list of the page's function names; it gained
  `appRowCells`, and it now names the four that must not come back (`appRender`, `appScrollTop`, `appScrollBack`,
  `appSubHead`) rather than merely missing them.
- **Layout cost after a point edit.** Measured in Chrome, and it is the whole of what is left: forcing layout after a
  click costs 339–1 534 ms against 988–2 288 before, so the remaining price of a click is the browser's layout of a
  ~274 Mpx table rather than anything the page does. That floor is what steps 09–12 are for (the report's §9 said the
  same, and this is the measurement it asked for).

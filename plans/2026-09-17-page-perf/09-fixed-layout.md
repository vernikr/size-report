# 09 — `table-layout: fixed`, widths computed by the builder

Source: report §10.5 item 1 (and §7 step 9). Depends on: 02 (hidden columns) and 05 (the sparse model is
where the widths are computed from cheapest). It is the condition for step 10.

## Why

`table-layout` is not declared, so the browser lays the grid out as `auto`: to assign the width of 787
columns it **measures all 170 759 cells**. Measured area of the table: ~50 700 px wide (45 719 px of it from
the cell contents, 4 693 px the `white-space: nowrap` of long captions) by 216 rows × 25 px — about
**274 million px²**, and in Chrome that is the difference between tens of megabytes of layout and the
~1.0 GB of raster the report estimates for one layer (§10.3).

With `fixed`, the widths come from a `<colgroup>` and the cells are not walked at all. The builder knows the
widths: the column's width is the widest of its cells and its caption, computed in the same pass that
produces the table.

## What to build

- The builder computes, per metric column, `max(ширина чисел, ширина подписи)` — the numbers are digits with
  thin-space grouping, and the font is the page's own, so a `ch`-based width is a measure of the text rather
  than a guess. Include the group border and the cell padding.
- `pageHtml` emits `<colgroup>` with one `<col>` per metric column (and one for the commit column, currently
  `.clip` 300 px, 190 px in a narrow window). Hiding a metric must hide its `<col>`s too: the `<col>`s carry
  the `m0`/`m1`/`m2` classes of step 02 and are switched by the same `m-off-N` rules.
- `<colgroup>` for 787 columns is order 5 KiB in the artifact, and it also makes the first layout faster.
- Riders from the report (§10.5 items 4 and 6, worth taking in the same pass or naming as dropped):
  `white-space: nowrap` off the header `th` (−4 693 px of width, at the cost of a taller header), `padding`
  7 → 4 px and `.clip` 300 → 190 px (50 700 → 41 200 px, −19 % of the area).

## Acceptance

- The table's geometry is unchanged where it matters: no clipped number (a check that compares each column's
  computed width with the longest text in it, on the fixture and on this repository's report), the commit
  column keeps its clip and its sticky behaviour.
- Hiding a metric shrinks the grid by exactly its `<col>`s (the existing visibility suites still hold).
- Fewer layout passes at load, measured in Chrome (DevTools → Performance monitor: layout count and time)
  rather than in jsdom: jsdom has no layout at all, so this step's effect is only measurable in a browser.
- `pnpm run verify:fast` green.

## Risks

- **A width the builder got wrong** shows as a clipped or a sprawling column. The guard is a comparison
  against the widest cell, computed from the data rather than from the rendering — and a real-browser look
  before the step is called closed.
- **Sticky header and sticky commit column** interact with explicit widths (`top: 0` / `top: 22px`,
  `left: 0` in `src/table.css`); they need to be looked at in a browser on the live table.

## What it is in code

- **`src/page/table.js`** — the widths are counted, not measured, and before a single node is made:
  `appBreadth(text)` is a text in `ch` (a digit is one `ch` in this table's font; the thin space of the
  grouping is counted as a third of a digit — see the measurements below for why that one fraction matters),
  `appWidest(files, keys)` walks the commit rows through `rowModel` and the “now” row through `nowModel` —
  the very models the cells are drawn from, so a column cannot be sized for a number other than the one that
  will stand in it — plus the metric's own caption, and `appGroupWide(per, label)` gives every column of a
  group at least the group caption's share, so a group can never come out narrower than its name.
  `appCols(files, wide, cache)` builds the `<colgroup>`: one `<col>` per metric with the metric's track
  (`m0`, `m1`, …) and its counted width in `--ch`, and the columns of a file are pushed into the same cache
  entry as its cells and headings — so one switch writes `off` over all three. `appTable` inserts the group
  before the rows: a `<colgroup>` is where a fixed layout reads its widths, and it has to be in the markup
  before the browser settles on a layout.
- **`src/table.css`** — `table-layout: fixed` **and** a definite width (`width: 100%`), both on the same rule;
  `#grid col { width: calc(var(--ch, 0px) + var(--cell-pad) * 2 + var(--col-line)); }`,
  `#grid col.c-commit { width: calc(var(--clip) + …); }` with `--cell-pad: 4px`, `--col-line: 1px`,
  `--clip: 190px`; the riders: cell padding 7 → 4 px, `.clip` 300 → 190 px (`width: 100%` now — the column
  carries the measure, not the cell), the narrow-window `.clip { width: 190px }` in `src/page/app.css` gone
  (it would have overridden the fill, and 190 px is what it already asked for).
- **`test/page-cols.test.js`** — a suite of its own, because `page-view` is at its 450-line ceiling: the order
  of the columns moved there from `page-view`, plus the two new checks — every column wide enough for the
  longest text in it (against the text the cells carry, and against both declarations of the fixed layout on
  the shared styling), and a switch reaching the column itself rather than only its cells.
- **This is where the plan’s letter was left, each time with a reason:**
  1. **The `<colgroup>` is built by the page, not emitted by `build.js`.** The widths are a count of the data
     the page already holds after unpacking, so markup would put ~30 KB of geometry into the artifact (790
     columns × the 38 B of a `<col>` with a style — the block is the only packed part of the file) where the
     counting is 1 900 B of program. Measured: the artifact grew 2 078 B, and at rest the file carries no
     geometry at all (0 columns before the first drawing).
  2. **The `white-space: nowrap` rider on the header was *not* taken.** The second header row sticks at
     `top: 22px`, so a caption that wraps would change the first row’s height and the two sticky rows would
     overlap. The captions are made to fit instead — the group’s columns carry the caption’s share — and both
     header rows keep the heights the offsets are written for.
  3. **The other riders were taken**: padding 7 → 4 px and `.clip` 300 → 190 px.

## What was measured (2026-09-17)

In live Chrome, `file://`, on this repository's artifact — the browser the acceptance asks for, because jsdom has no
layout at all. Both sides come from **the same data and the same program**: the “before” is the built artifact with
step 09's styling taken back (`table-layout`/`width` off, the column rules and `#grid`'s measures off, padding 7 px,
`.clip` 300 px), so the texts are comparable. Every cell's text was measured where it lies
(`Range.getBoundingClientRect`) against the content box of its column.

| | before (automatic) | after (fixed) |
|---|---:|---:|
| the table’s width | 55 027 px | 59 278 px (**+7.7 %**) |
| the commit column | 315 px | **199 px** (its clip box 191 px, a long subject clipped with an ellipsis) |
| the first metric columns | 73 / 72 / 63 px | 70 / 70 / 59 px |
| cells whose text is wider than their column | 0 of 174 468 | **0 of 174 468** (`worst` empty) |
| group captions overflowing / wrapped | 0 / 0 | 0 / 0 |
| header rows’ heights | 21 / 22 px | 21 / 22 px |
| sticky offsets after scrolling the shell (header / commit / corner) | 23 / 1 / 1 | 23 / 1 / 1 |
| delta colours (`.up` / `.down`) | `rgb(30, 132, 73)` / `rgb(192, 57, 43)` | the same |
| fingerprint of every text (cells, headings, panel, note) | 2098295167 | **2098295167** |

**The narrow window, where the page’s own styling shortens the commit’s clip box** (`src/page/app.css` has no rule for it
any more: `--clip` is the shared measure, and 190 px is what the narrow window always asked for). At 800 × 900 the
same artifact gives: the table 57 206 px, the commit column 199 px, its clip box 191 px, **0 cells of 174 468 drawing
wider than their column**, the header 23 px from the shell’s top and the commit column 1 px from its left. The table is
narrower there because the count is in `ch` and that styling sets `font-size: 12px` instead of 12.5 — the widths follow
the font by themselves, which is what the unit was for.

**The trap this step fell into, and the reason it is written down here:** `table-layout: fixed` with `width: auto`
**is not a fixed layout**. The specification says a value of `auto` means the automatic algorithm, and Chrome does
exactly that — the columns' widths are ignored, every cell is measured all the same, and nothing looks wrong except
that nothing is won. Measured before the width was named: the commit column came out 804 px (its content) instead of
199, and the whole table was 52 263 px, i.e. the automatic algorithm's own answer. The page is the same either way,
which is why a check now reads both declarations off the shared styling.

**The win, and where it does not show.** The same table with the two algorithms switched at runtime under the same
content (cold measurements, five runs, Colima-free machine load notwithstanding): under `auto` the widths cost
**831–979 ms**, under `fixed` **0.1 ms**. That is the measuring this step removes — and it is only ~1 s of a ~2 s
first layout, because building a box for each of the 174 468 cells is what dominates. On the artifact itself the
step **does not show a win**:

| one load (CDP `Performance.getMetrics`) | before | after |
|---|---:|---:|
| `LayoutCount` | 1 | 1 |
| `LayoutDuration` | 1.44–1.68 s | 1.25–2.97 s |
| the first layout of the finished table, forced where it happens | 1.83–2.18 s | 1.83–4.02 s |
| a click to a forced layout (metric off/on/off) | 1 379 / 2 036 / 1 814 ms | 1 750 / 2 034 / 1 601 ms |
| a click to a forced layout (file off/on/off) | 844 / 530 / 528 ms | 834 / 512 / 493 ms |

The plan's premise — “tens of megabytes of layout against ~1.0 GB of raster”, “fewer layout passes” — is **not
confirmed on this artifact**: the layout count is 1 either way, the times differ by less than the machine's noise,
and a click that hides a column costs the same, because hiding cells rebuilds the box tree, which no table algorithm
avoids. What is confirmed is the narrower fact the fixed algorithm buys: the widths are not measured (0.1 ms against
~0.9 s). The plan's §10 premise for step 10 stays what it was: the cells, not the widths, are the cost.

**What the step costs, measured as well:** the artifact grows **78 319 → 80 397 B** (+2 078 B — the counting, the
colgroup and the measuring of a breadth), and the table is **7.7 % wider** than the automatic layout's own answer.
The width comes from the count erring on the safe side — a letter is 0.84 of a `ch` and a slash 0.48, but both are
counted as a whole digit, and a group's caption is spread over its metrics, so the file names (the bulk of the
label-bound groups) set their groups some 20 % wider than their drawn text. Without the thin space's fraction the
width would be 10.5 % over instead of 7.7 %, which is the whole reason that one fraction is in the count.

## Acceptance answered

- **The geometry is unchanged where it matters — no clipped number** ✓ — the sweep above measures all 174 468 cells
  in Chrome: none of them draws wider than its column. The commit column keeps its clip (191 px, ellipsis on a long
  subject) and its sticky behaviour (1 px from the shell's edge after scrolling sideways), and the header stays where
  `top: 0` / `top: 22px` put it with both rows at their old heights.
- **Hiding a metric shrinks the grid by exactly its `<col>`s** ✓ — in Chrome, adding `m-off-0` to the table takes
  **19 963 px** off its width (the metric's columns, verified by the same class rule that hides the cells; and the
  remaining columns do not move by a pixel, which is what the columns' own order is for). jsdom cannot see this — the
  classes it can see are checked in `page-cols` (`a switch reaches the column itself, and not only its cells`).
- **Fewer layout passes at load, measured in Chrome** ✗ — **not confirmed**: 1 pass either way, and the time is
  within the noise. The step's other half of the same acceptance — the cells not being measured — is confirmed
  (0.1 ms against 831–979 ms on the same table).
- **`pnpm run verify:fast` green** ✓ — 5 steps, 80 checks of 185 (the new suite is listed in `tools/suites.js`);
  two `--write` runs give the same artifact (md5 `62a1d02e…`), and the encoder/decoder round trip still takes the
  decoder off disk.

## What stayed an assumption

- **Everything here was measured in Chrome (153)** — the arithmetic of a fixed layout (a column's `width` is its
  **border box**: `7ch` gave a 47 px content box with 4 px of padding each side), `display: none` on a `<col>`
  actually removing the column, and `calc()` over a custom property on a `<col>`. Firefox and Safari are the same
  platform behaviour in their documentation rather than measured here.
- **The `ch` unit against the tabular digit is the font's** (0.629 em against 0.619 em, Chrome's default UI font): the
  count leans wide by ~1.7 %, which is the direction a clipped number cannot come from, but a page opened in a font
  whose digits are wider than its `0` would count the same and draw slightly differently.
- **The raster area** — the plan's §10.3 counts it in memory — is 7.7 % wider with this step than without it. It was
  not measured (that needs DevTools' memory panel and a screenshot of the layer), so the step's net effect on memory
  is an open question rather than a claim: the widths are no longer measured, the table is wider.

To repeat: `node probes/archive/step-09-layout.mjs before=<file> after=<file>` with Chrome at
`--remote-debugging-port=9222` (the probe is a one-off under `reports/`, which is gitignored; it opens each file in a
page of its own, clears the reader's storage between them, times the first forced layout after the build, reads the
CDP counters per load, sweeps every cell for clipping, checks the sticky edges and the delta colours, and switches
the two algorithms against each other on the one table). The before/after pair and the two screenshots are in
`worklog/0195-page-perf-step9-fixed-layout.md`.

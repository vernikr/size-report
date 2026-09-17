# 10 — `content-visibility: auto` on the rows

Source: report §10.5 item 2 (and §7 step 10). Depends on: 09 (`table-layout: fixed` is required for a
reliable intrinsic size on table rows).

## Why

Rows off screen are not laid out and not painted, while their nodes **stay in the DOM** — so page search,
selecting and copying the table, and printing all keep working. The layout memory falls roughly by the ratio
of visible rows to all rows (~30–40 of 216 here, and more as the history grows). It is an order of magnitude
cheaper than virtualization (step 12) and it does not change the markup model the rest of the plan builds on.

## What to build

- On the body rows (and the "now" row): `content-visibility: auto` plus `contain-intrinsic-size: <row width>
  <row height>` so that the skipped rows keep a size and the scrollbar does not jump.
- The height is the row's own (25 px today, plus the header) and the width is the grid's, both known from the
  builder (step 09), so no measurement is needed at runtime.
- Do not put it on the header rows or on the sticky commit column's rows: those are always painted, and the
  sticky layer is what the report's §10.5 item 8 suspects of being expensive.

## Open question, to be answered in a browser

**Does it work on `<tr>`?** `content-visibility` is defined for elements with a layout box; a table row is a
special case and behaviour has differed between engines. The check is a live one: open the artifact in
Chrome, look at Layout count and Layout duration in the Performance monitor while scrolling, and compare
with the same report without the property. If rows do not honour it, the report's fallback stands: this step
is dropped and step 12 (virtualization) becomes the only answer to layout memory — which is why this step is
worth measuring before it is written into the styling.

## Acceptance

- Scrolling to the last row paints it (no blank band), the scrollbar length does not jump, and the table's
  geometry is the same before and after the change when the whole table is on screen.
- `content-visibility` is present only where it is wanted: a check that the property does not reach the
  header, the commit column or the "now" row.
- In Chrome: layout count and duration while scrolling are materially lower than today's; the numbers are
  recorded in the report of this pass.
- `pnpm test:all` green (jsdom does not implement the property, so the suites prove only that nothing else
  moved).

## Risks

- **Printing** uses a different viewport; rows that were skipped may come out unpainted on the first print
  pass. Worth a print preview check in Chrome before closing the step.
- **Anchor/`id` navigation** into a skipped row: `content-visibility` keeps the element in the DOM, so this
  is fine, but the sticky header can then jump — a live check.

## Where the property is dead: the answer to the open question (2026-09-17)

Measured in Chrome 153, one page per variant, each with a single scroll box at the top — the geometry in which plain
`<div>`s **are** skipped (`probes/step-10-tables.mjs`; each page builds 200 rows by script and the browser's own
`contentvisibilityautostatechange` is the witness, not a rectangle — see below).

| the property sits on | elements | skipped | events |
|---|---:|---:|---:|
| 200 `<tr>`, collapsed borders | 200 | **0** | 200 fired, none skipping |
| 200 `<tr>`, separate borders | 200 | **0** | 200 fired, none skipping |
| one `<tbody>` of 200 rows | 1 | **0** | 1 fired, none skipping |
| twenty `<tbody>`s of ten rows | 20 | **0** | 20 fired, none skipping |
| a wrapper `<div>` around the whole table | 1 | **1** | 2 fired, 1 skipping |
| control: 200 `<div>` in the same box | 200 | **138** | 262 fired, 200 skipping |

So the property acts only on an ordinary box, whose whole subtree is then skipped: **nothing inside a table is ever let
go** — not a `<tr>`, not a `<tbody>`, with collapsed or separate borders. The plan's fallback therefore stands: **the step
is dropped**, and step 12 (virtualization) becomes the only answer to layout memory.

**The false witness, which is worth writing down because it nearly closed this step as a pass.** Rects were the first
thing the artifact probe asked, and they answered *217 of 217 rows laid out* — which reads as "the property is honoured"
if you have nothing to compare it with. On the same page the event says 216 rows declared, **0 skipped**. A skipped
element's descendants still report rectangles here, so at the artifact's scale the rect says nothing; the control page
above is what shows which of the two witnesses is the real one (its `<div>`s: 138 marked skipped and their rects are the
ones that go to zero).

## What it is in code

**Nothing ships.** The declaration was written into `src/table.css`, built and measured, then taken back: the artifact
returns to the byte it was (80 397 B, md5 `62a1d02e7bc57f38b06db0f946a94ec1`), which is how the revert is proven rather
than claimed. What stays is one check — the shared and the page’s own styling declare no `content-visibility` at all, with
the measurement in the comment above it (`test/page-view.test.js`) — so that the declaration is not added back as a
plausible idea, and so that the file that would have to be re-measured is named at the place where someone would add it.
What the check reads is the styling **with its comments taken out** (`squeezedCss`, the stripping the paste into the page
already uses): writing the reason down in `src/table.css` is the natural thing to do and must not redden a suite.

## What was measured (2026-09-17)

The A/B is **the same artifact twice**: the declaration injected at runtime as one `<style>` (`#grid tbody tr:not(.now)`)
after the first pass, so the bytes, the data and the program are identical and only the styling differs
(`probes/step-10-skip.mjs`, `file://`, this repository's artifact).

| one page, both variants | as shipped | declared |
|---|---:|---:|
| rows with `content-visibility: auto` computed | 0 | 216 |
| rows the browser let go (`skipped`, the platform's own event) | 0 | **0** |
| rows whose cells keep their boxes (the false witness) | 217 | 217 |
| the table | 59 278 × 5 360.25 px | the same |
| the scrollbar (client height / scrollHeight) | 611 / 5 360 px | the same |
| row heights / header heights | 24.5–25 / 21–21.5 px | the same |
| fingerprint of every text in the table | 3925704016 | 3925704016 |
| the shell let out to the table's full height | 5 364 px tall, table 5 360.25 px | the same |
| scroll through the whole table, 30 steps with a frame each | 765 ms worst, 3 172.7 ms total | 264.2 ms worst, 2 744 ms total |
| `LayoutCount` / `LayoutDuration` over that pass | **0 passes, 0.000 s** | **0 passes, 0.000 s** |
| the scrollbar at the bottom / back at the top | 5 360 / 5 360 px | the same |
| the last row after scrolling to it | painted, 69.63 × 24.5 px, on screen | the same |
| sticky edges at the bottom (header / commit / corner) | 23 / 1 / 1 px | 23 / 1 / 1 px |
| the browser's own search for the last row's number | 1 hit | 1 hit |
| print (`Page.printToPDF`, read back with `pdftotext`) | 358 310 B, 3 pages, 12 commit lines | identical bytes |

The scroll totals differ by machine noise and in the *wrong* direction between runs (declared 2 805 ms in the first run
and 2 744 ms in the second, as shipped 3 848 ms and 3 173 ms) — the same page measured twice differs by more than the two
variants do.

**What could have got worse if the property had been honoured**, each measured rather than argued:

- **Heights.** The classic failure of `contain-intrinsic-size` is a wrong fallback, and here it would have been the
  scrollbar jumping as the reader scrolls. The row's own height is 24.5–25 px (line-height 18.75 + 2×2 padding + 1 border)
  and it is what the injected declaration used; the scrollbar is 5 360 px at the top, at the bottom and back at the top.
- **Sticky edges and the transition of a link.** The header 23 px, the commit column 1 px, the corner 1 px from the
  shell's edges after scrolling to the last row — unchanged. And there is nothing to navigate *into*: the table carries no
  `id` at all (0), the page's one hash is the reader's own choice of columns.
- **Printing.** Identical PDF bytes either way. What the paper carries is this page's own pre-existing property: the table
  lives in a scroll container, so the print pass sees the band the shell shows (12 commit lines read back, 3 pages) rather
  than all 217 rows. Worth its own look one day, but it is not this step's doing.
- **Search.** The browser's own search finds the last row's number (1 hit) — as it should, since nothing was ever skipped.

## Acceptance answered

- *Scrolling to the last row paints it, the scrollbar length does not jump, the geometry is the same with the whole table
  on screen* — answered: the last row is painted (69.63 × 24.5 px, on screen), the scrollbar is 5 360 px at both ends, and
  every geometric number in the table above is the same in both variants.
- *A check that the property does not reach the header, the commit column or the "now" row* — answered the only way left
  once the property is inert: the styling declares no `content-visibility` anywhere, and the check says why
  (`test/page-view.test.js`).
- *In Chrome: layout count and duration while scrolling are materially lower* — **not met, and unmeasurable as written**:
  a fully laid-out table costs **zero** layout passes while it is scrolled (0 in both variants over 30 steps with a frame
  each), so there is no number to lower. Nothing here can move that: the cost of this table is the box tree of 174 468
  cells being built once, which is step 12's business.
- *`pnpm test:all` green* — answered: the suite is green with the check above added.

## What this step leaves open

Nothing of its own: the measurement closes the question, and the fallback it names is step 12's, which the report's §10.5
item 8 and the plan's own order already put there. One thing this step found on the way and did not chase is the print
pass of the report's table (only the shell's band reaches the paper) — it is the same before and after, so it is a
property of the page rather than of this step.

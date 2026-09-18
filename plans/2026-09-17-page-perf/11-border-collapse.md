# 11 — `border-collapse: separate`

Source: report §10.5 item 3 (and §7 step 11). Independent; cosmetic price only.

## Why

`border-collapse: collapse` (`src/table.css`) makes the browser build a border map for the whole grid
(787 × 216 cells) as part of layout. The separate model keeps no such map: each cell paints its own border.

## What to build

- `border-collapse: separate; border-spacing: 0` on `#grid`.
- Borders drawn on one side only, or they double: the group's left border (the rules of step 02 that move it
  to the first visible metric) and the horizontal lines between rows. The same values, half the borders.
- The sticky header and the sticky commit column keep working (they are about `position`, not about
  collapsing), but the header's own borders have to be visible against the cells scrolling under it — a live
  look, not a check.

## Acceptance

- No doubled line anywhere: the grid's look compared with a screenshot of the previous build at the same
  window size (the artifact is one file, so both can be opened side by side).
- The group border still falls on the first visible metric when a metric is switched off.
- `pnpm test:all` green, including `test/page-view.test.js`, which reads the shared styling and the delta
  colours out of the files.## Risks

- **A cosmetic regression that no check can see** — the reason the comparison above is a screenshot
  rather than an assertion. It is the cheapest step of the memory group and the easiest to roll back.
- The artifact's bytes change (the styling is pasted verbatim), so the report is rebuilt in a commit of
  its own.

## The measurement: the line softens, and the promised win does not hold (2026-09-17)

The declaration was written into `src/table.css` (`border-collapse: collapse;` → `border-collapse: separate;
border-spacing: 0;` in the `table` rule) and built into the artifact (80 397 → 80 460 B); the recipe that makes the pair
is in `probes/README.md`, so this is re-takeable rather than a story about a build that no longer exists. Measured in
Chrome 153, `file://`, at a forced window of 1280×800, a device scale of 1
and a **forced light colour scheme** — the page paints its canvas with the system colour `Canvas`, and the first
screenshots came out at a background of 18/255, in which a 25 %-grey line is not a thing pixels can be compared with.
Then the styling was taken back: the artifact is byte-identical to before (80 397 B, md5
`62a1d02e7bc57f38b06db0f946a94ec1`), which is how the revert is proven rather than claimed.

**What the reader would see** — the screenshots read back in the same browser (`node probes/archive/step-11-borders.mjs`, one run
of five rounds, quoted as it prints):

| the group's left border, sampled across | collapsing (shipped) | separate |
|---|---:|---|
| the corner, with every metric on | one pixel at **210** | **two pixels at 233 + 233** |
| the corner, with the first metric off | one pixel at **210** | **two pixels at 233 + 233** |
| the bottom of the table | one pixel at **210** | **two pixels at 243 + 243** |
| its runs by thickness, three regions | 1 px × 3 / 3 / 4 | 1 px × 2 / 2 / 2 and 2 px × 1 / 1 / 2 |

So the group's border keeps its ink and loses its edge: the same darkening spread over two pixels instead of one. The
cause is the geometry rather than the border model — the columns are counted in `ch` (69.63, 58.99 px …), so a cell's own
border is painted at a fractional edge and antialiased, while the collapsing model snaps the shared border onto the grid
line. That the mechanism is the *fraction* shows in the same pictures: the commit column's border, whose width works out
at 199 whole pixels, is a single crisp pixel at `x = 200` in **both** builds.

The row lines do **not** separate the two models, and this is where the first reading of these pictures was wrong: the
collapsing model splits them too, because the rows are 24.5–25 px high and their boundaries land between pixel rows
(thickness × count `{1: 3, 2: 7}` in the corner, `{1: 6, 2: 4}` at the bottom). The separate model reads `{1: 5, 2: 5,
3: 1}` and `{1: 9, 2: 2}` — i.e. in the corner it produces a run of **three** pixels where the collapsing one had two,
which is a line gaining a pixel, not just softening. Nothing is doubled into two separate lines anywhere, but "no line
gets thicker" is not what the pixels say.

**What it buys** — the border map is not built, and the lowest first layout of the finished table does come down, but the
difference is small next to the machine's own spread, and the same probe on one table in one tab contradicts it. Both
columns are the probe's own output — `ROUNDS=5 node probes/archive/step-11-borders.mjs before=/tmp/before-11.html
after=/tmp/after-11.html` — one run of five interleaved rounds over the pair named above, and every number below is copied from
what it printed (`1 616.1` is "lowest 1616.1", not a rounded reading):

| first layout of the finished table | collapsing (shipped) | separate |
|---|---:|---:|
| lowest / median of five loads | 1 616.1 / 1 644 ms | **1 459.9 / 1 473.4 ms** |
| the five loads, ms | 1 616.1, 1 642, 1 644, 1 720, 2 076.9 | 1 459.9, 1 471.8, 1 473.4, 1 489.7, 3 482.8 |
| five runs (this pair and four earlier ones, same styling): lowest / median | 1 616–1 738 / 1 644–2 089 ms | **1 460–1 557 / 1 473–1 622 ms** |
| the two models on one table in one tab, lowest of five each | 1 050.8 (shipped page) and 1 075.4 ms (separate page) | 1 067.9 and **1 070.9** ms |

So: on the lowest reading the separate model comes in **130–180 ms (7.8–10.6 %) below** the collapsing one, and the
medians agree in direction in every one of those five runs — but the A/B of the two models on one and the same table
inside one page is a **coin toss**: the collapsing model wins by 17 ms in the shipped page (1 050.8 against 1 067.9) and
the separate one by 4.5 ms in the separate build (1 070.9 against 1 075.4). Re-laying out a table that is already built
therefore costs the two models the same, and the saving seen across tabs is not confirmed where the machine holds still.
The machine's own drift is the loudest thing in all of it: the separate build's own first load varies from 1 459.9 to
3 482.8 ms. The CDP `Performance` counters
could not arbitrate: a full page load reported `LayoutCount 0` and a negative style count, because the domain's counters
do not survive a navigation.

**Everything else came out the same or slightly better, and that is not what decides it either:** the table 59 278 px
wide in both (its height 5 360.25 → 5 359.75 px), the fingerprint of every text in the table identical (3925704016), the
sticky header and commit column at the same edges after scrolling (header 23 px, commit 1 px, corner 1 px), the group's
line still on the first *visible* metric (track `m0` with all metrics on, `m1` with the first switched off, left 546 px,
the table 59 278 → 39 314 px, in both models), and — a small arithmetic improvement the separate model brings — the
second sticky header row becomes 22 px tall, which is exactly the `top: 22px` offset it is stuck at (21.5 px before,
with the rows 24.5/24.75/25 against 24.5/24.75). The whole table below the header then shifts by half a pixel.

## What it is in code

**Nothing ships.** The declaration was written, measured and taken back; the artifact returns to its byte (above). No
check was added: the acceptance asks for a screenshot comparison rather than an assertion, and what a check could guard —
the shared styling's border model — is already read by `test/page-view.test.js` for the delta colours and the deltas'
count, so a guard here would only record this decision twice.

## Acceptance answered

- *No doubled line anywhere, the look compared with a screenshot of the previous build at the same window size* —
  answered, and it is the finding: the group's border is **spread over two pixels** instead of one (210 → 233 + 233), the
table moves by half a pixel below the header, and one row line gains a pixel (a run of three in the corner where the
collapsing build had two). 15–16 % of the pixels of each region differ, concentrated in the line rows and columns. That
is the cosmetic regression the plan's risk named, so the step is taken back rather than kept.
- *The group border still falls on the first visible metric when a metric is switched off* — answered: identical in both
models, `m0` → `m1` at the same left edge, 1 px, the table narrowing 59 278 → 39 314 px.
- *`pnpm test:all` green, including `test/page-view.test.js`, which reads the shared styling* — answered: the suite is
  green with the styling as it was.

## What this step leaves open

- **Why the lines soften is the column widths, not the border model.** 69.63 px and 58.99 px columns put a cell's edge on
a fraction of a pixel, and a separately painted border follows it; the collapsing model snaps instead — and the commit
column, whose width does come out whole (199 px), stays crisp in both builds. Whole-pixel column widths (step 09's count
rounded up) would let a future attempt at this step draw crisp lines: that is a change to step 09's arithmetic, not to
this one, and it is the first thing to try if the step is reopened.
- **The border map's cost is real but small at this history size** (130–180 ms off the low end of a 1.5–1.7 s first layout)
and it grows with the number of rows, while the separate model's cost does not: this step becomes the more interesting
the longer the history gets, and the pixels are what would have to be re-measured with it.


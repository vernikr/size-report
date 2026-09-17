# The drawing's own rules, and the order of the columns

What was reported, in one portion, against the page 2.8.0 shipped: the panel's checkboxes (raw, min, tok) stand on top of
one another; the first column of the table — the overall total — is not visible at all; a file's name over its group
should be centred; every border of the page should be 1px of one colour (the header's looked 2px); the rows of the table
should be one height (the two header lines looked shorter); and the order of the columns is broken — a column whose cells
are empty in the newest commit stands in front of columns that changed there.

## What the causes were

- **The panel and the table were sharing one class.** The shared sheet (`src/table.css`) is pasted into the page beside
  the page's own (`src/page/app.css`), and the table's rows were styled by a bare `.row` — while the panel's own rows are
  `.panel .row`. The table's `.row { position: absolute; height: 25px }` therefore reached the panel, took the metrics row
  and the three method lines out of the flow and laid them on top of one another. Every rule of the table's part now hangs
  off `#grid`, and the check that guards it reads the selector list of the shared sheet rather than a sample of the page.
- **The numbers were placed from the grid's left edge while the commit column is pinned over it.** The first group (the
  overall total) stood under the 220px sticky column, and a reader opening the report saw no total at all. The numbers now
  begin at the column's right edge (`APP_COMMIT`, 220px, written in the script and in the styling and held together by the
  geometry check like the three figures beside it).
- **The order came from the commit's list of paths, not from the numbers.** A commit can touch a file without moving it —
  this package's own attachment to itself is what put `package.json` first with the same byte count as the release before
  it (`2.7.0` → `2.8.0` is one character for another) — and the engine's mark (`last`) was that list. The page now orders
  the columns by the newest row in which a file's numbers moved: the files of the top commit first, the older an edit the
  further right, and a file the history never moved last. Inside a group of equal recency the order is the settings', and
  the order still depends on the files rather than on the choice, so switching a column off moves nothing. The mark `last`
  stays in `--data` (a fact about the history), while the page's block no longer carries it: the page counts the order
  from the data it already has.

## The drawing, as measured

Live Chrome 153 over `file://`, at a desktop viewport of 1600×1000 (`node /tmp/wide.mjs reports/page-fix.html 1600 1000`,
the repo's own CDP idiom). The figures are this repository's report: 252 rows × 321 files × 3 metrics.

| What | Before | Now |
|---|---|---|
| The panel's metrics row | three boxes on one line, the method lines painted over them (`of the git object` trailing the last box) | one row of 27px, the three boxes at one line, each method line below at its own top (133, 165, 187, 244) |
| The first column of the table | under the pinned commit column (grid left 15, column 15–235) | at 567 — the right edge of the pinned column, which stands at 347–567 |
| A file's name over its group | at its group's left edge | centred over the group (210px caption over three 70px columns) |
| The borders | the header's two lines 2px and a second shade of grey; the rest 1px | 1px of one colour everywhere (`rgba(127,127,127,.25)`), the page's own frame included |
| The rows | the commit rows 25px, the header's lines 22px | 25px for every row: the header is `--head` = 2 × `--row` = 50px |
| The first columns | `package.json` (empty in every row: the newest commits touched it with no change in volume), then an arbitrary order | `page-view.test.js`, `app.css`, `README.md`, `page-choice.test.js` — the files of the newest commit with a row |

The artifact grows by 351 B for this (85 495 B against 85 144 B of the same history): the styling +58 B from the scoping
of every rule, the program +262 B from the order being counted in the page.

## The checks

`test/page-grid.test.js` grew a check of its own for the drawing — one border, the header's lines of one row, a caption
centred, the page's frame in the table's own grey, the numbers beside the pinned column, and every selector of the shared
sheet tied to `#grid` (the leak above, caught by structure rather than by eye) — and its order check now counts the rule
from the contract's own rows instead of reading the engine's `last`. The fast profile goes 88 → **89** checks and the full
one 193 → **194**; the contract's round trip declares one more field as not surviving into the page's block (`last`).

The four page suites of the old `<table>` stay deactivated, as they were: they read markup that no longer exists, and
what they promise — the panel's tree, a choice's memory, a link — is untouched by this portion. The panel's layout now
has a guard where the leak happened, in `page-grid`.

## Still open

- A sideways scroll still builds the window again (~30 ms a step, `worklog/0208-table-window.md`): reusing the rows and
  rewriting only their numbers is the way to take it down.
- The four deactivated suites are to be repaired against the window rather than the table.
- The narrow-window adaptation of the pinned column (a 220px column on a 375px screen) is left as it is on purpose: the
  script places the numbers by that width, so a shorter one would have to be one number in one place, which means the
  script reading the styling.

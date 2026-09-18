# A step sideways moves the window instead of building it

Asked for in one portion: take the rebuild out of the sideways scroll of the report — reuse the rows that are built
and rewrite only the numbers in them, so that a step costs milliseconds rather than a window.

## What was there

The window was built in two directions by one rule, and the rule was right for one of them. A step **down** the table
already cost only what left the window and what entered it: a row is absolutely placed at its own `top`, and the script
worked on the rows the window gained and lost. A step **sideways** built the header, every row and every cell of them
again, because the columns a row holds were written into its strip of numbers once and a column that is not there cannot
be shown (`worklog/0208-table-window.md`; `worklog/0210-page-suites-on-the-window.md` left it in its "still open").
On this repository's own report that was the last five-figure number in the page: 9.2–10.4 ms of the page's own work
for one step of a single column, and 12.8–14.4 ms of layout after it.

## What changed

- **`appStrip(strip, was, now, make)`** — a strip of pieces of one range moved to another: the pieces the two ranges
  share are kept, and only the ends are made and dropped. A window that jumped clear of the strip (a dragged
  scrollbar) has nothing to keep and the strip is made again; the empty range `[c, c - 1]` is how a strip that holds
  nothing yet says so. One function serves three kinds of strip, because a unit of a strip is its child.
- **A row keeps its model beside its node.** The numbers of a row depend on the commit and the reader's choice rather
  than on the place the window stands at, so a step sideways asks a cell's arithmetic of the model it already has and
  never `rowModel` again. The row is born with an empty strip and the model in its entry.
- **`appCells`** puts a row's numbers at the window's columns: the shared columns keep their cells, the ones that
  entered are made, and the strip is placed at the window's first column (the numbers begin beside the pinned commit
  column). A step down the table asks for the columns the row already holds and the row is not touched at all.
- **The header moves by the same rule.** Its line of names is a strip of groups and its line of metrics a strip of
  columns, and both are asked for **whole groups** — a column of numbers cannot lose its caption to a window that cuts
  a group. A window that did not leave a group (a step down the table) leaves the header alone.
- **The rebuild stayed where it is the only right answer**: `redraw` — the reader's own switch and the shell's resize.
  The columns of a switched-off file are not among the columns that are built, which is not a place to move to.

## What it costs and what it is worth

`probes/step-12-window.mjs` (live Chrome 153 over `file://` at 1440 × 900, two rounds, the shipped page against the
page built from the working tree, both built in one index state): forty steps of one column from a place in the middle
of the grid, the page's own handling of a step and the layout the browser redoes after it, plus the browser's own
accounting over the sweep.

| | 2.8.2 (before) | after |
|---|---|---|
| one step — the page | 10.4 / 9.2 ms | **0.6 / 0.5 ms** |
| one step — the layout it forces | 14.4 / 12.8 ms | **5.9 / 5.3 ms** |
| 40 steps — the browser's layout | 0.605 / 0.386 s | **0.246 / 0.242 s** |
| 40 steps — style recalculation | 0.169 / 0.134 s | **0.056 / 0.046 s** |
| 40 steps — task time | 1.281 / 0.928 s | **0.350 / 0.327 s** |
| the grid at the end (both) | 1 152 nodes, 864 cells, 36 rows | same |

The layout that is left is the grid's own and is not this step's: moving a row's strip invalidates the layout of the
scrolled content, and the reader pays that once a frame in either build. What is gone is the 36 rows and the 864 cells
that were built again on every step — the window is moved now rather than made.

## The checks

`test/page-grid.test.js` gains one check, and it is about the rule rather than about the numbers (a page that built the
same numbers again would read the same and cost the same as before): the rows of a moved window are **the same nodes**,
the cells of the columns still in sight are **the same cells**, only the columns that entered are new — and the numbers
of the moved window are compared with the numbers of a window built at that place in one leap, because a shift that kept
the wrong cells would read as a plausible table.

`test/page-view.test.js`'s closed list of the page's names gains three (`appCells`, `appHeadNew`, `appStrip`). The
counts: **86 → 87** in the fast profile and **191 → 192** in the full one, both named in `README.md` and held by
`test/docs-numbers.test.js`. Twelve lines of the change are the two copies of the page's geometry held together as
before, and eight lines of the table chapter are the comments that say why.

## The figures of the source

`src/page/table.js` **307 → 364 lines** (+102/−45 in the diff): the movement of a strip, a row's entry with its model,
`appCells` and the header's two strips, against the build-the-window-again branch that left. The change is larger than
the window step it replaces because a row is now a piece of state rather than a fresh drawing — the model beside the
node, the range of columns the strip holds, the header's own range — and that state is what buys the step.

The artifact of the same history, the two engines side by side, is measured after the release (below).

## Measured after the release


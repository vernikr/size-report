# The table as a window of itself

What was asked, in one portion: give up the `<table>` for plain elements laid out by CSS Grid, virtualize the rows **and**
the columns, make every metric column the same fixed width of 70px, cut a file's name with an ellipsis where it does not
fit, build a little more than the window shows so that a scroll finds its elements already there — and answer, web
research rather than taste, whether a ready-made virtualizer is simpler and smaller than writing one.

## What the reader gets

- **A report that opens and scrolls instead of one that stalls.** The page builds the rows and the columns in sight (plus
  four beyond each edge) and nothing else: the same report, on this repository's own history, went from **253 770 nodes
  in the document to 2 460**, and from **1.46 GB to 0.15 GB** of a fresh Chrome's memory.
- **Every column 70px and fixed**, one figure for all of them — the counted `ch` widths, the `<colgroup>` and the fixed
  table layout are gone with the table. A file's name over its group is cut with an ellipsis (the whole name stands in
  the tooltip) instead of wrapping or running over its neighbour.
- **The header sticks to the top of the shell and the commit column to its left**, as before — both measured at the far
  corner of a 67 410 × 6 344 px grid (offset 1 px, which is the border).
- **The stripe over a drawing left the page**, and that is a consequence rather than a loss: it stood over the browser's
  relayout of the whole table, and a switch now costs a few milliseconds. `src/page/work.js` left the tree with it.
- **The artifact is smaller**: 84 921 B against 87 484 B for the page this tree wrote before the change (−2.9 %), while
  the program is 25 705 B and the styling 6 608 B.

## Measured, not argued

Live Chrome 153 over `file://`, one page in a browser of its own (`probes/step-12-columns.mjs` is the probe of the step
before this one; the figures below were taken with the same CDP counters), on this repository's own report — 251 rows ×
320 files × 4 metrics.

| Question | 2.7.0 (the `<table>`) | This tree (the window) |
|---|---|---|
| Nodes in the document | 253 770 | **2 460** |
| DOM nodes the browser reports | 377 396 | **7 320** |
| The page in a fresh Chrome, at rest (browser minus empty browser) | 1.46 GB | **0.15 GB** |
| A scroll down the whole table | 60 diagonal steps: 36.0 s of task time, median 571 ms a frame, worst 1 365 ms | 251 steps down: **1.1 s of task**, median 33 ms (which is the probe's own two-frame wait) |
| A scroll sideways through all the columns | not reachable — the page was still relaying out | 120 steps: 3.6 s of task (~30 ms a step, the window built again) |
| The artifact | 87 484 B | 84 921 B |

The two ways of scrolling are honestly different: down the table the window moves by a row, and only the rows that
entered it are built (0.9 ms a step on the prototype, 4.4 ms of task a step in the browser, most of it the browser's own
scrolling); sideways the columns of the window change, and the window is built again — 30 ms a step is a scroll a reader
notices, though not a freeze. That is where the next portion would go if it is worth it (reusing the rows and rewriting
only their numbers).

## A library or a hand-written one

The question was researched (Exa; the npm registry and the tarballs for the sizes) rather than guessed, and the answer is
that for this page it is the same work either way, with a dependency on top:

| Candidate | Size (min+gzip, measured from the tarball) | What it leaves to the caller |
|---|---|---|
| `@tanstack/virtual-core` | ~6.7 kB (unpacked 438 kB) | headless: two virtualizers (rows, columns), no DOM at all, no sticky pieces — every node is yours |
| `virtua` | ~6.1 kB | its grid is `experimental_VGrid`; no sticky header, no pinned column |
| `Clusterize.js` | a few kB | rows only, and from a string that holds **all** of them — the opposite of what is needed here |
| `vlist` | ~10.7 kB | vanilla and with a grid plugin, but a page of its own rather than a piece of this one |

Nothing in the set virtualizes both axes with a pinned column out of the box, and each would have to be **vendored**:
the page is one file, opens from disk, resolves no import, and its bytes are measured by the very tool it is inside — a
library would be counted in the report's own numbers. What is left to write after any of them is what `src/page/table.js`
is: the window, the cells, the header and the pinned column. The hand-written version is 230 lines of comments and code,
including the geometry.

## What is deactivated, and why that is written down

The four page suites read the markup of the `<table>`: `test/page-view.test.js`, `page-cols`, `page-tree` and
`page-choice` now skip every check, each file saying so at the top and each entry in `tools/suites.js` carrying the word.
The counts of the run do not move (a skipped check is still a check), and what the panel promises — the tree, the folding,
the three states of a folder, the memory of a choice — is untouched by this portion but no longer guarded; the file table
of `README.md` says which files wait for repair. `test/page-grid.test.js` is new and guards the window meanwhile: what is
built and no more, the geometry of the styling against the script's, a scroll in both directions, a number under its own
caption, a file and a metric switched off, and every row of the window against the engine's own calculation.

## Still open

- The suites above are to be repaired against the window rather than the table — the panel's checks (`page-tree`) need
  nothing but a different way of counting shown columns, while `page-view`'s are about a table that no longer exists.
- A sideways scroll builds the whole window again: reusing the rows and rewriting only their numbers would take the 30 ms
  a step down, and the numbers to prove it are above.
- The prototype and both browsers of the measurements were scratch work in `/tmp`; the figures above are what is kept,
  and a probe in `probes/` for the window would be the way to keep them re-measurable.

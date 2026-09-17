# The page's choice, its categories and the price of a click

What was asked, in one portion: keep the reader's choice in the browser's memory and leave the address clean; make a
click on the boxes — above all the group ones — stop freezing the page, with a progress stripe over the top edge of the
window; let the columns of files the last commit did not touch stand after the rest; rename the documentation checkbox
to **Docs**; give the tests a category of their own after Code (the files of `test`, `tests` and `fixtures` folders
wherever they stand, and every name carrying `.test` before its extension), taken out of Code; put a hidden name — one
beginning with a dot — after the visible ones inside a level; and open the tree folded, remembering what the reader
unfolded.

## What the reader gets

- **The choice lives in the browser and the address stays clean.** A switch writes one record into `localStorage`,
  under a key bound to the report's passport and with the same name as before; the page writes nothing into the address
  bar any more. A link sent by an earlier release (`#size-report=…`, the same record in the same shape) is still read —
  at opening and on an already open page — a foreign or broken one is still explained in words, and the reader's own
  memory is not touched by somebody else's link.
- **The tree opens folded**, and it is the *unfolding* that the memory keeps (a record of its own, `size-report:<passport>:tree`,
  `{v: 1, passport, open: {src: true}}`); folding every folder back leaves no record, the same way switching every box
  back on removes the choice.
- **A test is a category of its own**, right after Code, and the documentation is **Docs**. On this repository's own
  report the categories are Code 73, Tests 47, Docs 186, Chores 11 of 317 columns.
- **A hidden name stands after every visible one** inside a level; the report's file still comes first in it, and the
  files outside the report still stand after the ones inside.
- **The drawing of a switch does not freeze the page by itself**: work short enough to be over before the browser could
  paint is done on the click, and a longer drawing happens in the next task with an indeterminate stripe over the top
  edge of the window (`src/page/work.js`). What that stripe cannot be is a *share* — see the measurement below.
- **The order of the columns did not change**: what the last commit touched still stands first (`data.last`, `appOrder`),
  and everything else after it in the settings' order — the ask was already answered by that rule, and the report of
  this repository shows it (the column of `0206-release-2.6.0.md`, the file of the last commit, opens the table).

## Measured, not argued

The probe is `probes/step-12-columns.mjs`, run in live Chrome 153 over `file://` on both pages of this repository's own
report (249 rows, 317 columns, 3 metrics, 238 500 cells) — the shipped one and the one this tree writes.

| Question | The 2.6.0 page | This tree, sliced (written first, refused) | This tree, one task |
|---|---|---|---|
| A click on the Code category (73 columns) | sync 124.1 ms, 2 long tasks, 867 ms blocked, longest 742 ms | sync 5.5 ms, but **30 long tasks, 12 637 ms blocked, longest 4 927 ms**, 95 frames, 239 s in all | one task, with the stripe |
| The browser's own accounting | Layout 1 (1.038 s), RecalcStyle 2 (0.280 s), Task 4.546 s | **Layout 169 (151.887 s)**, RecalcStyle 182 (1.600 s), Task 242.523 s | one layout, as the 2.6.0 page |

- **What a column costs, measured on its own** (classes toggled on N cells, then a forced layout): 1 cell → 0.6 ms of
  toggling and **234.5 ms of layout**; 750 cells → 1.6 / 286.9 ms; 6 000 → 11.8 / 539 ms; 20 000 → 41.7 / 1 674.3 ms.
  That is the shape of the whole thing: the toggling is ~2 µs a node, while the browser lays the table out again for
  *any* change of a column's visibility — and the price barely grows with the number of columns changed.
- **Hence the sliced queue was a regression, and it was refused after being measured.** The same click, worked off
  between timeouts in slices of 2 000 nodes: 37 slices, each paying the table's relayout again (2.5–4 s a slice), 169
  layouts instead of 1, 151.9 s of pure layout time against 1.04 s — and the tab grew to gigabytes of repaint while the
  reader waited four minutes for a switch that costs him less than a second when it is not sliced. The slice was the
  freeze, only more often. The `setTimeout` between slices also means the drawing cannot repaint inside itself, so the
  share of a bar could never be shown anyway.
- **What is left is honest**: the drawing is one task, the stripe says it is going on (a bar that filled would be a bar
  nobody could read), and work short enough to be over before the browser could paint a stripe is done on the click
  itself. A single file's column of this repository's report (754 nodes) is drawn in **7.7 ms**.
- **The first drawing costs nothing new**: a report opened with everything switched on has no column out of step with
  the view (`appColumnStale`), so the drawing asks for no work at all — before this, every report paid a pass over every
  column's nodes at opening.
- **The page's own weight is the table rather than the switch, and it is measured.** An isolated headless Chrome, one
  tab: empty 0.64 GB, the page open at device pixel ratio 2 **2.02 GB** (the shipped 2.6.0 page: 2.02 GB — this portion
  costs nothing there), flat over 24 s of idling, back to 0.64 GB when the tab closes. What the figure is made of:
  238 500 cells are **370 758 nodes** and 373 547 layout objects, and the table stands **71 712 × 5 982 px = 429 Mpx**.
  Cutting 210 of its 250 rows (→ 38 520 cells, 50 115 layout objects) frees only 0.5 GB of the 1.4 GB the page holds,
  and hiding the table without touching the DOM (`display: none`) leaves **1.27 GB** against 0.64 GB empty: the rest is
  painted area, which follows the table's own size rather than the number of switches. `content-visibility: auto` on the
  rows — the two lines that would have been the cheap answer — is **ignored by Chrome on a `<tr>`** (373 547 layout
  objects before and after). So the shape of that fix is a table that builds only the rows in view: the next portion,
  not this one.
- **The page:** 86 177 → 87 413 B on this repository's history (+1 236 B, +1.4 %): the data block 49 628 → 49 668 B (the
  extra category), the program 28 006 → 28 945 B, the styling 6 172 → 6 337 B (the stripe), the markup 698 → 790 B (the
  stripe's element). The shipped page rebuilt byte-identically with its own engine before the comparison (86 177 B) —
  the two sides were built from one index state.
- **The checks:** 81 in the fast profile and 186 in the full one — the same counts, because the suites were rewritten
  rather than grown: `page-choice` keeps ten (the memory, the address, four link cases, the unpacker, the stripe, the
  short switch), `page-tree` keeps six (the tree, the outside files, the panel's fields, the order of a level with the
  hidden names, the folding, the scroll), and the category rule of the tests is checked in `contract-data` with its own
  cases (`categoryOf` on a path in a tests folder, a `.test.js` name, a document and a source file).
- **The defect the live run found, and the check that holds it now:** a switch pressed while the slices were running left
  the columns as the earlier state drew them (the file was still marked "queued" although its column had been drawn).
  It is gone with the queue; the rule that a column out of step is drawn again is `appColumnStale`.

## Not done

- **`src/page/work.js` does not slice.** The slice is written down here, measured and refused, rather than kept behind
  an unmeasured belief about frames; what would change the answer is a cheaper relayout (a report whose table is a few
  thousand cells pays ~10 ms for a column and would benefit), and the probe is the instrument to re-take it.
- **The address is not written at all**, so a reader cannot make a link out of their choice any more; links made by
  earlier releases are still read. That is what "the tail stays clean" costs, and it is the ask.
- **Live hosts are read over `file://` by the probe**, and the stripe's look (a travelling highlight, still under
  `prefers-reduced-motion`) is a decision taken on the page rather than measured against a reader.

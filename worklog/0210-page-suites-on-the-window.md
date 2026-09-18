# The four page suites back on the window, and less source under the page

What was asked, in one portion: bring the four page suites that went quiet with the `<table>` back to life against the
virtualized grid, and refactor everything that builds `size-report.html` with the volume of the source and its
duplication as the measure — a real reduction, not a rearrangement.

## The suites that were waiting

`test/page-view.test.js`, `page-cols`, `page-tree` and `page-choice` skipped every check against a `<table>` that no
longer exists (`worklog/0208-table-window.md`). All four are alive again, rewritten against what the page is now:

- **`page-view`** — the pasted program (a closed list of 74 names, the shared calculation first, no module syntax, no
  comment), the self-contained file and the sparse block, the recount by the choice, **every total of the window**
  against `rowModel` for a choice the page never painted whole (a metric, a folder and a category off), no mark of
  precision on a cell and the method in the panel, the shared styling pasted once with one pair of delta colours, the
  empty states in words, and the focus a click does not take.
- **`page-cols`** — the order of the columns by the newest row a file's numbers moved in, a caption over exactly the
  metrics of its group, and a choice that moves no other column.
- **`page-tree`** — the project's tree, three states of a folder, the subtree, the files outside the report, the folded
  default and the unfolding the memory keeps, and a scroll a click does not touch.
- **`page-choice`** — the memory of a choice and a revisit, a foreign or broken record, the address that stays clean, a
  link at opening and on an open page, and a host without an unpacker told so in words.

## The duplication, and what it was worth

Five suites were each reading the same page with their own pair of eyes. The readers moved into
`tools/page-harness.js` — a file's path at HEAD, the rows the window built, a row's numbers and the captions over
them, the order of the columns, a folder's and a category's switch, the place the shell stands at, the contract row a
built row stands for — and the suites lost their copies.

The page's own chapters lost what a second read found:

- **one memory** — the choice's record and the folded tree were two hand-written pairs of reading and writing
  (`localStorage`, `JSON.parse`, the passport, the empty record), now `appLoad` and `appKeep` (`src/page/state.js`);
- **one walk per folder** — `appIndexes` and `appCount` walked every subtree twice for one row's two figures, now
  `appSub` walks it once (`src/page/panel.js`);
- **one question about a group** — the folders and the categories were refreshed by two identical walks, now one
  (`appReach`), and a field is found by the name it is kept under rather than by a node passed around;
- **one drawing per click** — the three switch paths repeated five statements each, now `appChanged` (`src/page/app.js`);
- **two rules that never took effect** — a `.cap` of the panel's styling that the panel stopped emitting, and
  `var(--ink)` under the folding sign, a token that exists nowhere (the hover did nothing);
- **one name table** — the names of the unknown metrics and files of a link are answered by the maps the model already
  keeps (`appMetric`, `appMeasured`) rather than by two throwaway maps;
- **the window thrown away whole** — the grid holds the header and the rows, so a rebuild clears it instead of hunting
  the head and the rows down (`src/page/table.js`).

## The figures

Bytes for the same history, the working tree against `HEAD` (`84 991 B` against `85 730 B` of the artifact):

| | Bytes | Lines |
|---|---|---|
| The page's chapters (`src/page/app.css`, `app.js`, `panel.js`, `state.js`, `table.js`) | −745 | −37 |
| The five page suites | −18 462 | −251 |
| `tools/page-harness.js` and `tools/suites.js` | +4 328 | +68 |
| The tree of the commit | **−14 879** | **−220** |
| The artifact, same history (`--write`) | **−739** | — |

The checks go 89 → **86** in the fast profile and 194 → **191** in the full one: the four suites carry fewer and
better-split checks now that a reader of the page is one place rather than five. The fast profile and the full one are
green; `pnpm run dup` reports no new clone (the five in the baseline are the fixtures' setups and unchanged).

The artifact is 739 B lighter while carrying the same history and the same page: the program and the styling it carries
are exactly the chapters above, and nothing about what a reader sees changed with them — the suites are what says so,
and they read the page in jsdom rather than a description of it.

## Still open

- A sideways scroll still builds the window again (~30 ms a step, `worklog/0208-table-window.md`): reusing the rows and
  rewriting only their numbers is the way to take it down.
- The narrow-window adaptation of the pinned column (a 220px column on a 375px screen) is left as it is on purpose: the
  script places the numbers by that width, so a shorter one would have to be one number in one place.

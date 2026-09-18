# @vernikr/size-report — release notes

The README this project used to put on its main page, kept for its **release notes** after the main page
became a short landing description. The living prose has moved into `docs/`: how the tool is put together,
the gate against bloat, the traps of the engine and what is not here yet (`docs/architecture.md`), what is
in the repository (`docs/files.md`) and wiring the tool into a project (`docs/wiring.md`). No longer
maintained; the settings these notes describe still stand.

## Release notes

**Release 2.8.4 (2026-09-18).** The tool lives as a package of its own: the registry name is
`@vernikr/size-report` (published by tag from CI, with no secret). A project may keep no settings at
all: without a config file the tool derives them from the project itself and says so in one line,
and `--init` pins what was derived into a file. The report is **one file**, the self-contained page
`docs/size-report.html`, and it appears by itself: the updating hook is installed after the package
is installed and on the first run. The version is in the manifest, and every release is recorded in
the journal — `worklog/` for today's entries, `worklog/archive/WORKLOG.md` for the earlier ones:
what changes in the numbers is measured rather than retold.

2.8.4 is about the volume of the tree rather than of a report, and it is a sweep — no feature. **The six probes that
measured the page's steps are archived** (`probes/archive/`, 1 458 lines): the plan they served is settled, its figures
stand in `plans/2026-09-17-page-perf/` and in the worklog, so the instruments stay as the record of how the numbers were
taken, with every reference following them. **The open notes are closed**: the help's continuation lines are no longer
read as commands (the list falls from ten words to six), an advice without a flag is a command again, two assertions
that could not fail are gone (`test/check.test.js`, `test/gates-verify.test.js`), the last two Russian comments left
`src/` (the locale's strings stay — they are data), and `tools/run-tests.js` hands its extra flags to `node --test`
**before** the file, where node 22 reads them. **The copies below the sensors' thresholds went too**: one helper
spawns the frozen copy instead of two builders' own, one function sets the identity git refuses to commit without
(three sites had grown the loop), and a suite's temporary directory removes itself when the process ends — 25 suites
opened with the same pair of lines. Nine `export` keywords on names nothing outside their module reads left the
surface, and `TODO.md` fell from 96 lines to 31. No check was added or removed, and the code of the tree changed by
−44 lines. The figures and the reasoning stand in `worklog/0213-the-volume-swept-and-the-probes-archived.md`.

2.8.3 is about what a sideways scroll of the report costs, and its figures are measured rather than retold. **A step
sideways moves the window instead of building it:** a row is made once and lives through the move, keeping its node and
its numbers — the window's columns are the range of that row's numbers, so the columns that entered it are made and the
ones that left are dropped, the header's line of names and its line of metrics by the same rule. A switch of the
reader's own and the shell's resize are the one thing that cannot be a move — a column that is not built cannot be
shown — and they build the window from nothing as they did. **Measured on this repository's own report in live Chrome**
(`probes/archive/step-12-window.mjs`, two rounds, 1440 × 900): the page's own handling of one step **10.4 → 0.6 ms** (worst
19.2 → 3.6) and the layout the step forces **14.4 → 5.9 ms**; over a sweep of forty steps the browser's own accounting
gives layout **0.605 → 0.246 s**, style recalculation 0.169 → 0.056 s and task time **1.281 → 0.350 s**. A check
(`test/page-grid.test.js`) holds the rule by node identity — a page that built the same numbers again would read the
same — and by the numbers of the window built at that place in one leap. The figures and the reasoning stand in
`worklog/0211-sideways-step.md`.

2.8.2 is about the page's own sources and the checks that guard them, and its figures are measured rather than retold.
**The four page suites that went quiet with the `<table>` are alive again against the window:** `test/page-view.test.js`,
`page-cols`, `page-tree` and `page-choice` read the grid and the panel they guard rather than markup that no longer
exists, and what they promise is what they hold — the pasted program with no second calculation, the sparse block, the
recount by the choice, the order of the columns, the tree's folds and its memory, the link's refusals. **Their readers
are no longer each suite's own:** `tools/page-harness.js` keeps one set of them (a file's path at HEAD, the rows the
window built, the numbers of a row and its captions, a folder's and a category's switch, the place the shell stands at),
and the copies the suites carried left with it. **And the page's chapters shed the duplication the same request
found:** the choice's record and the folded tree share one reading and one writing of the browser's memory
(`appLoad`/`appKeep`), a folder's two figures come from one walk of its subtree (`appSub`), the three walks over the
metrics and the files of a record became the panels' one question asked twice (`appReach`), and the three paths of a
click became one drawing (`appChanged`) — while two rules that never took effect went with them (a dead `.cap` of the
styling, an undefined colour under the folding sign). Measured in bytes for the same history: the chapters **−745 B**
(37 lines), the suites **−18 462 B** (251 lines), the harness **+4 328 B** — the tree loses **14 879 B and 220 lines**,
and the artifact **85 730 → 84 991 B**, its program and its styling being exactly what the chapters are. What a reader
of the page does is one place now rather than five, and a check that read the table it no longer has is not a check.
The figures and the reasoning stand in `worklog/0210-page-suites-on-the-window.md`.

2.8.1 is the drawing of the page put right after its table became a window, and its figures are measured rather than
retold. **The panel and the table were sharing one class:** the table's rows were styled by a bare `.row` while the
panel's own rows are `.panel .row`, so the table's rule took the metrics row and the three method lines out of the flow
and painted them over one another — every rule of the shared part now hangs off `#grid`, and a check reads the selector
list of that sheet rather than a sample of the page. **The numbers were placed from the grid's left edge while the commit
column is pinned over it**, which hid the first column — the overall total — completely; they begin at the column's right
edge now, a 220px figure written in the script and in the styling and held together like the three beside it. **The order
of the columns comes from the numbers rather than from the commit's list of paths**: a commit can touch a file without
moving it — this package's own attachment to itself, 2.7.0 → 2.8.0, is one character for another — and a column of empty
cells standing in front of the table is what a reader calls a broken order, so a file's newest move decides its place;
the engine's mark `last` stays in `--data` while the page's block no longer carries it. **One border and one height:**
every line of the table is 1px of one colour (the header's two lines were 2px and another shade) and the header is two rows
of the table's own height, while a file's name is centred over its group. The artifact grows 351 B for it — 85 495 B
against 85 144 B of one history. The figures and the reasoning stand in
`worklog/0209-page-drawing-order.md`.

2.8.0 is about what the report costs whoever opens it, and its figures are measured rather than retold.
**The table is a window of itself:** every row and every column in sight is built, plus four beyond each edge so that
the edge of the window is never seen empty, while the rest of the table exists as the extent of the scrolled box and
nothing else. This repository's own report was a `<table>` of 238 500 cells — 253 770 nodes in the document, 377 396 in
the browser, 1.46 GB of a fresh Chrome's memory with the page open and nothing else — and the window of it is
**2 460 nodes, 7 320 and 0.15 GB**: a hundredth of the nodes and a tenth of the memory. Scrolling the whole table cost
**1.1 s of task time over 251 steps**, against **36 s over 60 steps** for the same page as a full table (a median of
571 ms a frame, which is the freeze a reader felt). **Every column is 70px wide and fixed** — the numbers are short and
of one kind, and a width that came out of the text is a measurement of every cell of the column — while a file's name
that does not fit its group is cut with an ellipsis rather than wrapped (the whole name stands in the tooltip). **The
stripe over a drawing is gone with the freeze it was drawn for**: a switch costs a few milliseconds, so there is nothing
for an indicator to indicate, and `src/page/work.js` left the tree with it. A virtualizer library was measured and not
taken — `@tanstack/virtual-core` is ~6.7 kB gzip and headless, `virtua`'s grid is experimental and `Clusterize.js`
knows rows and not columns — because each would be vendored into the artifact, which the report then measures as its own
bytes. The checks of the old table went quiet with it, each naming its reason, and 2.8.2 brought them back against the
window; `test/page-grid.test.js` is what guards the window itself. The figures and the reasons stand in
`worklog/0208-table-window.md`.

2.7.0 is about the page and what a reader does with it, and its figures are measured rather than retold.
**The report's address stays clean:** a switch writes the record into the browser's memory and nothing into the
address bar — the page no longer puts a `#size-report=…` tail on the report it was opened with — while a link
made by an earlier release is still read, and a foreign or broken one is still explained in words. **A test
is a category of its own**, right after Code: the files of `test`, `tests` and `fixtures` folders wherever
they stand, and every name carrying `.test` before its extension — on this repository's own history Tests
holds **47 of 317 columns**, and the checkbox of the documentation is called **Docs**. **The tree opens
folded**, and the unfolding is what the memory keeps, under a key of its own; inside a level a hidden name —
one beginning with a dot — stands after every visible one. **The drawing of a switch is measured, and it is one
task**: the click is counted and answered, a drawing short enough to be over before the browser could paint is
done on the click, and a longer one happens in the next task with a stripe over the top edge of the window. The
price of a switch is the browser's own relayout of the table — 234.5 ms of layout for a *single* cell of this
repository's report (249 rows, 317 columns, 238 thousand cells), 287 ms for 750, 539 ms for 6 000 — while the
class changes are about 2 µs a node; on this page the whole Table of Contents of the report (73 columns) is
867 ms blocked with a 742 ms task. A queue worked off in slices was written first and refused by measurement:
the same click in 37 slices paid that relayout 37 times — **169 layouts and 151.9 s of pure layout time against
1.04 s**, with the tab growing to gigabytes of repaint and the reader waiting four minutes for a switch that
costs him less than a second unsliced. Within one task nothing can repaint, so a bar that filled would be a bar
nobody could read: the stripe travels and says the work is going on (`probes/archive/step-12-columns.mjs`, the records in
`worklog/0207-page-choice-bar.md`). The order of the columns did not change there: what the last commit touched
still stands first, the rest after it in the settings' order.

2.6.0 changes the numbers themselves, and they are measured rather than retold: on this repository's own
history the page this engine writes is **85 955 B against 1 899 370 B** written by 2.5.0 — 22.1 times
smaller, −95.5 % — because the data travels as one packed block (49 392 B, `base64+gzip`) instead of a list
of rows, the program is pasted without comments and indentation (28 007 B) and the styling is 6 172 B. The
page also stops rebuilding itself: a click on a filter rewrites the nodes in place and recomputes the
totals, the columns carry computed widths under a fixed layout, and two candidates (`content-visibility`,
`border-collapse: separate`) were measured dead here and left out, with the records in
`plans/2026-09-17-page-perf/`. **The contract loses fields:** `metrics[].accuracy` and the `approx` bit map
are gone and the split into exact and approximate numbers with them, so a reader of `--data` that still
asks for them gets nothing — while the two schema numbers (`1` for the contract, `2` for the packed block)
stay where they were. The note of 2.5.0 — the language the tool speaks — stands in the journal,
`worklog/0203-release-2.5.0.md`.

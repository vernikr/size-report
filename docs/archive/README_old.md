# @vernikr/size-report

A tool that tracks how the volume of code and documents grows: every change shows how much the
project grew or shrank, in three measures — as written (`raw`), minified (`min`) and in tokens for a
language model (`tok`).

It answers two questions: for a person, "where is the project swelling"; for an AI agent, "how
much does my change weigh in its own context". It forbids nothing and blocks nothing: it only
shows.

## Status and release notes

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

The prose that used to stand here — how the engine, the report and the checks are put together, why
the numbers are what they are and which promises are held — now lives in
[`docs/architecture.md`](../architecture.md). The release notes stay in this archive.

## What is in the repository

| File | Role |
|---|---|
| `plans/` | The plans of work on this repository: `plans/archive/` holds the earlier ones, `plans/2026-09-17-page-perf/` the plan of the page work — an index and one file per step of the report, each with why, what changes, acceptance and the risks (`plans/2026-09-17-page-perf/README.md`) |
| `plans/archive/PLAN.md` | **The main document of the move:** inventory, boundaries, invariants, architecture, the seven steps, acceptance, risks, open questions |
| `docs/requirements.md` | The customer's requirements: what and why |
| `docs/module-design.md` | The design of the extraction: how the module is put together |
| `docs/architecture.md` | How the tool is put together: the living prose moved out of this README — the engine, the report, the checks and the promises they hold |
| `docs/size-report.html` | The size report of this very project: one self-contained file, refreshed by the hook after every commit (as a commit of its own) |
| `docs/archive/README_old.md` | This document: the README this project used to put on its main page, kept after the main page became a short landing description, minus the prose about how the tool is put together (that lives in `docs/architecture.md` now). No longer maintained; the tool's settings it describes still stand |
| `worklog/` | The journal of requests and of what was done: an entry per portion of work, named `NNNN-slug.md`; `worklog/archive/WORKLOG.md` is the earlier journal in one file |
| `docs/plans/` | Plans of work: a folder `yyyy-mm-dd-name` per piece of work, holding the main plan and its subplans |
| `BLOCKERS.md` | Open blockers and known gaps (a workaround has to rest on a check) |
| `TODO.md` | Defects noticed in passing, one line each: where, what and how it shows — fixed in a portion of their own |
| `plans/archive/REFACTOR.md` | The per-channel plan of the cleanup: size of the code first, speed after; the boundaries and what proves that the behaviour did not change |
| `tools/parity-freeze.js` | Takes the parity reference (`pnpm run parity`): with the frozen copy, at the project revision from the manifest — `--json`, the config, the artifact's hash, the tool's hash |
| `tools/make-fixture.js` | Assembles the synthetic fixture (`pnpm run fixture`): a deterministic history with traps plus the reference numbers |
| `tools/synthetic/` | The subjects of that assembly, one per matter: `repo.js` — how git is spoken to (pinned time, author, settings), `content.js` — what the files hold, `history.js` — which commits come of it, `note.js` — the fixture's note with the list of traps |
| `probes/` | The archived scripted measurements behind `plans/2026-09-17-page-perf/` (`probes/archive/`, one file per step, run by hand against live Chrome at the debug port — the fixed layout, where `content-visibility` acts at all, the price of a switch and of a step sideways) and their index (`probes/README.md`). Kept as the record of how the plan's figures were taken; outside the sensors' paths on purpose: they measure the product rather than being part of it, and a suite cannot see layout, paint or a browser's own skipping |
| `tools/parity-live.js` | Compares the engine with the live project on a clone: the numbers and the self-contained report at the path the consumer's settings give (`pnpm run parity:live`) |
| `tools/pack-check.js` | Assembles the tarball and checks that everything works from it: all sources arrived, the numbers and the report as from the repository (`pnpm run pack:check`) |
| `tools/check-standards.js` | Checks that both references reproduce: a re-take goes nowhere and is compared with what is committed (our files byte for byte, the bundle by content), and that the live-history bundle carries `HEAD` (`pnpm run check:standards`) |
| `.github/workflows/ci.yml` | CI: the job `verify` calls `pnpm run verify` on every push and every pull request — the same profile as locally; the actions are pinned by commit SHA |
| `.github/workflows/verify-slow.yml` | The slow profile on a schedule: the same plus the same suite with no machine git settings and coverage under c8 — the dear steps, not in every run |
| `tools/gates/run.js` | The check profiles — the single list of steps: `fast` (every edit), `full` (before pushing and in CI), `slow` (+ the hermetic suite and coverage); `--list` prints the commands |
| `tools/gates/metrics.js` | The bloat sensor: rules of size and complexity, the weight of checks, debt marks — with an ESLint suppression ratchet (`.eslint-suppressions.json`) |
| `tools/gates/dup.js` | The duplication sensor: clone fingerprints by content (`dup-baseline.json`), a view against the baseline file and one against the `origin/main` tree |
| `tools/gates/deps.js` | The dependency sensor: cycles, orphans, the direction of layers and unresolvable imports (`dependency-cruiser`) |
| `tools/gates/coverage.js` | The coverage sensor: a per-file ratchet against `coverage-baseline.json` rather than a percentage over the repository. The unit is **how much executed** — lines, branches and functions, taken from c8's own numbers — so a file that merely grew does not move the ratchet while code that stopped being run does |
| `tools/gates/gatefiles.js` | The guard of the gate files: editing thresholds, baselines or the harness without the `Gate-Change:` trailer is red — the `commit-msg` hook at commit time and the `pre-push` hook over a range, while CI reads no trailers at all |
| `tools/gates/common.js`, `tools/gate-probe.js` | What the sensors share (the root, argument parsing, reports) and the harness of their probes: a sensor is called as a command rather than imported |
| `.githooks/commit-msg`, `.githooks/pre-commit`, `.githooks/pre-push` | Hooks: the guard of the gate files, the fast profile on an edit and before a push; installed by `pnpm run hooks:install` (no hook manager of our own is started) |
| `.githooks/post-commit` | Refreshing the report after a commit: a call to the installed copy of the package (the line was written by a person — the tool does not edit someone else's hook directories) |
| `eslint.metrics.config.js`, `.eslint-suppressions.json` | The bloat sensor's rules and its baseline: thresholds taken from measurements, and everything above them lies in the baseline to be worked off gradually |
| `.jscpd.json`, `dup-baseline.json` | The duplication sensor's settings and baseline: a fingerprint is taken from a clone's content, which is why the baseline is portable |
| `.dependency-cruiser.cjs`, `.c8rc.json`, `coverage-baseline.json` | The rules of the dependency graph, the settings of the coverage run and its per-file baseline |
| `AGENTS.md` | A short instruction for an agent in this repository: what to run, what to do when a sensor is red, what must not be touched |
| `.github/workflows/release.yml` | A release by tag: the strict linter, the whole suite and the work from the assembled package, the manifest version compared with the tag, and publishing to the registry by the GitHub Actions attestation — no secret and no code from an authenticator |
| `templates/` | What a project takes as it is: `size-report.config.json` (a draft of settings), `ci.yml` (a description of the check) and `README.md` (what goes where and what to change in them); they ship and are guarded by `pack:check` and `test/templates.test.js` |
| `fixtures/parity/` | The reference taken from `safe-resets` at commit `bd6ef9d`: 95 rows × 27 columns. The copy of the implementation it was taken with does not lie in the tree — its bytes live in the history and are taken from there on demand |
| `fixtures/synthetic/` | The fixture's bundle of 16 commits, its config, the reference numbers (the earlier copy's `--json`) and the hash of its artifact in its earlier shape — a record of what the move was checked against |
| `fixtures/live/history.bundle`, `fixtures/live/README.md` | The consumer project's history at the reference revision `bd6ef9d` and a note on which revision the bundle carries and why it lies in the repository: the live comparison works without access to the private project |
| `bin/size.js` | The `size` command: what the package installs (`package.json` → `bin`); it counts nothing itself and only calls the entry point |
| `LICENSE` | MIT: the licence terms travel in the package |
| `.gitignore`, `pnpm-lock.yaml` | What does not go into the repository; the pnpm lock file, while the manager's version lives in the `packageManager` field (which is where CI takes it from) |
| `src/size-table.js` | The package's entry point: a re-export of the public API (55 names) and no calculation of its own |
| `src/derived.js` | The report's shared calculation: totals, deltas, a cell, a commit's caption — one for the engine and the page's program |
| `src/css.js` | Reading the styling from disk: which sets of styles exist and what role each has |
| `src/table.css` | The report's table: the geometry of the window — one width per column, one height per row, the two lines of the header, the pinned commit column — the sticky header and commit column, one 1px line of one colour for every border, a file's caption centred over its group and cut with an ellipsis, the colour of deltas |
| `src/page/app.css` | The page's styling on top of the shared part: the panel with the file tree and its sticky row of categories (a column on the left on a wide screen, the page fitting the window), the empty states, a narrow window |
| `src/page/payload.js` | The page's block in sparse form, and the one place that unrolls it back: the history as changes (a file's appearance, its moves, its disappearance) turned into the snapshots the calculation and the table already speak — a value that did not move is one object shared by the rows that hold it |
| `src/page/state.js` | The page's state: the report's data (the block unrolled by the payload chapter), the view of the checkboxes, the pointer "which path is which column", the unfolded folders, the record's passport, the browser's memory and the link that is read out of the address — a chapter of the page's program |
| `src/page/dom.js` | The page's nodes: the small helpers of markup (`appEl`, `appBox`) — one set for the panel and the table alike |
| `src/page/panel.js` | The panel of choices: the switches of metrics and files, the categories, the tree of the project's paths (files outside the report keep a checkbox off with a reason and stand after the rest, and a hidden name after every visible one; the tree opens folded and folders carry a sign that hides the subtree by a class rather than by a rebuild); built once, with the fields of the switches and of the folders and categories written where they stand |
| `src/page/table.js` | The page's table as a window: the rows and the columns the reader can see (plus four beyond each edge), moved by a scroll rather than built again (a row lives through a step sideways and only the columns that entered it are made), a cell, a commit's caption, the header, the empty states and the order of the columns — markup over the shared calculation, with the totals counted per row from the choice, the geometry in pixels that the styling mirrors, and the reason a library was not taken |
| `src/page/app.js` | Assembling and starting the page: the first drawing, then a switch that builds the window again and writes the fields it reached without making a node of the panel; an anchor change; pasted into the assembled page |
| `src/page/build.js` | Assembling the page: data, styling and program in one file with no external references — the pasted text is **squeezed** on the way in (comments and indentation out, the same stripping the `min` metric counts) while the sources keep them, and the result is guarded by the stripper's own `assertCompilable` |
| `src/git.js` | The only border where git is called: the pinned settings, blobs by the batch, the history, the comparison with the working tree |
| `src/strip.js` | Removing ballast: which form goes to which file (extension, strategy) and which strategies are minification itself — the entry to the parsing of forms |
| `src/strip/js.js` | Removing comments and indentation in JS: a pass over the cases (a comment, a regexp, a string, a character) — through strings and templates as well |
| `src/strip/forms.js` | The forms of text with a removal of their own: markup, styles, the lines of a file and JSON |
| `src/strip/guard.js` | The stripper's guard: what was stripped has to compile — as a script in the process or as a module in a worker thread |
| `src/parse.js` | Parsing a module: one worker thread per run and a fallback to `node --check`, and the way the last module was parsed |
| `src/parse-worker.js` | The parsing itself inside the thread: it parses the text without executing it and reports that Node has no vm modules |
| `src/metrics.js` | The register of metrics: what is measured, whether the text is needed and how honest the number is; a metric's description for the reader lives in one place |
| `src/minify.js` | The real minifier: an optional dependency, loaded once, and it does not bring the run down when absent |
| `src/tokens.js` | Tokens: a dictionary by family and encoding, an estimate by length as the fallback count, the formats without text |
| `src/optional.js` | The shared handling of optional dependencies (the minifier and the dictionary): lazy loading, the package's version, the seam of absence |
| `src/history.js` | Walking the history: measuring commit by commit, shifting the numbers, assembling, comparing with the working tree, the mark "which column the last commit touched" and a reason for every dropped commit |
| `src/check.js` | Coverage (`size check`): settings, history, paths, sensors — what went past the columns and how that is fixed |
| `src/explain.js` | Explaining a missing row (`size explain <commit>`): the reason, the evidence and a ready fix |
| `src/doctor.js` | Diagnostics in one answer (`size doctor`): the environment, the dependencies, the settings, the coverage and the hook's state — assembled from the pieces that already exist |
| `src/hook.js` | The hooks of self-updating: they install themselves (`autoInstall` — from the entry point and `bin/postinstall.js`), come off by a command, commit the report alone, and keep a lock and a record of the run |
| `bin/postinstall.js` | Installing the hook after the package is added: it looks for the consumer project and stays silent when there is nowhere to install |
| `src/artifact.js` | The report on disk: the only place where it becomes a file (both `--write` and the hook use it); the report is a self-contained page |
| `src/journal.js` | The journal and links: which section a commit belongs to and where a description leads |
| `src/data.js` | The file categories (a test by its path — a `test`, `tests` or `fixtures` folder, or `.test` before the extension — otherwise the extension, and the settings above both) and the contract with the page (`--data`): the numbers, the shape of the table and the catalogue of the project's paths |
| `src/config.js` | The consumer project's settings: the defaults, reading them, checking them |
| `src/project.js` | The settings derived from the project itself (its tree and history): columns, the journal, the exceptions, the catalogue of paths for the page's tree. Without a settings file it *is* the settings; `--init` pins it as a file |
| `src/locales.js`, `src/refusal.js`, `src/tool.js` | The report's texts; the exit codes and the help; the package's name and version |
| `src/cli.js` | The tool's entry: parsing the command line, reading the project and handing the request to a mode; the package's main file |
| `src/args.js` | The grammar of the command line: modes, flags and commands plus the checks of their combinations — a refusal names the culprit and a ready command |
| `src/modes.js` | The modes: assemble the report, compare it with the history, hand over the data, the coverage and the diagnostics |
| `src/init.js` | Pinning the settings as a file (`--init`): what the project derived about itself is written out — and goes through the same check as the first run |
| `test/api.test.js` | The package's public API: the list of names is frozen, and splitting the engine may not change it |
| `eslint.config.js` | The rules of formatting: the same as the consumer project's, plus a ban on gluing operators into one line (`pnpm run lint`, `pnpm run lint:strict`) |
| `tools/harness.js` | The harness of the checks: paths, clones of the fixture (including one shared per suite and one with CRLF), running the tool, reading refusals, hashes |
| `tools/page-harness.js` | The harness of the contract and page checks: the contract data, the assembled page, reading it in a real DOM, one set of readers for every page suite (a file's path at HEAD, the rows the window built and their numbers, the captions over them, the order of the columns, a folder's and a category's switch, the place the shell stands at), the page's calculation and its decoder evaluated from their sources, the block unpacked, and the platform's unpacker put into jsdom (which has none) — one for seven suites |
| `tools/suites.js` | The split of the suite: which files go into the fast run (with a reason for each) and why every dear one is in the full run |
| `tools/run-tests.js` | Running the suite (`pnpm test`, `pnpm test:all`, `pnpm run suites:measure`): each file's duration measured on its own, and the counts of checks adding up |
| `tools/docs-facts.js` | Reading facts out of the documentation — one layer for the two checks of the documentation guard: what a document names (paths, calls, section addresses) against what the repository holds |
| `tools/yaml.js` | Parsing a subset of YAML — one parser for the two guards over descriptions (`templates/ci.yml` and `.github/workflows/release.yml`): anything outside the subset is an error rather than a silently skipped line, including a colon followed by a space in an unquoted value — which is what kept the release description unparsable while the check looked for substrings |
| `tools/refusals.js` | The catalogue of refusals: one line per refusal — its cause, its exit code, the phrases its output must carry, and **what it advises** (`advice`: `run` — a command, `template` — a form with substitutions, `manual` — a person's action with its reason, `coveredBy` — handed to another check), and for one that cannot be caught at all, why. The maps of refusal sites (`SITES`, `PRINTED`) hold the counts, so that a new refusal cannot appear in silence, and the markers of advice so that a new piece of advice cannot either |
| `test/parity.test.js` | The engine's parity with the reference: the numbers, the report's self-containedness, the locale |
| `test/frozen.test.js` | The frozen copy: that it is the revision the reference was taken at, and that it reproduces that reference |
| `test/environment.test.js` | Hermeticity: the output does not depend on the machine's git settings or on its locale |
| `test/crlf.test.js` | A checkout with CRLF (`core.autocrlf`) does not hinder the comparison |
| `test/disk.test.js` | The comparison with the working tree: an edit only on disk, three ways of losing a change (an edit, a creation, a deletion — all by mutation), a file deleted before HEAD, and a rename inside aliases is no loss |
| `test/cli.test.js`, `test/cli-paths.test.js` | The command line's refusals: the help, the settings, the exit codes — and where the tool writes |
| `test/refusals.test.js` | The refusals are executed: each one is called by a run, its exit code and its promised phrases are compared (with clones of their own for someone else's hook, a shallow history and a branch past the report), and **the advice runs** — the command answers with the promised code and no stack, while where "the refusal is gone" is declared the same call answers differently after it |
| `test/refusals-catalog.test.js` | The guard of the refusal catalogue: every refusal site in the sources has an entry, every entry declares its advice, and refusals handed to another check are really accepted by it (the named file and line are checked) |
| `test/contract-data.test.js` | The data contract: the numbers against the reference, the set of fields against the derived quantities, the metric's method against the way the numbers were counted — and the round trip through the page's sparse block, which restores the contract whole and twice over the same bytes |
| `test/contract-derived.test.js` | The derived quantities against the artifact's numbers: a row's totals, a cell's delta and the delta of a total — on the code that lies in the tree |
| `test/page-grid.test.js` | The grid of the page as a window: what the reader sees is built and no more, the geometry of the styling against the script's, the rows and the columns that a scroll builds and drops, a number under its own caption, a file and a metric switched off, every row of the window against the engine's own calculation, and the drawing's own rules — the order of the columns by the numbers, one border, the header's rows of one height, and the panel out of the shared styling's reach |
| `test/page-view.test.js` | The assembled page: pasted with no copy of the calculation, self-contained, the sparse block, the recount by the choice, every total of the window against the engine's own sums, no mark of precision left on a cell, the shared styling pasted once and the delta colour set once, the empty states, and the switches' focus |
| `test/page-tree.test.js` | The panel's file tree: folders by the project's paths, three states, the subtree, files and folders outside the report (a checkbox off, a place after the rest), the hidden names at the end of a level, the tree that opens folded and the unfolding the memory keeps, folding without a rebuild and a scroll a click does not touch |
| `test/page-choice.test.js` | The reader's choice: the memory and a revisit, someone else's report, a foreign and a broken record, an address that stays clean, a link read at opening and on an open page, and a host without an unpacker that is told so in words |
| `test/page-cols.test.js` | The columns of the grid: their order by the newest row a file's numbers moved in, a caption over exactly the metrics of its group, and a choice that moves no other column |
| `test/module.test.js` | A module under a `.js` extension: measured without touching the settings; the stripper's guard is alive (proved by mutation) and does not accuse the innocent |
| `test/guard.test.js` | Parsing a module: it goes through a thread, both paths give one verdict, the fallback works with the thread's file away, and hundreds of parses are cheaper than a launch |
| `test/runner.test.js` | Reading a process's output: chunks are glued as buffers rather than appended to a string — a multi-byte character at a chunk border does not turn into two replacement characters |
| `test/git-pins.test.js` | The guard of the git border: no direct calls to git outside the shared list of pins, and an unpinned read is shown by a witness (a quoted path) |
| `test/docs-paths.test.js`, `test/docs-commands.test.js` | The documentation guard, one file per promise: the paths and the file table; the calls, the causes of refusal and the section addresses |
| `test/release.test.js` | The guard of the release from CI: it begins with a tag, the version comes from the manifest, no secret and no one-time code are needed, a prerelease does not go to `latest`, the whole suite runs before publishing — and the hint on npmjs.com names this same file |
| `test/suites.test.js` | The guard of the suite's split: the classification is complete (fast only explicitly, full with a reason), every file has its reason, and the fast run stays part of the suite |
| `test/gates-metrics.test.js`, `test/gates-dup.test.js`, `test/gates-deps.test.js`, `test/gates-coverage.test.js`, `test/gates-files.test.js` | The sensors' probes: an artificial violation → the sensor is red, taking it away → green again; the run calls a sensor as a command rather than importing it, which is why it proves the exit code too |
| `test/gates-verify.test.js` | The guard of the single list: the profile's commands against the workflows, the hooks and `templates/ci.yml` — a check that is not in the profile cannot be in CI |
| `test/check.test.js` | Coverage and explanation on the fixture's real commits: an uncovered path, "only the report", "the number did not move", "past the columns", a merge — and that a fix of the settings does not move the numbers |
| `test/doctor.test.js` | Diagnostics over five states of a project: no settings (2), full coverage (0), incomplete (1), a shallow history (3), no sensor (4) — and the coverage block equals the answer of `size check` rather than being counted a second time |
| `test/hook.test.js` | The hooks on a fresh clone: they are installed by a command only, give a commit of the report's own (after a merge as well), a repeated run stays silent, someone else's work and the index are untouched, nothing happens in CI or on a refusal of the tool, and removing them returns the project to what it was |
| `test/templates.test.js` | The templates: the draft of settings passes the tool's check and assembles a real report; the description of the check parses and calls only commands and flags that exist |
| `test/minify.test.js`, `test/tokens.test.js` | Real minification and tokens: the numbers against stripping, the encoding as part of the number, the honesty of a caption, work with no optional dependency (code 4) and the seam `SIZE_REPORT_NO_OPTIONAL` |
| `package.json` | The package's manifest: the name `@vernikr/size-report`, the version, and a shipped-file list that holds only what exists |

**Both references are taken anew by the same tools:** `pnpm run parity` and `pnpm run fixture` give
the same files. What is ours is compared byte for byte — the config, the reference numbers, the
artifact's hash, the description — while the history bundle is compared by content (the branches, the
tip, the number of commits), because git does the packing and its bytes depend on git's version. Both
sides of the pair are pinned: the tool is a frozen copy of the implementation, whose bytes live in the
history (`fixtures/legacy/size-table.cjs`) and are compared against the record of the reference's
provenance, while the project's revision comes from the manifest (`--at` shifts it deliberately) and
the environment of the capture is set (`core.quotePath=false`). Without the pinned environment the
reference is taken with different numbers: on a machine with git's default settings the fixture loses
a row whose file name is not English. Repetition and hermeticity are not taken on trust either:
`test/git-pins.test.js` shows an unpinned read by a witness, `test/environment.test.js` keeps the
output independent of the machine, and the slow profile repeats the whole suite with none of the
machine's git settings at all. That what the manifests record agrees with the files is guarded by
`test/frozen.test.js`.

## What is not here yet

```text
dist/app.js          a pre-assembled report program: the page's program is pasted into the page
                     while the report is built, so the file would be a second copy of the same
size init / measure  commands instead of flags: of the commands only check, explain, doctor and
                     the hook are here, and no command measures at all
a block for agents   an instruction for the project's own agent: the requirements do not ask for
                     it, so the templates carry none
HTML minification    a minifier of markup: HTML counts as stripping for now
JSX and TSX          the output depends on the project's own jsx setting — stripping
token families       anything but openai: the others have no dictionary of their own, and counting
                     with someone else's is not a family
```

The seams between modules follow the borders of data: above sit the parts that read git and the file system
(`git`, `strip`, `metrics`, `history`), below the parts that work on values already collected (`data`,
`derived`, `page`), while the settings, the texts and the refusal stand at the edges, because everyone
knows them and they know no one. Both reports are counted at build time: the page gets the sources of the
shared calculation and of its own program pasted in (`src/derived.js`, `src/page/*.js`) and squeezed on the way
in, because it opens from disk, with no server and no network. The rest is planned step by step in
`plans/archive/PLAN.md`.

## Wiring it into your project

The instruction was walked through command by command in a fresh project (the protocol is in
`worklog/archive/WORKLOG.md` §54): below are exactly the commands that work today. What does **not** work
today is named here too, with its reason, so that nobody has to find it out by trying.

What is needed: **a git repository with history** — at least one commit, because the table is built from
commits (a repository with none ends in an internal error today: `BLOCKERS.md` §N16) — and
**Node ≥ 20.19** (`engines` of the package).

### 1. Installation

```bash
pnpm add -D @vernikr/size-report
```

The package is **published in the registry**, and publicly: `npm view @vernikr/size-report version`
answers the same version the manifest names, `npm access get status @vernikr/size-report` says `public`,
and an anonymous request for the tarball is a 200. `npm i -D` and `yarn add -D` take the same name; no key
and no link to the repository are needed.

With no network (or nothing to fetch from codeload) — the tarball: `pnpm pack` in the package clone, then
`pnpm add -D ./vernikr-size-report-<version>.tgz`, where the name is the one `pnpm pack` printed.

The package repository is **public** (it was private until 2026-09-14), and that is exactly what makes the
installation simple: no developer key and no CI step with access. Checked by a run in an empty project
where git had neither global settings nor a credential helper (`GIT_CONFIG_GLOBAL=/dev/null
GIT_CONFIG_SYSTEM=/dev/null GIT_SSH_COMMAND=false`): `size --write` and `size` work there
(`worklog/archive/WORKLOG.md` §44). The earlier requirement was the price of privacy: a key locally and a
read-only deploy key before `pnpm install` in CI (that first wiring, `worklog/archive/WORKLOG.md` §18);
the template's key step went away together with the privacy. The publication to npm happened on
2026-09-15, and it had a price: the name `size-report` in the registry is taken by someone else's package
(2017, three versions), so the release was also a renaming into the owner's scope (`@vernikr/size-report`)
rather than just an upload of an archive; what the renaming touched — `plans/archive/PLAN.md` §10, what proves the
publication — `worklog/archive/WORKLOG.md` §53.

### 2. Settings: you need not create them

```bash
pnpm exec size --write     # the table; no settings — the tool derives them itself
pnpm exec size --init      # pin what it derived into size-table.config.json
```

There is no need to start with settings: without a file the tool derives them from the project — the
columns are **every tracked file git can measure** (the report names the volume of the project rather than
of a sample of it, and the only limits are what cannot be a column at all: the report itself, dependency
locks, built output, an unknown format and a file above 512 KB), while everything else is named in `skip`;
the journal is the first familiar one (`WORKLOG.md`, `CHANGELOG.md`, …); the report file is
`docs/size-report.html` (the directory is created by the writer); the fix command is the declared `sizes`
script, or the path to the installed package without one (the report's signature and the refusals quote it,
so it has to work right here and now); the commit link comes from the `origin` address; the metrics are
`raw`, `min` and `tok`. The `min` metric is counted by real compression here (`"minify": {"engine":
"esbuild"}`), and `tok` by a dictionary (`"tokens": {"family": "openai", "encoding": "o200k_base"}`):
without those optional dependencies the metric honestly falls back to another count and the run returns
code 4 — no settings need editing for that either.

Everything that cannot be a column (the report itself, dependency locks, maps, built output, an unknown
format, a file too large) and everything git does not track is named in `skip` — which is why the first
`size check` is complete rather than red: "paths past the columns" appear from new edits, not from a
project that has not been described yet. That the settings were derived, the tool says in a line on stderr
and names the command that pins them, `--init`; what is pinned passes the same check as any settings file,
and afterwards it is edited by hand (the `--init` itself prints what it pinned and what to do next — the
scripts and the CI check). Without pinning, the profile is derived anew on every run: the column set
changes from run to run (the tool says so with that very line), so repeating the same measurement — by the
hook and by the check included — is possible only from a file.

What is pinned is **the very thing the project runs on without a file**: the derivation from the project
on top of the defaults. That is why the pinned file holds values nobody wrote in the project — then a
change of the defaults in a new version of the package does not travel over an already configured project
in silence.

> `size init` as a command does not exist — `--init` is a mode: the commands are `check`, `explain`,
> `doctor` and the hook, and the full list is given by `size --help`.

### 3. What is edited in the config

The derivation knows about the project only what the tree and the history show — which columns matter is
known to a person. What is edited most often:

| Key | What it is |
|---|---|
| `columns` | the table's columns: `{label, paths: [...]}`; **a column is a file**: the list of paths is its renames (a revision takes whichever of them it holds), not several files at once; `label` is what a person will see |
| `metrics` | what a number is made of: `raw` (the size of the git object), `min` (the minified form — which one, `minify.engine` decides), `tok` (tokens), `gzip` |
| `tokens.family`, `tokens.encoding` | the dictionary for `tok`: the family (`openai`) and the encoding (`o200k_base` or `cl100k_base`) — the encoding changes the number, which is why it is both in the settings and in the metric's label |
| `minify.engine` | what counts `min`: `strip` (comments and indentation — a simplification, and the method names it as one) or `esbuild` (real compression; a format the minifier does not take counts as stripping, and the method says so) |
| `output` | the report file (in the derived profile `docs/size-report.html`; the directory is created by the writer). The path enters the report's passport — the key of the saved choice — so a changed path means a fresh choice |
| `journal` | where to look for the journal sections the rows refer to |
| `links.commitUrl` | the commit link template, for example `https://github.com/org/repo/commit/{sha}`; derived from the `origin` address for GitHub and GitLab (for other hosts — empty rather than a guess) |
| `skip` | the paths that did not become columns: both those that cannot be (the report itself, dependency locks) and those that did not fit (the derived profile declares everything else an exception — which is why the first `check` is complete) |
| `fixCommand` | the command the report's signature quotes and a refusal suggests; in the derived profile it is your `sizes` script if it is declared, and otherwise the path to the installed package inside the project (a call by package name goes to the registry — `REFACTOR.md` R-4.21) |
| `locale`, `title`, `heading` | the language of the report's texts and its headings; empty `title`/`heading` mean "take them from the locale" |
| `minify.guard` | the extensions whose stripper output is checked by parsing; a module in `.js` the guard understands by itself, and there is nothing to touch there |
| `hooks.enabled` | the switch of the self-updating hook (`false` — the hook is not installed by itself and keeps quiet if it is already there; it is removed only by `size uninstall-hook`) |

The other keys and defaults are in `src/config.js` (`DEFAULT_CONFIG`).

### 4. Scripts and the first report

```jsonc
// package.json
"scripts": { "sizes": "size --write", "test:sizes": "size" }
```

```bash
pnpm run sizes            # → docs/size-report.html — the report: the table, the filters, the link
```

The report is one self-contained file: it opens with a double click, with no server and no network (it
holds no external references at all — the data, the styling and the program are pasted in). What is
derived (the deltas, the totals, the filters) is counted by the page itself — from the absolute values the
engine gives, and by the same code as the engine's own calculation.

**The order of edits:** code → `pnpm run sizes` → a commit with the table alone. The table is updated in a
**commit of its own**, because a commit cannot have a row inside itself: update it together with the code
and the tool warns (the text is quoted as the tool prints it: `! the table was updated together with the code: <sha>`)
and names the commit that dropped out.
The `size` check rebuilds the table and compares it with the file on disk, so it catches a forgotten
rebuild too. Dropping the report from git altogether is possible as well: the completeness check exists
for that, and `templates/ci.yml` says which step to put in its place when the report is not in git.

### 5. The check in CI and before a commit

```bash
pnpm run test:sizes       # 0 — the table agrees with the history
pnpm exec size check      # 0 — not one change went past the columns
pnpm exec size doctor     # 0 — nothing to do; otherwise the first code by importance
```

`size check` answers a different question than the `size` command itself: that one says "the table agrees
with the history", while this one says "the whole history is counted": every path the commits touched has
to be either a column or a declared exception (`skip` and the report file itself), otherwise it is **code
1** with the list of paths, the commit that introduced the path and a fix command. The report need not lie
in git for that — completeness is exactly the check that replaces "artifact ↔ history". When a single
commit is in doubt, `pnpm exec size explain <commit>` explains why it has no row: the report alone was
touched, the numbers did not move, the commit went past the columns, or a merge is hidden by a setting —
with evidence and a fix where there is one. The commit may be named the way git names it: `HEAD`,
`HEAD~1`, a branch or a tag, a full sha or its beginning. If the name leads to a commit outside the
report's history (another branch), the tool says exactly that and names its sha — rather than "no such
commit".

`size doctor` gathers all the diagnostics into one answer: the environment and its influence on the numbers
(the machine's settings do not influence them — the engine pins them at the call's border), the state of
the optional dependencies and what it means for the count, the validity of the settings and the completeness
of the coverage. It answers with the same pieces as the other commands: the coverage block is exactly the
answer of `size check` rather than a second calculation. The exit code is the first by importance rather
than "something was found": `2` the settings are unreadable (there is nothing else to read), `3` the
history is cut short, `1` the coverage is incomplete, `4` a sensor counted another way, `0` nothing to do. A
sensor the settings are silent about is named unneeded rather than missing, and it is not loaded: the
dictionary weighs megabytes, and there is nothing to pay with for an answer the numbers never needed.

The completeness check is deliberately **not** in the template CI (`templates/ci.yml`): the columns there
are an example, and in a project whose columns are not chosen yet such a check would be red for no reason.
Once the columns describe the project, it is added in one line (`pnpm exec size check`).

The ready line for CI: `pnpm run test:sizes` — nothing else is needed: the check *is* the `size` command,
and a consumer has no test suite of its own to install. The `--init` prompt says the same: the check is a
command of the package and brings no files of its own into the project.

The package also ships a ready description of that check: `templates/ci.yml` from the package
(`node_modules/@vernikr/size-report/templates/ci.yml`) goes to `.github/workflows/size-report.yml` without
edits — the table rebuilt and compared with the file on disk, two snapshots of the numbers (a plain one
and one in an environment without the machine's git settings) and their comparison. It needs no secrets.
For `npm`/`yarn` the file itself says which two lines to replace. Next to it is
`templates/size-report.config.json`, a sample of settings: its columns are examples (`README.md`,
`package.json`) that nearly any project has, so the first report is built at once. It is needed only to
start from an edited file: with no file the settings are derived from the project (`--init` pins the
derived ones), and the sample is copied to the project root as `size-table.config.json`.

The package's own CI is `.github/workflows/ci.yml`: it runs at home the same list of checks as a local run
(one command, `pnpm run verify`, whose list lives in `tools/gates/run.js`), while what a consumer's CI is
put together from are the templates above.

| Code | What happened | What to do |
|---|---|---|
| 0 | everything agrees | nothing |
| 1 | the table diverged from the history (or an edit on disk is not committed); for `size check` — a path of the history is neither tracked nor excluded | `pnpm run sizes` and commit the table; for `check` — add the path as a column or to `skip` |
| 2 | something in the call or in the project — the causes are quoted as the tool prints them: **command line** (unknown flag, flag without a value, repeated flag, two modes at once, extra word, command and mode, unknown command, incompatible flag, no JSON answer, two answers at once, no commit); **settings and the project** (no settings file, settings not parsed, settings invalid, git missing, not a git repository, config already exists); **history** (no such commit, ambiguous commit, commit outside the history); **hook** (foreign hook, foreign core.hooksPath, no way to invoke the tool); **measurement** (file is not JavaScript, minifier did not parse) | the refusal text names the reason and a ready command — and it is executable: `test/refusals.test.js` guards that |
| 3 | a shallow history (a clone with `--depth`) | a full clone: `git fetch --unshallow` |
| 4 | no sensor | `minify.engine: "esbuild"` with no minifier: the numbers are stripped rather than minified. The report is built, and its text carries the reason and the fix; if the table also diverges from the history, the code stays **1** (a mismatch outranks the sensor note) while the note about the other count is printed next to it |
| 5 | an internal error | this is a defect of the tool: we are the ones who need the text — see "Traps worth testing the engine on" below |

The cell of code 2 quotes the tool rather than describing it: those are the names of the refusal registry
(`CONFIG_CAUSES` in `src/refusal.js`), and the documentation guard compares this table with it word by
word — which is why that one cell speaks the language of the command line, while the report's own texts
are translated by the `locale` key.

### 6. The report updates itself after a commit

```bash
pnpm exec size install-hook     # install post-commit and post-merge
pnpm exec size uninstall-hook   # remove them and return the project to its previous behaviour
```

The hooks install themselves, and that is the only thing a project notices about installing the package:
after `npm i` by an install script, with pnpm 10 by the tool's first run (pnpm does not run dependency
scripts — "Ignored build scripts"; it can be allowed with `pnpm.onlyBuiltDependencies:
["@vernikr/size-report"]` in your manifest). The files land in `.git`, `git status` does not see them, and the
command above takes them away. It installs only where that is safe — an ordinary hooks directory, no hook of
someone else's, something to call the tool with — and stays silent where it is not. After every commit and
merge the report is rebuilt: the `docs` directory and `size-report.html` are created if they are not there
yet, and a report **tracked** by git lands as a commit of its own signed `chore(report): report rebuilt
after <sha>` (the signature is quoted as the hook writes it, like every other line of the tool's output in
this document). Only the report's path is committed: the tree comes from HEAD with that one path replaced, so
neither someone's index nor uncommitted work can enter the commit.

The first report is the exception: while the report is untracked the hook rebuilds it and says so in words
instead of committing — adding a new file to someone else's history is a person's decision. One `git add
docs/size-report.html` (or a plain `git add -A` if the report belongs in the project) and from then on it
travels by commits itself. A merge is the same case as an ordinary commit, with one correction to what git
does: the merge commit is made by git itself and does not run `post-commit`, hence the second file,
`post-merge` (checked on git 2.50).

There is no looping, and by construction rather than by a flag: the report's commit is assembled with
plumbing (`commit-tree` calls no hooks at all), and the report itself gets no row, so the same rebuild yields
the same bytes. A refusal by the tool does not bring the commit down — the commit has been made already: the
cause is printed as one line and remembered, and `pnpm exec size doctor` shows what the hook did and how the
last run ended. The automation is switched off in two ways — `"hooks": {"enabled": false}` in the settings
(the hook stays but keeps quiet) or `size uninstall-hook` — while in an environment where updating is not
wanted at all (CI, someone else's machine) the hook keeps quiet by itself: the hook file lies in `.git`
rather than in git, so every clone has one of its own, and the body checks whether there is anything to call
the tool with. `SIZE_REPORT_NO_HOOK` is the lever for one who would rather not edit the settings.

### 7. Traps found by this very instruction

Two of them were found by the walkthrough and are closed already — they are kept here as an explanation of
behaviour rather than as workarounds:

- **A module in a `.js` extension** (`import`/`export` in `.js` is ordinary in projects with a bundler) is
  measured like any other file, with `type: module` in the manifest or without it: the guard parses the
  result both as a script and as a module. It used to try the script alone and fell with code 5 on the
  `export` itself, blaming the stripper; that is impossible today and no settings need editing
  (`REFACTOR.md` R-4.6).
- **Not JavaScript in a column** (markup or types straight in `.js`) is code 2 and a refusal naming the
  reason and what to fix. The reason comes from the way the file was counted: with `minify.engine:
  "esbuild"` the refusal names the minifier and its **one** way out (a simplification for that extension in
  `minify.ext` — the `strip` way would hand the same file to the guard, whose verdict would be the same),
  while with stripping it is the guard's refusal and **two** ways out (take the extension out of
  `minify.guard`, or set `minify.ext`). Neither looks like a stack.
- **No minifier** (an installation without the optional dependencies, a platform without `esbuild`) — the
  metric honestly falls back to stripping: the numbers are the same as `strip`, the label says so in words,
  and a **build** (`--write`) returns **code 4** with a ready fix. A **check** answers in two parts in that
  case, and it is named here because it is what CI advises: if the report on disk was built with the real
  minifier while the run goes without it, the numbers were counted another way — the numbers in the table
  no longer agree with the history, so the check says as much (**code 1**), showing the diverged signature
  row and **naming the other count right there** in a note with a ready fix. The verdict stays with the
  divergence: code 4 would claim the difference is explained by the sensor, and nobody checked that — the
  divergence may also be an edit that went past the report (the same order as `size check` and `doctor`: a
  mismatch outranks the sensor note). The fix in both cases is `pnpm run sizes`; on this environment it returns
  **code 4**. This can be checked without reinstalling by the `SIZE_REPORT_NO_OPTIONAL=1` environment — the
  same way `test/minify.test.js` does it.
- **The module parse is one worker raised once per a run** (`REFACTOR.md` R-5.4): the fallback to
  `node --check` (a Node run per cell) remains for when the worker's file is not in the package, the worker
  does not answer, or the Node build has no vm modules; and the worker is raised only if the measured files
  hold modules at all. The measured price of both is in `REFACTOR.md` R-5.4 rather than promised in numbers
  here.
- **A new column file has to be committed** before the run: the table is built from commits, so a file git
  does not track has nothing to measure and its column stays empty. The run itself does not complain — the
  file is named by the settings rather than by the project — it is the numbers that would be missing in
  silence. So `git add` + commit first, then `pnpm run sizes`.
- **An edit to the journal is an edit too.** A commit that touched the journal or any column file gets a row
  in the table, so the table is rebuilt after it — otherwise the check says "diverged from the git history"
  and names the row. An uncommitted edit does not move the table ("now" comes from the commit), so a
  rebuild is not broken by documentation being edited next to it.
- **`--init` does not edit `.gitignore`** (`REFACTOR.md` R-4.8) — add the report by hand if it has no place
  in the history.

Not on words: the section was walked through command by command in a fresh repository, and the findings are
in `worklog/archive/WORKLOG.md` §16. What keeps it true is the documentation guard (`REFACTOR.md` R-4.1):
paths, the file table, the calls and flags of the instructions and references to sections
are checked by machine. **No time target is declared anywhere** — seconds depend on the
window, so there is nothing to check against (`tools/suites.js` says why). Wording, meaning and promises
about the future are not checked by machine; a person holds those.

### 8. If a copy of the tool is already in the project

The order above is for a project wiring the tool in for the first time. When a copy is already there (its
own `size-table.js` and its tests), the steps go in another order; below is the one `safe-resets` migrated
by (`worklog/archive/WORKLOG.md` §18):

1. **Install without removing the copy** — two implementations live side by side for a while, and that
   gives a free comparison on one tree: the package's command with the project's config has to assemble the
   same artifact byte for byte (for `safe-resets` — 225 673 B, sha256 `1bdb27e1…`, and both are frozen in
   the parity reference, `fixtures/parity/manifest.json`). No match — do not go further.
2. **Move the project's commands to the package:** `"test:sizes": "size"`, `"sizes": "size --write"`.
3. **Remove the copy** — the tool and its test alike: the package's suite checks the same claims, and one
   command stays in the project. If the test was called from a shared runner, the runner's step becomes a
   single one calling the package's command rather than the project's file (in `safe-resets` the path comes
   from the installed package's manifest, so the step knows no internal file names).
4. **Take the deleted files' columns out of the settings** and rebuild the artifact in a **commit of its
   own**: commits that touched only those files move no number without them, and such commits get no rows.
5. **Clean the project's documentation:** references to the tool's files are replaced by the package's name
   and its commands, while a description of the internals (the stripper, reading the history in batches,
   the assembly) moves from the project's docs into the package's — otherwise there are two copies and they
   will drift apart.

No access to the package is needed either locally or in CI — the repository is public (§1), so there is no
key step in this order.

What is lost: the checks that compared the project's settings with the tool's expectations no longer run as
a suite of their own. Most of them are covered by the command itself (an unknown flag or an unfamiliar
metric in the config is a refusal with an explanation; the report file cannot be a column), but the
_content of the signature_ (the heading and the fix command taken from the config) is checked by nobody: if
that matters, it is one check on top of `--data` in the project.

## The gate against bloat

**The list of checks is single, and it is the one CI runs.** The profiles live in one place
(`tools/gates/run.js`): `pnpm run verify:fast` (tens of seconds — every edit), `pnpm run verify` (the full
one — before pushing and in CI) and `pnpm run verify:slow` (on a schedule — the same plus the suite with
no machine git settings and coverage). CI calls that same command rather than a list of its own: the job
`verify` (`.github/workflows/ci.yml`) on every push and pull request, the job `verify-slow` on a schedule.
That they agree is guarded by `test/gates-verify.test.js`: a check that is not in a profile cannot pass in CI.

**The sensors catch bloat rather than style** (style is the linter's business): the size and complexity of
functions, the size of modules, duplicated branches and functions (`sonarjs`), the weight of checks (a
check with no assertion, an assertion with no comparison, a switched-off check), debt markers, token clones
(`jscpd`), cycles and orphans in the graph (`dependency-cruiser`), and coverage falling against its own
baseline (`c8`).

**A threshold comes from a measurement rather than from a guess, and it is a ratchet.** The thresholds
today: a function's complexity 12, its length 60, a module 450 lines, cognitive complexity 15 — each of
them cut in the tail of a measured distribution, not in its middle. **Nothing lies above them**: the
baseline (`.eslint-suppressions.json`) holds nothing at all, so a new overrun fails the run while the
tree as it stands needs no excuses. The table behind the thresholds is in
`worklog/archive/WORKLOG.md` §58.3, and its figures describe the tree of that day rather than this one;
the sensors print their own numbers on every run.

**A person updates the baselines.** `pnpm run baseline:metrics`, `baseline:dup` and `baseline:coverage` —
and only with the `Gate-Change:` trailer in the commit message: a gate file edited without it is red both
locally (the `commit-msg` hook) and over a range (the `pre-push` hook, while CI reads no trailers at all).
Otherwise the gate would be weakened by the very commit it stops. The table of measurements and the
rejected tools (knip, ast-grep, size-limit, gitleaks) are in `worklog/archive/WORKLOG.md` §58.

## For an AI agent

- `pnpm run verify:fast` before every edit, `pnpm run verify` before pushing; what is wrong and what
  must not be touched when a sensor is red — `AGENTS.md`.
- `size check --json` — whether everything is in: how much of the history is covered, which paths went
  past the columns (with the commit that introduced them) and which commits dropped out without a row.
- `size explain <commit> --json` — why one commit has no row: the reason, the files it touched (columns,
  excluded, untracked) and a ready fix. The commit is named by a revision (`HEAD`, a branch, a tag), by a
  full sha or by its beginning.
- The data without the markup — the rows, the numbers, the totals — is `--json` (the earlier form, frozen
  byte for byte by the parity reference) and `--data` (the contract: absolute values and the shape of the
  table, with nothing derived — whatever the page can count itself is not there; the page's own block is the
  same data in sparse form). A `size measure` command does not exist yet.
- `--json` is a form of answer rather than a mode of its own, and it has one rule: exactly four calls have
  an answer. With no command it is the earlier form of the data (frozen by the parity reference), and for
  `check`, `explain` and `doctor` it is their answer. For a command with no answer, and next to a mode
  (`--write`, `--data`, `--init`), it is a refusal rather than silence: asking for JSON where there is none
  is an error of the call.
- `size doctor --json` — all the diagnostics in one answer: the environment, the dependencies, the
  settings, the coverage and findings with their level (`action` — to be done, `note` — to be known).
- Exit codes: `0` all is well · `1` a mismatch with the history or incomplete coverage · `2` the settings,
  the environment, an unknown or extra word, two modes at once · `3` a shallow history · `4` no sensor ·
  `5` an internal error. They work already: a refusal is a code and one line with a ready fix, with no
  stack. `--help` prints both.
- There are two runs, and both are named: `pnpm test` is the fast one (every edit), `pnpm test:all` the
  full one (a release and CI); what is in which and why is in `tools/suites.js`, while the numbers and the
  durations are printed by the run itself.
- Arguments are parsed once, on the way in and before the project is read: either one mode or a refusal
  naming both; a command and a mode do not work together; a flag with no value and a flag named twice are
  such refusals too. So a call the tool did not understand cannot be confused with a healthy run: instead
  of zero comes code 2 and a ready command.

## Traps worth testing the engine on

The fixture (`fixtures/synthetic/history.bundle`) is a history holding what breaks tools of this kind:
`//` inside a string, a regexp with an escaped slash, a template with an expression, `.mjs` with `export`,
a file name that is not English, CRLF, a file renamed, a commit that touched only the report, a mixed
commit, a merge with a conflict-resolution edit, a character replaced without changing the volume, a file
deleted and returned, an empty file, an unknown extension. The full list is in
`fixtures/synthetic/README.md`.

```bash
pnpm test                      # the fast run (every edit): parity on the fixture,
                               # the data contract and the page, the documentation and release guards
pnpm test:all                  # the full run (a release and CI): the same plus the integration ones —
                               # assembling on disk, the comparison with the tree, the hooks, the sensors
pnpm run suites:measure        # measure every file of the suite
pnpm run parity:live           # parity with the live project on a clone, two environments
node bin/size.js --data        # the data contract: the report and an agent
node bin/size.js --write       # the smallest report
node bin/size.js --help        # the help and the exit codes
pnpm run parity                # re-take the parity reference: the project and the revision from the manifest
pnpm run fixture               # rebuild the fixture and its reference
pnpm run pack:check            # does the engine work from the assembled tarball
pnpm run check:standards       # both references reproduce and the tree stays clean
git clone fixtures/synthetic/history.bundle /tmp/size-report-fixture
```

Open blockers and known gaps are in `BLOCKERS.md`, and next to them the note about the settings that were
checked and turned out inert, so as not to check them again.

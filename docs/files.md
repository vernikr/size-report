# What is in the repository

A map of the tree as it stands: the role of every file and module of this repository.

| File | Role |
|---|---|
| `plans/` | The plans of work on this repository: `plans/archive/` holds the earlier ones, `plans/2026-09-17-page-perf/` the plan of the page work — an index and one file per step of the report, each with why, what changes, acceptance and the risks (`plans/2026-09-17-page-perf/README.md`) |
| `plans/archive/PLAN.md` | **The main document of the move:** inventory, boundaries, invariants, architecture, the seven steps, acceptance, risks, open questions |
| `docs/requirements.md` | The customer's requirements: what and why |
| `docs/module-design.md` | The design of the extraction: how the module is put together |
| `docs/architecture.md` | How the tool is put together: the engine, the report, the checks and the promises they hold — and, beside them, the gate against bloat, the traps of the engine and what is not here yet |
| `docs/files.md` | This document: what is in the repository — the role of every file and module |
| `docs/wiring.md` | Wiring the tool into a project, step by step, and the surface for an agent |
| `docs/size-report.html` | The size report of this very project: one self-contained file, refreshed by the hook after every commit (as a commit of its own) |
| `docs/archive/README_old.md` | The README this project used to put on its main page, kept for its release notes after the main page became a short landing description and the living prose moved into `docs/`. No longer maintained; the settings its notes describe still stand |
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

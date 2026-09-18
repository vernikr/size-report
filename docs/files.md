# What is in the repository

A map of the tree as it stands: the role of every file and module of this repository. Related files
share a row — a folder in the list covers everything beneath it.

| File | Role |
|---|---|
| `plans/` | The plans of work on this repository: `plans/archive/` holds the finished ones (`PLAN.md` — the move, `REFACTOR.md` — the cleanup), `plans/2026-09-17-page-perf/` the page work, one file per step |
| `docs/plans/` | Plans of earlier pieces of work, a folder `yyyy-mm-dd-name` each, holding the plan and its subplans |
| `docs/requirements.md` | The customer's requirements: what and why |
| `docs/module-design.md` | The design of the extraction: the boundary of the package, its invariants, the data/display split and the shape of each part |
| `docs/architecture.md` | How the tool is put together: the data flow, the report page, the metrics, the commands, the checks and the gate, the traps, what is not here yet |
| `docs/files.md` | This document: the map of the tree |
| `docs/wiring.md` | Wiring the tool into a project, the settings and the surface for an agent |
| `docs/size-report.html` | The size report of this very project: one self-contained file, refreshed by the hook as a commit of its own |
| `docs/archive/README_old.md` | The README this project used to put on its main page, kept for its release notes; no longer maintained |
| `worklog/` | The journal of requests and of what was done, an entry per portion of work; `worklog/archive/WORKLOG.md` is the earlier journal in one file |
| `README.md` | The landing page, for a person (the completeness check of this table does not count it) |
| `AGENTS.md` | A short instruction for an agent in this repository: what to run, what to do when a sensor is red |
| `BLOCKERS.md` | Open blockers and known gaps (a workaround has to rest on a check) |
| `TODO.md` | Defects noticed in passing, one line each: where, what and how it shows |
| `LICENSE` | MIT: the licence terms travel in the package |
| `package.json` | The package's manifest: the name, the version, and a shipped-file list that holds only what exists |
| `.gitignore`, `pnpm-lock.yaml` | What does not go into the repository; the lock file, while the manager's version lives in the `packageManager` field |
| `.github/workflows/ci.yml`, `.github/workflows/verify-slow.yml` | The check profiles on every push and on a schedule — the same commands as a local run |
| `.github/workflows/release.yml` | A release by tag: the linter, the suite, the work from the assembled package, the tag against the manifest, publishing by attestation |
| `.githooks/commit-msg`, `.githooks/pre-commit`, `.githooks/pre-push` | The guard of the gate files, the fast profile on an edit and before a push |
| `.githooks/post-commit` | Refreshing the report after a commit: a call to the installed copy (the line was written by a person) |
| `eslint.config.js` | The rules of formatting, and a ban on gluing operators into one line (`lint:strict`) |
| `eslint.metrics.config.js`, `.eslint-suppressions.json` | The bloat sensor's rules and its baseline |
| `.jscpd.json`, `dup-baseline.json` | The duplication sensor's settings and baseline: a fingerprint comes from a clone's content, which is why the baseline is portable |
| `.dependency-cruiser.cjs`, `.c8rc.json`, `coverage-baseline.json` | The rules of the dependency graph, the coverage settings and its per-file baseline |
| `templates/` | What a project takes as it is: `size-report.config.json` (a draft of settings), `ci.yml` (a description of the check), `README.md` (what goes where and what to change); guarded by `pnpm run pack:check` and `test/templates.test.js` |
| `fixtures/parity/` | The parity reference taken from the consumer project: the numbers, the settings, the artifact's hash and the manifest; the implementation it was taken with lives in the history |
| `fixtures/synthetic/` | The fixture's bundle of commits, its config, the reference numbers and the artifact's hash, and a note listing the traps |
| `fixtures/live/` | The consumer's history at the reference revision and a note on why it lies in the repository: the live comparison works without access to the private project |
| `probes/` | The archived scripted measurements behind the page plan, one file per step, and their index; outside the sensors' paths on purpose, since a suite cannot see layout or paint |
| `bin/size.js` | The `size` command: what the package installs; it counts nothing itself |
| `bin/postinstall.js` | Installing the hook after the package is added: it looks for the consumer project and stays silent when there is nowhere to install |
| `src/size-table.js` | The package's entry point: a re-export of the public API and no calculation of its own |
| `src/cli.js` | The tool's entry: parsing the command line, reading the project, handing the request to a mode |
| `src/args.js` | The grammar of the command line: modes, flags and commands plus the checks of their combinations |
| `src/modes.js` | The modes: assemble the report, compare it with the history, hand over the data, the coverage and the diagnostics |
| `src/config.js` | The consumer project's settings: the defaults, reading them, checking them |
| `src/project.js` | The settings derived from the project itself; without a settings file it *is* the settings, and `--init` pins it |
| `src/init.js` | Pinning the settings as a file (`--init`), through the same check as the first run |
| `src/git.js` | The only border where git is called: the pinned settings, blobs by the batch, the history, the comparison with the working tree |
| `src/history.js` | Walking the history: measuring commit by commit, shifting the numbers, assembling, a reason for every dropped commit |
| `src/metrics.js` | The register of metrics: what is measured, whether the text is needed and how honest the number is |
| `src/minify.js` | The real minifier: an optional dependency, loaded once, and it does not bring the run down when absent |
| `src/tokens.js` | Tokens: a dictionary by family and encoding, an estimate by length as the fallback count, the formats without text |
| `src/optional.js` | The shared handling of the optional dependencies: lazy loading and the seam of absence |
| `src/strip.js` | Removing ballast: which form goes to which file, and which strategies are minification itself |
| `src/strip/` | The forms of text with a removal of their own: comments and indentation in JS (`js.js`), the other formats (`forms.js`), and the guard that what was stripped has to compile (`guard.js`) |
| `src/parse.js` | Parsing a module: one worker thread per run, a fallback to `node --check`, and the way the last module was parsed |
| `src/parse-worker.js` | The parsing itself inside the thread: it parses the text without executing it and reports that Node has no vm modules |
| `src/derived.js` | The report's shared calculation: totals, deltas, a cell, a commit's caption — one for the engine and the page's program |
| `src/data.js` | The file categories (a test by its path, otherwise the extension) and the contract with the page (`--data`): the numbers, the shape of the table and the catalogue of paths |
| `src/check.js` | Coverage (`size check`): what went past the columns and how that is fixed |
| `src/explain.js` | Explaining a missing row (`size explain <commit>`): the reason, the evidence and a ready fix |
| `src/doctor.js` | Diagnostics in one answer (`size doctor`), assembled from the pieces that already exist |
| `src/hook.js` | The hooks of self-updating: they install themselves, commit the report alone, and keep a lock and a record of the run |
| `src/artifact.js` | The report on disk: the only place where it becomes a file, for `--write` and the hook alike |
| `src/journal.js` | The journal and links: which section a commit belongs to and where a description leads |
| `src/css.js` | Reading the styling from disk: which sets of styles exist and what role each has |
| `src/table.css` | The report's table: the geometry of the window, the sticky header and commit column, one line of one colour for every border, the colour of deltas |
| `src/locales.js`, `src/refusal.js`, `src/tool.js` | The report's texts; the exit codes, the help and the refusal registry; the package's name and version |
| `src/page/app.css` | The page's styling on top of the shared part: the panel with the file tree, its row of categories, the empty states, a narrow window |
| `src/page/app.js` | Assembling and starting the page: the first drawing, then a switch that builds the window again; pasted into the assembled page |
| `src/page/build.js` | Assembling the page: data, styling and program in one file, the pasted text squeezed on the way in and guarded by `assertCompilable` |
| `src/page/dom.js` | The page's nodes: the small helpers of markup, one set for the panel and the table alike |
| `src/page/panel.js` | The panel of choices: the switches of metrics and files, the categories and the tree of the project's paths; built once, with the fields written where they stand |
| `src/page/payload.js` | The page's block in sparse form, and the one place that unrolls it back into the contract |
| `src/page/state.js` | The page's state: the data, the view of the checkboxes, the unfolded folders, the record's passport, the memory and the link read out of the address |
| `src/page/table.js` | The page's table as a window: the visible rows and columns, a cell, the header, the empty states and the order of the columns |
| `tools/gates/` | The sensors and the profiles: `run.js` (the single list of steps), `metrics.js`, `dup.js`, `deps.js`, `coverage.js`, `gatefiles.js` (the trailer guard), `common.js` (what they share) |
| `tools/synthetic/` | The subjects of the fixture's assembly, one per matter: `repo.js` (how git is spoken to), `content.js`, `history.js`, `note.js` |
| `tools/harness.js`, `tools/page-harness.js` | The harnesses: paths, clones of the fixture, running the tool, reading refusals; and the readers of the contract and page checks, one set for those suites |
| `tools/run-tests.js`, `tools/suites.js` | Running the suite with each file's own duration and the counts adding up, and the split of the suite with a reason per file |
| `tools/gate-probe.js` | The harness of the sensors' probes: a sensor is called as a command rather than imported |
| `tools/docs-facts.js`, `tools/refusals.js`, `tools/yaml.js` | The facts read out of the documentation; the catalogue of refusals with what each must convey and advise; the YAML subset the descriptions are parsed with |
| `tools/parity-freeze.js`, `tools/make-fixture.js` | Taking the two references: the parity one and the fixture with its numbers |
| `tools/parity-live.js`, `tools/pack-check.js`, `tools/check-standards.js` | The comparison with the live project, the work from the assembled tarball, and the reproduction of both references |
| `test/api.test.js` | The package's public API: the list of names is frozen, and splitting the engine may not change it |
| `test/parity.test.js`, `test/frozen.test.js` | Parity with the reference — the numbers, self-containedness, the locale — and the provenance of the frozen copy |
| `test/environment.test.js`, `test/crlf.test.js` | Hermeticity: the output does not depend on the machine's git settings, its locale or CRLF |
| `test/disk.test.js` | The comparison with the working tree: an edit only on disk, three ways of losing a change, a file deleted before HEAD |
| `test/cli.test.js`, `test/cli-paths.test.js` | The command line: the help, the settings, the exit codes, and where the tool writes |
| `test/refusals.test.js`, `test/refusals-catalog.test.js` | Every refusal is called, its code, phrases and advice compared; and every refusal site in the sources has a catalogue entry |
| `test/contract-data.test.js`, `test/contract-derived.test.js` | The data contract against the reference and the round trip through the sparse block; the derived quantities against the artifact's numbers |
| `test/page-grid.test.js`, `test/page-cols.test.js` | The table's window, its geometry and the order of the columns by the newest row a file's numbers moved in |
| `test/page-view.test.js`, `test/page-choice.test.js` | The assembled page: the recount by the choice, the empty states, the focus; the memory, a revisit, a foreign record, the link |
| `test/page-tree.test.js` | The panel's file tree: folders by the project's paths, three states, files outside the report, the hidden names, folding without a rebuild |
| `test/module.test.js`, `test/guard.test.js` | A module under a `.js` extension measured without touching the settings; the guard alive and the parse through a thread |
| `test/runner.test.js` | Reading a process's output: chunks are glued as buffers, so a multi-byte character at a border does not break |
| `test/git-pins.test.js` | The guard of the git border: no direct calls to git outside the shared list of pins, and a pin shown to work by a witness |
| `test/docs-paths.test.js`, `test/docs-commands.test.js` | The documentation guard, one file per promise: the paths and the file table; the calls, the refusal causes and the section addresses |
| `test/release.test.js`, `test/suites.test.js`, `test/gates-verify.test.js` | The guards of the release from CI, of the suite's split (complete classification, a reason per file) and of the single list of steps |
| `test/gates-metrics.test.js`, `test/gates-dup.test.js`, `test/gates-deps.test.js`, `test/gates-coverage.test.js`, `test/gates-files.test.js` | The sensors' probes: an artificial violation makes a sensor red, taking it away makes it green again |
| `test/check.test.js`, `test/doctor.test.js` | Coverage and explanation on the fixture's real commits; diagnostics over five states of a project |
| `test/hook.test.js` | The hooks on a fresh clone: a commit of the report's own, silence on a repeated run, the index and someone else's work untouched |
| `test/templates.test.js` | The templates: the draft of settings passes the tool's check and assembles a real report; the description parses and calls only what exists |
| `test/minify.test.js`, `test/tokens.test.js` | Real minification and tokens: the numbers against stripping, the encoding as part of the number, work with no optional dependency |

**Both references are taken anew by the same tools:** `pnpm run parity` and `pnpm run fixture` give
the same files. What is ours is compared byte for byte, while the history bundle is compared by content
(the branches, the tip, the number of commits), because git does the packing and its bytes depend on
git's version. Both sides of the pair are pinned: the tool is a frozen copy of the implementation,
whose bytes live in the history, while the project's revision comes from the manifest and the
environment of the capture is set. Repetition and hermeticity are not taken on trust either:
`test/git-pins.test.js` shows an unpinned read by a witness, `test/environment.test.js` keeps the
output independent of the machine, and the slow profile repeats the whole suite with none of the
machine's git settings at all.

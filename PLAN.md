# PLAN.md — moving volume accounting into the package `size-report`

Date: 2026-09-14. Role of the document: the working plan for moving, refining and packaging the
volume tool (then `tools/size-table.js` inside the Select Safe Resets plugin) into a package of
its own. The move is done and the package is released, so what this document still carries is the
architecture (§4), the invariants (§3) and the boundaries (§2), while §5 is the record of how the
steps went.

Sources (`docs/` of this repository):

- `docs/requirements.md` — what the product is for.
- `docs/module-design.md` — how the module is designed.
- The consumer project, `../figma/safe-resets`, where the tool used to live; since the move it
  holds a dependency, a settings file and two commands.

The document has three parts: **the move** (§5), **the refinement** (§4, §5 steps 2–6) and
**the packaging** (§8). §1–§3 are what keeps the plan from being a fantasy: the inventory of
facts, the boundaries and the invariants.

---

## 1. Inventory: what there was before the move

Measured 2026-09-14 on the consumer project, at the revision before the package replaced the tool
there (`58cd786^`). The move is done, so the section is a record of what the boundaries were drawn
from rather than a description of today.

### 1.1. Files

| File in `safe-resets` | Volume | Role |
|---|---|---|
| `tools/size-table.js` | 1145 lines | The whole engine: git history, metrics, strippers, the journal, the static HTML, the CLI modes |
| `tests/size-table.js` | 472 lines | The engine's checks: settings, strippers, the registry of metrics, rendering on a synthetic history, anchors, numbers against `--json` and `git cat-file`, batched reads, layout, "a check must be able to fail" |
| `size-table.config.json` | 27 columns | The project's own: columns with path aliases, `raw`/`min`, locale `ru`, the journal `WORKLOG.md`, the report `docs/size-table.html` |
| `docs/size-table.html` | 161 lines | The report artifact: **committed**, refreshed by a commit of its own |

### 1.2. The CLI surface then

Modes and flags only: no `--help` and no word commands, which is the gap R-0.3 closed. Today's
surface is §4.7's.

```text
node tools/size-table.js                  the check: the artifact against git history
node tools/size-table.js --write          rebuild the report
node tools/size-table.js --json           rows as JSON on stdout
node tools/size-table.js --init [file]    draft settings for a new project
node tools/size-table.js --config <path>  another settings file (for a foreign project)
node tools/size-table.js --force          overwrite the settings when --init meets them
```

### 1.3. Settings of that day

The eleven keys of the consumer's file: `output`, `locale`, `title`, `heading`, `fixCommand`,
`metrics`, `columns`, `journal`, `links`, `rows`, `skip` — measured on the same revision as the
table above. `minify` and `tokens` did not exist then: the plan's own steps 3 and 4 added them,
and §4.6 holds the schema as it stands.

### 1.4. Integration points in the consumer

The third column was a promise and is now a measurement (2026-09-16):

| Place | Then | Now |
|---|---|---|
| `package.json` → `scripts.sizes`, `test:sizes` | `node tools/size-table.js [--write]` | `size --write` and `size`: two commands of the package |
| `tests/harness.js` → `STEPS` | two steps of wave 1 (the engine's check and its captured run) | one step calling the package's entry point |
| `tests/doc-sync.js` | read `runCounts('tests/size-table.js')` | no counters of size left in the project |
| `docs/TESTING.md` | sections about the engine's mechanics and the legend | one section about the package |
| `AGENTS.md` | the document map, the commands `sizes`/`test:sizes`, "the table is not edited by hand" | "the tool came as a package, the report is derived" |
| `README.md` | a link to `docs/size-table.html` | unchanged: the report stayed where it was |
| `docs/ROADMAP.md` §33–§35 | the history of three releases of the table | history, untouched |
| `.github/workflows/ci.yml` | `fetch-depth: 0` for the whole history | kept, and the step calls the package |
| `.gitignore` | nothing about the report | unchanged: the consumer commits the report, and whether it is committed is the project's own business (`--init` does not edit `.gitignore`, R-4.8) |
| `tools/size-table.js`, `tests/size-table.js`, `size-table.config.json` | in the repository | the two tools **deleted**, the settings kept under their own name |

### 1.5. What was already in place

The engine already knew nothing about the project — file names, the journal, the locale and the
report's path all lived in the settings, and `--init` drafted them in a foreign project. The
invariant "a commit's row cannot sit inside the commit itself" was worked out too: with
`rows.sha: false` a row does not name its commit (`showSha` in `src/data.js`), so the artifact is
a fixed point of the assembly. Both are why the move was a move rather than a rewrite.

### 1.6. The weak spots the plan closes

Each was a gap rather than a defect, and each is closed today — the step of §5 and the row of
`REFACTOR.md` are named:

1. **`min` was not minification** — comments and indentation off (`stripJs` + `stripLines`), no
   renaming, while requirement §7.3 `module-design.md` asks for a real minifier and a marked
   approximation for the rest. Closed by §5 step 3 (R-5.5).
2. **No tokens** — the third measure, "the weight for an AI agent", with a named family and an
   honest mark of exactness (requirement §3.1 `requirements.md`). Closed by §5 step 4 (R-5.6).
3. **The report was static** — sums and deltas counted at assembly time, no way to switch a file
   or a category off (requirement §8.2 `module-design.md`: a tree of files, checkboxes, switches
   of metrics, the total recounted on the fly). Closed by §5 step 2 (R-2.6).
4. **The only control was "artifact ↔ history"** — and it holds while the report is in git, which
   requirement §6.1 `requirements.md` takes away; another control of completeness was needed
   (§4.5). Closed by the coverage check (R-4.12).
5. **Nothing noticed a commit that touched an untracked file** — requirement §4.2
   `requirements.md` wants a violation rather than silence. Closed by `size check` (R-4.12).
6. **No refresh on a commit** and no protection from a loop (`requirements.md` §7.1 and §7.2).
   Closed by the hook (`PLAN.md` §4.9).
7. **`gzip` sat in the registry of metrics** — the compressed size is out of the first version
   (requirement §12 `requirements.md`). Closed by **D4**: the metric stays in the package, the
   default set does not carry it.
8. **The price of a run** — the table's checks were the whole suite's time (five full passes over
   the history), and after the move that was our pain rather than someone else's. Closed by the
   split of the suite (R-5.7); the targets by time were abolished afterwards (R-5.8).

---

## 2. Boundaries: what leaves, what stays in the project

| Leaves for the package `size-report` | Stays in `safe-resets` |
|---|---|
| Reading git history, the metrics (`raw`/`min`/`tok`), minifiers, tokenizers, the memory of a run | The plugin's sources and documents — they are the **input** of the measurement |
| The assembly of data (`measure`) and the interactive report page (`render`) | The settings file, still `size-table.config.json` (`CONFIG_NAME` in `src/config.js`) |
| The tests and fixtures of the tool | The dependency line in `package.json` and two commands in `scripts` |
| The settings schema and the templates (settings, CI, a note; a block for `AGENTS.md` was deliberately not made, R-4.11) | The report's path and whether the report is committed (`--init` does not edit `.gitignore`) |

**The principle:** "the mechanics are never copied into a project". A project knows three things
about the tool: the dependency, the settings file, the command.

---

## 3. The invariants that move unchanged

This is the package's contract rather than an implementation detail — every item was paid for by a
problem in the consumer project.

1. **The source of truth is git**, not the working tree: sizes come from the blobs of commits, so
   the report does not depend on what is open in the editor.
2. **Rebuild over the whole history rather than append to it.** Idempotence and self-repair are
   worth more than the saving.
3. **Read file versions in batches.** `git cat-file --batch-check` answers about 1000 specs per
   call and `--batch` is asked only for the blobs whose content is needed, with dedup by spec and
   by sha; `raw` needs the object's size alone and never asks for content. Held by
   `test/git-pins.test.js`: no direct git call anywhere may go around the shared list of pins.
4. **Measure each content once.** The key is the blob's sha plus the metric and the memory lives
   for the run, so identical versions of a file (a revert, a repeated merge, a file that did not
   change) are not measured twice. A content cache with a version of the algorithm is §4.4's plan
   rather than a fact.
5. **A commit's row cannot describe the commit itself.** Commits that touched only the report
   artifact (and everything in `skip`) get no row, and with `rows.sha: false` a row does not name
   its commit (`showSha` in `src/data.js`), so the artifact is a fixed point of the assembly.
6. **Coverage of the history.** A shallow clone is a refusal with a ready fix (`git fetch
   --unshallow` locally, `fetch-depth: 0` in CI) rather than a silently short table.
7. **`%ad` in the author's zone** (not the machine's and not UTC): otherwise CI and a local build
   disagree.
8. **Merges are ordinary commits** (`--diff-merges=first-parent`): an edit made while resolving a
   conflict must reach both the row and the carried state.
9. **Deterministic formatting of numbers** (thin spaces made by hand rather than by
   `toLocaleString`) and no floating fields in the data: the same history counted again gives the
   same file byte for byte.
10. **The stripper's guard:** a simplified JavaScript file must still compile — `vm.Script` for a
    script and `vm.SourceTextModule` in a worker that lives for the run (`REFACTOR.md` R-5.4).
    Simplification has no right to drop anything but comments and indentation in silence.
11. **The comparison against the working tree** (`assertMatchesDisk`) is two-way, and both sides
    compare content rather than sizes. The state at HEAD must match the commit's tree in content
    and in composition — that catches an edit lost while state was carried between commits — and
    the file on disk must match the same content up to the line endings git does not always
    return; files edited in the tree drop out (`BLOCKERS.md` §B2).
12. **A row's link leads to a section of the journal**, and the anchor repeats GitHub's address
    line (`anchor()`) rather than roughly resembling it.
13. **The git settings are pinned at the boundary of the call.** The output does not depend on the
    machine: `core.quotePath`, colouring, the signature block, the encoding of signatures and the
    locale are set explicitly in one argument builder rather than in every call — otherwise the
    numbers are right on one machine and short on another (`BLOCKERS.md` §B1).
14. **Data against derived values.** The engine hands over absolute values and the shape of the
    table (`reportData`), while deltas, totals, "now" and filters are counted by the page, which
    alone knows what is switched on. Not one derived quantity may appear in the contract, and that
    is held by a check of the set of fields (`test/contract-data.test.js`) rather than by
    agreement.

---

## 4. The architecture of the package

Where a decision of the plan was carried out differently, the decision says so and points at the code
or at the record: the section describes what is built rather than what was intended.

### 4.1. The decisions this plan made

| Question | The decision as it stands | Why |
|---|---|---|
| Module system | **ESM** (`"type": "module"`), `engines.node >= 20.19` | A new package, where `require` is not justified; `import()` stays for the heavy sensors |
| The core and the disk | The engine writes nothing to disk and the report becomes a file in one module (`src/artifact.js`); the commits already read can be passed in (`known` in `measureHistory`, used by `check` and `explain`), while blobs always come from git | Tests over a history for milliseconds, and the write is separable from the count. The plan's "a non-git source can be substituted" was not needed: the checks drive the tool over a clone of the frozen bundle |
| Heavy sensors | `esbuild` and `gpt-tokenizer` are **`optionalDependencies`**, loaded lazily but **synchronously** through `createRequire` (`src/optional.js`) | A measurement is a synchronous pass, so a dynamic `import()` cannot be awaited; absence comes back as an answer rather than an exception, and `raw` is always available |
| The report's program | Ordinary modules pasted into the page when the report is written (`src/page/build.js`, the module syntax stripped line by line — R-2.1) | The program became code a linter sees while the page stayed self-contained. The plan's pre-built `dist/app.js` was not made: there is no `dist/` in the package |
| Test dependencies | `jsdom` is a devDependency and the package itself has no mandatory dependency | The report is checked in the very thing that opens it; without a DOM check the contract's usability is unproven |
| Settings | The file is `size-table.config.json` (`CONFIG_NAME` in `src/config.js`); there is no `$schema` and no migration command — `--init` derives the settings from the project (`src/project.js`) | The old tool's keys are a subset of today's, so the consumer's file needed no conversion; a settings schema, a migration and a block for agents were all left unbuilt (`BLOCKERS.md` §N17) |
| Artifacts | One file at `cfg.output` (`docs/size-report.html` in the derived profile); the contract is printed on demand by `--data`; the package keeps no state on disk | The report is an output and is rebuilt; a cache or a data file beside it would be state to keep in order |
| Metrics | `raw`, `min` and `tok` in the default set; `gzip` is in the registry and ships, while the first release's set does not carry it (**D4**) | The compressed size is out of the first version (requirement §12 `requirements.md`), and the registry leaves the door open |
| Paying by fact | The report neither blocks nor notifies — it only shows | Requirement §8 `requirements.md` |
| Exit codes | `0` success · `1` a violation (incompleteness or a disagreement) · `2` bad settings · `3` an incomplete history · `4` a sensor missing (degradation) · `5` an internal error (`EXIT` in `src/refusal.js`) | An agent branches by the code rather than by the text (requirements §2.2 and §6.3 `requirements.md`, with §11.3 naming the code for a truncated history); the codes are described in `README.md` |
| The version of the data | `schema: 1` in the data (`src/data.js`); the settings carry no version key | The shape of the data is what other tools read, so that is the thing to version |

### 4.2. The repository

```text
size-report/
├── bin/size.js               # a thin wrapper: import('../src/cli.js') and run
├── bin/postinstall.js        # puts the hook up after an install
├── src/                      # the engine: one module per subject
│   ├── cli.js, args.js, modes.js, refusal.js, locales.js     # the surface and its texts
│   ├── config.js, project.js, init.js, doctor.js             # the settings: derivation, reading, diagnostics
│   ├── git.js, history.js, journal.js                        # git: the boundary, the pass, the journal
│   ├── metrics.js, minify.js, tokens.js, optional.js         # the measurements
│   ├── strip.js, strip/, parse.js, parse-worker.js           # taking the ballast off, and the guard
│   ├── data.js, derived.js, artifact.js, css.js, table.css   # the report: data, calculation, styling
│   ├── page/                                                 # the page: one chapter per subject
│   └── check.js, explain.js, hook.js, tool.js, size-table.js # coverage, the skip, the hook, the entry
├── templates/                # settings, CI and a note for a project being wired up (three files)
├── fixtures/                 # live (the consumer's frozen history), parity (its standard), synthetic
├── tools/                    # the repository's own instruments, `tools/gates/` being the sensors
└── test/                     # the suites, one file per subject; the runner's list is tools/suites.js
```

The fixtures sit beside `test/` rather than inside it. The rule comes from the day a frozen copy of
the old implementation lived in the tree as a `.cjs` of the engine: a stock Node runner takes every
`.js` under a `test/` directory as a suite (`**/test/**/*.js`), and such a copy would have run as
checks. The copy has left the tree, and the convention stays — the package's own run goes by a
declared list (`tools/suites.js`), so nothing depends on it but the reading of the tree.

The fixtures and the standards are not published: `files` names `bin`, `src`, `templates`,
`README.md`, `CHANGELOG.md` and `LICENSE`. They are needed by whoever works with the sources rather
than by a project that installed the package as a dependency.

### 4.3. The canonical data

The contract between the engine and the page (`src/data.js`; printed by `--data` and embedded in the
report): `schema`, `tool {name, version}`, `report {locale, title, heading, artifact, fixCommand,
journal, showSha}`, `metrics[]`, `categories[]`, `files[]`, `catalog[]`, `rows[]`, `now[]`, `last[]`,
`approx{}`, `skipped[]` — one truth laid out in fields.

Where the plan's form (`module-design.md` §6: `schema`, `files`, `commits`, `metrics`, `series` with
points of change) went its own way: `commits` became `rows` — one per commit that got a row, with a
cell per column — and `series` did not appear at all: a file's numbers are read down a column of
`rows`, while `now` and `last` carry the present and the columns the last commit touched. The
decisions that hold the form:

- **Three states of a file rather than two.** A cell is `null` when the file is not there, `0` when
  it is there and empty, and a number otherwise; the page draws the first as `—` and the total stops
  counting the file. The plan's `gone: true` point was not needed — the absence is that same `null`
  in the carried state (`src/history.js`).
- **Absolute values only.** Deltas and totals are counted by the page, because they depend on what a
  person switched on (requirement §4.3 `requirements.md`); that no derived quantity enters the
  contract is held by a check of the set of fields (`test/contract-data.test.js`) rather than by
  agreement.
- **`method` and `accuracy` are the promised honesty mark** (requirement §3.3 `requirements.md`):
  beside a number one sees what produced it and whether it is exact or approximate. It is kept per
  metric rather than per file, and a mark per cell comes beside it (`approx`: one string per metric
  over the rows and one over "now"), so a caption speaks about the worst in the column and a cell
  about itself (R-2.7); the plan's `fallback: true` per point became that mark.
- **`catalog` is the tree with reasons** — every path of the project appears, and the ones that are
  not measured say why (`why` empty means the path is measured). That is the material for
  completeness (`PLAN.md` §4.5) and for transparency (requirement §11.2 `requirements.md`).
- **Escaping into markup.** The JSON that goes into the page passes `<` → `\u003c`
  (`src/page/build.js`), which is also what keeps a `</script` inside a path or a commit subject
  from ending the data block. The page's self-sufficiency — one file, no external reference — is
  held by `test/page-view.test.js`; the plan's "a separate test for the escape" did not appear as a
  check of its own.

### 4.4. The sensors: the registry, the version, the cache

A sensor declares `label`, `needsText` (`raw` lives on the object's size alone), `method` — a text
per locale naming the tool and the version the number was taken with — and `accuracy`; `pointExact`
answers the same question about one file's cell rather than about the whole column (R-2.7). The
registry holds four: `raw`, `min`, `tok`, `gzip`.

**What the plan promised and the code does not do:** there is no `version` field and no cache keyed
`blob sha + id + version`. The run's memory is keyed by the blob's sha and the metric and lives for
the run (§3 item 4); a cache that outlives the run is this section's plan rather than a fact —
`REFACTOR.md` §7 names it as a capability the refactoring did not take.

- **Degradation is not an error.** With no minifier (or one that did not install on the platform)
  the `min` metric becomes an approximation with a named mark rather than passing stripping off as
  real minification (requirement §7.3 `requirements.md`); with no dictionary the `tok` metric counts
  an estimate by length with a named coefficient. Neither passes an approximation off as a success:
  both answer **code 4** instead (R-5.5, R-5.6).
- **The "file too large" threshold** is a constant of the derived profile — 512 KiB (`MAX_BYTES` in
  `src/project.js`), where it also keeps a huge file out of the columns — rather than a settings key,
  so what the plan called an open question about its default (§10) was settled by that constant.

### 4.5. Classification and completeness

- **Discovery** is from git (`ls-files` at HEAD and, where completeness asks, the union over the
  history), never by hand.
- **Categories** — `code`, `docs`, `chore`, `assets` — come from a table of extensions
  (`CATEGORY_EXTS`), one category per file; a column's own `category` outranks the table, and the
  data says which of the two spoke (`categoryBy`). The plan's name `service` became `chore`.
- **Exclusions.** The derived profile puts the report itself, dependency locks, maps and built
  output, an unknown format and a file over the threshold into `skip`, naming them there
  (`src/project.js`); a binary file is recognised by its contents (`isBinary` in `src/tokens.js`).
  Every exclusion has a reason, and the reason travels in `catalog`.
- **Completeness (requirement §4.2 `requirements.md`).** `size check` takes the union of every path
  the history touched and requires each of them to be a column or a declared exception. An unknown
  path is a violation: code `1`, with the path, the commit that brought it and a ready fix read from
  the settings. That is what replaces the control "artifact against history", which needs the report
  to be in git.

### 4.6. The settings

The keys, measured on `src/config.js`: `output`, `locale`, `title`, `heading`, `fixCommand`,
`metrics`, `columns`, `minify {engine, ext, guard}`, `tokens`, `hooks {enabled}`, `journal`, `links`,
`rows`, `skip`.

Where there is no settings file, the tool derives one from the project and writes it (`--init`,
`src/project.js`): columns by extensions and size, their categories, `skip`, the journal, the commit
link from the origin address. That is the profile a fresh project starts from.

**What the plan promised and the code does not do:** there are no `files`/`categories`/`report`
sections and no `--migrate`. The old tool's keys are a subset of these — so much so that the
consumer's file kept its name (`size-table.config.json` is `CONFIG_NAME`) and needed no conversion —
and what the plan called migration became the derivation above: guessed settings are written for a
person to keep or edit rather than converted silently (`BLOCKERS.md` §N17).

### 4.7. The CLI

```text
size                                  the check: the artifact against the history
size --write [file]                   rebuild the report (the directory is created if missing)
size --data                           the contract on stdout, for an agent and for CI
size --json                           the former rows-as-JSON shape (frozen by the parity standard)
size --init [file]                    derive the settings from the project and write them
size check [--json]                   settings, the history, the paths, the sensors (code 1 on an uncovered path)
size explain <commit>                 why a commit has no row
size doctor [--json]                  one answer: the environment, dependencies, settings, coverage
size install-hook / uninstall-hook    put the hook up, or take it away together with its state
size hook-run                         what the hook calls: rebuild the report and commit it
```

**What the plan promised and the code does not do:** there are no `measure`, `render`, `update` or
`version` words — `--write` is measure and render at once, and the version travels in the data's
`tool`. `check`, `explain` and `doctor` landed 2026-09-14 (R-4.12; the
version in `worklog/archive/WORKLOG.md` §35), `install-hook` and `hook-run` later (`PLAN.md`
§4.9).

Two decisions of that pass stand. **A command is a word** rather than a flag, read from any argument
that is neither a key nor a value of one (`size check --config x` and `size --config x check` are the
same), an unknown word being code 2 with a pointer to `--help`. And **the declared exclusions of
completeness are the same `skip`** as the paths that cannot be columns: no second key, because the
tool draws no difference between "not counted" and "excluded".

Inside the engine the reason a commit was skipped became a key (`merge` / `report` / `flat`), while
the line of the `--json` and `--data` contracts stayed as it was (that standard is frozen); the
difference between "the numbers did not move" and "outside the columns" is drawn by `explain`
alone, because that is the question there.

The properties the requirements ask for hold: `--json` on every diagnostic command, a refusal that
names a ready fix, stable codes described in `README.md` (requirement §2.2 `requirements.md`). **One
command writes to the git history — `hook-run`**, deliberately and as a commit of its own (§4.9).

### 4.8. The interactive report

One file (`report.html`; `docs/size-report.html` in the derived profile): the styling and the
program inside, the data in a `<script type="application/json" id="data">` block and the texts of
the interface in a second one (`id="ui"`), no external reference — it opens from `file://` with a
double click and works offline (requirements §6.2, §11.6 `requirements.md`).

What the page can do (requirement §8.2 `module-design.md`):

1. **Switches of metrics** — `raw` / `min` / `tok`, each independently; the columns are rebuilt and
   the total recounted.
2. **The left panel is the tree of files** as the directories really are, every node carrying a
   three-state checkbox; an unchecked file leaves the table and the total at once.
3. **A row of categories** — `code`, `docs`, `chore`, `assets` under the labels of the locale —
   switches a whole group of checkboxes.
4. **The choice of the model family for tokens** ❌ **cancelled 2026-09-14** (step 4, cut 2): the page
   takes finished numbers and counts nothing of its own, and it has no dictionary of another family.
   Precomputing every family would pay the assembly time for numbers nobody may ask about, so the
   family lives in the run's settings and the page names the method of every metric as text.
5. **The honesty mark** at a metric and at a suspicious cell: the method, its version,
   "approximate", "the file is too large" (requirement §3.3 `requirements.md`).
6. **The view's state is remembered** (`module-design.md` §8.4): the main path is `localStorage`
   under a key chosen by the report's passport — the tool's name, the data schema, the artifact's
   path, the title and the column labels in order — so a choice made in someone else's report is not
   picked up. The package version and the top of the history are left out on purpose: an update does
   not change what a column means, and a grown history is the very history the reader comes back to.
   Only what is switched off is kept, by name. `location.hash` comes beside it, so a choice can be
   sent to a colleague by a link and works where `localStorage` is not there (`file://` in a private
   window: a `try/catch`, and a link is applied on `hashchange` — R-2.6).

The rule of the recount (requirement §3 `module-design.md`): the engine hands absolute values, and
the page counts deltas to the previous **switched-on** row and the total over the switched-on set.
An empty cell means "did not change", `—` "the file is not there", `0` "the file is there and
empty" — three different answers, explained by the page's legend.

Row order and grouping, the "now" glow, the sticky left column, `tabular-nums` and the
`Canvas`/`CanvasText` pair moved over from the former layout as they were: those decisions are
already paid for (a dark scheme, scrolling to the right, aligned numbers).

### 4.9. The hook and the self-refresh

- The hook **installs itself**: after a package install (`bin/postinstall.js`) and on the first run
  in a project (`autoInstall` in `src/hook.js`); `size install-hook` does it by hand and
  `size uninstall-hook` takes it away together with its state, returning the project to what it was.
- The installed file calls one line — the package's entry point with `hook-run` — and is written for
  `post-commit` and for a merge as well: git runs no `post-commit` when it makes the merge commit
  itself and calls `post-merge` instead (measured on git 2.50.1; the finding stands in
  `BLOCKERS.md`).
- **`hook-run` rebuilds the report and, if git tracks it, commits it as a commit of its own** whose
  subject names the report and the commit it was rebuilt after; where the report is not tracked, it
  is only rebuilt (`storeReport` in `src/hook.js`). The commit is assembled with plumbing
  (`hash-object`, `write-tree`, `commit-tree`, `update-ref`) in an index of its own
  (`GIT_INDEX_FILE`), so the real index and the working tree stay untouched.
- **A loop cannot start**, for two reasons rather than the plan's three (requirement §7.2
  `requirements.md`): `commit-tree` calls no hooks at all, and the measurement ignores a commit that
  touched nothing but the report, so the artifact is a fixed point — its own commit cannot change
  its bytes. A lock with a pid in the hook's state directory keeps a second run out (`runLocked`).
- The automation is switchable: `hooks.enabled: false` in the settings, and what the hook did is
  visible in `size doctor`.
- **What the plan promised and the code does not do:** the plan had the hook doing "only
  `size update` locally" and never committing — the code does commit the report, which is how it
  stays refreshed where the report is in git; and the plan's environment flag
  `SIZE_REPORT_IN_HOOK` was not made, because the construction above makes nesting impossible rather
  than unlikely.

### 4.10. GitHub as a thin shell

The engine knows nothing about the platform. The v1 superstructure is `templates/ci.yml` (put it at
`.github/workflows/size-report.yml` and it needs no edits): a checkout with `fetch-depth: 0`, an
install, then `size` — the artifact against the history — and two `size --data` snapshots compared
by `diff`, one ordinary and one with `GIT_CONFIG_GLOBAL=/dev/null`, because a number must not depend
on the machine's git settings (`BLOCKERS.md` §B1). Where the report is deliberately not in git, the
template's header tells the reader to put `size --write` in place of the check: the artifact then
proves it can be built. The template needs no secrets. A comment in a pull request with a summary of
the changes is **not in v1** (requirements §8, §12 `requirements.md`).

---

## 5. The move, step by step — a record rather than a plan

Every step was a release of the package that broke nothing and an edit in the consumer; step 0 carried no
code. The move is done, so what stands below is what each step still holds up: its promise, what it left in
the tree and what it did not finish. The steps keep their numbers and their word — `REFACTOR.md` and
`BLOCKERS.md` cite them as “`PLAN.md` §5, step N”. One thing the plan got wrong about the future: its
per-step version labels (`v0.1.0` … `v0.5.0`) never existed — the first release was `1.0.0` on 2026-09-14
and the package is at **2.4.0** today, with every release's numbers in `CHANGELOG.md`.

### Step 0. Freezing parity (preparation) — ✅ done 2026-09-14

**The promise:** freeze today's output as a standard, or “the move broke nothing” has nothing to prove it.

**What it left:** the standard taken from `safe-resets` — **149 commits, 95 rows × 27 columns, artifact
225 673 B** — by `tools/parity-freeze.js`, and the synthetic fixture built by `tools/make-fixture.js` —
**16 commits, 14 rows × 10 columns, two commits that get no row** — in `fixtures/parity/` and
`fixtures/synthetic/`, each with a manifest that holds the head, the commits, the sha256 of every file and
the stability flags. The freeze is a measurement rather than a snapshot of bytes: the dates, the author
and the contents are fixed, so the commits' shas — the fixture's identity — are reproducible, while
`history.bundle` may differ between versions of git. The fixture deliberately carries the traps a table
can meet: a rename, a merge with a conflict edit, a commit that touched only the report, a non-English file
name, CRLF in a text file, an `.mjs` with `export`, a file deleted and brought back, `<`/`&`/`"` in a
subject, an unknown extension, a file emptied to zero bytes.

**How it is held today:** the fixture is reproduced from its `git bundle` in a clean temporary directory
and its golden numbers are compared with the generator (`test/parity.test.js`), the records in
`fixtures/*/manifest.json` are compared with the files (`test/frozen.test.js`), and `pnpm run check:standards`
takes both standards anew and compares them byte for byte — measured 2026-09-16: 4 of 4 files of the fixture,
3 of 3 of the live one, its bundle at `bd6ef9d`, 149 commits.

### Step 1. The engine moved as it was — “parity” — ✅ done 2026-09-14

**The promise:** move the core **with no new metrics and no change of the report's form** — the git history,
`raw`, the `min` of that day (a simplification), the journal, the anchors, the static HTML, `--init`, `--json`,
the control mode — with `gzip` left out. The code moves to ESM, and the split into files (§4.2) goes as an
item of its own (D1 below) so that the port is proved before the rearrangement rather than after it.

**What the port gave.** `src/size-table.js` is the entry point and holds re-exports alone — no computation at
all; the mechanics lie in **15 modules** along the seams of the data (`REFACTOR.md` §R-1.3), and `bin/size.js`
is the command outside them. The public surface is a **frozen list of 55 names** held by `test/api.test.js`:
the split may neither lose a name nor add one — a lost name breaks whoever leant on it, an added one means a
module's insides leaked. The **frozen copy of the engine** — the very revision the standard was taken with —
is **not in the tree**: its bytes live in history and are fetched from there on demand
(`fixtures/legacy/size-table.cjs`), and what is fetched is compared with the record of the standard's origin,
so a copy that quietly stopped being frozen would be caught. The live project is compared on a clone and
nothing is written in the project itself.

**What proves the parity (automatic, not by eye):**

| Where | What is compared | Result |
|---|---|---|
| `pnpm test` — the fixture in four deliberately foreign environments | `--json` byte for byte, the sha256 of the artifact, the control mode — for the package's engine and, beside it, for the frozen copy; the comparison with the working tree in a CRLF checkout and its teeth | 15 of 15 that day; the fast run is 72 of 177 today and the full one 177 |
| `pnpm run parity:live` — the live project on a clone, in two environments | `--json` byte for byte, the sha256 of the artifact, the control mode | 95 rows × 27 columns, artifact 225 673 B, sha256 `1bdb27e1…` — the numbers the standard's manifest holds, re-read 2026-09-16 |

**Fix B1 (2026-09-14).** The settings that can move a number are pinned at the boundary of the git call:
`-c core.quotePath=false` and the three of that class (colour, the signature block, the encoding of subjects)
plus a fixed locale for the subprocesses. The standards needed no re-taking: the pinning gives the same
numbers as an environment with `core.quotePath=false` in the first place. The comparison runs in the ordinary
environment and in four deliberately foreign ones; `pnpm run parity:live` compares two environments rather
than one. The witness of the former behaviour gave way to the statement of the right one: the fixture must
give as many rows in a foreign environment as the standard holds (`BLOCKERS.md` §B1, closed).

**Fix B2 (2026-09-14).** The comparison with the working tree no longer compares sizes: it answers two
questions — the state at HEAD against the tree of that commit, and the file on disk against the same content
(line endings included, which git does not always return). Both sides compare content, so an edit that did not
change the size is caught; the witness is a clone with CRLF (`BLOCKERS.md` §B2, closed).

**Deferred by these passes** — the move was not to be improved: improvements went as items of their own.

- ~~**D1.** Splitting the engine into files (§4.2)~~ — done 2026-09-14 (`REFACTOR.md` §R-1.3): 15 modules
along the seams, one entry point left, the public API of **55 names** unchanged, output and artifact byte
for byte.
- ~~**D2.** Reading paths independently of `core.quotePath`~~ — done by pinning at the git call
(`BLOCKERS.md` §B1).
- ~~**D6.** The working-tree comparison compares content rather than bytes~~ — done 2026-09-14: the comparison
is two-sided, the witness is a clone with CRLF (`BLOCKERS.md` §B2).
- ~~**D3.** The hint of a refusal quoted the engine's own path~~ — done 2026-09-14 (wave 0 of the cleaning,
`REFACTOR.md` §2): the hint quotes an entry point that exists (`bin/size.js` of the installed package), and
what it advises is carried out by the check rather than promised (`test/refusals.test.js` executes the advice,
`test/docs-commands.test.js` refuses a call by the package's bare name).
- **D4.** The `gzip` metric in the registry: the first version does not need it (requirement §12
`requirements.md`), but removing it is a change of behaviour rather than a move, so it goes as an item of its
own. The registry holds four metrics today (`raw`, `min`, `tok`, `gzip`), the default set carries three
(§4.4), and the question is open in §10.
- ~~**D5.** The engine's header still offered `node tools/size-table.js`~~ — done 2026-09-14 (wave 0 of the
cleaning, `REFACTOR.md` §R-0.5): the header and the `--init` advice name real commands, and not one mention
of a path the package does not have remains (the split of the file is D1, closed above).

**Acceptance, in today's names:**

- the report built on `safe-resets` is **byte for byte** the artifact of the standard — sha256 `1bdb27e1…`,
225 673 B — `pnpm run check:standards` and `test/frozen.test.js`;
- the data agrees with the frozen numbers row by row and cell by cell — the same runs (`--data` today, the
`--json` of that day);
- the checks that lived in the consumer's `tests/size-table.js` moved into the package's suite, which holds
**38 files and 177 checks** today (`tools/suites.js`);
- the control mode refuses a spoiled report exactly as the former one did — the mode without a flag, held by
`test/check.test.js`.

**In the consumer:** the package arrived as a dependency, and `tools/size-table.js` and `tests/size-table.js`
left together with their steps in the harness. Two expectations of the plan did not survive contact: the
settings file kept its own name — `size-table.config.json`, which is the default `CONFIG_NAME`, while
`size-report.config.json` is the name of the **template** — and the report **stayed in git** there rather
than leaving it: that is the project's business, and `--init` does not touch `.gitignore`
(`REFACTOR.md` §R-4.8).

**Release (2026-09-14):** `1.0.0`, a git dependency on the public repository
(`worklog/archive/WORKLOG.md` §40, §44); the registry publication is §8.4, and the package is published there
today as `@vernikr/size-report`.

### Step 2. The data and the view: the interactive report — “a conversation with an agent” — ✅ done 2026-09-14

**The promise:** the data model of §4.3, the data mode, the report's program (the tree, the switches, the
categories, the metric toggles, the total recounted on the fly, `localStorage`), the pre-built `dist/app.js`,
and the report leaving git in the consumer.

**Slice 1 — the data contract.** The engine hands the data out in a mode of its own (`--data`): the metadata
(the package's name and version, the locale, the headings, the artifact's path, the repair command, the
journal), the metrics with their method and their honesty, the categories, the files (label, current path,
aliases, category and where that category came from) and the rows with absolute values plus the current ones
(`now`). There is no derived quantity in the contract — the invariant §3.14 — and that is checked by the set
of fields (`test/contract-data.test.js`) rather than promised. A file's category follows its extension
(`.md` — documentation, settings — service files, images and fonts — assets, the rest — code), and a category
named in the column's settings outranks that rule. A metric whose measurement is an approximation says so
(`accuracy`), and the marks of the approximate cells travel beside it (`approx`); the rule is computed from
the formats the report actually holds rather than from the metric's name (`src/metrics.js`). The older
`--json` and `--write` were left untouched: the parity with the frozen standard stays byte for byte.

The page carries the same code as the artifact: the data and the program live inside one file with no
external reference, so the report opens from disk alone; the metrics, the categories and the files are
switched on and off, and the table and the totals are recounted on the spot. The part that counts is not a
retelling: it is `src/derived.js` embedded as it stands, and `test/page-view.test.js` compares the names the
assembled program defines with the names of that module, so a second calculation cannot appear unnoticed.
`test/contract-derived.test.js` compares the totals with the artifact's, the delta of a total with the sum of
the files' deltas, and the deltas of a column with the current size. The page runs in a real DOM (jsdom) both
in the checks and in a browser, and the contract's numbers are compared with the frozen standard — on the
fixture and on the live project (`pnpm run parity:live`).

**Slice 2 — the panel is a tree.** Instead of a flat list by category the panel shows a tree of the project's
directories (requirement §8.2 `module-design.md`): folders are built from the same paths the file's caption
shows, a folder has three states and a switch for its whole subtree with the count of files beside it, while
the quick category buttons stayed as a row above the tree and switch the same boxes. Only files hold the
state, so the tree, the categories and the table cannot drift apart. The numbers, the artifact and the form
of the output did not move: the parity held (`worklog/archive/WORKLOG.md` §23, `REFACTOR.md` R-2.4).

**Slice 3 — the choice is remembered.** The panel remembers what a reader switched off: the record lives in
the browser's memory under a key taken from the report's passport (the tool's name, the data schema, the
artifact's path, the title and the column labels) and holds only what is off, **by names** — a file by its
path, a metric by its key. A record of a foreign report is therefore not picked up (in a browser every
`file://` page shares one memory), while a redirected column or a removed metric means nothing and what
appeared stays on. The tip of the history is deliberately not part of the passport: a grown history is the
same report. The rule and the price of the decision are in `REFACTOR.md` R-2.5, the numbers and the browser
check in `worklog/archive/WORKLOG.md` §24.

**Slice 4 — the choice can be sent by a link.** The page's address **is** the link: the same record that goes
into the browser's memory goes into the anchor (`#size-report=…`), so passing a choice on is copying the
address. The link is older than the memory (it is the sender's explicit choice) and does not replace the
reader's; a foreign or a broken address is not applied but explained by a line above the table, and an address
that was sent is not rewritten. It works on an already open page too (`hashchange`: the browser does not
reload the document for a changed anchor). The decision, the refusals and the browser check are in
`REFACTOR.md` R-2.6 and `worklog/archive/WORKLOG.md` §25.

**What the step did not finish:** the pre-built `dist/app.js` — the page's program is still embedded into the
report as text at build time rather than shipped as a built file of its own (`REFACTOR.md` R-2.1 names it as
what is left there, and §8.4 says what stands in its place in the package's publication) — and the report
leaving git in the consumer,
which went the other way by decision (`REFACTOR.md` R-4.8). The look of the page, the tree of files and the
memory of the choice were done earlier than this step's text expected (`REFACTOR.md` R-2.2, R-2.4, R-2.5).

**Acceptance, in today's names:** on the fixture and on `safe-resets` the totals with everything switched on
agree with the data on every row and cell (the check moved from the consumer's `tests/size-table.js`, where it
was called “the table's numbers against an independent source”); switching a file off moves the total by
exactly its value; the deltas of a column sum to the size of the file at HEAD — apart from the columns
`BLOCKERS.md` §N4 names, where a file left and came back, and that exception is written down rather than
hidden. The report opens from `file://` with no network: the page runs in a real DOM in the checks (jsdom)
and was walked in a browser by hand. A shallow clone is refused rather than answered with a short table.

**In the consumer:** the coverage script became the coverage mode — `size check` — while the comparison of
the report with the history is the mode without a flag, and `docs/TESTING.md` describes the new check. The
report itself **stayed in git** there, and the plan's expectation that it would leave (together with a
`.size-report/` in `.gitignore`) is one of the decisions the move took the other way (`REFACTOR.md` R-4.8).

**Release:** done together with the rest of the move — the plan's own label for this step (`v0.2.0`) never
existed, and the numbers of every release are in `CHANGELOG.md`.

### Step 3. Real minification — ✅ done 2026-09-14

**The promise:** a second engine for `min` — `esbuild` for JS/TS/CSS, a minifier for markup, and stripping for
formats the minifier cannot take — so that the settings choose the engine rather than the tool choosing one for
everyone.

**What it gave.** `min` stopped being ballast-stripping alone: `minify.engine` is `strip` (the default, and
the engine both frozen standards were taken under, which is why the consumer's numbers could not move in
silence) or `esbuild`, a real minifier that travels as an **optional dependency**, loaded lazily but
synchronously and never failing a run when it is absent. The metric became honest by format: the methods and
the exactness are described in one place, and the list of formats comes from the same table the measurement
uses, so a caption cannot part from what happens; a metric with mixed formats is declared approximate as a
whole rather than passing the worst off as exact. With no minifier a run answers **code 4** and names what is
missing, while the numbers stay those of `strip` (byte for byte with the standard); a file the minifier cannot
parse is a refusal with code 2, a cause and two ways out. The `--init` draft leads a new project to
compression. Both standards stayed unre-taken, and the price is named where it belongs: on the fixture's table
compression is smaller than stripping in **4 columns of 10** and never larger, the totals `raw` / `strip` /
`esbuild` = **2511 / 1597 / 1483** (`REFACTOR.md` §R-5.5) — a project that switches the engine on sees its
numbers fall, and that is deliberate (`CHANGELOG.md` says by how much). `worklog/archive/WORKLOG.md` §26.

**What it settled and what it did not finish.** Two questions were settled rather than left open: markup gets
**stripping alone** (`stripHtml` over the lines — comments and indentation, with the measure marked), since a
real minifier for markup was not made (requirement §3.1 `requirements.md` names the two engines and the
fallback); and **JSX/TSX are deliberately not measured** — the output depends on the project's `jsx` setting
(`React.createElement` against `react/jsx-runtime`), and measuring someone else's configuration would be a
number about nothing (`src/minify.js`). The per-cell mark of an approximation — the thing this step declared
missing — was made later, in wave 2 of the cleaning (`REFACTOR.md` §R-2.7). The version of a sensor in the
cache's key waits for the cache itself, which step 6 lists as not made.

**Acceptance, in today's names:** on the fixture `min` under compression is smaller than the simplification
where expected and never larger (`test/minify.test.js`, 9 checks, comparing the fixture's table with the one
`CHANGELOG.md` carries); next to a number of an unfamiliar format stands the mark and the explanation (the
`approx` row — per cell since R-2.7); and with the minifier switched off — the loader substituted in the check
(`SIZE_REPORT_NO_OPTIONAL`) — a build does not fall over but degrades honestly with code 4 in `size check`.

### Step 4. Tokens — ✅ done 2026-09-14

**The promise:** a third metric, `tok`, counted with a real dictionary rather than by an estimate of length,
with the dictionary travelling as an optional dependency and its family and encoding named in the settings.

**What it gave.** `"tokens": {"family": "openai", "encoding": "o200k_base"}` — the dictionary comes as an
optional dependency (`gpt-tokenizer`), loads lazily and synchronously, and its absence is not a failure: the
count falls back to an estimate by length with a named coefficient, and the run answers **code 4**. Exactness
is split by the rule of step 3: the method names the dictionary, the encoding and its version, `accuracy` says
exact or approximate, and a format with no text (an image, a font, an archive) makes the whole metric
approximate and names the cause; the caption is computed from the settings, so it cannot part from what
happens. The `--init` draft leads a new project to tokens.

**Two decisions were changed against what the plan had written, and deliberately:** (1) **one family —
`openai`**, not three: `claude` and `deepseek` have no dictionary that could be called their own, and counting
with someone else's while calling it a family would be a promise that does not hold; (2) **the encoding is
chosen next to the family** (`o200k_base` / `cl100k_base`), because it is part of the number — the same file
gives 168 tokens in one and 196 in the other (`REFACTOR.md` §R-5.6, `worklog/archive/WORKLOG.md` §27).

**The exactness reached the cell.** The metric's caption speaks about the worst in the column while every cell
speaks about its own number, and an approximate cell is marked with a dotted line and the method's caption.
One rule counts both answers (`pointExact` in `src/metrics.js`), so they cannot part; the shape in the
contract is a row of marks per metric — `approx`, a string of marks over the row's cells and one over “now” —
which is why `--json` and the artifact stayed byte for byte. The choice of the dictionary's family lives **in
the run's settings**, not on the page: precomputing every family would pay time for numbers nobody may ask
about (§4.8.4 cancelled there, with the reason), and what follows for the report's texts is that each metric's
method is visible as **text** rather than only in a tooltip — a reader knows the dictionary and its encoding
while being unable to switch them. `worklog/archive/WORKLOG.md` §30, `REFACTOR.md` §R-2.7.

**Acceptance numbers (the fixture, the same table `CHANGELOG.md` carries for `1.0.0`):** `code.js` — 735 B
`raw`, 276 stripped, 185 compressed, 168 tokens (196 in `cl100k_base`); the dictionary's anchor (`hello
world` — 2 tokens) is taken from the documentation, so the check is not circular (`test/tokens.test.js`, 7
checks). With no dictionary — code 4 and the caption “an estimate by length: 1 token ≈ 3 characters”.

**What the step did not finish:** families other than `openai` — and only with a dictionary of their own
(otherwise it is an approximation under another name), which would add one more value to the `family` setting
and one more dictionary's name to the method. The family switch on the page stays cancelled: it comes back
only together with precomputation, that is with an honest answer to where the page takes its numbers from
(§4.8.4).

### Step 5. Integration — wiring it into a project — ✅ done 2026-09-14

**The promise:** the consumer project is wired in, templates for a new project are made, and the tool gains its
commands — coverage (`check`), explanation (`explain`), diagnostics (`doctor`) and the self-refreshing hook.

**The consumer was wired in.** `safe-resets` takes the package from git — by a **tag** today: its
`package.json` reads `"size-report": "github:vernikr/size-report#v1.2.0"` (the plan named a commit, and
forty characters would have to be looked up by eye while a tag is constant — the pin in `README.md` leads to
the tag of the current release and the guard ties it to `installSpec`, `REFACTOR.md` §R-4.13). The copies of the tool and of its checks are gone from the
project (`tools/size-table.js`, `tests/size-table.js`), and the table is guarded by the package's own command,
which the project's harness runs as one of its waves. The instruction was walked command by command, and two
divergences with the live project were found (`worklog/archive/WORKLOG.md` §18); the step that needed a key
left with the repository's privacy — it is public now and no key is needed (§8.4,
`worklog/archive/WORKLOG.md` §44).

**Templates were made** (`templates/`, `REFACTOR.md` §R-4.11): `size-report.config.json` (a draft of the
settings), `ci.yml` (the check described: build the report, compare it with the disk, take two snapshots of
the numbers — the ordinary one and one without the machine's git settings) and `README.md` (what goes where).
A template block for `AGENTS.md` is deliberately absent, and will not appear: the requirements do not ask for
such a file, and the tool does not invent a foreign repository's format — that is written in
`templates/README.md`. The templates are held by the suite (`test/templates.test.js`) and shipped (held by
`pnpm run pack:check` byte for byte).

**The commands were made.** `size check` is the coverage command and answers requirement §4.2
`requirements.md` — a change that slipped past the report is a violation rather than silence — while the
comparison of the report with the history is the mode without a flag; `size explain <sha>` lays out why a
commit has no row (`REFACTOR.md` §R-4.12). `size doctor` answers the environment, the optional dependencies,
the settings and the coverage in one reply (`worklog/archive/WORKLOG.md` §35), assembled from the very pieces
the other commands use — the coverage block is exactly `size check`'s answer rather than a second calculation
— with the exit code being the first by importance (2 → 3 → 1 → 4, `WEIGHT` in `src/doctor.js`) rather than
“something was found”, and a sensor the settings are silent about is named unneeded and not loaded.
`init`/`measure`/`render` never became words: the surface is the modes `--init`, `--write`, `--data` and the
form `--json` (§4.7).

**The hook was made** (`install-hook` / `uninstall-hook` / `hook-run`, `worklog/archive/WORKLOG.md` §36): the
report rebuilds itself and, when it is tracked, lands as a commit of its own. **It installs itself** — after
the package is installed and on the first run in a project (requirement §7.1 `requirements.md`), while where
installing is unsafe it stays silent and the explicit command names the cause and hands over a ready line. The
switches are `hooks.enabled: false`, the environment `SIZE_REPORT_NO_HOOK` (CI is such an environment) and
`uninstall-hook`, which returns the project to what it was. There are **two** hook files — `post-commit` and
`post-merge` — because git calls only the second for a merge (`post-commit` is not run for `git merge` at all,
and that is a check on git 2.50 rather than a guess). The report's commit is assembled with plumbing
(`hash-object` → a tree off HEAD with the report's path replaced → `commit-tree` → `update-ref`), so neither
the index nor someone else's uncommitted work gets in, and a loop is impossible **by construction rather than
by a flag**: the plumbing calls no hooks, and the report's own path gets no row, so a repeated rebuild yields
the same bytes and there is no second commit to make (requirement §7.2 `requirements.md`). A refusal does not
bring the commit down: the cause travels as one line and is visible in `size doctor` (requirements §7.3
`requirements.md`). Acceptance: every exit code by its own scenario; the hook makes no commit other than the
report's; a repeated run and a commit with nothing changed produce no second commit; a merge, a refusal, an
uninstall and someone else's hooks each by their own scenario (`test/hook.test.js`, 11 checks).

**In the consumer:** the report job appears in CI. The rule “the report is not edited by hand” stays, with a
stronger device behind it — the hook rebuilds it and commits it — while the plan's expectation that the report
would **leave git** did not happen: the decision went the other way (`REFACTOR.md` §R-4.8).

### Step 6. Polish and 1.0.0 — ✅ released 2026-09-14

**CI was made** (`.github/workflows/ci.yml`, §8.5, `worklog/archive/WORKLOG.md` §21): on every push and every
pull request the checks run by themselves, with the same commands for anyone and without secrets — one job
running `pnpm run verify`.

**The release was made** (`worklog/archive/WORKLOG.md` §40): version `1.0.0` in the manifest, `CHANGELOG.md`
with the section “what changes in the numbers” (a measurement on the fixture, compared with the live run by
`test/changelog.test.js`), the tag `v1.0.0` that the install example in `README.md` led to. `schema: 1` is
frozen: it can be broken only by a MAJOR release with a migration (§8.2). Releases have gone on through the
workflow of `REFACTOR.md` §R-4.24 since, and the package is at **2.4.0** today.

**The suite was split into a fast and a full run** (`worklog/archive/WORKLOG.md` §41, `REFACTOR.md` §R-5.7):
`pnpm test` is the fast one (**72 of 177** checks today) and `pnpm test:all` the full one (**177**), the
default being the full run; the split is by cost rather than by alphabet, and two things hold it — the
declaration (`test/suites.test.js`) and the measurement (`tools/run-tests.js`). **Time targets were abolished
on 2026-09-15** (`REFACTOR.md` §R-5.8): a run prints its duration and the load of the window rather than
comparing itself with a plan, so this step's figures of seconds are history.

**What remains of this step** (as items of their own, none of them changing numbers): the cache on disk; the
profile on a repository of a couple of thousand commits (§6 promises a `bench` for it, and no such tool is in
the tree); the three design documents `docs/ARCHITECTURE.md`, `docs/DATA-FORMAT.md`, `docs/METHODS.md` — today
the role of every number is told in `README.md`; and the removal of the `gzip` metric, D4:
open in §10, promised in §11. The licence file, once on this list, is in the package.

**Acceptance:** the full profile runs over the consumer's history — `pnpm run parity:live`, 95 rows × 27
columns — and declares no time target (`REFACTOR.md` §R-5.8); the data of every sensor is deterministic between
two runs and between two machines (§6, `test/environment.test.js`, 4 checks).

---

## 6. Parity and the acceptance of the move

The six guarantees this section was written for, and what holds each of them **today** — the records of step 0
are history, the holders are files of the tree:

| Guarantee | Held today by |
|---|---|
| The move changed no output | `test/parity.test.js` (3 checks): the package's `--json` is the fixture's golden **byte for byte**, `--write` assembles a report that passes its own control mode, and the numbers do not depend on the locale |
| The frozen copy is the one the standard was taken with | `test/frozen.test.js` (4 checks): the copy is that revision, the manifests agree with the files of the standards, and it yields the recorded numbers |
| The numbers cannot drift | `raw` reads object sizes from git itself (`cat-file --batch-check`, `src/project.js`) rather than from the working tree, and a column's deltas follow one rule (`deltaOf`, `src/derived.js`) whose exception is named — a file deleted and brought back has two cells of growth (`BLOCKERS.md` §N4, asserted by `test/contract-derived.test.js`) |
| Reading history stays batched | one or two git processes for the blobs of a run (`BLOB_CHUNK = 1000`, `src/git.js`); the boundary of git calls and its pinned settings are held by `test/git-pins.test.js` (2 checks) |
| Determinism | `test/environment.test.js` (4 checks): the output depends on neither the machine's git settings nor the locale, and the pinned engine cannot be overridden from the environment |
| Completeness and a truncated history | `size check`: a path outside the columns is a violation (**code 1**) with the path, the commit and a ready fix, while a shallow clone is **code 3** with the command to fix it (`test/check.test.js`, `test/refusals.test.js`, `test/cli-paths.test.js`) |

The lesson the move carried — **green checks are not coverage** — became the fixture's list of traps: the history
is built to break on them (`tools/make-fixture.js`, `fixtures/synthetic`), and they are the very cases the live
project had stumbled on: `//` inside a string, a regexp with an escaped slash, `.mjs` with `export`, a
non-English file name, CRLF, a rename with an edit before it, a mixed commit, a commit of the report alone, a
merge with the resolution of a conflict, a same-size replacement, a file deleted and returned, `<` and `&` in a
commit subject, a journal section, an unknown extension, an empty file, markup with its styling.
`fixtures/synthetic/README.md` names them all in one table, and the file is one of the standards compared byte
for byte.

---

## 7. The suite (it travels with the package)

The plan listed thirteen sets; the suite exists, and it is organised by subject rather than by that list. What
the plan asked of a set and what holds it today:

| Wanted then | Held today by |
|---|---|
| `history`: the order of commits, the state carried between them, reading in batches — over synthetic repositories in temp dirs | `test/disk.test.js` (the comparison with the working tree, both of its sides), `test/crlf.test.js` (the CRLF witness of `BLOCKERS.md` §B2), `test/check.test.js` (the real commits of the fixture), `test/git-pins.test.js` (the boundary of the git calls and the pinned settings) |
| `config`: the schema, the defaults, refusals, the migration of an old file | `test/cli.test.js`, `test/cli-paths.test.js`, `test/refusals.test.js`, `test/refusals-catalog.test.js` — the migration and the settings schema **never arrived** (`BLOCKERS.md` §N17) |
| `metrics-raw`: the size from the git object rather than from the content | `test/contract-data.test.js` (8 checks) |
| `metrics-min`: real compression, a marked fallback | `test/minify.test.js` (9) |
| `metrics-tok`: exactness where it is possible, a mark where it is not | `test/tokens.test.js` (7) |
| `model`: the points of change, “not yet”/“no more”, `schema: 1` | `test/contract-data.test.js` (8), `test/contract-derived.test.js` (5) |
| `render`: self-sufficiency, escaping, `reportId`, no external reference | `test/page-view.test.js` (8) |
| `app`: the tree, the switches, the sum, the memory of a choice | `test/page-tree.test.js` (5), `test/page-choice.test.js` (6) |
| `cli`: the commands, the exit codes, `--json`, a ready fix in a refusal | `test/cli.test.js`, `test/cli-paths.test.js`, `test/refusals.test.js`, `test/refusals-catalog.test.js` |
| `check`: coverage, settings, history, sensors | `test/check.test.js`, `test/doctor.test.js` |
| `golden`: a run on the fixture against the reference data and report | `test/parity.test.js` (3), `test/frozen.test.js` (4) |
| `git-pins`, `docs` | as the plan had them: ✅ (`test/git-pins.test.js`; the four `test/docs-*.test.js`) |
| `bench` (not in CI): time on a history of one or two thousand commits | **not made** — step 6 lists it as an item of its own |

The runner is Node's own (`node:test`), as the plan wanted — the package keeps no `ok — …` format of its own.
What was not in the plan and stands today: the run is a command of its own (`tools/run-tests.js`), which counts
the checks of every file against the declarations, and the split into a fast and a full run (**20 files and 72
of 177 checks**; the full one — all **38** files, 177) with a reason for every expensive file (`tools/suites.js`,
held by `test/suites.test.js`).

---

## 8. Shaping the package

### 8.1. The manifest

The draft this section carried was written before the first line of the package, and the manifest today differs
from it in every field that mattered. What became of each promise:

| Draft | Today |
|---|---|
| `name: size-report` | `@vernikr/size-report` — the un-scoped name belongs to someone else (§8.4) |
| `version: 0.1.0` | `2.4.0`; the move released **`1.0.0`** (§8.2) |
| `exports`: `.` and `./schema` | `.` alone, pointing at `src/size-table.js` — the entry point of re-exports; a settings schema never arrived (`BLOCKERS.md` §N17) |
| `files`: `bin`, `src`, `dist`, `templates`, `README.md`, `CHANGELOG.md`, `LICENSE` | the same **without `dist`**: the report is one self-contained page, so there is no built output to ship; `templates` and `LICENSE` did arrive, and the list is held in both directions by `pnpm run pack:check` |
| `engines: >=20.19`, `sideEffects: false`, `type: module` | kept as they stand |
| `optionalDependencies: esbuild ^0.2x` | `esbuild 0.28.2` and `gpt-tokenizer 4.0.0` — **exact** versions, because a number depends on them (R-5.5, R-5.6) |
| `scripts.build` / `prepack` (`dist/app.js`) | never made — there is no `dist/` and no `src/render/app`; the page is assembled at report time |
| `scripts.test: node --test test/`, `test:golden`, `lint: eslint .` | `test` (the fast run of §7), `test:all`, `suites:measure`, and `lint:strict` beside an advisory `lint`; the golden subject lives in `test/parity.test.js` and `test/frozen.test.js` |
| — | `postinstall`, which is how the hook installs itself (§4.9), and the gate commands (`verify`, `metrics`, `dup`, `deps`, `cover`, `pack:check`, `check:standards`, `parity:live`) |

The engine has **no mandatory dependency at all**: both of its tools are optional, loaded lazily and
synchronously, and their absence is an honest degradation rather than a failure (R-5.5, R-5.6). The list of what
ships is the file table's business in `README.md`; here it is enough that the manifest and the tarball cannot
disagree — `pack:check` reads both.

### 8.2. Versioning and compatibility

- **The plan's `0.1.0` for the move never existed.** The first release was **`1.0.0`** (2026-09-14), and the
  package is at **`2.4.0`** today; every release's numbers are in `CHANGELOG.md`, and `test/changelog.test.js`
  ties its version to the manifest. New sensors are MINOR and a change of the data format is MAJOR with a
  migration.
- `schema: 1` rides in the data (§4.3) and is frozen; `schemaVersion` in the settings and `--migrate` **never
  arrived** (`BLOCKERS.md` §N17) — a change of the settings' shape has no migration path today, which is why the
  promise of “a refusal with a ready migration command” belongs to the note rather than to the tree.
- The version of an optional dependency **does** reach the reader: it comes from the package itself and is part
  of the metric's method (`src/optional.js`, R-5.6). The plan's sensor `version` and its place in the cache key
  belong to the cache, which does not exist (step 6).

### 8.3. The package's documents

| Promised | Today |
|---|---|
| `README.md` — “in three minutes”: install, initialise, open the report, what next, plus a short section for an AI agent | The section “Wiring it into your project” — **eight steps** walked command by command (`REFACTOR.md` R-4.2) — and the section “For an AI agent” with the commands and exit codes |
| `docs/METHODS.md` — how every number is counted and how an approximation is marked | **not written**: the method lives in the code and its caption reaches the report as text (§4.3, R-2.7) |
| `docs/DATA-FORMAT.md` — `schema: 1`, for agents first | **not written**; the contract is documented in §4.3 and held by `test/contract-data.test.js` |
| `docs/ARCHITECTURE.md` — the core's boundaries, the sensors, the cache, how to add a metric | **not written**; the design is `docs/module-design.md` and the tree itself |
| `templates/` — a settings draft and a CI job | ✅ three files, held by `test/templates.test.js` (3 checks) and shipped byte for byte (`pack:check`); a block for `AGENTS.md` is deliberately absent — the requirements do not ask for such a file and the tool does not invent a foreign repository's format (`templates/README.md`, R-4.11) |
| A guard over the documentation's own promises | ✅ the four `test/docs-*.test.js` (paths and the file table, commands and keys with the refusals and section addresses, the counts, the install pin) — machinable claims only, everything else stays with a person (`REFACTOR.md` R-4.1, R-4.15) |
| `CHANGELOG.md`, `LICENSE` | both in the tree and in the tarball; the licence question the plan left open was answered — `MIT` in the manifest and the file shipped |

The three design documents are worth naming plainly: the plan wanted them and they were never written, which is
why they stand in the planned list of the path guard (`tools/docs-facts.js`) rather than in the tree.

### 8.4. Publication and wiring

**Where the package stands today.** It is published in the registry as **`@vernikr/size-report`**, publicly,
and a release goes out from CI by a tag (R-4.24). The name carries the owner's scope because the un-scoped
`size-report` belongs to someone else — re-checked 2026-09-16: `npm view size-report versions` ends at `1.0.2`.
The install example in `README.md` names the tag of the current release (`installSpec()`, held by
`test/docs-pin.test.js`), and a release can also be taken from the repository by tag — the consumer's manifest
reads `"size-report": "github:vernikr/size-report#v1.2.0"` — or from a tarball with no network. The instruction
was walked command by command (`README.md`, “Wiring it into your project”, R-4.2), and the protocol of that run
with the divergences it found is in `worklog/archive/WORKLOG.md` §16 (R-4.5…R-4.8).

**What became of the plan's three scenarios.** (1) The git-dependency was built and walked, and its one price
was historical: while the repository was private, fetching required a key, and the consumer's CI carried a
read-only deploy key; the repository went **public** on 2026-09-14 (`worklog/archive/WORKLOG.md` §44), the step
left the `ci.yml` template (R-4.19) and nothing needs a key since. (2) GitHub Packages was not needed: with the
owner's scope and the registry's public access it would only add an address to keep. (3) The public registry was
**done** rather than postponed — under the very scope the plan named as the way out, which is also why the tool
no longer advises `npx size-report` (R-4.21). The two obstacles the plan found standing in the way of a publish
are both closed: the name by the scope, the account by `npm trust github` (R-4.24). One thing stays with a
person: the terms of the BPE dictionaries inside `gpt-tokenizer`, which no machine reads.

**Two claims of the draft, kept as history.** `private: true` does not block a publish in a single-package
repository — npm checks that field for the members of workspaces — so it was measured then and is moot now; and
the missing licence file is fixed both ways: `license: MIT` in the manifest and `LICENSE` in the shipped list,
which `pack:check` reads.

**Local work** — `pnpm link`, or a run with `--dir` from the package over a temporary fixture. The requirement
(§5 `requirements.md`: the package rather than a copy) holds for all three ways.

### 8.5. The package's CI

✅ **Done 2026-09-14** (`worklog/archive/WORKLOG.md` §21), and since reduced to **one command**: the job is named
`verify` — the name the branch protection requires — and after `pnpm install --frozen-lockfile` it runs
`pnpm run verify`, the same profile a person runs by hand (the list of steps lives in one place,
`tools/gates/run.js`, and `test/gates-verify.test.js` reads this file to keep the two in agreement). The checkout
takes the whole history (`fetch-depth: 0`: the documentation guard reads the help of the revision the install pin
names, and the duplication sensor looks at `main`), Node comes as 22 with pnpm from the `packageManager` field,
and the actions are pinned by commit sha. **No secrets:** the consumer's history lies in the repository as a
bundle at the reference revision (`fixtures/live/history.bundle`, 149 commits at `bd6ef9d`) and the profile hands
it to `parity:live` (`--repo`, `tools/gates/run.js`), while the consumer project itself stays private and unread —
which is why the seven steps the plan listed are history rather than a description.

The three deliberate deviations from the plan still hold: no Node matrix (the package is ESM without a build, and
someone else's environment is a step's `env` rather than a Node version), no `prepack` build of `dist/app.js`
(there is no `dist/`), and the live history as a bundle instead of a run on the consumer's repository — its
sources are not ours to publish for a smoke test.

---

## 9. The risks, and how each stands today

The plan listed the risks it was going to close. Eight are closed, each with the file that holds it, one never
materialised, one is held by the data — and **two are still open**. Saying so is the point of the table: a risk
that quietly turned into a promise is worse than one that stays on the list.

| Risk | What it threatened | How it stands today |
|---|---|---|
| The report leaves git, and with it the control “artifact ↔ history” | A missed state carry-over would go unnoticed | **It did not happen** — the report stays in git here and in the consumer, the decision going that way deliberately — and the control of §6 does not depend on the artifact anyway: `size check` plus `raw` read from git objects, with the fixture's golden beside them (`REFACTOR.md` R-4.8) |
| `esbuild` is a binary dependency | Absent on a platform or offline → a run falls over instead of reporting | closed: an optional dependency, a lazy synchronous load, **code 4** with a mark on the number, and the numbers byte-for-byte the standard under `strip` (step 3, R-5.5) |
| Tokenizers are heavy (dictionaries, wasm) | A fat package and a slow build | closed: not in `dependencies`; an estimate by length where no dictionary exists; the family is chosen in the run's settings rather than precomputed on the page (§4.8.4, R-5.6) |
| Token accuracy taken for a fact | Quietly wrong “weight for a model” numbers | closed: `accuracy` on the metric, the `approx` row of marks per cell, and a caption naming the dictionary, its encoding and its version (R-2.7) |
| Data under `file://` and `localStorage` | A choice not remembered, or sticking to someone else's data | closed: a record tied to the report's **passport** and holding only what is switched off, by name, with `try/catch` around the storage and a link in `location.hash` as the way to pass a choice on (`src/page/state.js`, `test/page-choice.test.js` — 6 checks) |
| The interactive page might pull in a library | Offline opening breaks and the file grows | closed: vanilla JS in **one self-contained file** with no external reference — checked in a DOM (`test/page-view.test.js`, 8 checks) |
| The hook in a foreign repository | A loop, dirt in history, a clash with someone else's hooks | closed, **and not by “the hook does not commit”** — it does commit the report, and a loop is impossible by construction: the commit is assembled with plumbing, which calls no hooks, while the report's path gets no row, so the same rebuild yields the same bytes. Besides: a lock inside the git directory (`<git-dir>/size-report/hook.lock`), the environment `SIZE_REPORT_NO_HOOK`, `hooks.enabled: false`, `uninstall-hook`, and someone else's `core.hooksPath` refused with a ready line (`src/hook.js`, `test/hook.test.js` — 11 checks; requirements §7) |
| Huge histories | Self-refresh becomes a nuisance | **still open:** no cache on disk and no `bench` (step 6). What stands between a history and a monstrous report is `MAX_BYTES = 512 KB` per file — a constant rather than the setting §10 names — and the profile's refusal to judge by time (R-5.8) |
| The machine's git settings (`core.quotePath`, encodings, locale) | Numbers right on one machine and quietly incomplete on another | closed: the settings are pinned at the single boundary of the git calls, and the witness is a run with the machine's settings unreadable (`BLOCKERS.md` §B1, `test/git-pins.test.js`, `test/environment.test.js`) |
| `core.autocrlf` in the layout of files | A false “the state carry-over missed an edit”, leaving the tool unusable on a default Windows git | closed: the comparison checks content in both directions, and the witness is a clone with CRLF (`BLOCKERS.md` §B2, `test/crlf.test.js`) |
| A format change on an update | A project's settings break in silence | **still open:** the data's `schema: 1` is frozen and a change of it needs a MAJOR (§8.2), while `schemaVersion` in the settings and `--migrate` were never made (`BLOCKERS.md` §N17) |
| Two consumer projects on different versions | Their numbers cannot be compared | the data carries `tool: {name, version}` (`src/data.js`) and the method names the version of the dependency, so a report says what counted it |

---

## 10. The open questions — and what became of each

The plan kept the questions it refused to guess at, each with the step that was to answer it. Every one of them
was answered; the table states the answer and the file that holds it, and the two paragraphs after it keep all
that is still worth knowing about the naming and the publication.

| Question of that day | What the plan proposed | What happened |
|---|---|---|
| The package's name and the way of publishing it | decided when the plan was written | **`@vernikr/size-report`** (the owner's scope), **public**, first published 2026-09-15; a release goes out by tag from CI with the GitHub attestation (R-4.24) — the un-scoped name belongs to someone else (§8.4) |
| Where the report and the data lie on disk | `.size-report/report.html`, `.size-report/data.json`, the cache beside | the report is `docs/size-report.html` by default (`outputOf` in `src/project.js`) and the settings may name another path — the consumer keeps `docs/size-table.html`; the data is the block the page carries, written out on demand by `--data`. There is **no `.size-report/` state at all**: the hook's own state lies inside the git directory (step 6) |
| The machine-readable format for an agent | the same JSON the report embeds, plus `size measure --json` | the same JSON, reachable as `--json` and `--data`; no mode was ever called `measure` (§4.7) |
| The minifier for markup (HTML) | a minimal one of our own: comments and the spaces between tags | **not built:** markup gets stripping alone — comments and indentation, with the mark of an approximation — while the real minifier answers for JS/TS/CSS (step 3, requirement §3.1) |
| The `maxBytes` threshold for “too large a file” | 1 MB per file, configurable | **not configurable today:** `MAX_BYTES = 512 KB` is a constant of the engine (`src/project.js`). §9 keeps this open, and a file over it goes to `skip` with its reason rather than silently |
| The Claude and DeepSeek tokenizers: a dictionary or an estimate | OpenAI by dictionary, the others by a marked estimate, a dictionary added once a light one appears | **one family — `openai`** (step 4): the others have no dictionary that could be called their own, and a family may be added when one does (R-5.6) |
| Tokens for every family at once, or for the chosen one | only for the chosen one, and therefore the dictionary is chosen by a run rather than on the page | as decided: the family and its encoding live in the run's settings, and the page receives finished numbers (§4.8.4) |
| The boundaries of the “assets” category (localization files) | anything in `assets: [.svg, .woff2, .json, .po, .arb]`, overridable | the categories are the engine's own table — `code`, `docs`, `chore`, `assets` (`CATEGORY_EXTS` in `src/data.js`) — and a column may name its category, an unknown one being refused (`src/config.js`); localization files got no category of their own |
| The package's licence | MIT, with the terms of the tokenizers' dictionaries checked | `MIT` in the manifest and `LICENSE` in the shipped list; the dictionaries' terms remain a person's business, both optional dependencies declaring theirs as their own (§8.4) |
| Whether a consumer needs a CI job for the report | yes, a job of its own, with `fetch-depth: 0` and the artifact | the template `templates/ci.yml` describes exactly that job (named `size`): a whole-history checkout and the check by one command, with a variant for a report that is not in git. The consumer runs the same command inside its own CI (its `test:sizes` script) rather than adding the file |

**The name, in short.** The registry has the un-scoped `size-report` taken by someone else's package (2017,
last `1.0.2`), so the name carries the owner's scope; the plan also weighed `size-report-cli`, still a neighbour
of that foreign package, which is exactly the confusion the tool stopped inviting (R-4.21). The rename shipped
as **`1.1.1`**: not a number moved, but the tool's name is part of the report's passport, so a reader's saved
choice did not carry over once.

**What the publication taught, and it is worth keeping.** The registry serves a new package at once, while its
metadata document is cached by a CDN for five minutes, so a `npm view` seconds after the push can answer “not in
the registry” about a package that is already there. The sign of a publication is therefore `npm access get
status` (`public`), confirmed by an anonymous request for the tarball — not the first `npm view` that comes to
hand.

**What the rename touched, and what it did not.** Only the string with the name, and only where it is a name of
the package rather than of the executable (`bin` is `size`, and the tool stopped advising a call by package name
in R-4.21 — a suggestion and a draft are assembled from the path to the manifest). The rename reached the
manifest's `name`, the data (`src/tool.js`), the help line and the page file's default name (`src/refusal.js`,
`src/cli.js`), the report's passport — the link's anchor and the memory key (`src/page/app.js`) — the path to the
engine inside an installation and the hook's label (`src/hook.js`), the templates including the file names
`templates/size-report.config.json` and `.github/workflows/size-report.yml`, and the checks and tools that read
the name. The counts of that day are history: they were a snapshot rather than a rule, and the rename is done.
What stays true is the shape of the operation: the frozen standards did not move (their settings name the fix
command and their captions take no part in the name), the consumer's manifest did not change (a git reference to
the repository, which was not renamed), while its lock file **did** — the key of a dependency comes from the
manifest, so an installation run is needed or CI on a frozen lock will not come together.

**The price of the git reference, named once.** It works and costs nothing: the package installs, no key is
needed, the version is held by a tag. What it does not give is installing by name from the registry and an
ordinary version bump — that is what the registry under the owner's scope added (§8.4).

---

## 11. What the first version deliberately does not do

- **A compressed size (gzip/brotli) — and here the plan changed its mind.** It promised that the `gzip` metric
  would be *removed* from the registry; it stayed instead: the registry holds four metrics — `raw`, `min`, `tok`,
  `gzip` — and the package ships all four (§4.4, decision D4). What keeps the promise harmless is the
  **default set**: a fresh project gets `raw` and `min` (`src/config.js`), so nothing pushes the metric on
  anybody.
- Hard thresholds, blocking, notifications — the tool only shows. (This repository's own gate against bloat is
  its own device, not the package's.)
- A summary comment on a pull request and publishing the report anywhere — only a template draft
  (`templates/ci.yml`); the report is committed into the project by the hook, and the tool publishes nothing.
- Managing many projects from one place — nothing forbids it (the engine reads the project it is run in, and
  `parity:live` takes another one by `--repo`), but no such mode exists.
- Platforms other than GitHub: the release workflow is GitHub's, while commit links know **GitHub and GitLab**
  (`REMOTE_RE` in `src/project.js`); portability beyond that is the thin shell's business (requirement §9.2).
- Tokenization in the browser — the page counts nothing and receives finished numbers (R-2.7).
- A second implementation language — there is one, JavaScript.

---

## 12. The order of the work — and what it took

The plan put the move in seven steps and priced each in sessions. The order is what still holds, and it was
followed: **0** (freezing parity) → **1** (the engine moved as it was) → **2** (the data and the interactive
report) → **3** (real minification) and **5** (integration) — independent of each other and interchangeable —
→ **6** (polish, performance, documents), with **4** (tokens) after 3. The whole sequence was finished on
**2026-09-14**, released as `1.0.0`, and what each release changed in the numbers is in `CHANGELOG.md`.

The rest of that table is history and is worth naming as history: the **per-step version labels**
(`0.1.0` … `0.6.0`) never existed as releases, the session estimates were the plan's own guess, and none of
them is a promise today. The passes themselves — what was done, what was found, what was measured — are in
`worklog/archive/WORKLOG.md`.

---

## 13. The checklists

**A change to the package.** The gate is the repository's own: `pnpm run verify:fast` before an edit and in the
pre-commit hook, `pnpm run verify` before pushing and in CI (one command, §8.5). Beyond it the plan asked for
three things, and all three stand as they were written:

- The checks are green **and the standards are compared byte for byte**, the documentation guards
  (`test/docs-*.test.js`) green with them — they fall together with the document rather than at a wish.
- A repeated run yields the same data and the same report (`test/environment.test.js`, 4 checks).
- **No run is judged by time** — the plan's “not slower than the previous step, or explained in `CHANGELOG.md`”
  was abolished on 2026-09-15: a run prints its duration and the load of the window and declares no target
  (`REFACTOR.md` R-5.8).

**Taking the tool out of the consumer project (steps 1–2) — done, with one item reversed.** The copies are gone
(its `tools/` is empty, `tests/size-table.js` removed), the table is guarded by the package's own command, which
that project's harness runs as its **first wave**, and no reference to the removed files is left there. The item
that did **not** hold is the last one: `docs/size-table.html` is still edited by hand and still committed — the
consumer keeps its report in git deliberately (`REFACTOR.md` R-4.8), the opposite of what the checklist expected.

**Readiness of a release** — the list the first release was walked against, and still the live one:

- [x] `npm pack` carries nothing extra and nothing missing: `pnpm run pack:check` reads the `files` list from
      both sides. There is no `dist/app.js` to build — the page's program is pasted into it while the report is
      assembled (`src/page/build.js`), and a pre-assembled file would be a second copy of the same thing.
- [x] `README.md` was walked by a person without context: installation → initialisation → a report, command by
      command in a fresh project (`worklog/archive/WORKLOG.md` §16–§18).
- [x] Every exit code is documented (the table of codes in `README.md`) and checked by tests
      (`test/cli.test.js`, `test/doctor.test.js`, `test/check.test.js`).
- [x] A refusal carries a fix command that works — the registry of causes (`src/refusal.js`), with the form of
      the call held by `test/docs-commands.test.js`.
- [x] `CHANGELOG.md` says what changes in the numbers and why, and its table is checked against a live run
      (`test/changelog.test.js`).
- [x] The install example leads to a revision that can do what the text teaches (`test/docs-pin.test.js`), and
      the release itself goes out by tag from CI with the GitHub attestation (`test/release.test.js`, 3 checks,
      `REFACTOR.md` R-4.24).

---

## 14. References

- `docs/requirements.md` — what the product asks for: §3 the measures, §4 which files are tracked and the
  guarantee of completeness, §6 what enters the history (the report as an output — the implementation keeps it
  **in** git, deliberately), §7 the self-refresh, §9 platforms, §11 non-functional, §12 what is out of the first
  version, §13 the smallest scenario; the one decision that went against it is recorded in `REFACTOR.md` R-4.8.
- `docs/module-design.md` — how the module is built: §2 the invariants, §3 the shift that separates data from
  display, §4 the structure, §5 files and categories, §6 the canonical data, §7 the metrics, §8 the report's
  page, §9 the settings, §15 the plan of that move.
- `REFACTOR.md` — the registry of the rewriting work: an `R-n.m` address is a thing that was done, each row
  naming the file that holds the result. `BLOCKERS.md` — the blockers, all three closed (§B1, §B2, §B3), and the
  notes, of which **14 are open** today: among them the coverage ratchet (§N14), the duplicate sensor's own
  baseline (§N15) and three promises of the design that never reached the code (§N17).
- The frozen fixtures and the standards compared byte for byte: `fixtures/synthetic` — a history built to break
  on the traps its own `README.md` lists — and `fixtures/live/history.bundle`, the consumer's history at the
  reference revision (`pnpm run check:standards`).
- The source project of the move keeps its own records: its journal and the section of
  `../figma/safe-resets/docs/TESTING.md` about the size table. What this move took from it is in
  `worklog/archive/WORKLOG.md`: §16–§18 walking the instruction and the two divergences it found, §21 the CI,
  §26–§27 the two sensors, §30 the mark of an approximation, §35–§36 the commands and the hook, §40–§41 the
  release and the split, §44 the repository going public, §53–§57 the publication and the releases by tag.

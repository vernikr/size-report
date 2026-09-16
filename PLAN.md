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

## 5. План переноса по шагам

Каждый шаг — отдельный релиз пакета, ничего не ломающий, и отдельное изменение
в проекте-потребителе. Шаг 0 — без кода.

### Шаг 0. Заморозка паритета (подготовка) — ✅ **сделано 2026-09-14**

**Делаем:** фиксируем сегодняшний вывод как эталон, иначе «перенос ничего не
сломал» нечем доказать.

**Сделано.** Эталон снят с `safe-resets` (149 коммитов, 95 строк × 27 колонок,
артефакт 225 673 Б) скриптом `tools/parity-freeze.js`; фикстура собрана скриптом
`tools/make-fixture.js` (16 коммитов, 14 строк × 10 колонок, два коммита без
строки) — подробности и числа в `WORKLOG.md` §2. Оба скрипта лежат в `tools/`,
результат — в `fixtures/`.

Ход работ, который этот шаг описывает:

1. `node tools/size-table.js --write` и хеш `docs/size-table.html` — сохранить как
   `fixtures/parity/artifact.sha256` (шаг 1 обязан воспроизвести тот же файл
   **байт-в-байт**).
2. `node tools/size-table.js --json > fixtures/parity/data.json` на текущем
   HEAD вместе с копией `size-table.config.json` и списком sha.
3. Собрать **синтетическую фикстуру**: `git bundle` с ~20 коммитами истории
   safe-resets (обязательно с: переименованием файла, слиянием, коммитом «только
   таблица», не-английским именем файла, файлом с CRLF, `.mjs` с `export`) и
   golden-числами для неё. Скрипт сборки — `tools/make-fixture.js`, лежит в
   пакете, запускается один раз руками.

**Приёмка:** фикстура воспроизводится из бандла в чистом временном каталоге;
golden-числа совпадают с выводом текущего генератора на этой фикстуре.

### Шаг 1. Перенос движка как есть (v0.1.0) — «паритет»

**Делаем:** переносим ядро **без новых метрик и без смены формата отчёта**:
git-история, `raw`, текущий `min` (упрощение), `gzip` выкидываем, журнал, якоря,
рендер статичного HTML, `--init`, `--json`, контрольный режим. Код переезжает в
ESM; разбиение по файлам §4.2 — отдельным проходом (пункт D1), чтобы перенос
доказывался до переустройства, а не после него.

**Сделано (2026-09-14, проход 1).** Эталон снят заранее, до правки кода
(`fixtures/parity/`, `fixtures/synthetic/`, `fixtures/legacy/size-table.cjs` —
замороженная копия реализации, её sha256 сверяется с ревизией, с которой снят
эталон). Паритет-тест `test/parity.test.js` сверяет движок пакета с эталоном
побайтово: числа (`--json`), артефакт (sha256) и контрольный режим, плюс прогон
под `LC_ALL=C`; замороженная копия сверяется рядом с движком, чтобы провал было
нельзя списать на расхождение самого эталона. Движок перенесён в `src/size-table.js`
и `bin/size.js`: только шапка импортов, `__filename` через `import.meta.url` и
хвост экспорта — ни строки механики. Живой проект сверяется командой
`pnpm run parity:live` на клоне (в самом проекте ничего не пишется).

**Перенос (2026-09-14, проход 2).** Движок лежит в `src/size-table.js`, команда —
в `bin/size.js` (импорт `main` и `process.exitCode`); поверхность CLI пока прежняя
(`--write`, `--json`, `--init`, `--config`) — имена команд `size init/measure/render`
приходят вместе с шагом 2, чтобы перенос не менял ничего, кроме раскладки.

Содержимое механики не тронуто: эталонная копия превращается в файл движка **ровно
четырьмя механическими заменами** (шапка `require` → `import` и путь файла из
`import.meta.url`, убран самозапуск `require.main`, `module.exports` → `export`, в
список экспорта добавлен `main`). Проверено побайтовым сравнением результата этих
замен с `src/size-table.js`; 1129 строк механики совпадают с эталоном без единого
изменения.

Доказательства паритета (все автоматические, не на глаз):

| Где | Что сверено | Результат |
|---|---|---|
| `pnpm test` — 15 проверок, 14 с | Фикстура в четырёх чужих окружениях: `--json` побайтово, sha256 артефакта, контрольный режим — для движка пакета и рядом для эталонной копии; сверка с рабочим деревом в выкладке CRLF и её зубы | 15 из 15 |
| `pnpm run parity:live` — 8,5 с | Живой проект на клоне в двух средах: `--json` побайтово, sha256 артефакта, контрольный режим | 95 строк × 27 колонок, артефакт 225 673 Б, sha256 `1bdb27e1…` — совпало |

**Починка B1 (2026-09-14, проход 3).** Настройки, влияющие на разбор, закреплены на
границе вызова git: `-c core.quotePath=false` и три настройки того же класса
(раскраска, блок подписи, кодировка подписей) плюс фиксированная локаль
подпроцессов. Эталоны пересъёмки не потребовали: закрепление даёт те же числа, что
снимались в окружении с `core.quotePath=false`. Сверка идёт и в обычном окружении,
и в четырёх заведомо чужих; `pnpm run parity:live` проверяет две среды вместо
одной. Свидетель прежнего поведения заменён утверждением правильного: фикстура
обязана давать в чужом окружении столько же строк, сколько в эталоне (§B1).

**Починка B2 (2026-09-14, проход 4).** Сверка с рабочим деревом размеры больше не
сравнивает: она отвечает на два вопроса — состояние на HEAD против дерева коммита
и файл на диске против того же содержимого (с точностью до переводов строк,
которые git возвращает не всегда). Обе стороны сравнивают содержимое, поэтому
правка, не изменившая размер, теперь ловится. Три проверки в `test/parity.test.js`
держат по мутации на каждую сторону (`BLOCKERS.md` §B2). Числа и артефакт не
изменились: живой проект сверен побайтово в двух средах.

**Отложено этими проходами** (перенос не улучшаем — улучшения отдельными пунктами):

- ~~**D1.** Разбиение движка по файлам §4.2~~ — сделано 2026-09-14 (R-1.3
  `REFACTOR.md`): движок разложен по швам на 15 модулей, точки входа осталась
  одна, публичный API (58 имён) не изменился, вывод и артефакт — байт в байт.
- ~~**D2.** Чтение путей независимо от `core.quotePath`~~ — сделано закреплением
  на границе вызова git (`BLOCKERS.md` §B1).
- ~~**D6.** Сверка с рабочим деревом сравнивает содержимое, а не байты~~ — сделано
  2026-09-14: сверка двусторонняя, свидетель — клон с CRLF (`BLOCKERS.md` §B2).
- ~~**D3.** Текст подсказки в ошибке цитирует путь движка~~ — сделано 2026-09-14
  (волна 0 чистки, `REFACTOR.md` §2): подсказка цитирует точку входа
  `bin/size.js`, и её выполнение даёт работающие настройки; стережёт
  `test/cli.test.js`.
- **D4.** Метрика `gzip` в реестре: по требованиям v1 не нужна, но её удаление —
  изменение поведения, а не перенос, поэтому уходит отдельным пунктом.
- ~~**D5.** Шапка движка всё ещё предлагает запуск `node tools/size-table.js`~~
  — сделано 2026-09-14 (волна 0 чистки, `REFACTOR.md` R-0.5): шапка и советы
  `--init` называют реальные команды, упоминаний путей, которых в пакете нет, не
  осталось (разбиение файла — D1, закрыто выше 2026-09-14).

**Приёмка:**

- `size render` на safe-resets даёт файл, **побайтово равный** сегодняшнему
  `docs/size-table.html` (сравнение по хешу из шага 0);
- `size measure --json` совпадает с `data.json` шага 0 (числа и порядок строк);
- тесты модуля: 12 наборов проверок из `tests/size-table.js` переехали и зелёные;
- `size check` падает на испорченном отчёте так же, как текущий контрольный режим.

**В проекте-потребителе:** `pnpm add -D file:../size-report` (или из
gh-packages, см. §8), `size-report.config.json` из старого конфига через
`--migrate`, `scripts.sizes`/`test:sizes` → `size render` / `size check`,
`tools/size-table.js` и `tests/size-table.js` удаляются вместе с шагами в
`harness.js`, `doc-sync.js` перестаёт их считать, `docs/TESTING.md`, `AGENTS.md`,
`README.md` правятся, `.gitignore` получает `.size-report/`. Отчёт на этом шаге
**остаётся в git** (`docs/size-table.html`) — он ещё и доказательство паритета.

**Выпуск (сделан 2026-09-14):** `1.0.0`, git-зависимость из публичного
репозитория (`WORKLOG.md` §40, §44); публикация в npm — §8.4.

### Шаг 2. Данные и отображение: интерактивный отчёт (v0.2.0) — «разговор с агентом»

**Делаем:** модель данных §4.3, `size measure --json`, программа отчёта
(дерево, чекбоксы, категории, переключатели метрик, пересчёт суммы на лету,
`localStorage`), пре-собранный `dist/app.js`, отказ от «отчёта в git».

**Сделано (2026-09-14, срез 1 — контракт данных).** Движок отдаёт данные отдельным
режимом (`--data`): метаданные (имя и версия пакета, локаль, заголовки, путь
артефакта, команда починки, журнал), метрики со способом и честностью, категории,
файлы (метка, текущий путь, алиасы, категория и её источник) и строки с абсолютными
значениями плюс текущие значения (`now`). Производных величин в контракте нет —
инвариант §3.14 — и это проверяется по составу полей, а не обещанием. Категория
файла считается по расширению (`.md` — документация, конфиги — служебные, картинки
и шрифты — ресурсы, остальное — код), а категория из настроек колонки старше
правила. Метрика, которая не минификация, помечена приближением. Старые `--json` и
`--write` не тронуты: паритет с замороженным эталоном остаётся побайтовым.

Потребляемость доказана минимальной страницей (`--page`, `size-report.html` рядом с
таблицей): данные и скрипт внутри одного файла, внешних ссылок нет; метрики,
категории и файлы включаются и выключаются, таблица и итоги пересчитываются на
месте. Вычислительная часть страницы — не пересказ, а те же исходники, которыми считает
артефакт (`src/derived.js`): второго расчёта нет, и проверка контракта
следит за тем, чтобы он не появился (список функций оболочки страницы закрыт).
Тест сверяет итоги с итогами артефакта, дельту итога — с суммой дельт по файлам, а
сумму дельт по колонке — с текущим размером. Страница работает в настоящем DOM
(jsdom) — и в тесте, и в браузере. Числа контракта сверяются с замороженным
эталоном и на фикстуре, и на живом проекте (`pnpm run parity:live`).

**Сделано (2026-09-14, срез 2 — панель: дерево файлов).** Левая панель вместо
плоского списка с категориями показывает дерево по реальной структуре каталогов
(требование §8.2 `module-design.md`): папки строятся из тех же путей, что показаны
в подписи файла, у папки три состояния и переключатель на всё поддерево, рядом —
число файлов; быстрые кнопки категорий остались и переставляют те же галочки.
Состояние хранят только файлы — поэтому дерево, категории и таблица не могут
разойтись. Числа, артефакт и форма вывода не менялись: паритет держится
(`WORKLOG.md` §23, `REFACTOR.md` R-2.4).

**Сделано (2026-09-14, срез 3 — память выбора).** Панель помнит, что читатель
выключил: запись живёт в памяти браузера под ключом из «паспорта отчёта» (имя
инструмента, схема данных, путь артефакта, заголовок и метки колонок) и хранит
только выключенное, **по именам** — файл путём, метрика ключом. Поэтому запись
чужого отчёта не подхватывается (в браузере все страницы `file://` делят одну
память), перенаправленная колонка и убранная метрика ничего не значат, а
появившееся остаётся включённым. Верхушки истории в паспорте намеренно нет:
подросшая история — тот же отчёт. Правило и цена решения — `REFACTOR.md` R-2.5,
числа и браузерная проверка — `WORKLOG.md` §24.

**Сделано (2026-09-14, срез 4 — обмен выбором ссылкой).** Адрес страницы и есть
ссылка: та же запись, что ложится в память браузера, ложится и в якорь
(`#size-report=…`), поэтому передать выбор = скопировать адрес. Ссылка старше
памяти (она — явный выбор отправителя) и память читателя не подменяет; чужой и
испорченный адрес не применяется, но объясняется строкой над таблицей, а
присланный адрес не переписывается. Работает и на уже открытой странице
(`hashchange`: браузер на смену якоря документ не перезагружает). Решение,
отказы и браузерная проверка — `REFACTOR.md` R-2.6, `WORKLOG.md` §25.

**Осталось из шага 2:** пре-собранный `dist/app.js` вместо текста в движке и отказ
от «отчёта в git» в проекте-потребителе. Внешний вид страницы, дерево файлов и
память выбора сделаны раньше (`REFACTOR.md` R-2.2, R-2.4, R-2.5).

**Приёмка:** на фикстуре и на safe-resets суммы при полном включении совпадают с
`--json` на каждой строке и клетке (это переезд проверки из `tests/size-table.js`
§«числа таблицы против независимого источника»); выключение файла меняет сумму
ровно на его значение; сумма дельт по колонке сходится с `git cat-file -s` на
HEAD; отчёт открывается из `file://` без сети (проверка `ui-dom`-стилем через
jsdom + ручная проверка двойным щелчком).

**В проекте:** `docs/size-table.html` удаляется из git и из `.gitignore`
добавляется `.size-report/`; `test:sizes` заменяется на `size check` (полнота и
настройки); `fetch-depth: 0` в CI из проекта уходит (полная история нужна только
job'у отчёта пакета); `docs/TESTING.md` описывает новую проверку.

**Выпуск:** `0.2.0`.

### Шаг 3. Настоящая минификация (v0.3.0)

**Сделано (2026-09-14, срез 1 — способ выбирается настройкой).** `min` перестал
быть только снятием балласта: `minify.engine` — `strip` (умолчание: под ним сняты
оба замороженных эталона, поэтому числа потребителя не могли поехать молча) или
`esbuild` — настоящее сжатие JS/TS/CSS необязательной зависимостью, которая
загружается лениво и синхронно и не роняет прогон, если её нет. Метрика стала
честной по формату: способы и точность описаны в одном месте, названные форматы
берутся из той же таблицы, по которой идёт замер, поэтому подпись не может
разойтись с тем, что происходит; метрика со смешанными форматами объявлена
приближённой целиком, а не выдаёт худшее за точное. Без минификатора прогон
отдаёт **код 4** и говорит, чего не хватает, а числа остаются теми же, что у
`strip` (побайтово с эталоном); файл, который минификатор не разобрал, — отказ
кодом 2 с причиной и двумя выходами. Черновик `--init` ведёт новые проекты на
сжатие. Цена названа: на фикстуре 44 клетки меньше и ни одной больше (−1 372 Б),
на живой истории прогон 1,48 → 1,71 с (проход — `WORKLOG.md` §26, R-5.5).

**Осталось из шага 3:** минификатор разметки для HTML, решение по JSX/TSX (выход
зависит от настройки `jsx` проекта) и пометка приближения **в каждой клетке**, а не
по формату в подписи метрики (`fallback: true` в точке — форма данных §4.3);
версия датчика в ключе кэша ждёт самого кэша (шаг 6).

**Делаем:** датчик `min` v2 — `esbuild` (JS/TS/CSS/JSON), минификатор разметки для
HTML, упрощение для незнакомых форматов с пометкой `fallback`; `version` датчика
меняется, кэш шага 1–2 не смешивается; `esbuild` — `optionalDependency`,
подключаемый динамически; тесты на «переименование реально произошло» (имена
переменных исчезли) и на воспроизводимость (одинаковый вход → одинаковое число от
версии к версии).

**Приёмка:** на фикстуре `min` меньше упрощённого там, где ожидается; для
незнакомого расширения рядом с числом стоит пометка «приближение» и объяснение;
с выключенным `esbuild` (подмена загрузчика в тесте) сборка не падает, а честно
деградирует с кодом `4` в `check`.

**В проекте:** числа `min` в новой таблице падают — это осознанное изменение,
фиксируется в CHANGELOG пакета и в WORKLOG проекта.

**Выпуск:** `0.3.0`.

### Шаг 4. Токены (v0.4.0) — срезы 1–2 ✅ **сделано 2026-09-14**

**Сделано.** Метрика `tok` считает токены настоящим словарём, а не отношением:
`"tokens": {"family": "openai", "encoding": "o200k_base"}` — словарь едет
необязательной зависимостью (`gpt-tokenizer`), грузится лениво и синхронно, его
отсутствие не падает: счёт идёт оценкой по длине с названным коэффициентом, а
прогон отдаёт **код 4**. Точность разделена по правилу шага 3: способ метрики
называет словарь, кодировку и версию, `accuracy` говорит «точный/приближённый», а
формат без текста (картинка, шрифт, архив) делает метрику приближённой целиком и
называет причину — подпись считается по настройкам, поэтому разойтись с тем, что
происходит, не может. Черновик `--init` ведёт новые проекты на токены.

**Два решения изменены против того, что было записано ниже, и это сделано
осознанно:** (1) **семейство одно — `openai`**, а не три: у `claude` и `deepseek`
нет словаря, который можно было бы назвать их собственным, а считать чужим
словарём и называть это семейством — обещание, которого нет; (2) **кодировка
выбирается рядом с семейством** (`o200k_base` / `cl100k_base`), потому что она
часть числа: один и тот же файл даёт 168 токенов в одной и 196 в другой.

**Числа приёмки** (фикстура): `code.js` — 735 Б `raw`, 276 упрощением, 185
сжатием, 168 токенов (196 в `cl100k_base`); якорь словаря (`hello world` — 2
токена) взят из документации, то есть проверка не круговая; байт на токен
отличается по файлам в 2,5 раза. Без словаря — код 4 и подпись «оценка по длине:
1 токен ≈ 3 знака». Проход — `WORKLOG.md` §27, цена по времени — `REFACTOR.md`
R-5.6 и §3.

**Срез 2 (2026-09-14).** Точность доехала до клетки: подпись метрики говорит про
худшее в колонке, а каждая клетка — про своё число, и приближённая помечена
пунктиром с подписью способа. Оба ответа считает одно правило (`pointExact` в
`src/metrics.js`), поэтому разойтись не могут; форма контракта — ряд пометок
`approx` по метрике (строка знаков по клеткам строк и строка по «сейчас»),
отсюда и `--json` и артефакт остались байт в байт. Выбор семейства словаря
решением этого среза **живёт в настройках запуска**, а не на странице: предвычислить
все семейства — платить временем за числа, о которых могут и не спросить (§4.8.4
отменено, причина — там же). Что от этого следует для текстов: способ каждой
метрики виден на странице **текстом** (не только во всплывающей строке), поэтому
читатель знает словарь и его кодировку, хотя и не может их переключить. Числа и
время — `WORKLOG.md` §30, объём — `REFACTOR.md` R-2.7.

**Осталось из шага 4:** семейства кроме `openai` — но только со своим словарём
(иначе это приближение с другим именем), и тогда у настройки появится ещё одно
значение `family`, а способ — ещё одно название словаря. Выбор семейства на
странице остаётся отменённым: он вернётся только вместе с предвычислением, то
есть с честным ответом, откуда страница берёт числа (§4.8.4).

**Выпуск:** `0.4.0`.

### Шаг 5. Интеграция (v0.5.0) — подключение к проекту ✅ **2026-09-14**

**Подключение проекта-потребителя сделано.** `safe-resets` берёт пакет из git по
коммиту (`github:vernikr/size-report#d63468d`), копии инструмента и его теста в
нём больше нет (`tools/size-table.js`, `tests/size-table.js`), а таблицу стережёт
шаг `size` в `test:all`; артефакт пересобран отдельным коммитом. Шаги по
инструкции README и два расхождения с живым проектом (шаг доступа к пакету в CI и
переезд с уже лежавшей копии) — `WORKLOG.md` §18; шаг с ключом оттуда с тех пор
ушёл вместе с приватностью репозитория (§8.4, `WORKLOG.md` §44).

**Шаблоны для подключаемого проекта сделаны** (`templates/`, `REFACTOR.md`
R-4.11): `size-report.config.json` (черновик настроек), `ci.yml` (описание
проверки: сборка таблицы, сверка с диском, два снимка чисел — обычный и без
настроек git) и `README.md` (куда что кладётся). Шаблона блока для `AGENTS.md`
здесь нет и не будет: требования такого файла не просят, а формат чужого
репозитория инструмент не выдумывает — записано в `templates/README.md`. Шаблоны
под проверкой набора (`test/templates.test.js`) и в списке поставки (это стережёт
`pnpm run pack:check`).

**Полнота и объяснение сделаны** (`size check`, `size explain <sha>`,
`REFACTOR.md` R-4.12): команда, ставшая словом, а не ключом, читается где угодно
(`check` — это ещё и замена утраченному контролю «артефакт ↔ история»,
требование §4.2). Остались `size doctor` и `install-hook`; `init`/`measure`/`render`
пока ключи.

**Диагностика одним ответом сделана** (`size doctor`, `WORKLOG.md` §35): окружение,
необязательные зависимости, настройки и покрытие — ответ собирается из тех же
кусков, что и остальные команды (блок покрытия — это ровно ответ `size check`,
а не второй расчёт), а код выхода — первый по важности (2 → 3 → 1 → 4), а не
«что-то нашлось». Датчик, о котором настройки молчат, назван ненужным и не
загружается. Последним оставался `size install-hook` — сделан ниже;
`init`/`measure`/`render` пока ключи.

**Хук автообновления сделан** (`size install-hook` / `uninstall-hook` / `hook-run`,
`WORKLOG.md` §36): отчёт пересобирается сам и, если он в git, ложится отдельным
коммитом. Ставится только явной командой, снимается командой же; выключатели —
`hooks.enabled: false` в настройках и окружения `CI` / `SIZE_REPORT_NO_HOOK`.
Файлов два — `post-commit` и `post-merge`: на слияние git зовёт только второй
(`post-commit` при `git merge` не выполняется вовсе), и это не догадка, а проверка
на git 2.50. Коммит отчёта собирается плумбингом (`hash-object` → дерево от HEAD с
подменённым путём отчёта → `commit-tree` → `update-ref`), поэтому в него не
попадают ни индекс, ни чужая незакоммиченная работа, а зацикливание невозможно по
устройству: `commit-tree` хуков не зовёт. Отказ инструмента коммит не роняет —
причина едет одной строкой и видна в `size doctor`.

**Приёмка:** каждый код выхода проверен отдельным сценарием; хук не создаёт
коммитов, кроме коммита отчёта; повторный запуск и коммит без изменений не
порождают второго; слияние, отказ, снятие и чужие хуки — своими сценариями
(`test/hook.test.js`).

**В проекте:** появляется джоб отчёта в CI (по желанию — артефакт), а правило
«отчёт не правим руками» заменяется на «отчёт не в git, его не коммитим». Блок
«здесь подключён size-report» в `AGENTS.md` в шаблоны не входит: требования его
не просят.

**Выпуск:** `0.5.0`.

### Шаг 6. Полировка и 1.0.0 — `1.0.0` выпущен 2026-09-14

**CI сделан** (`.github/workflows/ci.yml`, §8.5, `WORKLOG.md` §21): на каждый пуш и
на каждый запрос правки проверки идут сами, одними и теми же командами у любого и
без секретов.

**Выпуск сделан** (`WORKLOG.md` §40): версия `1.0.0` в манифесте, `CHANGELOG.md` с
разделом «Что изменится в числах» (замер на фикстуре, сверяется с живым прогоном —
`test/changelog.test.js`), тег `v1.0.0`, на который ведёт пример установки в
`README.md`. `schema: 1` заморожена: сломать её теперь можно только MAJOR-выпуском
с миграцией (§8.2).

**Набор проверок разделён на быстрый и полный** (`WORKLOG.md` §41, `REFACTOR.md`
R-5.7): `pnpm test` — 56 проверок из 127 за **5–6,5 с** (каждая правка),
`pnpm test:all` — все 127 за **22,6–29,7 с** по окнам (выкладка и CI); разделение по
цене, умолчание — полный прогон, стерегут его объявление (`test/suites.test.js`) и
сам замер (`tools/run-tests.js`).

**Остаётся из этого шага** (отдельными проходами, ни один из них не меняет числа):
кэш на диске; профиль на репозитории в пару тысяч коммитов; `docs/ARCHITECTURE.md`,
`docs/DATA-FORMAT.md`, `docs/METHODS.md` — сегодня роль каждого числа описана в
`README.md`; удаление метрики `gzip` (D4) и лицензионный файл (вопрос `PLAN.md` §10).

**Приёмка:** полный прогон по истории safe-resets — в разумное время (замер и
запись в README); данные всех датчиков детерминированы между двумя запусками и
между двумя машинами (§6, `test/environment.test.js`).

**Выпуск:** `1.0.0`, `schema: 1` заморожена.

---

## 6. Паритет и приёмка переноса

| Гарантия | Чем доказана |
|---|---|
| Перенос не изменил вывод | `artifact.sha256` (статичный HTML) и `data.json` шага 0 — сравнение побайтово на шаге 1 |
| Числа не «уехали» | Независимый источник: сумма дельт по колонке = размер блоба в `git cat-file -s` на HEAD (проверка переезжает из `tests/size-table.js`) |
| Чтение истории осталось пакетным | Монки-патч `execFileSync` в тесте: ноль спавнов `git show`, число `cat-file` ≤ `2·ceil(commits/1000) + 2` |
| Детерминированность | Два прогона подряд → одинаковый sha256 данных и отчёта; в данных нет времени запуска и абсолютных путей |
| Полнота | `size check` на фикстуре с неподслеживаемым файлом краснеет (код `1`), после правки настроек — зелёный |
| Устойчивость к обрезанной истории | `git clone --depth 1` в тесте → код `3` и текст с готовой командой |

Урок текущего проекта, который переносим: «зелёные тесты ≠ покрытие».
Фикстура-бандл из шага 0 должна содержать ровно те ловушки, на которых ломались:
слияние с правкой конфликта, `export` в `.mjs`, `//` внутри строки, регексп с
`\/`, не-английское имя файла, CRLF, файл, удалённый и возвращённый, коммит
«только отчёт».

---

## 7. Тестирование модуля (едет вместе с пакетом)

| Набор | Что проверяет | Крайние случаи |
|---|---|---|
| `history` | Синтетические репозитории во временных каталогах: порядок, перенос состояния, чтение пачкой | Слияния, переименования, удаления, shallow |
| `config` | Схема, значения по умолчанию, отказы, миграция старого конфига | Испорченный JSON, неизвестная метрика, отчёт колонкой |
| `metrics-raw` | Размер из объекта git = `cat-file -s`, содержимое не читается | Пустой файл, файл без перевода строки, CRLF |
| `metrics-min` | Реальное переименование имён, воспроизводимость, помеченный fallback | Незнакомое расширение, некомпилируемый результат, гигантский файл |
| `metrics-tok` | Точность там, где возможна; пометка приближения | Пустая строка, эмодзи, кириллица, суррогатные пары |
| `model` | Точки изменения, «ещё нет»/«уже нет», сериализация, `schema: 1` | Удаление и возврат файла, файл, не менявшийся сотню коммитов |
| `render` | Самодостаточность, экранирование `</script>`/U+2028, `reportId`, отсутствие внешних ссылок | Заголовок коммита с `<`, имя файла с `&` |
| `app` | Дерево, чекбоксы, пересчёт суммы, состояние в `localStorage`/hash, офлайн | Нет `localStorage`, пустой выбор, все выключены |
| `cli` | Команды, коды выхода, `--json`, готовые команды починки в текстах; незнакомый ключ, ключ без значения и лишнее слово — отказ, а не молчаливый пропуск | Нет git, не git-репозиторий, нет файла настроек, `--wite`, `--config` без значения, `--force` без `--init`, слово после режима со значением |
| `check` | Полнота, настройки, история, датчики | Новый тип файла, shallow, отсутствующий `esbuild` |
| `golden` | Прогон на фикстуре-бандле ↔ эталонные данные и эталонный отчёт | Любое «незаметное» изменение вывода |
| `git-pins` | ✅ есть: граница чтения git — прямой вызов без общего списка закреплений назван файлом и строкой, и закрепление показывается свидетелем (`test/git-pins.test.js`) | Настройки машины, локаль, не-английские пути |
| `docs` | ✅ есть: утверждения документации о репозитории — пути и таблица файлов ↔ дерево (`test/docs-paths.test.js`), команды и ключи из справки, причины отказа против реестра движка и адреса разделов (`test/docs-commands.test.js`), число проверок (`test/docs-numbers.test.js`), а с R-4.13 — и пин в примере установки: он ведёт на ревизию **этого** репозитория, и её справка знает названные в тексте команды (`test/docs-pin.test.js`) | Обещания будущего, формулировки и смысл — вне проверки, названо в её шапке |
| `bench` (не в CI) | Время на истории в 1–2 тысячи коммитов | Регрессия по времени |

Инфраструктура: `node:test` (штатный раннер Node 22 — в пакете нет причин
держать собственный формат `ok — …`, как в проекте-потребителе).

---

## 8. Оформление пакета

### 8.1. `package.json`

```jsonc
{
  "name": "size-report",
  "version": "0.1.0",
  "type": "module",
  "bin": { "size": "./bin/size.js" },
  "exports": { ".": "./src/index.js", "./schema": "./src/config/schema.json" },
  "files": ["bin", "src", "dist", "templates", "README.md", "CHANGELOG.md", "LICENSE"],
  "engines": { "node": ">=20.19" },
  "sideEffects": false,
  "optionalDependencies": { "esbuild": "^0.2x" },
  "scripts": {
    "build": "node tools/build-app.js",          // dist/app.js из src/render/app
    "test": "node --test test/",
    "test:golden": "node --test test/golden.test.js",
    "lint": "eslint .",
    "prepack": "npm run build"
  }
}
```

Никаких обязательных зависимостей у движка: минификатор и токенизаторы —
опциональные, подключаются динамическим импортом с честной деградацией.

Сегодняшний манифест обещает только то, что в репозитории есть (`bin`, `src`,
`templates`, `README.md`): `dist/`, `CHANGELOG.md` и `LICENSE` появляются здесь
вместе с шагами ниже, а до тех пор их в `files` нет — за этим следит
`pnpm run pack:check` (`REFACTOR.md` §3, `README.md`).

### 8.2. Версионирование и совместимость

- SemVer: перенос — `0.1.0`, новые датчики — MINOR, изменение формата данных —
  MAJOR с миграцией.
- `schema: 1` данных и `schemaVersion` настроек версионируются отдельно от
  версии пакета; несовпадение — код `2` и текст с командой миграции.
- Версии минификатора/токенизатора попадают в `version` датчика, а он — в ключ
  кэша и в `method`: числа воспроизводимы между машинами и релизами.

### 8.3. Документация пакета

- `README.md` — «за 3 минуты»: установка, `size init`, открыть отчёт, что дальше;
  отдельная короткая секция «для ИИ-агента» с командами и кодами выхода.
- `docs/METHODS.md` — как считается каждое число, чем помечается приближение.
- `docs/DATA-FORMAT.md` — `schema: 1` (в первую очередь для агентов).
- `docs/ARCHITECTURE.md` — границы ядра, датчики, кэш, как добавить метрику.
- `templates/` — ✅ есть: черновик настроек и job CI (блока в `AGENTS.md` нет
  намеренно — требования его не просят, `templates/README.md`).
- ✅ у обещаний самой документации есть сторож (`test/docs-paths.test.js`,
  `test/docs-commands.test.js`, `test/docs-numbers.test.js`, `test/docs-pin.test.js`,
  `REFACTOR.md` R-4.1): пути, таблица файлов, команды и ключи, причины отказа, числа,
  адреса разделов и пин — машинно; остальное названо словами и остаётся человеку.
- `CHANGELOG.md`, `LICENSE` (открытый вопрос §10).

### 8.4. Публикация и подключение

**Выбран и проверен сценарий 1 — git-зависимость** (проверка 2026-09-14, в свежем
проекте): `pnpm add -D github:vernikr/size-report#<коммит>` ставится за секунды,
пакет работает из `node_modules`, `--init` создаёт конфиг с `fixCommand` под
менеджер пакетов проекта, а `test:sizes` в CI на свежем клоне даёт 0. Инструкция
покомандно — `README.md`, раздел «Wiring it into your project» (она же рецепт
для шага 5); протокол прогона и найденные расхождения — `WORKLOG.md` §16,
`REFACTOR.md` R-4.5…R-4.8. Остальные два сценария остаются на потом:

1. **git-зависимость** — `"size-report": "github:vernikr/size-report#<тег выпуска>"`
   (действующий тег назван в `README.md` §1, где за ним следит сторож):
   ноль инфраструктуры, ставится как обычный пакет. **Цена, найденная первым же
   подключением (2026-09-14):** пока репозиторий был приватным, загрузка требовала
   ключа у того, кто ставит, — у разработчика он есть, а в CI его нет, и job падал
   на `pnpm install`; поэтому в `safe-resets` и появился шаг с read-only deploy
   key. **Цены больше нет (2026-09-14):** репозиторий сделан публичным, и pnpm
   разрешает `github:` в архив `codeload.github.com`, который тянется по HTTPS —
   ни ключа, ни токена (`WORKLOG.md` §44: установка в пустом проекте, где у git не
   было ни настроек, ни помощника учётных данных, — 3,4 с). Шаг с ключом из
   шаблона `ci.yml` убран, а сценарии 2–3 нужны теперь не для доступа, а для
   публикации в npm (штатное обновление версии вместо git-ссылки);
2. **GitHub Packages (приватно)** — `@vernikr/size-report` + `registry` в
   `.npmrc`: настоящий менеджер зависимостей, обновление версии штатное;
3. **публичный npm** — если инструмент захочется показывать, требует **другого
   имени**: `size-report` в реестре занят чужим пакетом (запись 2017-01-12, три
   версии, последняя 1.0.2), поэтому под этим именем публикация невозможна, а
   набранное руками `npx size-report` в проекте без установленного пакета
   разрешается в чужой пакет из реестра (инструмент этого зова больше не
   советует — `REFACTOR.md` R-4.21). Требования к поставке, названные здесь: сам
   пакет закрытых зависимостей не тянет (`dependencies` пуст), а оба
   необязательные объявляют MIT (esbuild 0.28.2 и gpt-tokenizer 4.0.0 — сверено по
   манифестам 2026-09-15); за человеком остаётся одно: условия словарей BPE внутри
   `gpt-tokenizer`, потому что машиной они не читаются. Заодно с публикацией
   решается файл лицензии: поля `license: MIT` в манифесте для использования мало,
   а в тарболле лицензионного файла нет («`npm pack --dry-run`: 37 файлов, среди них
   `README.md`, `CHANGELOG.md`, `bin`, `src`, `templates` и ни одного лицензионного»).
   Чего `private: true` в манифесте **не** делает — не блокирует публикацию: npm
   проверяет это поле у пакетов-участников workspaces, а в односоставном репозитории
   такой проверки нет (проверено пробой: `npm publish --dry-run` идёт до конца и с
   `private: true`, и без него). Реально мешают две вещи, и обе проверяемы: имя
   (занято — выше) и отсутствие учётной записи в npm у того, кто публикует
   (`npm whoami` на этой машине: `ENEEDAUTH`). Отказ реестра на чужое имя без
   своей записи не показать — это правило реестра, а не наш опыт.

Локальная разработка — `pnpm link` или `--dir`-запуск из пакета по временной
фикстуре. Требование §5 (пакет, а не копия) выполняется всеми тремя.

### 8.5. CI пакета

✅ **Сделано 2026-09-14** (`.github/workflows/ci.yml`, `WORKLOG.md` §21). Один job,
по шагам: `pnpm install --frozen-lockfile`; `lint:strict`; `pnpm test:all`; тот же
набор с `GIT_CONFIG_GLOBAL=/dev/null` (без настроек машины вовсе); `pack:check`;
`parity:live` на истории потребителя; `check:standards` (пересъём обоих эталонов во
временный каталог и сверка с закоммиченным). Секретов не требует: история
потребителя лежит в репозитории бандлом на ревизии из эталона
(`fixtures/live/history.bundle`), а сам проект приватный и CI его не читает.

От плана отступили в трёх местах, и осознанно: матрицы по Node нет (пакет — ESM
без сборки, а чужие среды проверяются не версией Node, а окружением шага); сборки
`dist/app.js` на `prepack` нет, потому что `dist/` ещё не существует; вместо
прогона на публичном репозитории — бандл той же живой истории, чтобы не публиковать
чужие исходники ради дымового теста и обходиться без ключей.

---

## 9. Риски и как закрываем

| Риск | Чем грозит | Закрытие |
|---|---|---|
| Отчёт уходит из git — теряется контроль «артефакт ↔ история» | Ошибка в переносе состояния станет незаметной | `size check` (полнота + независимая сверка с `git cat-file -s`) + golden-фикстура; контроль перестаёт зависеть от наличия артефакта в истории |
| `esbuild` — бинарная зависимость | Не встал на платформе/офлайне → падение вместо отчёта | `optionalDependency`, динамический импорт, честная деградация с кодом `4` и пометкой у числа |
| Токенизаторы тяжёлые (словари, wasm) | Раздувание пакета и времени сборки | Не в `dependencies`; приближение вместо словаря там, где точность недостижима; предвычисленные семейства — по настройке |
| Точность токенов выдаётся за факт | Тихо неверные числа «веса для модели» | `accuracy` у метрики и подпись у числа; тест, что приближение помечено |
| Данные в `file://` и `localStorage` | Настройки просмотра не сохраняются или липнут к чужим данным | `reportId` + `try/catch` + запасной путь через `location.hash` |
| Интерактивная страница «потянет» библиотеку | Офлайн-открытие сломается, файл раздуется | Только ванильный JS, бандл собирается на публикации, тест на отсутствие внешних ссылок |
| Хук в чужом репозитории | Зацикливание, грязь в истории, конфликт с чужими хуками | Хук не коммитит; флаг окружения + lock-файл; `core.hooksPath` при чужих хуках; `hooks.enabled: false` |
| Огромные истории | Автообновление начнёт раздражать | Кэш на диске по `sha + датчик + version`, `maxBytes`, замер в `bench`, `measure --json` без рендера |
| Настройки git машины (`core.quotePath`, кодировки, локаль) | Числа верны на одной машине и неполны на другой — молча | Закрыто: закрепление на границе вызова git; сверка в четырёх чужих окружениях и на живом проекте в двух средах (`BLOCKERS.md` §B1) |
| `core.autocrlf` в выкладке файлов | Ложный отказ «перенос состояния пропустил правку»: на машинах с настройкой по умолчанию (Git для Windows) инструмент не работает | Закрыто: сверка сравнивает содержимое в обе стороны, свидетель — клон с CRLF (`BLOCKERS.md` §B2) |
| Миграция формата при обновлении | Настройки проекта ломаются молча | `schemaVersion`, `size init --migrate`, отказ с готовой командой |
| Два проекта-потребителя с разными версиями | Числа несравнимы | Версии датчиков и `toolVersion` в данных; в отчёте видно, чем считали |

---

## 10. Открытые вопросы (решаем до указанного шага)

| Вопрос | Предложение по умолчанию | До шага |
|---|---|---|
| Имя пакета и способ публикации (приватно/публично) | ✅ решено и **сделано** 2026-09-15: имя **`@vernikr/size-report`** (область владельца — имя `size-report` в реестре занято чужим пакетом), доступ **public**, установка и из реестра, и git-ссылкой; выпуски идут **тегом** из CI по удостоверению GitHub Actions — без секрета и без кода, издатель заведён `npm trust github` (выпуск `1.2.0` опубликован так, `WORKLOG.md` §57) | 1 |
| Точное место отчёта и данных на диске | `.size-report/report.html`, `.size-report/data.json`, кэш рядом | 2 |
| Формат машиночитаемых данных для агента | тот же JSON, что встроен в отчёт + `size measure --json` | 2 |
| Выбор минификатора разметки (HTML) | свой минимальный (комментарии + пробелы между тегами) | 3 |
| Порог `maxBytes` «слишком большой файл» | 1 МБ на файл, настраивается | 3 |
| Токенизаторы Claude и DeepSeek: словарь или приближение | OpenAI — словарь; остальные — приближение с пометкой, словарь добавляется, когда лёгкий | 4 |
| Считать токены для всех семейств сразу или для выбранного | ✅ решено 2026-09-14: только для выбранного в настройках — и потому словарь выбирается не на странице, а запуском (§4.8.4) | 4 |
| Границы категории «ресурсы» (файлы локализации) | всё, что в `assets: [.svg, .woff2, .json, .po, .arb]`, переопределяемо | 2 |
| Лицензия пакета | MIT (проверить словари токенизаторов) | 1 |
| Нужен ли job отчёта в CI проекта-потребителя | да, но отдельным job'ом с `fetch-depth: 0` и артефактом | 5 |

**Имя для реестра — что свободно.** Проверено запросом к реестру 2026-09-15 (23:13
UTC): заняты `size-report` (чужой пакет 2017 года, 1.0.2) и `size-table` (чужой, 0.2.0);
свободны — отвечают «не найден» — `sizereport`, `size-reporter`, `size-report-cli`,
`size-report-tool`, `size-table-cli`, `repo-size-report`, `code-size-report`,
`git-size-report`, `size-history`, `size-diff-report`; из области владельца свободны
`@vernikr/size-report`, `@vernikr/size-table`, `@vernikr/size`, `@vernikr/repo-size`,
но сама область требует логина `vernikr` в npm, и его занятость этим запросом не
проверяется (страница профиля закрыта для запроса) — это шаг владельца.
**Решение принято 2026-09-15: `@vernikr/size-report`** — владелец назвал область
свободной. Имя не путается с чужим пакетом того же смысла, а форма вызова почти не
меняется, потому что исполняемый файл называется `size`, а не именем пакета.
Выпуск-переименование — **1.1.1** (`CHANGELOG.md`); числа от него не меняются, но
имя инструмента входит в паспорт отчёта, поэтому сохранённый выбор читателя в
браузере один раз не подхватится (то же сказано в выпуске).

**Опубликовано 2026-09-15** (`WORKLOG.md` §53). Учётных данных на машине не было
вовсе (пустой файл настроек npm, `npm whoami` → `ENEEDAUTH`, ни токена в
окружении, ни записи в цепочке ключей), поэтому вход выполнил владелец, а у
аккаунта с security key вторую ступень умеет только браузерный путь:
`npm publish` из настоящего терминала (`tmux`) выдаёт ссылку
подтверждения вместо требования кода из приложения. Проверено как чужой: в пустом
каталоге вне репозитория `npm install` даёт 1.1.1, `pnpm add` — тоже,
`npx @vernikr/size-report --help` работает, а `size --init` → `--write` → `size`
собирает и сверяет отчёт на живом проекте с историей.

Отдельная ловушка самой проверки: реестр отдаёт пакет сразу, а вот его обычный
документ метаданных Cloudflare кэширует на 300 секунд по заголовку `Accept`,
поэтому первый запрос, сделанный через считаные секунды после отправки, записал
ответ «404» — и следующие пять минут `npm install` отвечал «нет в реестре», хотя
пакет уже был. Поэтому признак выкладки — `npm access get status` (`public`) и
анонимный запрос тарболла, а не первый попавшийся `npm view`.

Прежний вариант, если бы область оказалась занята, — **`size-report-cli`**:
свободен без условий, но остаётся соседом чужого `size-report`, а это и есть цена
путаницы — имя, набранное руками, в проекте без установленного пакета
разрешается в чужой пакет, а не в отказ (тексты инструмента имя больше не
называют — R-4.21).

**Что затронет переименование** — набор файлов у всех вариантов один и тот же,
различается только строка замены: имя в манифесте и выведенный из него путь в
подсказках (`node node_modules/size-report/bin/size.js` → тот же путь с новым именем).
Зов по имени пакета в текстах не встречается вовсе — ни старого, ни нового (R-4.21),
поэтому сам переезд имён текстов почти не трогает; у области владельца добавляется
отдельный шаг — зарегистрировать логин. Счёт ниже — вхождения строки `size-report`,
пересчитаны 2026-09-15 (в первой записи стояли 18, 49 и 124 — числа устарели на
коммитах после выпуска, потому что счёт — снимок, а не правило). Манифест: поле `name` —
и только оно, `bin` остаётся `size`. `src/` — 16 вхождений в семи файлах; решают
`src/tool.js` (имя в данных: из него собирается путь в советах и адрес установки),
`src/refusal.js` (строка справки), `src/cli.js` (имя файла страницы по умолчанию),
`src/page/app.js` (якорь ссылки и ключ памяти: имя входит в паспорт отчёта, поэтому у
отчёта, пересобранного после переименования, ключ будет другим и выбор читателя в
браузере не подхватится), `src/hook.js` (путь к движку в каталоге установки; место
состояния и метка хука — свои литералы, их можно оставить, чтобы уже поставленные хуки
узнавались и снимались). Команду починки этот список больше не называет: подсказка и
черновик собираются из пути к манифесту, а не из имени пакета (`REFACTOR.md` R-4.21).
Шаблоны — 14 вхождений, включая имена файлов `templates/size-report.config.json` и
`.github/workflows/size-report.yml`. Проверки и инструменты — 55 вхождений; с именем
работают `test/contract.test.js` (утверждает имя инструмента в данных),
`test/templates.test.js`, `test/docs-commands.test.js` и `tools/docs-facts.js` (список
разрешённых зовов). Документация — 136 вхождений в семи файлах, но править надо не
все: журнал и история — свидетели прошлого, меняется рабочая часть. **Потребитель:**
`package.json` не меняется (там git-ссылка на репозиторий, а репозиторий
переименовывать не нужно), а `pnpm-lock.yaml` — меняется: ключ пакета берётся из
манифеста, поэтому после переименования там нужен прогон установки, иначе CI на
замороженном локе не сойдётся.
**Что не меняется:** замороженные эталоны (их настройки задают команду починки явно,
имя в подписи не участвует) и опубликованный отчёт потребителя — в нём имя встречается
14 раз, но это темы коммитов в теле таблицы, а подпись своя (`pnpm run sizes` и
заголовок из настроек). Обратная сторона: у проекта, чьи настройки команду починки
не задают, в подпись идёт умолчание с именем пакета — там переименование сдвинет байты
отчёта, числа при этом те же.

**Цена бездействия.** git-ссылка работает сегодня и ничего не стоит: установка,
ключи не нужны, версия держится тегом. Не даёт она двух вещей — установки по имени
из реестра и штатного обновления версии. Третьего — подсказки, ведущей в чужой
пакет, — после R-4.21 нет: совет называет путь, а не имя; остаётся только имя,
набранное человеком вручную.

---

## 11. Что сознательно не делаем в v1

- Сжатый размер (gzip/brotli) — метрика `gzip` из текущего реестра **удаляется**.
- Жёсткие пороги, блокировки, уведомления — только показываем.
- Комментарий со сводкой в PR и публикация отчёта — только шаблон-заготовка.
- Централизованное управление многими проектами (архитектурно не исключено:
  ядро получает источник истории параметром).
- Поддержка платформ, кроме GitHub (переносимость заложена тонкой оболочкой).
- Токенизация в браузере (только предвычисленные числа).
- Второй язык реализации.

---

## 12. Порядок работ и оценка

| Шаг | Выпуск | Что в проекте | Объём (сессии) | Зависит от |
|---|---|---|---|---|
| 0. Паритет и фикстура | — | ничего | 0,5 | — |
| 1. Движок как есть | 0.1.0 | удаление `tools/`+`tests/size-table.js`, конфиг, scripts, доки | 2–3 | 0 |
| 2. Данные + интерактивный отчёт | 0.2.0 | отчёт из git, `check` вместо `test:sizes`, CI | 3–4 | 1 |
| 3. esbuild | 0.3.0 | ничего (числа меняются) | 1–2 | 2 |
| 4. Токены | 0.4.0 | ничего | 2 | 3 |
| 5. Интеграция (check/doctor/hook/шаблоны) | 0.5.0 | job CI (блок в `AGENTS.md` отменён: требования его не просят) | 2 | 2 |
| 6. Полировка, перф, доки | 1.0.0 — ✅ **выпущен 2026-09-14** | версия, `CHANGELOG.md`, тег | 2 | 5 |

Критический путь — шаг 1 → 2; дальше шаги 3 и 5 независимы (минификация и
интеграция), их можно менять местами по обстоятельствам.

---

## 13. Чек-листы

### Приёмка любого шага

- [ ] Тесты пакета зелёные, golden сравнивается побайтово; сторож документации
      (`test/docs-*.test.js`) молчит — он падает вместе с документом, а не по желанию.
- [ ] Повторный прогон даёт те же данные и отчёт (детерминизм).
- [ ] Полный прогон по истории safe-resets не дольше предыдущего шага (или в
      CHANGELOG объяснено, почему дольше).
- [ ] `docs/ROADMAP.md` и `WORKLOG.md` проекта отражают изменение, доки
      потребителя (`README`, `AGENTS.md`, `docs/TESTING.md`) актуализированы.
- [ ] В проекте-потребителе нет ссылок на удалённые файлы: `rg 'size-table'
      --glob '!docs/archive/**'` и `rg 'test:sizes'` чисты.

### Удаление инструмента из проекта-потребителя (шаг 1–2)

- [ ] `tools/size-table.js`, `tests/size-table.js` удалены.
- [ ] `package.json`: `sizes`/`test:sizes` переписаны, `test:all` не зовёт
      удалённые наборы.
- [ ] `tests/harness.js`: шаги таблицы убраны из `STEPS`, входной список снятого
      прогона и `HEAD_INPUT` не упоминают размеры.
- [ ] `tests/doc-sync.js`: `runCounts('tests/size-table.js')` убран вместе со
      счётчиками в `docs/TESTING.md`.
- [ ] `docs/TESTING.md`: разделы `tools/size-table.js` и `tests/size-table.js`
      заменены ссылкой на инструмент.
- [ ] `AGENTS.md`: §0, §2, §4, §5 — команды и правила про отчёт.
- [ ] `README.md`: раздел «Объём кода».
- [ ] `docs/ROADMAP.md`: §54–§56 помечены переехавшими; §33–§35 остаются историей.
- [ ] `.github/workflows/ci.yml`: шаг и комментарий про `test:sizes`.
- [ ] `.gitignore`: `.size-report/`; `docs/size-table.html` удалён из индекса.
- [ ] `docs/size-table.html` больше не правится руками и не коммитится.

### Готовность релиза пакета

- [x] `npm pack` не тащит лишнего (`files`; `pnpm run pack:check` — обе стороны
      списка). `dist/app.js` не собирается: программа страницы вклеивается в неё
      при сборке отчёта (`src/page/build.js`), пре-собранный файл был бы второй
      копией того же.
- [x] README проверен на «человеке без контекста»: установка → init → отчёт
      (инструкция прогнана покомандно в свежем проекте, `WORKLOG.md` §16–§18).
- [x] Все коды выхода описаны (`README.md`, таблица кодов) и проверены тестом
      (`test/cli.test.js`, `test/doctor.test.js`, `test/check.test.js`).
- [x] Сообщения об ошибках содержат команду починки (реестр причин,
      `src/refusal.js`; сверяется `test/docs-commands.test.js`).
- [x] `CHANGELOG.md` с описанием «что изменится в числах и почему» — замер
      сверяется с живым прогоном (`test/changelog.test.js`).

---

## 14. Ссылки

- `docs/requirements.md` — что требуется от продукта (§3 метрики, §4 полнота,
  §6 отчёт вне git, §7 автообновление, §11–§13 нефункциональные и сценарий).
- `docs/module-design.md` — как устроен модуль (§2 инварианты, §3 данные против
  отображения, §4 структура, §6 формат данных, §7 метрики, §8 отчёт, §15 план).
- `../figma/safe-resets/docs/ROADMAP.md` §33–§35 (история таблицы, зонды и цифры),
  §54–§56 (три отложенные работы, уезжают в пакет).
- `../figma/safe-resets/docs/TESTING.md` §`tools/size-table.js`, §`tests/size-table.js` —
  легенда механики, которую переносим в документацию пакета.
- `../figma/safe-resets/AGENTS.md` §2, §4, §5 — грабли git/Figma-окружения, из которых
  выведены инварианты §3 этого плана.
- `BLOCKERS.md` — блокеры и известные пробелы (открытых сейчас нет: §B1, §B2 и §B3
  закрыты; границы и заметки — там же).

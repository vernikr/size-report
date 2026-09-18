# The module's design: volume accounting as a package of its own

What binds in the extraction of the tool out of a consumer project into a package of its own: the
boundary, the invariants, the split between data and display and the shape of each part. What the product
must be is in `docs/requirements.md`; the steps of the move are in the journal (`worklog/`,
`plans/archive/PLAN.md`), and how the code stands today is in `docs/architecture.md` and `docs/files.md`.

## 0. The decision in short

- **The package owns the mechanics**: the git history, the measuring, the minifier, the dictionary, the
  report's program, the format of the settings, the templates, the tests. The consumer project owns its
  files and, optionally, its settings.
- **Data and display are split**: the engine emits absolute values as data, and the report is a small
  program that draws the table and recounts the sums from them in the browser — the same layer an agent
  reads (`--data`) instead of the picture.
- **Measuring is modular**: raw size, the size without ballast and tokens are interchangeable **sensors**
  of a registry, the settings choose from it, and a new sensor is an entry rather than an edit to the core.
  A sensor that lost an optional dependency is reported as degraded (exit code 4) instead of passing an
  approximation off as an exact number.
- **Files are found, with a hand on the wheel**: the engine sorts the tracked files into categories, the
  page offers the tree with checkboxes and per-category buttons, and what is switched off leaves the table
  and the sum; a file that cannot be a column is excluded with a stated reason.
- **The report enters no commit by itself**: it is built locally, opens by double-click, and refreshes
  after every commit and merge with no loop possible by construction. Whether the file is tracked by git is
  the project's decision.

## 1. The boundary: what stays in the project, what the package owns

| Stays in the project | Comes from the package |
|---|---|
| The project's own files — they are the **input** of the measure | All the measuring code: the history, the metrics, the minifier, the dictionary, the report's program |
| The settings file (`size-table.config.json`) — optional: with none the profile is derived from the project | The derivation of that profile, `--init` which pins it, and the check the file passes |
| The calls in the project's scripts and the dependency line in its manifest | The templates: a draft of settings, a CI description, a note for the consumer |
| A line in `.gitignore`, or the report getting tracked | The tests — they live here and travel in no package |

**The principle:** the mechanics is never copied into the project, which knows three things about the
package: the dependency, the optional settings file and the call.

## 2. The invariants that move unchanged

1. **The source of truth is git.** Sizes come from the versions fixed in the history rather than from the
   working directory, so the report does not depend on what an editor has open; a tree that differs from
   the history is a finding rather than a source of numbers.
2. **Every rebuild goes over the whole history** instead of appending, which makes the report self-healing
   and idempotent.
3. **Reading is batched**: git is asked for the history in one pass and blobs in chunks rather than by a
   call per file, and the raw size comes from the object's header without reading the content.
4. **The same content is measured once**: the cache is per run, keyed by the blob's sha, and nothing is
   kept between runs.
5. **A commit's row cannot describe that commit**: a commit that changed only the report gets no row (the
   row would be a self-reference), and neither does one that moved no number.
6. **The history's completeness**: on a truncated clone the tool does not quietly build a short table — it
   refuses (exit code 3) and names the fix (`git fetch --unshallow`, `fetch-depth: 0` in CI).

## 3. The key shift: data and display are separated

The old generator froze the table, the sums and the deltas into HTML at build time; switches, a file tree
and a sum recounted on the fly mean those are counted at view time. Hence: the **engine** emits *absolute*
values per file and per point of history and counts no total over a chosen set (the totals in its own text
answer are the state at `HEAD`, a fixed view), while the **report** carries the data and a program that
draws the table and the tree and recounts the sums from what the reader switched on.

Any future view — filters, groupings — is therefore an edit to the report's program, while the engine stays
stable.

## 4. The package's structure

One package, no inner packages: a flat `src/` with one subject per file (the call and its modes, the
settings and their derivation, the git border and the history, the sensors and the stripping, the page's
contract and its program, the commands — `docs/files.md` maps them), plus three folders:

```text
bin/         the command the package installs, and the postinstall that offers the hook
templates/   size-report.config.json, README.md, ci.yml — what lands in a consumer project
test/        the checks of this repository; they do not travel in the package
```

**The boundary principle:** the core — git and measuring — knows nothing about a concrete project and reads
git through one module with its settings pinned (`src/git.js`); that pinning, rather than an injectable
"history source", is what makes a number the same on any machine. The checks get their speed by building a
real repository in a temporary directory (`tools/synthetic/`, `fixtures/`), and git is the only source the
core has.

## 5. Files and categories

### 5.1. Discovery

The engine takes the paths git reports as tracked and drops what cannot be a column, naming each in the
report's catalogue with the reason it stands there: the report itself, dependency locks, built output, an
extension the engine does not know, and a file above the size threshold — the guard against generated
files. With no settings file the profile is derived from the project, and `--init` pins the derived one.

### 5.2. Classification by category

Every file falls into exactly one category, and the categories are what the page's quick buttons are made
of. A column may name its category in the settings — then the table is not consulted at all:

| Category | What belongs to it |
|---|---|
| **code** | everything else — the product's sources |
| **tests** | read off the path rather than the extension: a `test`, `tests` or `fixtures` folder anywhere in the path, or `.test` before the extension |
| **docs** | `.md`, `.markdown`, `.rst`, `.txt`, `.adoc` — descriptions, plans, journals |
| **chore** | `.json`, `.yaml`, `.yml`, `.toml`, `.ini`, `.cfg`, `.conf`, `.lock`, `.editorconfig` — settings, infrastructure |
| **assets** | `.svg`, images, fonts — static material |

### 5.3. Completeness and a hand on the wheel

**No change goes unnoticed**: a commit that touched a path the engine does not track and the settings do
not declare an exception is a violation, never a silent skip. A person can still add or drop any file by
hand — in the settings for good, on the page for the length of a look.

## 6. The canonical data

`--data` hands over the contract the page itself is built on; `--json` is the former shape, frozen by the
parity reference. The keys:

| Key | What it holds |
|---|---|
| `schema` | the contract's version |
| `tool` | the package's name and version |
| `report` | the passport: locale, title, heading, the artifact's path, the fix command, the journal, whether the sha is shown |
| `metrics[]` | per metric: `key`, `label`, `note`, `method` |
| `categories[]` | the categories present, with their labels |
| `files[]` | per column: `label`, `path`, the chain of renames `paths`, `category` and how it was decided (`categoryBy`) |
| `catalog[]` | every path of the project tree outside the report, with the reason it is not a column |
| `rows[]` | per commit: `sha`, `when`, `subject`, the journal's `section`, the commit's `href`, and `values` — one object per column with the absolute numbers |
| `now` | the state at `HEAD` |
| `last` | which cells the newest commit touched (a fact of the history; the page does not read it) |
| `skipped[]` | the commits that got no row, each with the reason in words |

Absolute values rather than deltas — a difference is the display's task and depends on what the reader
switched on — and no compression into "points of change": every row carries a number per column, and the
page reads the ones it needs. `method` and `note` are the promised mark of information: beside the number
it is visible how it was obtained, and which formats that way does not take. **Nothing is marked on a
cell**: the division into exact and approximate is not in the package, and the reader sees where a number
came from rather than a mark that judges it. The report's own block is this data in **sparse** form
(changes rather than a snapshot per commit), which the page's payload chapter unrolls back into exactly
the contract.

## 7. The metrics: minification and tokenization

### 7.1. The sensor's interface

A sensor is an entry of the registry declaring what it needs (the size of a version of a file, or its
content), how the number is counted, the human-readable `method` — with the tool's version inside where
there is one, and the formats that way does not take — and a `note` where the way needs one. The registry
holds four, `gzip` among them: the settings' default is `raw` and `min`, the derived profile adds `tok`.

### 7.2. `raw` — the raw size

The file as it is, taken from the size of the git object: the content is not read, which makes it the
cheapest metric.

### 7.3. `min` — the size without ballast

Not minification by default but a cosmetic removal of comments and indentation (names are not shortened),
and the metric **says which way it used**:

- **stripping** — comments and indentation go, names stay; for JavaScript the result has to parse, or the
  guard refuses rather than hand over a count of something that is no longer the same program;
- **real compression by esbuild**, switched on per extension: called as a library rather than as an
  external command, with one service process for the whole run; its loaders are JS, TS and CSS, so HTML
  goes through stripping and the method says so;
- **formats without a minifier** are stripped the same way — but they have to say so, which keeps a
  simplification from passing as real compression.

Minification is counted **per file** (files are never bundled into one): what is measured is the size of a
source.

### 7.4. `tok` — tokens with the model family chosen

Tokens are counted **by the source text** — what a model really reads — and not by the minified one. The
family and the encoding are chosen in the settings (`tokens.family`, `tokens.encoding`), and the encoding
is part of the number, which is why the method quotes the one that produced it. One family is wired:
`openai` (`o200k_base`, `cl100k_base`); without its dictionary the count is an estimate by length with the
coefficient named in `method`, and formats without text (a picture, a font) go by bytes.

The family is chosen in the settings rather than on the page because tokenization happens **at build
time**: the report stays self-contained and carries no dictionary, while precomputing every family would
pay build time for numbers nobody may ask about. Adding a family is adding an entry to the registry.
esbuild and the dictionaries are **optional** dependencies: without them the count falls back, `method`
names the way actually used and the lost sensor is reported (exit code 4), while `raw` works always.

## 8. The report: the interactive page

### 8.1. The file

One self-contained file: the styles, a mount point, the data, the printed words and the program, with no
external libraries, so it works offline. The program is assembled from the package's own chapters with the
module syntax stripped out, and the words travel as a block of their own — which is why the report reads in
the language of the run rather than in the browser's.

### 8.2. The controls

1. **Metric switches** — which numbers the table shows; each metric goes on and off on its own.
2. **The panel is the file tree** — the project's real folder structure, a checkbox per file; an unchecked
   file leaves the table **and the sum**, and a file outside the report keeps its place with a disabled
   checkbox and the reason in its tooltip.
3. **Buttons by category** — all files of a category at once; a button works the tree's checkboxes, never
   the data itself.
4. **No switch of the model family**: the page receives ready numbers and counts nothing itself, so the
   choice lives in the settings and the page **names** it — the method of each metric stands under the
   switches in words.

### 8.3. How the recount works

The total and the deltas are always counted over the current choice (files on × metrics on). A file's delta
is the difference between its value in a row and in the previous one, and it comes from one shared
calculation rather than from the row's own code — two ways of counting one row would be two answers.
Switching a file or a category off recounts the total, the deltas and the "now" row at once, in the
browser, with no second look at git.

### 8.4. The memory of the view

The reader's choice is remembered **in the browser** between openings, in one record keyed by the report's
passport — the tool's name, the schema, the artifact's path, the title and the column labels in the
report's order — so a choice made in someone else's report is not picked up. The tool's version and the top
of the history are absent from the passport on purpose: updating the tool does not change what a column
means, while a grown history is the very report the reader comes back to. What is written down is what is
switched **off**, by name, and a record with nothing to say is removed. These are view settings: they touch
neither the settings file nor git, and while a choice once carried in the address is still read, the page
writes nothing into the address bar.

## 9. The module's settings

The only thing the project knows about the package. The file is `size-table.config.json` in the project's
root — and a project may have none: with no file the settings are derived from the project, and `--init`
pins the derived ones. The draft in the package (`templates/size-report.config.json`) is a sample for a
hand-written file, not what `--init` writes. What the file must satisfy is checked in the code: a value
that does not fit is a refusal naming the file and the fix (a schema for an editor and a migration of an
older file did not become code — `BLOCKERS.md` §N17).

| Section | What it sets |
|---|---|
| what to watch | `columns` — a label and a column's chain of paths — and `skip`, the declared exceptions |
| categories | a column may name its category; otherwise the extension table decides (§5.2) |
| metrics | `metrics` — which sensors are counted: `raw`, `min`, `tok`, `gzip`; the default is `raw` and `min` |
| minification | `minify.engine` (stripping or esbuild), `minify.ext` per extension, `minify.guard` |
| tokens | `tokens.family`, `tokens.encoding` |
| the report | `output`, `title`, `heading`, `locale`, `fixCommand` |
| the journal | `journal` — optionally, tying commits to sections of the project's journal |
| the rest | `hooks.enabled`, `links.commitUrl`, `rows.merges`, `rows.sha` |

## 10. Performance and the cache

- The **raw size** needs no reading of the content; minification and tokenization need it and cost more.
- Minified and counted content is cached by the **blob's sha** — how git addresses a version — so identical
  versions are never counted twice (a rollback, a repeated merge, a file unchanged through many commits).
  The cache lives for one run and has no version key: the way a number was obtained is named in `method`.
- The minifier keeps one service process per run and the module parser behind the stripping guard one
  worker per run: both remove the price of a process per cell.
- There is **no on-disk cache**: the price of a rebuild is one pass over the history.

## 11. Refreshing the report

- The report is refreshed **after every commit and every merge** by the hooks (`post-commit`,
  `post-merge`), installed by the package's own installation and by the first run in a project; where the
  silent path stays quiet the explicit command names the cause, and `uninstall-hook` returns the project to
  its previous behaviour.
- **A loop is impossible by construction**: the report's commit is assembled with git's plumbing
  (`commit-tree`), which calls no hooks at all, and the report's own path gets no row — the same rebuild
  produces the same bytes. A lock covers two hooks running at once.
- Where the report is tracked by git, the hook commits it **as a commit of its own**: the tree comes from
  `HEAD` with exactly the report's path replaced, so neither the index nor anyone's uncommitted work can
  enter the commit. Where it is untracked, a rebuild leaves the history alone.
- The automation can be switched off: `"hooks": {"enabled": false}`, `SIZE_REPORT_NO_HOOK` (CI is such an
  environment by itself), or `uninstall-hook` — after which the report is rebuilt by an explicit command.

## 12. The module's commands (the surface for a person and an agent)

```text
(no command)         check that the report matches the history
check [--json]       completeness: the settings, the history, the paths, the sensors
explain <commit>     why a commit has no row (a revision name, a sha or its start)
doctor [--json]      one answer: the environment, the dependencies, the settings, coverage
install-hook         put the post-commit and post-merge hooks in place
uninstall-hook       take the hook and its state away
hook-run             what the hook calls: a rebuild and the report's commit
```

Modes: `--init [file]` (pin the settings), `--write [file]` (assemble the report), `--data` (the data
contract on stdout) and `--json` (the former shape). One run carries either a command or a mode and never
both; `--json` is an answer's format rather than a mode — an answer exists for exactly four calls, and
anywhere else it is a refusal rather than silence.

## 13. Talking to AI agents

- The data as JSON: an agent reads numbers rather than markup (`--data`, `--json`).
- Clear exit codes (0 all is well · 1 a violation · 2 the call, the settings or the environment · 3 an
  incomplete history · 4 a lost sensor · 5 an internal error), so that an agent branches by the code rather
  than by the text of a message.
- A refusal carries a **ready fix command** as its last line.
- The package does **not** write into the project's own files: it edits no ignore list and refuses to touch
  a hook that is not ours; what it carries instead is a note for the project's own instructions
  (`templates/README.md`), to be put where the project wants it.
- `size doctor` gives an agent in one call the answers it would otherwise look for.

## 14. Testing

The package carries none of its tests into a project; they live and run in this repository. A synthetic
history — a small temporary repository with a given history (commits, renames, merges, removals) built in
the checks — lets the whole engine be checked quickly and with no real project, while **reference results**
for fixed inputs catch any quiet change. The traps are non-English file names, line endings, binary files,
comments that look like division, merges and a truncated history; the minifier and the tokens are checked
for the things their honesty rests on — that renaming really happens, that an unparsable file is a refusal,
that a format without a minifier is named as stripped, that a lost optional dependency falls back and says
so (exit code 4), that the dictionary asked for is the one used, and that a foreign family or encoding is a
refusal.

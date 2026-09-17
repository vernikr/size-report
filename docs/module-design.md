# The module's design: volume accounting as a package of its own

> Written when the tool was carved out of the Figma plugin project into a package of its own
> (`@vernikr/size-report`; the working name of this document, **size-report**, is the one that stuck).
> The move is done — what still binds are the architecture (§0, §3) and the invariants (§2), while the
> steps belong to the journal. Three requirements came with the move and are in the module today:
>
> - real minification (names shortened to one or two characters, by esbuild);
> - tokens close to reality, with the model family chosen;
> - an interactive page: metric switches (raw/min/tok), a panel with the file tree and checkboxes,
>   quick buttons by category (docs / chore / assets); what is switched off is out of the sum.

---

## 0. The decision in short

1. **What leaves.** The whole engine — reading the git history, measuring, minifying, counting tokens,
   building the report — becomes **a package of its own** that knows nothing about a concrete project. The
   project keeps the **settings file** — and may keep none at all: with no file the settings are derived
   from the project itself, and `--init` writes the derived ones out.
2. **The architectural shift.** A report used to be static HTML with the table already baked in. The new
   requirements (switches, a file tree, checkboxes) make it **interactive**, so the engine stops drawing the
   table and starts emitting **data**, while the report becomes a small program that draws the table itself,
   in the browser, over the data embedded in it. The same layer is printable (`--data`): that is what an
   agent reads instead of the picture.
3. **Measuring becomes modular.** Raw size, the size without ballast and tokens are interchangeable
   **sensors**, each with its own innards (the minifier esbuild where real compression is wanted; a tokenizer
   per model family). The registry holds four of them — `raw`, `min`, `tok` and `gzip` — the settings choose
   from the registry, and a new sensor is an entry in it rather than an edit to the core. A sensor that has
   lost an optional dependency is reported as degraded (exit code 4) instead of passing an approximation off
   as an exact number.
4. **Files are found, but a person can intervene.** The engine finds the project's files itself and sorts
   them into four categories (`code`, `docs`, `chore`, `assets`); the page offers the tree with checkboxes
   and quick buttons by category. What is switched off is out of the table and out of the sum, and a file
   that cannot be a column is excluded with a stated reason.
5. **The report enters no commit by itself.** It is built locally and opens by double-click without a
   server, and it refreshes after every commit and merge with no loop possible by construction. Whether the
   file is tracked by git is the project's decision: untracked, a rebuild leaves the history alone;
   tracked, the hook commits it as a commit of its own.

---

## 1. The boundary: what stays in the project, what leaves for the module

A hard boundary is drawn between the product (the Figma plugin) and the tool (volume accounting), which used
to be interwoven: the tool lay inside the project as one file and knew its files by name.

| Stays in the project | Leaves for the module |
|---|---|
| The product's files: the plugin's sources, interface markup, manifest, documentation — they are the **input** of the measure | All the measuring code: reading the git history, the metrics, the minifier, the tokenizer |
| The module's **settings file** (which files to watch, which categories, which model family, where to write the report) — optional, since with none the settings are derived from the project | Building the report (the interactive page) |
| A couple of lines in the project's description (the calls) | The module's tests: they live and run in the module's own repository, are not copied into the project and do not travel in the package |
| A line in `.gitignore`, or the report getting tracked | The settings draft, the note for a consumer, the CI description (the three files of `templates/`) |

**The principle:** the mechanics is never copied into the project. The project knows three things about the
module: the dependency in its package list, the optional settings file, and the call.

---

## 2. The invariants that move unchanged

The implementation holds decisions that need no review — they move as the module's contract:

1. **The source of truth is git.** Sizes come from the versions fixed in the history rather than from the
   working directory, so the report does not depend on what an editor has open. A working tree that differs
   from the history is a finding rather than a source of numbers.
2. **Every rebuild goes over the whole history instead of appending.** The report is always assembled anew —
   which makes it self-healing and idempotent.
3. **Reading is batched.** One run on a three-commit history makes ten git calls (`log`, `ls-files`,
   `ls-tree`, two `rev-parse`, three `cat-file`, `hash-object`, `status`) — and the same ten for three files
   as for ninety, measured: the count does not grow with the number of files. The raw size comes from the
   object's header, without reading the content.
4. **The same content is measured once.** The cache is per run and keyed by the blob's sha: identical
   requests and identical blobs are asked for once, and nothing is kept between runs.
5. **A commit's row cannot describe that commit.** A commit that changed only the report gets no row (the row
   would be a self-reference), and neither does a commit that moved no number.
6. **The history's completeness.** On a truncated clone the module must not quietly build a short table: it
   refuses (exit code 3) and names the fix (`git fetch --unshallow`, or `fetch-depth: 0` in CI).

---

## 3. The key shift: data and display are separated

The old generator assembled ready HTML: the table, the sums and the deltas were counted at build time and
froze in the file. The new requirements (metric switches, file checkboxes, a sum recounted on the fly) mean
that **sums and deltas are counted at view time** — which is where the split comes from:

```
        ENGINE (build time)                  REPORT (view time)
  ┌──────────────────────────┐      ┌──────────────────────────┐
  │ the git history          │      │ the interactive page     │
  │   ↓                      │      │ (data + program)         │
  │ files and categories     │      │                          │
  │   ↓                      │      │ · file tree + checkboxes │
  │ measures (raw/min/tok)   │─────▶│ · metric switches        │
  │   ↓                      │      │ · the sum recounted live │
  │ data (JSON)              │      │ · deltas and "now"       │
  └──────────────────────────┘      └──────────────────────────┘
```

- **The engine** emits *absolute* values per file and per point of history: it does not decide what to show
  and does not count a total over a chosen set. The totals named in its own text answer (the state at
  `HEAD`) are a fixed view rather than a sum over a choice.
- **The report** is one self-contained file: inside lie the data (JSON) and a small program that draws the
  table and the tree, and recounts the sums from what the reader switched on.

The gain: any future view setting (new filters, groupings) is an edit to the report's program rather than to
the engine, which stays stable.

---

## 4. The module's structure (files and folders)

One package, no inner packages. What came out is flatter than the first sketch: a folder per layer did not
happen, and the two seams that turned out to be real are stripping and the page's program.

```text
@vernikr/size-report/
├── bin/          size.js — the entry point from a terminal; postinstall.js — installing the hook
├── src/          flat, one subject per file:
│                   cli.js, args.js, modes.js     reading the call, its plan, what each mode does
│                   config.js, project.js         settings: reading and checking / deriving from the project
│                   refusal.js, locales.js        exit codes and causes / the printed words
│                   git.js, history.js, journal.js  reads with pinned settings / walking the history / the journal's sections
│                   metrics.js, strip.js, strip/, minify.js, tokens.js  the sensors and the ways to count
│                   data.js, derived.js           the page's contract / the derived text (totals, the state at HEAD)
│                   artifact.js, css.js, table.css, page/  assembling the one file, styling, the program
│                   check.js, explain.js, doctor.js, init.js, hook.js  the commands
│                   tool.js, size-table.js, optional.js, parse.js, parse-worker.js  the package's identity, the help, the lazy loading, the parser behind the stripping guard
├── templates/    size-report.config.json, README.md, ci.yml — what lands in a consumer project
└── test/         the checks of this repository (they do not travel in the package)
```

The boundary principle: **the core — git and measuring — knows nothing about a concrete project, and it reads
git through one module with its settings pinned** (`src/git.js`); that pinning, rather than an injectable
automation source, is what makes a number the same on any machine. The sketch's other idea — handing the core a
"history source" as a parameter so that it could run on a synthetic one — did not become code: the checks get
their speed from building a real repository in a temporary directory (`tools/synthetic/`, `fixtures/`), and git
is the only source the core has.

---

## 5. Files and categories (discovery and classification)

### 5.1. Discovery

The engine finds the project's files itself: the paths git reports as tracked, minus what cannot be a column.
Nothing is listed by hand. What is left out is excluded by rule and named in the report's catalog with the
reason it stands there: the report itself, dependency locks, built output, an extension the engine does not
know, and a file over the size threshold (512 KB — the guard against generated files). With no settings file
the profile is derived from the project itself, and `--init` pins the derived one.

### 5.2. Classification by category

Every file falls into exactly one category, and the categories are what the quick buttons on the page are made
of. The set of names is fixed to four, what an extension means is a table the settings may overrule:

| Category | Default extensions | What it stands for |
|---|---|---|
| **docs** | `.md`, `.markdown`, `.rst`, `.txt`, `.adoc` | descriptions, plans, journals |
| **chore** | `.json`, `.yaml`, `.yml`, `.toml`, `.ini`, `.cfg`, `.conf`, `.lock`, `.editorconfig` | settings, infrastructure |
| **assets** | `.svg`, images, fonts | static material |
| **code** | everything else | the product's sources |

A column may name its category in the settings, and then the extension table is not consulted at all; otherwise
the extension decides and an extension the table does not know is `code`.

### 5.3. Completeness and a hand on the wheel

- The engine guarantees that **no change goes unnoticed**: a commit that touched a path the engine does not
track and the settings do not declare an exception is a violation (an explicit failure), never a silent skip.
- A person can still **add or drop any file by hand** — in the settings for good, on the page for the length of
  a look.

---

## 6. The canonical data (what exactly the engine hands over)

The engine hands over one structure — the source of truth from which both the report and an agent's output are
built. The keys of the contract (`--data` hands over the contract itself, `--json` the former shape):

| Key | What it holds |
|---|---|
| `schema` | the contract's version |
| `tool` | the package's name and version |
| `report` | the passport: locale, title, heading, the artifact's path, the fix command, the journal, whether the sha is shown |
| `metrics[]` | per metric: `key`, `label`, `note`, `method` |
| `categories[]` | the categories that are present, with their labels |
| `files[]` | per column: `label`, `path`, the chain of renames `paths`, `category` and how it was decided (`categoryBy`) |
| `catalog[]` | every path outside the report with the reason it is not a column (`why`: a rule, a declared exception, or null for a column) |
| `rows[]` | per commit: `sha`, `when`, `subject`, the journal's `section` or null, the commit's `href`, and `values` — one object per column with the absolute numbers |
| `now`, `last` | the state at `HEAD`, and which cells are the last change of their column |
| `skipped[]` | the commits that got no row, each with the reason in words |

Notes:

- **Absolute values rather than deltas.** The engine keeps sizes, not differences: a difference is the display's
task, and it depends on which files the reader switched on. There is no compression into "points of change"
either: every row carries a number per column, and the page reads the ones it needs.
- **`method` and `note`** are the promised mark of information: beside every number it is visible *how* it was
  obtained — which minifier version, which tokenizer, and which formats that way does not take.
- **Nothing is marked on a cell.** The division of numbers into exact and approximate is not in the package: a
  metric describes the way its column was counted (`method`), naming the formats the way does not take, so the
  reader sees where a number comes from rather than a mark that judges it. The page derives nothing of its own
  from paths and formats: the way is named in one place, and that place is the engine.

An agent reads the same data through the "hand over the data" mode rather than parsing the layout.

---

## 7. The metrics: minification and tokenization

### 7.1. The sensor's interface

A sensor is an entry of the registry declaring:

- what it needs (only the size of a version of the file, or its content);
- how the number is counted;
- the human-readable way it was obtained (`method`, with the tool's version inside where there is one — esbuild,
  the tokenizer — and the formats that way does not take), which is what makes the number reproducible and what
  tells two counts in one column apart;
- a `note` for the reader where the way needs one.

The first version's set is three of them (`raw`, `min`, `tok`); the registry holds a fourth, `gzip`, which the
settings may switch on — a sensor is an entry rather than an edit to the core.

### 7.2. `raw` — the raw size

The file as it is. Taken from the size of the git object: the content is not read, which makes it the cheapest
metric.

### 7.3. `min` — the size without ballast

The first version's "minified" size is not minification but a cosmetic removal of comments and indentation
(names are not shortened), so the metric is counted in two ways and **says which one it used**:

- **the default is stripping** — comments and indentation go, names stay. For JavaScript the stripping is
  guarded: the result has to parse, or the guard refuses rather than hand over a count of something that is no
  longer the same program.
- **real compression by esbuild** is switched on in the settings per extension: the library is called through
  its JS API (`transformSync`, `minify: true`, UTF-8, no legal comments), which keeps one service process for
  the whole run instead of paying for a start per cell. Its loaders are `js`, `ts` and `css`; there is **no
  markup minifier**, so HTML goes through stripping, and the metric says so in `method`.
- An unfamiliar format is stripped the same way — **but it has to say so**: the word goes into `method` and
  stands beside the number on the page, which is what keeps a simplification from passing as real compression
  (§6, §7.1).

Consequences:

- esbuild and the tokenizers are **optional** dependencies of the package. The engine stays usable without them:
  the count falls back to stripping and the lost sensor is reported (exit code 4), and `method` names the way
  actually used, so a fallback cannot pass for real compression; `raw` works always.
- Minification is counted **per file** (files are never bundled into one): what is measured is the size of a
  source.
- The minifier's settings (`minify.engine`, `minify.ext`, `minify.guard`) are part of what a number means, and
  the engine's version is named in `method`.

### 7.4. `tok` — tokens with the model family chosen

Tokens are counted **by the source text** — what a model really reads — and not by the minified one. The family
is chosen in the settings (`tokens.family`, `tokens.encoding`); one family is wired today:

| Family | How it is counted | How honest the number is |
|---|---|---|
| **openai** (`gpt-tokenizer`, `o200k_base` / `cl100k_base`) | by the tool's dictionary | exact |
| without the dictionary | an estimate by length (about 3 characters per token, measured on this repository's own texts) | **approximate** (marked), and for Latin script it overstates |
| binary formats (a picture, a font) | counted by bytes, since a tokenizer would split them into anything at all | **approximate** (marked) |

The position is the load-bearing part: **the tool must not pass an approximation off as an exact number.** Every
count carries its level of trust beside the number, just as the way of minification does.

Adding a family is adding an entry to the registry, which is why the settings name a family rather than a flag.
The family is chosen in the settings rather than on the page: tokenization happens **at build time**, so the
report stays self-contained (it opens by double-click, with no network and no heavy program inside). The
alternative — a tokenizer inside the page, counting in the browser — is possible, but would inflate the report
with a dictionary and complicate it; deferred.

---

## 8. The report: the interactive page

### 8.1. The report's file

The report is **one file** that opens by double-click, with no server. Inside, four parts are assembled into one:

```html
<!doctype html>
<html lang="ru">
<head> …the styles… </head>
<body>
  <div id="app"></div>                                                <!-- everything is drawn here -->
  <script type="application/json" id="data">…the data (§6)…</script>   <!-- the data -->
  <script type="application/json" id="ui">…the printed words…</script> <!-- the words -->
  <script>…the page's program…</script>                               <!-- the behaviour -->
</body>
</html>
```

The program is a small script assembled from the package's own chapters, with no external libraries (so that it
works offline) and with module syntax already stripped: the build takes out the `import` lines and the `export`
keywords. The printed words travel as a block of their own (`id="ui"`), which is why the report reads in the
language of the run rather than in the browser's.

### 8.2. The controls (what the user asked for)

1. **Metric switches** — which numbers the table shows: the raw size, tokens, the size without ballast. Each
   metric goes on and off on its own, and the columns follow.
2. **The panel is the file tree** — the project's real folder structure, a checkbox per file. An unchecked file
   leaves the table **and the sum**.
3. **Quick buttons by category** — all files of a category at once: docs, chore, assets (and code). A button
   works the tree's checkboxes, never the data itself.
4. ~~**A switch of the model family** for the token metric (among the precomputed ones).~~ ❌ **Cancelled
   2026-09-14** (`PLAN.md` §4.8.4, step 4): the page receives ready numbers and counts nothing itself, and a
   dictionary of another family is not something it could apply; precomputing every family would pay build time
   for numbers nobody may ask about. The choice lives in the settings (`tokens.family`, `tokens.encoding`), while
   the page **names** it: the way each metric was obtained stands under the switches in words, and beside the
   number — whether it is exact or an approximation.

### 8.3. How the recount works

The rule: **the total and the deltas are always counted over the current choice** (which files are on × which
metrics are on):

- a file's value in a row is that row's absolute number (§6);
- a file's delta is the difference between its value in this row and in the previous one, and it comes from one
  shared calculation rather than from the row's own code — two ways of counting one row would be two answers;
- the total is the sum over the *enabled* files;
- switching off a file or a whole category recounts the total, the deltas and the sizes of the "now" row at once.

All of it happens in the browser (the data is already there), with no second look at git.

### 8.4. The memory of the view

The reader's choice (which metrics and files are on) is remembered **in the browser** between openings. It is one
record rather than two: the same record goes into the memory and into the address. The record's key is the
report's passport — the tool's name, the schema, the artifact's path, the title and the column labels in the
report's order — so a choice made in someone else's report is not picked up. The package version and the top of
the history are absent from the passport on purpose: updating the tool does not change what a column means,
while a grown history is the very report the reader comes back to. What is written down is what is switched
**off**, by name; a record with nothing to say is removed rather than kept.

These are view settings rather than project settings: they do not touch the settings file and never reach git.

---

## 9. The module's settings

The settings are the only thing the project knows about the module. The file is `size-table.config.json` in the
project's root — and a project may have none at all: with no file the settings are derived from the project, and
`--init` pins the derived ones. The draft in the package (`templates/size-report.config.json`) is copied under
the name the tool reads.

What the settings must satisfy is checked in the code (`validateConfig`): a value that does not fit is a refusal
naming the file and the fix. The design's formal schema for an editor and the migration of an older file did
**not** become code — a wrong file is answered with a hint rather than converted (recorded in `BLOCKERS.md`,
note N17).

The semantic sections of the settings:

| Section | What it sets |
|---|---|
| what to watch | `columns` — a label and a column's chain of paths — and `skip`, the declared exceptions |
| categories | a column may name its category; otherwise the extension table decides (§5.2) |
| metrics | `metrics` — which sensors are counted: `raw`, `min`, `tok` (and `gzip`, where asked) |
| minification | `minify.engine` (stripping or esbuild), `minify.ext` per extension, `minify.guard` |
| tokens | `tokens.family` and `tokens.encoding` |
| the report | `output`, `title`, `heading`, `locale`, `fixCommand` |
| the journal | `journal` — optionally, tying commits to sections of the project's journal |
| the rest | `hooks.enabled`, `links.commitUrl`, `rows.merges`, `rows.sha` |

---

## 10. Performance and the cache

- **The raw size** needs no reading of the content — the cheapest of all.
- **Minification and tokenization** need the content and cost more. The result is cached by the blob's sha, which
  is how git addresses a version, so identical versions are never counted twice (a rollback, a repeated merge, a
  file unchanged through a hundred commits). The cache lives for one run — nothing is kept between runs — and it
  has no version key: the way a number was obtained is named in `method` (§6), so a reader sees which minifier
  or tokenizer produced it.
- The measurements are **batched**: one run makes ten git calls on a three-commit history, and the same ten for
  three files as for ninety (measured with `GIT_TRACE=1`), because blobs are read in chunks rather than by a call
  per file.
- The minifier is called as a library through its JS API rather than as an external command, and it keeps one
  service process for the whole run; the module parser behind the stripping guard keeps one worker per run
  (`src/parse.js`). Both remove the price of a process per cell.
- There is **no on-disk cache**: the price of a rebuild is one pass over the history, and the cost grows with the
  length of the history rather than with the number of measures.

---

## 11. Refreshing the report: automatic, with no loop possible

- The report is refreshed **after every commit and every merge** by the git hooks (`post-commit`, `post-merge`).
  They are installed by the package's own installation and by the first run in a project, and an explicit command
  (`install-hook`) names the cause where the silent path stays quiet; `uninstall-hook` returns the project to its
  previous behaviour.
- **A loop is impossible by construction rather than by a promise**: the report's commit is assembled with git's
  plumbing (`commit-tree`), which calls no hooks at all, and the report's own path gets no row — so the same
  rebuild produces the same bytes and there is no second commit to make. A lock covers the remaining case: two
  hooks running at once.
- Where the report is tracked by git, the hook commits it **as a commit of its own**: the tree comes from `HEAD`
  with exactly the report's path replaced, so neither the index nor anyone's uncommitted work can enter the
  commit. Where it is untracked, a rebuild leaves the history alone.
- **The automation can be switched off**: `"hooks": {"enabled": false}` in the settings, the environment lever
  `SIZE_REPORT_NO_HOOK` (and CI, which is such an environment by itself), or `uninstall-hook` — after which the
  report is rebuilt by an explicit command.

---

## 12. The module's commands (the surface for a person and an agent)

```text
(no command)         check that the report matches the history
check [--json]       completeness: the settings, the history, the paths, the sensors
                     (code 1 — an untracked path not declared an exception)
explain <commit>     why a commit has no row (a revision name, a sha or its start)
doctor [--json]      one answer: the environment, the dependencies, the settings, coverage
install-hook         put the post-commit and post-merge hooks in place
uninstall-hook       take the hook and its state away
hook-run             what the hook calls: a rebuild and the report's commit
```

Modes: `--init [file]` (pin the settings), `--write [file]` (assemble the report), `--data` (the data contract in
stdout) and `--json` (the former shape). One run carries either a command or a mode and never both, and `--json`
is an answer's format rather than a mode: an answer exists for exactly four calls, and anywhere else it is a
refusal rather than silence.

`check` answers "is anything wrong": whether the history is complete, whether every path is a column or a
declared exception, whether the sensors are in place. The comparison of the artifact with the history exists as
well — it is the run with no command — and it is what CI uses where the report is tracked.

---

## 13. Talking to AI agents

Since an agent drives the project, the module has to speak to it in machine-readable form:

- the data as JSON — an agent reads numbers rather than markup (`--data`, `--json`);
- clear exit codes (0 everything is well · 1 a violation · 2 the call, the settings or the environment ·
  3 an incomplete history · 4 a lost sensor · 5 an internal error), so that an agent branches by the code rather
  than by the text of a message;
- a refusal carries a **ready fix command** as its last line;
- the module does **not** write into the project's own files: it edits no ignore list and refuses to touch a hook
  that is not ours, so the design's block written into the project's instructions at installation did not become
  code. What the package carries instead is a note for that (`templates/README.md`), to be put where the project
  wants it — recorded in `BLOCKERS.md`, note N17;
- the `doctor` command gives an agent in one call the answers it would otherwise look for half an hour.

---

## 14. Testing

The module's tests live in its own repository and are not copied into a project; the package carries none of
them. The key approaches:

- **A synthetic history.** A small temporary repository with a given history (commits, renames, merges,
  removals) is built in the checks, and the whole engine is checked on it — quickly and with no real project.
- **Reference ("golden") results.** For fixed inputs the reference numbers are kept, and with them the reference
  report file; a check catches any quiet change.
- **Traps:** non-English file names, line endings, binary files, comments that look like division, merges, a
  truncated history.
- **The minifier** (§7.3): that renaming really happens, that a file the minifier cannot parse is a refusal, that
  a format without a minifier is marked an approximation, that a lost optional dependency both falls back and
  says so — and that the numbers taken against the frozen fixture do not move.
- **The tokenizer** (§7.4): that the dictionary asked for is the one used, that a format for which tokens make
  no sense is not given a count, that without a dictionary the number is a length estimate and is marked, and
  that a foreign family or encoding is a refusal.

---

## 15. The plan of the move (step by step, each of value on its own)

The move went in five non-breaking steps, each of them a release:

1. **The engine left for a package as it was** (no new metrics): reading git, the raw size, the then current
   cosmetic simplification, assembling a static report. The project started using the package instead of a file
   inside itself.
2. **Data and display were separated:** the engine began to hand over JSON, and the report became an interactive
   page with the file tree, checkboxes, metric switches and a recounted sum. The minified size was still a
   simplification at that point.
3. **Real minification (esbuild) arrived, with the way marked**; the old simplification became the fallback,
   marked an approximation.
4. **Tokenization arrived**, with the family chosen and the honesty of the number marked.
5. **The integration was finished:** refreshing after a commit, `check`/`doctor`, the note for agents, the CI
   description.

The journal holds the dates and the numbers of each step; this document keeps what the steps established.

---

## 16. Questions the first version has settled

These were open and block nothing now; the answer to each lives where the code does:

- **The package's name and the registry:** published as `@vernikr/size-report` in the public registry, with an
  installation pinned to a tag of the release.
- **The tokenizer for DeepSeek/Claude:** no dictionary is wired for them. A family is an entry of the registry
  (`src/tokens.js`), and where there is no dictionary the count is an estimate by length, marked an approximation.
- **Counting tokens for every family or only for the chosen one:** only for the chosen one (decided 2026-09-14,
  `PLAN.md` §4.8.4) — precomputing all of them would pay build time for numbers nobody may ask about.
- **The bounds of the "assets" category:** the extension table decides, and a column may name its category in the
  settings — which is how localization files are placed whatever way they are arranged.
- **The threshold for "a file too large":** a file over 512 KB cannot be a column and is excluded by a rule; there
  is no separate threshold for minification.

---

## 17. What the first version deliberately does NOT do

- Compressed size for delivery (gzip/brotli): the registry carries `gzip` alone and counts it when the settings
  ask, but it is not part of the first version's set.
- Growth limits and blocking (the tool only shows; notifications are for later).
- Tokenization in the browser itself (it happens at build time — see §7.4).
- Managing many projects centrally (the first version is one project).
- Platforms other than the main one (portability is laid down, not implemented).
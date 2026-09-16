# CHANGELOG

The release history of `@vernikr/size-report`. Versions are SemVer (`PLAN.md` §8.2); the version of the data
is `schema: 1` — frozen by the 1.0.0 release and changed only together with a MAJOR.

## What “the numbers changed” means

The numbers of this tool are its product rather than debug output: every metric has a source (`raw` — the size of
the git object, `min` — the compressed form, `tok` — tokens) and an honesty — an exact count or an estimate that
says so. That is why a release carries a section “What changes in the numbers”: it answers **whose numbers will
move and why**. A release after which a number moves in silence is a defect of this tool rather than a release.

The measurements in those sections are taken on the package's fixture — `fixtures/synthetic/history.bundle`,
**16 commits and 10 columns**, the state at its tip. A release's table is not a retelling: `test/changelog.test.js`
checks it against a live run of the tool, and it can be repeated by hand — clone the bundle and run
`node bin/size.js --config <settings> --data`, taking `fixtures/synthetic/config.json` as the base, the metrics
`raw`, `min` and `tok`, and the minification way `strip` or `esbuild`.

## 2.4.0 — 2026-09-15

The look of the tree and the order of the columns: what is not in the report comes after the rest with its
checkbox cleared, the columns the last commit touched stand in front, and folding a folder counts no numbers.

- **A file outside the report was a caption without a checkbox, and a folder with nothing to measure had no
  checkbox at all.** One and the same question — “why has this no number” — read differently in two neighbouring
  rows, and beside the columns such rows broke the line. Now everything outside the report has its checkbox **in
  place, cleared and out of reach**: the rows run evenly (the eye compares like with like), and being out of
  reach says that this is not the reader's choice — the reason is in the tooltip, as before. Along with that,
  everything absent from the report (folders and leaves alike) comes **after** what is in it: in a list where
  half the rows cannot be switched, the report is visible at once rather than among strangers.
- **Folding a folder counted numbers it does not change.** A click on the sign rebuilt the panel and the table
  whole — paying for the entire table in order to hide rows. Now the subtree lies in the markup and a class on
  the row hides it, while the click changes only the three things the reader sees — the class, the sign and the
  record in the memory — so the price of a fold no longer grows with the table.
- **Columns touched by the last commit come in front of the rest.** The report is rebuilt after every commit, and
  a reader's first question is what this edit brought. The mark comes from the history (`last` in the `--data`
  contract) rather than from the numbers: an edit that moved no size is an edit too. The commit taken is the one
  that touched at least one column, counting back from the top — commits past the columns (and above all the
  report itself, which the hook commits) are skipped; otherwise the mark would depend on the report's own commit,
  the same run would yield other bytes, and the hook would commit the report a second time over nothing. Inside
  each part the order is the one from the settings.

### What changes in the numbers

**Nothing.** The same engine counts with the same sensors: the release is about what is visible on the page and
in what order rather than about measurement, so the table is the one of 2.3.0 to the last cell.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.3.0 — 2026-09-15

The report describes the whole project: every tracked file becomes a column, and the tree folds.

- **The columns were a sample of the project.** With no settings file the tool took the twelve largest files —
  one per extension — and called the rest exceptions. The report counted its “total volume” over a handful of
  files, and a reader took that for the volume of the project. Now a column is **every tracked git file that can
  be measured**, and `skip` names only what cannot be one: the report itself, dependency locks, maps, built
  output, an unknown format, a file over 512 KB — and a path that is not at HEAD (it lives in the history alone,
  and there is nothing to measure in it).
- **The price is named, and it is structural** (measured then on this repository, 149 commits, 135 columns
  against 12): building the report went 2,4 s → **6,3 s** and the file 122 KB → **417 KB**; `check` — 6,1 s. The
  hook rebuilds the report after every commit, so that is the price of every commit too, and the report grows
  with the project, since every file is a row. Whoever finds it too much sets the columns by a settings file
  (`--init` gives a draft to edit: the former choice is reproduced by a list of twelve files).
- **The tree folds.** Every folder has a sign of its own (▾/▸): it answers how much of the tree is visible, while
  the checkbox answers what is counted, so they are two different targets rather than one. A fold is remembered
  between visits and **does not travel in the link**: a link is sent for the numbers, not for how someone's tree
  is laid out. The fold has a record of its own (the same report passport), and unfolding every folder removes it
  — as returning the checkboxes does.
- **The pasting of the page's program got a guard.** Module syntax is removed line by line, so a multi-line
  `import` left a tail in the page and broke it whole — the check now looks for the module's **name** in the
  pasted program rather than only for the start of a line.

### What changes in the numbers

**A column is every tracked file, so where no settings are given there will be more columns** (12 → 135 in this
repository), and with them grow the “total volume” (it was counted by columns before too) and the time of a run —
named above. The numbers below are measured on the fixture, where the columns are set by a settings file: such a
project is seen by the measurement exactly as 2.2.0 sees it, to the last cell.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.2.0 — 2026-09-15

The page's tree is the project's tree: everything is visible, and the numbers belong to what is measured.

- **Only what had become a column was visible in the tree.** With the settings derived and a dozen columns, the
  tree showed a dozen leaves and was silent about the rest: a reader saw a list of the measured rather than the
  project's tree, and deciding that files had gone missing was the easiest thing. The contract (`--data`) now
  carries a **catalogue** — every path git sees (`ls-files`) — and the tree is built from it.
- **Numbers belong to columns only, and that is visible rather than implied.** A leaf outside the report stands in
  its place but as a caption without a checkbox, and the reason is in the tooltip — of two kinds: `rule` — such a
  file cannot be a column (the report itself, a dependency lock, built output, one too large, or a format without
  text), and `choice` — it could, but was not chosen as a column (the settings choose that). The engine sets the
  mark of the reason by **the same** rules it uses to pick columns; otherwise the hint would say one thing while
  the choice did another. The report itself is named in the tree **always** — both while it is not built and while
  it is out of git: whether it is tracked is a property of the moment, and the report must not depend on it,
  otherwise the first rebuild in a fresh clone would yield other bytes and the hook would commit the report a
  second time over nothing.
- **A folder of mixed composition gets a fraction** (“2/5”: two files of the folder's five are in the report),
  while a folder that is measured whole counts as before (“5”). A folder with nothing measurable gets no
  checkbox — there is nothing to switch on in it — but it stays in place: the tree must not lie about what the
  project has.
- **The price was named, and it is what kept this release from measuring every path.** The set of columns does not
  change here, so a run did not become more expensive; what was measured then on this repository (162 columns ×
  79 rows against 12) is the price of the third metric: **16,1 s** with tokens instead of 2,4 s without. On the
  live history the full set refused then, losing an edit of a path that is not at HEAD — and that refusal turned
  out to be a defect of its own rather than a property of measuring everything (`BLOCKERS.md` §B3, closed
  2026-09-14). The next release made the change anyway (2.3.0) and named its own price there.

### What changes in the numbers

**Nothing.** The same engine counts with the same sensors: the release is about what is visible in the panel's
tree rather than about measurement, so the table is the one of 2.1.0 to the last cell.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.1.0 — 2026-09-15

The look of the page on a desktop: the numbers take the whole remaining height, the panel scrolls on its own.

- **There was emptiness under the table, and the file list set the page's height.** In a wide window both columns
  ran each with its own height (`align-items: start`), so the page's height equaled whatever the panel came to —
  measured before the fix at a window of 1440×900: the panel 883 px, the page 1097 in a 900 window, 195 px of
  emptiness under the table, and the lower files of the tree below the bottom edge (the list was moreover cut by
  its own cap of 62vh). Now the page fits the window whole: the grid's rows are named after their subject, one
  working row stretches, and the table takes the whole remaining height while the panel grows no taller than it
  and scrolls itself. On a wide screen the file list is no longer cut, so every caption of the tree is visible at
  once.
- **A click on a checkbox sent the list back to its beginning.** The panel is drawn anew, and the place one had
  scrolled to went with it, so the lower files of the tree could not be reached at all. The panel's scroll and
  the list's are now part of the view: both are remembered before a rebuild and put back after it (`panel.scrollTop`
  and its twin; confirmed in Chrome at a 1440×500 window).
- **The row of categories sticks** to the top of the panel while the tree is scrolled. So that passing files are
  not read under the sticky row, the panel's top padding moved into its first field: what scrolls is seen in the
  scroll padding too, and the band there holds the row itself rather than the names of files going by.
- **The explanation under the tree is gone**, and the font of the file captions became the one of the table's
  numbers (12,5 px): the explanation pushed the numbers away, while its meaning stands where it explains — the
  colour of a delta names the sign of a number, the way and the precision stand under the metric switches, and
  the mark of a skip is in the cell's tooltip.
- **The boundary of the wide layout is 899 px.** At exactly 900 px both halves of the styling applied to one page,
  and the cap on the table's height survived from the “narrow” half into the “wide” one — the same emptiness under
  it at one and the same window size.

### What changes in the numbers

**Nothing.** The fix is about the page's look and scrolling; the engine is the one of 2.0.2, and the page takes
numbers ready-made from it.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.0.2 — 2026-09-15

The instruction stopped promising an extra manual step and named the difference between platforms.

- **README taught installing the hook by hand.** §6 kept a line of an earlier release — “the hooks are installed
  only by `install-hook`, no ordinary run creates them” — while since 2.0.0 the installation is its own
  (`bin/postinstall.js` and the first run). The text now says what the code does and names the single exception:
  pnpm 10 does not run the scripts of dependencies (“Ignored build scripts”) — there the hook is installed by the
  first run, or the build is allowed by `pnpm.onlyBuiltDependencies` in the consumer's manifest.
- **One manual step that was invisible is named.** The first report is created but not committed (a new file in
  another's history is a person's decision): both §6 and the template `templates/README.md` say so, and from
  there on the report updates itself in commits of its own.

### What changes in the numbers

**Nothing.** The fix is the text of the instruction alone; the engine is the one of 2.0.1.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.0.1 — 2026-09-15

Where the report lands in a fresh project: `docs/size-report.html`, and the directory is created on its own.

- **The report no longer lands in the root.** The first edition of the output chose “beside the docs if the
  directory `docs` exists, otherwise in the root”: in a project that has just installed the package there is no
  directory yet, and the report turned up where nobody looks for it (measured: a fresh clone, an install from the
  registry, `docs/` absent, the file in the root). Now there is one address — `docs/size-report.html`; the
  directory is part of the address, and the one who writes the file creates it. A name from the settings still
  overrides the output.
- A check guards this: a project without settings and without `docs/` gets the report in `docs/`, has none in the
  root, and the control mode is green.

### What changes in the numbers

**Nothing.** The fix is about the file's path rather than about measurement, so the table is the one of 2.0.0.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.0.0 — 2026-09-15

One report instead of two, and it appears on its own: the report's form is brought to one file, and its
updating to one decision (the hook installs itself).

- **The report is one file: the self-contained page `size-report.html`.** Data, styling and the program lie
  in it, and there are no external references. The former two forms (a static table and a page beside it)
  are gone together with their code (`src/render.js`, `src/artifact.css`): two outputs of one history would
  diverge in silence, and there would be nothing to tell which one is right. A column is a file, so the
  report is a file too.
- **One writing mode: `--write [file]`** (the former `--page` is removed — a breaking change). The value
  names the path the report is written to (the directory is made by the writer) and becomes the run's own
  `output`: the report calls itself by the path it lies at.
- **By default `docs/size-report.html`** if the project has a `docs/` directory, otherwise in the root — and
  the name changed from `size-table.html` to `size-report.html`. The address is one answer of the package
  (`outputOf`) rather than a name taken from the settings, whose `output` key only overrides it.
- **The hook installs itself** — after the package is installed (`bin/postinstall.js`) and on the first run
  in the project. So `docs/` with the report appears with the very first commit, with no manual step; it
  installs where that is safe (an ordinary `.git/hooks`, no one else's hook, something to call the tool
  with, not CI) and keeps silent where it is not.
- The report's commit is seen in the hook as before: a commit of its own, that path alone. The report stays
  a **fixed point** — the list of skipped commits does not go into the file (it changes with the report's own
  commit) and the hook does not commit it without end; the reader has that list as before: `--data`,
  `--json`, `size explain`.

### What changes in the numbers

**Nothing.** The measurement is untouched: the same sensors, the same ways, the same columns. What changes
in a consumer's project is **the file's form and its path**: `size` (the check) will be red on the former file
until the report is rebuilt, and scripts that called `--page` get a refusal naming the key. The table below is
the one of 1.3.1 to the last cell.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 1.3.1 — 2026-09-15

A fix of the page's layout: in a wide window the panel of choices stands to the left of the table.

- **From 900 px the panel is a column left of the table.** The metrics, the file tree and the legend are seen
  together with the numbers: scrolling the lower rows no longer takes the controls above the top edge, and the
  table gets everything left horizontally (measured then: 1060 px in a 1440 window against 1372 for the former
  one-column layout). A narrow window drops the layout: there the columns run one under another as before.
- The layout is a grid on `body` (`src/page/app.css`) rather than a wrapper in the markup: the page is
  assembled by pasting chapters, so the page's form stayed in one place. The threshold was the one of the
  adaptations — 900 px for both halves then, with no gap left without rules; the overlap at exactly 900 px was
  fixed in 2.1.0 by moving the narrow half to 899 px.
- Neither behaviour, nor the artifact, nor the data is touched: the fix is in the page's styling alone
  (`--page`), while the static artifact (`--write`) was built from `src/table.css` then and is none of this
  release's business.

### What changes in the numbers

**Nothing.** This release touches neither the measurement nor the report's form: the page's layout changed,
while the same engine counts with the same sensors. The table below is the one of 1.3.0 to the last cell.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 1.3.0 — 2026-09-15

The release of derived settings: to get a report a project no longer has to describe itself.

- **There may be no settings file.** The tool derives them from the project: the columns are the largest
  files, one per extension (otherwise the report would consist of large `.md` files and no `.js` would come
  under real compression — the sample was capped at twelve, and 2.3.0 replaced it with every tracked file);
  the journal is the first familiar one (`WORKLOG.md`, `CHANGELOG.md`, …); the report file is `docs/` if that
  directory exists; the fix command is the declared script `sizes`, and failing that the path to the package
  installed inside the project; the commit link comes from the `origin` address (GitHub or GitLab — any third
  host has none, a guess would lead elsewhere); the metrics are `raw`, `min`, `tok`. The fix command and the
  link are taken ready-made rather than invented: the report's note and the refusals quote them, and a call to
  a script the project does not have would answer "no such script" exactly where a working command is needed.
- **Everything that cannot be a column, or did not fit into one, is named in `skip`** (the report itself,
  dependency locks, maps, built output): that is why the very first `size check` is complete rather than red —
  "paths outside the columns" appear from new edits, not from a project that has not been set up yet. A column
  is a file: the engine reads a column's list of paths as its renames, so "a whole directory" is never a
  column.
- **The derived settings are announced by a line** in stderr, with the ready `--init` command — it pins them,
  and from there they are edited like ordinary settings. What is pinned is what the project runs on without a
  file (the derivation on top of the defaults), so a change of defaults in a new version of the package does
  not ride silently over a project already set up. Without a pin the profile is derived on every run: the
  numbers have not "moved", but a former measurement can be repeated only by pinning it.
- **The refusal stayed with a named file:** `--config <file>` that does not exist is code 2 with the same
  `--init <file>` fix (a typo in a path must not be covered by a guess). The default name has no refusal at all
  in its absence; exit codes did not change in any other case.
- The number **1.3.0** is by SemVer: a capability appeared that was not there before; the data schema
  (`schema: 1`) is the same.

### What changes in the numbers

**For those who have settings — nothing.** This release touches neither the report's form nor the count: the
table below is the one of 1.2.0.

**For those who have no settings** the numbers appear where a refusal used to be (code 2): the derived
profile gives them. Derived and pinned (`--init`) differ in nothing from each other: the file is the same
profile, only written down. A measurement can be repeated only by a pinned one: without a file the profile is
derived anew on every run.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 1.2.0 — 2026-09-15

The release of a cause rather than of a measurement: the check ("does the table match the history?") now names
the other count when there is one — and does so always, not only where everything came together. It was found by
walking our own instruction (`worklog/archive/WORKLOG.md` §54) and fixed by the rule "a violation is older than
an approximation" (`REFACTOR.md` R-4.23).

- **`size` and `size check` print the sensor's note always.** The note used to be printed only on a lucky
  verdict: with the report built by a real minifier and the run going without it (an install without the optional
  dependencies, a platform without `esbuild`) the numbers honestly diverged, while the cause "the count is
  another" was absent from the output altogether — the reader saw a caption, a divergence, and nothing about
  where it came from.
- **The verdict stays first in importance.** A violation is older than an approximation — the same order as in
  `size check` and `size doctor`: code **4** would claim that the sensor explains the divergence, and nobody
  checked that (a divergence may also come from an edit past the report). So the answer in that case is still
  **code 1** plus a note with the fix: the release changes no exit code in any case.
- Neither the report's build, nor its form, nor the meaning of the settings is touched. The rest of this release
  is not about what ships: the tag release from CI (R-4.24) and the time targets taken off the check suite
  (R-5.8) concern the package's repository rather than what is installed.
- The number **1.2.0** was named by the package's owner; under strict SemVer the content is a fix (PATCH): no
  new capabilities ship.

### What changes in the numbers

**Nothing.** The table below is the one of 1.1.0 and 1.1.1 to the last cell: this release changes the text under
a divergence rather than the numbers. The measurement on the fixture is the same (16 commits, 10 columns), and it
is a measurement rather than a word: the artifact is the same 22 112 B, and neither frozen standard was re-taken
(`pnpm run check:standards` run on 2026-09-16: fixture 4 of 4 byte for byte, parity 3 of 3, the live bundle 149
commits). The page measured 59 376 B then and travels with the tool's own program and markup, so its size moved
since (66 277 B re-measured on 2026-09-16, `REFACTOR.md` §0). `--json` and the artifact are byte for byte equal
to the standard on the fixture and on the live history of the consumer project.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 1.1.1 — 2026-09-15

The release of a name rather than of a measurement: the package moved into the owner's scope
(`@vernikr/size-report`) — the name `size-report` is taken in the registry by someone else's package, so publishing
under it was impossible (`PLAN.md` §10). Along with that the license file entered the tarball: the manifest named a
license while the tree had none.

- **The package's name is `@vernikr/size-report`.** `bin` stayed `size`, the install is
  `pnpm add -D @vernikr/size-report`, the call is `pnpm exec size`.
- The same release closes three fixes after 1.1.0: the advice of a refusal is checked by execution rather than by
  word (`REFACTOR.md` R-4.22), the fixture's anchor moved out of the tree into the history (R-1.5, R-3.4), and the
  numbers of the rename in `PLAN.md` §10 were checked against the fact.
- **The tool's name in the data (`--data`) equals the package's name** — and it also enters the report's passport,
  on which the page's memory key and the link's anchor depend. So a report rebuilt by this release **loses the
  reader's saved choice in the browser once**: the former release's record lies under another key. The numbers and
  the markup do not change with that, and a first-time reader sees the default anyway.
- `LICENSE` (MIT) was added to the tarball — the manifest named a license while the file was not there.

### What changes in the numbers

**Nothing.** This is not a promise but a measurement: the table below was taken by the 1.1.1 release and matches the
table of 1.1.0 to the last cell — the measurement is untouched by this release, while its fixes lie in the package's
name, the texts of refusals and how the fixture's anchor is printed. Shown rather than said: the output of `--json`
and the artifact are byte for byte equal to the frozen standard on the fixture and on the live history of the
consumer project, and the consumer's committed table was rebuilt by that release into the same bytes
(`sha256 863ce3e9…`, `REFACTOR.md` R-4.19); since then it is rebuilt by the consumer's own commits.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

The slices are the ones of 1.0.0 below and read the same way; a project's former settings mean `strip`, so an
update changes no number on its own, and gzip still does not ship (`PLAN.md` §10, D4).

## 1.1.0 — 2026-09-15

The first release after 1.0.0, and it holds **not a single fix of the measurement** — only what live runs found
after the release, all of it in the tool's answers to a person.

- `explain` understands what commits are actually called: `HEAD`, a branch, a tag, `HEAD~1`, a full and a short
  sha. A revision name used to be taken for a nonexistent commit — the refusal said “в истории нет коммита «HEAD»”
  (the tool prints in Russian), that is, it named the wrong cause. A commit outside the report's history is now a
  cause of its own, with the sha named.
- The refusals got a **catalogue and a guard** (`tools/refusals.js`): a line per refusal with its exit code and
  obligatory phrases, maps of the places of refusal holding the counts, and two checks splitting both halves of
  the promise — one calls the refusal, the other demands a catalogue entry for every place. A new refusal cannot
  appear without a check. Along the way six places were fixed where the text lied or was silent about the fix, and
  one new cause appeared: **`нет git`** — “git did not start” and “there is no repository here” used to be one
  text with an “or” in it, which is to say they were not named at all.
- The settings check refuses a column whose path is not a non-empty string (`"paths": [123]`): such a column used
  to match nothing while the report produced zeroes **as a success**.
- `--init` in a directory without familiar extensions no longer prints “✗” while exiting with code 0: the sign and
  the code said different things.
- **The package's repository became public**, so an install needs neither a key nor a token nor a step in CI: pnpm
  resolves `github:` into the `codeload.github.com` archive over HTTPS (`worklog/archive/WORKLOG.md` §44).

### What changes in the numbers

**Nothing.** This is not a promise but a measurement: the table below was taken by the 1.1.0 release and matches the
table of 1.0.0 to the last cell — the metrics, the default settings and the sensors are the same, while the fixes of
this release lie in the texts of refusals, the parsing of the command line and the settings check, which the
measurement never enters. Shown rather than said: the output of `--json` and the artifact are byte for byte equal to
the frozen standard on the fixture and on the live history of the consumer project, and the consumer's committed
table (211 KB) was rebuilt by the same release into the same bytes (`sha256 863ce3e9…`, `REFACTOR.md` R-4.19).

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

The slices are the ones of 1.0.0 below and read the same way; a project's former settings mean `strip`, so an update
changes no number on its own, while the way `esbuild` stays a deliberate decision of whoever switches it on; gzip
still does not ship (`PLAN.md` §10, D4).

## 1.0.0 — 2026-09-14

The first release: the tool was moved out of the consumer project into a package of its own (`PLAN.md` §5, steps
0–5) — before that it lived as a copy inside someone else's repository. There were no releases before it: the
manifest's version stood at `0.0.0` while the work went on inside that repository (`worklog/archive/WORKLOG.md`,
`REFACTOR.md`, `PLAN.md`), and the numbers `0.1.0`–`0.5.0` in `PLAN.md` §12 are a plan of releases rather than their
history (measured: no such tag exists).

The version `1.0.0` is about a freeze rather than about the volume of changes: `schema: 1` of the data was declared
stable by this version, so it can be broken only by a MAJOR with a migration. The tool's version enters the data
(`tool.version`), the versions of the minifier and the dictionary enter the way a number is obtained, so “the numbers
of this release” are numbers with `esbuild 0.28.2` and `gpt-tokenizer 4.0.0` in the slices where they are at work.

### What changes in the numbers

A measurement on the fixture, the state at HEAD (`now`), the metrics `raw`, `min`, `tok`, the dictionary
`o200k_base`:

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

- **A project with former settings moves nowhere.** Existing configs do not set `minify.engine`, and the default
  is `strip`: the same comments and indentation, the same names, the same bytes as the tool before this release.
  Shown rather than said: the output of `--json` and the built artifact are byte for byte equal to the frozen
  standard — on the fixture and on the live history of the consumer project (`fixtures/synthetic/`, `fixtures/parity/`,
  the checks `test/parity.test.js`, `test/frozen.test.js`; re-taken on 2026-09-16 by `pnpm run check:standards`:
  fixture 4 of 4 byte for byte, parity 3 of 3).
- **`raw` depends on the git object and nothing else**: it is its size, and the file's content is not read for this
  metric at all. Neither the settings, nor the way of minification, nor the tool's version affect it.
- **`min` with `esbuild` is smaller** than with `strip`, and that is the only thing that changes numbers if real
  compression is switched on: names shortened, spaces gone. On the fixture the total goes 1597 → **1483** (−7 %),
  and by file **−33 %** on `code.js` (276 → 185) and **−22 %** on `style.css` (55 → 43). For the formats the
  minifier does not take (`.md`, `.txt`, `.toml`, `.json`) the number is the one of `strip`: 303, 60, 299, 69. That
  is why the metric is marked as an approximation **throughout**: a column's accuracy is counted by its worst cell
  rather than by the majority (a separate cell carries the mark too — `test/minify.test.js`). The way `esbuild` is
  what `--init` gives new projects; moving an existing project onto it is a deliberate decision rather than a side
  effect of an update.
- **`tok` is a new number with nothing to compare it to**: the former tool had no such metric, so this is “appeared”
  rather than “changed”. The exact count by the dictionary gives **540** on the fixture; the same fixture without the
  dictionary is counted by an estimate from the length (1 token ≈ 3 characters) and gives **583** — a different
  number, which is why it carries the approximation mark, and the run returns **code 4** rather than a green
  success (`SIZE_REPORT_NO_OPTIONAL` reproduces an install without the optional dependencies). Both numbers were
  re-measured live on 2026-09-16.
- **Without `esbuild`** `min` steps back to `strip`: the same 1597, with the approximation mark and code 4. The
  numbers do not break with that, but neither are they passed off as compression.
- **`gzip` does not ship in 1.0.0**: the metric is neither in the settings draft nor in the documentation; the
  registry still accepts it, and removing it is `PLAN.md` §10 (D4) — a change of behaviour rather than a move. The
  registry holds it today as well (four metrics: `raw`, `min`, `tok`, `gzip`), while the settings draft names three
  and the default set is `raw` and `min` (`PLAN.md` §4.4, §11).
- **The machine's environment does not affect the numbers — and that too is a change** against the tool before this
  release: it read paths and line endings the way the machine is set up, and on a default Git install it either gave
  wrong numbers or fell over altogether (`BLOCKERS.md` §B1, §B2, §N10). Now the output is the same in any
  environment, which a run with the machine's settings switched off proves (`GIT_CONFIG_GLOBAL=/dev/null`).

### What came in

- Three metrics: `raw` (the size of the git object), `min` (in two ways — stripping the ballast and real compression
  through `esbuild`), `tok` (the tokens of the chosen dictionary). The numbers are absolute; the derived ones
  (deltas, sums, filters) are counted by the page.
- The interactive report: a tree of files, categories, metric switches, the choice remembered between visits and
  handed over as a link; the page is one self-contained file and opens from disk without a network.
- The commands: building the report, checking it against the history (`size check`), explaining a missing row
  (`size explain <sha>`), diagnostics (`size doctor`), installing and removing the hook that updates the report,
  `--init` with a draft of settings.
- Templates for a project being connected: a draft of settings and a description of the check for CI.
- Guards that check promises rather than code: parity with the frozen standard, the live history, work from the
  built tarball, the claims of the documentation, and the pinning of git's settings at the boundary of a call.

### What was fixed

- Silence on typos and on incompatible combinations of keys: an unknown word, a stray word, two modes at once, a key
  without a value, and `--json` where there is no JSON answer — now a refusal naming the culprit and a ready command,
  rather than code 0 with someone else's work done.
- A column whose file lived in the history and was deleted before HEAD brought the run down with a meaningless
  refusal text; the choice of a path stopped depending on the settings of renames (`BLOCKERS.md` §B3, §N8).
- The dependence of the numbers on the machine's environment (`BLOCKERS.md` §B1, §B2, §N10).

### Not in 1.0.0

- `docs/METHODS.md`, `docs/DATA-FORMAT.md`, `docs/ARCHITECTURE.md` — the package's documentation from `PLAN.md`
  §8.3; the role of every number is described in `README.md` today.
- The cache of measurements, the split of the checks into a fast and a slow set, a profile on a history of a couple
  of thousand commits — `PLAN.md` §5, step 6. Of the three, the split arrived on 2026-09-14 (`REFACTOR.md` R-5.7:
  `pnpm test` is the fast run, 72 checks of 177, and the full profile the whole set); the cache and the profile on a
  big history did not (**still open** in `PLAN.md` §9).
- Removing the `gzip` metric from the registry (`PLAN.md` §10, D4) and a license file (an open question of §10 — the
  file arrived in 1.1.1).
- Shipping `dist/app.js` (the pre-built program of the report) and publishing to npm: the install goes by a git
  dependency from the public repository (it became public on 2026-09-14, `worklog/archive/WORKLOG.md` §44), and the
  package was **not published** to npm then — `PLAN.md` §8.4. Both have moved since: the package is
  `@vernikr/size-report` on npm (2.4.0 measured on 2026-09-16) and is released by a tag from CI, while the consumer
  still installs by a git reference (`"size-report": "github:vernikr/size-report#v1.2.0"` in its manifest), and
  `dist/app.js` still does not ship (it is not among the manifest's `files`).
- Minification of markup (HTML), JSX/TSX and tokenizer families other than `openai`: they have no dictionary of their
  own, and counting by someone else's would pass a guess off as a number. Holds today: one family in
  `src/tokens.js`, and JSX/TSX deliberately outside the table of loaders.

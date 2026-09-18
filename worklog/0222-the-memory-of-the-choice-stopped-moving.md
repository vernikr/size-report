# 0222 — the memory of the choice stopped moving with the report

**Asked:** the settings of the report (`docs/size-report.html`) survive a reload of the page but not a
rebuild of the file, so every commit asks for them again. First: find out why, with the code untouched.
Then: make the settings global for the file — the same in the report whenever and by whichever commit it
was built — and always one record; and remember the *group's* decision where the reader decided by groups
(a whole category off or on) rather than repeating it file by file, keeping the per-file facts only for the
categories that are in the third state.

**Found — why the settings did not survive a rebuild.** The reader's memory lives under
`size-report:` + `appPassport()` (`src/page/state.js`), and the passport was an FNV hash of the tool's
name, the data schema, the artifact's path, the title **and the column labels in the report's order**.
This project keeps no `size-table.config.json`, so the columns are derived on every run: every measurable
file, ordered as a ring over the extensions, largest first within an extension (`src/project.js`,
`columnsOf`). Any commit that moves a size therefore permutes the columns, the labels join another string,
the passport changes — and the report the reader opens looks under an address the browser has never seen.
The record is still there; it is simply unreachable. Measured over the committed revisions of
`docs/size-report.html` with the page's own `appDecode`: the passport changed in 8 of the last 11 steps;
between `08f8304` and `893af18` the *set* of columns was identical (337 files both times, the sorted lists
equal) and only the order moved — a pure permutation of the same labels was enough. Over the 44 revisions
readable in the packed form the browser would have held **26 different addresses**, and sorting the labels
inside the passport would have brought that down to 17 only, because files enter and leave the derived set
as well. A reload of one and the same file works because the data — and with them the address — are the
same.

**Done:**

- **The passport is the report rather than a build of it.** It is now counted from the tool's name, the
  schema, the artifact's path, the title and **the oldest row of the history**: the first four say which
  report this is, the fifth tells two projects apart that declare the same four (the path and the title are
  defaults in most projects, and all `file://` pages share one memory in the browser). A row is the one
  part of the block that never moves with a commit — rows are built from the oldest commit up
  (`git log --reverse` in `src/git.js`), so a commit appends and leaves the first row where it stands, and
  the same sha is what every clone and every build counts. The columns are gone from the passport on
  purpose: a record holds names, and applying it is already name-wise and tolerant of a vanished name.
- **One record, one address.** The address carries the form of the naming (`size-report:2:…`), and the
  addresses the first naming left in the browser — one per build of a report — are swept when a report of
  this release is opened (`appSweep`, called from `appBoot`). What is swept is the mark of the form rather
  than a guess about whose record it is, since the older address was counted from the data and says nothing
  about ownership; what this release writes is left alone, so another report of this release keeps its own.
  The old records of this browser — the 26 measured above — go with the first opening.
- **The group's fact where the decision was a group's.** A category whose box is wholly off or wholly on is
  written into the record as that fact (`cats`: every category of the report, `true` or `false`), and a
  category in the third state is **absent** from it while the files the reader switched off in it go into
  `files` by name, as before. So a file that joins a category the reader switched off is switched with it —
  which is what his click asked for — and the record does not grow with the project; the choice of a whole
  category is four short entries instead of a name per file. `appApply` applies the groups first and the
  names after them: the file-by-file decision is the finer one, and a record of an earlier release, which
  knows no categories, is applied by its names exactly as it was.
- **The panel reads a category's files in one place** (`appCatOf`), where the record, the boxes and their
  fields asked for the same group three times.

**Red first, by mutation, both properties of the new checks:** with the column labels put back into the
passport the new check `the memory of a choice: a rebuilt report brings the same choice back` fails on
`a rebuild of the report gave the choice another address or another record`; with the group fact written as
file names instead (the old rule) the same check fails on the record itself, which names all four `docs`
files — the one that joined after the commit among them.

**What holds it:** `pnpm run verify:fast` green (87 checks of the fast set, lint, bloat, duplicates and
relations included). Two checks are new in `test/page-choice.test.js` — the rebuilt report (a file joining
the switched-off category, the columns rotated, the same record byte for byte at the same address) and the
sweep (an address of the older form goes, a record of another report of this form stays) — and the two
supporting pieces are `pageFrom` in `tools/page-harness.js` (a page assembled from given data, the report
after a commit) and the pinned list of the page's functions in `test/page-view.test.js`, which gained
`appCatOf` and `appSweep` and nothing else. The documents that told the older story were corrected in the
same breath: `docs/architecture.md`, `docs/module-design.md` (§8.4 and the contract's `report` row).

**The reader's own choice is set once more** after this release: the address of the old form is dead weight
and is swept, so the boxes the reader left switched off have to be clicked once — after which they stay put
through every later rebuild.

**Files:** `src/page/state.js`, `src/page/panel.js`, `tools/page-harness.js`, `test/page-choice.test.js`,
`test/page-view.test.js`, `docs/architecture.md`, `docs/module-design.md`,
`worklog/0222-the-memory-of-the-choice-stopped-moving.md`, and `docs/size-report.html` (rebuilt).

**Owed (not part of this working tree yet):** the version (a `feat` — MINOR, 2.8.9 → 2.9.0), the section of
this journal entry in the release commit, the tag `v2.9.0` placed by sha, and the re-pin of the attached
copy (`pnpm add -D -E @vernikr/size-report@2.9.0`).

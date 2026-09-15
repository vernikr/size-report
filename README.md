# @vernikr/size-report

A tool that tracks how the volume of code and documents grows: every change shows how much the
project grew or shrank, in three measures — as written (`raw`), minified (`min`) and in tokens for a
language model (`tok`).

It answers two questions: for a person, "where is the project swelling"; for an AI agent, "how
much does my change weigh in its own context". It forbids nothing and blocks nothing: it only
shows.

## Status

**Release 2.4.0 (2026-09-15).** The tool lives as a package of its own: the registry name is
`@vernikr/size-report` (published by tag from CI, with no secret). A project may keep no settings at
all: without a config file the tool derives them from the project itself and says so in one line,
and `--init` pins what was derived into a file. The report is **one file**, the self-contained page
`docs/size-report.html`, and it appears by itself: the updating hook is installed after the package
is installed and on the first run. The version is in the manifest, and every release has a
`CHANGELOG.md` section saying what changes in the numbers: the table there is not a retelling but a
measurement on the fixture, checked against a live run (`test/changelog.test.js`).

2.4.0 changes nothing in the numbers; what it changes is **what is visible and in which order**:
with no config file every tracked file is a column (rather than a sample of twelve), folders fold in
the tree, and everything outside the report stands after the rest with its box cleared and
unavailable; in the table, the columns the last commit touched come first. The data `schema: 1`,
frozen at 1.0.0, stays what it was: the release added a field rather than changing the meaning of
the old ones.

**Parity with the implementation the move started from is proven, not asserted.** The command is
`bin/size.js` and the package's entry point is `src/size-table.js` (a re-export only), with the
mechanics laid out in modules under `src/`. `pnpm test` compares the package with the frozen
standard byte by byte on the fixture and in four deliberately hostile environments (the machine's
git settings, the locale); `pnpm run parity:live` does the same on the consumer project's live
history in two environments — 95 rows × 27 columns, the artifact self-contained and passing its own
control mode. The output does not depend on the machine: the git settings that change what is
parsed are pinned inside the engine (`BLOCKERS.md` §B1). The comparison against the working tree
compares content rather than sizes, so a tree with CRLF newlines (`.gitattributes`; `core.autocrlf`,
the default of Git's installer for Windows) is no obstacle (`BLOCKERS.md` §B2).

**A history with deletions is no longer a dead end** (`BLOCKERS.md` §B3): a column whose file lived
in history and was deleted before HEAD used to fail the whole run with code 1 and the text "no file
instead of no file" — that is, a project with deleted files got no report at all. Now only a
**disagreement** between the two sides of the comparison is a refusal: a lost creation, a lost edit
and a lost deletion still fail the run, but with the real cause and a ready command, while a file
deleted before HEAD is simply empty in the table. Proven by numbers rather than by a word: the
column's size at every commit is checked against the blob size from git — a returned file gives the
same number as its first appearance — and a witness, the file that appears only in a merge, fails
the run naming both sides. The boundary of the same parse is closed as well (`BLOCKERS.md` §N8):
the path for the state was chosen by the order of the settings rather than by what the commit holds,
so with `diff.renames=false` — when git returns the old name of a renamed file and the new one in a
single commit — the engine took the vanished alias and the comparison refused on a legitimate case;
now it takes the alias git returned a blob for. The old numbers could not move: both logics agree
wherever the first alias in the commit exists, that is, in every run that ended with a report
before.

**The consumer project is connected** (2026-09-14). `safe-resets` installs the package from git by
the release tag and keeps no copy of the tool of its own — neither `tools/size-table.js` nor a test
for it: the table is built and checked by the `size` command (`pnpm run test:sizes`), and its part
in that project is one line of its runner (`worklog/archive/WORKLOG.md` §18). The connecting
instruction turned out to be right and incomplete in two places — the step giving CI access to the
package and the order of moving off an already installed copy — and both are written into the
instruction below. The step with a key left it later, along with private access.

**The data contract and the page.** The engine hands over absolute values and the shape of the table
(`--data`), while deltas, totals, "now" and the filters are computed by the page — which is the
report itself (`size-report.html`): without that split the filters and "the total over the
selection" are impossible in principle. The contract carries the accuracy of a number as well, a
row of `approx` marks per cell, because that is a fact of the measurement rather than a conclusion:
the page shows what the engine said and keeps no rule of accuracy of its own. The page's panel is a
tree of files by folder, with a switch per folder for the whole subtree; a reader's choice survives
a revisit and travels in a link — the page's address is the link. The contract carries the **project
catalogue** too: every path git sees, so the page's tree is the project's tree, while numbers exist
only for the files that became columns (`CHANGELOG.md` 2.2.0).

The tool grew out of one script in the consumer project [`safe-resets`](../figma/safe-resets) — the
metrics `raw` and "a simplification instead of minification", a static report in git; that path
does not exist in this repository, and it is not named anywhere without the project.
**A project whose code is JavaScript modules in `.js` reports too**: the stripper's guard understands
both forms, a script and a module, so connecting needs no setting edited by hand, and when the graph
really is not JavaScript the refusal names the cause and the command. Hints, the help text, the
default fix command and the templates name the **path inside the project**
(`node node_modules/@vernikr/size-report/bin/size.js`) rather than the package name: `npx <name>`
runs an installed package only while it is there, and in a project without it the name goes to the
registry and pulls a package over the network.

**What the documentation promises is checked, not assumed**, and the promises are split one per file:
existence and completeness of paths (`test/docs-paths.test.js`), commands, refusal causes and section
links (`test/docs-commands.test.js`), the count of checks (`test/docs-numbers.test.js`), the install
example leading to a revision whose help knows the named commands (`test/docs-pin.test.js`) and, with
the releases, the version of the manifest and the table of what changes in the numbers
(`test/changelog.test.js`). One reader of facts serves them all (`tools/docs-facts.js`). What a
machine cannot check — wording, promises about the future, whether a file's role is described
correctly — the guards do not take on, and they say so in their headers.

**git is read through one boundary, in the checks too**: the list of pins (`core.quotePath`,
colouring, the signature block, the encoding) is one for the engine and for the harness, so the
checks and the tools reach git through a common place — and an unpinned place is guarded by
`test/git-pins.test.js`, which also shows by witness that a pin works: the same read without it
returns a non-English path quoted. It is the same defect as B1, only found in the harness: without
the pins a check is green on a machine with our settings and red on a machine with the default ones.
The check that measures the environment itself keeps its unpinned read deliberately — it is named,
and it stands in a list of its own.

**Every refusal of the tool tells the truth, and that is guarded rather than assumed.** A false cause
in a refusal text was found by a live run, four times in a row, each time by accident — so the class
is closed not by a fifth fix: `tools/refusals.js` holds a line per refusal saying what it must
convey, which code to answer with and which phrases must stay in the output, and two checks split
that promise. `test/refusals.test.js` **calls** each refusal and compares the exit code and the
phrases; `test/refusals-catalog.test.js` reads the sources and requires a catalogue entry for every
refusal site — the maps `SITES` and `PRINTED` hold the counts — and a case in the catalogue for every
entry, so a new refusal cannot appear without a check. Refusals a run cannot reach are named
explicitly: four are guarded by a check of their own (the catalogue names the file and the phrases),
and one cannot be caught at all — "internal error" — which is said where it stands. What the
catalogue does not take on is said in words: wording beyond the listed phrases, and meaning, and the
"!" sign, which is a note (an approximation, a mixed commit, the automation switched off) rather
than a refusal, with exit code zero.

**And the advice in a refusal is executable — that is checked as well.** The truth about the cause is
half the promise; the other half is that the suggested command can be run. A live case started this:
a hint called out to a registry name no package carried, and in a project without that package
installed it ran someone else's code. Now every catalogue case says what the refusal advises, and the
advice is executed in the state that printed it: the exit code is compared (including "the refusal is
gone" — the same call after the advice must answer differently), while an advice that is a form
without values is checked against the help output (the same commands and flags). Advice a person has
to carry out is named with its reason — editing settings, committing, installing a dependency — and
that is said there too, in the catalogue. A new advice inside an existing refusal cannot pass
silently: the advice is taken out of the output by its markers, and it has to have a catalogue entry.

**A module no longer costs a Node process per cell**: the guard parses a module through
`vm.SourceTextModule`, which exists only under `--experimental-vm-modules`, and that is where the
per-cell process came from. Today one worker thread parses the modules for a whole run, and the price
has not disappeared but become one-time; the parse also rests on an experimental API (without it the
guard falls back to `node --check`: slower, no softer). What a run costs today the run prints itself
(`pnpm run suites:measure`).

**The checks' shared part lives in one place** (`tools/harness.js`): one clone of the fixture per
environment rather than one per check, a read-only run of the tool is not repeated, and a check that
edits files takes a clone of its own. The files go in a pool over the cores (`tools/run-tests.js`),
and the numbers add up: the run counts the checks of every file against the `test(` declarations in
it, so a file that did not run is a failure rather than fewer checks.

**There are two runs, and the choice between them follows the price of a file, not the alphabet.**
The cost of a check here is not the size of the file but how many times it launches the tool and git:
a launch is a Node process, while cloning the fixture or building the artifact takes hundreds of
milliseconds. So the fast run gathers what it proves from reading (sources, tree, help, reference
numbers on a shared fixture), and the full one adds what runs the tool many times on its own clones,
commits and installs hooks; the reason for each expensive file is named line by line in
`tools/suites.js`.

| Run | Command | Checks |
|---|---|---|
| Fast — every edit | `pnpm test` | **72 of 177** |
| Full — release and CI | `pnpm test:all` | **177** |

No check is lost or weakened: the full run starts all 177 with the same files, the fast one takes part
of them. The default is the full run — a file becomes fast only explicitly and with a reason — so new
expensive work cannot quietly move into the fast one. Two declarations guard that:
`test/suites.test.js` (every file classified, and a reason for each) and the documentation guard
`test/docs-numbers.test.js` (the numbers in the table above).

**The runs have no time targets, and that is a decision rather than an omission.** Seconds depend on
the window — the machine is under very different load at different times — so neither the suite nor CI
fails over time, and this document promises no seconds: `pnpm run suites:measure` prints every file's
duration in a run of its own (and a run prints it next to its tick), but that is a measurement, not a
threshold. The split rests on what a file is about rather than on how long it takes. CI calls the full
run twice: in the usual environment and with none of the machine's settings
(`GIT_CONFIG_GLOBAL=/dev/null`).

**What the package promises is down to fact.** The shipped-file list named four paths the repository
does not have (`dist/`, `templates/`, `CHANGELOG.md`, `LICENSE`): today it promises only what exists —
`templates/` and `CHANGELOG.md` came back into the list together with their files, not before them —
while `pnpm run pack:check` checks it from both sides, that the list names nothing absent and that the
tarball carries nothing the list does not promise. Taking both references works again (`pnpm run
parity`, `pnpm run fixture`) and no longer depends either on whether the consumer project keeps a copy
of the tool or on the machine's git settings. Two texts that promised the same were fixed as well: the
`--init` hint (it said the checks travel with the package, while the suite is not part of it) and the
default `fixCommand` (it named a package that does not exist, `npx size-table --write`).

**The checks run themselves** (`.github/workflows/ci.yml`). On every push and every pull request one
job `verify` calls **one command** — `pnpm run verify`; the list of steps lives in one place
(`tools/gates/run.js`) and matches the local one, so a check that is not in a profile cannot be in CI
(`test/gates-verify.test.js` watches that). The profile, in order: the strict linter, the bloat
sensors, the whole suite, parity with the history of the consumer project, reproducibility of both
references and the work from the assembled tarball. Two steps are dearer and live in the slow profile
instead — the same suite in an environment with none of the machine's git settings
(`GIT_CONFIG_GLOBAL=/dev/null`) and coverage under c8: `pnpm run verify:slow`,
`.github/workflows/verify-slow.yml` on a schedule. The job needs no secrets: the consumer's history
lies in the repository as a bundle at the revision recorded in the reference (`fixtures/live/`), and a
re-take goes into a temporary directory and is compared with what is committed, so the working tree
stays clean. The job pins Node 22 and the actions by commit SHA, and there is deliberately no matrix
over Node versions: this pass is about control.

**A release is a tag** (`.github/workflows/release.yml`). Pushing `v<version>` runs the strict linter
and the whole suite, checks the work from the assembled package, compares the manifest version with the
tag and sends the package to the registry — no secret and no code from an authenticator: publishing
goes by the attestation GitHub Actions issues for that job (trusted publishing), which npm accepts
instead of a token. A prerelease goes to `next` rather than `latest`, so a draft is not what a default
install picks up. The publisher is set up once and lives on npmjs.com, not in the repository:
`npm trust github @vernikr/size-report --file release.yml --repo vernikr/size-report
--allow-publish` (the same is the Trusted Publisher button in the package's settings), and
`npm trust list @vernikr/size-report` shows whether the link is there. The job raises no version: a
person names it in the manifest and `CHANGELOG.md`, and both are compared with the tag rather than
derived from it.

One trap cost an edit of its own, and it is about `setup-node` rather than this package: with
`registry-url` the action writes `_authToken=${NODE_AUTH_TOKEN}` into `.npmrc`, npm then considers
credentials given and does **not** go for the OIDC attestation — publishing fails 404 with a correctly
set-up publisher. So `registry-url` is not given here: npmjs.org is the default registry anyway, and
`publishConfig` in the manifest carries `access: public` only. A draft run from Actions ("Run
workflow": nothing is published by default) goes the whole list up to the publishing step itself — the
strict linter and the whole suite, the work from the tarball, and a package built on a draft version
above the manifest's own, so that the registry does not refuse an already released number. Whether the
publisher is set up a draft run does not show: `--dry-run` exchanges no attestation and passes without
any credentials at all — only a real tag tells the truth about that.

**Two rules came out of the first live runs of CI, and both are about the border of a call.** Process
output is collected by the harness rather than glued into a string: a multi-byte character torn at a
chunk border would turn into two replacement characters, and where those chunks fall is the kernel's
business — a local run does not show it (`test/runner.test.js`). And of the references only what this
repository writes by itself is compared byte for byte: a history bundle is packed by git, whose bytes
depend on its version, so the bundle is compared by content — the branches, the tip and the number of
commits, that is, what makes it a replacement for the consumer project. The bundle also has to carry
`HEAD` and the branch `main` at the reference revision, or a clone decides on its own which branch to
lay out (`tools/check-standards.js`).

**The report page looks and behaves like a tool.** One set of table styles serves both outputs
(`src/table.css`), so the page took over the sticky header and commit column the static artifact
already had, and its commit column narrows in a narrow window instead of pushing the table sideways.
The page says so in words when there is nothing to assemble a table from — every metric or every file
switched off — and its switches are labels around inputs, so a mouse, `Space` and assistive technology
all reach them. The colour of a delta is defined once: growth green, fall red — changing it is two
lines in `src/table.css` plus re-taking the artifact's reference, and no other place holds a colour.
The one place where the page departs from the shared geometry is its "adaptations" section, and every
departure stands there with its reason: the shared part is frozen by the artifact's bytes (`src/css.js`).

**The left panel is the project's file tree.** It is built from the catalogue — every path git sees —
rather than from the columns, so it also shows what did not make it into the report: such a leaf, and a
folder with nothing to measure in it, keeps its place with the checkbox off and unavailable, and the
tooltip names the reason — the package's rule or the project's choice. Off rather than absent: the
rows stay even (the eye compares like with like) while unavailability says this is not the reader's
choice. The report itself is always in the catalogue, whether or not it is tracked: that is a property
of the moment, and the page must not depend on it, or the first rebuild in a fresh clone would give
different bytes. A folder whose files are only partly in the report writes its count as a fraction
("2/5"), and everything outside the report stands after everything inside it — folders and leaves
alike — so that the report is seen at once in a list where half the rows do not switch
(`test/page-tree.test.js`).

**A folder is a switch like a file, and its sign is a decision of its own.** The checkbox of a folder
carries its whole subtree and shows three states — every file on, some, none — with the number of files
next to it. Neither a folder nor a category button keeps state of its own: both flip the same file
checkboxes, so the tree, the buttons and the table cannot drift apart. The sign beside a folder answers
a different question — how much of the tree is visible, which is the onlooker's business rather than the
reader's choice — so it is remembered between visits in a record of its own, under a key of its own and
the same report passport, and it never goes into the link; unfolding every folder removes that record,
just as turning the checkboxes back on removes the choice.

**The list scrolls, and there is one scroll.** On a narrow window it is the file list that scrolls —
the panel grows with the page there — while on a wide one the whole panel does: otherwise the controls
would push the table off the screen. Folders fold because the tree is longer than the window; otherwise
its middle is out of reach.

**Folding is pure view, and it counts no numbers.** The subtree lies in the markup and a class on the
row hides it, so a click on the sign changes exactly the three things the reader sees — the class, the
sign and the note in the memory. A rebuild here would be honest work for nothing: it counts the whole
table, every row by every column, and so pays for numbers folding does not change. What guards this is
that after folding the table is the same markup rather than a rebuilt one (`test/page-tree.test.js`).

**The columns the last commit touched come first.** The report is rebuilt after every commit, and a
reader's first question is what that edit brought. The mark comes from the history rather than from the
numbers — an edit that changed no size is an edit too — and it is taken from the last commit that
touched at least one column, counting back from the top: a commit that went past the columns, above all
the report itself, which the hook commits, is skipped, or the mark would depend on the report's own
commit, the same run would give different bytes and the hook would commit the report a second time.
Inside each part the order stays as it comes from the settings (the sort is stable): the order of the
columns is what the reader is used to, and his choice of files does not rearrange it
(`test/page-view.test.js`, the contract's `last` field).

**On a wide window the panel stands to the left of the table and takes no room from the numbers** (from
900px, `src/page/app.css`). That is not decoration: a desktop has much side room and little vertical
room, so the switches, the tree and the numbers are visible at once, and neither scrolling the numbers
nor scrolling the tree takes the controls off the top of the screen. The layout is a grid on `body`
rather than a wrapper in the markup — the page is assembled by pasting chapters, and the page's shape
should live in one place. The grid has five rows, named by subject (the heading, the message about a
link, the working row, the empty state, the note), and only the working row stretches: the table takes
all the remaining height and the panel no more than that, scrolling inside itself rather than pushing
the table off the screen. The narrow half starts at 899px rather than at 900px, so that at exactly
900px the two halves cannot apply to one page — they once did, and the table's height ceiling survived
from the narrow one, leaving empty space under the table at that single window size. What guards the
numbers behind the layout is the contract rather than the markup: switching a folder off removes exactly
its columns and exactly its volume from the total (`test/contract.test.js`).

**A checkbox takes away neither the numbers' room nor the reader's place in the list.** The panel is
drawn anew after every switch, so its scroll and the list's are part of the view like the checkboxes:
both are saved before the rebuild and set back after, and the field under the keyboard comes back with
its focus (without scrolling — `preventScroll`), or switching with `Tab` and `Space` would mean walking
the panel from the start again. The file list has no ceiling of its own in a wide window: the panel
scrolls, and the list does not push the table. The row of categories sticks to the top of the panel,
with the panel's own background (or passing rows of the list would read through it), and the panel's own
top padding lives on its first field, which travels away with it. File captions use the table's font size
(12.5px), and the legend under the tree is gone on purpose: below the list it pushed the numbers away,
while what it explained already stands next to the thing it explains — the sign of a number names the
colour of a delta, accuracy stands under the metric switches, and the mark of a gap lives in the cell's
tooltip.

**The panel remembers the reader's choice.** The record lives in the browser's memory, tied to the
report's passport — the tool's name, the data schema, the artifact's path, the title and the column
labels, hashed into the record's key — so reports in one browser do not see each other's choice (all
`file://` pages share one memory, so this is no trifle). Inside the record the choice is held by names —
a file by its path, a metric by its key — and only what is switched off: a column pointed at another path
or a metric dropped from the settings simply matches nothing, what appeared stays switched on, and
turning everything back on returns the page to its default and removes the record. The first reader —
and a reader whose record is broken or outdated — gets exactly the default, and the choice affects
neither the numbers nor the markup. The passport holds neither the tool's version nor the top of the
history, and on purpose: updating the tool does not change what a column means, while a grown history is
the very history the reader comes back to.

**The same choice travels as a link.** The page's address is the link: the record that goes into the
browser's memory goes into the anchor too (`#size-report=…`), so the sender copies the address and the
recipient sees that choice with no action at all. The link outranks the memory — it is the sender's
explicit choice — while it does not replace the reader's own until he changes something. A foreign or
broken address is not applied, and is not silent either: a line above the table names the reason ("the
link was made in another report" / "the choice in the address is unreadable"), the view stays the
reader's own, and the incoming address is not rewritten; names the report does not hold are reported by
count, skipped, and the rest is applied. The link works on an already open page as well: the browser does
not reload the document when the anchor changes, so the page reads the address itself, or a link would
only work in a new tab. The page makes no request to the network at all, and that is an assertion of a
check rather than a promise (`test/page-view.test.js`, `test/parity.test.js`).

**The `min` metric can count for real.** The way of counting is chosen in the settings:
`"minify": {"engine": "esbuild"}` minifies JS/TS/CSS for real through an optional dependency, while
`"engine": "strip"` is the earlier removal of comments and indentation. The default did not change,
because both frozen references were taken under it. Measured on the fixture: real minification is
smaller than stripping in **44 cells and never larger**; `src/code.js` **276 → 185 B**, `src/style.css`
**55 → 43 B**, and over the fixture's history **−1 372 B**. JSON is minified by parsing and so stays
exact, while the formats the minifier does not take are named in the metric's caption together with the
ones it does take. Accuracy is declared twice, and that is not two answers to one question: the caption
speaks of **the worst in the column** — one format without minification makes the metric approximate as
a whole rather than hiding behind an exact neighbour — while each cell speaks of its own number, and an
approximate one is marked with a dashed line and the method in its tooltip. The worst is taken from the
cells rather than from the engine's name: a report of one JSON is exact even under stripping — parsing
loses only insignificant whitespace, and nobody would make it shorter — and the caption says so. Both
answers come from one rule (`pointExact` in `src/metrics.js`), so they cannot diverge. With no minifier
(an installation without optional dependencies, a platform without it) the metric falls back to
stripping, the method says so in words and the run answers **code 4** rather than staying silent, while
the numbers are the same as the earlier way of counting — byte for byte with the reference. The derived
profile leads new projects straight to minification (`--init` pins the same), its hint names that price,
and the report itself stays out of the columns there: a column that is the table is refused by the
settings check. A file the minifier could not parse (markup in `.js`, syntax it does not know) is a
refusal with code 2 whose text names the file, the minifier and its own cause, and whose advice gives a
ready way out — assign simplification to that extension.

**The `tok` metric counts tokens with a real dictionary.** Tokens are the report's third measure: what a
file weighs for a language model. The dictionary is chosen in the settings
(`"tokens": {"family": "openai", "encoding": "o200k_base"}`), and the encoding is part of the number
rather than a detail: on the fixture `src/code.js` is **168 tokens** under `o200k_base` and **196** under
`cl100k_base`, which is why the encoding is named next to the family and the metric's method quotes
exactly the one that produced the number. Tokens are neither bytes nor minification, and the difference
is shown rather than smoothed over: the same cell is **735 B** `raw`, **276 B** stripped, **185 B** really
minified and **168** tokens, while bytes per token differ between files by **2.5 times** (from 2.56 in
`package.json` to 6.30 in `crlf.txt`) — that is, the text is counted rather than a ratio. The family is
single in this version, `openai`: the others have no dictionary that could be called their own, and
counting with someone else's while calling that a family would promise what does not exist. There is no
dictionary switch on the page, and on purpose: the page gets ready numbers and counts nothing itself,
and it has nothing to count tokens with. Counting every family on every run would pay time for numbers
the reader may never ask about, so the choice of family and encoding lives where it costs time — in the
run's settings — while the page **names** it: the method of each metric stands under the switches as
text rather than only in a tooltip. Formats without text (a picture, a font, an archive) are named in
the metric's caption together with the reason: their number goes by bytes, the cell of such a file is
marked by the same rule, and the caption takes the worst in the column — two answers have nothing to
diverge with. With no dictionary (an installation without optional dependencies, a platform without it)
the count is an estimate by length with the coefficient named in the method, and the run answers **code
4**; the other metrics stay what they were in a report without tokens, and that seam is checked in an
environment with no optional dependencies at all (`SIZE_REPORT_NO_OPTIONAL`). Counting tokens costs a
run time, and that is the honest price of the dictionary rather than of parsing: its tables are read
once per process while the counting is per file and per row, so the price grows with the history and not
with the dictionary. The derived profile leads new projects straight to tokens.

**Two conveniences of the command line are guarantees rather than accidents:** `--help` answers
wherever it is asked, and `--write` creates the report's directory when it is missing.

**Two commands answer about the history: completeness and explanation.** `size check` answers whether
everything in the history got into the report: every path the history touched has to be a column or a
declared exception, and a path that is neither is a violation — code 1, the path, the commit that
introduced it and a ready fix. The same answer carries the summary of dropped commits — how many and
why — and their shas, that is, how much of the history is covered. Coverage is counted over the facts of
the history — the union of the changed paths of every commit — rather than over the file list in the
tree: a file created and deleted before HEAD is invisible there while the history remembers it, and its
edits went into no number at all. What the tool does not claim is said in the same place: not that the
project picked the "right" columns, only that nothing went past them, and what exactly did not fit.
`size explain <commit>` answers about one commit — named by a revision (`HEAD`, a branch, a tag,
`HEAD~1`), by a sha or by its beginning — saying whether there is a row (and which) or why there is
none: only the report itself was touched, the numbers did not move although column files were touched,
no file of the commit is tracked as a column, or the commit is a merge and merges are hidden by
`rows.merges`. Both take the reason from the same run the reports come from, and the evidence from the
commit's list of changed paths: what the history does not hold, the answer is silent about instead of
guessing. Completeness comes from the requirements, and it also replaces the "artifact ↔ history"
control: the report need not be kept in git. The meaning of `skip` has not changed, but its **reach has
widened**: it is not only "paths that cannot be columns" but also the declared exceptions of
completeness — one and the same list, and forging a second tool for it was not necessary. The price is
named: `check` costs a pass over the history, like any report. Next to them stands `size doctor`, the
diagnostics in one answer.

**The report updates itself.** `size install-hook` installs two hooks, `post-commit` and `post-merge`
(`post-commit` does not run for a merge at all, which is why one file is not enough), and after every
commit and merge the report is rebuilt, while the copy lying in git lands as **a commit of its own**:
the manual step "code, then the table" is gone. The report's commit is assembled with git's plumbing
(`commit-tree`), so neither the index nor someone else's uncommitted work can get into it, and a loop is
impossible by construction rather than through an environment flag. A refusal of the tool does not bring
the commit down: the cause is printed as one line and remembered — `size doctor` shows it.

The move, the refinement and the packaging are laid out step by step in `PLAN.md`, with acceptance for
each.

## What is in the repository

| File | Role |
|---|---|
| `PLAN.md` | **The main document:** inventory, boundaries, invariants, architecture, the seven steps of the move, acceptance, risks, open questions |
| `docs/requirements.md` | The customer's requirements: what and why |
| `docs/module-design.md` | The design of the extraction: how the module is put together |
| `docs/size-report.html` | The size report of this very project: one self-contained file, refreshed by the hook after every commit (as a commit of its own) |
| `worklog/` | The journal of requests and of what was done: an entry per portion of work, named `NNNN-slug.md`; `worklog/archive/WORKLOG.md` is the earlier journal in one file |
| `docs/plans/` | Plans of work: a folder `yyyy-mm-dd-name` per piece of work, holding the main plan and its subplans |
| `BLOCKERS.md` | Open blockers and known gaps (a workaround has to rest on a check) |
| `REFACTOR.md` | The per-channel plan of the cleanup: size of the code first, speed after; the boundaries and what proves that the behaviour did not change |
| `CHANGELOG.md` | The history of releases and, for each release, a section on what changes in the numbers: whose figures move and why |
| `tools/parity-freeze.js` | Takes the parity reference (`pnpm run parity`): with the frozen copy, at the project revision from the manifest — `--json`, the config, the artifact's hash, the tool's hash |
| `tools/make-fixture.js` | Assembles the synthetic fixture (`pnpm run fixture`): a deterministic history with traps plus the reference numbers |
| `tools/synthetic/` | The subjects of that assembly, one per matter: `repo.js` — how git is spoken to (pinned time, author, settings), `content.js` — what the files hold, `history.js` — which commits come of it, `note.js` — the fixture's note with the list of traps |
| `tools/parity-live.js` | Compares the engine with the live project on a clone: the numbers and the self-contained report at the path the consumer's settings give (`pnpm run parity:live`) |
| `tools/pack-check.js` | Assembles the tarball and checks that everything works from it: all sources arrived, the numbers and the report as from the repository (`pnpm run pack:check`) |
| `tools/check-standards.js` | Checks that both references reproduce: a re-take goes nowhere and is compared with what is committed (our files byte for byte, the bundle by content), and that the live-history bundle carries `HEAD` (`pnpm run check:standards`) |
| `.github/workflows/ci.yml` | CI: the job `verify` calls `pnpm run verify` on every push and every pull request — the same profile as locally; the actions are pinned by commit SHA |
| `.github/workflows/verify-slow.yml` | The slow profile on a schedule: the same plus the same suite with no machine git settings and coverage under c8 — the dear steps, not in every run |
| `tools/gates/run.js` | The check profiles — the single list of steps: `fast` (every edit), `full` (before pushing and in CI), `slow` (+ the hermetic suite and coverage); `--list` prints the commands |
| `tools/gates/metrics.js` | The bloat sensor: rules of size and complexity, the weight of checks, debt marks — with an ESLint suppression ratchet (`.eslint-suppressions.json`) |
| `tools/gates/dup.js` | The duplication sensor: clone fingerprints by content (`dup-baseline.json`), a view against the baseline file and one against the `origin/main` tree |
| `tools/gates/deps.js` | The dependency sensor: cycles, orphans, the direction of layers and unresolvable imports (`dependency-cruiser`) |
| `tools/gates/coverage.js` | The coverage sensor: a per-file ratchet against `coverage-baseline.json` rather than a percentage over the repository |
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
| `src/table.css` | The report's table: the geometry of a cell, the sticky header and commit column, the colour of deltas |
| `src/page/app.css` | The page's styling on top of the shared part: the panel with the file tree and its sticky row of categories (a column on the left on a wide screen, the page fitting the window), the empty states, a narrow window |
| `src/page/state.js` | The page's state: the report's data, the view of the checkboxes, the pointer "which path is which column", folded folders, the record's passport, the browser's memory and the exchange by link — a chapter of the page's program |
| `src/page/dom.js` | The page's nodes: the small helpers of markup (`appEl`, `appBox`) — one set for the panel and the table alike |
| `src/page/panel.js` | The panel of choices: the switches of metrics and files, the categories, the tree of the project's paths (files outside the report keep a checkbox off with a reason and stand after the rest; folders carry a folding sign that hides the subtree by a class rather than by a rebuild); a redraw is asked of the assembling chapter |
| `src/page/table.js` | The page's table: a cell, a commit's caption, the header and the empty states — markup over the shared calculation |
| `src/page/app.js` | Assembling and starting the page: the whole table, a redraw on the reader's choice (with the focus and the scroll put back), the first drawing and an anchor change; pasted into the assembled page |
| `src/page/build.js` | Assembling the page: data, styling and program in one file with no external references |
| `src/git.js` | The only border where git is called: the pinned settings, blobs by the batch, the history, the comparison with the working tree |
| `src/strip.js` | Removing ballast: which form goes to which file (extension, strategy) and what counts as an exact number — the entry to the parsing of forms |
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
| `src/data.js` | The file categories and the contract with the page (`--data`): the numbers, the shape of the table and the catalogue of the project's paths |
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
| `tools/page-harness.js` | The harness of the contract and page checks: the contract data, the assembled page, reading it in a real DOM, the panel's switches — one for five suites |
| `tools/suites.js` | The split of the suite: which files go into the fast run (with a reason for each) and why every dear one is in the full run |
| `tools/run-tests.js` | Running the suite (`pnpm test`, `pnpm test:all`, `pnpm run suites:measure`): each file's duration measured on its own, and the counts of checks adding up |
| `tools/docs-facts.js` | Reading facts out of the documentation — one layer for the four checks of the documentation guard: what a document names (paths, calls, section addresses) against what the repository holds |
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
| `test/contract-data.test.js` | The data contract: the numbers against the reference, the set of fields against the derived quantities, the marks of approximation against a metric's caption |
| `test/contract-derived.test.js` | The derived quantities against the artifact's numbers: a row's totals, a cell's delta and the delta of a total — on the code that lies in the tree |
| `test/page-view.test.js` | The assembled page: pasted with no copy of the calculation, self-contained, the empty states, the styling and the switches |
| `test/page-tree.test.js` | The panel's file tree: folders by the project's paths, three states, the subtree, files and folders outside the report (a checkbox off, a place after the rest), folding without a rebuild and the scroll across a rebuild |
| `test/page-choice.test.js` | The memory of the choice and the exchange by link: a revisit, someone else's report, a foreign and a broken record, an address change on an open page |
| `test/module.test.js` | A module under a `.js` extension: measured without touching the settings; the stripper's guard is alive (proved by mutation) and does not accuse the innocent |
| `test/guard.test.js` | Parsing a module: it goes through a thread, both paths give one verdict, the fallback works with the thread's file away, and hundreds of parses are cheaper than a launch |
| `test/runner.test.js` | Reading a process's output: chunks are glued as buffers rather than appended to a string — a multi-byte character at a chunk border does not turn into two replacement characters |
| `test/git-pins.test.js` | The guard of the git border: no direct calls to git outside the shared list of pins, and an unpinned read is shown by a witness (a quoted path) |
| `test/docs-paths.test.js`, `test/docs-commands.test.js`, `test/docs-numbers.test.js`, `test/docs-pin.test.js` | The documentation guard, one file per promise: the paths and the file table; the calls, the causes of refusal and the section addresses; the counts of checks; the pin in the install example |
| `test/changelog.test.js` | The release guard: the version in `CHANGELOG.md` is the manifest's version, and the table of what changes in the numbers is a measurement on the fixture compared with a live run |
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

## Чего ещё нет

```text
dist/app.js        пре-собранная программа отчёта для публикации
size init/measure  командами вместо флагов: сейчас командами стали только check, explain, doctor и хук
блок для агентов   инструкция агенту проекта: требования её не просят, поэтому в шаблонах её нет
минификация HTML   минификатор разметки: пока HTML считается упрощением (шаг 3)
JSX и TSX          выход зависит от настройки jsx самого проекта — упрощение (шаг 3)
семейства токенов  кроме openai: у остальных нет своего словаря — считали бы чужим (шаг 4)
```

Швы между модулями проходят по границам данных: сверху — то, что читает git и
файловую систему (`git`, `strip`, `metrics`, `history`), ниже — то, что работает на
уже собранных значениях (`data`, `render`, `page`), а настройки, тексты и отказ —
по краям, потому что их знает любой и они не знают никого. Оба отчёта считаются на
сборке: страница получает исходники общего расчёта и своей программы вклеенными
(`src/derived.js`, `src/page/*.js`), потому что открывается она с диска, без
сервера и без сети. Остальное — по шагам 2–6 (`PLAN.md` §5).

## Как подключить к своему проекту

Инструкция проверена покомандно на свежем проекте (три коммита, ESM в `src/`,
`pnpm`): ниже — ровно те команды, которые работают сегодня. Всё, что сегодня
**не** работает, названо здесь же и с причиной, чтобы это не искали опытом;
каждый такой случай — отдельный пункт `REFACTOR.md`.

Эта же инструкция — рецепт для шага 5 (`PLAN.md`): интеграция в проект-потребитель
идёт по ней, а не по памяти.

Нужны: **git-репозиторий с историей** (хотя бы один коммит — таблица строится по
коммитам) и **Node ≥ 20.19** (`engines` пакета).

### 1. Установка

```bash
pnpm add -D @vernikr/size-report
```

Пакет **опубликован в реестре**, и публично: `npm view @vernikr/size-report
version` отвечает `2.4.0`, `npm access get status @vernikr/size-report` — `public`,
а анонимный запрос тарболла — код 200. `npm i -D` и `yarn add -D` принимают то же
имя; ни ключа, ни ссылки на репозиторий не нужно.

Тот же выпуск можно взять ссылкой на репозиторий — так установка не зависит от
реестра, но остаётся привязанной к ревизии:

```bash
pnpm add -D github:vernikr/size-report#v2.4.0
```

Без сети (или если тянуть из codeload нечем) — тарболл: `pnpm pack` в клоне
пакета, затем `pnpm add -D ./vernikr-size-report-2.4.0.tgz`.

**Почему тег, а не sha.** Короткий sha pnpm разрешает только через видимые рефы, а
`git ls-remote` отдаёт одни верхушки веток: пока ревизия — верхушка, короткий sha
работает, а как только ветка ушла вперёд, установка падает с `Could not resolve
<sha> to a commit`. Это не рассуждение, а проба: короткий пин `6530237` ставился,
пока `main` стоял на нём, и перестал — на следующем же коммите, а тот же sha
целиком поставился. Имя ветки (`#main`) или тег принимаются оба, но ветка —
движущаяся цель, а тег постоянен: этот выпуск стоит на теге `v2.4.0`, он же и в
примере (сорок знаков тоже годятся, но их придётся брать глазами из истории).

Ревизия в примере — не украшение, а часть утверждения: она закреплена за тем, что
описано ниже. Пин старше подкоманд (`check`, `doctor`, `explain`, `install-hook`)
означал бы, что текст учит командам, которых в установленной ревизии нет, а
лишнее слово там не отвергается, а молча пропускается — то есть вместо отказа
человек получил бы ноль и решил, что всё в порядке. Поэтому пин берётся не «какой был под рукой», а
ревизией, в которой есть всё названное ниже — включая отказы на незнакомое слово. За этим следит сторож документации (`test/docs-pin.test.js`): пин обязан вести
на ревизию этого репозитория, и все названные в тексте команды обязаны быть в её
справке.

Репозиторий пакета **публичный** (приватным был до 2026-09-14), и это ровно то,
что упрощает установку: ни ключа разработчика, ни шага в CI с доступом. Проверено
прогоном в пустом проекте, где у git не было ни глобальных настроек, ни
помощника учётных данных (`GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
GIT_SSH_COMMAND=false`): установка 3,4 с, дальше `size --write` и `size` работают
(`WORKLOG.md` §44). Прежнее требование было ценой приватности: локально — ключ, а
в CI — read-only deploy key перед `pnpm install` (то самое первое подключение,
`WORKLOG.md` §18); шаг с ключом из шаблона ушёл вместе с приватностью. Публикация
в npm сделана 2026-09-15, и у неё была цена: имя `size-report` в реестре занято чужим
пакетом (2017 год, три версии), поэтому выкладка — это ещё и смена имени на имя в
области владельца (`@vernikr/size-report`), а не только отправка архива; что
затронуло переименование — `PLAN.md` §10, чем доказана выкладка — `WORKLOG.md` §53.

### 2. Настройки: их можно не заводить

```bash
pnpm exec size --write     # таблица; настроек нет — их выведет сам инструмент
pnpm exec size --init      # закрепить выведенное в size-table.config.json
```

Начинать с настроек не нужно: без файла инструмент выводит их из проекта — колонками
берёт **каждый отслеживаемый git файл, который можно измерить** (отчёт называет
объём проекта, а не выборки из него; границы остались только у того, что колонкой
быть не может: сам отчёт, замки зависимостей, собранное, незнакомый формат и файл
сверх 512 КБ), а прочие называет в `skip`, журналом —
первый знакомый (`WORKLOG.md`, `CHANGELOG.md`, …), файлом отчёта — `docs/`, если
каталог есть, командой починки — объявленный скрипт `sizes`, а без него — путь
к установленному пакету (его цитируют подпись отчёта и отказы, поэтому он обязан
работать уже сейчас), ссылкой на коммит — адрес `origin`, метриками — `raw`, `min`,
`tok`. Метрика `min` считается настоящим сжатием (`"minify": {"engine": "esbuild"}`),
а `tok` — словарём (`"tokens": {"family": "openai", "encoding": "o200k_base"}`): без
этих необязательных зависимостей метрика честно отступает к другому счёту и прогон
отдаёт код 4 — правки настроек и тут не требуются.

Всё, что колонкой быть не может (сам отчёт, замки зависимостей, карты, собранное,
незнакомый формат, слишком крупный файл) и чего git не отслеживает, называется
в `skip` — поэтому первый же `size check`
полон, а не красен: «пути мимо колонок» появляются от новых правок, а не от того, что
проект ещё не описан. О том, что настройки выведены, инструмент говорит строкой в
stderr и называет команду, которая их закрепляет, — `--init`; закреплённое проходит
ту же проверку, что любой файл настроек, и дальше его правят глазами (сам `--init`
печатает, что закрепил, и что делать дальше — скрипты и проверку в CI). Без
закрепления профиль выводится заново на каждом запуске: числа не «поедут», но
повторить прежний замер — в том числе хуком и проверкой — можно только по файлу.

Закрепляется **то же, чем проект работает без файла**: вывод из проекта поверх
умолчаний. Поэтому в закреплённом файле видны и значения, которых в проекте никто не
писал, — тогда смена умолчаний в новой версии пакета не поедет по уже настроенному
проекту молча.

> Subкоманды `size init` пока нет — CLI знает только флаги (`--init`, `--write`,
> `--data`, `--json`, без флага — проверка); полный список даёт `size --help`.
> Subкоманды — шаг 5 плана (`REFACTOR.md` R-4.5).

### 3. Что правится в конфиге

Вывод знает про проект только то, что видно в дереве и истории, — какие колонки важны,
знает человек. Чаще всего правят:

| Ключ | Что это |
|---|---|
| `columns` | колонки таблицы: `{label, paths: [...]}`; **колонка — это файл**: список путей — её переименования (в ревизии берётся тот путь, который в ней есть), а не несколько файлов разом; `label` — то, что увидит человек |
| `metrics` | из чего состоит число: `raw` (размер объекта git), `min` (минифицированная форма — какая именно, решает `minify.engine`), `tok` (токены), `gzip` |
| `tokens.family`, `tokens.encoding` | словарь для `tok`: семейство (`openai`) и кодировка (`o200k_base` или `cl100k_base`) — кодировка меняет число, поэтому она и в настройках, и в подписи метрики |
| `minify.engine` | чем считается `min`: `strip` (комментарии и отступы, точность не обещается) или `esbuild` (настоящее сжатие; форматы без минификатора — упрощение, и это видно в подписи метрики) |
| `output` | файл отчёта (в выведенном профиле — `docs/size-report.html`; каталог создаётся сам, имя отчёта — его имя) |
| `journal` | где искать разделы журнала, на которые ссылаются строки |
| `links.commitUrl` | шаблон ссылки на коммит, например `https://github.com/org/repo/commit/{sha}`; выводится из адреса `origin` у GitHub и GitLab (у остальных хозяев — пусто, а не догадка) |
| `skip` | пути, которые колонкой не стали: и те, что ею быть не могут (сам отчёт, замки зависимостей), и те, что в колонки не поместились (выведенный профиль объявляет исключениями всё остальное — поэтому первый `check` полон) |
| `fixCommand` | команда, которую цитирует подпись отчёта и подсказывает отказ; в выведенном профиле — ваш скрипт `sizes`, если он объявлен, иначе путь к установленному пакету внутри проекта (зов по имени пакета уходит в реестр — `REFACTOR.md` R-4.21) |
| `locale`, `title`, `heading` | язык текстов отчёта и его заголовки; пустые `title`/`heading` значат «взять из локали» |
| `minify.guard` | расширения, где результат стриппера проверяется разбором; модуль в `.js` гард понимает сам, трогать его не нужно |
| `hooks.enabled` | выключатель хука автообновления (`false` — хук не ставится сам и молчит, если уже стоит; убирается он только `size uninstall-hook`) |

Остальные ключи и умолчания — `src/config.js` (`DEFAULT_CONFIG`).

### 4. Скрипты и первый отчёт

```jsonc
// package.json
"scripts": { "sizes": "size --write", "test:sizes": "size" }
```

```bash
pnpm run sizes            # → docs/size-report.html — отчёт: таблица, фильтры, ссылка
```

Отчёт — один самодостаточный файл: открывается двойным щелчком, без сервера и без
сети (внешних ссылок в нём нет вовсе, данные, оформление и программа вклеены).
Производные (дельты, итоги, фильтры) считает сама страница — из абсолютных
значений, которые даёт движок, и тем же кодом, что и его расчёт.

**Порядок правок:** код → `pnpm run sizes` → коммит с одной таблицей. Таблица
обновляется **отдельным коммитом**, потому что строка коммита не может попасть в
саму таблицу: обновили её вместе с кодом — инструмент предупредит
(`! таблицу обновляли вместе с кодом: <sha>`) и назовёт коммит, который выпал.
Проверка `size` собирает таблицу заново и сверяет с файлом на диске, поэтому она
же ловит и забытую пересборку. Убрать отчёт из git совсем — шаг 5 плана
(`PLAN.md` §5).

### 5. Проверка в CI и перед коммитом

```bash
pnpm run test:sizes       # 0 — таблица сходится с историей
pnpm exec size check      # 0 — ни одно изменение не прошло мимо колонок
pnpm exec size doctor     # 0 — делать нечего; иначе первый по важности код
```

`size check` отвечает на другой вопрос, чем сама команда `size`: та говорит
«таблица совпадает с историей», а эта — «история вся посчитана»: каждый путь,
который трогали коммиты, должен быть либо колонкой, либо объявленным исключением
(`skip` и сам файл отчёта), иначе это **код 1** со списком путей, коммитом,
который путь завёл, и командой починки. Отчёт при этом не обязан лежать в git —
полнота и есть та проверка, которой заменяют «артефакт ↔ история».
Если сомнение вызывает один коммит, `pnpm exec size explain <коммит>` объяснит,
почему строки нет: тронут только отчёт, числа не сдвинулись, коммит мимо колонок
или слияние скрыто настройкой — с уликами и починкой, где она есть. Коммит можно
назвать так, как его зовёт git: `HEAD`, `HEAD~1`, имя ветки или тега, полный sha
или его начало. Если имя ведёт на коммит вне истории отчёта (другая ветка),
инструмент скажет именно это и назовёт его sha — а не «нет такого коммита».

`size doctor` собирает всю диагностику в один ответ: окружение и его влияние на
числа (настройки машины на числа не влияют — движок закрепляет их на границе
вызова), состояние необязательных зависимостей и что оно значит для точности,
годность настроек и полноту покрытия. Отвечает он теми же кусками, что и
остальные команды: блок покрытия — это ровно ответ `size check`, а не второй
расчёт. Код выхода — первый по важности, а не «что-то нашлось»: `2` настройки
нечитаемы (читать больше нечего), `3` история обрезана, `1` покрытие неполно,
`4` число приближённо, `0` делать нечего. Датчик, о котором настройки молчат,
назван ненужным, а не отсутствующим, и не загружается: словарь весит мегабайты,
а платить за строку ответа, которой у чисел не было, нечем.

В шаблонный CI (`templates/ci.yml`) полнота намеренно **не** входит: колонки в
шаблоне — пример, и на проекте, где колонки ещё не подобраны, такая проверка была
бы красной не по делу. Когда колонки обрисуют проект, её добавляют одной строкой
(`pnpm exec size check`).

Готовая строка для CI: `pnpm run test:sizes` — больше ничего не нужно: проверка —
это и есть команда `size`, своего набора тестов потребителю ставить не надо.
Подсказка `--init` говорит то же самое: проверка — команда пакета, своих файлов в
проект она не приносит.

В поставке лежит и готовое описание этой проверки: `templates/ci.yml` из пакета
(`node_modules/@vernikr/size-report/templates/ci.yml`) кладётся в
`.github/workflows/size-report.yml` без правок — сборка таблицы, сверка с файлом
на диске, два снимка чисел (обычный и в среде без настроек git) и их сравнение.
Секретов оно не требует. Для `npm`/`yarn` в самом файле сказано, какие две строки
заменить. Рядом — `templates/size-report.config.json`, образец настроек: колонки в нём
примерные (`README.md`, `package.json`), они есть почти в любом проекте, поэтому
первый отчёт собирается сразу. Нужен он, только если хочется начать с правленого
файла: без файла настройки выводятся из проекта (`--init` закрепляет выведенное).

Свой CI у пакета — `.github/workflows/ci.yml`: он гоняет у себя тот же список
команд, что описан ниже, и его можно взять за образец для шага потребителя.

| Код | Что случилось | Что делать |
|---|---|---|
| 0 | всё сходится | ничего |
| 1 | таблица разошлась с историей (или правка на диске не закоммичена); у `size check` — путь истории не отслеживается и не исключён | `pnpm run sizes` и закоммитить таблицу; для `check` — дописать путь колонкой или в `skip` |
| 2 | что-то в вызове или в проекте — **командная строка** (незнакомый ключ, ключ без значения, повтор ключа, два режима сразу, лишнее слово, команда и режим, неизвестная команда, несовместимый ключ, нет ответа в JSON, два ответа сразу, нет коммита); **настройки и проект** (нет файла настроек, настройки не разобраны, настройки неверны, нет git, не git-репозиторий, конфиг уже есть); **история** (нет такого коммита, коммит назван неточно, коммит вне истории); **хук** (чужой хук, чужой core.hooksPath, нечем звать инструмент); **измерение** (файл не JavaScript, минификатор не разобрал) | текст отказа называет причину и готовую команду — и она выполнима: это сторожит `test/refusals.test.js` |
| 3 | неполная история (clone с `--depth`) | полный клон: `git fetch --unshallow` |
| 4 | нет датчика | `minify.engine: "esbuild"`, а минификатора нет: числа получены упрощением. Отчёт собран, причина и починка — в тексте; если при этом таблица расходится с историей, код остаётся **1** (нарушение старше приближения), а заметка о другом счёте печатается рядом |
| 5 | внутренняя ошибка | это дефект инструмента: текст нужен нам, см. «Ловушки» ниже |

### 6. Отчёт обновляется сам после коммита

```bash
pnpm exec size install-hook     # поставить post-commit и post-merge
pnpm exec size uninstall-hook   # снять и вернуть проект к прежнему поведению
```

Хуки ставятся **сами**, и это единственное, что проект замечает от установки пакета:
после `npm i` — скриптом установки, у pnpm 10 — первым запуском инструмента (pnpm не
исполняет скрипты зависимостей: «Ignored build scripts»; разрешить можно
`pnpm.onlyBuiltDependencies: ["@vernikr/size-report"]` в своём манифесте). Ставшие
файлы живут в `.git`, `git status` их не видит, снимаются командой выше. После
каждого коммита и слияния отчёт пересобирается: каталог `docs` и файл `size-report.html`
создаются, если их ещё нет, а **отслеживаемый** в git отчёт ложится отдельным коммитом
с подписью `chore(report): отчёт пересобран после <sha>`. Коммитится только путь отчёта:
чужой индекс и незакоммиченная работа не тронуты.

Первый отчёт — исключение из «сам»: файл создан, но не закоммичен, потому что новый
файл в чужой истории — решение человека, а не услуга. Один `git add docs/size-report.html`
(или обычный `git add -A`, если отчёт нужен в проекте) — и дальше он едет коммитами сам.
Слияние обрабатывается тем же входом, что обычный коммит, но другим файлом —
`post-merge`: git создаёт коммит слияния сам и `post-commit` при этом не зовёт.

Зацикливания нет по устройству, а не по флагу: коммит отчёта собирается
плумбингом (`commit-tree` — хуков не зовёт), и сам отчёт строки не получает.
Выключается автоматика двумя способами — `"hooks": {"enabled": false}` в
настройках (хук остаётся, но молчит) или `size uninstall-hook`; в окружениях, где
обновлять отчёт не нужно (CI, чужая машина, зависимости не поставлены), хук молчит
сам и ничего не пишет в вывод коммита. Что он делает и чем кончился последний
запуск, видно в `pnpm exec size doctor`; отказ инструмента коммит не роняет —
причина едет одной строкой и остаётся в записи о запуске.

### 7. Ловушки, найденные этой же инструкцией

Две из них найдены прогоном и уже закрыты — они оставлены здесь как объяснение
поведения, а не как обходные пути:

- **Модуль в расширении `.js`** (`import`/`export` в `.js` — обычное дело в
  проектах с бандлером) измеряется как любой другой файл, с `type: module` в
  манифесте или без него: гард разбирает результат и как скрипт, и как модуль.
  Раньше он пробовал только скрипт и падал кодом 5 на самом `export`, обвиняя
  стриппер; сегодня это невозможно, и правки в настройках не требуются
  (`REFACTOR.md` R-4.6);
- **Не JavaScript в графе** (разметка или типы прямо в `.js`) — это код 2 и
  отказ, который называет причину и что править. Причина берётся с того способа,
  которым файл считали: при `minify.engine: "esbuild"` отказ называет минификатор
  и даёт два выхода (расширению — упрощение в `minify.ext` или способ `strip`), а
  при упрощении — `minify.guard`. Стеком такой случай не выглядит ни там, ни там;
- **Минификатора нет** (установка без необязательных зависимостей, платформа без
  `esbuild`) — метрика честно отступает к упрощению: числа те же, что у `strip`,
  способ говорит об этом словами, а **сборка** (`--write`) отдаёт **код 4** с
  готовой починкой. У **проверки** в этом случае ответ из двух частей, и он назван
  здесь потому, что именно её советует CI: если отчёт на диске собран с настоящим
  минификатором, а прогон идёт без него, точность изменилась — значит числа в
  таблице больше не совпадают с историей, и проверка скажет про расхождение
  (**код 1**), показав разошедшуюся строку подписи, **и тут же назовёт другой счёт**
  заметкой с готовой починкой. Вердикт при этом остаётся за расхождением: код 4
  утверждал бы, что разница объясняется датчиком, а это никто не проверял —
  расхождение может быть и правкой мимо отчёта (тот же порядок, что у `size check` и
  у `doctor`: нарушение старше приближения). Починка в обоих случаях — `pnpm run
  sizes`; на этом окружении она вернёт **код 4**.
  Проверить это без переустановки можно окружением `SIZE_REPORT_NO_OPTIONAL=1` —
  тем же приёмом это делает `test/minify.test.js`;
- **Разбор модуля — рабочий поток, поднятый один раз на прогон** (`REFACTOR.md`
  R-5.4): сам разбор стоит ~0,1 мс, а платится за него стартовой ценой потока
  (≈ 54 мс) — и только если в измеряемых файлах вообще есть модули. Отступление
  к `node --check` (≈ 86 мс на клетку) осталось на случай, когда файла потока нет
  в упаковке, поток не ответил или в Node нет модулей vm;
- **Новый файл-колонка должен быть закоммичен** до запуска: иначе проверка
  состояния скажет «не совпало с деревом коммита» (сначала `git add` + коммит,
  потом `pnpm run sizes`);
- **Доковая правка — тоже правка.** Коммит, тронувший `WORKLOG.md` или любой
  файл-колонку, получает в таблице строку, поэтому после него таблицу собирают
  заново — иначе проверка говорит «расходится с историей git» и называет строку.
  Незакоммиченная правка таблицу не двигает («сейчас» берётся из коммита), поэтому
  сборка не ломается от того, что рядом с ней правят доки.
- **`--init` не правит `.gitignore`** (`REFACTOR.md` R-4.8) — добавьте отчёты
  руками, если им не место в истории.

Проверено не на словах: раздел пройден покомандно на свежем репозитории (три
коммита, ESM в `src/`) — протокол и найденные расхождения в `WORKLOG.md` §16, а
пути, которые README называет своими, сверены с деревом. За этим следит сторож
документации, и он падает вместе с документом, а не по желанию (`REFACTOR.md`
R-4.1): пути, таблица файлов, зовы и ключи инструкций, числа проверок и цели по
времени, ссылки на разделы и пин установки проверяются машинно. Формулировки,
смысл и обещания о будущем машиной не проверяются — их держит человек.

### 8. Если в проекте уже лежит копия инструмента

Порядок выше — для проекта, который подключает инструмент впервые. Когда копия
уже лежит (свои `size-table.js` и его тесты), шаги идут в другом порядке; ниже —
тот, которым переезжал `safe-resets` (`WORKLOG.md` §18):

1. **Установить, не удаляя копию** — две реализации какое-то время сосуществуют,
   и это даёт бесплатную сверку на одном дереве: команда пакета с конфигом проекта
   обязана собрать тот же артефакт байт в байт (у `safe-resets` — 225 673 Б,
   sha256 `1bdb27e1…`). Не совпало — дальше не идём.
2. **Перевести команды проекта на пакет:** `"test:sizes": "size"`,
   `"sizes": "size --write"`.
3. **Удалить копию** — и инструмент, и его тест: те же утверждения проверяет
   набор пакета, а в проекте остаётся одна команда. Если тест звался из общего
   раннера, шаг раннера становится одним и зовёт команду пакета, а не файл
   проекта (в `safe-resets` путь берётся из манифеста установленного пакета,
   чтобы шаг не знал внутренних имён файлов).
4. **Убрать колонки удалённых файлов из настроек** и пересобрать артефакт
   **отдельным коммитом**: коммиты, трогавшие только эти файлы, без них не
   двигают ни одного числа, а такие коммиты строк не получают (у `safe-resets`
   95 × 27 → 91 × 25).
5. **Почистить документацию проекта:** ссылки на файлы инструмента заменяются
   именем пакета и его командами, а описание внутренностей (стриппер, чтение
   истории пачкой, вёрстка) из доков проекта уходит в доки пакета — иначе их две
   копии и они разойдутся.

Доступа к пакету не требуется ни локально, ни в CI — репозиторий публичный (§1),
поэтому шага с ключом в этом порядке нет.

Что при этом теряется: проверки, которые сверяли настройки проекта с ожиданиями
инструмента, отдельным набором больше не идут. Большую часть закрывает сама
команда (чужой ключ или незнакомая метрика в конфиге — отказ с объяснением, файл
таблицы не может быть колонкой), но _содержимое_ подписи (заголовок и команда
починки взяты из конфига) не проверяет никто: если это важно, это одна проверка
поверх `--data` в проекте.

## Гейт против раздувания

**Список проверок — один, и он же в CI.** Профиль проверок задан в одном месте
(`tools/gates/run.js`): `pnpm run verify:fast` (десятки секунд — каждая правка),
`pnpm run verify` (полный — перед отправкой и в CI) и `pnpm run verify:slow`
(по расписанию — то же плюс покрытие). CI зовёт эту же команду, а не свой список:
работа `verify` (`.github/workflows/ci.yml`) на каждый пуш и запрос правки, работа
`verify-slow` — по расписанию. Совпадение стережёт `test/gates-verify.test.js`:
проверка, которой нет в профиле, в CI не пройдёт.

**Датчики ловят раздувание, а не стиль** (стиль — у линтера): размер и сложность
функций, размер модулей, дубли веток и функций (`sonarjs`), вес проверок (проверка
без утверждения, утверждение без сравнения, выключенная проверка), пометки долга,
клоны по токенам (`jscpd`), циклы и сироты связей (`dependency-cruiser`), просадка
покрытия против своей же базы (`c8`).

**Порог взят из замера, а не из головы, и он храповик.** По исходному замеру:
сложность функции p50 1 / p90 4 / p99 11 / max 27 — порог 12 (в базе осталось 5
функций); длина функции p50 7 / p90 27 / p99 73 / max 118 — порог 60 (9 в базе);
модуль p90 381 строка / max 907 — порог 450 (в базе не осталось ни одного: три
толстых файла — контракт, программа страницы и сборка фикстуры — разделены,
`WORKLOG.md` §59–§61). Всё, что выше порога
сегодня, лежит в базе (`.eslint-suppressions.json`) и работе не мешает; новое валит
прогон. Дубли — 13 клонов / 84 строки (0,67 %), связи — 112 модулей / 468 связей и ни
одной находки.

**Базы обновляет человек.** `pnpm run baseline:metrics`, `baseline:dup`,
`baseline:coverage` — и только с трейлером `Gate-Change:` в сообщении коммита: правка
гейт-файла без него красна и локально (хук `commit-msg`), и в CI (по каждому коммиту
диапазона). Иначе гейт ослаблялся бы тем же коммитом, который он останавливает.
Таблица замеров, отвергнутые инструменты (knip, ast-grep, size-limit, gitleaks) и
действия человека — в `WORKLOG.md` §58.

## Для ИИ-агента

- `pnpm run verify:fast` — перед каждой правкой, `pnpm run verify` — перед отправкой;
  что не так и что нельзя трогать при красном — `AGENTS.md`.
- `size check --json` — готово ли всё: какая часть истории покрыта, какие пути
  мимо колонок (с коммитом-первопричиной) и какие коммиты выпали без строки.
- `size explain <коммит> --json` — почему у конкретного коммита нет строки: причина,
  тронутые файлы (колонки, исключённые, непокрытые) и готовая починка. Коммит —
  именем ревизии (`HEAD`, ветка, тег), полным sha или его началом.
- `size measure --json` — данные без вёрстки: строки, числа, суммы. Сегодня это
  `--json` (прежняя форма, заморожена эталоном) и `--data` (контракт страницы).
- `--json` — форма ответа, а не отдельный режим, и правило у него одно: ответ
  бывает ровно у четырёх вызовов. Без команды это прежняя форма данных
  (заморожена эталоном паритета), у `check`, `explain` и `doctor` — их ответ.
  У команды без ответа и рядом с режимом (`--write`, `--data`, `--init`)
  он отказ, а не тишина: просить JSON там, где его не бывает, — ошибка вызова.
- `size doctor --json` — вся диагностика одним ответом: окружение, зависимости,
  настройки, покрытие и находки с уровнем (`action` — делать, `note` — знать).
- Коды выхода: `0` всё хорошо · `1` расхождение с историей или неполнота ·
  `2` настройки, окружение, неизвестное или лишнее слово, два режима сразу ·
  `3` неполная история · `4` нет датчика · `5` внутренняя ошибка (таблица —
  `PLAN.md` §4.1). Действуют уже сейчас: отказ — это код и одна строка с готовой
  командой починки, без стека. `--help` печатает и то, и другое.
- Прогонов два, и оба названы: `pnpm test` — быстрый (каждая правка), `pnpm test:all` —
  полный (выкладка и CI); что в каком и почему — `tools/suites.js`, печатает числа и
  стоимости сам прогон.
- Разбор аргументов один на входе и до чтения проекта: режим либо один, либо
  отказ с обоими названными; команда и режим вместе не работают; ключ без
  значения и ключ, названный дважды, — такой же отказ. Поэтому зов, который
  инструмент не понял, нельзя спутать с исправным прогоном: вместо нуля придёт
  код 2 и готовая команда.

## Ловушки, на которых стоит проверять движок

Фикстура (`fixtures/synthetic/history.bundle`) — это история, в которой
собрано то, на чём ломаются такие инструменты: `//` внутри строки, регексп с
экранированным слэшем, шаблон с выражением, `.mjs` с `export`, не-английское имя
файла, CRLF, переименование файла, коммит «только отчёт», смешанный коммит,
слияние с правкой разрешения конфликта, замена символа без изменения объёма,
удаление и возврат файла, пустой файл, незнакомое расширение. Полный список — в
`fixtures/synthetic/README.md`.

```bash
pnpm test                      # быстрый прогон (каждая правка): паритет на фикстуре,
                               # контракт данных и страница, сторож документации и выпуска
pnpm test:all                  # полный прогон (выкладка и CI): то же плюс интеграционные —
                               # сборка на дисках, сверка с деревом, хуки, метрики
pnpm run suites:measure        # замерить длительность каждого файла набора
pnpm run parity:live           # паритет с живым проектом на клоне, две среды
node bin/size.js --data        # контракт данных: отчёт и агент
node bin/size.js --write       # минимальный отчёт
node bin/size.js --help        # справка и коды выхода
pnpm run parity                # переснять эталон паритета: проект и ревизия — из манифеста
pnpm run fixture               # пересобрать фикстуру и её эталон
pnpm run pack:check            # работает ли движок из собранного тарболла
pnpm run check:standards       # эталоны воспроизводятся, а дерево остаётся чистым
git clone fixtures/synthetic/history.bundle /tmp/size-report-fixture
```

Открытые блокеры и известные пробелы — в `BLOCKERS.md`; там же таблица настроек,
которые проверены и оказались инертными (чтобы не проверять их заново).

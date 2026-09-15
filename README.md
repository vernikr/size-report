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
shared calculation and of its own program pasted in (`src/derived.js`, `src/page/*.js`), because it opens
from disk, with no server and no network. The rest is planned step by step in `PLAN.md`.

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

The same release can be taken by a reference to the repository — installation then does not depend on the
registry, but stays tied to a revision:

```bash
pnpm add -D github:vernikr/size-report#v2.4.0
```

With no network (or nothing to fetch from codeload) — the tarball: `pnpm pack` in the package clone, then
`pnpm add -D ./vernikr-size-report-<version>.tgz`, where the name is the one `pnpm pack` printed.

**Why a tag rather than a sha.** pnpm resolves a short sha only through visible refs, while
`git ls-remote` gives branch tips alone: while the revision is a tip, a short sha installs, and as soon as
the branch moves on the installation fails with `Could not resolve <sha> to a commit`. This is an
observation rather than reasoning: the short pin `6530237` installed while `main` stood on it and stopped
working at the very next commit, while the same sha in full installed. A branch name (`#main`) and a tag
are both accepted, but a branch is a moving target and a tag is constant: this release stands on the tag
`v2.4.0`, which is also the one in the example (forty characters work as well, but they have to be copied
out of the history by eye).

The revision in the example is a part of the claim rather than decoration: what is described below is
pinned to it. A pin older than the commands (`check`, `explain`, `doctor`, `install-hook`) would teach
commands the installed revision does not have, and an extra word there is not refused but silently
skipped — that is, instead of a refusal the person gets a zero and concludes all is well. So the pin is
the revision that holds everything named below, refusals on an unknown word included.
`test/docs-pin.test.js` guards that: the pin has to lead to a revision of this repository, and every
command named in the text has to be in that revision's help.

The package repository is **public** (it was private until 2026-09-14), and that is exactly what makes the
installation simple: no developer key and no CI step with access. Checked by a run in an empty project
where git had neither global settings nor a credential helper (`GIT_CONFIG_GLOBAL=/dev/null
GIT_CONFIG_SYSTEM=/dev/null GIT_SSH_COMMAND=false`): `size --write` and `size` work there
(`worklog/archive/WORKLOG.md` §44). The earlier requirement was the price of privacy: a key locally and a
read-only deploy key before `pnpm install` in CI (that first wiring, `worklog/archive/WORKLOG.md` §18);
the template's key step went away together with the privacy. The publication to npm happened on
2026-09-15, and it had a price: the name `size-report` in the registry is taken by someone else's package
(2017, three versions), so the release was also a renaming into the owner's scope (`@vernikr/size-report`)
rather than just an upload of an archive; what the renaming touched — `PLAN.md` §10, what proves the
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
| `minify.engine` | what counts `min`: `strip` (comments and indentation, with no accuracy promised) or `esbuild` (real compression; a format without a minifier counts as stripping, and the metric's label says so) |
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
and the tool warns (`! таблицу обновляли вместе с кодом: <sha>`) and names the commit that dropped out.
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
the optional dependencies and what it means for accuracy, the validity of the settings and the completeness
of the coverage. It answers with the same pieces as the other commands: the coverage block is exactly the
answer of `size check` rather than a second calculation. The exit code is the first by importance rather
than "something was found": `2` the settings are unreadable (there is nothing else to read), `3` the
history is cut short, `1` the coverage is incomplete, `4` a number is approximate, `0` nothing to do. A
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
| 2 | something in the call or in the project — the causes are quoted as the tool prints them: **командная строка** (незнакомый ключ, ключ без значения, повтор ключа, два режима сразу, лишнее слово, команда и режим, неизвестная команда, несовместимый ключ, нет ответа в JSON, два ответа сразу, нет коммита); **настройки и проект** (нет файла настроек, настройки не разобраны, настройки неверны, нет git, не git-репозиторий, конфиг уже есть); **история** (нет такого коммита, коммит назван неточно, коммит вне истории); **хук** (чужой хук, чужой core.hooksPath, нечем звать инструмент); **измерение** (файл не JavaScript, минификатор не разобрал) | the refusal text names the reason and a ready command — and it is executable: `test/refusals.test.js` guards that |
| 3 | a shallow history (a clone with `--depth`) | a full clone: `git fetch --unshallow` |
| 4 | no sensor | `minify.engine: "esbuild"` with no minifier: the numbers are stripped rather than minified. The report is built, and its text carries the reason and the fix; if the table also diverges from the history, the code stays **1** (a mismatch outranks the approximation) while the note about the other count is printed next to it |
| 5 | an internal error | this is a defect of the tool: we are the ones who need the text — see "Traps worth testing the engine on" below |

The cell of code 2 quotes the tool rather than describing it: those are the names of the refusal registry
(`CONFIG_CAUSES` in `src/refusal.js`), and the documentation guard compares this table with it word by
word — which is why that one cell speaks the language of the command line, while the report's own texts
are translated by the `locale` key.

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
  byte for byte by the parity reference) and `--data` (the page's contract: absolute values and the shape of
  the table, with nothing derived — whatever the page can count itself is not there). A `size measure`
  command does not exist yet.
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

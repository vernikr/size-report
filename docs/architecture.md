# How the tool is put together

The living prose of the README this project used to put on its main page: how the engine and the
report are built, why the numbers are what they are, and which checks hold each promise. The rest of
that README — its status and release notes, the file table, the wiring instructions, the gate against
bloat and the traps — is kept in [`archive/README_old.md`](archive/README_old.md).

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
selection" are impossible in principle. The contract tells how each number was obtained (the metric's
`method`) and nothing else about it: the page shows what the engine said and judges no number — it keeps
no rule of counting of its own, and the split of numbers into exact and approximate was taken out of the
package. The page's panel is a
tree of files by folder, with a switch per folder for the whole subtree; a reader's choice survives
a revisit in the browser's memory, and the address keeps a clean tail — an address with a link of its
own is read and never written (release 2.7.0). The contract carries the **project
catalogue** too: every path git sees, so the page's tree is the project's tree, while numbers exist
only for the files that became columns (release 2.2.0).

**The page's block is the contract in sparse form.** The file carries the history as changes rather than
as a snapshot per commit — for every file the rows it appeared in (absolute numbers), moved in (deltas
against its own previous record) and disappeared in — with the texts in a dictionary and the rows' links
cut by the part they share. The page's own chapter unrolls it back into exactly the contract
(`src/page/payload.js`), so the calculation and the table know nothing of the sparse form and there is no
second way to count a row; `--data` still answers with the dense contract, and the block's `schema: 2` is
what refuses a record written for the previous form. On this repository the data block is
1 370 724 → 88 712 B, and its parse is 11.6 → 0.6 ms plus 3.3 ms of unrolling (`contract-data` holds the
round trip).

**The block travels packed, and that is the page's one asynchronous step.** It lies in the file gzipped and
base64 encoded — the tag says so (`data-pack="base64+gzip"`) — and the page unpacks it with the platform's own
`DecompressionStream`: no library travels in the page, nothing is fetched, and the whole artifact of this
repository goes 122 668 → 78 319 B (the block 88 786 → 42 856 B — 74 B more than step 05 measured, because the
report is itself a column of the report and its own size moved in between). The price is deliberate and twofold: the
block can no longer be read by eye or by `diff`, and the first drawing waits for a promise where it used to
happen during the parse. Everything after the first drawing is as synchronous as it was; a host that cannot
unpack is told in words rather than left with an empty table. The checks read the page in jsdom, which has no
such API, so the harness puts the platform's own implementations of it into the window — and that seam is
tested from both sides: the ordinary path with them put in, and the message in words without them.

**What the page carries is squeezed, and only what the page carries.** The program and the styling are pasted
with their comments and indentation out — the same stripping the `min` metric counts — so the artifact holds
code without ballast while `src/derived.js`, `src/page/*.js`, `src/table.css` and `src/page/app.css` stay the
ordinary files a person reads: the squeeze lives in the paste and nowhere else. It is 58 922 → 24 885 B of
program and 15 505 → 5 905 B of styling (the artifact 166 305 → 122 668 B), and the assembled program is
guarded at build time by the stripper's own `assertCompilable` — a squeeze that ate code stops the build
rather than the browser.

**Minification of what the page carries is decided, not defaulted: not taken — and measured.** esbuild would
take the pasted program 24 885 → 18 128 B and the styling 5 906 → 5 102 B, the artifact 122 668 → 115 107 B
(7 561 B), for 91 ms of every build. The price is not those bytes but the contract: esbuild is an **optional**
dependency and its absence is a different count rather than a refusal, while the artifact is rebuilt by the
post-commit hook on whatever machine made the commit — a builder that minifies when it can would build **a
different file** there, and the report would stop being a fixed point. Buying determinism instead would mean
a pinned version and a page that cannot be assembled at all without esbuild (`src/optional.js`), for 6 % of
the file. What the decision rests on — the bytes it would save, the fixed point it would cost, and what
reopens it — is written down beside the plan the step belongs to.

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
existence and completeness of paths (`test/docs-paths.test.js`), and commands, refusal causes and section
links (`test/docs-commands.test.js`). One reader
of facts serves them both (`tools/docs-facts.js`). What a
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
catalogue does not take on is said in words: wording beyond the listed phrases, and meaning, andthe "!" sign, which is a note (another count, a mixed commit, the automation switched off) rather
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

No check is lost or weakened: the full run starts every file, the fast one takes part of them. The default is the full run — a file becomes fast only explicitly and with a reason — so new
expensive work cannot quietly move into the fast one. The split is guarded by `test/suites.test.js`
(every file classified, and a reason for each).

**The runs have no time targets, and that is a decision rather than an omission.** Seconds depend on
the window — the machine is under very different load at different times — so neither the suite nor CI
fails over time, and this document promises no seconds: `pnpm run suites:measure` prints every file's
duration in a run of its own (and a run prints it next to its tick), but that is a measurement, not a
threshold. The split rests on what a file is about rather than on how long it takes. CI calls the full
run twice: in the usual environment and with none of the machine's settings
(`GIT_CONFIG_GLOBAL=/dev/null`).

**What the package promises is down to fact.** The shipped-file list named four paths the repository
does not have (`dist/`, `templates/`, `LICENSE`): today it promises only what exists —
`templates/` came back into the list together with its files, not before them —
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
person names it in the manifest, and it is compared with the tag rather than
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
alike — so that the report is seen at once in a list where half the rows do not switch. The name of a level
holds a second rule: a hidden name — one beginning with a dot — stands after every visible one, the alphabet
deciding the rest, so the service files of a project do not stand in the reader's way
(`test/page-tree.test.js`).

**A folder is a switch like a file, and its sign is a decision of its own.** The checkbox of a folder
carries its whole subtree and shows three states — every file on, some, none — with the number of files
next to it. Neither a folder nor a category button keeps state of its own: both flip the same file
checkboxes, so the tree, the buttons and the table cannot drift apart. The sign beside a folder answers
a different question — how much of the tree is visible, which is the onlooker's business rather than the
reader's choice — so it is remembered between visits in a record of its own, under a key of its own and
the same report passport, and it never goes into a link. The tree opens **folded**: a project's tree is
longer than the window, and the reader looks at a short list first, so what the record keeps is the
unfolding rather than the folding — folding every folder back removes the record, just as turning the
checkboxes back on removes the choice.

**The list scrolls, and there is one scroll.** On a narrow window it is the file list that scrolls —
the panel grows with the page there — while on a wide one the whole panel does: otherwise the controls
would push the table off the screen. Folders fold because the tree is longer than the window; otherwise
its middle is out of reach.

**Folding is pure view, and it counts no numbers.** The subtree lies in the markup and a class on the
row hides it, so a click on the sign changes exactly the three things the reader sees — the class, the
sign and the note in the memory. What guards this is that after folding the table is the same markup
rather than a rebuilt one (`test/page-tree.test.js`).

**The table is a window of itself, and the window is what a scroll moves.** A row stands at its own `top` inside the
scrolled content and a column at its own `left`, so scrolling costs the browser nothing but painting — no layout of the
table to redo and no script to run — while the page works only when the window has really moved, and then only on what
left it and what entered it. The header sticks to the top of the shell and the commit column to its left, so the commit a
number belongs to and the file it stands under are always in sight. The price of a table is what this step removed:
238 500 cells were 253 770 nodes in the document and 377 396 in the browser, **1.46 GB** of a fresh Chrome's memory at
rest, and any change of a column's visibility meant the browser laying the whole of it out again — 234.5 ms of layout for
a *single* cell of this repository's report, 539 ms for 6 000 (`probes/archive/step-12-columns.mjs`). A window of the same
table is **2 460 nodes and 0.15 GB**, a hundredth of the nodes and a tenth of the memory, and the whole-table scroll
pass that took 36 s of task time over 60 steps takes **1.1 s over 251** (`worklog/0208-table-window.md`). **The columns
are one width and fixed, 70px each**: the numbers are short and of one kind, and a width that came out of the text is a
measurement of every cell of the column — the very cost this step removed. A file's name stands centred over its group
and is cut with an ellipsis rather than wrapped — the whole name stays in the tooltip. The header is two lines of one
row each, the numbers begin at the
right edge of the pinned commit column rather than under it, and every line of the table — under a row, under a header
cell, along a group's left edge — is one pixel of one colour: a heavier line would promise a hierarchy to work out
rather than read. The geometry is four figures — a column, a row, the header, the pinned column — written in the styling
and in the script that counts the window's ordinals in them, and `test/page-grid.test.js` reads both and holds them
together. **A step sideways moves that window rather than building it:** the rows live through the move and only the
columns that entered are made, at 10.4 → **0.6 ms** for the page's own handling of the step, 14.4 → **5.9 ms** for the
layout it forces and 1.281 → **0.350 s** of task time over a sweep of forty steps
(`probes/archive/step-12-window.mjs`).

**A click builds the window again, and that is cheap now.** A file switched off is simply not among the columns that
are built, and a metric switched off not among the metrics: there is nothing to hide and nothing to carry, and the
window is built from the choice as it is — a few hundred cells, 1–5 ms on this repository's report against the ~1 s the
same click cost as a table. The totals are the sum over the files that are on, counted by the shared `rowModel` for the
rows the window holds (`src/derived.js`), rather than kept in a running cache that a second road would have to agree
with. **There is no stripe over the page any longer, and that is a measurement rather than an omission:** it stood over
the browser's relayout of the whole table, and work that is over before a frame could paint it has no moment to be
shown in (`src/page/work.js` left the tree with the freeze it was drawn for). **Nothing of it is a library**, and that
was measured too: a virtualizer of both axes is not a solved problem for a page like this one —
`@tanstack/virtual-core` is ~6.7 kB gzip and headless (the rows and the columns are two virtualizers, and every node
is still yours to write), `virtua` calls its grid `experimental_VGrid` and has no sticky pieces, `Clusterize.js`
virtualizes rows out of a string of all of them and knows nothing of columns — and each would have to be vendored into
the artifact, whose bytes this very tool measures. What is left to write after any of them is what the chapter is: the
window, the cells, the header and the pinned column.

**The columns whose numbers last moved come first.** The report is rebuilt after every commit, and a
reader's first question is what that edit brought. The mark is taken from the numbers rather than from
the commit's list of paths, and that is the whole of the difference: a commit can touch a column without
moving it — a version bumped inside a line of the same length, this package's own attachment to itself is
one — and a column of empty cells standing in front of the table is what a reader calls a broken order.
The rest follows in the settings' order (the sort is stable), so the order of the columns is what the
reader is used to, and his choice of files does not rearrange it (`src/page/table.js`; the rule is counted
from the contract's own rows in `test/page-grid.test.js`). The engine still answers with `last` — the
columns the newest commit touched — in `--data`; the page no longer reads it, and the block it carries no
longer holds it.

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
built once and a switch writes only the fields it reached, so the reader's place is his still: there is
no rebuild that could lose the scroll of the panel or of the list, and the field under the keyboard keeps
its focus without being found again by hand (`test/page-tree.test.js`) — with a rebuild every switch with
`Tab` and `Space` would mean walking the panel from the start. The file list has no ceiling of its own in a wide window: the panel
scrolls, and the list does not push the table. The row of categories sticks to the top of the panel,
with the panel's own background (or passing rows of the list would read through it), and the panel's own
top padding lives on its first field, which travels away with it. File captions use the table's font size
(12.5px), and the legend under the tree is gone on purpose: below the list it pushed the numbers away,
while what it explained already stands next to the thing it explains — the sign of a number names the
colour of a delta, the way each number was counted stands under the metric switches, and the mark of a gap
lives in the cell's own text.

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

**The link is read and never written.** The page's address is the report's own: a choice lives in the
browser's memory, and the page puts nothing into the address bar — a report opened from disk keeps the
address it was opened with, and not one switch lands in the tab's title bar. What an earlier release sent
as a link is still read, though — the record in `#size-report=…`, in the same shape the memory holds it —
and such a link outranks the memory while it does not replace the reader's own until he changes something.
A foreign or broken address is not applied, and is not silent either: a line above the table names the
reason ("the link was made in another report" / "the choice in the address is unreadable"), the view stays
the reader's own, and the incoming address is not rewritten; names the report does not hold are reported
by count, skipped, and the rest is applied. The link works on an already open page as well: the browser
does not reload the document when the anchor changes, so the page reads the address itself, or a link
would only work in a new tab. The page makes no request to the network at all, and that is an assertion of
a check rather than a promise (`test/page-view.test.js`, `test/parity.test.js`).

**The `min` metric can count for real.** The way of counting is chosen in the settings:
`"minify": {"engine": "esbuild"}` minifies JS/TS/CSS for real through an optional dependency, while
`"engine": "strip"` is the earlier removal of comments and indentation. The default did not change,
because both frozen references were taken under it. Measured on the fixture: real minification is
smaller than stripping in **44 cells and never larger**; `src/code.js` **276 → 185 B**, `src/style.css`
**55 → 43 B**, and over the fixture's history **−1 372 B**. JSON is minified by parsing (parsing loses
only insignificant whitespace, and nobody would make it shorter), while the formats the minifier does not
take are named in the metric's caption **by extension**: `esbuild … (minify, rename); other formats
(.md .toml) lose comments and indentation`. The split of numbers into exact and approximate is gone from
the package: how a column was counted is told once, in the metric's method, and no cell carries a mark of
it any more. The list comes from the columns rather than from the name of the method (`otherCountFormats`
in `src/metrics.js`), so a report made only of formats the minifier takes says nothing about other
formats. With no minifier
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
the metric's caption by extension: their number goes by bytes rather than text. With no dictionary (an installation without optional dependencies, a platform without it)
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

The move, the refinement and the packaging are laid out step by step in `plans/archive/PLAN.md`, with
acceptance for each.

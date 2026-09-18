# How the tool is put together

The living prose of the README the main page used to carry: the engine, the report, the checks and the
gate. What the repository holds is `docs/files.md`, wiring the tool into a project is `docs/wiring.md`,
and the old main page's release notes are `docs/archive/README_old.md`.

## Data flow

`bin/size.js` calls `src/size-table.js` (a re-export of the public API), and the work lies in modules
under `src/`, split along the borders of the data:

- the top reads git and the file system — `src/git.js` (the only place git is called),
  `src/strip.js` and its forms, `src/metrics.js`, `src/minify.js`, `src/tokens.js`, `src/history.js`;
- the bottom works on values already collected — `src/data.js`, `src/derived.js`, `src/page/`;
- the settings, the texts and the refusal stand at the edges — `src/config.js`, `src/locales.js`,
  `src/refusal.js`.

The engine hands over absolute values and the shape of the table (`--data`); the deltas, the totals,
"now" and the filters are counted by the page, which is the report itself — without that split the
filters and "the total over the selection" are impossible. The contract says how each number was
obtained (the metric's `method`) and nothing else about it: the page keeps no rule of counting of its
own. Besides the numbers it carries the **project catalogue** — every path git sees — so the page's tree
is the project's tree while numbers exist only for the files that became columns.

## The report page

One self-contained file (`docs/size-report.html`): data, styling and program pasted in, no server, no
network — an assertion of a check rather than a promise (`test/parity.test.js`,
`test/page-view.test.js`).

**The block travels sparse and packed.** The file carries the history as changes (for every file the
rows it appeared in, moved in and disappeared in), with the texts in a dictionary and the rows' links
cut by the part they share; `src/page/payload.js` unrolls it back into exactly the contract, so there is
no second way to count a row, `--data` still answers dense, and the block's schema refuses a record
written for the previous form. It lies gzipped and base64 encoded and is unpacked by the platform's own
`DecompressionStream`: no library travels in the page and nothing is fetched, at the price that the
block cannot be read by eye or by `diff` and the first drawing waits for a promise. A host that cannot
unpack is told in words; the checks read the page in jsdom, which has no such API, so the harness puts
the platform's own implementation into the window — and that seam is tested from both sides.

**What the page carries is squeezed, and only what the page carries.** The sources are pasted with
their comments and indentation out — the same stripping the `min` metric counts — while `src/derived.js`,
the chapters of `src/page/` and the two stylesheets stay the files a person reads. The assembled program
is guarded at build time by the stripper's own `assertCompilable`, so a squeeze that ate code stops the
build rather than the browser. **Minification was measured and not taken:** esbuild is an *optional*
dependency and the artifact is rebuilt by the hook on whatever machine made the commit, so a builder
that minifies when it can would produce a different file there and the report would stop being a fixed
point; buying determinism instead would mean a pinned version and a page that cannot be assembled at all
without esbuild (`src/optional.js`).

**The left panel is the project's file tree**, built from the catalogue rather than from the columns, so a
file that did not make it into the report keeps its place with the checkbox off and unavailable, the
tooltip naming the reason. Off rather than absent: the rows stay even while unavailability says this is
not the reader's choice. The report itself is always in the catalogue, whether or not it is tracked, or
the first rebuild in a fresh clone would give different bytes. A folder whose files are only partly in
the report writes its count as a fraction, everything outside the report stands after everything inside
it, and a hidden name stands after every visible one (`test/page-tree.test.js`).

**A folder is a switch like a file, and its sign is a decision of its own.** The checkbox of a folder
carries its whole subtree and shows three states; neither a folder nor a category button keeps state of
its own, so the tree, the buttons and the table cannot drift apart. The sign beside a folder answers how
much of the tree is visible — the onlooker's business rather than the reader's choice — so it is
remembered in a record of its own and never goes into a link. The tree opens **folded**, and the record
keeps the unfolding rather than the folding. **Folding is pure view** — the subtree lies in the markup
and a class on the row hides it — guarded by the table being the same markup rather than a rebuilt one.

**The table is a window of itself, and the window is what a scroll moves.** A row stands at its own
`top` inside the scrolled content and a column at its own `left`, so scrolling costs nothing but
painting, while the page works only when the window has really moved and then only on what left it and
what entered it; the header sticks to the top of the shell and the commit column to its left. A step
sideways **moves** the window rather than building it: only the columns that entered are made. A click
builds the window again from the choice, and the totals are the sum over the files that are on, counted
by the shared `src/derived.js` for the rows the window holds rather than kept in a running cache that a
second road would have to agree with. The columns are one fixed width — a width that came out of the
text is a measurement of every cell of the column — and the geometry is a few figures written in the
styling and in the script that counts the window's ordinals in them, which `test/page-grid.test.js`
reads together. **Nothing of it is a library:** the virtualizers of both axes are headless, an
experimental grid or rows out of one string, and each would have to be vendored into the artifact whose
bytes this very tool measures.

**The columns whose numbers last moved come first**, so the reader sees what the newest commit brought;
the mark is taken from the numbers rather than from the commit's list of paths, because a commit can
touch a column without moving it and a column of empty cells in front of the table reads as a broken
order. The rest follows in the settings' order, so the reader's choice of files does not rearrange the
table (`src/page/table.js`).

**On a wide window the panel stands to the left of the table and takes no room from the numbers**, so
the switches, the tree and the numbers are visible at once; the layout is a grid on `body` rather than a
wrapper in the markup, and only the working row stretches. On a narrow window it is the file list that
scrolls, so there is one scroll rather than two, and the narrow half starts one pixel below the wide one
so that the two halves cannot apply to one page. What guards the layout is the contract rather than the
markup: switching a folder off removes exactly its columns and exactly its volume from the total
(`test/contract.test.js`). **A switch takes away neither the numbers' room nor the reader's place in the
list:** the panel is built once and a switch writes only the fields it reached, so no rebuild can lose
the scroll of the panel or of the list, and the field under the keyboard keeps its focus.

**The panel remembers the reader's choice** in the browser's memory, tied to the report's passport (the
tool's name, the data schema, the artifact's path, the title and the column labels, hashed into the
record's key) — all `file://` pages share one memory, so this is no trifle. The record holds names and
only what is switched off: a column pointed at another path matches nothing, what appeared stays
switched on, and turning everything back on removes the record. The passport holds neither the tool's
version nor the top of the history: updating the tool does not change what a column means, while a grown
history is the very history the reader comes back to.

**The link is read and never written.** The page puts nothing into the address bar; a link an earlier
release sent (the record in `#size-report=…`) is still read and outranks the memory while it does not
replace the reader's own until he changes something. A foreign or broken address is not applied and is
not silent either — a line above the table names the reason, the view stays the reader's own, and the
address is not rewritten. The link works on an already open page as well, since a change of the anchor
does not reload the document.

**The page looks and behaves like a tool.** One set of table styles serves both outputs
(`src/table.css`), and the colour of a delta is defined once — growth green, fall red — while
`src/page/app.css` holds the page's own part, every departure from the shared geometry standing there
with its reason. The page says so in words when there is nothing to assemble a table from, and its
switches are labels around inputs, so a mouse, `Space` and assistive technology all reach them.

## Metrics

`raw` is the size of the git object. `min` is the minified form, and which one is a setting:
`"minify": {"engine": "esbuild"}` minifies for real through an optional dependency, `"engine": "strip"`
is the earlier removal of comments and indentation. The default did not change, because both frozen
references were taken under it. JSON is minified by parsing; the formats the minifier does not take are
named in the metric's caption **by extension**, and that list comes from the columns, so a report made
only of formats the minifier takes says nothing about the others. With no minifier the metric falls back
to stripping — the numbers stay byte for byte those of the earlier way of counting — the method says so
in words and the run answers **code 4**. A file the minifier could not parse is a refusal with code 2
naming the file, the minifier and the cause, with a ready way out in the advice.

`tok` counts tokens with a real dictionary, chosen in the settings (`"tokens": {"family": "openai",
"encoding": "o200k_base"}`). The encoding is part of the number rather than a detail, which is why it is
named next to the family and the method quotes exactly the one that produced the number. Tokens are
neither bytes nor minification: bytes per token differ between files by several times, that is, the text
is counted rather than a ratio. The family is single in this version — the others have no dictionary
that could be called their own, and counting with someone else's while calling that a family would
promise what does not exist. There is no dictionary switch on the page, on purpose: the page gets ready
numbers and has nothing to count tokens with, while counting every family on every run would pay time
for numbers the reader may never ask about — so the choice lives where it costs time, in the run's
settings, and the page **names** it. Formats without text go by bytes and are named by extension. With
no dictionary the count is an estimate by length with the coefficient in the method and the run answers
**code 4**; that seam is checked with `SIZE_REPORT_NO_OPTIONAL`. The split of numbers into exact and
approximate is gone from the package: how a column was counted is told once, in the metric's method.

Both derived profiles — what a project without settings gets, and what `--init` pins — lead new projects
straight to minification and tokens.

**Two conveniences of the command line are guarantees rather than accidents:** `--help` answers wherever
it is asked, and `--write` creates the report's directory when it is missing.

## Commands

**Two commands answer about the history: completeness and explanation.** `size check` asks whether
everything in the history got into the report: every path the history touched has to be a column or a
declared exception, and a path that is neither is a violation — code 1, the path, the commit that
introduced it and a ready fix. Coverage is counted over the facts of the history (the union of the
changed paths of every commit) rather than over the file list in the tree, since a file created and
deleted before HEAD is invisible there while the history remembers it. The answer carries the summary of
dropped commits and their shas, and says what the tool does not claim: not that the project picked the
"right" columns, only that nothing went past them. It also replaces the "artifact ↔ history" control, so
the report need not be kept in git. `size explain <commit>` answers about one commit — a revision, a sha
or its beginning — saying whether there is a row and which, or why there is none. Both take the reason
from the same run the reports come from and the evidence from the commit's list of changed paths, and
are silent about what the history does not hold rather than guessing. `skip` is one and the same list:
"paths that cannot be columns" and the declared exceptions of completeness. Next to them stands `size
doctor`, the diagnostics in one answer, whose coverage block is exactly the answer of `size check`
rather than a second calculation.

**The report updates itself.** `size install-hook` installs `post-commit` and `post-merge`
(`post-commit` does not run for a merge at all, which is why one file is not enough), and the copy lying
in git lands as **a commit of its own**. The commit is assembled with git's plumbing (`commit-tree`), so
neither the index nor someone else's uncommitted work can get into it, and a loop is impossible by
construction rather than through a flag. A refusal does not bring the commit down: the cause is printed
as one line and remembered, and `size doctor` shows it.

## Checks and the promises they hold

- **Parity with the implementation the move started from is proven, not asserted.** `pnpm test`
  compares the package with the frozen standard byte by byte on the fixture and in hostile environments
  (the machine's git settings, the locale); `pnpm run parity:live` does the same on the consumer
  project's live history. The output does not depend on the machine, because the settings that change
  what is parsed are pinned in the engine (`BLOCKERS.md` §B1), and the comparison against the working
  tree compares content rather than sizes, so CRLF is no obstacle (`BLOCKERS.md` §B2). A file deleted
  before HEAD is simply empty in the table, while a **disagreement** between the two sides is still a
  refusal with the real cause and a ready command (`BLOCKERS.md` §B3); the alias of a renamed file is
  taken from what git returned a blob for rather than by the order of the settings (`BLOCKERS.md` §N8).
  The consumer project `safe-resets` installs the package by the release tag and keeps no copy of the
  tool of its own.
- **git is read through one boundary, in the checks too**: one list of pins for the engine and the
  harness, and an unpinned place is guarded by `test/git-pins.test.js`, which also shows by witness that
  a pin works.
- **What the documentation promises is checked, not assumed**, one promise per check: existence and
  completeness of paths (`test/docs-paths.test.js`), and commands, refusal causes and section links
  (`test/docs-commands.test.js`), both over one reader of facts (`tools/docs-facts.js`). Wording,
  promises about the future and whether a file's role is described correctly stay with a person, and the
  guards say so in their headers.
- **Every refusal tells the truth, and its advice is executable.** `tools/refusals.js` holds a line per
  refusal saying what it must convey, which code to answer with, which phrases must stay and what it
  advises. `test/refusals.test.js` **calls** each refusal and compares the code, the phrases and the
  advice, which is executed in the state that printed it; `test/refusals-catalog.test.js` reads the
  sources and requires a catalogue entry for every refusal site and a case for every entry, so a new
  refusal or a new advice cannot appear in silence. Refusals a run cannot reach are named explicitly,
  and one cannot be caught at all — "internal error". A "!" is a note (another count, a mixed commit,
  the automation switched off) rather than a refusal, with exit code zero.
- **A module no longer costs a Node process per cell.** `src/parse.js` raises one worker thread for a
  whole run (parsing through `vm.SourceTextModule`), and the price has become one-time; without it the
  guard falls back to `node --check`, slower and no softer.
- **The checks' shared part lives in one place** (`tools/harness.js`): one clone of the fixture per
  environment rather than one per check, a read-only run is not repeated, and a check that edits files
  takes a clone of its own. The files go in a pool over the cores (`tools/run-tests.js`), and the run
  counts the checks of every file against the `test(` declarations in it, so a file that did not run is
  a failure rather than fewer checks.
- **There are two runs, and the choice between them follows the price of a file, not the alphabet.** The
  cost is not the size of the file but how many times it launches the tool and git. The fast run gathers
  what it proves from reading, the full one adds what runs the tool on its own clones, commits and
  hooks; the reason for each expensive file is named in `tools/suites.js`, the default is the full run,
  and the split is guarded by `test/suites.test.js`.
- **The runs have no time targets, and that is a decision rather than an omission.** Seconds depend on
  the window, so neither the suite nor CI fails over time: `pnpm run suites:measure` prints every file's
  duration, which is a measurement rather than a threshold.
- **What the package promises is down to fact.** The shipped-file list names only what exists, and
  `pnpm run pack:check` checks it from both sides — the list names nothing absent and the tarball
  carries nothing the list does not promise.
- **A release is a tag** (`.github/workflows/release.yml`). Pushing `v<version>` runs the strict linter
  and the whole suite, checks the work from the assembled package, compares the manifest version with
  the tag and publishes by the GitHub Actions attestation — no secret and no code from an authenticator.
  A prerelease goes to `next` rather than `latest`, the publisher is set up once on npmjs.com rather than
  in the repository, and the job raises no version: a person names it in the manifest, and it is compared
  with the tag. One trap cost an edit of its own: with `registry-url` on `setup-node` the action writes
  an auth token into `.npmrc`, npm then considers credentials given and does **not** go for the
  attestation, and publishing fails 404 with a correctly set-up publisher — so `registry-url` is not
  given, and `publishConfig` carries `access: public` only. A draft run from Actions goes the whole list
  up to the publishing step, on a package built on a draft version above the manifest's own.
- **Two rules came out of the first live runs of CI, and both are about the border of a call.** Process
  output is collected by the harness as buffers rather than glued into a string, or a multi-byte
  character torn at a chunk border turns into two replacement characters (`test/runner.test.js`). And of
  the references only what this repository writes by itself is compared byte for byte: a history bundle
  is packed by git, whose bytes depend on its version, so the bundle is compared by content — the
  branches, the tip and the number of commits — and it has to carry `HEAD` and the branch `main` at the
  reference revision, or a clone decides on its own which branch to lay out (`tools/check-standards.js`).
- **The checks run themselves** (`.github/workflows/ci.yml`): on every push and every pull request one
  job calls **one command** — `pnpm run verify` — whose list of steps lives in one place
  (`tools/gates/run.js`) and matches the local one (`test/gates-verify.test.js` watches that). The
  dearer steps — the suite with none of the machine's git settings and coverage under c8 — live in
  `pnpm run verify:slow`, `.github/workflows/verify-slow.yml` on a schedule. The job needs no secrets:
  the consumer's history lies in the repository as a bundle at the revision recorded in the reference
  (`fixtures/live/`), and a re-take is compared with what is committed so the working tree stays clean.
  Node and the actions are pinned by version and SHA, and there is deliberately no matrix over Node
  versions: this pass is about control.

## The gate against bloat

**The list of checks is single, and it is the one CI runs.** The profiles live in one place
(`tools/gates/run.js`): `verify:fast` (every edit), `verify` (the full one — before pushing and in CI)
and `verify:slow` (on a schedule). CI calls that same command rather than a list of its own, and that
they agree is guarded by `test/gates-verify.test.js`: a check that is not in a profile cannot pass in
CI.

**The sensors catch bloat rather than style** (style is the linter's business): the size and complexity
of functions, the size of modules, duplicated branches and functions, the weight of checks, debt
markers, token clones, cycles and orphans in the graph, and coverage falling against its own baseline.

**A threshold comes from a measurement rather than from a guess, and it is a ratchet.** Nothing lies
above the thresholds — the baseline (`.eslint-suppressions.json`) holds nothing at all — so a new
overrun fails the run while the tree as it stands needs no excuses. **A person updates the baselines**
(`pnpm run baseline:metrics`, `baseline:dup`, `baseline:coverage`) and only with the `Gate-Change:`
trailer, or the gate would be weakened by the very commit it stops.

## Traps worth testing the engine on

The fixture (`fixtures/synthetic/`) is a history holding what breaks tools of this kind: `//` inside a
string, a regexp with an escaped slash, a template with an expression, `.mjs` with `export`, a file name
that is not English, CRLF, a file renamed, a commit that touched only the report, a mixed commit, a
merge with a conflict-resolution edit, a character replaced without changing the volume, a file deleted
and returned, an empty file, an unknown extension. The full list is in `fixtures/synthetic/README.md`.

```bash
node bin/size.js --data         # the data contract: the report and an agent
node bin/size.js --write        # the smallest report
node bin/size.js --help         # the help and the exit codes
pnpm test                       # the fast run: parity, the contract and the page, the docs guards
pnpm test:all                   # the full run: the same plus the integration ones
pnpm run parity                 # re-take the parity reference
pnpm run fixture                # rebuild the fixture and its reference
pnpm run parity:live            # parity with the live project on a clone
pnpm run check:standards        # both references reproduce and the tree stays clean
pnpm run pack:check             # does the engine work from the assembled tarball
```

Open blockers and known gaps are in `BLOCKERS.md`, and next to them the note about the settings that
were checked and turned out inert, so as not to check them again.

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

The move, the refinement and the packaging are laid out step by step in `plans/archive/PLAN.md`, and the
page work in `plans/2026-09-17-page-perf/`.

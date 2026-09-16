# BLOCKERS — size-report

The journal of blockers and known gaps. An entry is something that silence must not close: either the work
stops, or the defect is known and worked around in a way that cannot be forgotten.

The rules of keeping it:

- a **blocker** (B\*) has a **reproduction** (a command rather than a story), a **consequence** and a **suggested
  fix**; a **note** (N\*) is an observation: it names the measurement that established it, and a gap among them
  names the options with their price;
- note keys run in the order the entries appear, so a note is cited by number rather than counted;
- a worked-around gap must be held by a check that reddens **when the gap is closed** — otherwise the workaround
  becomes silence;
- a closed entry is not deleted: it is dated, and says what was done and what holds it now.

Quoted lines of the tool's own output stay in the language it prints (Russian): they are what a reader sees.

---

## B1. Paths outside ASCII depended on `core.quotePath` — CLOSED 2026-09-14

**The essence.** The engine takes the list of changed files from `git log --name-only` and used to rely on git's
`core.quotePath`, which is **on** by default: non-English paths then arrive quoted and escaped, and no path from
the settings matches such a string, so a column holding one found no file in any commit.

```text
"docs/\320\267\320\260\320\274\320\265\321\202\320\272\320\270.md"
```

**The consequence was double:**

1. a column with such a path was empty through the whole history — the file seemed not to exist for the tool;
2. a commit whose **only** change of volume was that column lost its row altogether (in the fixture, “a branch —
   an edit of code and notes”): it landed among the skipped ones as “no change of volume”.

The defect did not show on the live project (`safe-resets`, all paths ASCII), so the parity reference did not
depend on the setting, while the fixture did: on a machine with git's default settings it gave 13 rows instead
of 14.

**What was done.** One boundary of git calls (`src/git.js`, the list `GIT_PINS`): every call goes through one
argument builder that adds `-c core.quotePath=false` and three settings of the same class (colouring, the
signature block, the encoding of subjects), while the subprocess environment gets a pinned locale (`gitEnv`). A
command-line key outranks both the machine's settings and the ones from the environment, so the guarantee does
not depend on who has what configured — and that is asserted separately.

**What holds it** — `test/environment.test.js`, four checks: the output does not depend on git's settings and the
locale; the pin cannot be overridden from the environment; in an environment without the machine's settings the
fixture gives **14 rows** and all columns are filled. **Re-verified by mutation on 2026-09-16:** with
`core.quotePath=false` taken out of `GIT_PINS` reddens exactly two of them — the one asserting the engine's output
does not depend on git's settings and the locale, and the one asking the fixture for 14 rows with every column
filled in an environment without the machine's settings — and the other two stay green.

**What confirms it on the live project.** `pnpm run parity:live` compares the numbers and the artifact with the
`safe-resets` reference in two environments: the ordinary one and the one with unreadable machine settings.

**Reproduction** — for the day the pin is taken away. Before the fix this printed `13`; today, measured
2026-09-16, it prints `14` (and `skipped` of 2), because the command-line pin outranks the variable:

```bash
SR=$(git rev-parse --show-toplevel)
git clone $SR/fixtures/synthetic/history.bundle /tmp/size-report-b1
cd /tmp/size-report-b1
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.quotePath GIT_CONFIG_VALUE_0=true \
  node $SR/bin/size.js --config $SR/fixtures/synthetic/config.json --json | jq '.rows | length'
```

---

## B2. `core.autocrlf` broke the comparison with the working tree — CLOSED 2026-09-14

**The essence.** The comparison with the working tree (`assertMatchesDisk`, `src/history.js`) compared the size of
the blob from the history with the size of the file on disk. With `core.autocrlf=true` (the default of Git's
installer for Windows) the disk holds CRLF while git holds LF: not a lost edit, yet the sizes differ — and the
tool refused to work at all, saying “the carried state missed an edit”, which lied about the cause.

**Reproduction** — for the day the comparison is weakened. Measured 2026-09-16: green (code 0) today, where
before the fix it refused.

```bash
SR=$(git rev-parse --show-toplevel)
T=$(mktemp -d)
git -c core.autocrlf=true clone -q $SR/fixtures/synthetic/history.bundle "$T/a"
git -C "$T/a" config core.autocrlf true     # a consistent checkout: the status is clean
(cd "$T/a" && node $SR/bin/size.js --config $SR/fixtures/synthetic/config.json --json)
# before the fix (the tool prints in Russian):
# Error: размер src/code.js на HEAD (735 B) не совпал с файлом на диске (749 B):
#        перенос состояния между коммитами пропустил правку
```

**Why a pin did not work here, unlike B1.** Pinning `core.autocrlf=false` on git calls does not help this
comparison: the content is read from the disk rather than from git. Worse, it would weaken it — in a CRLF
checkout the whole working directory would look modified, every file would land among the dirty ones, and the
comparison would quietly stop checking anything.

**What was found along the way.** Comparing content rather than sizes is not enough on its own: git does not
always restore line endings. A file whose CRLF lie in the commit itself (in the fixture, `notes/crlf.txt`) is
checked out as it is under `core.autocrlf=true`, while the “cleanup” would put LF back — so `hash-object` of the
file on disk gives a blob other than the one in HEAD. Git itself warns about such a file (“CRLF will be replaced
by LF”) while `git status` calls it clean, since it looks at the index's record rather than re-reading the
content. One such file, and a blunt fix would bring the tool down again — measured on `notes/crlf.txt`.

**What was done.** The comparison became two-sided, and both sides compare content rather than sizes:

1. **The carried state against the commit's tree.** `git ls-tree -r -z HEAD` is the truth about HEAD's content
   independent of reading blobs. A column with no file in its state must be empty in the tree as well (otherwise
   a creation was lost). That is the very check the comparison exists for: it catches an edit lost while the
   state was carried between commits.
2. **The file on disk against that same content.** `git hash-object --stdin-paths` (one call for all files)
   gives the hash of what git would put into the index. Where that does not match, one case remains — a file git
   does not give back in this checkout — and there the content on disk is compared with
   `git cat-file --filters HEAD:<path>`, which is what git itself would have laid out for that blob. Files edited
   in the tree stay out of the disk comparison, as before: their content differs between the commit and the disk
   lawfully.

**The consequence is wider than the fix.** The comparison became more precise rather than merely more tolerant:
with content compared, an edit that changed no size is caught now (it used to slip past), and so is a column
whose file creation was lost.

**What holds it** — one check per side:

| Check | What it asserts | The mutation that reddens it |
|---|---|---|
| `test/crlf.test.js`: a CRLF checkout does not hinder the comparison | the numbers and the artifact's sha256 match the ordinary checkout; the check itself asserts the clone came out with CRLF and a clean status | green today; red on the engine before the fix |
| `test/disk.test.js`: an edit on disk alone is caught, in both checkouts | a file marked `--assume-unchanged` and edited on disk (git stays silent about it) must bring the comparison down | a tree-against-tree comparison (an empty check) reddens exactly this one |
| `test/disk.test.js`: a lost edit of a merge commit is caught by the state against the tree | an engine without `--diff-merges=first-parent` must fail on the state comparison | turning the state comparison off reddens exactly this one |

**Status:** closed.

---

## B3. A column whose file was deleted before HEAD brought the run down — CLOSED 2026-09-14

**The essence.** A file added and then deleted in the history (an everyday thing: a temporary module, a script
that was removed) did not work in a column at all — the run refused with **code 1** and a message that meant
nothing.

**Reproduction** (the hypothesis: the file went through the history and vanished before HEAD). Measured
2026-09-16: green (code 0) today, with the column empty at HEAD and holding its 13 bytes where the file existed.

```bash
SR=$(git rev-parse --show-toplevel)
git clone -q --no-hardlinks $SR/fixtures/synthetic/history.bundle /tmp/b3 && cd /tmp/b3
printf 'const a = 1;\n' > src/gone.js && git add src/gone.js && git commit -qm 'added'
rm src/gone.js && git add -A && git commit -qm 'removed'
# the column {label: "gone.js", paths: ["src/gone.js"]} added to a copy of the fixture's config
node $SR/bin/size.js --config /tmp/b3.json --json
# before the fix (the tool prints in Russian):
# ✗ состояние «gone.js» на HEAD не совпало с деревом коммита (файла нет вместо файла нет):
#   перенос состояния между коммитами пропустил правку
```

**The cause.** In `assertMatchesDisk` (`src/history.js`) the condition `p === undefined || tree.get(p) !==
state[i].sha` counted as a loss the case where the file is absent **both** in the state and in the tree — that
is, where a column is empty at HEAD lawfully (the file was deleted rather than lost). The comment beside it said
the opposite, and the message was the two halves “there is no file” glued together.

**The consequence.** A report over a project with such a column could not be assembled at all: running the tool
over someone else's repository with a history of deletions was impossible without editing the settings by hand.
The workaround was to declare no such column — that is, to lose the number.

**What was done.** Only a **disagreement** of the two sides is a loss now, not emptiness on both. Three things
count as lost, and all three still bring the run down: a creation (the tree has the file, the state does not know
it), an edit (the file is on both sides with different content) and a deletion (the state knows the file, the
tree does not). A column whose file lived in the history and was deleted before HEAD is empty on both sides —
which is not a loss. The message itself no longer breaks on `tree.get(p)` when a path from the state is not found
in the tree (in the old code that would have been a stack instead of an explanation), and it now names **both**
sides (the tool prints in Russian): “в дереве `src/only-in-merge.js` 77d3e2f, в состоянии файла нет”.

**What holds it** — `test/disk.test.js`, three checks, all of them on numbers and texts:

| Check | What it asserts | The mutation that reddens it |
|---|---|---|
| a file deleted before HEAD does not bring the run down and the numbers agree with the history | a history with an addition, an edit, a deletion, a return and a second deletion assembles with code 0, and each commit's number equals the size of the blob git holds (the return gives the same number as the first appearance) | putting the old condition `p === undefined` back reddens this one together with the second, on the message's text |
| a lost creation is caught by the state against the tree | a file that appeared **only in a merge** must bring the run down when the list of changed paths of the merge commit is lost, naming the tree's side and the state's side | the mutation lives inside the check: an engine without `--diff-merges=first-parent` is assembled at once and must refuse; the check also asserts the file exists in neither parent, or the mutation would be about something else |
| a lost deletion is caught by the state against the tree | the state remembers a file the tree does not have (the file is deleted only in a merge): the mutated engine must refuse, naming “there is no file in the tree” and the path from the state | the same mutation — without `--diff-merges=first-parent` the deletion is invisible, and the check catches it; before the fix this case was an internal error, **code 5** with a stack |

A lost **edit** is held by the same fixture check (an engine without the first parent), and an edit on disk alone
by the check over the two checkouts.

**Status:** closed. The fix ran in `worklog/archive/WORKLOG.md` §28; neither the live project nor the fixture
showed the defect (no column there has a file deleted before HEAD), and the numbers, the artifact and both
references stayed the same after the fix.

---

## Notes (not blockers)

- **N1. The control check is red in a fresh clone of the fixture.** The fixture keeps the artifact committed
  (the “report only” commit moves its content), so until it is rewritten the file disagrees with the history.
  Hence the order of the checks: `--json`, then `--write`, then the control check — and `tools/make-fixture.js`
  does the same (the golden, the artifact, then a check that has to be green). Measured 2026-09-16 on a fresh
  clone: code 1 before `--write`, naming the report's first differing line, and code 0 after it.
- ~~**N2. The engine's path in a refusal text changed with the project's location**~~ — closed 2026-09-14 (wave 0 of
  the cleanup, `REFACTOR.md` R-0.1/R-0.3). The advice no longer quotes the engine's file: it names the entry
  point (`bin/size.js`), and running it creates the settings the tool then works by (`invocation` in
  `src/refusal.js`). The refusals also gained exit codes from the table of `PLAN.md` §4.1 and help instead of a
  stack. Held by `test/cli.test.js`, nine checks of the command line (this note said ten — measured
  2026-09-16).
- **N3. What was checked and turned out inert** (so that it is not checked again). Each row is the engine's
  run in a clone of the fixture with the setting forced in, compared with the ordinary run byte for byte —
  re-measured 2026-09-16: eleven settings and three environment variables, the same bytes every time (12 712 B
  from a 14-row history):

  | Setting | Result |
  |---|---|
  | `diff.renames=true/false` | no effect on the numbers, in either value (closed in N8) |
  | `color.ui=always` | no effect (the tool's own output is not coloured), pinned anyway — rather than relying on that |
  | `log.showSignature=true` | no effect without signed commits; pinned — a signature block would mix into the parse of paths |
  | `i18n.logOutputEncoding`, `i18n.commitEncoding` | no effect without commits carrying a foreign `encoding` header; the read encoding is pinned |
  | `pager.log=true`, `GIT_PAGER=less` | no effect (the output does not go to a terminal); `--no-pager` is pinned |
  | `LC_ALL`, `LANG` | no effect; the locale of subprocesses is pinned |
  | `core.abbrev=4`, `log.date=relative`, `log.decorate=full` | no effect: the engine asks for `%H`, `--date=format:` and a format of its own |
  | `status.showUntrackedFiles=no` | no effect on the numbers; the dirty list of the comparison with the disk comes from `git status --porcelain` |
  | `core.autocrlf=true` | no effect on the numbers; it used to break the comparison with the disk — closed by comparing content (B2) |

- **N4. “The sum of the deltas agrees with the current size” — true not for every column.** A file that was
  deleted and brought back (in the fixture, `notes/crlf.txt`) has two cells of growth in its column: the first
  appearance and the return. “Now” is a single size, so the sum of the deltas exceeds it — measured on the
  fixture: 54 + 63 = 117 against 63 now. The total column does show the departure: its delta falls by the size
  of what vanished (1 878 → 1 824 in the fixture), while the file's own cell says `—` (no delta). That is how
  the artifact works, and the page follows the same rule — which is why the numbers of the two reports agree.
  `test/contract-derived.test.js` names such columns and asserts exact numbers: the rule cannot be changed in
  silence. Changing it (showing a departure as a fall, say) would change the report's numbers — a pass of its
  own rather than an edit of the contract.
- **N5. The reasons of skipped commits in the contract are the engine's sentences** (`"cd78fd9 (только таблица)"`).
  The list stays a wording rather than data, and on purpose: the page does not carry it at all, because the
  report's own commit is one of the skipped ones, so the file would never become a fixed point (`src/data.js`).
  The question behind a sentence — why a commit has no row — belongs to `size explain` (`PLAN.md` §5, step 5),
  and that is where the reason is laid out into fields (`reason`, `touched`, `fix`) rather than derived a second
  time (`src/explain.js`).

- **N6. In a browser every `file://` page shares one memory.** The report is read from a disk rather than from a
  server, so the stored choice cannot live under a single key: the key is the fingerprint of the report's
  passport — the tool's name, the data schema, the artifact's path, the title and the column labels in the order
  of the report (`src/page/state.js`; 32 bits are enough, the mark identifies rather than protects). A record of
  someone else's report lies under another key and is not picked up, and reading accepts only a record of our own
  format and passport. Where the browser grants no memory at all (a private window), the page works without it:
  the record is what is lost, while the numbers and the markup do not depend on it. Held by
  `test/page-choice.test.js` — a further visit returns the same choice and the same numbers, and a foreign or
  broken record is not applied. What no check holds is that branch of a browser granting no memory: named out
  loud rather than left looking covered.

- **N7. A change of the anchor does not reload the document.** The page carries the choice in the address
  (`#size-report=…`). Where the report is already open, following a link is, for the browser, a change of the
  anchor in the same document: nothing is loaded, and without a `hashchange` handler the link would work in a new
  tab only. Held by the check that a change of the address on an open page is applied as well
  (`test/page-choice.test.js`; jsdom raises `hashchange` as asynchronously as a browser does, so the check waits
  for the event). The handler is in `src/page/app.js`.

- **N8. A column's alias and `diff.renames` — CLOSED 2026-09-14.** A column may list several paths of one file
  (`modern.js` is `src/modern.js` or `src/legacy.js`). With rename detection off, git gives **both** paths in a
  rename commit; the engine took the first in the order of the settings — the one the commit no longer has — and
  the state lost the file (the comparison refused on a lawful case). Reproduction — measured 2026-09-16: green
  (code 0), 14 rows, `modern.js` = 246, which is the blob's own size:

  ```bash
  SR=$(git rev-parse --show-toplevel)
  git clone -q --no-hardlinks $SR/fixtures/synthetic/history.bundle /tmp/n8 && cd /tmp/n8
  git mv src/modern.js src/legacy.js && git commit -qm 'the name came back'
  git config diff.renames false          # not the default, but not a prohibition either
  node $SR/bin/size.js --config $SR/fixtures/synthetic/config.json --json
  # before the fix (the tool prints in Russian):
  # ✗ состояние «modern.js» на HEAD не совпало с деревом коммита
  #         (в дереве src/legacy.js aa07bce, в состоянии файла нет)
  ```

  **What was done.** The path for the state is chosen by what the commit **has** rather than by the order of the
  settings: the plan collects every alias the commit touched and takes the first git gave a blob for
  (`src/history.js`). The earlier numbers could not move and did not: old logic and new agree wherever the first
  alias exists in the commit — that is, in every run that used to end in a report — and differ only where there
  was no state at all. Checked three ways: the engine's output before and after the fix was byte-identical on the
  fixture's history at both values of `diff.renames`; both frozen standards reproduce byte for byte; the live
  report stayed the same (95 × 27, the reference of `parity:live`).

  **Held by** the check that a rename inside a column's aliases does not bring the run down (`test/disk.test.js`):
  a history with a rename into another alias assembles both at git's default and at `diff.renames=false`, and the
  column's number is compared with the blob from git (`cat-file -s`) rather than with the engine itself. Red
  before the fix: 5 of 6 green in that clone, and this one red with the refusal above as its text. The catching
  of disagreements was not weakened: by the same mutation a lost **deletion** is closed too (a file deleted in a
  merge only — the state remembers it while the tree does not have it).

- **N9. The mark of approximation is taken by format rather than by content.** A cell's exactness is decided by
  the path's extension (`pointExact` in `src/metrics.js`): whether the file goes to the minifier at all, or
  whether its strategy strips ballast exactly. A consequence worth knowing: the fixture's empty file is marked
  approximate although emptiness minifies exactly, and a `.md` of ASCII words alone could lose only comments. The
  error in that direction is safe — an approximation declared where the number is exact is caution rather than a
  lie — and mirrors how `min` is decided under ballast stripping: exactness is taken by format there too.
  Measured 2026-09-16 on the fixture's artifact, whose settings ask for no minifier (the default is ballast
  stripping): every mark of `min` follows that rule — `package.json` alone is exact (the `json` strategy) while
  `empty.js`, which stripping leaves as it is, is marked approximate, together with both `.md` columns. Precision
  taken by content (an empty file, JSON under ballast stripping — it is exact already) would be an edit of that
  one rule rather than of the shape of the data.

- ~~**N10. The harness reads git without pinned settings**~~ — **closed 2026-09-14** (`REFACTOR.md` R-1.4). In
  `tools/harness.js` `gitIn` called `git -C …` as it was, while the engine pins the environment at its own
  boundary (`src/git.js`, closed in `B1`). That had no effect: every path of this repository is ASCII, and the
  numbers and the tool's output are read by the tool rather than by the harness. But a check that reads git
  directly depends on the machine — the documentation guard found it first: with `GIT_CONFIG_GLOBAL=/dev/null`
  `git log --name-only` returned a fixture path quoted, and `docs/заметки.md` from `BLOCKERS.md` became
  “nonexistent” (`quotePath` is on by default). The guard would have been green on this machine and red on
  another, which is a false net. Now: the list of pins and the locale come from `src/git.js`, and both the engine
  and the harness use them; no unpinned git call is left in the checks and tools, and that is held by
  `test/git-pins.test.js` rather than by this paragraph. The workaround that the check held was removed together
  with the gap.

- **N11. The report's journal is `CHANGELOG.md`, and that is a convention rather than an accident.** Settings
  inferred from the project look for a journal among four names in the **root** and take the first that exists
  (`src/project.js`: `JOURNALS`, `journalOf`). The list starts with `WORKLOG.md`, and no such file is in the root
  any more: the working journal became a directory of entries (`worklog/`). So the inference stops at
  `CHANGELOG.md`, and this repository's report counts commits by releases rather than by passes of the journal.

  **What was measured before accepting it.** In the assembled report (113 rows when it was written) 14 rows carry
  a section: 13 release commits that opened a section (the case “a new one was opened”, which does not depend on
  the document's order), and one commit that edited the existing section `1.0.0`, the only section it touched, so
  its name is right too. The links are live: an anchor like `CHANGELOG.md#240--2026-09-15` leads to a real
  heading. Neither the numbers, nor the artifact, nor either frozen standard depends on the journal's name.

  **The accepted price.** Two consequences worth knowing: the report no longer ties a row to a pass of the
  working journal, and a known limitation becomes reachable — `touchedSection` falls back to the last edited
  section **in the document's order**, while the list of releases is written top down, so a commit editing **two**
  existing sections would be named by the older of them (there is no such commit today: the one that edits
  touches a single section). Against that stands the chosen journal growing: every release opens a section in it,
  while the archived `worklog/archive/WORKLOG.md` is frozen at section 73 and would have left every commit after
  the move without a section.

  **The options and their price.**
  1. **Accept it and write it down (chosen).** Nothing changes, the tool works exactly as before.
  2. **Pin the journal by the project's settings.** `size-table.config.json` cannot be partial: an absent file is
     the very “settings inferred from the project”, while a file with no single column is a refusal of the
     settings check. Pinning means carrying the whole profile by hand, and after that every new path must become
     a column or a `skip` record, or `check` answers code 1 — the project trades an automatic report for a
     hand-kept one. That is a behaviour change, so it is not taken inside a documentation pass.
  3. **Teach the tool a journal outside the root** (or a directory of entries read as one journal). That is the
     only way to change **which** journal the output picks, and it is a code change: `journalOf` together with the
     sample and the address built beside it, plus a decision about the report's contract — `journal.path` would
     stop being a single path. That is a new capability rather than a fix, and it needs a release of its own.

  **For the user to decide:** whether the report's journal should be the working journal at all (option 3 together
  with the question of the contract). Until that is decided the convention above stands, and the report is right
  as it is.

- **N12. A check that reads the machine's environment is the same class as B1.** The hook's first push was red in
  CI alone: GitHub sets `CI` for the whole suite, the hook stays silent in that environment by construction, and
  every scenario honestly got “skipped for the CI reason”. The product was right, the check was not: it depended
  on the environment. The rule from it: a check sets its own environment — `test/hook.test.js` drops `CI` and
  `SIZE_REPORT_NO_HOOK` for itself, and the scenario about the switches hands them over in the call rather than
  relying on the machine. What is left of that class is held by the run rather than by a sentence: the slow
  profile repeats the whole suite with `GIT_CONFIG_GLOBAL=/dev/null` (`tools/gates/run.js`), so a foreign
  environment shows at once — while nothing shows what CI itself sets and what both environments share (that same
  `CI`), and only CI catches that. Measured 2026-09-16: the hermetic step belongs to the **slow** profile —
  `slow` is `full` plus the hermetic `test:all` plus `cover`, while `ci.yml` runs `verify` and
  `verify-slow.yml` runs `verify:slow` on a schedule — so the second environment is a step of the schedule
  rather than of every CI run.

- **A merge: git runs no `post-commit` for it — measured, not guessed.** For `git merge` git makes the merge commit
  itself: `pre-commit` and `post-commit` do not run at all, while `pre-merge-commit` and `commit-msg` do (git still
  validates the merge message) and `post-merge` runs after the commit — measured on git 2.50.1 with hooks logging
  their calls (three ordinary commits gave three of each; a `--no-ff` merge gave `pre-merge-commit`, `commit-msg`
  and `post-merge`, and neither `pre-commit` nor `post-commit`). The self-updating hook is installed as two files
  for that reason (`src/hook.js`), and `git commit --only <path>` refuses while the merge is unfinished
  (`fatal: cannot do a partial commit during a merge`, because `MERGE_HEAD` is alive while `post-merge` runs —
  measured the same way). Both facts are about git's API rather than about this project, and they stand here so
  that they are not rediscovered.

- **N13. The pin in the install example lagged behind, and an extra word was not refused** — **closed 2026-09-14**
  (`REFACTOR.md` R-4.13). **The defect.** The install example in `README.md` stopped at
  `pnpm add -D github:vernikr/size-report#d63468d`, while the text goes on to teach `size check`, `size doctor`,
  `size explain <sha>` and `size install-hook`. At that revision the help knew flags alone, and the words were
  collected without parsing: an unknown or extra key was simply not read, and the run answered the ordinary check
  of the table. **The consequence.** The documented path led into emptiness without a refusal: `check`, `doctor`,
  `explain` and `install-hook` answered zero having done nothing (the hook was not installed), and `templates/` was
  absent from the package. “All is well” for what the tool cannot do is worse than a refusal — an end-to-end run is
  what found this. **The fix.** An unknown key, a key whose value is missing (`--config`), `--force` without
  `--init` and a word after a mode that takes a value are refused with code 2, the culprit named and the fix given,
  and the arguments are parsed **before the project is read** (re-measured 2026-09-16: `--wite` → code 2 with the
  key named, `--config` → code 2 with the ready command). The install example leads to a revision whose help knows
  the named commands, and the pin is either **forty characters** of a sha or a branch (tag) name: pnpm resolves a
  short sha only through visible refs, so a short pin stops resolving on the next commit of that branch. In this
  repository the pin is the release tag, and the example equals what the tool itself advises (`installSpec`,
  `src/tool.js`). Held by `test/cli.test.js` (the refusals) and `test/docs-pin.test.js` (the example leads to a
  revision whose help knows the named commands — read from the history rather than from the tree).

- **N14. The coverage ratchet falls from comments rather than from code: 11 regressions, 10 of them ours, one**
  **not ours.** The `cover` step of the slow profile is red, and the run that found it measured (in separate working
  copies rather than from memory).

  **The mechanism, proven by numbers.** `c8` counts as a line **every line of a file that falls into a coverage
  range**, and as covered one that lies inside an executed range; so removing a comment inside executed code lowers
  the numerator and the denominator by one, and the share falls as a ratio. Confirmed across ten files:
  `Δcovered = Δtotal = the number of removed lines` (`hook.js` −19 = −19 = −19: 395/448 → 376/429; `cli.js`
  −3 = −3 = −3: 80/87 → 77/84), and `lines.total` equals the file's line count minus the trailing line
  (`derived.js`: 112 against 113). One file is the exception: `strip/guard.js` 57/59 → 55/58, the numerator falling
  one line more — its comments were rewritten both in the header and inside code, and `total` counts every line of
  the file while `covered` counts only what fell into an executed range.

  **The state, measured 2026-09-16** (`pnpm run cover`): 11 regressions against a baseline of 39 files — the old one
  in `src/data.js` (branches 91.66 → 89.47), which came in with the work on the report's tree and the page
  (`364a0ac`, `da69a32`, `4079329`) and the baseline was never retaken after it, plus ten files whose share fell by
  tenths of a percent (`cli.js` 91.95 → 91.66, `hook.js` 88.16 → 87.64, `derived.js` 75.86 → 75, and so on). The
  same measurement in working copies shows the ratchet green at the revision the baseline was taken at (`202c768`,
  83.29 % of lines) and `data.js` alone already red at the parent of the first comment pass (`758a385`), so ten of
  the eleven are this work's.

  **No check was lost.** The totals over the tree rose rather than fell — 80.57 % of lines, 89.05 % of branches,
  92.37 % of functions — and not one line of code was touched in the comment passes: no `refactor(comments)` commit
  adds, removes or changes a line of code in `src`/`bin`, the only thing that moved there being comment text at the
  ends of lines.

  **The price of such a sensor.** A red step reads as “code arrived without a check”, though it means “a comment
  grew shorter”: the ratchet's promise is wrong for this case, and a pass over comments reddens it by
  construction.

  **Options and their price.**
  1. **Retake the baseline** (`pnpm run baseline:coverage`, a human action, the `Gate-Change:` trailer). Cheap and
     honest only halfway: it forgives the real regressions as well — the very `data.js` that was never retaken
     after the work on the report dropped it — and the next comment pass reddens again.
  2. **Teach the sensor executed lines rather than a share of all** (compare `covered` with executed lines, or move
     to `statements`/`branches` without `lines`). Comments would then stop mattering altogether. That edits a sensor,
     that is, a gate file: its own price (trailer, the sensor's probes, a release) and a change of what the ratchet
     means — from “a share of a file's lines” to “how much of the code ran”.
  3. **Leave it as it is and write the convention down**: after every pass over comments a human retakes the
     baseline. The red step stays a signal, but it demands a human step each time — and until then the slow profile
     and the CI schedule are red.

  **For the user to decide:** which option to take. Until then `pnpm run verify:fast` and `pnpm run verify` are
  green (`cover` does not run in the full profile at all), while `pnpm run verify:slow` and `verify-slow.yml` on a
  schedule are red: one regression is old, ten are mechanical and ours.

- **N15. The duplicate sensor's fingerprint of its own — possibly superfluous by now.** Found on pass M10f
  (2026-09-15) while checking comments: both `tools/gates/dup.js` and `test/gates-dup.test.js` said jscpd's own
  baseline (`--baseline`) was bound to the checkout's path, and the ratchet was built on a fingerprint of its own
  for that reason.

  **Measured — for the pinned jscpd 5.2.0 that is wrong.** A baseline jscpd takes itself
  (`--baseline <file> --update-baseline`, format `{version, fingerprints}`) stays green on the same tree scanned
  from another directory, survives renames and shifted lines, and reddens on a genuinely new clone
  (`found 10 new clones not in the baseline (allowed: 0)`, exit 1 with `--fail-on-new-clones=0`, which is the
  default of “more than none”). Re-measured 2026-09-16 on a toy tree — two copies of `src/args.js`, one
  fingerprint: the same tree copied to another directory green, a third copy red. And “every clone is new” comes
  from handing jscpd **our** file `dup-baseline.json`: it answers `missing field` + `version` and exits 1 (measured),
  while our file holds 15 fingerprints — an earlier measurement (“15 new clones” on a clean copy) was apparently
  exactly that.

  **What still holds, and why the file of our own remains.** Our `dup-baseline.json` is a gate file guarded by
  `gatefiles`, with a `schema`, the config's name and a note a person reads, and the sensor's counters and its
  machine report speak of it; jscpd's file carries nothing but versions and fingerprints, and no gate protects it
  (it need not even live in the tree: `--baseline` takes a path).

  **Options and their price.** (1) Leave it as it is: our fingerprint duplicates the native one, while the file's
  format and the counters are ours — around thirty lines of extra code and two ways to say one thing. (2) Move to
  `--baseline` and `--baseline-from-ref origin/main`: the second look against the main branch is already there, the
  sensor shrinks, but the baseline becomes a foreign format (no note, no schema) and updating it becomes
  `--update-baseline` instead of `pnpm run baseline:dup` — the gate file changes shape and the ratchet is retaken.
  (3) A hybrid: our file for human reading and the `gatefiles` guard, the main-branch comparison through
  `--baseline-from-ref` — two mechanisms in one gate.

  **For the user to decide:** whether a fingerprint of our own is needed beside the native one. The behaviour is
  untouched until then; only the comments that claimed the opposite were corrected.

- **N16. A repository without commits is an internal error with a stack that belongs to no one.** Found on pass
  M7 of the `markdown` subplan (2026-09-16) while checking README's requirement of a git repository with a history.

  **The reproduction**, measured 2026-09-16: a fresh `git init`, one file in the index, no commits —
  `node bin/size.js --write` gives **code 5** and “внутренняя ошибка (это дефект инструмента…)” with a stack from
  `execFileSync` in `readHistory` (`src/git.js`), because `git log` in such a repository answers
  `fatal: your current branch 'main' does not have any commits yet`; with the first commit the same command is
  green (code 0) and writes `docs/size-report.html`.

  **The consequence.** The first run before the first commit — exactly the case `--init` survives on purpose
  (`src/project.js` catches “no commits” and goes on) — is declared a tool defect with a request to send the text,
  and the ready fix (“make a commit”) never reaches the reader. Code 5 means “internal error”, while this is a state
  of the project rather than a broken engine.

  **What is right in the documentation.** README's requirement does not lie — a history is needed, and at least one
  commit; this is a gap of the code rather than of the document, and the code was not touched in that pass (a
  documentation pass).

  **Options and their price.** (1) A refusal of its own (“the history is empty”) with the ready command: cheap,
  but it adds a place of refusal, and those are counted by the catalog (`test/refusals-catalog.test.js`), so a row in
  the catalog is needed and perhaps a case in `test/refusals.test.js`. (2) Treat an empty history as an empty report
  (no rows): honest “there are no commits yet”, but that is a new behaviour of the report. (3) Leave it as it is:
  code 5 stays, and the requirement of at least one commit lives in README.

  **For the user to decide:** which option to take. Until then the behaviour is untouched, and README names the
  requirement and points here.

- **N17. Three promises of the module's design that are not in the code: a settings schema, a migration and a**
  **block for agents.** Found on pass M12 of the `markdown` subplan (2026-09-16) while checking §9 and §13 of
  `docs/module-design.md`.

  **What is promised and what is there.** Three places promise what is untrue without a code change:

  1. “a formal schema of the settings” (§9) — no schema ships: `package.json` declares `bin`, `src`, `templates`,
     `README.md`, `CHANGELOG.md`, `LICENSE`, and `templates/` holds three files (`size-report.config.json`,
     `README.md`, `ci.yml`). Validation lives in the code (`validateConfig` in `src/config.js`), and a `$schema`
     key in the project's file does nothing.
  2. “a migration when the format is updated” (§9) — there is no migration code: one file is read
     (`CONFIG_NAME = 'size-table.config.json'`), and a wrong value is a refusal with the ready fix rather than a
     conversion of an old format.
  3. “on installation the module itself writes a short block into the project's instructions file” (§13) — the tool
     writes into no foreign file at all: searching `src/` for `AGENTS` finds nothing, `installHook` writes only into
     `.git/hooks` and refuses to touch a foreign hook, the ignore list is not edited, and the package carries a note
     for a person (`templates/README.md`).

  **What was checked.** The package's contents — `files` in `package.json`; the contents of `templates/` — by listing
  it; the settings check — by reading `validateConfig` and `loadConfig` in `src/config.js`; the writing into foreign
  files — by searching `src/` for `AGENTS` and reading `src/hook.js`; the tokenizer families — `src/tokens.js`.

  **The consequence.** A reader of the module's design takes all three for existing: the editor gives no hints, an
  old settings file is not converted, and an agent in a new session learns about the tool not from its own
  instructions file but from a note a person has to put there.

  **Options and their price.** (1) The schema: ship it and point `templates/size-report.config.json` at it — the
  editor gets hints at once, but there is a second thing to keep in agreement with `validateConfig`. (2) The
  migration: recognise the old format in `loadConfig` and rewrite on `--init` — one place of reading, but new code
  and new cases in the checks. (3) The block for agents: do not write into foreign files (as today) and give the
  ready text in the templates' note — cheap, but it takes an honest word in the documentation; or write by an
  explicit settings key rather than on installation, so that writing into a foreign file becomes a conscious act.

  **For the user to decide:** which of the three to build and which to declare cancelled. Until then the code is
  untouched (a documentation pass), and the module's document names the reality and points here.

- **N18. Glued statements slipping past the linter — an observation, not a blocker.** Two kinds of gluing look
  alike, and the linter catches only one. `no-multi-spaces` (introduced in `R-1.2`) takes the case where a leftover
  extra space betrays the gluing (`, } else {      const …`). The opposite case — a line lost between two
  statements, with no extra spaces (`}function writeMode(cfg, root) {`) — was found by eye in a pass's diff
  (`worklog/archive/WORKLOG.md` §36) and would otherwise be visible only in history. A cheap candidate is
  `padding-line-between-statements` demanding an empty line before a function declaration: it catches exactly that
  case and does not cut the accepted one-statement lines. It is not enabled: first the number of findings it gives
  on the live tree has to be seen (dozens would mean a reformatting rather than a rule). Measured 2026-09-16:
  `eslint.config.js` carries `no-multi-spaces` as an error and does not carry `padding-line-between-statements`,
  while what it explains as consciously left out is `max-statements-per-line` and `brace-style`.

- **N19. The package's default locale is `ru` — an observation with a decision inside.** Measured 2026-09-16:
  `DEFAULT_CONFIG.locale` is `'ru'` (`src/config.js:19`), the settings template ships `"locale": "ru"` with
  Russian `title`/`heading` (`templates/size-report.config.json`), and `src/locales.js` holds `ru` (lines 6–70)
  beside `en` (71–126) with the same keys — the dictionary is a **feature**, so the Russian inside it is data
  rather than a literal to translate. A project without settings therefore gets a Russian report and `--init`
  prints Russian, which means "no Russian strings" can be true of the code while the product a fresh install
  shows stays Russian.

  **Options and their price.** (1) Keep the default: the cheapest, and both references stay untouched — but the
  interface of a fresh install stays Russian and the report of this repository stays Russian too (its profile is
  derived, so it takes the default). (2) Change the default to `en`: one line, and the price is named rather than
  hidden — the frozen references do **not** move (both fixture configs pin `"locale": "ru"`, so `artifact.sha256`,
  `golden.json` and the manifests stay byte for byte), while a fresh project's report, `--init`'s draft and this
  repository's own built report turn English, and the settings template (`templates/size-report.config.json`) has
  to follow in the same commit. (3) No default at all, `locale` required: the settings file of a project created
  before the key existed would stop loading — a breaking change, so not in a PATCH.

  **For the user to decide:** which of the three. The plan of the work is `docs/plans/2026-09-16-i18n-english/`
  (subplan `surface.md`), and until the decision the code is untouched.

- **N20. A translated literal changes the bytes that ship — how often to release is a decision.** Every string
  that a user sees is inside the tarball, so `AGENTS.md`'s rule applies to each portion of the translation work:
  a PATCH release, a journal section saying what changes in the numbers, and the pin in `README.md`, in one
  commit — and per the same rule the release is a tag, which is pushed.

  **Options and their price.** (1) A release per portion: the registry always serves the wording described in
  the journal, at the price of a tag push and a pin commit per portion (and a wrong wording reaches nobody until
  it is released). (2) Batch: accumulate the portions, release once at the end of a subsystem and say in each
  commit that nothing was released yet — fewer tags, but between two releases the registry's answer and the
  repository's source differ, and a reader of the README gets the older wording. (3) Do not release at all until
  the whole work is done: the simplest to hold, and the most visible risk — a package whose printed interface
  changes in the tree while the registry keeps the old one.

  **For the user to decide:** the cadence. Until then the portions are committed locally and not pushed.

- **N21. The fixture builders write the frozen layer — translating them re-takes both references.**
  `tools/synthetic/*` (note.js, content.js, history.js) writes the synthetic fixture's files, subjects and its
  `README.md`, and `tools/make-fixture.js` writes `golden.json`, `artifact.sha256` and the manifest;
  `pnpm run check:standards` compares those files **byte for byte** with what is committed and `test/frozen.test.js`
  holds their hashes. Measured 2026-09-16: the frozen layer is 9 files and 2 602 lines with Cyrillic —
  `fixtures/live/history.bundle` 2 270, `fixtures/parity/data.json` 214, the two `README.md` 47, `golden.json` and
  the configs the rest.

  **Options and their price.** (1) Leave the builders and the fixtures Russian and name them in the allow-list
  (`docs/plans/2026-09-16-i18n-english/plan.md`): nothing moves, and the allow-list keeps an entry whose reason is
  "frozen" rather than "not a literal". (2) Translate the builders and **re-take** both references: the fixtures
  become English (the traps stay: a non-ASCII path, an escaped subject, a quoted path are still needed, so the
  trap data has to be replaced by an equivalent rather than dropped), at the price of a re-take of `parity` and
  `synthetic` in one commit, new `artifact.sha256`/`golden.json`/manifests, and the `test/frozen.test.js` records
  updated with them — the numbers of the standard were taken from the **frozen legacy copy**, so a re-take is a
  statement about today's engine, not about parity. (3) Translate only the note (`note.js`), which is prose in the
  fixture's `README.md` and not trap data: still a re-take, since that file is compared byte for byte too.

  **For the user to decide:** whether the frozen layer is allowed to move, and with what witness.

- **N22. The release guard left the tree with `CHANGELOG.md` — a promise nobody holds now.** Done 2026-09-16 on
  request: `CHANGELOG.md`, whose per-release numbers were already recorded in the journal, was deleted, and
  `test/changelog.test.js` went with it (its subject was gone: the file it parsed no longer exists). What is left
  behind is a gap rather than a decision: the rule "the version named in the release notes is the manifest's
  version, and the numbers there are a measurement on the fixture rather than a retelling" was **the only check
  that tied a release's description to the manifest**, and the release workflow compares the tag with the manifest
  alone. `AGENTS.md` and the workflow's comment now name the journal (`worklog/`, `worklog/archive/WORKLOG.md`)
  as where a release is described; no check reads that.

  **The consequence.** A release whose journal section is missing, stale or names other numbers ships silently:
  the guard that would have caught it is gone with its subject. The version the guard also protected is still held
  — `test/docs-pin.test.js` compares the install pin with the manifest and the release workflow compares the tag
  with it — so what was lost is the **numbers** half of the promise.

  **Options and their price.** (1) A journal guard: the version's section in `worklog/` (or the archive) exists and
  the table of numbers in it is a measurement on the fixture — the same check moved to another reader, one test
  file and a heading convention. (2) Leave it: the journal is a record rather than a product, and a person
  releasing reads it anyway. (3) Keep the release notes in a file of its own under a new name: the guard returns
  unchanged, at the price of the file the user asked to remove.

  **For the user to decide:** whether the numbers half of the promise is held by a check again, and where.

- **N23. `plans/archive/` holds the two finished plans — the paths in old records point at the root.**
  Done 2026-09-16 on request: `PLAN.md` and `REFACTOR.md` moved to `plans/archive/`. The readers were updated in
  the same commit (`tools/docs-facts.js` — the list of documents the docs guards read, and the list of documents
  referenced by section; `README.md` — the file table and the prose that leads a reader to the plan of the move),
  and `test/docs-commands.test.js` resolves a reference by **basename**, so every section citation of `PLAN.md` and
  `REFACTOR.md` written in prose still resolves. `test/changelog.test.js` is named in `tools/docs-facts.js`'s list
  of paths a document may name although the tree has no such file — the archived plans cite it, and that is true of
  them (`BLOCKERS.md` N22).

  **What a reader may still meet:** a **path** (a code span with a slash) naming a moved file outside the two
  updated documents — `docs/module-design.md` writes `PLAN.md` without a directory, so it is a name rather than a
  path and no guard reads it as one. No action needed: the name still resolves, and the file's own location is in
  the README.

- **N24. The frozen `--json` carries Russian of its own: the skip words are part of the contract.** Measured
  2026-09-16 while planning subplan S1 of the string work: `SKIP_WORDS` in `src/history.js` prints the reason a
  commit got no row, and two of the three are Russian in the shipped answer —
  `{ merge: 'merge', report: 'только таблица', flat: 'без изменения объёма' }`. They are baked into both
  references: `fixtures/parity/data.json` holds `только таблица` 49 times and `без изменения объёма` 5 times
  (measured with `rg -o '\([а-яё ]+\)'`), `fixtures/synthetic/golden.json` holds two of them, and
  `test/parity.test.js` compares `--json` with that reference **byte for byte**. The rest of the printed
  surface is not frozen: `rg -c 'починка|Команды|Режимы|Коды выхода'` over `fixtures/**` answers nothing, so
  the help, the causes and the mode texts of S1 move no reference.

  **The consequence — measured more exactly 2026-09-16 while planning subplan S4, and corrected here.**
  A translation of `SKIP_WORDS` reddens **`test/parity.test.js`** (the package's `--json` against
  `fixtures/synthetic/golden.json`, byte for byte) and **`test/contract-data.test.js:47`** (`data.skipped`
  against the same golden) — and with them the check that exists to tell "the standard moved" from "the
  engine broke": `test/frozen.test.js` runs the **frozen copy** and requires its `--json` to equal that
  golden, so the copy keeps matching while the package stops, which is exactly that red. `pnpm run
  check:standards` stays **green**, though: both references are re-taken by the generators, and the
  generators call the frozen copy (`legacyTool()` in `tools/parity-freeze.js` and `tools/make-fixture.js`),
  not the package. `fixtures/parity/artifact.sha256` does not move either — the artifact deliberately
  leaves the skipped list out (`NOT_IN_FILE = ['skipped']`, `src/page/build.js:92`). It is the same class
  as N21 (the fixture builders), met from the shipped side rather than from the generator's side.

  **Options and their price.** (1) **Move the three words into the locale dictionaries**
  (`src/locales.js`), picked by `cfg.locale`: the fixtures pin `"locale": "ru"`, so every frozen byte
  stays as it is and **nothing reddens**; the price is a source change in `src/history.js` (a constant
  becomes a lookup) and a behaviour change for a project that asks for `locale: "en"` — the English it
  asked for. (2) **Translate `SKIP_WORDS` and re-take the expectations by hand:** the red moves into
  `test/frozen.test.js`'s promise — the golden and the manifest's `legacy.goldenSha256` would have to be
  edited, so the reference stops being the record of what that revision yields, and the generators cannot
  pay that price because they take the standard with the frozen copy. (3) **Leave `SKIP_WORDS` Russian and
  name it in the allow-list** beside the `ru` dictionaries: the cheapest, and the `--json`/`--data` answers
  keep one Russian word per reason in every locale — the criterion of the work then has a named exception
  instead of a plan it cannot afford.

  **For the user to decide:** (1), (2) or (3) — best together with N21, since both ask the same question from
  two sides: whether the frozen layer may move.

- **N25. The report page's panel is not localized: three hardcoded Russian strings.** Measured 2026-09-16 while
  planning subplan S5: `src/page/panel.js:9-11` builds the tooltip of every file checkbox out of literals —
  `' (нет на HEAD)'`, `' · категория: '`, `'из настроек'` / `'по расширению'` — while every other caption of the
  page (title, heading, category labels, metric notes) is picked by `cfg.locale` or read from the settings. The
  tracker's map puts the file in S5, so translating them is the planned step; what has to be decided is whether
  that is what is wanted, because the consequence is visible: a project with `"locale": "ru"` (both fixture
  configs pin it, and this repository's own settings do) keeps a Russian report with English chrome inside it,
  and this project's own tracked `docs/size-report.html` is that report.

  No check reads the three strings (measured: `rg -n 'нет на HEAD|категория:|из настроек|по расширению'` outside
  `src/` answers only unrelated assertion texts, and `test/parity.test.js:47` reads a built report but asserts
  only `src="`, `<link `, `id="data"`, `<style>`), and no reference moves: the fixtures carry no hook or panel
  word, and `fixtures/parity/artifact.sha256` is taken by the frozen copy (`legacyTool()`).

  **Options and their price.** (1) **Translate them** (S5's step 6 as written): the repository meets its own
  criterion, the chrome inside a Russian report becomes English, and nothing reddens. (2) **Move them into the
  locale dictionaries** so a `locale: "ru"` report keeps Russian chrome: a source change — a constant becomes a
  lookup in `appUi` — that is out of this work's scope by its own rule (literals only), and it grows every
  dictionary by three keys instead of removing three literals. (3) **Leave them Russian and name them in the
  allow-list** beside the `ru` dictionaries: cheapest, and the criterion then has a named exception for a file
  that is S5's own.

  **For the user to decide:** (1), (2) or (3). The subplan plans (1) and states that steps 1–5 do not depend on
  the answer — step 6 is the only one that moves.

- **N26. The numbers of the instruments stay Russian while their words turn English.** Measured 2026-09-16 while
  planning subplan W1: a duration is formatted with `.replace('.', ',')` in four places —
  `tools/run-tests.js:43` (`sec`), `:64` (`load`), and `tools/gates/run.js:111,114` (W2's profile summary) — so
  after the translation the fast profile would print `всего 12,2 с` turned into `total 12,2 s`, and a Russian
  decimal comma inside an English sentence. A separator is formatting rather than a string literal, and this work's
  own rule is that only a literal's value changes; no check reads it either (measured: no test matches
  `[0-9],[0-9]`, and the profile runner reads exit codes alone).

  **Options and their price.** (1) **Leave it and name it here** (W1's plan as written): the criterion of the work
  is about literals, the comma is a known residue in four call sites of two files, and a reader of an English run
  meets one Russian habit. (2) **Change the formatting in the same portion**: two files, four call sites, and the
  numbers become `12.2`; it is a behaviour change of the printed report (not of any measurement), so it is allowed
  only as a deliberate decision — and it would also touch `tools/gates/run.js`, a gate file, which needs the
  `Gate-Change:` trailer for a change that is not about a threshold. (3) **Force the locale in the instruments**
  (a `Intl.NumberFormat` with an explicit locale): more code for the same four lines, and it adds a locale question
  of its own — which locale the repository's own tooling should print in — that nothing else here asks.

  **For the user to decide:** (1), (2) or (3). It is the same kind of question as N25 (a printed surface that the
  literal-only rule cannot settle) and can be decided together with it.


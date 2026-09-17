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
sides (as the tool prints it): “in the tree: `src/only-in-merge.js` 77d3e2f, in the state: the file is absent”.

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
  `node bin/size.js --write` gives **code 5** and “internal error (this is a defect of the tool…)” with a stack from
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

  **Decided 2026-09-17 by the user: option (2) — the default locale becomes `en`.** Done in one commit:
  `src/config.js:19` `locale: 'ru'` → `'en'`, and the settings template follows —
  `templates/size-report.config.json` carries `"locale": "en"` and the `en` dictionary's own heading
  (`File size by commit`) in its `title`/`heading`, which is the same relationship to the dictionary the
  two Russian values had. **The blast radius is exactly these two files, as this note predicted, and that
  is measured rather than hoped:** with the change in place the **full** `verify` (8 steps) is green —
  `check:standards` reproduces both references, `parity:live` passes, `frozen` stays green and
  `pack:check`'s byte comparison answers `the report from the package is byte-identical: 66427 B`, because
  both fixture configs pin `"locale": "ru"` (`fixtures/parity/config.json`, `fixtures/synthetic/config.json`)
  and the builders (`tools/make-fixture.js:55`) pin it too. What a person meets instead: `--init`'s derived
  draft now pins `"locale": "en"` (measured in an empty repository), and a fresh project's report is English.
  **One step of the chain is worth naming, because the measurement contradicts the obvious reading:** this
  repository's own page does **not** turn English with this commit — its post-commit hook runs the engine of
  the **attached copy** in `node_modules`, and that copy is `2.4.0`, whose `src/config.js:20` still reads
  `locale: 'ru'` (measured). So the page follows the tree only after the release and the `pnpm add -D -E`
  that attaches the new version, which is exactly what `AGENTS.md`'s release step 3 is for. The `ru`
  dictionary is untouched either way: a project that wants Russian asks for it with the key, as before.

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

  **For the user to decide:** the cadence. **Answered in part, 2026-09-16:** pushes are no longer held —
  the mission agent's instruction is that every portion goes to `origin/main` as soon as its own commit is
  green, which is what the repository's own rule asks for anyway ("after every portion of work … the
  attached copy in this project is updated"). So what stays open here is only the release half: a PATCH per
  portion, or batched, with the registry's answer differing from the tree's source until the release. Before
  the first of those pushes the full profile was run by hand and was green (`pnpm run verify`: eight steps,
  including `test:all`, `parity:live`, `check:standards` and `pack:check`).

  **Decided 2026-09-17 by the user: option (2) — batch, because few portions are left.** The answer was
  conditional, and the condition is met rather than rounded off: "if few portions are left — batch; if the
  work is still long — a release per portion, so that the divergence does not accumulate". Measured when it
  was answered: the translation campaign wrote its last portion on 2026-09-17 (D1, its last owner), so what
  remained was the three self-contained repairs of `N19` (done the same day), `N31` and `N32` — a handful,
  which is why the batch is chosen: **one PATCH release after the last of them**, with the journal section
  saying what changes in the numbers, the pin in `README.md` and a single `git push origin v<version> main`.
  The divergence the batch accepts is named rather than left implicit: until that release the registry
  serves `2.4.0` with the Russian wordings while the tree is English, so anyone who installs inside the
  window gets the older interface — and the release is what closes the window.

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

  **Decided 2026-09-16 by the mission agent: option (1) — the references stay Russian and are recorded as an
  exception.** Nothing is re-taken, and the builders stay Russian with the references, because a translated
  builder changes the bytes `pnpm run check:standards` compares. Measured for the allowance (by counting the
  cyrillic lines of the ranges, not by subtraction): **107 lines** — the builders that write the fixture
  (`tools/synthetic/note.js` 37, `content.js` 31, `history.js` 20 = 88) and the instrument lines that write
  into a reference (`tools/parity-freeze.js:98-118` **16**, `tools/make-fixture.js:56,57,64` 3 = 19; the last
  item is the column label `заметки.md`). All 107 are now an **entry of the tracker's allow-list**, and its
  arithmetic is corrected with them: the allow-list 2 782 → **2 889**, the owners' side 2 730 → **2 623**
  (`tools/**` 387 → 368, `tools/synthetic/**` 89 → 1), the whole reading unchanged at 5 512. What stays free of this owner is **one line**: `tools/synthetic/repo.js:74` — an
  internal error thrown when the fixture's merge succeeds unexpectedly, written into no file (W3).

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

  **Decided 2026-09-16 by the mission agent: the table of numbers with sizes in a markdown file is not needed —
  a person has `docs/size-report.html` — and whatever is still tied to it may go.** Measured afterwards:
  **nothing is left to remove.** `CHANGELOG.md` and `test/changelog.test.js` went with the request itself, no
  markdown file in the tree carries the fixture's sizes (`rg -n '1597|1483|2 511' README.md docs/*.md` answers
  nothing), and the one entry that still names the guard — `tools/docs-facts.js:58`, in the list of paths a
  document may name — is **load-bearing for the archived plans**, which cite the path: the documentation guards
  read `plans/archive/PLAN.md` and `REFACTOR.md` (`DOCS`, `tools/docs-facts.js:37`), and dropping the entry would
  redden `test/docs-paths.test.js` on a record that is true. So this question closes as its own option (2): the
  numbers half of the promise is deliberately held by no check — the journal is where a release is described,
  and the numbers a person wants are in the page.

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

  **Closed without action 2026-09-16 by the mission agent.** The decision is "do nothing", and this note is what
  stands in place of a change — re-measured before closing: the two readers named above are updated, and no guard
  reads `docs/module-design.md`'s bare `PLAN.md`.

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

  **Decided 2026-09-16 by the mission agent: option (3) — `SKIP_WORDS` stays Russian and is named in the
  allow-list** (`docs/plans/2026-09-16-i18n-english/plan.md`), on the same ground as N21: the references stay
  Russian, and option (1) would be a change of **behaviour** rather than of a literal — `src/history.js`'s
  constant would become a lookup by `cfg.locale`, so a project asking for `locale: "en"` would start seeing
  English skip words it does not see today. No reference moves, S4's gated step is dropped
  (`diagnostics.md`), and the line joins the allow-list beside the `ru` dictionaries (the guard that would have
  enumerated it is withdrawn, N27). **The decision is reversible and its price is small, which is why it is worth naming:**
  option (1) reddens nothing (the fixtures pin `"locale": "ru"`, so every frozen byte stays), and the whole
  change is one constant in `src/history.js` plus the three words in `src/locales.js` — a fix-sized edit of
  some ten lines, decided once `en` becomes the default locale (N19) or when someone asks for English skip
  words in earnest. Until then the shipped answer keeps one Russian word per reason, and that is a named
  exception rather than an oversight.

- **N25. The report page's panel is not localized: three hardcoded Russian strings.** Measured 2026-09-16 while
  planning subplan S5: `src/page/panel.js:9-11` builds the tooltip of every file checkbox out of literals —
  `' (нет на HEAD)'`, `' · категория: '`, `'из настроек'` / `'по расширению'` — while every other caption of the
  page (title, heading, category labels, metric notes) is picked by `cfg.locale` or read from the settings. The
  tracker's map puts the file in S5, so translating them is the planned step; what has to be decided is whether
  that is what is wanted, because the consequence is visible: a project with `"locale": "ru"` (both fixture
  configs pin it, and this repository's own settings do) keeps a Russian report with English chrome inside it,
  and this project's own tracked `docs/size-report.html` is that report.

  **Status 2026-09-16: this decision is now the only thing keeping S5 open.** Steps 1–5 and the
  post-install note of step 6 landed (`src/hook.js` 40 → 0, `bin/postinstall.js` 2 → 0) and left exactly
  these three lines Russian, since translating them is the one step whose consequence a person sees.
  Nothing else of the runtime layer waits for a decision: the counter over the three files answers
  `src/page/panel.js` 3 and nothing else, and N28's condition (no module prints a Russian advice marker)
  already holds for `src/**`.

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

  **DECIDED 2026-09-16 by the mission agent: option (2), the words move into the locale dictionaries.** A
  report whose `locale` is `ru` stays Russian in its chrome, which is what a locale is for. What changed:
  `src/page/panel.js` reads `appUi.notOnHead`, `appUi.category`, `appUi.categoryFromConfig` and
  `appUi.categoryByExtension` instead of four literals (the file's counter 3 → **0**), the two dictionaries
  carry the four keys each (`src/locales.js`: `ru` in Russian, `en` in English), and `uiText`
  (`src/page/build.js`) passes them into the page's own dictionary — the path every other page caption already
  travels. Measured in a real DOM (jsdom) on pages built from the fixture, ru and en, by the decision's own
  reason: the ru report's checkbox reads `data/table.toml · категория: по расширению`, the en one
  `data/table.toml · category: by extension`, no tooltip holds `undefined` (16 boxes each), and the second key
  was exercised by naming a file absent on HEAD in the data block of an assembled page — the panel answers
  `src/code.js (нет на HEAD) · категория: по расширению`. Price paid: four keys in each dictionary instead of
  four literals, and the assembled page changes (the script and the `ui` block), which is a rebuild of this
  repository's own `docs/size-report.html` and nothing else — `fixtures/parity/artifact.sha256` is still taken
  by the frozen copy (`1bdb27e1…`), and `check:standards`, `parity:live` and `pack:check` are green. Of the
  three options this was the only one that keeps both reports in one language each.

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

  **DECIDED 2026-09-16 by the mission agent: a number is formatted by `Intl.NumberFormat` in the locale the
  machine runs in.** One helper, `localeNumber(n, digits)` in `tools/harness.js` (the module both callers already
  import from), took the place of `sec()` and `load()` in `tools/run-tests.js` and of two `toFixed(1).replace`
  calls in `tools/gates/run.js`: four call sites, two files, one implementation — the separator now belongs to
  the locale rather than to a sentence, and no locale is pinned, because the question "which language should the
  repository's tooling print in" is one nothing here asks. Measured: `LC_ALL=en_US.UTF-8` answers `12.20`, while
  `ru_RU.UTF-8` and `de_DE.UTF-8` answer `12,20`; the fast suite run whole under `LC_ALL=ru_RU.UTF-8` prints
  `✓ fast run: 70 checks, failures 0, 6,17 s (load at the start 3,08; …)` and stays green (the tests read exit
  codes and their own texts, not these numbers — no check matches `[0-9],[0-9]`). `tools/gates/run.js` is a gate
  file, so the commit carries the `Gate-Change:` trailer; the change is not about a threshold, and it is named
  there. Nothing shipped moves: the numbers of the report itself are the report's own business
  (`src/derived.js` splits thousands by thin spaces on purpose), and no reference, artifact or golden was
  touched.

- **N27. The language guard (`G1` of the tracker) is withdrawn.** Planned, never written: the last row of the map
  was a check that would redden on a new Russian literal outside the allow-list, and the tracker's criterion
  allowed it to be either built or declined with a reason.

  **Decided 2026-09-16 by the mission agent: not needed.** The reason given: the instruction this work follows
  says English everywhere except the reply in the chat, so Cyrillic arriving in new code, checks or documentation
  is a near-impossibility rather than a risk worth a check. What holds the allowance instead is the work's own
  acceptance, which every subplan already carries: the counter per file, before and after, quoted in the plan and
  in the journal entry, and the allow-list as an enumeration in `plan.md`.

  **The price, named rather than hidden.** A stray Russian literal added later is caught by a person running the
  counter, not by the suite — the guard would have been the only thing that reddens by itself. The two tolerances
  that would have been enumerated to it (W1's `commandsAt`, which reads the section name out of the pinned
  revision, and C3's `требовани|requirements?` resolver, kept for a coverage reason) are in the allow-list
  instead.

  **Reversible, and the measurements are kept.** If Cyrillic ever appears in work written under that instruction,
  the guard is a test file plus one line in `tools/gates/gatefiles.js`. Measured 2026-09-16 while planning it, so
  that a later hand does not take the measurements again: a counter over `git ls-files` with the pattern
  `\p{Cyrillic}` (the pattern carries no Cyrillic and cannot match itself) runs in **3.0 s** over the tree and
  finds **122 files** with Cyrillic outside `worklog/**`; such a file would run in the full suite by default,
  and `test/suites.test.js` demands its declaration in `tools/suites.js` — together with `tools/gates/gatefiles.js`
  that is two gate files, so its commit would carry a `Gate-Change:` trailer. The simplest working form was chosen
  as an explicit list of allowed paths with a reason each (a path-only entry for what is wholly an exception, a
  path with a count for a file that is mostly clean), **not** a mechanism of regex exceptions: a regex per
  exception is unreadable at a glance and hides the reason inside the pattern, while a list of paths and reasons
  is what a person can check by eye — which is the whole point of a guard that exists to be trusted.

- **N28. S1's wash-up (`ADVICE_LINE`) is deferred: the Russian markers are still printed — CLOSED
  2026-09-16 in W1's step 8.** Deferred 2026-09-16 at the end of subplan S1
  (`docs/plans/2026-09-16-i18n-english/surface.md`, step 5) — not dropped, and with its condition
  measured rather than guessed. The closing measurement is at the end of this note.

  **What S1 has already done.** The counter half of the wash-up holds: `rg -cP '[\p{Cyrillic}]'
  src/refusal.js src/args.js src/cli.js src/modes.js` answers nothing. The help, the cause registry,
  the grammar's messages and everything the modes print are English.

  **Why the `ADVICE_LINE` half waits.** The transitional tolerance in `tools/refusals.js:117` accepts
  Russian markers beside the English ones, and the Russian ones are still what other modules print.
  Measured 2026-09-16 (`rg -n 'починка|создайте его|соберите её|локально:|в CI:' src tools bin`):
  `src/config.js` 4 plus `создайте его` 1 and `src/init.js` 1 (**S2**), `src/strip/guard.js` 1 and
  `src/minify.js` 1 (**S3**), `src/git.js` 2 plus `src/history.js` 2, `src/check.js` 1,
  `src/doctor.js` 1 and `src/explain.js` 4 (**S4**), `src/hook.js` 4 (**S5**). Outside `src/**` the
  markers appear only in `tools/gates/dup.js` and `coverage.js` (W2), and those two are never parsed
  by the extractor — W1's own measurement, `tools.md` step 8.

  **The condition, exact.** The narrowing may land when **no `src/**` module prints a Russian
  marker** — that is S2, S3, S4 and S5 finished — and it belongs to **W1's step 8**, which owns
  `tools/refusals.js`. The red-first experiment is written there already: put `починка: ` back into one
  refusal's text after the narrowing and the catalogue's advice assertion goes red, because `adviceOf`
  returns nothing for it.  **The price of deferring.** While four owners still print the Russian markers, a translated module
  could print one again and the extractor would accept it without the catalogue noticing the
  difference — acceptable while the tolerance is a fact about the tree, and the reason the narrowing is
  the last step of the instrument's own work rather than of the runtime's.

  **Closed 2026-09-16, in W1's step 8, and the price was paid twice over rather than assumed.** The
  condition held: measured over `src`, `bin` and `tools`, the only Russian advice markers left are
  `tools/gates/dup.js:139` and `tools/gates/coverage.js:93` (W2's sensors), and `adviceOf` — the single
  call site is `test/refusals.test.js:245` — is applied to the tool's output alone, so nobody else needs
  the tolerance. `ADVICE_LINE` now reads `/(?:\bfix|\bcreate it|\bbuild it|\blocally|\bin CI): (.+)$/`
  and the comment above it says so instead of promising a tolerance that no longer exists. The red
  experiment was run twice, and the first result is worth keeping: putting `починка: ` back into the
  **shallow** case's printed advice (the case the plan named) left the catalogue **green**, because that
  refusal prints two advice lines and the extractor's assertions are about the texts being named, not
  about the marker. Putting it into `config already exists` — one advice line — reddened exactly as the
  plan promised: `«settings and the project / config already exists»: отказ ничего не советует, а
  каталог объявил совет`. What the tolerance was buying is therefore narrower than it looked, and what
  it cost is now visible: an advice that loses its marker while a second advice line stays is invisible
  to the catalogue either way.

- **N29. Three literals of `tools/harness.js` cannot be translated while `tools/parity-live.js` keeps its copy
  of the same function — the pair is a clone the baseline accepts.** Found 2026-09-16 in W1's step 1, and it is
  not a sensor to be talked out of its verdict: `dup` counts token sequences, `dup-baseline.json` holds the
  fingerprints of the accepted clones, and a translated string is a different token — so the *same* twin appears
  as a **new** clone. Measured, three ways: with the file Russian, `pnpm run dup` answers “новых клонов нет
  (клонов 10 … в базе 15 отпечатков)”; with it English, “новых клонов 4”, both between `harness.js:254` and
  `parity-live.js:74`; and with everything English *except* `firstDiff`'s three string literals, green again.

  **What the three literals are.** The two lines of `return 'строка ' + (i + 1) + …` and the tail
  `'различие в байтах при одинаковых строках (переводы строк или кодировка)'` (`tools/harness.js:259-263`).
  Both `tools/harness.js` and `tools/parity-live.js` carry a `firstDiff` of their own; the copy in
  `parity-live.js` is the only reason the shared one cannot be reworded, and **two other consumers already take
  the shared one** (`tools/check-standards.js:27`, `test/parity.test.js:16`, `test/crlf.test.js:14`). So the
  duplicate is redundant by the repository's own usage rather than by taste.

  **Two repairs, and their prices.** (1) **Remove the copy** — `tools/parity-live.js` drops its `firstDiff` and
  takes the shared one beside `collectOutput, gitIn` it already imports from `tools/harness.js`: ~13 lines
  deleted, no behaviour changed, the clone disappears and W1's step 4 stops facing the same wall (translating the
  copy there would land in this blocker again). The price: it is a code change, not a translation, in the file of **another
  step of the same subplan** — so it needs the mission agent's word, and it must be its own commit with an
  English message saying why (the sensor's own verdict line asks for exactly this: “чинить код (вынести общее),
  а не базу”). (2) **Leave the twin and the three literals Russian**, as this portion does: three lines of a
  developer-facing message in an instrument that ships nothing, recorded in the tracker's allow-list as an
  exception with its reason. The price: the acceptance of W1 ends at 28 Cyrillic lines instead of 25, one of them
  a place where a translator would have written English, and step 4 inherits the same decision for
  `parity-live.js`'s copy — which (2) does not resolve.

  **For the user to decide:** (1) or (2). It is the first blocker of this campaign that a **literal cannot buy
  its way out of**: every other one was about a word reaching a reader, this one is about two implementations
  being the same tokens.

  **DECIDED 2026-09-16 by the mission agent: repair (1).** The copy in `tools/parity-live.js` was removed and
  the shared `firstDiff` is imported there beside `collectOutput, gitIn`; the three literals of the shared one
  are English, and the three of the copy went with it. Measured after the repair: `pnpm run dup` answers
  **8 clones, 47 lines** where it answered 10 and 62 — the tree holds one implementation instead of two, and the
  baseline's stale fingerprint for the removed twin is simply not found, which is what a baseline is for. One
  implementation, three importers (`tools/check-standards.js:27`, `test/parity.test.js:16`,
  `test/crlf.test.js:14`) plus `tools/parity-live.js:36`. The tool that prints the diff still works:
  `parity:live` green over both environments with the shared function, `node -e` on it prints
  `line 2\n    in the output: "bb"\n    in the reference: "cc"`. The price paid is the cosmetic difference the
  copy had kept (its continuation lines were indented six spaces and its tail line was shorter); no reader
  reads either — measured when the literals were translated — and the duplicate sensor is the sensor that
  would have caught the difference if anyone had.

- **N30. The counter's word agreement is Russian grammar: an English word prints `21 check`.** Found 2026-09-16
  in W1's step 3, by the measurement the mission asked for rather than by reading.

  **What was measured.** The helpers of `tools/run-tests.js` were taken out of the file's own text and run over
  the counts that occur in practice: `1 check | 1 file`, `2 checks | 2 files`, `4 checks | 4 files`,
  `5 checks | 5 files`, `11 checks | 11 files`, `70 checks | 70 files` — and `21 check | 21 file`. The same
  defect waits at 31, 41, 51 … but not at 21 on every list: it shows up whenever a count ends in 1 above 20,
  which for the number of checks is an ordinary day (`✓ fast run: 21 check, failures 0, …`).

  **Why it is not a literal.** `plural(n, one, few, many)` branches on the last digit — `last === 1` gives the
  singular form — and that is the Russian rule, where “21 проверка” is right. In English the singular is only
  `n === 1`, so **no choice of the three words can be right for both 1 and 21**:
  `('check', 'checks', 'checks')` prints `21 check`, and `('checks', 'checks', 'checks')` prints `1 checks`.
  Measured both ways, not argued.

  **The repair, one line.** `plural` returns the singular only for `n === 1` (the `few` branch stays in the
  signature or goes with it — a decision for whoever writes it). It changes no number and no count: only the
  word of a count ending in 1. The engines that would have to agree are the runner's two printed lines.

  **The price of waiting.** Until then the instruments print `21 check` — wrong English in a message a
  **developer reads on every run**, which is worse than the Russian it replaces because it looks like a typo
  rather than a language choice. The price of the repair: one line of code in an instrument, i.e. a behaviour
  change in wording, which is why it is recorded instead of taken. It can ride in the same commit as N29's
  repair (1): both are one small code change in `tools/**`, both are debts created by this work, and both leave
  the numbers alone.

  **What is not part of it.** `sec()` and `load()` keep the decimal comma (`replace('.', ',')`) — that is
  **N26** — decided on 2026-09-16 as well (below), and with it the whole comment at `tools/run-tests.js:40`
  went, since it existed to explain the comma; only the word-half of that comment
  moved here, and the comment itself is prose left in place (`TODO.md`).

  **DECIDED 2026-09-16 by the mission agent: the repair is taken.** `plural` now takes two words and returns
  the singular only for exactly one (`n === 1 ? one : many`); the `few` slot went with the language that needed
  it, and the two call sites pass two words. Measured from the file's own text after the repair: `0 checks`,
  `1 check`, `2 checks`, `4 checks`, `5 checks`, `11 checks`, `21 checks`, `22 checks`, `24 checks`,
  `31 checks`, `70 checks`, `101 checks` — the class that was wrong (21, 31, 101) is right, and the runner's
  own line reads `✓ fast run: 70 checks, failures 0, …`. No number moved: the counter still finds 70 checks in
  the fast run and 175 in the full one, and `SITES`, `PRINTED` and `CASES` are untouched. The comment above the
  helper was rewritten to say what the two forms are, and it now carries no Russian quotation: the word half of
  `tools/run-tests.js:40` stopped being an exception with the repair, and the file's counter fell to one line
  (`:22`, the example that names a Russian test — `TODO.md`, and C2/C3 will move it with the checks' names).

- **N31. The duplicates baseline carries seven fingerprints the tree no longer produces, so its scripted
  re-take would change its composition — the note was moved by hand instead.** Measured 2026-09-16 in W2's
  step 3, while translating the `note` the sensor writes into `dup-baseline.json` (`tools/gates/dup.js:128-129`).
  The plan for that step asked for the baseline to be **re-taken by the script** (`pnpm run baseline:dup`),
  the way `AGENTS.md` says baselines are updated. The measurement says the script would not be a one-word
  edit: the committed baseline holds **15 fingerprints**, the tree produces **8** (the sensor's own reading:
  `clones 8, lines 47, the baseline holds 15 fingerprints; looks 2`), and `newer()` counts only what *exceeds*
  the baseline, so the seven extras are tolerated leftovers of earlier states — clones that no longer exist.
  A re-take writes `current.counts`, so it would prune them: `dup-baseline.json` would lose seven entries, its
  fingerprints going from 15 to 8 — a **composition** change rather than a wording one, and this portion's own
  frame forbids exactly that ("behaviour, thresholds, fingerprints and the composition of the baseline do not
  move").

  **What was done instead.** The `note` was moved by hand — the JSON diff is **one line**, the fingerprints are
  byte-for-byte what they were (`git show HEAD:dup-baseline.json` compared with the file: same set of 15, same
  counts), the sensor answers as before (`✓ dup: no new clones (clones 8, lines 47, the baseline holds 15
  fingerprints; looks 2: the baseline file, against origin/main)`), and the hand-written text was proved
  **identical to what the script writes** (the two string literals of `tools/gates/dup.js` evaluated and
  compared with the JSON value: equal). So a later `pnpm run baseline:dup` will not change the file's wording;
  what it would change is the composition, and that is a decision of its own.

  **For the user to decide:** whether to prune the seven stale fingerprints. Price of pruning: it is one
  script run (`pnpm run baseline:dup`) with a `Gate-Change:` trailer, and the ratchet becomes **stricter** —
  a fingerprint absent from the baseline can never hide anything, so while the seven sit there, a reappearance
  of those seven historical clones would pass silently. Price of keeping them: the file says 15 while the tree
  has 8, which a reader of the file has to notice for themselves. Nothing else moves either way, and the same
  question will be measured for `coverage-baseline.json` in W2's step 4 rather than assumed to be identical.

  **Decided 2026-09-17 by the user: prune the garbage.** Done exactly as `AGENTS.md` prescribes —
  `pnpm run baseline:dup`, no hand editing: the baseline goes from **15** fingerprints to **5** (the number the
  note itself predicted it would, 8, then fell further as N33's and N34's extractions took their pairs out),
  the diff being 1 insertion and 11 deletions, and the five that stay are entries the file already had
  (`schema`, `config` and `note` compare equal to the previous revision, and every surviving fingerprint is
  present in it — measured against a copy). The sensor's reading is unchanged —
  `✓ dup: no new clones (clones 5, lines 29, the baseline holds 5 fingerprints; looks 2: the baseline file,
  against origin/main)` — while the ratchet is now **stricter**: the file says what the tree produces, so a
  reappearance of any of the ten historical clones counts as a new clone instead of hiding behind a tolerated
  leftover. The reason travels in the commit's `Gate-Change:` trailer, the baseline being a gate file.

- **N33. A translated block inside an accepted clone pair becomes a *new* clone: `test/minify.test.js` ↔
  `test/tokens.test.js`.** Measured 2026-09-16 in C2's steps 4–5, after translating those two files' prose.
  `node tools/gates/dup.js` answers `✗ dup: new clones 4 (the baseline holds 15 fingerprints, the tree has 7)`
  with two pairs, each counted twice (`[the baseline file]` and `[against origin/main]`, the sensor's two looks):
  `8 lines, 109 tokens: minify.test.js:252 ↔ tokens.test.js:158` and
  `7 lines, 71 tokens: minify.test.js:260 ↔ tokens.test.js:165`.

  **The pairs are not new in substance — only their fingerprints are.** With the four files put back to their
  `HEAD` version the sensor answers `✓ dup: no new clones (clones 7, lines 42, the baseline holds 15
  fingerprints)` (measured, then restored byte-identical): the same two blocks are **accepted twins** of the
  baseline, whose fingerprint was taken while their words were Russian. The fragment carries a test name and a
  message (`'the --init draft leads a new project to …'`, `'the draft was not built: ' + made.stderr.trim()`),
  so translating them changes the token sequence, the fingerprint changes with it, and `newer()` counts the pair
  as new. It is the same class as **N29** (`firstDiff` in `tools/harness.js` / `tools/parity-live.js`), and the
  same mechanism: the sensor measures a shape, and a translation is a different shape.

  **What is actually duplicated.** Both files set up the same fresh project by hand — `fs.mkdirSync(src)`,
  `git init -q -b main`, the three `git config` lines — although `initRepo` (`tools/harness.js:116`) already
  does exactly that and is used by `doctor`, `disk` and `cli-paths`; then both write their own `src/code.js`,
  commit it, run `--init` and assert the same `the draft was not built: …`. So the twin is **real duplication of
  setup**, not a coincidence of wording.

  **What was not done.** No word was varied to hide the twin and no baseline was edited — `AGENTS.md` forbids
  both ("fix the code, not the sensor"; "a baseline is updated by a person"), and this portion's frame says the
  answer to a twin is not to "tinker with words without need".

  **Decided by the user on 2026-09-17: take the shared part out** (way 1 of the three that were put to the
  user: the sensor's own advice, and the repair **N29** took). No word was varied to hide the twin and no
  baseline was touched. The repair landed as a commit of its own, `897a780`: `tools/harness.js` gained
  `draftedRepo(dir, code)` — `initRepo` plus the file under measure, the two git commands, `--init` and the
  assertion that the draft was built, returning `{ dir, file }` — and the two checks' seven hand-rolled lines
  (four of which were already what `initRepo` does) became a two-line call. Measured after it: both files green
  (9 + 7 checks), `dup` green with the count **falling** — `clones 7, lines 42` before, `clones 5, lines 29`
  after — and the two files' remaining Russian lines are their payloads and the `ru` dictionary reads alone.
  The one literal that belonged to both, the scenario's commit subject, moved into the helper; nothing asserts
  on it.

  **Left for the user, as the same family of questions:** whether the two baselines are re-taken at all —
  **N31** (the seven stale `dup` fingerprints) and **N32** (the coverage ratchet, red on the tree before any
  translation). Neither has anything to do with this repair, and neither is touched by it.

- **N32. The coverage ratchet is red on the tree: 13 regressions, and the baseline is 261 commits old.**
  Measured 2026-09-16 in W2's step 4, **before** anything was translated: `pnpm run cover` answers
  `✗ cover: regressions 13 (the baseline holds 39 files)` with the totals `lines 80.6%, branches 89.05%,
  functions 92.37%` and **0** new and **0** gone files — the key set of the baseline is intact, the values
  are behind. The thirteen: `src/cli.js` 91.95 → 91.66, `src/config.js` 95.79 → 95.72, `src/data.js`
  branches 91.66 → 89.47, `src/derived.js` 75.86 → 75, `src/doctor.js` 98.93 → 98.91, `src/explain.js`
  97.69 → 97.67, `src/git.js` 98.19 → 98.14, `src/hook.js` 88.16 → 87.64, `src/metrics.js` 99.25 → 98.88,
  `src/modes.js` 98.34 → 98.31, `src/parse.js` 79.41 → 78.35, `src/strip.js` 98.27 → 98.18,
  `src/strip/guard.js` 96.61 → 94.82. After the sensor's own translation the same run answers the same
  thirteen and the same totals — so the red is pre-existing and this portion moved no measurement.

  **The age, measured.** The baseline was last written on 2026-09-15 (`202c768`, the page-and-hook release)
  and **261 commits** have landed since, 34 of them touching `test/**` and 33 `src/**`; each of the thirteen
  files was last touched either by a campaign translation commit (eleven of them) or by that very commit
  (`src/data.js`, `src/derived.js`). A hypothesis is worth naming rather than asserting: a translated
  literal that becomes a two-line concatenation adds a line to the file's total, so a share falls without a
  lost check. **Why nobody saw it:** `cover` lives in the slow profile, CI runs that only on a schedule
  (`Проверки по расписанию`, cron `17 4 * * 1`), and that workflow — landed `10c9e43`, 2026-09-15 — has no
  runs at all yet: the first scheduled run is still ahead, and it will meet this red.

  **What was done instead of a re-take.** The baseline's `note` was moved by hand, as in N31: the JSON diff
  is one line, `files` is byte-for-byte what it was (39 keys, same values, compared with `git show HEAD:`),
  and the text was proved equal to the script's own four literals. The re-take itself was measured but not
  taken — it would keep the same 39 keys (0 added, 0 gone) and move **20** metric values: the thirteen
  falls listed above and seven rises over four files (measured by comparing the coverage summary the sensor
  had just written with the baseline): `src/history.js` lines 95.06 → 95.31 and
  branches 96.8 → 96.96, `src/journal.js` lines 89.39 → 89.7, `src/optional.js` lines 93.54 → 93.93,
  `src/project.js` lines 96.22 → 96.63, branches 91.78 → 92.22, functions 94.44 → 95.

  **For the user to decide:** re-take the baseline (one `pnpm run baseline:coverage` with the
  `Gate-Change:` trailer) or fix the coverage. Price of the re-take: it accepts the thirteen falls **and**
  the four rises without asking why the falls happened — the ratchet then starts from today. Price of
  waiting: the slow profile is red locally and its first scheduled CI run will be red too. Unlike N31  this is **not** a composition change (no key would appear or vanish), which is the difference between the two
  baselines, and the reason the two questions are recorded separately.

  **Decided 2026-09-17 by the user: fix the sensor, not the baseline — count what actually executed rather
  than a file's share.** The unit changes from a percentage to a count, and that is what makes the ratchet
  mean what it says: a percentage falls when a file merely grows (a translated literal split into a two-line
  concatenation adds a line the report counts and the suite never reaches), while a count of executed lines
  moves only when the code stops being run. **The instrument for it is already in hand, measured:** c8 runs
  with `json-summary` (`.c8rc.json`), so every file of the summary it writes beside its report (the file
  `coverage-summary.json`, inside the gitignored report directory) carries
  `lines: { total, covered, skipped, pct }` beside branches and functions — `src/cli.js` today reads
  `{"total":84,"covered":77,"pct":91.66}` while the baseline holds the percentage `91.95`, which is exactly
  the pair that cannot be compared in the new unit and the reason a re-take is inseparable from this change.
  **The price is named rather than discovered:** the baseline changes its **shape** (counts instead of
  percentages), so `coverage-baseline.json` is re-taken in the same commit — with the `Gate-Change:` trailer,
  a gate file — and the sensor's own probes move with it, since `test/gates-coverage.test.js` asserts the
  verdict's wording **and** its numbers (`/src\/x\.js — lines: was 80, now 50/`, `was not in the baseline,
  now 0`); that file is a gate file too. Both references and every frozen byte stay untouched (coverage is
  measured over this repository's own sources, not over the fixtures). **Not done in this portion:** it is the
  next one, after which N20's batched release follows.

  **Done 2026-09-17.** `tools/gates/coverage.js` now takes its unit from c8's own `covered` numbers:
  `counts(point) = { lines: point.lines.covered, branches: …, functions: … }`, and the whole-set shares are
  printed to a person while they are no longer compared. **The two halves of the claim are measured on the
  real report, not argued:** with the executed counts of the freshly taken coverage, the real `src/cli.js`
  (`{"total":84,"covered":77,"skipped":0,"pct":91.66}`) **grown by 24 lines — green** (`✓ cover: no
  regressions (the baseline holds 39 files)`, exit 0, even though its share falls to 71.3%, well below the
  91.95% the previous baseline held), while **one executed line less reddens** with
  `src/cli.js — lines: was 77, now 76` (exit 1) and **one executed branch less** with
  `src/cli.js — branches: was 34, now 33`. So the ratchet is a floor over execution rather than a promise
  about the share, and it is sensitive to a single line.

  **The baseline's shape moved with the unit, and only its shape.** `coverage-baseline.json`: `schema` 1 → 2
  and a new `unit` field, the entries going from shares to counts — `src/cli.js` was
  `{"lines":91.95,"branches":97.14,"functions":100}` and reads `{"lines":77,"branches":34,"functions":9}` —
  while the **key set is identical: 39 files before and after**, so this is not a composition change (the
  difference N31 had). The `note` inside the file was extended to say what the unit is, since it is the
  first thing a reader of the file has, and a re-take now writes the same counts it would read back. The six
  files that legitimately read zero executed lines are named by the note and re-measured: `bin/postinstall.js`
  and the five `src/page/*.js` chapters node pastes into the assembled page.

  **The slow profile is green, and that was the point.** `pnpm run cover` answers
  `✓ cover: no regressions (the baseline holds 39 files)` with the same totals it printed while it was red
  (`lines 80.6%, branches 89.05%, functions 92.37%`) — the numbers did not move, the unit did, and the
  thirteen “falls” that reddened it were exactly the class the decision names (share down, execution
  unchanged). `pnpm run verify:slow` runs green end to end: **10 steps, 198.5 s**, of which `cover` 69.0 s;
  the sensor's own cost is unchanged (the same c8 run, one more map of counts), and `tools/**`'s Cyrillic
  counter stays at 111 (the sensor carries no Russian of its own).

  **One implementation decision, with the price of the alternative named:** the user's answer spoke about
  lines, and branches and functions were given the same unit because the flaw is identical for all three
  and one file should not carry two units — the price of narrowing to lines alone is one word in `METRICS`,
  recorded here rather than decided in silence. The transducer of the verdict, `test/gates-coverage.test.js`,
  moved in the same commit and got **stronger**: its reports are written in counts, its baseline too, and it
  gained the two cases the decision rests on — a fall of exactly one executed line is red, and a file that
  grew while keeping every execution is green (3 of 3 green). Both are gate files, and the commit carries the
  `Gate-Change:` trailer.

- **N34. The same pair formed a second time: a translated block inside an accepted clone pair becomes a *new*
  clone (`test/cli-paths.test.js` ↔ `test/doctor.test.js`).** Measured 2026-09-17 while translating for `doctor`
  (C2's step 6): the sensor answered `✗ dup: new clones 2` over one pair — `cli-paths.test.js:28` ↔
  `doctor.test.js:176`, **6 lines, 52 tokens**, reported both against the baseline file and against `origin/main`.
  With the three files of that portion put back to their `HEAD` version the same run was green
  (`✓ dup: no new clones (clones 5, lines 29, the baseline holds 15 fingerprints)`, measured), so the pair is not
  new in substance: it is the shallow-clone setup both checks had written out with the **same two messages**
  (`the truncated working tree was not assembled: …`, `the working tree came out complete: there is nothing to
  check`), whose fingerprint was taken while their words were Russian — the class **N33** describes. `dup` names
  the honest reading itself: the duplicated thing is real duplication of setup, not a coincidence of wording.

  **Answered by the rule N33 was decided with** (taking the shared part out; not varying a word, not editing the
  baseline): `tools/harness.js` gained `shallowClone(source, into)` — the `git clone --depth 1` of a source plus
  the two assertions both checks made, returning the working tree — and both checks' five hand-rolled lines became
  one call. Measured after it: `clones 5, lines 29` (the numbers the tree had before the port), `dup` green, the
  baseline untouched, the file green at 11 checks and the neighbour at 3. The extraction touches a file of another
  owner (`test/cli-paths.test.js`, step 3's) and a tools file, which is why the commit is named in `tests-cli.md`
  rather than hidden inside the translation.


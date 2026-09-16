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

- **Слияние: git не зовёт `post-commit` — проверено опытом, не догадкой.** При
  `git merge` хуков `pre-commit`/`commit-msg`/`post-commit` не бывает вовсе: git
  создаёт коммит слияния сам, и вызывается `post-merge` (опыт на git 2.50: три
  обычных коммита дали три `POST-COMMIT`, слияние — только `POST-MERGE`). Хук
  автообновления из-за этого ставится двумя файлами (`src/hook.js`), и
  `git commit --only` на слиянии отказывает (`cannot do a partial commit during a
  merge`, потому что `MERGE_HEAD` жив, пока работает `post-merge`) — поэтому
  коммит отчёта собирается плумбингом. Оба факта — про API git, а не про этот
  проект, и стоят здесь, чтобы их не переоткрывали.

- **N13. Пин в примере установки отстал, а лишнее слово не отвергалось** — **закрыто 2026-09-14** (`REFACTOR.md` R-4.13).
  **Воспроизведение.** `README.md` §1 ставил пакет примером
  `pnpm add -D github:vernikr/size-report#d63468d`, а §5–§6 учат `size check`,
  `size doctor`, `size explain <sha>` и `size install-hook`. На той ревизии справка
  знает только флаги, а `plainWords` собирал слова без разбора: любой лишний или
  неизвестный ключ просто не читался, и прогон отвечал обычной проверкой таблицы.
  **Следствие.** Документированный путь установки вёл в пустоту, причём без отказа:
  `check`, `doctor`, `explain` и `install-hook` отвечали нулём, ничего не сделав (хук
  не ставился), а `templates/` в поставке не было. «Всё хорошо» на то, чего
  инструмент не умеет, хуже отказа — именно это и нашёл сквозной прогон. Тот же
  пи́н держал и проект-потребитель, так что шаг 5 (интеграция) стоял на ревизии без
  всего, что шаг 5 добавил.
  **Починка.** Незнакомый ключ, ключ со значением без значения (`--config`),
  `--force` без `--init` и слово после режима со значением — отказ кодом 2 с
  названным виновником и готовой командой, и разбор аргументов идёт **до чтения
  проекта**. Пример установки ведёт на ревизию, где названные команды есть, причём
  **сорока знаками**: короткий sha pnpm разрешает только через верхушки веток, и он
  же перестаёт разрешаться на следующем коммите в неё — сторож документации
  проверяет и это, и то, что в справке **той** ревизии есть названные команды;
  пи́н в потребителе поднят. Держится: `test/cli.test.js` (набор отказов) и
  `test/docs-pin.test.js` («пример установки ведёт на ревизию, чья справка знает
  названные команды»).

- **N14. Храповик покрытия падает от комментариев, а не от кода: просадок 11, из них 10 — наши,
  одна — давняя.** Шаг `cover` в slow-профиле красный. Разобрано тремя замерами в отдельных
  рабочих копиях (`git worktree`), а не по памяти.

  **Где он был красным.**
  1. На ревизии `202c768` (там `coverage-baseline.json` и снят): **зелёный** — «в базе 39 файлов,
     просадок нет» (83.29 % строк). Значит база была верна своему дереву.
  2. На ревизии `758a385` (**родитель первого прохода по комментариям** этой переработки):
     **уже красный**, ровно одна просадка — `src/data.js`, ветви 91.66 → 89.47. Этот красный к
     переработке комментариев отношения не имеет: он приехал с работами по дереву отчёта и странице
     (`364a0ac`, `da69a32`, `4079329` — они между базой и этой ревизией), а база после них не
     переснималась. То же число `89.47` стоит и сейчас — то есть эта просадка не наша ни строкой.
  3. Сейчас: 11 просадок — та же `data.js` плюс десять файлов с падением доли на десятые доли
     процента (`cli.js` 91.95 → 91.66, `hook.js` 88.16 → 87.64, `derived.js` 75.86 → 75 и т. д.).

  **Механизм, доказанный числами.** `c8` считает строкой **каждую строку файла, попавшую в диапазон
  покрытия**, а покрытой — ту, что лежит внутри исполнившегося диапазона; поэтому удаление
  комментария внутри исполнившегося кода уменьшает и числитель, и знаменатель на единицу, а доля
  как отношение падает. Подтверждение по десяти файлам: `Δпокрытых = Δвсего = число удалённых строк`
  (`hook.js` −19 = −19 = −19: 395/448 → 376/429; `cli.js` −3 = −3 = −3: 80/87 → 77/84). И
  `lines.total` совпадает с числом строк файла минус строку в конце: у `derived.js` это 112 против
  113. Десятый файл — единственный, где числа разошлись: `strip/guard.js` 57/59 → 55/58, то есть в
  числителе пропало на строку больше (там комментарии переписаны и в шапке, и внутри кода, а
  `total` считает все строки файла, тогда как `covered` — только попавшие в исполнившийся диапазон).

  **При этом проверок не потеряно ни одной.** Итоги по дереву не упали, а чуть выросли: было 80.53 %
  строк (на `758a385`) — стало 80.57 %; ветви 89.05 % и функции 92.37 % — те же. И код в проходах не
  тронут: ни в одном коммите `refactor(comments)` в `src`/`bin` нет ни одной добавленной, удалённой
  или изменённой строки кода — единственное, что там менялось, — текст комментариев в концах строк.

  **Цена такого датчика.** Красный шаг читается как «код приехал без проверки», хотя означает
  «комментарий стал короче». Обещание храповика для этого случая неверно, и на проходе по
  комментариям он краснеет гарантированно — то есть остаток работы (`M9f`, `M10` ~6200 строк, `M11`)
  будет краснеть на каждом шаге.

  **Варианты и их цена.**
  1. **Переснять базу** (`pnpm run baseline:coverage`, человеческое действие, трейлер `Gate-Change:`).
     Дешево и честно ровно наполовину: заодно прощаются настоящие просадки, а они есть — та самая
     `data.js`, которая не переснималась с момента, когда её уронила работа по отчёту. И следующий
     проход по комментариям покраснеет снова.
  2. **Научить датчик считать исполнившиеся строки, а не долю от всех** (сравнивать `covered` с
     исполнившимися строками или перейти на `statements`/`branches` без `lines`). Тогда комментарии
     перестанут влиять вовсе. Это правка датчика, то есть гейт-файла: своя цена (трейлер, проверки
     датчика, выпуск) и смена смысла храповика — с «доли строк файла» на «сколько проверок
     исполнилось».
  3. **Оставить как есть и записать соглашение**: после каждого прохода по комментариям база
     переснимается человеком. Красный шаг остаётся сигналом, но требует человеческого шага в каждом
     таком проходе — и до этого шага slow-профиль и расписание CI красные.

  **Решать пользователю:** какой вариант принять. До решения `pnpm run verify:fast` и `pnpm run
  verify` зелёные (в полном профиле `cover` не гоняется вовсе), а `pnpm run verify:slow` и
  `verify-slow.yml` по расписанию — красные: одна просадка давняя, десять наши-механические.

- **N15. Свой отпечаток клонов у датчика дублей — возможно, уже лишний.** Нашлось на проходе M10f
  (2026-09-15) при сверке комментариев: и в `tools/gates/dup.js`, и в `test/gates-dup.test.js` стояло,
  что родная база jscpd (`--baseline`) привязана к пути выкладки, и потому храповик построен на своём
  отпечатке. **Измерено — для закреплённого jscpd 5.2.0 это неверно.** База, снятая самим jscpd
  (`--update-baseline`, формат `{version, fingerprints}`), применённая к тому же дереву в другом
  каталоге, остаётся зелёной (`--fail-on-new-clones=0`, выход 0); переживает переименование файлов и
  сдвиг строк; на действительно новой копии краснеет («1 new clones»). Замеры: игрушечное дерево (13
  строк, два одинаковых файла) и всё дерево пакета (`src bin tools test`, 11 отпечатков — столько же
  клонов датчик называет сегодня). А «все клоны новые» получается, если подсунуть jscpd **наш файл**
  `dup-baseline.json`: он отвечает `missing field version` и выходит с кодом 1 — похоже, прежний замер
  («15 новых клонов» на чистой копии) был именно этим, в нашей базе 15 отпечатков.

  **Что остаётся верным и почему свой файл пока есть.** Наш `dup-baseline.json` — это гейт-файл под
  защитой `gatefiles`, с `schema`, именем конфига и пометкой для человека, и о нём же говорят счётчики
  датчика и его машинный отчёт. У файла jscpd нет ни схемы, ни пометок, и никто его не стережёт (в
  дереве ему и не обязательно лежать: `--baseline` берёт путь).

  **Варианты и цена.** (1) Оставить как есть: свой отпечаток дублирует родной, зато формат файла и
  счётчики наши. Цена — около тридцати строк лишнего кода и два способа говорить об одном и том же.
  (2) Перейти на `--baseline` и `--baseline-from-ref origin/main`: второй взгляд против дерева главной
  ветки у jscpd уже есть, датчик сократится, но база станет чужим форматом (без пометки и схемы), а её
  обновление — `--update-baseline` вместо `pnpm run baseline:dup`, то есть гейт-файл меняет вид и
  храповик переснимается. (3) Гибрид: свой файл для чтения человеком и защиты `gatefiles`, а
  сравнение с главной веткой — через `--baseline-from-ref`. Цена — два механизма в одном гейте.

  **Решать пользователю:** нужен ли свой отпечаток при родном. До решения поведение не тронуто,
  исправлены только комментарии, которые утверждали обратное.

- **N16. Репозиторий без коммитов — внутренняя ошибка с чужим стеком.** Нашлось на проходе M7 подплана
  `markdown` (2026-09-16) при сверке требования README «git-репозиторий с историей».

  **Воспроизведение.** Свежий `git init`, один файл в индексе, ни одного коммита:
  `node bin/size.js --write` → **код 5** и «внутренняя ошибка (это дефект инструмента…)» со стеком от
  `execFileSync` в `readHistory` (`src/git.js`), потому что `git log` в таком репозитории отвечает
  `fatal: your current branch 'main' does not have any commits yet`. С первым коммитом та же команда
  зелёная и пишет `docs/size-report.html` (код 0).

  **Следствие.** Первый запуск до первого коммита — ровно тот случай, который `--init` переживает
  намеренно (`src/project.js` ловит «нет коммитов» и продолжает) — объявлен дефектом инструмента с
  просьбой прислать текст, а готовая починка («сделайте коммит») до читателя не доходит. Код 5 значит
  «внутренняя ошибка», а это состояние проекта, а не поломка движка.

  **Что верно в документации.** Требование README не лжёт: история нужна, и коммит хотя бы один. Это
  пробел кода, а не документа; код в этом проходе не трогался — проход документационный.

  **Варианты и цена.** (1) Свой отказ («история пуста») с готовой командой — дешёвый, но добавляет
  место отказа, а их считает каталог (`test/refusals-catalog.test.js`), значит нужна строка в каталоге
  и, возможно, случай в `test/refusals.test.js`. (2) Считать пустую историю пустым отчётом (ноль
  строк) — отчёт честно скажет, что коммитов нет, но это новое поведение отчёта. (3) Оставить как есть:
  код 5 остаётся, а требование «хотя бы один коммит» живёт в README.

  **Решать пользователю:** какой вариант принять. До решения поведение не тронуто, README называет
  требование и ссылается сюда.

- **N17. Три обещания проекта модуля, которых нет в коде: схема настроек, миграция и блок для агентов.**
  Нашлось на проходе M12 подплана `markdown` (2026-09-16) при сверке §9 и §13 `docs/module-design.md`.

  **Что обещано и что есть.** Три места проекта обещают то, что без правки кода неверно:

  1. «формальная схема настроек» (§9) — схемы в поставке нет: `package.json` объявляет `bin`, `src`,
     `templates`, `README.md`, `CHANGELOG.md`, `LICENSE`, а `templates/` держит три файла
     (`size-report.config.json`, `README.md`, `ci.yml`). Проверка живёт в коде (`validateConfig` в
     `src/config.js`), и ключ `$schema` в файле проекта ни на что не влияет.
  2. «миграция при обновлении формата» (§9) — кода миграции нет: читается один файл
     (`CONFIG_NAME = 'size-table.config.json'`), неверное значение — отказ с готовой починкой, а не
     преобразование старого формата.
  3. «при установке модуль сам вписывает в файл инструкций проекта короткий блок» (§13) — в чужие файлы
     проекта инструмент не пишет вообще: поиск по `AGENTS` в `src/` не находит ничего, `installHook`
     пишет только в `.git/hooks` и отказывается трогать чужой хук, список игнорирования не правится, а в
     поставке лежит заметка для человека (`templates/README.md`).

  **Чем проверено.** Состав поставки — `files` в `package.json`; содержимое `templates/` — перечислением
  каталога; проверка настроек — чтением `validateConfig` и `loadConfig` в `src/config.js`; запись в чужие
  файлы — поиском по `AGENTS` в `src/` и чтением `src/hook.js`; семейства токенов — `src/tokens.js`.

  **Следствие.** Читатель проекта модуля считает все три вещи существующими: редактор подсказок не даёт,
  старый файл настроек не преобразуется, а агент в новой сессии узнаёт об инструменте не из своего файла
  инструкций, а из заметки, которую туда должен положить человек.

  **Варианты и цена.** (1) Схема: положить в поставку схему и сослаться на неё из
  `templates/size-report.config.json` — редактор получает подсказки сразу, но появляется вторая сущность,
  которую надо держать в согласии с `validateConfig`. (2) Миграция: распознавать старый формат в
  `loadConfig` и переписывать по `--init` — одно место чтения, но новый код и новые случаи в проверках.
  (3) Блок для агентов: не писать в чужие файлы (как сейчас), а дать готовый текст в заметке шаблонов —
  дешево, но требует честного слова в документации; либо писать по явному ключу настроек, а не при
  установке — тогда запись в чужой файл становится осознанной.

  **Решать пользователю:** что из трёх строить, а что объявить отменённым. До решения код не тронут
  (проход документационный), а сам документ модуля называет реальность и ссылается сюда.

- **N18. Склейка без пробелов мимо линтера — наблюдение, не блокер.** Два класса
  склейки выглядят похоже, а ловит линтер только один. `no-multi-spaces` (заведён
  в `R-1.2`) берёт случай, когда от склейки остался лишний пробел (`, } else {      const …`).
  Обратный случай — пропавшая между операторами строка, где лишних пробелов нет
  (`}function writeMode(cfg, root) {`): такое нашлось глазами в диффе прохода
  `WORKLOG.md` §36 и было бы видно только в истории. Дешёвый кандидат —
  `padding-line-between-statements` с требованием пустой строки перед объявлением
  функции; он ловит именно этот случай и не рубит принятые однострочники. Пока не
  заведён: сначала надо посмотреть, сколько замечаний он даёт на живом дереве
  (если десятки — это переформатирование, а не правило).


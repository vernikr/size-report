# C2 — `tests-cli`: the checks that drive the tool

Subplan of `plan.md` (T0). Owns fourteen checks, **739 lines measured** — `hook` 113, `check` 84,
`doctor` 83, `cli` 79, `minify` 75, `disk` 68, `tokens` 54, `release` 41, `templates` 33,
`cli-paths` 31, `refusals-catalog` 26, `refusals` 25, `environment` 18, `crlf` 9 — the tracker's row,
confirmed file by file (113+84+83+79+75+68+54+41+33+31+26+25+18+9 = 739). Written 2026-09-16.
**Step 0 re-measured it on 2026-09-16: the fourteen files answer 708, not 739** — the drop is the
joint lines the owners' steps already moved (`hook` 113 → 109, `check` 84 → 78, `doctor` 83 → 82,
`cli` 79 → 74, `minify` 75 → 72, `disk` 68 → 58, `cli-paths` 31 → 30, `refusals-catalog` 26 → 25).
**C2 is closed as of 2026-09-17: the fourteen files answer 87** — `hook` 27, `disk` 16, `doctor` 10,
`minify` 10, `release` 7, `tokens` 5, `refusals` 4, `cli-paths` 3, `check` 2, `cli` 2, `environment` 1,
`crlf`/`refusals-catalog`/`templates` 0 — and every one of them is allow-listed data or D1's contract,
named file by file in the steps below. Nothing of this owner is left to translate.

By the map's order S1–S5, W1 and W2, C1 have landed before this one, so these files are where the
promises of the printed runtime are **read back**: every subplan above named the lines of this owner
that quote its texts. This plan gathers them, adds the readings nobody named, and keeps the rule
found while planning C1: **a negative match over a printed text is a reader too**.

## Scope, by measurement

```
for f in hook check doctor cli minify disk tokens release templates cli-paths refusals-catalog refusals environment crlf; do
  printf '%5s %s\n' "$(rg -cP '[\p{Cyrillic}]' test/$f.test.js)" "test/$f.test.js"
done
```

| File | Lines | Whose printed text it reads |
|---|---|---|
| `test/hook.test.js` | 113 | S5's (install, subject, state `why`, the `✗ size-report: ` prefix) |
| `test/check.test.js` | 84 | S4's (`coverageText`, `explainText`, the disk violations) and S1's causes |
| `test/doctor.test.js` | 83 | S4's (the answer) and S2's/S3's texts it prints |
| `test/cli.test.js` | 79 | S1's (help, grammar refusals) and S2's derived line |
| `test/minify.test.js` | 75 | **both** the `ru` dictionary and S3's `sensorGaps` — the split S3's plan describes |
| `test/disk.test.js` | 68 | S4's two violation refusals |
| `test/tokens.test.js` | 54 | the dictionary and S3's notes, same split |
| `test/release.test.js` | 41 | **D1's** workflow step names, by exact string |
| `test/templates.test.js` | 33 | D1's templates (file names only), by exact string |
| `test/cli-paths.test.js` | 31 | S4's disk text through a path |
| `test/refusals-catalog.test.js` | 26 | W1's maps and the **sources' shape** (`refuseCause('…')`, `'✗ `) |
| `test/refusals.test.js` | 25 | W1's `adviceOf`/`ADVICE_LINE` and the catalogue's `must` phrases |
| `test/environment.test.js` | 18 | the fixture's golden data |
| `test/crlf.test.js` | 9 | the fixture's golden data |

## Read by another owner

**(1) Positive reads of printed texts — the owner of the text moves the line.** Every one of these is
already named in the plan of the subplan that prints it (measured against the plan files): S1 names
`cli.test.js:33,189,193,246,297`; S2 names `cli.test.js:45` and `doctor.test.js:64,132`; S3 names
`minify.test.js:181,182,195,215,217,223,236` and `tokens.test.js:105,106`; S4 names
`check.test.js:52,72,101,103,109,139,191,192,193,218,220,232,242,247,249,254,255`,
`disk.test.js:107,112,133,140,142,193,195,270,272`, `cli-paths.test.js:93,103` and the long list of
`doctor.test.js`; S5 names `hook.test.js:136,151,191,254,295,308,323,339`; W1 and W2 name the
catalogue's readers. Nothing is re-opened here — C2 **verifies** at step 0 that those lines are
English, and the verification is in the acceptance.

**(2) Negative matches over a printed text — four, and three of them are named by no plan.** This is
the rule C1 found, applied to this owner, and the measurement is exact:

| Line | Reads | Owner that must re-point it |
|---|---|---|
| `test/check.test.js:184` (`assert.equal(/починка:/.test(text), false, …)`) | the marker of the **benign** `check` mode's text (`src/check.js`) | **S4 — unnamed in every plan** (S4 named `check.test.js:52,72,…` and not `:184`) |
| `test/check.test.js:235` (`assert.ok(!/нет такого коммита/.test(away.stderr), …)`) | S1's cause name | **S1 — unnamed in every plan** |
| `test/disk.test.js:219` (`assert.equal(/перенос состояния/.test(res.stderr), false, …)`) | S4's sentence | **S4 — unnamed** (S4 named `107,112,133,140,142,193,195,270,272`, not `:219`) |
| `test/cli.test.js:69` (`assert.equal(/настройки выведены из проекта/.test(again.stderr), false, …)`) | S2's `derivedLines` | S2 — **named** in `settings.md:92`, with its reason |

Each of the three unnamed ones goes vacuous the moment its text turns English: the regex matches
nothing whatever the tool says, and the check stays green. The fix belongs to the step that moves the
text, and the correction is written into `surface.md` (S1) and `diagnostics.md` (S4) by this portion —
the same way S3's plan was corrected while planning C1.

**The distinction that makes the rule usable: data does not rot.** A negative match over an
**allow-listed** string stays a real check, because the string does not move:
`test/minify.test.js:124` (`min.method.indexOf('приближение') < 0`), `:195`
(`indexOf('esbuild недоступен') >= 0`) and `test/tokens.test.js:113`
(`view.method.indexOf('недоступен') >= 0`) all read the `ru` dictionary's `method` field, and the
dictionary is data. So the rule is stated in two halves: a negative match over a **translated** text is
a reader that must be re-pointed in the same commit; a negative match over **data** is not touched at
all.

**(3) Exact-string reads of D1's texts — two, and D1 is planned after this one.**
`test/release.test.js:62,66` fetch the workflow's steps by their Russian names —
`step(doc, 'Версия манифеста — в окружение')` and `step(doc, 'Тег называет ту же версию, что
манифест')`. The text is `.github/workflows/release.yml`'s, so **D1's step edits these two lines in
its own commit**, exactly as S5's step edits `test/hook.test.js`'s assertions; the order of the
subplans does not matter to that rule. `test/templates.test.js:82,84` read `templates/README.md` by
**file name** (`note.indexOf(file)`), never by wording — measured, so nothing of D1's prose is frozen
by this check.

**(4) Reads of allow-listed data.** `test/crlf.test.js` and `test/environment.test.js` compare the
tool's `--json` with the fixture's golden text; the fixture labels and the `ru` dictionary's values
are read as expected values throughout (`ui.<key>` appears in C1's files; here the shape is
`goldenText`, `goldenJson`). And `test/hook.test.js:170,173,397,405` match `чужой хук` written by the
test **itself** into its own foreign hook — the test's data, not the tool's text.

**(5) Shape readers — the counters that must not move.** `test/refusals-catalog.test.js` reads the
**sources** (`refuseCause('…')` sites, `'✗ ` marks) and compares them with `SITES`/`PRINTED`;
`test/refusals.test.js` runs the catalogue and extracts advice by the markers; `tools/suites.js`'s
`checksIn` counts the `test(` calls of every file and `test/docs-numbers.test.js` holds that count
against the numbers table of `README.md`. A name or a message is free; a **count** and a **source
literal** are not.

## What stays Russian here

| Item | Why |
|---|---|
| Every expected value read from the `ru` dictionary, the fixture's `golden.json`/`data.json` and the fixture configs | T0's allow-list: a check asserting Russian data asserts the data it exists for. |
| `чужой хук` in `test/hook.test.js`'s own fixtures (170, 173, 397, 405) | The test's own file content, written by the test. |
| The two workflow step names in `test/release.test.js:62,66` | D1's texts: they move with D1's commit, not here. |
| The cause names and `must` phrases quoted anywhere | Their owner's step; by now English, and C2 verifies rather than edits. |

## Steps — one commit each, red first

0. **Re-measure and verify the joint lines — done 2026-09-16.** The counter answers **708** for the
   fourteen files, file by file (above), and the whole drop belongs to the owners' earlier steps. The
   joint lines of section (1) were checked **by line number**, not by hope: **58 named lines, none of
   them carrying Cyrillic**, including the data reads the plan exempts (`minify.test.js:124,195`,
   `tokens.test.js:113`, which read the `ru` dictionary and stay). **All four negatives of section (2)
   are live and English**: `check.test.js:184` → `/fix:/`, `check.test.js:235` →
   `/is not a revision name and not the start of a sha/`, `disk.test.js:219` → `/carrying the state/`,
   `cli.test.js:69` → `/settings derived from the project/` — so no owner missed its own, and nothing
   was written into `TODO.md` or `BLOCKERS.md` for them.
1. **`test/refusals.test.js` (25 → **4**) + `test/refusals-catalog.test.js` (25 → **0**) — done
   2026-09-16.** Twenty-one names and messages in the first (plus two diagnostic labels: `'движок без
   bin'` → `'the engine without bin'`, `'движок пакета'` → `'the package engine'`), twenty-five in the
   second; the four that stay in the first are the scenarios' own fixture content (`echo чужой` written
   into a foreign hook, the note file `заметка.txt`, the commit subject of the side branch, the comment
   appended to the drifted table) — data the test writes and the tool merely trips over. **Red first,
   both halves of step 1's experiment, each on its own:** putting a source's advice marker back to
   Russian (`src/check.js:121`, `'  fix: '` → `'  починка: '`) reddens `test/refusals.test.js` at
   `«the codes of the table / coverage is incomplete»: в отказе нет «fix: add these paths as a column
   or to "skip"»` — the extractor's English `ADVICE_LINE` no longer sees the line, and that is what the
   catalogue's promise rests on; renaming one `must` phrase in `tools/refusals.js` alone reddens the
   same check at `«command line / unknown flag»: в отказе нет «a phrase that is not printed at all»`.
   Both files were restored byte-identical (measured). **The files' own words are read by nobody:** all
   **39** translated phrases went back to Russian one at a time (19 runs of `test/refusals.test.js`,
   20 of the catalogue) and neither file reddened once. No machine reads the two files' text — the
   catalogue's `coveredBy` entries point at `test/hook.test.js`, `test/module.test.js` and
   `test/disk.test.js`, never here (measured). Check counts unchanged (1 and 4); `dup` green over 46
   fresh messages (8 clones, 47 lines, 15 fingerprints); `verify:fast` and the full `verify` green;
   the artifact's digest (`1bdb27e1…`) and the built page (66 427 B) unmoved. These two files are the
   harness of that promise, so their own messages were translated last within their step, after the
   experiment.
2. **`test/crlf.test.js` (9 → **0**) + `test/environment.test.js` (18 → **1**) — done 2026-09-16.**
   Nine names and messages in the first, seventeen in the second. **Red first, one phrase at a time:**
   all nine and all fifteen pairs went back to Russian on their own and the file's probe stayed green —
   no reader of a check's words. The one line that stays is the fixture's own commit subject
   (`'fixture: ветка — правка кода и заметок'`, held by `fixtures/synthetic/golden.json` and
   `manifest.json`), and it is a **pin, not a stale expectation** — proved by experiment: translating it
   reddens `test/environment.test.js`, while the five pieces of the two files' own fixture content (the
   README written into a fresh project, its commit subjects, the comments appended to a file and to the
   table) stay green when translated and stay as data. The counters were the other half of the
   experiment: one test name renamed in `test/cli.test.js` left both `checksIn` (**9**) and the probe
   green, so the count is of `test(` calls rather than of names.
3. **`test/cli-paths.test.js` (30 → **3**) + `test/cli.test.js` (74 → **2**) — done 2026-09-16.**
   Twenty-seven names and messages in the first, seventy-two in the second (**125 lines of the four files
   of steps 2–3 turned English, not 116 as the first version of this entry said** — the counter settles it:
   the owner went from 662 to **537**; the arithmetic was corrected while doing steps 4–5). **Red first by the whole
   file, which is the method W1 used for its two files** (per-phrase sweeps over 97 phrases would cost
   half an hour for evidence of the same class): each of these two files put back to its `HEAD` version
   wholesale left its own probe **green**, so no machine reads a word of either. The five lines that stay
   are the scenarios' own content, named by measurement: the README and the code comments written into
   the scenario, the commit subjects of the repositories the scenario builds. **What this step guarded
   is the machine half:** `test/cli-paths.test.js:104` is a marker with an end-of-line anchor
   (`/^\s*fix: .*git init$/m`), and it is a live reader of the English marker — measured by putting that
   marker back to Russian in `src/config.js:69` (restored byte-identical), which reddens check 6
   (`outside a git repository the refusal explains itself…`) while everything else stays green. The one
   negative match over printed text in this owner's four files is `test/cli.test.js:69`, and it is not
   vacuous: the same phrase is asserted **positively** at `:45` (`/settings derived from the project/`),
   so its pattern answers against the text the tool really prints. `test/cli.test.js:45` itself is
   English and was measured so at step 0. A finding of the `dup` sensor belongs here: the translation
   **dissolved** one accepted clone — `cli-paths.test.js:28-33` ↔ `doctor.test.js:176`, five lines of
   the shallow-clone setup whose two Russian messages matched `doctor.test.js` verbatim (clones 8 → 7,
   lines 47 → 42). Both sides of that pair are this owner's or this owner's neighbour, so step 6
   (`doctor`) is where the pair can form again with different wording — the answer then is a varied
   wording, never the baseline.
4. **`test/templates.test.js` (33 → **0**) + `test/release.test.js` (41 → **7**) — done 2026-09-16.**
   Thirty-three names and messages in the first, thirty-four in the second. **Red first by the whole file**
   (both files put back to their `HEAD` version wholesale left their own probes green). The seven lines
   that stay are **D1's contract**: they fetch workflow steps by their exact Russian names, and the
   measurement corrected the plan's own figure — the plan (and `configs.md`) named **six** such reads
   (`:62,66,101,114,127,132`) while the file has **seven** (the missing one is `:86`,
   `step(doc, 'npm поновее (для trusted publishing)')`); a measurement of all eight step names in
   `.github/workflows/release.yml` against the file's seven readers is what showed it. That the reads are a
   live contract was measured rather than assumed: renaming one step in the workflow (`- name: …` →
   `- name: RENAMED STEP`, restored byte-identical) reddens `test/release.test.js` at check 2. `templates`
   reads no wording of D1's at all — it fetches the template **files** by name (`note.indexOf(file)`).
5. **`test/minify.test.js` (72 → **10**) + `test/tokens.test.js` (54 → **5**) — done 2026-09-16.**
   Sixty-one names and messages in the first, forty-eight in the second; the lines that stay are the
   payloads the two files write into their scenarios (a JS sample, its CSS twin, a broken record, the
   fixture's labels) and the **dictionary reads**: `minify.test.js:124` (`pureMin.method.indexOf('приближение') < 0`),
   `:195` (`min.method.indexOf('esbuild недоступен') >= 0`) and `tokens.test.js:111` (`new RegExp('1 токен ≈ '
   + CHARS_PER_TOKEN + ' знака')`), `:113` (`view.method.indexOf('недоступен') >= 0`). **Red first by the
   whole file** (both back to `HEAD` wholesale → both probes green), and **the dictionary reads were proved
   live the other way round**: translating the `ru` side of those very phrases in `src/metrics.js:40,55`
   (restored byte-identical) reddens `minify` at check 5 and `tokens` at check 3 — so they assert the `ru`
   data, which is why they must not be translated. `tools/refusals.js`'s twin check has one of the same
   shape to thank for the rule.
   **What this step cost beyond the words (N33, decided by the user the same day).** Translating the two
   files turned an accepted clone pair into a *new* one for `dup` — `minify.test.js:252 ↔ tokens.test.js:158`
   and `:260 ↔ :165` — because a fingerprint is a shape and the words had changed inside it
   (`✗ dup: new clones 4`; with the two files as at `HEAD` the same pairs are accepted: `clones 7, lines 42`,
   measured). No word was varied to hide it and no baseline was re-taken: the shared part was **taken out**
   instead — the hand-rolled fresh-project setup of both files, four lines of which were already what
   `initRepo` does, became one helper (`draftedRepo`, `tools/harness.js`) — so the twin left by removing the
   duplication (commit `897a780`: `clones 7, lines 42` → `clones 5, lines 29`, both files green). The same
   commit moved the one literal that belonged to both — the scenario's commit subject — into the helper.
6. **`test/doctor.test.js` (82 → **10**) — done 2026-09-17.** Seventy-two names and messages. The ten
   that stay are the scenarios' own fixture content alone: the code comments and commit subjects the
   checks write (`'// начало\n'`, `'начало'`, `'правка'`, `'# проект\n'`, `'// один\nvar a = 1;\n'`,
   `'// два\nvar b = 2;\n'`, `'// не в git\n'`, `'@@@ это не JavaScript\n'`, `'не JavaScript'`) —
   written by the check and only tripped over by the tool. **Red first by the whole file** (the method
   steps 2–5 used for a large file): it put back to its `HEAD` version left its own probe green, and the
   experiment was re-run **after** this step's extraction (N34) so the evidence covers the file as it
   stands. **S4's reads are English and stay so:** every expectation in the file is ASCII — measured by
   extracting the file's regex literals (zero carry Cyrillic) — because the owner moved the texts and
   step 0 verified its named lines by number. **A finding beyond the step's own words (N34):**
   translating for `doctor` re-formed the clone pair step 3 had dissolved — `cli-paths.test.js:28` ↔
   `doctor.test.js:176`, the same six lines of shallow-clone setup with the same two messages — and the
   answer taken was the one **N33** took: the shared part was **taken out** (`shallowClone`,
   `tools/harness.js`) rather than the wording varied or the baseline edited. Measured: `clones 5,
   lines 29` with the shared code and again with the helper (the numbers the tree had before the port),
   both files green.
7. **`test/check.test.js` (78 → **2**) + `test/disk.test.js` (58 → **16**) — done 2026-09-17.**
   Seventy-six names and messages in the first, forty-two in the second. The leftovers are the
   scenarios' own content: in `check`, the two empty commits' subjects (`'пустой коммит'`,
   `'ветка мимо отчёта'`); in `disk`, the code comment the check edits and the commit subjects it makes
   (`'// правка, которой нет в git\n'`, `'начало'`, `'файл в ветке'`, …). No regex literal with
   Cyrillic is left in either file (measured), which is what the acceptance asks. **Red first by the
   whole file** (both back to `HEAD` wholesale → both probes green). **The negatives of section (2)
   were re-measured as guards rather than tautologies, each by mutation, sources restored
   byte-identical:**
   - `disk.test.js:219` (`/carrying the state/` false) — on the clean tree the scenario answers code 0,
     a two-line stderr and the phrase **absent**; with the comparison made to treat an empty state as
     lost (`src/history.js`: `const lost = s === null ? true : …`) the same scenario answers code 1 and
     the phrase **is** in stderr. Plainly: the regression reddens the check at `:218` first — the
     refusal precedes the negative — and the negative is what names the difference between a file
     deleted before HEAD and a lost state.
   - `check.test.js:235` (no `is not a revision name and not the start of a sha`) — with that sentence
     merged into the sibling refusal (`src/explain.js`, the outside-history cause) the check reddens at
     `:235` with its own message, `a commit that exists is called non-existent`.
   - `check.test.js:184` (`/fix:/` false) — with the renderer made to print a repair command that names
     nothing (`src/explain.js`, the line rendering `rep.fix`), the check reddens at `:184` with its own
     message, `the text carries a repair command without names`.
   Both `check` negatives also have a positive twin in the same file on a green run (`fix: ` at
   `:52,103,159`; the revision-name sentence at `:218,247`), so their patterns answer against text the
   tool really prints.
8. **`test/hook.test.js` (109 → **27**) — done 2026-09-17, and C2 is closed with it.** Eighty-two names
   and messages, plus the messages of the five lines that carry a scenario subject as well. The
   twenty-seven that stay are the scenario's own content, and they are **three kinds, named here**: the
   sample project's files (`'# проект\n'`, `'// начало\nvar width = 1;\n'`, `'// ещё файл\n'`), its two
   commits (`'feat: начало'`, `'chore: отчёт'`), and the working copies' commits and edits the checks
   make to prove the hook touches nothing of someone else's (`'feat: правка кода'`, `'feat: правка
   сбоку'`, `'feat: правка в основной'`, `'feat: ещё правка'`, `'chore: пусто'`,
   `'// отложенная правка\n'`, `'грязная правка\n'`, `'// ещё правка\n'`), the foreign hooks' bodies
   with the regex that reads one of them (`'#!/bin/sh\necho чужой хук\n'`, `/чужой хук/`) — the reads
   that assert them are the checks' own data. **Red first by the whole file:** `test/hook.test.js` put
   back to its `HEAD` version ran 11 of 11 checks **green** — the largest file of the owner and still
   no machine reads a word of it (restored byte-identical). **The reads of S5's printed text were
   verified one by one rather than assumed:** the installation's `/already installed/` (`:151`) and
   `/hooks.*enabled/` (`:152`), the cause line `/^✗ size-report: /` (`:339`), the state's `why` —
   `/CI/` (`:295`), `/detached HEAD/` (`:323`) and the hook's own subject read back as an exact string
   (`'chore(report): report rebuilt after ' + parent.slice(0, 7)`, `:191`) — and the refusal's `/hook-run/`
   (`:404`) and `/core\.hooksPath/` (`:412`); all are ASCII, and the tool's mark asserted at `:136` is
   `'size-report'`, ASCII as well, so nothing here moved with the words. The file's only regex literal
   with Cyrillic is `/чужой хук/` (`:173`), the reader of its own fixture (measured). `dup` asked before
   and after: `clones 5, lines 29` both times — the block this file clones a shallow history with is
   *not* the harness's pair (its shape carries the identity `git config` lines), so no new clone formed
   and the helper was not needed here. Checks unchanged (11; 70 fast, 175 full), the artifact's content
   digest `1bdb27e1…` and the reference file's own sha256 `cdda8d01…` unmoved, the built page 66 427 B,
   the package from the tarball byte-identical; `pnpm run verify` (8 steps) green before the push.

**Why the tree is green between the commits.** The printed texts moved in earlier steps, and every
line that reads one of them is either already English or waits for its owner; the data reads stay
Russian by design; the counters are untouched. The sensor that can react to this owner is
`pnpm run dup` — 739 lines of parallel messages are the widest field for a twin in the whole work, and
the answer to a twin is a varied wording, never the baseline. Each step runs `pnpm run verify:fast`;
`verify` runs before the portion is pushed, and it is also where the tool-driving checks meet the full
profile.

## Acceptance

- `pnpm test` green, and the number of checks per file unchanged (`checksIn` before and after, plus
  `test/docs-numbers.test.js` holding the table of `README.md`).
- The counter for the fourteen files answers **only** the allow-listed data and the five joint lines
  named above.
- The four negatives of section (2) still guard: each reddens when the sentence it names is put back,
  and the three that no plan had named are written into `surface.md` (S1) and `diagnostics.md` (S4) so
  their steps carry them.
- `test/refusals-catalog.test.js`'s counts and `SITES`/`PRINTED` are unchanged, which is the free
  proof that no source literal was touched.
- `pnpm run verify:fast` after every commit, `pnpm run verify` before the portion is pushed;
  `pnpm run dup` and `pnpm run metrics` green (a message is not a check's weight).
- Every line of section (3) moved with D1's commit, or the acceptance says in words why it did not.

**Release:** checks do not ship (`files` names `bin`, `src`, `templates`, `README.md`, `LICENSE` —
measured while planning W1), so nothing here is released; each commit says so in words.

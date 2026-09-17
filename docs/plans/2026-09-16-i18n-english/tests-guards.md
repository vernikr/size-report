# C3 — `tests-guards`: the checks of the repository itself

Subplan of `plan.md` (T0). Owns fourteen checks, **226 lines measured** — `gates-verify` 26,
`gates-files` 26, `docs-commands` 23, `gates-metrics` 22, `suites` 16, `parity` 16, `frozen` 16,
`gates-coverage` 16, `docs-pin` 14, `gates-dup` 13, `git-pins` 12, `docs-numbers` 12, `gates-deps` 8,
`docs-paths` 6 — the tracker's row, confirmed file by file (26+26+23+22+16+16+16+16+14+13+12+12+8+6 =
226). Written 2026-09-16. Last of the checks, and the last portion that touches a file a
sensor is configured by. **Step 0 re-measured it on 2026-09-17: the fourteen files answer 222**, not
226 — `docs-commands` 22, `parity` 15, `gates-coverage` 14 — **after step 1 the owner read 209**
(`docs-paths` 0, `git-pins` 5), and **after the portion of steps 7–8 named below it reads 177**
(`docs-commands` 5, `parity` 0). **The order of the portion of 2026-09-17 was set by the mission and
differs from the numbering here**: the two files the mission named, `docs-commands` and `parity`, are
steps 7 and 8 of this list, so those two steps were taken first and their siblings (`docs-pin`,
`frozen`) and steps 2–6 (the six gate files) follow.

**Six of these files are gate files** (`test/gates-[a-z-]+\.test\.js` matches the gate list in
`tools/gates/gatefiles.js`): `gates-verify`, `gates-files`, `gates-metrics`, `gates-coverage`,
`gates-dup`, `gates-deps` — 111 of the 226 lines. Every commit that touches one of them carries the
`Gate-Change:` trailer. The other eight are ordinary files.

## What these checks are, and why the language matters twice here

They are the checks of the repository rather than of the tool: the profile and CI, the gate files, the
documentation, the references, the git boundary. Two of their properties shape this plan:

- they read **other people's texts as input** — the sensors' verdicts, the help's section markers, the
  tables of `README.md`, the `.gitignore`, the sources' shape — so every one of them is a reader line
  that belongs to the subplan that moves the text;
- they are the checks that tell **"the standard moved" from "the engine broke"** and "the document
  lies" from "the document aged", which is exactly the kind of message an agent reads as the whole
  report of a failure. That is why they are translated at all: an English assertion message is the only
  description of a failure a machine gets (T0's second reason).

## Read by another owner

**(1) The eight assertion lines that read W2's verdicts** — W2's plan names them and moves them in its
own commits: `test/gates-files.test.js:77,106,115`, `test/gates-dup.test.js:72,88`,
`test/gates-coverage.test.js:49,63`, `test/gates-deps.test.js:48`, `test/gates-metrics.test.js:144`.
C3 **verifies** them at step 0 (W2 precedes it in the order) and translates only the files' own names
and messages.

**(2) Reads of S1's texts, and one that is a contract rather than a quotation.**

| Line | Reads | Owner |
|---|---|---|
| `test/docs-commands.test.js:36` (`usageCauses()` splitting on `'Причины отказа кодом 2'`) | S1's help block | S1 — named in `surface.md:83` |
| `test/docs-commands.test.js` `readmeCauses()` — parses the `\| 2 \|` row of `README.md` and compares it with `CONFIG_CAUSES` | **S1's registry through the documentation** | S1 — named in `surface.md:84` |
| `test/docs-commands.test.js:147` (`/причина отказа не объявлена/`) | S1's internal error of `refuseCause` | S1 |
| `test/parity.test.js:57` (`/: (\d+) строк × (\d+) файлов/`) | the summary shape the tool prints | S1 — named in `surface.md` |
| `test/docs-pin.test.js`'s `commandsAt(commit)` | the **pinned revision's** help, read from history | S1 + W1's `commandsAt` (the tolerance) |
| `test/gates-verify.test.js:155` (`/^reports\/$/m`) | `.gitignore` | D1 |
| `test/gates-verify.test.js:142-144` | the hooks' call lines | W2 |
| `test/suites.test.js` | `tools/suites.js` and the `test(` counts | W2 + the counters |

**Measured consequence worth writing down: `README.md:768` is not a quotation.** The tracker's
allow-list counts `README.md`'s four Russian lines as "quotations of printed Russian"; measured while
planning C3, one of them — the code-2 row with the cause names — is **parsed by `readmeCauses()` and
compared with `CONFIG_CAUSES`**. So S1's rename edits that row in its own commit (otherwise the guard
reddens), and the "allowed quotations" cell of the tracker's measurement shrinks as S1's, S4's and
S5's steps land (S4 moves `README.md:706`'s quotation of the `!` note, S5 moves `:792-793`'s subject).
The cell reads 18 today and must be re-measured once those steps are done — recorded in the tracker so
that nobody reads a stale number as a promise.

**(3) A tolerance that is dead in the tree, and what to do with it — decided here.** `namedSection()`
in `test/docs-commands.test.js` resolves a reference that names no document by the word of its
sentence, in two languages: `/(?:требовани|requirements?)/` at `:181`, `:184` and `:186`. The file's
own comment explains why (documents were translated one by one, and a reference the check stopped
resolving would pass **in silence**). Measured today: the Russian alternative matches nothing in the
tree — no document cites a section with the Russian word, `docs/requirements.md` and
`docs/module-design.md` carry no Cyrillic at all, and the only Russian instances are in the prose of
`docs/plans/2026-09-15-docs-rework/markdown.md`, which is allow-listed. Decision: **keep it** — and
name it as this owner's exception in the tracker's allow-list (`G1` is withdrawn, `BLOCKERS.md` N27). The price of the other option is stated rather
than hidden: dropping the alternative is a coverage change, not a literal one, because the check would
again pass a Russian citation in silence, which is the defect the branch exists for; and it is a
change to a matcher whose behaviour on today's tree is identical, so it buys nothing but a smaller
allow-list.

**(4) The rule from C1 and C2, both halves, measured here: there is no negative match in this owner.**
The grep for a Cyrillic regex together with `false`/`doesNotMatch` over the fourteen files answers
nothing. So the first half of the rule (a negative match over a translated text moves with the text)
has no case here, and the second half (a negative match over allow-listed data is not touched) is
illustrated by the neighbouring owner only. The plan states it so that a reader does not have to
re-measure to learn there is nothing to look for.

**(5) Source-shape readers — no literal of a source may be touched by this owner.**
`test/docs-commands.test.js`'s `emittedCauses()` reads every `refuseCause('…')` in `src/**`, and its
`bare` check runs `grep -l -F 'refuse(EXIT.CONFIG' src`; `test/refusals-catalog.test.js` (C2) counts
the same sites and the `'✗ ` marks; `test/git-pins.test.js` reads the pinned settings of `src/git.js`
and `tools/gates/common.js`; `test/docs-numbers.test.js` counts the `test(` calls per file and holds
them against the table of `README.md`. None of these may change a count or a source literal; a name or
a message is free.

## What stays Russian here

| Item | Why |
|---|---|
| The `требовани` alternatives in `namedSection()` (three regexes) | Decided above: a matcher's coverage, dead but documented, named as this owner's exception in the tracker's allow-list. |
| The fixture data every reference check reads (`golden.json`, `manifest.json`, the hashes) | Allow-listed data; C3 touches no reference. |
| The pinned revision's help text | It is read **out of git history** (`git show <pin>:src/refusal.js`): a record of the past, and the exactly correct place for it. |
| The cause names and `must` phrases quoted in any file of this owner | Their owner's step; C3 verifies rather than edits. |

## Steps — one commit each, red first, and a trailer on the six gate-file commits

0. **Re-measure and verify the moved lines — done 2026-09-17.** The counter answers **222**, not 226:
   `docs-commands` 23 → 22, `parity` 16 → 15, `gates-coverage` 16 → 14, everything else as planned;
   the fourteen files' check counts are 5/3/4/4/3/3/4/3/1/4/2/1/4/2. **All nine reads of W2's verdicts
   are English** (`gates-files` 77/106/115, `gates-dup` 72/88, `gates-coverage` 49/63, `gates-deps` 48,
   `gates-metrics` 144 — the exact patterns are in the tracker's row), and so are S1's readers: the
   help block is parsed by the English marker (`usageCauses()` splits on `'Causes of a code-2 refusal'`
   at `:35`), the internal error by `/refusal cause is not declared/` (`:147`), the summary shape by
   `/: (\d+) rows × (\d+) files/` (`parity.test.js:57`). `gates-verify`'s reads are the protocol's and
   D1's (`/pnpm run verify:fast/`, `/tools\/gates\/gatefiles\.js/`, `.gitignore`'s `/^reports\/$/m`) and
   are untouched. Nothing was missed, so `TODO.md` gets nothing. **The allow-list's quotation row was
   re-measured as the plan demanded: 33 lines, all `BLOCKERS.md`; `README.md` and `AGENTS.md` read 0**
   (the code-2 row is the contract S1 moved, the `!` note S4's, the hook subject S5's). The tolerance
   is still **dead in the tree**: `docs/requirements.md` and `docs/module-design.md` carry no Cyrillic;
   the only Russian instances of the three regexes are the file's own comment (`:155`). No negative
   match over Cyrillic in this owner, re-measured.
1. **`test/docs-paths.test.js` (6 → **0**) + `test/git-pins.test.js` (12 → **5**) — done 2026-09-17.**
   Both red-first experiments were run and are more interesting than the plan expected. (a) `docs-paths`:
   a row removed from the file table of `README.md` reddens it at check 2 with the sentence the plan
   names (`the tree holds files that are missing from the table of README`), the table restored
   byte-identical. (b) `git-pins`: the pin taken out of `GIT_PINS` (`'core.quotePath=false'`, restored
   byte-identical) reddens check 2 **only where the machine's settings do not stand in the way** — on
   this machine the ordinary run stays green because its global config already carries
   `core.quotePath=false`, and the same run with `GIT_CONFIG_GLOBAL=/dev/null` and an empty `HOME` goes
   red with `the shared reading quoted a non-English path`. That is B1's own note met from this side,
   and it is recorded rather than smoothed over. (c) The Cyrillic file name was proved **load-bearing**
   the other way round: made ASCII, the check reddens *even with the pin in place*, with its own
   verdict `the unpinned reading handed the path back as it is: the pin then proves nothing` — so the
   five lines that stay are not decoration but the witness's data (`'заметки.md'` written and read by
   the check, the identity `'Тест'`, the commit subject `'заметки'`). Both files put back to `HEAD`
   ran green (2 of 2 each), so no machine reads a word of their own; `dup` asked before and after
   (`clones 5, lines 29` both times — no new clone); checks unchanged (2 each; 70 fast, 175 full); the
   artifact's content digest `1bdb27e1…` and the reference file's own sha256 `cdda8d01…` unmoved;
   neither file is a gate file, so the commit carries no trailer (checked by the hook).
2. **`test/gates-deps.test.js` (8) + `test/gates-dup.test.js` (13) — trailer.** Red first: translate
   `'dup: новых клонов N'` alone in the sensor → `:72` reddens; and `'deps: находок нет'` alone →
   `:48`. W2's steps do both; here they are re-measured against the now English verdicts.
3. **`test/gates-coverage.test.js` (16) + `test/gates-metrics.test.js` (22) — trailer.** Red first:
   the same shape, with the coverage line `'было … стало …'` and `'новых нарушений 1'`.
4. **`test/gates-files.test.js` (26) — trailer.** Red first: the guard's own experiment, which this
   file runs in a temporary repository — a gate change without a trailer.
5. **`test/gates-verify.test.js` (26) — trailer.** Red first: rewrite the hooks' call line
   (`pnpm run verify:fast` → anything else) → `:142` reddens; the words around the call are free, and
   the check reads D1's workflows and W2's hooks as **identifiers**.
6. **`test/suites.test.js` (16) + `test/docs-numbers.test.js` (12)** — the counters. Red first: drop a
   `why` from an entry of `tools/suites.js` → `suites.test.js` reddens; add a check to a file without
   updating the table of `README.md` → `docs-numbers` reddens. Both prove that what is read is a
   **count**, not a word.
7. **`test/docs-commands.test.js` (22 → **5**) — done 2026-09-17; `test/docs-pin.test.js` (14) still
   to do.** Seventeen names and messages turned English. **The three experiments were run before the
   words moved, each on its own, every source restored byte-identical:** renaming the help's section
   marker in `src/refusal.js:136` alone reddens the file at check 3
   (`the refusal causes agree between the engine, the help and the code table of README`); renaming
   one cause in `CONFIG_CAUSES` alone (`'unknown flag'` → `'unrecognised flag'`) reddens the same check
   — the measured proof that the `README.md` row is a contract read through `readmeCauses()`; and
   `docs-pin`'s half was measured with the same mutation by running that file: it **stays green** while
   the working tree's help changes, because its help comes from history (`commandsAt`). **What stays:
   five lines, named one by one** — the invented cause and its text that the check feeds to
   `refuseCause` (`:146`, an input, not a message: the assertion around it reads only the English
   sentence `/refusal cause is not declared/`, so the name is free and stays as data), the comment
   quoting the Russian word the tolerance exists for (`:155`), and the three tolerance regexes
   (`:181`, `:184`, `:186`) — this owner's named exception, still dead in the tree. The file put back
   to `HEAD` ran green (4 of 4), so no machine reads a word of its own; `dup` unchanged
   (`clones 5, lines 29`).
8. **`test/parity.test.js` (15 → **0**) — done 2026-09-17; `test/frozen.test.js` (16) still to do.**
   Fifteen names and messages turned English, and **both experiments were run and measured rather than
   quoted:** N24's example — one value of `SKIP_WORDS` made English in `src/history.js` (restored
   byte-identical) reddens `parity` at checks 1 and 3 (`--json` and the locale run) while
   `test/frozen.test.js`, running the frozen copy against the same golden, stays **green (4 of 4)** —
   which is what makes this file the one that tells a moved standard from a broken engine; and S1's
   summary shape — `' rows × '` in `src/modes.js:89` changed to `' rows x '` reddens `parity` at
   check 2, so the read of `/: (\d+) rows × (\d+) files/` is a live guard. The file put back to `HEAD`
   ran green (3 of 3); `dup` unchanged (`clones 5, lines 29`); checks unchanged (3; 70 fast, 175 full);
   the artifact's content digest `1bdb27e1…` and the reference file's own sha256 `cdda8d01…` unmoved.

**Why the tree is green between the commits.** Every reader line of this owner moved in the step of the
subplan that owns the text it reads (W2's eight verdicts, S1's markers and the README row, D1's
workflows), and what is left is the files' own names and messages, which nothing reads but a person
meeting a failure — measured: the only machine reader of these files is `docs-numbers`' count of their
`test(` calls. The counters (`SITES`, `PRINTED`, the per-file check counts, the pinned settings) are
untouchable here, and the acceptance checks them. The six gate-file commits carry the trailer, and the
push is the `pre-push` hook's own range read.

## Acceptance

- `pnpm test` green, and the per-file check counts unchanged (`test/docs-numbers.test.js` holds the
  table of `README.md` against them, so a moved count reddens there).
- The eight W2 verdict reads and the reader lines of section (2) are English, and the guards still
  guard: each reddens when the text it names is put back (the experiments of steps 2–8).
- `README.md`'s code table carries the English cause names, and the tracker's "allowed quotations"
  cell is re-measured — the row is a contract, not a quotation.
- `test/refusals-catalog.test.js`'s counts, `SITES`, `PRINTED`, the pinned settings and the numbers
  table are unchanged — the free proof that no source literal and no count was touched.
- Every commit that touches a `test/gates-*.test.js` carries `Gate-Change: <reason — what changed, by
  which measurement>`, and `node tools/gates/gatefiles.js --range origin/main` — the call the
  `pre-push` hook makes — is green over the range.
- `pnpm run verify:fast` after every commit, `pnpm run verify` before the portion is pushed; the full
  profile is where `check:standards`, `parity:live` and `pack:check` run, and it is the run that proves
  no reference moved.

**Release:** checks do not ship (`files` names `bin`, `src`, `templates`, `README.md`, `LICENSE` —
measured while planning W1), so nothing here is released; each commit says so in words.

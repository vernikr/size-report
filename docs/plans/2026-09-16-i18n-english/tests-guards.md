# C3 — `tests-guards`: the checks of the repository itself

Subplan of `plan.md` (T0). Owns fourteen checks, **226 lines measured** — `gates-verify` 26,
`gates-files` 26, `docs-commands` 23, `gates-metrics` 22, `suites` 16, `parity` 16, `frozen` 16,
`gates-coverage` 16, `docs-pin` 14, `gates-dup` 13, `git-pins` 12, `docs-numbers` 12, `gates-deps` 8,
`docs-paths` 6 — the tracker's row, confirmed file by file (26+26+23+22+16+16+16+16+14+13+12+12+8+6 =
226). Written 2026-09-16, not started. Last of the checks, and the last portion that touches a file a
sensor is configured by.

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
name it as this owner's exception for the guard `G1`. The price of the other option is stated rather
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
| The `требовани` alternatives in `namedSection()` (three regexes) | Decided above: a matcher's coverage, dead but documented, named as this owner's exception for `G1`. |
| The fixture data every reference check reads (`golden.json`, `manifest.json`, the hashes) | Allow-listed data; C3 touches no reference. |
| The pinned revision's help text | It is read **out of git history** (`git show <pin>:src/refusal.js`): a record of the past, and the exactly correct place for it. |
| The cause names and `must` phrases quoted in any file of this owner | Their owner's step; C3 verifies rather than edits. |

## Steps — one commit each, red first, and a trailer on the six gate-file commits

0. **Re-measure and verify the moved lines.** S1–S5, W1, W2, C1 and C2 have landed, so the eight W2
   verdict reads, S1's markers and the `README.md` row are English; this step measures them and writes
   the counter's baseline for the fourteen files and the per-file check counts into the journal. If a
   reader line was missed, the fix belongs to the owner of the text, and the gap goes to `TODO.md`
   rather than being patched here.
1. **`test/docs-paths.test.js` (6) + `test/git-pins.test.js` (12)** — the smallest, and both are
   shape readers. Red first: unpin one setting in `src/git.js` (`git-pins` reddens) and remove one
   file from the table of `README.md` (`docs-paths` reddens); then put both back and translate the
   messages.
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
7. **`test/docs-commands.test.js` (23) + `test/docs-pin.test.js` (14)** — the documentation guards.
   Red first: rename the help's section marker alone → `docs-commands` reddens (S1's experiment, met
   from this side); rename a cause in the registry alone → the `README.md` row comparison reddens,
   which is the measured proof that the table is a contract; and the pin's help is read from history,
   so `docs-pin` stays green while the working tree changes — the experiment is that it does.
8. **`test/parity.test.js` (16) + `test/frozen.test.js` (16)** — the two checks that tell a moved
   standard from a broken engine. Red first: N24's example, already measured by S4's plan — an English
   `SKIP_WORDS` in a scratch copy reddens `parity.test.js` while `frozen.test.js` (running the frozen
   copy against the same golden) stays green; the experiment is quoted here so that the last owner who
   touches these files has it. Then translate their own names and messages, leaving the N24 line alone.

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

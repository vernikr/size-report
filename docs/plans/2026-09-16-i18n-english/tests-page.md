# C1 — `tests-page`: the checks of the page and the contract

Subplan of `plan.md` (T0). Owns nine checks, 355 lines measured at planning time — `page-view` 72,
`page-choice` 67, `module` 66, `page-tree` 55, `contract-data` 51, `contract-derived` 18, `guard` 11,
`runner` 11, `api` 4. Written 2026-09-16, **step 0 and step 1 landed the same day**, and the re-measurement
moved the baseline: the nine files answer **347**, not 355, because `test/module.test.js` reads **58**, not
66 — the eight lines of section (2) went with their owners' steps (S1–S5, W1, W2), and sections (2) and (3)
are English already: `/esbuild did not parse src\/view\.js/`, `/is not JavaScript/`,
`remove this extension from minify.guard`, `give this extension a simplification in minify.ext`, the `--init`
hint's regex `/pin them with a file of their own[^:]*: (.+)$/m`, the mutation read `/the stripper broke/`,
and both negative matches now name `/stripper/` rather than a Russian word. The check counts are unchanged:
44 over the nine files.

**This is the first owner whose lines are read by two other subplans at once**, and it is the most
dangerous kind of reading in the whole work: one of them stops checking without ever going red. The
section "Read by another owner" states it line by line, as the mission asked.

## Scope, by measurement

```
for f in page-view page-choice module page-tree contract-data contract-derived guard runner api; do
  printf '%5s %s\n' "$(rg -cP '[\p{Cyrillic}]' test/$f.test.js)" "test/$f.test.js"
done
```

| File | Lines | What the Russian is |
|---|---|---|
| `test/page-view.test.js` | 72 → **1** | test names and assertion messages; the page's captions are read from the `ru` dictionary as **data** — done 2026-09-16 (step 6): seventy-one names and messages are English, while `f.label === 'заметки.md'` (the fixture's own label) stays |
| `test/page-choice.test.js` | 67 → **1** | the same, done 2026-09-16 (step 5): sixty-six names and messages are English; what stays is `'{ это не JSON'`, the payload of the broken record the page is fed |
| `test/module.test.js` | 66 → **58** measured | the same, plus **five reads of other owners' texts** (below); the eight that left are those reads |
| `test/page-tree.test.js` | 55 → **1** | the same, done 2026-09-16 (step 4): fifty-four names and messages are English; what stays is the dictionary read at `:128` (`/не измеряется: /`, `appUi.notMeasuredRule`'s value in the `ru` dictionary) |
| `test/contract-data.test.js` | 51 → **1** | the same, done 2026-09-16 (step 3): fifty names and messages are English, the N24 message at `:47` included — what stays is `f.label === 'заметки.md'`, the fixture's own file label |
| `test/contract-derived.test.js` | 18 → **1** | the same, done 2026-09-16 (step 2): seventeen names and messages are English; the one that stays is `['fixture: удаление файла']` — the fixture's frozen commit subject, pinned in `fixtures/synthetic/golden.json:468` |
| `test/guard.test.js` | 11 → **1** | the same, done 2026-09-16 (step 1): the ten names and messages are English, and the sample `'export const a = `текст;\n'` stays — it is the fixture's own text |
| `test/runner.test.js` | 11 → **5** | the same, done 2026-09-16 (step 1): six names and messages are English; the five that stay are the fixture's payload — the multi-byte letter and the two sentinels the child prints |
| `test/api.test.js` | 4 → **0** | the same, done 2026-09-16 (step 2); the frozen list of exported names is data and untouched |

## Read by another owner — three kinds, named line by line

**(1) Reads of allow-listed data — these lines stay Russian because the data does.**
`test/page-tree.test.js:128` asserts the panel's plain box with the regex `/не измеряется: /`, which
is `appUi.notMeasuredRule`'s value — the `ru` dictionary, allow-listed by T0. The same shape, without
a regex, in `test/page-choice.test.js:191,199,215,223,257` and `test/page-view.test.js:223,300,308`:
the expected side is `ui.<key>` or a metric's `method`, the message beside it is C1's. The rule: a
value compared **with** the dictionary is never translated; a sentence written by the check is.

**(2) Reads of other owners' printed texts — joint lines, moved in *their* step, never here.**

| Line in C1's file | Reads | Moves with |
|---|---|---|
| `test/module.test.js:197` (`/esbuild не разобрал src\/view\.js/`) | the minifier's refusal (`src/minify.js:54`) | S3's step 3 |
| `test/module.test.js:200` (`'задайте этому расширению упрощение в minify.ext'`) | the same refusal's advice | S3's step 3 |
| `test/module.test.js:218` (`/не JavaScript/`) | the guard's cause name (`src/strip/guard.js:38`) | S1's step 3 (the cause registry) |
| `test/module.test.js:224` (`'уберите это расширение из minify.guard'`) | the guard's advice | S2's step for `outsideFix`-family advice |
| `test/module.test.js:258`, `:284` (`/закрепить их файлом[^:]*: (.+)$/m`) | the `--init` hint (`src/init.js`) | S2's step that translates the hint |
| `test/contract-data.test.js:47` (`data.skipped` against `golden.json`) | the frozen skip words | **N24, undecided**: bytes of a reference, not a wording |

Why this way: the printed text is the contract and the check's copy is not, so the reader follows the
text — one commit, one author, no window in which the tree is red. C1's own steps therefore **verify**
these lines rather than edit them (the subplans of S\* precede this one by the map's order), and the
verification is in the acceptance.

**(3) A check that stops checking, silently — the finding of this plan.**
`test/module.test.js:120` and `:195` assert `assert.equal(/стриппер/.test(res.stderr), false, …)`:
the tool must **not** blame the stripper. It is a *negative* read, so after S3's step translates the
guard's sentence the regex matches nothing whatever the tool says, and "the tool does not accuse the
stripper" becomes an assertion about the absence of a Russian word — green forever, guarding nothing.
The word in the regex must be re-pointed to the English sentence in the same commit as S3's text,
exactly like a positive read; a translation that turns a check into a tautology is worse than a red
one, because nothing announces it. C1's plan carries this as a **verification** line in step 8 (with
`/стриппер испортил/` below) and as a rule for every other owner: a negative match over a printed
text is a reader too.

**A reader S3's plan missed, corrected here and in `measurement.md`.** `test/module.test.js:163`
asserts `assert.match(res.stderr, /стриппер испортил/, …)` after a real mutation of the stripper —
a **positive** read of the internal error `src/strip/guard.js:46`. S3's plan said the internal errors
have no reader at all, "measured by grep"; the grep answered for the sentence, not for its first two
words. So the step that translates that error has a red to prove it after all, and the correction is
recorded in S3's own file. The neighbouring `/greet\.js/` read in the same assertion is a file name —
data, untranslated.

## Readers of C1's own literals

- **`tools/suites.js`'s `checksIn`** counts the `test(` calls of a file, and
  **`test/docs-numbers.test.js`** compares that count against the numbers table of `README.md`: a
  machine reader of the file's **shape**, not of its words. So a name or a message is free to change
  and the **number of checks is not** — adding or removing one reddens the documentation guard.
- **`tools/run-tests.js:22`** (W1's file, a comment) is the only place a Russian **test name** is
  quoted: the example `--test-name-pattern=паритет` names a check of `test/parity.test.js`. It is
  prose and already recorded in `TODO.md` by W1's plan; after C1–C3 it names a pattern that runs
  nothing, so the comment is corrected where prose is corrected — no behaviour, no gate.
- **`test/api.test.js`'s frozen list** is data (exported names, already English): the file's four
  Russian lines around it are C1's.
- **No reader at all** for every test name and every assertion message of the nine files: nothing in
  the tree reads a check's text except the two counters above, and a failure message is read by the
  person or the agent who meets the failure. That is the point of translating them — an agent reads
  the message as the whole description of what broke.

## Steps — one commit each, red first

0. **Re-measure before starting**, and re-measure the joint lines of section (2): S1–S5, W1 and W2
   have landed by then, so those six lines are already English, and `test/module.test.js:120`, `:195`
   are already re-pointed (or the gap is found here rather than later). The counter's baseline for the
   nine files and the check counts per file go into the journal.
1. **`test/runner.test.js` + `test/guard.test.js` — done 2026-09-16**, 11 → **5** and 11 → **1**. Six
   names and messages in the first, ten in the second. **Red first, one message at a time:** all nineteen
   phrases went back to Russian on their own and `node --test test/runner.test.js test/guard.test.js`
   stayed green — no reader of a test's words, measured rather than inherited. The six lines that stay are
   **data**, and the experiment for the sharpest of them was made: replacing the payload letter `й` with an
   ASCII one turns the check **red**, which is why it must stay — the split in that test is between the two
   bytes of a multi-byte character, so an ASCII payload would leave the check green and proving nothing.
   The two sentinels (`из вывода`/`из ошибок`) and `guard.test.js`'s sample `текст` are the fixture's own
   text, written and compared by the same check. The counts are unchanged (2 and 3 checks), `pnpm test`
   green, `pnpm run dup` green — 19 messages is exactly where a twin could appear, and none did.
2. **`test/api.test.js` + `test/contract-derived.test.js` — done 2026-09-16**, 4 → **0** and 18 → **1**.
   Twenty-two names and messages in all. **Red first, one phrase at a time:** all twenty-two went back to
   Russian on their own and the two files' probe stayed green — no reader of a check's words. **Both
   experiments this step asked for were made, and both redden:** editing one name in the frozen list
   (`'CATEGORY_EXTS'` → `'CATEGORY_EXT'`) reddens `test/api.test.js` — the list is data compared with the
   module's real exports, which is the one place in this owner where the wrong target looks like the right
   one; and translating `['fixture: удаление файла']` reddens `test/contract-derived.test.js`, because that
   string is the fixture's own commit subject, pinned in `fixtures/synthetic/golden.json:468` and
   `manifest.json:64` and written by `tools/synthetic/history.js:91`. The one line that stays is therefore
   **a pin on the frozen copy**, not a stale expectation — the distinction the mission asked to state.
   No negative match over Cyrillic text in either file (measured), the counts are unchanged (1 and 5 checks),
   and `dup` is green over twenty-two fresh messages.
3. **`test/contract-data.test.js` — done 2026-09-16, 51 → 1.** Fifty names and messages. Red first, one
   phrase at a time: all fifty went back to Russian on their own and the check stayed green — no reader
   of a check's words. The two data sides were proved by experiment rather than asserted:
   **`f.label === 'заметки.md'`** is the fixture's own label, and translating it reddens the check; and
   **N24's line** (`:47`) carries a message that is C1's while the values it compares are the gated ones —
   translating the **source** of those values (`SKIP_WORDS` in `src/history.js`) reddens this check *and*
   `test/parity.test.js` in the same run, which is N24's documented price re-measured live, while the
   message change keeps both green.
4. **`test/page-tree.test.js` — done 2026-09-16, 55 → 1.** Fifty-four names and messages, with the
   dictionary read left in place. Red first: putting the phrase back to Russian left the check green for
   every message, while translating `:128`'s regex into the English dictionary value (`/not measured: /`)
   reddens it against the Russian data the report actually carries — the experiment that shows the data
   side of this file.
5. **`test/page-choice.test.js` — done 2026-09-16, 67 → 1.** Sixty-six names and messages. Red first, one
   phrase at a time: all of them went back to Russian on their own and the check stayed green. The
   `ui.<key>` comparisons were left alone and their nature was **measured rather than assumed**: `ui` is
   parsed from the page's own embedded `<script id="ui">`, so a change in the locale dictionary moves
   **both** sides and the check stays green — the comparison is self-consistent, which is the strongest
   form of "this is data". The payload `'{ это не JSON'` was measured the same way: an ASCII payload leaves
   the check green, so its Cyrillic is incidental and it stays as the fixture's own record.
6. **`test/page-view.test.js` — done 2026-09-16, 72 → 1.** Seventy-one names and messages, with the same
   self-consistent dictionary reads (`ui.empty`, `ui.noFiles`) left in place. Red first: every message
   green on its own. The data side of this file was proved by experiment: translating the fixture's label
   `'заметки.md'` reddens the check, while changing the dictionary value keeps it green — the same two
   shapes as in steps 3 and 5.
7. **`test/module.test.js` — done 2026-09-16, 58 → 7.** Fifty-one of this file's own names and messages
   (two test names, the rest assertion messages), measured 58 → **7**; the seven that stay are **data**
   and no message of another owner is among them. The five joint lines and the `:163` mutation read were
   not touched — the diff over the file carries only lines that held Cyrillic, which is how "not touched"
   was measured rather than promised. **Red first, one phrase at a time:** all forty-four pairs went back
   to Russian on their own and `node --test test/module.test.js` stayed green — no reader of a check's
   words. **The two negative matches at `:120` and `:195` were re-checked and both still guard**, and the
   form of the proof differs between them because their paths do: `:195` sits on a path where a refusal is
   in hand, so a temporary probe that pushed the word `stripper` into the minifier's printed text
   (`src/minify.js:54`, restored byte-identical) reddens the `jsx-in-js` check while the module-in-`.js`
   check stays green; `:120` sits on the healthy path, and measuring that path directly shows its stderr
   is **201 bytes** (the hook note) rather than empty — so the negative match is a bound on real text, not
   a vacuous line. The seven lines that stay are the fixture's payloads: a JS sample's comment and its
   `'Приветствие'`/`'Привет, '` strings, the git identity `Тест` and two commit subjects — all written
   and read by the check itself, none of them a message to a person. `dup` green (8 clones, 47 lines);
   the artifact hash stands (`cdda8d01…`), the built page is byte-identical (66 427 B).
8. **The verification commit — done 2026-09-16, folded into step 7** (nothing to translate of its own).
   The reads that can rot silently were re-checked and their state written down: `:120` and `:195` (see
   step 7 — one proved trip-able on its own path, the other a bound on text that is really there),
   `:163` (the mutation still produces `the stripper broke`, proved by a temporary probe that reddens the
   check when the cause's text is changed), and `:258`, `:284` (the hint's regex `/pin them with a file
   of their own[^:]*: (.+)$/m` still extracts a path from the English hint — it was already English when
   C1 began, and step 0 measured it in line). Nothing was out of line, so nothing was named to another
   subplan.

**Closed 2026-09-16.** The counter over the nine files answers **18**, and every one of the 18 is data
proved by experiment in the step that met it: `runner` 5 (the payload's multi-byte letter and two
sentinels), `guard` 1 (the sample), `contract-derived` 1, `contract-data` 1, `page-tree` 1,
`page-choice` 1, `page-view` 1 (the fixture's labels and the dictionary reads) and `module` 7. The
check counts are unchanged (44 over the nine files, 70 in the fast run, 175 in the full one) and
`test/docs-numbers.test.js` holds `README.md`'s table against them.

**Why the tree is green between the commits.** The nine files' own words are read by nobody but a
person meeting a failure, and the two counters read their counts; the data reads stay Russian by
design; the joint lines moved earlier with the texts they quote. The one sensor that can react to this
owner's work is **`pnpm run dup`**: 355 lines of parallel messages are exactly where a twin appears,
and the answer to a twin is a varied wording — never the baseline (`AGENTS.md`). Each step runs
`pnpm run verify:fast`, and `verify` before the portion is pushed.

## Acceptance

- `pnpm test` green, and the number of checks per file unchanged:
  `node -e` counting `test(` per file before and after, or the same count read from
  `tools/suites.js`'s `checksIn`; `pnpm test` prints the totals, and `test/docs-numbers.test.js` holds
  the table of `README.md` against them.
- The counter for the nine files answers **only** the two kinds of exceptions named above: the data
  reads (`test/page-tree.test.js:128` plus the `ui.<key>` comparisons, which carry no Cyrillic of
  their own) and the joint lines until their owners' steps move them.
- `test/api.test.js`'s frozen list and `test/contract-data.test.js:47`'s golden comparison are
  untouched — both are data, one of them gated by N24.
- `pnpm run dup` green (wording varied where a twin appeared), `pnpm run metrics` green (the check
  weight and the test-debt rules are unaffected by a message), `pnpm run verify:fast` after every
  commit and `pnpm run verify` before the portion is pushed.
- Every line of section (2) is English and every line of section (3) still guards: the verification
  commit says which, by measurement.

**Release:** checks do not ship (`files` names `bin`, `src`, `templates`, `README.md`, `LICENSE` —
measured while planning W1), so nothing here is released; each commit says so in words.

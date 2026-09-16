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
| `test/page-view.test.js` | 72 | test names and assertion messages; the page's captions are read from the `ru` dictionary as **data** |
| `test/page-choice.test.js` | 67 | the same, around the memory of the choice and the link |
| `test/module.test.js` | 66 → **58** measured | the same, plus **five reads of other owners' texts** (below); the eight that left are those reads |
| `test/page-tree.test.js` | 55 | the same, plus one read of the dictionary's data (`:128`) |
| `test/contract-data.test.js` | 51 | the same, plus reads of the fixture's `golden.json`/`data.json` data |
| `test/contract-derived.test.js` | 18 | the same |
| `test/guard.test.js` | 11 → **1** | the same, done 2026-09-16 (step 1): the ten names and messages are English, and the sample `'export const a = `текст;\n'` stays — it is the fixture's own text |
| `test/runner.test.js` | 11 → **5** | the same, done 2026-09-16 (step 1): six names and messages are English; the five that stay are the fixture's payload — the multi-byte letter and the two sentinels the child prints |
| `test/api.test.js` | 4 | the same, around the frozen list of exported names (identifiers) |

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
2. **`test/api.test.js` + `test/contract-derived.test.js`** (4 + 18). Red first: the frozen name list
   must stay byte for byte; translating **it** instead of the messages would redden
   `test/api.test.js` itself in the next run (`pnpm test` answers it), which is the experiment worth
   quoting — it is the one place in this owner where the wrong target looks like the right one.
3. **`test/contract-data.test.js`** (51). Red first: `:47` is N24's gated line and is **not** touched;
   the step proves it by staying green while the messages around it change, and by
   `test/parity.test.js`'s byte-wise comparison continuing to pass.
4. **`test/page-tree.test.js`** (55). Red first: `:128`'s regex reads the dictionary; translate it
   into English as a "tidy-up" and the check reddens against the Russian data it asserts — the
   experiment that shows the data side of this file.
5. **`test/page-choice.test.js`** (67) — the five `ui.<key>` comparisons stay as they are, the messages
   around them are translated.
6. **`test/page-view.test.js`** (72) — same shape, with the metric caption at `:223`.
7. **`test/module.test.js`** (66) — only its own names and messages; the five joint lines are other
   owners' and already moved.
8. **The verification commit** (no translation of its own, or folded into step 7): the three reads that
   can rot silently are re-checked and their state written down — `:120` and `:195` (the negative
   matches now name the English sentence and still redden if the tool ever blames the stripper),
   `:163` (the mutation still produces the internal error's text), and `:258`, `:284` (the hint's regex
   still extracts a path from the English hint). If any of them is out of line, the fix belongs to the
   subplan that moved the text, and it is named rather than patched here.

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

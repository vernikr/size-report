# 0167 — i18n W1 step 3: the checks' runner, and N30 found by its own counter

**Request.** Point 5, portion of the turn: step 3 of subplan W1 (`tools/run-tests.js`). Only
literals; behaviour and counters untouched; non-translation changes to `BLOCKERS.md`; the `MODES`
keys are protocol and must be told from printed text by measurement; the `plural` helper must not
break the agreement of a number and its word — measured for both the singular and the plural case;
N29 stays the user's decision; `dup` asked its own question; the plan corrected by measurement.

**Done.**

- **`tools/run-tests.js` 25 → 2**, and the two left are comments of the prose pass (`:22`, `:40`).
  Translated: the two `▶` lines, the whole summary line, `— FAILED` and the window line of
  `measure`, the per-file line's ` s`, the stale-declaration pair, the machine-load line, the
  unmatched-count message, the “No run was named” pair and its example, plus the two word-triples of
  `checks` and `files`.
- **`MODES` measured, not guessed.** Its keys are the CLI words (`node tools/run-tests.js fast`) and
  stayed; only the values moved (`fast`/`full`, so the summary reads `✓ fast run: 70 checks, …`).
  The plan's red-first experiment was the measurement: translating the keys would answer with the
  “run not named” branch — a protocol, not a word.
- **No machine reads a word of this file.** Returned to Russian whole, the **full** profile stayed
  green — 175 checks, 0 failures. `tools/gates/coverage.js:63` runs it under `c8` for its exit code
  alone; `test/gates-verify.test.js` reads the profiles' commands, never their output.
- **The counter's own measurement found a defect — N30.** The helpers were taken out of the file's
  own text and run over the counts that occur: `1 check`, `2 checks`, `5 checks`, `11 checks`,
  `70 checks` — and **`21 check`**. `plural` branches on the last digit (`last === 1` → the singular
  form), which is Russian grammar; in English the singular is only `n === 1`, so no choice of the
  three words is right for both 1 and 21. Recorded as `BLOCKERS.md` **N30** with a one-line repair
  and both prices; not taken, because it is a behaviour change.
- **`dup` asked its own question**: no new twin (10 clones, 15 fingerprints). N29's pair untouched
  and its three literals left exactly as they were.
- The `sec()`/`load()` decimal comma is **not** touched (N26, still open). Two comments of this file
  went to `TODO.md` — the grammar one is now about N30, the example `--test-name-pattern=паритет`
  works only while the suites' names are Russian.

**Counters.** `tools/run-tests.js` 25 → 2, the twelve files of this owner 212 → **189**, `tools/**`
392. `SITES` 27, `PRINTED` 2/2/1/2/4, `CASES` 38, checks 70 fast / 175 full, artifact 66 277 B
byte-identical.

**Left in W1.** Steps 4–8: `check-standards.js` 21 + `pack-check.js` 21 + `parity-live.js` 35 (step
4, where N29's other half lives), the comment in `docs-facts.js`, the console lines of
`parity-freeze.js` and `make-fixture.js`, `synthetic/repo.js:74`, and the catalogue's prose with the
narrowing of `ADVICE_LINE`. Two decisions are waiting on the mission agent: N29 (two variants) and
N30 (one line), and both are small code changes in `tools/**` that could ride together.

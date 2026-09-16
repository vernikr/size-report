# 0160 — S3 step 3 and the wash-up: the internal errors, and the layer closed

Requested (point 5 of the work): S3's step 3 — the four internal errors of the measurement layer — and
then the wash-up over the six files, if the counter allows closing the subplan.

## What changed

- `src/minify.js` — `the minifier is unavailable: <reason>`;
- `src/strip.js` — `unknown minification strategy "<name>" (have: <the list>)`;
- `src/strip/guard.js` — `the stripper broke <path> at <sha>: <reason>`;
- `src/metrics.js` — `the metric "<name>" needs the content of <file> at <sha>, and it was not read`.

All four are defect paths: none is caught as a refusal, so a run that reaches one ends with
`src/cli.js`'s `✗ <internal error>` and code 5, and `tools/harness.js`'s `refusal()` asserts the absence
of a stack in a *refusal* only.

## Readers — the plan's claim was wrong for one of the four, and the measurement says which

| String | Reader |
|---|---|
| `the stripper broke …` | `test/module.test.js` 3 («гард жив: сломанный стриппер не проходит молча», which mutates `src/strip/js.js` for real): measured, putting the sentence back into Russian reddens it with `текст отказа не называет причину`. The plan said no reader existed for any of the four; the correction section written while planning C1 had already found this one, and the step confirms it |
| the word `stripper` in two **negative** matches (`test/module.test.js` 2 and 15) | re-pointed to `/stripper/`; measured: left in Russian they stay **green and vacuous** — the whole 175-check run is green with them stale |
| `the minifier is unavailable: …`, `unknown minification strategy …`, `the metric "…" needs the content of …` | **no reader at all** — measured by putting the three back into Russian and running the whole full suite: **175 checks green**, plus the grep agreeing (`rg -n 'the minifier is unavailable:|unknown minification strategy|needs the content of' src test tools` answers inside `src/` alone) |

## The numbers

- Counter before → after: `src/minify.js` **1 → 0**, `src/strip.js` **1 → 0**, `src/strip/guard.js`
  **1 → 0**, `src/metrics.js` **16 → 15**. The wash-up over the six files of the subplan answers
  **`src/metrics.js:15` and nothing else** — the 12 `ru` dictionary lines and the 3-line Russian comment
  (61–63, `TODO.md`), both named exceptions of the tracker's allow-list.
- `SITES` (27), `PRINTED` (2/2/1/2/4) and `CASES` (38) unchanged; `pnpm run verify` green — eight steps,
  `test:all` 175 checks, `parity:live`, `check:standards`, `pack:check` (the report from the tarball
  byte for byte).

## Corrections to the subplan, by measurement

- The wash-up expectation `src/metrics.js:13` counted the Russian comment as one line; it is three, so
  the reading is **15** (corrected in the wash-up block and in the acceptance).
- Step 3's "no reader exists for these four strings" holds for three of them; the guard's has a reader
  and two negative neighbours, and the step now says so instead of quoting the grep alone.

`ADVICE_LINE`'s tolerance stays: after step 2 this layer prints no `починка: ` at all, while S4 and S5
still do, so narrowing the pattern now would redden the catalogue. It is W1's step 8 (**N28**).

## What is left in S3

Nothing: the three steps are landed and the wash-up criterion is met. The measurement layer is English
except its named exceptions — the `ru` dictionary (data) and the Russian comment (prose, `TODO.md`).

## Release and push

The portion changes bytes that ship (`src/**` is in `files`), so a PATCH release is owed; the release
half of `BLOCKERS.md` N20 is still open. Pushed with the full profile run by hand first.

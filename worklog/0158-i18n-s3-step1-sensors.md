# 0158 — S3 step 1: what a run says about a degraded sensor

Requested (point 5 of the work): S3's step 1 — the sensor note of `src/metrics.js` (`sensorGaps`' two
`why` and two `fix`) and the loader's reason in `src/optional.js` that the note concatenates.

## What changed

`src/metrics.js` — the two notes with their ways out, and `src/optional.js` — the loader's reason:

- `the metric "min" counts by simplification: the minifier is unavailable — <loader's reason>` with
  `fix: install the optional dependencies again or set "minify": {"engine": "strip"}`;
- `the metric "tok" counts by an estimate of length: there is no dictionary — <reason>` with
  `fix: install the optional dependencies again or remove "tok" from metrics`;
- `the optional dependencies are switched off (SIZE_REPORT_NO_OPTIONAL)`.

Both sentences keep their parallel shape (a cause, then a way out) and **the JSON fragments and key
names survive word for word** — `"minify": {"engine": "strip"}` and `"tok"` + `metrics` — because the
catalogue's two `works` alternatives run exactly those two fixes. The 12 lines of the `ru` side of the
dictionary beside them are data and were not touched (the counts below show them).

## Readers moved with the text

| Reader | Change |
|---|---|
| `tools/refusals.js`, case `приближение вместо точного счёта` | `must` → `['the metric "min" counts by simplification', 'the metric "tok" counts by an estimate', 'fix: ']`; both advice `text` fields, quoted word for word from the two fixes. The `truth` line stays (the catalogue's own prose, W1's owner), as in S2 |
| `test/minify.test.js:181,217,223` | `/минификатор недоступен/` → `/the minifier is unavailable/` (the plain run, the control mode and `check`) |
| `test/tokens.test.js:105,106` | `/метрика «tok» считает оценкой/` → `/the metric "tok" counts by an estimate/`, and `/\"tok\" из metrics/` → `/\"tok\" from metrics/` |

Expectations of the plan that the measurement **did not** confirm: `test/doctor.test.js:228` needed no
edit (it reads only `"engine": "strip"`, the JSON rather than the sentence), and no `truth` line moved.

## The numbers

- Counter before → after: `src/metrics.js` **20 → 16**, `src/optional.js` **1 → 0**. The 16 are the 12
  dictionary lines, the 3-line Russian comment (allow-listed) and the internal error of step 3, still
  Russian at this point. `src/minify.js` 4, `src/strip/guard.js` 6, `src/strip.js` 1, `src/parse.js` 1 —
  untouched, they are steps 2 and 3.
- `SITES` (27), `PRINTED` (2/2/1/2/4) and `CASES` (38) unchanged; `test/minify.test.js`,
  `test/tokens.test.js` and `test/refusals.test.js` green (17 checks over the three files), so the
  degraded run still returns code 4 and still prints both notes with their fixes.

## Red first — every string, one at a time

1. The `min` `why` put back into Russian alone → `test/minify.test.js` reddens **twice**
   (`отступление не объяснено`): check 5 (the plain degraded run) and check 6 (the divergence run).
   The `ru` dictionary's own line in the same test file (`min.method.indexOf('esbuild недоступен')`)
   stays satisfied — one file holds two kinds of string, and the message is what tells them apart.
2. The `tok` `fix` put back into Russian alone → `test/tokens.test.js` reddens on the JSON fragment
   (`отступление не назвало починку`).
3. The loader's reason put back into Russian alone → **nothing reddens**: `test/minify.test.js` and
   `test/tokens.test.js` answered 16 checks green. The reason travels inside a sentence whose opening
   words are what a check reads, so it has no reader of its own — a fact worth having, since it means a
   mistake in that line would be caught by a person rather than by the suite.

**Correction to the plan by measurement.** `measurement.md` expected the wash-up to answer
`src/metrics.js:13` — it counted the Russian comment as one line, and it is three (61–63), so the
expected reading is **15**. The step-1 and acceptance blocks now say so, and the step-1 block also
records the loader's unread reason and that `/the minifier is unavailable/` matches both the sensor note
and the internal error of `src/minify.js:40` (it matched both in Russian too).

## What is left in S3

Step 2 (the two refusals: `src/minify.js`, `src/strip/guard.js` and `src/parse.js`'s fallback reason,
with the two catalogue cases and the readers in `test/module.test.js` and `test/doctor.test.js`) and
step 3 (the four internal errors, where `test/module.test.js:163` is a real reader and `:120`/`:195` are
negative ones) — then the wash-up over the six files.

## Release and push

The portion changes bytes that ship (`src/**` is in `files`), so a PATCH release is owed; the release
half of `BLOCKERS.md` N20 is still open. Pushed to `origin/main` with the full profile run by hand first.

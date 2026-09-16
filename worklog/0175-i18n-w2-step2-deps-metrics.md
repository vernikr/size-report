# 0175 — i18n W2 step 2: the two sensors and their readers

**Request.** Point 5, next portion: step 2 of subplan W2 — `tools/gates/deps.js` and
`tools/gates/metrics.js` together with the probe lines that read their verdicts. Only literals;
thresholds, `GATE_FILES`, baselines and the profile split untouched; the trailer is due on every commit
of this owner.

**What moved — 11 lines, both files now empty.** `tools/gates/deps.js` 5 → 0: the refusal of a failed
run (`'deps: the analysis did not happen (…)'`, `'no report'`), the findings verdict
(`'deps: findings N (M modules, K relations)'`), the advice (`'fix the relations, not the rule'`), the
green verdict (`'deps: no findings (…)'`) and the `'  — for information: '` line.
`tools/gates/metrics.js` 6 → 0: the failed run (`'metrics: the linter did not run (…)'`), the red verdict
(`'metrics: new violations N (the baseline holds X in Y files)'`), the overflow line
(`'    … new violations in all: N'`), the advice (`'fix the code, not the sensor; a threshold or a
baseline is changed by a person'`) and the green verdict (`'metrics: no new violations (…)'`).

**The two readers moved in the same commit** — that is what keeps the gate from weakening for an
instant: `test/gates-deps.test.js:48` now matches `/no findings/` and `test/gates-metrics.test.js:144`
matches `/new violations 1/`. Both probes are green (part of the fast run).

**Red first, literal by literal, all ten** (the script puts each line back to Russian alone and runs the
whole probe file): only two of the ten redden anything — the deps green verdict and the metrics red
verdict — and the other eight (the two refusals of a failed run, the findings verdict, both advice lines,
the overflow line, the for-information line and metrics' green verdict) leave the probe **green**. That
is the measurement of "no reader", not a guess. No negative match exists in either probe over this text
(measured: neither file holds an `assert.equal(/…/.test(out), false)` at all), so nothing here could have
gone empty instead of red.

**Counters.** `tools/gates/deps.js` 5 → **0**, `tools/gates/metrics.js` 6 → **0**, the owner 100 → **89**.
Untouched: thresholds, `GATE_FILES`, both baselines and their fingerprints, the profile split, `SITES` 27,
`PRINTED` 2/2/1/2/4, `CASES` 38, 70 checks in the fast run and 175 in the full one. Both sensors answer on
this repository as before: `✓ deps: no findings (113 modules, 472 relations)`, `✓ metrics: no new
violations (the baseline holds 0 in 0 files)`. `pnpm run dup` asked separately — no new twin.

**Trailer.** Both paths are gate files; the commit carries `Gate-Change:` and the hook confirmed it.

**W2 is not closed** — step 2 of seven. Left: `dup.js` 20 and `coverage.js` 18 (steps 3 and 4, each with
its probe reads and a re-take of its baseline by the script), `gatefiles.js` 7 (step 5), `tools/suites.js`
38 (step 6) and the four hook messages (step 7) — 89 lines. Then C1–C3 and D1. Nothing ships here
(`tools/**` and `.githooks/**` are outside the package's `files`), so no release is owed; N20 stays open.

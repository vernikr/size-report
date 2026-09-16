# 0177 — i18n W2 step 4: the coverage sensor, and a ratchet that is already red

**Request.** Point 5, next portion: step 4 of subplan W2 — `tools/gates/coverage.js` with its two probe
readers and `coverage-baseline.json`. Only literals; thresholds, fingerprints and the composition of the
baselines must not move; a staleness question like N31 must be measured and recorded rather than cleaned.

**What moved — 18 lines, and the file reads 0.** The fallback reason of a run without a coverage report
(`'no report'`), the refusal of such a run, the baseline's `note`, the re-take verdict and its advice, the
refusal when there is no baseline, the totals line (`cover: lines 80.6%, branches 89.05%, functions
92.37%`), the regressions verdict (`cover: regressions 13 (the baseline holds 39 files)`), the detail line
of a regression (`    src/cli.js — lines: was 91.95, now 91.66`), the advice, the green verdict
(`cover: no regressions (the baseline holds 39 files)`) and the gone/new lines. The two readers moved in the
same commit: `test/gates-coverage.test.js:49` → `/src\/x\.js — lines: was 80, now 50/`, `:63` →
`/src\/new\.js — lines: was not in the baseline, now 0/`. These two match the **content** of the line, which
is the tightest coupling of the owner — hence one commit, not two.

**Red first, one printed message at a time:** exactly **one** of the thirteen reddens anything — the
regression detail line, which is what the two probe reads sit on. The other twelve (both refusals, the
note, the re-take verdict and advice, the totals line, the regressions verdict, the advice, the green
verdict, the gone and new lines) leave the probe green, which is the measurement of "no reader".

**The finding of this step: the ratchet is red before any of this work (`BLOCKERS.md` N32).** `pnpm run
cover` on the clean tree answered `✗ cover: regressions 13 (the baseline holds 39 files)` with totals
`80.6 / 89.05 / 92.37` and 0 new, 0 gone — thirteen small falls in `src/**` (parse.js 79.41 → 78.35,
strip/guard.js 96.61 → 94.82, hook.js 88.16 → 87.64 and ten more). After the translation the same run
answers the same thirteen and the same totals, so the translation moved no measurement. The baseline was
last written on 2026-09-15 (`202c768`) and 261 commits have landed since (34 touching `test/**`, 33
`src/**`); eleven of the thirteen files were last touched by campaign translation commits, two by that same
2026-09-15 commit. Why it went unseen: `cover` is in the slow profile, CI runs that only on a schedule
(cron `17 4 * * 1`, the workflow landed 2026-09-15 and has no runs yet), so the first scheduled run is still
ahead and will meet this red.

**The baseline's `note` was moved by hand, and a re-take was measured but refused.** Measured into a
temporary file (never over the repository): the script would keep the same **39** keys — 0 added, 0 gone —
and move **20** metric values: the thirteen falls plus seven rises over four files (`history.js` lines
95.06 → 95.31 and branches 96.8 → 96.96, `journal.js` lines 89.39 → 89.7, `optional.js` lines 93.54 →
93.93, `project.js` lines 96.22 → 96.63, branches 91.78 → 92.22, functions 94.44 → 95). That is a values
change rather than the composition change N31 describes, and it is the user's decision: re-take with the
trailer, or fix the coverage. The hand-moved `note`: diff one line, `files` byte-for-byte identical to `HEAD` (39 keys, same
values), and the text proved equal to the script's own four literals.

**Counters.** `tools/gates/coverage.js` 18 → **0**, `coverage-baseline.json` 1 → **0**, the owner 68 → **49**.
Untouched: the baseline's values, thresholds, `GATE_FILES`, the dup baseline, the profile split, `SITES` 27,
`PRINTED` 2/2/1/2/4, `CASES` 38, 70 checks fast and 175 full. `dup` asked separately: green, 8 clones, 47
lines, 15 fingerprints, no new twin.

**A reader the notes did not expect: the docs-paths guard.** The first wording of N32 named the coverage
summary file the step compares with, and `test/docs-paths.test.js` reddened on it — every path named in the
documentation must exist in the tree, and the reports directory is not the tree. The sentence was reworded
and the guard is green. Measured: no `tools/**` key lives in the baseline (39 keys, `src/**` and `bin/**`
only), so no literal of this sensor can enter the measured numbers — the red is pre-existing by
construction, and the fresh comparison confirms it value by value.

**Trailer.** The commit carries `Gate-Change:` (coverage.js, its baseline and its probe are gate files);
the hook confirmed it.

**W2 is not closed** — step 4 of seven. Left: `gatefiles.js` 7 (step 5), `tools/suites.js` 38 (step 6) and
the four hook messages (step 7) — 49 lines. Then C1–C3 and D1. Nothing ships here, so no release is owed;
N20 stays open, and N31/N32 now wait for the user.

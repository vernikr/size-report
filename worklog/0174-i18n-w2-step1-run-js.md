# 0174 — i18n W2 step 1: the profile runner, and 121 measured again

**Request.** Point 5, next portion: subplan W2 from its first step — the sensors, `tools/suites.js`,
`.githooks/**` — with the trailer every commit there owes, and W2 closed in the same portion only if the
measurement says it is done. Only literals; counts and behaviour untouched.

**Step 0 — re-measured, not inherited.** The owner's 121 holds to the line: `tools/gates/run.js` 21,
`dup.js` 20, `coverage.js` 18, `gatefiles.js` 7, `metrics.js` 6, `deps.js` 5, `common.js` 0,
`.githooks/pre-commit` 2, `pre-push` 2 (`commit-msg` and `post-commit` 0), `tools/suites.js` 38, each
baseline 1. None of W1's decisions or N25/N26 moved it.

**Step 1 — `tools/gates/run.js` 21 → 0.** The eleven step labels of `STEPS`, the `:hermetic` mark
`labelOf` puts on a step's name, the unknown-profile refusal, and the profile's own words: the summary
header `profile summary “fast”:`, the `s` after a duration, `total 16.3 s (size-report, steps 5)`,
`verify: red steps N of M: …` with its advice, and `✓ verify: the “fast” profile is green throughout
(5 steps)`. `:hermetic` is the word the README already uses for that suite (`README.md:434`), and the
labels reuse the run.js header comment's vocabulary.

**Who reads these words — measured, and nobody does.** `--list` prints the commands and nothing else;
`test/gates-verify.test.js` (five checks, green after the edit) parses those command lines and the
**call** lines inside the hooks and workflows; `tools/gates/run.js` runs the four sensors and reads their
exit codes, and a step's output is not captured at all. So the red-first experiment was the profile
itself, run both ways: `pnpm run verify:fast` green with the English labels and summary, and
`node tools/gates/run.js nope` exiting 1 with `✗ verify: no profile was named, or the name is unknown
(there are: fast, full, slow)`. The acceptance's own command for the invariant —
`--list slow` — is unchanged, ten lines, command for command.

**Counters.** `tools/gates/run.js` 21 → **0**, the owner 121 → **100**. Untouched: `SITES` 27, `PRINTED`
2/2/1/2/4, `CASES` 38, 70 checks in the fast run and 175 in the full one, the baselines' fingerprints,
the `GATE_FILES` list and the split in `tools/suites.js`. `pnpm run dup` asked separately — no new twin,
8 clones and 47 lines.

**Trailer.** Every path of this owner is a gate file, so the commit carries
`Gate-Change:` — the hook printed it back: “гейт-файлов 1, трейлер Gate-Change: есть”.

**W2 is not closed** — this is step 1 of seven. Left in it: the sensors' verdicts with their seven probe
reads (steps 2–5, the two Russian advice markers among them), `tools/suites.js`'s 38 `why` texts (step 6)
and the four hook messages (step 7). Then C1–C3 (the checks) and D1 (the declarative files) remain.
Nothing shipped moves: `tools/**` and `.githooks/**` are outside the package's `files`, so no release is
owed by this commit — N20 (the cadence) stays as it is.

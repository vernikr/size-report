# The string work: subplan W2 (the sensors) planned, and the seven verdicts their probes read

**Requested:** the next subplan of the map — W2, the sensors
(`docs/plans/2026-09-16-i18n-english/sensors.md`), by the owner of the files: `tools/gates/**`,
`tools/suites.js`, `.githooks/**` and the `note` of the two baselines. Same rules as S1–W1, plus: the
map's numbers checked against the measurement, and the acceptance shown to account for the fact that
these files are gate files whose verdicts CI prints. Tracker update and this entry included. N19,
N24, N25 and N26 left open.

**Done.** `sensors.md` written; the tracker's W2 row confirmed by measurement (77 + 38 + 4 + 2 =
**121**) and marked **written 2026-09-16**. No new blocker: the one formatting question this owner
meets (`tools/gates/run.js`'s decimal comma) is N26, already recorded while planning W1.

**The measurement that shaped the plan: the sensors' verdicts are read, but only by their own
probes.** Seven of them are matched word for word — `gatefiles.js:94` and its "commit can be made"
line by `test/gates-files.test.js:77,106,115`; `dup.js:197` and `:139` by
`test/gates-dup.test.js:72,88`; `coverage.js:115-116` (including the words `не в базе`) by
`test/gates-coverage.test.js:49,63`; `deps.js:53` by `test/gates-deps.test.js:48`; `metrics.js:63` by
`test/gates-metrics.test.js:144`. Each of those verdicts therefore moves **in the same commit as its
assertion line** — and only that line, since the probes' own Russian is C3's. Everything else of this
owner is read by nothing: the eleven step labels of `run.js`, all the advice lines, the "for
information" line of `deps.js`, the four hook messages, the `why` texts of `tools/suites.js` (whose
guard reads their **presence**, not their words) and the two baselines' `note`.

**The baselines are re-taken by their scripts, never edited by hand.** `dup-baseline.json` and
`coverage-baseline.json` carry a `note` written by `tools/gates/dup.js:128-129` and
`coverage.js:81-84`, so translating those literals means running `pnpm run baseline:dup` and
`pnpm run baseline:coverage` (the second after `pnpm run cover` — the slowest step of this owner).
That is also what `AGENTS.md` asks: the note is the file side of a text whose source is inside the
77 lines, so the two count once and are planned as one step each, not four.

**The trailer is the acceptance, not a formality.** Every file of this owner is a gate file, so each
commit carries `Gate-Change: <reason — what changed, by which measurement>`, checked by the
`commit-msg` hook at once and re-read by the `pre-push` hook over the range. The step that proves the
guard by hand is `gatefiles.js`'s own: commit a gate change without a trailer and read the message,
which is exactly what `test/gates-files.test.js` does in a temporary repository.

**Two drifts named rather than fixed.** The step labels exist twice — `tools/gates/run.js:34-44` and
the `why` lines of `tools/suites.js` — and no guard compares them (measured while planning W1); both
are translated here, the drift stays. And the `deps.js` verdict for a clean graph ("no findings") is
asserted in the same words a person reads, so its translation is the step where the probe and the
sensor must be moved together, which the plan makes the "red first" experiment.

**Checks:** `pnpm run verify:fast` green. Nothing of this owner ships (`files` names `bin`, `src`,
`templates`, `README.md`, `LICENSE`), so the whole portion releases nothing; no product file changes.
No code, no test and no threshold touched this time either — the one line of the plan that touches a
test is an assertion that quotes a verdict.

**Offered next:** the checks of the page and the contract (C1 — `page-view` 72, `page-choice` 67,
`module` 66, `page-tree` 55, `contract-data` 51, `contract-derived` 18, `guard` 11, `runner` 11,
`api` 4), or the first chunk of work under a written plan.

# 0171 — i18n W1 step 8: the catalogue's prose, the narrowing, and W1 closed

**Request.** Point 5, portion of the turn: step 8 of subplan W1 — the 55 lines of `tools/refusals.js`
and the narrowing of `ADVICE_LINE` with the experiment the plan wrote for it — and, if the measurement
confirms it, closing W1 with the expected remainder named. Only literals, except the narrowing, which
the plan assigns to this very step. N29, N30, N21 and N20 untouched; full `verify` before the push.

**Done — `tools/refusals.js` 55 → 0.**

- 49 `truth`/`advice.why` lines, the two case `id`s (`coverage is incomplete`,
  `an estimate instead of an exact count`) and the two lines of the one `uncatchable` reason.
- The stale `template` doc comment now names `<file>`/`<commit>`, as the printed advice carries them
  since S1's step 2 — it argued for the Russian placeholders while the shapes were English.
- **`ADVICE_LINE` narrowed**: only the English markers remain. The comment above it says so instead of
  promising a tolerance that no longer exists; `BLOCKERS.md` **N28 is closed** with it.

**The experiment, run twice — and the first result is a finding.**

- The plan's case, the shallow history, printed with `починка: ` again, left the catalogue **green**:
  that refusal prints two advice lines, and the extractor's assertions are about the texts being named
  and about every declared advice being present, not about the marker. So the tolerance was worth less
  than it looked, and what it cost is now visible: an advice that loses its marker while a second
  advice line stays is invisible to the catalogue either way.
- `config already exists`, which prints one advice line, reddened exactly as the plan promised:
  `«settings and the project / config already exists»: отказ ничего не советует, а каталог объявил
  совет`. Both experiments were reverted; `src/**` is untouched in the commit.

**What the step was asked, measured.**

- Of the 55, only two groups are read by a machine: the two `id`s (inside failure messages,
  `test/refusals.test.js:301` and `test/refusals-catalog.test.js:94,104,107,113,116,126,130`; the
  `deepEqual` at `:113` names `'internal error'`, which was already English) and the `uncatchable` text,
  read only by its length (`:116`, more than 40 characters — kept at about 150). `truth` and
  `advice.why` are read by no machine at all.
- The tolerance is needed by nobody else: `adviceOf` has one call site (`test/refusals.test.js:245`)
  and is applied to the tool's output alone; the only Russian advice markers left in the repository are
  W2's two sensors (`tools/gates/dup.js:139`, `coverage.js:93`).
- The counts stand: `SITES` 27, `PRINTED` 2/2/1/2/4, `CASES` 38; both catalogue checks green, full
  `verify` green.
- `tools/refusals.js` is **not** a gate file (`tools/gates/gatefiles.js`), so **no `Gate-Change:`
  trailer** — the commit hook printed it itself: “гейт-файлов 0”.
- `pnpm run dup` answered no new twin (10 clones, 15 fingerprints).

**W1 is closed.** The twelve files read **30**, and every one of the 30 is named: 19 allowed by N21
(`parity-freeze.js` 16 + `make-fixture.js` 3), 6 blocked by N29 (`harness.js` 3 + `parity-live.js` 3),
the 2 section names of `docs-facts.js` (they go when a release moves the pin, N20) and 3 prose comments
(`run-tests.js:22,40`, `docs-facts.js:170`). The plan expected 31; the difference is the catalogue's own
comment at `:134`, which this step translated instead of leaving it as prose — the arithmetic of the
allow-list was one line off, and the plan and the tracker now say which line and why. `tools/**` as a
whole reads 233.

**Left in the campaign.** The rows not started: W2 (the sensors and `.githooks/**`; every commit a gate
file), C1–C3 (the checks) and D1 (the declarative files) — plus the decisions N29 and N30 (both small
code changes in `tools/**`) and the release cadence N20.

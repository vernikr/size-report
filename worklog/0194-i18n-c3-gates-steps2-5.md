# C3 steps 2–5: the six gate checks speak English

What was asked: the next portion of point 5 — all six `test/gates-*.test.js` (steps 2–5 of
`tests-guards.md`). Translations only, one commit with the `Gate-Change:` trailer, English message and
journal entry, full `verify` before the push, CI checked afterwards.

## Done

- `test/gates-deps.test.js` **8 → 0**, `test/gates-dup.test.js` **13 → 1**,
  `test/gates-coverage.test.js` **14 → 0**, `test/gates-metrics.test.js` **22 → 5**,
  `test/gates-files.test.js` **26 → 8**, `test/gates-verify.test.js` **26 → 0** — 95 lines of names and
  messages, and the owner C3 reads **82** (was 177).
- What stays, named: `gates-dup`'s path of a baseline that is not there (an input), `gates-metrics`'s
  probe payload (the debt comment and the four injected `test(` bodies the sensor measures),
  `gates-files`'s own repository (identity, commit subjects and the `Gate-Change:` bodies the
  experiment writes — the guard reads the trailer as a shape).
- The protocol is untouched and ASCII: `/pnpm run verify:fast/`, `/tools\/gates\/gatefiles\.js/` and
  `.gitignore`'s `/^reports\/$/m`.

## Measured, not argued

- **Every verdict read of the six re-measured by mutating its sensor, sources restored
  byte-identical:** `deps: no findings (` → reddens `gates-deps` check 1; `dup: new clones ` →
  `gates-dup` check 2, `dup: there is no baseline (` → check 4; `: was ` → `gates-coverage` checks 1 and
  2; `metrics: new violations ` → `gates-metrics` check 4; `: a gate edit with no Gate-Change: trailer`
  → **all three** checks of `gates-files`; the hooks' `pnpm run verify:fast` → `gates-verify` check 4;
  `.gitignore`'s `reports/` → check 5.
- **One honest finding:** making the **ok** verdict of `dup` (`dup: no new clones (`) Russian leaves
  `gates-dup` green — the ok line is printed on a green run and none of the file's checks reads those
  words, while both `bad` lines are read.
- Red first by the whole file: all six at their `HEAD` version ran green (23 checks, `fail 0`).
- Checks unchanged (4/4/3/4/3/5; 70 fast, 175 full); `dup` before and after `clones 5, lines 29`; the
  artifact's **content** digest (`fixtures/parity/artifact.sha256`) `1bdb27e1…` and the reference
  file's own sha256 `cdda8d01…` unmoved; full `pnpm run verify` (8 steps) green before the push.

## Suggested

- The six files are gate files, so this commit carries the `Gate-Change:` trailer — the hook printed
  the demand and accepted the commit.
- The order of the portions is the mission's, not the plan's numbering (noted in the tracker and the
  subplan): the two files of steps 7–8 came first, then steps 2–5. What is left of C3 is steps 6
  (`suites` and `docs-numbers`) and the siblings of the earlier portion (`docs-pin`, `frozen`).

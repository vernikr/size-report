# Documentation guards cull — meta plan (tracker)

2026-09-17. The inventory this campaign works from is `bird-view.md` beside it: every guard, its
promise, its seconds and its lines, measured. Progress is journalled in `worklog/NNNN-*.md`, one
file per portion; nothing here is marked done without a measurement.

## Goal

Cut the number of checks that hold the documentation true, and cut it **radically**, by two named
routes. The unit of decision is one promise, not one file:

1. **Delete the fragment.** The guarded claim leaves the document; the guard (or the one check
   inside a file) loses its subject and goes with it. The document becomes smaller and free.
2. **Delete the guard.** The document keeps the claim and ages on its own; no check stands behind
   it. The document stays as it is, and nobody promises it is true.

## Current state — measured 2026-09-17

| | Tier 1 (the prose) | Tier 2 (the declarations) | Named, not counted |
|---|---|---|---|
| Files | 4 guards + their reader | 5 guards | `check:standards`, the refusals catalogue, the three metrics rules for checks |
| Checks | 8 | 17 | — |
| Lines (code / comment) | 621 (366 / 200) | 658 (421 / 157) | — |
| Seconds, one file at a time | 2.25 | 4.82 | — |
| Run | fast, all four | three fast, two slow | — |

`test/` is 6 048 lines over 37 files: the guards are 1 047 of them, 1 279 with the reader. The
fast set is 70 checks, the full one 175 (README, held by A3). The measurement method, the window
and the caveat are in `bird-view.md`; a re-measurement uses the same commands so the numbers can
be compared.

## Rules

- **The sensors are not edited.** No threshold moved, no `ignore` widened, no rule switched off,
  no suppression written, no baseline refreshed to hide a fall. A removed guard removes its own
  lines; a baseline follows by hand only if the sensor reddens over a line that is *gone*.
- **`tools/suites.js` is a gate file.** Dropping a file from `FAST`/`SLOW` is a `Gate-Change:`
  commit — that trailer is the campaign's named price, spent and counted rather than hidden.
  `test/suites.test.js` forbids a file being in neither list.
- **The README counts are held by A3.** While A3 stands, every removal edits the two numbers in
  README in the same commit. If A3 is the first to go, the numbers are edited once, by that
  removal, and are free afterwards — the campaign must pick one order deliberately.
- **One promise per commit** where the diff allows it: a reader of the history has to see which
  promise went and why.
- `pnpm run verify:fast` at every commit, `pnpm run verify` before a push, the commit budget
  ≤ 600 lines / ≤ 10 files. Nothing here ships in the tarball, so no release follows
  (`docs/plans/**`, `worklog/**`); that is said in the commit body in words.
- **What stops being checked is named** — in the commit body and in the journal: the promise, the
  document that loses its guard, and what a reader can no longer rely on.

## Order — a proposal, settled before the first portion

Cheapest risk and worst volume-to-promise ratio first: the point of the campaign is not to touch
the checks that earn their lines.

1. **A3 `docs-numbers` (53 lines, 1 check) and A4 `docs-pin` (62, 1).** Each holds a *process*
   rather than text: the count of checks, and the order of the release (tag before the commit).
   Neither costs a document more than a number. A4's red is also the only guard that can redden
   CI for a reason remote from the tree of the day.
2. **A1's second check — the README file table**, which demands a row for all 298 tracked files.
   The fragment is deletable from the document, and then the check dies with it. A1's first check
   (paths exist) costs 46 lines and may stay or go on its own.
3. **A2's fourth check — the `§` references**, the largest parser in the set. A2 keeps three
   promises after it; whether the file survives in part is decided here.
4. **B3 `suites` and B2 `gates-verify`:** declarations rather than prose. What a reader loses is
   the promise that the CI description in `AGENTS.md` and the profile cannot drift — the failure
   mode is a check that is green locally and red in CI.
5. **B1 `templates`, B4 `release`, B5 `gates-files`:** decided check by check. B1's third check
   (a report is really assembled) is behaviour and may stay while the two document checks go.

## Definition of done

- A number for what is left — guards, checks, lines (code / comment), seconds — taken by the same
  method as `bird-view.md`, in the journal, next to the starting figure.
- `verify:fast` green at every commit, `verify` green before every push; the number of
  `Gate-Change:` commits spent is stated.
- Every claim left in a document without a guard behind it is named once, in the commit that
  stopped guarding it.
- No stretch of this campaign ships in the tarball: the commits say so and no release is made.

## Out of scope

- The sensors themselves (`metrics`, `dup`, `deps`, `coverage`), `pnpm run check:standards`, the
  refusals catalogue (`tools/refusals.js` + its readers), and every check of behaviour (`api`,
  `contract-*`, `page-*`, `cli*`, `disk`, `check`, `doctor`, `hook`, `minify`, `tokens`,
  `environment`, `crlf`, `parity`, `frozen`, `git-pins`, `guard`, `runner`).
- `fixtures/**` (frozen references), `docs/size-report.html` (the hook owns it), the package's
  public API.
- The wording and meaning of the documents that stay: nothing is rewritten "to be true".

## Open questions

- **Keep one?** If every documentation guard goes, nothing in the tree notices a document that
  has aged. Is one cheap guard kept as the tongue in the shoe (A1's first check, 46+232 lines, or
  a much smaller reader), or is the campaign's answer that a person re-reads the documents?
- **The README file table.** Deleting it is the largest single fragment the cull can win, and the
  largest loss for a reader of the repository. Which way does it go?
- **A3 and A4 together.** If both go, the release order in `AGENTS.md` becomes advice rather than
  a rule, and the run counts in README become a number somebody must remember to update.
- **The reader.** `tools/docs-facts.js` (232 lines, 88 of them the account of what is *not*
  checked) serves only these four guards. Its fate is the sum of theirs, and its header has to be
  deleted deliberately rather than left orphaned.

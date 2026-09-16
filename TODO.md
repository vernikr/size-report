# TODO — size-report

Defects noticed **in passing** while doing other work: a wrong line, a stale number, a refusal
that names the wrong cause. It is not `BLOCKERS.md` (a blocker has a reproduction, a consequence
and a suggested fix, and it stops work) and not `worklog/` (what was done): an entry here is a
note to come back to, and nothing more.

Rules of keeping it:

- an entry names **where** (file and line), **what** is wrong and **how it shows** — a claim
  without a way to see it is a guess;
- an entry leave the tree alone: the defect is fixed in a portion of its own, not on the way past
  it (the translation work does not mix in unrelated edits — `AGENTS.md`);
- a fixed entry is deleted rather than struck through; the fact of the fix belongs to the
  `worklog/` entry of the portion that fixed it.

Opened 2026-09-16 with the string-translation work (`docs/plans/2026-09-16-i18n-english/`).

## Open

- **`src/metrics.js:61-63` — the last Russian comment in `src/`.** Seen 2026-09-16 while measuring
  the measurement layer for subplan S3 (`docs/plans/2026-09-16-i18n-english/measurement.md`): the
  comment above `METRICS` explains why a metric declares `needsText`, and it is the only comment
  left by the prose pass — 3 lines, measured with
  `rg -c '^\s*(//|\*|/\*).*\p{Cyrillic}' src`, which answers `src/metrics.js:3` and nothing else.
  It is prose rather than a literal, so the string work does not touch it and `src/metrics.js` will
  not reach a zero Cyrillic count until someone does. Fix it in a portion of its own (one comment,
  no code), or name it permanently in that plan's allow-list.

# 0145 — blocker answers N21, N22, N23

Requested: decisions on three blockers.

## N21 — the frozen layer stays Russian
Decided: keep the references Russian and record them as an exception; no re-take. The builders that write
them stay Russian with them, since a translated builder changes the bytes `pnpm run check:standards`
compares. Measured by counting the ranges: **107 lines** join the allow-list — `tools/synthetic/note.js` 37
+ `content.js` 31 + `history.js` 20 (88) and the references' own data in the instruments
(`tools/parity-freeze.js:98-118` 16, `tools/make-fixture.js:56,57,64` 3 → 19). The allowance moves the
tracker's arithmetic: allow-list 2 782 → 2 889, owners 2 730 → 2 623 (`tools/**` 387 → 368,
`tools/synthetic/**` 89 → 1), `tools/**` family 559 → 452 (W1 349 → 330, W3 89 → 1). W3 is now a
**one-line owner**: `tools/synthetic/repo.js:74`, an internal error written into no file.

## N22 — nothing left to remove
The table of numbers with sizes in a markdown file is not needed (the page is enough) and whatever was tied
to it may go. Measured: **nothing is left.** `CHANGELOG.md` and `test/changelog.test.js` went when asked;
no markdown file carries the fixture's sizes; the single remaining mention — `tools/docs-facts.js:58`, a
path a document may name — is load-bearing for the archived plans, which cite it and are read by the docs
guards, so dropping it would redden `test/docs-paths.test.js` on a true record. The numbers half of the
promise is deliberately held by no check.

## N23 — closed without action
Re-measured before closing: both readers of the move are updated, no guard reads
`docs/module-design.md`'s bare `PLAN.md`. The note stands in place of a change.

Files: `BLOCKERS.md` (three decisions), the tracker (`plan.md`: allow-list row, W1/W3 rows, both
arithmetic paragraphs, the "what is left" table, the order step, the out-of-scope bullet, the frozen-layer
open question), `tools.md` (its own allowance and acceptance) and `automation.md` (the reference to N21).

Nothing released: this portion changes plans and notes only, and no line of it is in the tarball. N24
(`SKIP_WORDS`) is **not** decided; N21's answer excludes its "translate and re-take" option, leaving two.

Suggested: with N21 decided, W3's single line can fold into W1's portion instead of opening a subplan of
its own — the mission agent's call.

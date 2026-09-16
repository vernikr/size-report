# 0153 — S1 closed: the wash-up is deferred, with its condition measured

Requested: close subplan S1 by checking whether its step 5 (the wash-up of the transitional tolerance
in `ADVICE_LINE`) can be done now, and record the answer — deferred or done — in the tracker and
`BLOCKERS.md`, touching no code.

## The measurement (the answer was already visible after step 4)

`rg -n 'починка|создайте его|соберите её|локально:|в CI:' src tools bin` — the Russian advice
markers are still printed by:

| Owner | Where | Sites |
|---|---|---|
| S2 | `src/config.js`, `src/init.js` | 4 `починка` + 1 `создайте его`, 1 |
| S3 | `src/strip/guard.js`, `src/minify.js` | 1, 1 |
| S4 | `src/git.js`, `src/history.js`, `src/check.js`, `src/doctor.js`, `src/explain.js` | 2 (`локально:`, `в CI:`), 2, 1, 1, 4 |
| S5 | `src/hook.js` | 4 |

Outside `src/**` they appear only in `tools/gates/dup.js` and `coverage.js` (W2), and W1's own
measurement (`tools.md`, step 8) says the extractor never parses those.

So the wash-up **cannot** be done now, and the honest record is a deferral with an exact condition
rather than a half-edit. `BLOCKERS.md` N28 carries it: the narrowing may land when **no `src/**`
module prints a Russian marker** — S2, S3, S4 and S5 finished — and it belongs to **W1's step 8**,
which owns `tools/refusals.js`; the red-first experiment for it is already written in `tools.md`.

## The other half of step 5 is satisfied

`rg -cP '[\p{Cyrillic}]' src/refusal.js src/args.js src/cli.js src/modes.js` answers nothing — all
four files of the subplan are at zero after steps 1–4.

## What the subplan delivered

The help (`c0df1fb`), the grammar's refusal messages (`cb64f12`), the cause registry across every file
that names it (`a7c869b`) and what the modes print (`230640e`) — 149 Cyrillic lines out of the eight
files the work touched, with the whole fast and full profiles green after each step. The tracker's S1
row now reads "done, with the wash-up deferred", and `surface.md`'s step 5 states the condition where
the next reader of the subplan will look for it.

## Files

`docs/plans/2026-09-16-i18n-english/plan.md` (the S1 row), `.../surface.md` (step 5), `BLOCKERS.md`
(N28), this entry. No code, no tests, no gate file — nothing ships, so no release is owed and the
commit says so in words.

# 0147 — G1 withdrawn: no language guard

Requested: the last unwritten subplan was to be G1, the guard on Russian characters. Mid-planning the
mission corrected the plan: **no such guard is needed** — the instruction this work follows says
English everywhere except the chat reply, so Cyrillic arriving in new code, checks or documentation is
a near-impossibility rather than a risk worth a check.

## Done

No `guard.md` and no code: the row is closed by the decision. Recorded in `BLOCKERS.md` as **N27**
(what was planned, why it is not needed, the price, and the measurements kept so a later hand does not
repeat them), and in the tracker: the `G*` letter of the map intro, the row itself, the "what is left"
table (now a decision note), the order section, the gate-files bullet and the definition-of-done
bullet, which already allowed exactly this — "the guard is in the suite, or its absence is a recorded
decision with a reason".

The measurements taken while planning it, kept in N27: a `\p{Cyrillic}` counter over `git ls-files`
runs in **3.0 s** and finds **122 files** with Cyrillic outside `worklog/**`; such a check would be a
test file, and `test/suites.test.js` would demand its declaration in `tools/suites.js` — with
`tools/gates/gatefiles.js` that is two gate files and a `Gate-Change:` trailer. The simplest workable
form was recorded as an explicit list of allowed paths with a reason each (a path alone for what is
wholly an exception, a path with a count for a mostly clean file), not a mechanism of regex
exceptions, because a reason inside a pattern cannot be checked by eye.

**The price, named:** a stray Russian literal added later is caught by a person running the counter,
not by the suite. What holds the allowance instead is the acceptance every subplan already carries —
the counter per file, before and after, quoted in each plan and journal entry.

## Also fixed (dangling references)

Six places promised the guard and now point at the allow-list instead: `plan.md`'s allow-list row for
this plans folder, the C3 row, `tools.md` (the `commandsAt` tolerance), `tests-guards.md` (two
places, the `требовани|requirements?` resolver), `surface.md` (W1's wash-up removing the Russian
marker alternative) and `diagnostics.md` (the `SKIP_WORDS` line).

Point 4 of the work is complete: every row of the map is written. Nothing released — plans and notes
only. N19, N20, N25 and N26 remain open.

# N32: the coverage sensor counts what executed

What was asked: the user's decision on `BLOCKERS.md` N32 — fix the sensor rather than re-take the
baseline, counting how much actually executed instead of a file's share. Change it whole, record it as a
decision, run the full profile and the slow one live (the slow was the red one), trailer if the portion
touches gate files, English message and journal entry.

## Done

- `tools/gates/coverage.js`: the ratchet's unit is now c8's own `covered` numbers — lines, branches and
  functions per file — taken from the same `json-summary` report. The whole-set shares are still printed
  for a person; they are no longer compared. The header comment says why the unit changed, and what the
  choice costs (a file that grows **and** executes stays put).
- `coverage-baseline.json` re-taken by the script in the same commit: `schema` 1 → 2, a `unit` field
  added, the entries shares → counts, and the `note` extended to name the unit.
- `test/gates-coverage.test.js` moved with the verdict and gained the two cases the decision rests on.
- The decision is recorded in `BLOCKERS.md` N32, and `README.md`'s row for the sensor names the unit.

## Measured, not argued

- **Both halves on the real report** (the freshly taken coverage, the real `src/cli.js` at
  `{"total":84,"covered":77,"pct":91.66}`): the file **grown by 24 lines is green** (exit 0) even though
  its share falls to 71.3% — below the 91.95% the previous baseline held; **one executed line less is
  red** with `src/cli.js — lines: was 77, now 76`, and one executed branch less with
  `src/cli.js — branches: was 34, now 33`. So the ratchet reddens when code stops being run and stays
  quiet when code merely grows.
- **The shape of the baseline moved, its composition did not:** 39 keys before and after, the same set;
  `src/cli.js` went from `{"lines":91.95,"branches":97.14,"functions":100}` to
  `{"lines":77,"branches":34,"functions":9}`.
- **The slow profile, run live:** `pnpm run verify:slow` is **green end to end** — 10 steps, 198.5 s, of
  which `cover` 69.0 s. The coverage verdict is `✓ cover: no regressions (the baseline holds 39 files)`
  with the same totals it printed while red (`lines 80.6%, branches 89.05%, functions 92.37%`): the
  numbers did not move, the unit did. The thirteen falls that reddened it were share falls, which is
  exactly the class the decision names.
- **The sensor's own probe is stronger, not weaker:** 3 of 3 green with reports and a baseline written in
  counts, plus two new checks — a fall of exactly one executed line is red, and a file that grew while
  keeping every execution is green. The probe is a gate file and rides with the verdict.
- The sensor carries no Russian of its own, so `tools/**`'s counter stays at 111; the cost of the slow
  profile is unchanged (same c8 run, one more map of counts).

## Suggested

- **One implementation decision, with the alternative's price:** the answer spoke of lines; branches and
  functions got the same unit, because the flaw is identical for all three and one file should not carry
  two units. Narrowing to lines alone is one word in `METRICS`, recorded in `BLOCKERS.md`.
- **What the change buys in this repository's own history:** the thirteen files that reddened the ratchet
  were red for the class the decision fixes — a translated literal split into a two-line concatenation
  grows a file without touching what executes. A share-based ratchet punished exactly that.
- Next: N20's batched release — the version, the journal section, the pin and the tag push — and the
  `pnpm add -D -E` that makes the attached copy English, which is also what turns this repository's own
  report page English.

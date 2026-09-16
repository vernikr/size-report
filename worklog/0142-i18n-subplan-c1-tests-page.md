# The string work: subplan C1 (the page and contract checks) planned, and a check that stops checking

**Requested:** the next subplan of the map — C1, the checks of the page and the contract
(`docs/plans/2026-09-16-i18n-english/tests-page.md`). Same rules as S1–W2, plus two of its own: if
this is the first owner whose lines two subplans read at once, say which step and why; and name the
unwritten subplans with their expected numbers, marking that the order was respected. Tracker update
and this entry included. Every open number (N19, N24, N25, N26, N21, N20) left open.

**Done.** `tests-page.md` written; the tracker's C1 row marked **written 2026-09-16** and given a
**"What is left"** block; S3's plan (`measurement.md`) **corrected by measurement**; no new blocker.

**Yes — this is the first owner read by two others at once, and it is read in three different ways.**
(1) **Allow-listed data**: `test/page-tree.test.js:128` asserts the panel's plain box with
`/не измеряется: /`, which is `appUi.notMeasuredRule`'s value, and `page-choice`/`page-view` compare
DOM text with `ui.<key>` values — a value compared **with** the dictionary is never translated, a
sentence written by the check is. (2) **Other owners' printed texts**, moved in *their* step, never
here: `test/module.test.js:197` and `:200` (S3's minifier refusal and its advice), `:218` (S1's cause
name), `:224` (S2's advice), `:258`/`:284` (the `--init` hint, S2's step), and
`test/contract-data.test.js:47` (N24's frozen comparison — bytes, not wording). Why that way: the
printed text is the contract, the check's copy is not, so the reader follows the text and the tree is
never red between the commits.

**The finding that shaped the plan: one of these checks stops checking, silently.**
`test/module.test.js:120` and `:195` assert `assert.equal(/стриппер/.test(res.stderr), false, …)` —
"the tool must not blame the stripper". It is a **negative** match, so the moment S3's sentence turns
English the regex matches nothing whatever the tool says: the assertion stays green forever and
guards nothing. A translation that turns a check into a tautology is worse than a red one, because
nothing announces it. The plan makes the re-pointing part of S3's step (the text is S3's), records it
as a **verification** step of C1, and states the rule for every owner: a negative match over a printed
text is a reader too.

**And a correction to S3's plan, which claimed the opposite.** S3 said the four internal errors have
no reader, "measured by grep". The grep answered for the whole sentence `'стриппер испортил …'` and
not for its first two words: `test/module.test.js:163` asserts `/стриппер испортил/` **after mutating
`src/strip/js.js` for real** (the mutation loses the single-quote branch, the stripper eats the rest of
a line and the code stops parsing). So that step has a red to prove itself with instead of a grep —
corrected in `measurement.md` itself, with the two negative neighbours named there.

**The checks' own words are read by two counters, not by people's tests.** `tools/suites.js`'s
`checksIn` counts the `test(` calls of a file and `test/docs-numbers.test.js` holds that count against
the numbers table of `README.md`: the **shape** is read, the words are not, so a name or a message is
free and the number of checks is not. `tools/run-tests.js:22`'s comment is the only place a Russian
test name is quoted (`--test-name-pattern=паритет`) — prose, already in `TODO.md` from W1's plan, and
it names nothing once C1–C3 are done. And `pnpm run dup` is the sensor to watch here: 355 lines of
parallel messages are exactly where a twin appears, and the answer to a twin is a varied wording,
never the baseline.

**What is left, measured rather than subtracted.** Unwritten: C2 (`tests-cli.md`) 739, C3
(`tests-guards.md`) 226, D1 (`configs.md`) 131, W3 (`fixture-builders.md`) 89, G1 (`guard.md`) — no
counter reading, the guard does not exist yet. Ten rows are written (T0, S1–S5, W1, W2, C1) and the
rows now sum **exactly** to the instrument's 5 512: `src/**` 351, `bin/**` 2, the `tools/**` family
559, `test/**` 1 320, D1 131, the allowed quotations 18, the report 349, plus the allow-list 2 782.

**One discrepancy in the order, named rather than smoothed over.** The table's row order has been
followed without skipping a row, and every portion was the next unwritten one. But the map's
**Order** section groups D1 with W1 in step 2, while the table lists D1 after W3 — so D1 is "next" by
one reading and "later" by the other. It is the third place where this map's own two readings differed
from the measurement (the twelfth instrument became eleven; `.githooks/**` and the dotfiles had no
row), and like the two earlier ones it is corrected by measurement and left to the mission agent.

**Checks:** `pnpm run verify:fast` green. Nothing of this owner ships, so the portion releases
nothing. This turn touched plans, the tracker and the journal only — no code, no test, no gate file.

**Offered next:** the checks that drive the tool (C2, 739 — where the readers S1–S5 named for their
own texts finally meet them in one commit), or D1 (131, the workflows, templates and dotfiles, two of
them gate files), whichever reading of the order the mission agent prefers.

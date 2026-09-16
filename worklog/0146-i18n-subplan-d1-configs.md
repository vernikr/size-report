# 0146 — subplan D1, W3 folded, N24 decided

Requested: the next subplan by the fixed order (D1, the declarative files), plus two documentary
decisions — fold W3 into W1 if the measurement confirms it, and record N24 as "the skip words stay
Russian".

## `configs.md` (D1) — written

Scope measured file by file: **131 lines gross = 127 this owner's own + 3 allow-listed + 1 English
comment.** The allow-listed three: `templates/size-report.config.json`'s `title`/`heading` (measured:
the same string as `src/locales.js:8`'s `heading`, so translating them gives a `locale: "ru"` project
a page titled in English) and `отложено` in `DEBT_TERMS` (a term the linter matches, not a message).
No hole in this owner: `.jscpd.json`, `.c8rc.json`, `eslint.config.js` and `.eslint-suppressions.json`
carry no Cyrillic, and `coverage-baseline.json`'s one line is W2's.

Its readers, measured: **six** workflow step names are read as literals by `test/release.test.js`
(62, 66, 101, 114, 127, 132) — not two, as the tracker's note said; `release.yml` must keep its own
basename (the check requires the file to name itself, and today it does so inside a comment);
`$GITHUB_REF_NAME`/`$WANT` and four `run:` commands are matched; `.gitignore` is read by pattern;
`ci.jobs.verify` is a branch-protection contract outside the tree. **No negative match in this
owner** (measured). Four of its files are gate files, so six of its nine commits carry the trailer.

## W3 — folded into W1

The measurement confirms the mission's guess: after N21 the fixture builders have **one** line of
their own (`tools/synthetic/repo.js:74`, an internal error written into no file) and 88 that are the
reference's data. The map no longer promises a subplan for one line: the row is gone, the line is
W1's (whose subplan gained a step 7 and the file in its counter), and the map holds **thirteen**
subplans. Recorded as a fourth map correction, decided rather than measured.

## N24 — decided: `SKIP_WORDS` stays Russian

Option (3), on the same ground as N21: the references stay Russian, and moving the words into
`src/locales.js` (option 1) would change behaviour rather than a literal — a `locale: "en"` project
would start seeing English skip words. Recorded in `BLOCKERS.md` with the price of reversing it (one
constant plus three dictionary entries, reddening nothing, since the fixtures pin `ru`). S4's gated
step 4 is dropped and becomes a named exception of that owner for G1; the tracker's S4 row now reads
"83 free + 1 allowed".

Tracker numbers after both decisions: W1 **331** (of 349 + the folded line, minus N21's 19), D1
**127** (of 131), the `tools/**` family 452, the allow-list 2 889 plus the four named lines, the
census 5 512 — all sums re-checked.

Nothing released: plans and notes only, no line of them ships. N19 and N20 remain open.

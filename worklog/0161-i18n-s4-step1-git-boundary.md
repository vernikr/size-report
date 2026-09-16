# S4 step 1 — the git boundary and the two disk violations

Requested: keep item 5 going, one feasible portion per turn — step 1 of `diagnostics.md`.

Done, in one commit: `src/git.js` 3 → 0 (the shallow-history refusal with both ways out),
`src/history.js` 12 → 1 (the two `EXIT.VIOLATION` refusals of `assertMatchesDisk` and the `!` note of
`build`; the one left is `SKIP_WORDS`, N24). Readers moved with the text: the catalogue's
`EXIT.SHALLOW` case and both `EXIT.VIOLATION` cases (`must` phrases and the `coveredBy` advice
texts), `test/disk.test.js` 68 → 58 (ten assertion lines), `test/cli-paths.test.js`'s two markers,
and the quotations in `README.md` (3 → 2) and `BLOCKERS.md` (21 → 20). The advice markers
(`fix: `, `locally: `, `in CI: `) already sat in `ADVICE_LINE`'s tolerance, so no catalogue
machinery moved.

The reader the plan did not know, and the reason the first wording failed: the `!` note is printed on
**healthy** runs, and `checkFix` reads a healthy answer for the **other cases' `must` phrases**. The
first English wording ended "…update the table in a commit of its own", which is the `must` phrase of
the `size table diverged from the history` case — and this note's occasion *is* that case's advice.
The full run reddened it (`совет не починил состояние`); the wording is now "…update the table in a
separate commit", which also keeps `dup` quiet (the phrase belongs to `src/modes.js`, S1). Recorded
in `diagnostics.md` as a correction, with the rule: for a note printed on success, look for the other
cases' `must` phrases rather than the note's own words.

Also recorded there: `BLOCKERS.md:167` is a claim about what the tool prints now and moved with the
text; the two "before the fix" reproductions (`:148`, `:263-264`) stay, being records of what a
reader saw then. The comparison's text gained a colon (`in the tree: …`, `in the state: …`).

Red first, twice: the shallow line back to Russian reddens `test/refusals.test.js` on
`«коды выхода / EXIT.SHALLOW»: в отказе нет «the history is truncated (shallow clone)»`; the disk
violation's advice back to Russian reddens `test/disk.test.js` on the sliced advice line.

Sensors: `verify:fast` green (70 checks), the full `verify` green (eight steps, `test:all` 175,
`pack:check` byte-identical tarball report, `parity:live` and `check:standards` untouched — no
reference carries a message of this layer), `SITES` 27, `PRINTED` 2/2/1/2/4, `CASES` 38 unchanged.

Suggested next: steps 2 and 3 of S4 — the coverage and the explanation (`REASON_WORD` and
`REASON_TEXT` in one commit), then the doctor's text; the wash-up then answers only `SKIP_WORDS`.

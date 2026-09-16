# S4 step 2 — the coverage and the explanation

Requested: keep item 5 going, one feasible portion per turn — step 2 of `diagnostics.md`.

Done, in one commit: `src/check.js` 12 → 0 and `src/explain.js` 24 → 0. `REASON_WORD`
(`merges` / `report only` / `no change of volume`), the whole `coverageText` (the `✗`/`✓ coverage`
lines, the introducing commit, `… and N more`, the counts line, the wrapped reasons and the
`paths:` line), `REASON_TEXT`, `FIX`, the three refusals of `lookup` and the whole `explainText`.
Readers moved with the text: the four catalogue cases (`no such commit`, `ambiguous commit`,
`commit outside the history`, `покрытие неполно`) and fourteen assertion lines of
`test/check.test.js` plus one of `test/doctor.test.js`.

Two deliberate wordings. `REASON_WORD` and `REASON_TEXT` stay one vocabulary (`merges` /
`report only` / `no change of volume` against `the commit is a merge…` / `only the report itself
was touched…` / `the numbers did not move…`), while `FIX.flat` says `the volume did not change`
where the sentence says `the numbers did not move` — the Russian pair was two words too
(`не изменились` / `не сдвинулись`), and the variation keeps `dup` quiet. `FIX.report` says
`update the report separately` rather than "in a commit of its own", which is the `must` phrase of
the `size table diverged from the history` case: step 1 paid for that lesson with a full run, and
here it was applied before the run rather than after it. `REASON_WORD`'s `report only` and
`no change of volume` now differ from the frozen `SKIP_WORDS` — the consequence N24 recorded: the
`--json`/`--data` answers keep one Russian word per skipped commit while the summary line is English.

Found by measurement: `test/check.test.js:235` asserted `!/нет такого коммита/`, which is the **cause
name** S1's step 3 renamed, not a printed message (`refuseCause` prints the message alone) — the
negative had been passing on nothing since that step. C2's rule moved it to the phrase of the sibling
answer (`!/is not a revision name and not the start of a sha/`), and the experiment says what it is
worth: with the outside-history branch switched off, the test catches the mistake one line earlier, on
the positive at `:232` (`✗ "side" is not a revision name and not the start of a sha`), so the negative
is a second line of defence. Recorded in `diagnostics.md` with the rule for the remaining subplans:
check the old phrase still prints before trusting a negative.

Red first, three measurements: `REASON_WORD.report` back to Russian reddens `check.test.js` on
`в тексте нет сводки по причинам`; `REASON_TEXT.flat` back reddens it on
`— no row needed: числа не сдвинулись…`; `FIX.flat` back reddens it on
`предложена починка там, где починять нечего`.

Which lines read nothing, measured rather than guessed: the counts line (`history: N commits, M rows,
without a row K`), the `… and N more` tail, the `paths:` line and every label of `explainText`
(`commit`, `the row is there`, `no row needed`, `columns touched`, `excluded by the settings`,
`past the columns and the exceptions`) were put back to Russian together, and the **whole profile
stayed green** (eight steps, `test:all` 175). The reader the tree does have here is the catalogue and
the assertions on the `✗`/`✓ coverage` line and the `fix:` marker: those redden
(`test/doctor.test.js:67`, `test/check.test.js:52`). So for step 3 the useful question is the same
one asked this way — put the words back and see whether anything at all reddens, over the whole
profile rather than one file.

Sensors: `verify:fast` green (70 checks), the full `verify` green (eight steps, `test:all` 175,
`pack:check` byte-identical tarball report, `parity:live`, `check:standards`), `SITES` 27,
`PRINTED` 2/2/1/2/4, `CASES` 38 unchanged. No reference carries a message of this layer.

Suggested next: step 3 — the doctor's text (`src/doctor.js`, 33 lines) and its readers, after which
the wash-up over the five files answers `SKIP_WORDS` alone.

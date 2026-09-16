# S4 step 3 — the diagnostics, and S4 closed

Requested: keep item 5 going, one feasible portion per turn — step 3 of `diagnostics.md`, and close
S4 in the same portion if the measurement supports it.

Done, in one commit: `src/doctor.js` 33 → 0. The verdict line (`: diagnostics for <root>`), the whole
environment block (`environment:`, `git is unavailable`, `, the history is truncated` /
`, the history is complete`), the pins line (`git is read with the pins: …; locale …`), the settings
line (`settings:`, `derived from the project (no file)`, `columns, metrics`, `— unreadable`), the
dependencies line (label, `present`/`absent`, both notes — `not asked for: "minify" counts by
stripping` and `not asked for: the metrics are …`), `UNREADABLE`, the `hook:` label, every word of
`hookLine` (`not installed (installed with the command …)`, `it has not run yet`, `the last run …`,
`(switched off by the settings)`), all six `HOOK_RESULT` words, the two hook findings and their
fixes, the finding about coverage that was not counted, the derived-settings fix
(`make them a file of their own: `), and the findings' `fix: ` marker. Marks (`✓`, `✗`, `·`) and the
order of the blocks are untouched, so the `PRINTED` map still finds its two `✗` marks in this file.
Readers moved: `test/doctor.test.js` (the `— unreadable` tail and the tokens note),
`test/hook.test.js:313,315` (`/хук/` → `/hook/`, both read the finding's own word).

Two wordings chosen against a red rather than after one: the derived-settings fix is
`make them a file of their own: `, distinct from S2's `pin them with a file of their own (…): ` as
the Russian pair was (imperative against infinitive) — `pnpm run dup` guards the distinction; and the
tokens note keeps `not asked for` as the same opener as the minify note, which is what the Russian had.

**S4 is closed.** Step 4 was dropped by N24's decision, and the wash-up answers exactly the named
exception: `rg -cP '[\p{Cyrillic}]' src/git.js src/history.js src/check.js src/explain.js
src/doctor.js` → `src/history.js:1` (the three `SKIP_WORDS`) and nothing for the other four. All
three steps landed with a full profile green and without touching a reference.

What the step measured about its own readers, and it is the strongest of the four subplans: doctor.js
was put back to Russian **except the four literals that have readers**, and the whole profile stayed
green (eight steps, `test:all` 175). So the verdict line, the environment block, the pins line, the
settings labels, the dependencies labels, every word of `hookLine`, all six `HOOK_RESULT` words,
`UNREADABLE`, the coverage finding and the fix wording have no reader anywhere in the tree. The two
dependency notes are not a pair: the reader (`test/doctor.test.js:261`) sits on the tokens one, and
the minify note was still Russian in the green pass — only the grep names it. Red first three times:
`— нечитаемы` reddens `test/doctor.test.js:133` (`ответ умолчал, что настроек нет`); the two hook
findings redden `test/hook.test.js:314,349`; and moving the `✗` mark to `✕` reddens
`test/refusals-catalog.test.js` on `число отказов со знаком «✗» разошлось с картой PRINTED`, which is
the proof that the marks are counted rather than decorative.

Handed on: S5 is now the only module of `src/**` printing a Russian advice marker
(`src/hook.js:156,164,171,247`), so N28's condition is one subplan away. `ADVICE_LINE`'s tolerance was
deliberately **not** narrowed — the plan puts that in W1's step 8 (N28), and narrowing it now would
only move the debt. The remaining Cyrillic of `src/**` is the named exceptions only: `src/locales.js`
and the `ru` sides of `src/metrics.js` (data, N19/N24), the comment at `src/metrics.js:61-63` and the
three words of `src/page/panel.js` (N25, S5's decision).

Counters: `src/doctor.js` 33 → 0, `test/hook.test.js` 113 → 111, `test/doctor.test.js` 82 → 82,
`tools/refusals.js` 61 → 61 (no catalogue case prints a text of this file); `SITES` 27,
`PRINTED` 2/2/1/2/4, `CASES` 38 and the check count (70 fast, 175 full) unchanged.

Sensors: `verify:fast` green, the full `verify` green (eight steps, `pack:check` byte-identical tarball
report, `parity:live`, `check:standards`). Nothing that ships was left untranslated by accident: the
whole profile is green with the exceptions named above.

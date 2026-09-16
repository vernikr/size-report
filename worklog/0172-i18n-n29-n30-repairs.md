# 0172 — N29 and N30: one implementation of `firstDiff`, one right word form

**Request.** The mission agent's decision on the two blockers in one commit: take the copy of
`firstDiff` out of `tools/parity-live.js` in favour of the shared one in `tools/harness.js`, and make
`plural` return the singular only for exactly one. Both are code changes rather than translations, so
each is recorded in `BLOCKERS.md` with the price and the measurement that shows the price was paid.

**Done — N29.** `tools/parity-live.js` imports `firstDiff` beside `collectOutput, gitIn` and its own copy
is gone, with the three Russian literals that lived in it (three more in the shared one stopped being a
blocked exception and are English now). Measured after the repair: `pnpm run dup` answers **8 clones,
47 lines** where it answered 10 and 62, and it stays green — the baseline's stale fingerprint for the
removed twin simply is not found, which is what the baseline is for. The tool that prints a diff still
works: `parity:live` is green over both environments with the shared function, and the shared one
answers `line 2\n    in the output: "bb"\n    in the reference: "cc"` when driven by hand. The price is
cosmetic and unread: the copy indented its continuation lines six spaces.

**Done — N30.** `plural(n, one, many)` returns the singular only for `n === 1`; the `few` slot went with
the Russian rule that branched on the last digit, and both call sites pass two words. Measured from the
file's own text: `0 checks`, `1 check`, `2 checks`, `4 checks`, `5 checks`, `11 checks`, `21 checks`,
`22 checks`, `24 checks`, `31 checks`, `70 checks`, `101 checks` — the class that was wrong (21, 31, 101)
is right, and the runner's own summary line reads `✓ fast run: 70 checks, failures 0`. The comment above
the helper now says what the two forms are and quotes no Russian, so the word half of
`tools/run-tests.js:40` stopped being an exception; the comma half stays with **N26**, and `TODO.md`'s
entry for that line was narrowed to say so.

**Counters.** The twelve files of W1 read **23** (was 30): 16 lines of `manifestNote` and 3 fixture
config values by N21, 3 lines of `docs-facts.js` (2 pinned section names and the comment naming them),
1 prose comment. `tools/**` reads **226**. Untouched: `SITES` 27, `PRINTED` 2/2/1/2/4, `CASES` 38, 70
checks in the fast run and 175 in the full one, artifact hash `1bdb27e1…`.

**One correction made in this portion.** The acceptance bullet of `tools.md` counted `docs-facts.js`'s
comment twice and summed to 24 while the counter answers 23; the arithmetic is now spelled out line by
line, and a duplicated line of the same file was removed while it was in hand.

**Green.** `verify:fast` (5 steps) and the full `verify` (8 steps) both green, `parity:live`,
`check:standards`, `pack:check` green, the report from the tarball byte-identical (66 277 B). None of the
changed files is a gate file (`tools/gates/gatefiles.js`), so the commit carries no `Gate-Change:`
trailer — the hook prints that itself. The instruments ship nothing, so there is nothing to release for
this commit; the release cadence is **N20** and stays the user's call.

**Left.** Subplan W2 (the sensors, `tools/suites.js`, `.githooks/**`; every commit there is a gate file),
C1–C3 (the checks) and D1 (the declarative files).

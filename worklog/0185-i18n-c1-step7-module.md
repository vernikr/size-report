# 0185 — i18n C1 step 7: `test/module.test.js`, and C1 closed

Requested: point 5 of the i18n campaign, step 7 of `docs/plans/2026-09-16-i18n-english/tests-page.md`
— the module check's own words — and closing C1 if the measurement confirms it.

Done (`test/module.test.js` 58 → **7**, 51 names and messages):
- Two test names and forty-nine assertion messages; the seven lines that stay are the fixture's data.
- Red first, one phrase at a time: all **44** pairs back to Russian on their own, `node --test
  test/module.test.js` green every time — no machine reads a check's words.
- The five joint lines (other owners') and `:163` were **not touched**: the diff over the file carries
  only lines that held Cyrillic.
- Both negative matches re-checked on their own paths. `:195` (a refusal in hand): a temporary probe
  pushing `stripper` into `src/minify.js:54`'s printed text reddens the `jsx-in-js` check and leaves the
  module-in-`.js` check green; the file was restored byte-identical. `:120` (healthy path): its stderr
  is really **201 bytes** (the hook note), so the match is a bound on text, not a vacuous line.
- The seven that stay: a JS sample's comment and its greeting strings, the git identity `Тест` and two
  commit subjects — written and read by the check itself.

Measured after: `dup` green (8 clones, 47 lines, 15 fingerprints), `fixtures/parity/artifact.sha256`
`cdda8d01…` and the built page 66 427 B — both unchanged; `verify:fast` green, full `verify` (8 steps)
green; no gate file in the portion, so no `Gate-Change:` trailer.

C1 is closed: the counter over its nine files answers **18**, all of it data proved by experiment step by
step (`runner` 5, `guard` 1, `contract-derived` 1, `contract-data` 1, `page-tree` 1, `page-choice` 1,
`page-view` 1, `module` 7); checks unchanged (44 / 70 / 175). Left in the campaign: C2, C3, D1. Open with
the user: N19, N20, N21, N24, N31, N32.

Suggested: nothing new this portion. The only open findings stay as recorded — N31 (the `dup` baseline
holds seven tolerable stale fingerprints) and N32 (the coverage ratchet is red on the tree, thirteen
falls, and the scheduled workflow has never run).

# 0170 — i18n W1 step 6: the console of the two fixture builders

**Request.** Point 5, portion of the turn: step 6 of subplan W1 — the 29 console lines of
`tools/parity-freeze.js` and `tools/make-fixture.js`, while the 19 allowed Russian lines (16 of
`manifestNote` and 3 config values of the fixture) stay by N21. Only literals; N29, N30, N21 and N20
were not approached; full `verify` before the push; `dup` asked its own question.

**Done — 29 lines, 15 + 14.**

- **`tools/parity-freeze.js` 31 → 16**: the six thrown messages (the copy that did not run, the
  project not found, the truncated history, the revision the project does not have, the revision
  without the settings file, the copy that built another artifact) and the five console lines of the
  announcement (`✓ the parity reference: …`, the project, the artifact with its sha, the tool tied to
  this revision).
- **`tools/make-fixture.js` 17 → 3**: the four thrown messages and the ten console lines (`✓ the
  fixture: …`, the commits and the bundle's size, the reference, the tool, the locale warning, the
  temporary directory).
- **The 19 allowed lines stand word for word**, and the reason is measured rather than assumed: both
  builders write the frozen layer — `parity-freeze.js` writes `README.md` from `manifestNote(ctx)`,
  `make-fixture.js` writes `config.json` from `CONFIG` — so translating them re-takes both references.

**The measurements this step was asked for.**

- **No translated word reaches a frozen byte.** The builders were run into a scratch directory and
  compared with what is committed: `node tools/make-fixture.js --out …` answers **byte-identically to
  `fixtures/synthetic`, file by file**. `node tools/parity-freeze.js fixtures/live/history.bundle
  --out …` differs from `fixtures/parity` in exactly two files — `manifest.json`, whose `name`/`path`
  record the path the reference was taken from (the difference the plan names as legitimate), and
  `README.md`, **in one interpolated word of the same field**: `Проект: `history.bundle`` against
  `Проект: `safe-resets``. The Russian template is untouched word for word.
- `fixtures/**` is unmodified in the tree; `fixtures/parity/artifact.sha256` still reads `1bdb27e1…`;
  the built page is byte-identical to the committed one.
- **Red first:** both builders returned to Russian together leave the **full `verify` — eight steps —
  green**, so no check and no sensor reads a word of them; the re-takes inside that run also prove the
  frozen layer is indifferent to the wording.
- The English console was taken live: `✓ the fixture: … 16 commits, HEAD 16b2fe8, bundle 8920 B`,
  `the reference: 14 rows × 10 columns, 2 commits without a row, artifact 22112 B`, and
  `✓ the parity reference: … the project history.bundle at bd6ef9d: 149 commits, 95 rows × 27 columns`.
- `pnpm run dup` answered no new twin (10 clones, 15 fingerprints).

**Counters.** `make-fixture.js` 17 → 3, `parity-freeze.js` 31 → 16, the twelve files of this owner
114 → **85**, `tools/**` 288. `SITES` 27, `PRINTED` 2/2/1/2/4, `CASES` 38, 70 fast / 175 full checks,
artifact 66 277 B byte-identical, both references reproduced.

**Left in W1.** Step 8 alone among the steps — the catalogue's 55 lines and the narrowing of
`ADVICE_LINE`, whose condition is met — plus the decisions N29 (six literals) and N30 (one line). After
step 8 the counter should answer exactly **31**, every line of it named.

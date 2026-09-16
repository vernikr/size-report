# 0166 — i18n W1 step 2: the YAML parser's throws and the page harness

**Request.** Point 5, portion of the turn: the step of subplan W1 that follows `tools/harness.js`
(step 2 by `tools.md`: `tools/yaml.js` + `tools/page-harness.js`). Only literals; no behaviour, no
counters; non-translation changes to `BLOCKERS.md`; state by measurement which of these lines have
readers among the checks or the artifacts; keep N29's three literals where they are and do not
decide N29; ask `dup` its own question — a translation can make a new twin, as `firstDiff` did; one
commit, full `verify` before the push.

**Done.**

- **`tools/yaml.js` 10 → 0**: the eight throws of the parser — the indent or the trailing spaces,
  the block scalar, the colon with a space in an unquoted value, the open flow list, `neither a key
  nor a list item`, `the list item is not a mapping`, `the indent is deeper than expected`, `the
  parse ended at line`. The comments and the shapes (which line, which fragment of the source) are
  untouched.
- **`tools/page-harness.js` 3 → 0**: `the tool gave no --data (code …)`, `the tool did not build the
  report: …` and `the report did not appear at the path from the settings: …`.
- **Red first, two ways.** (a) Both files were returned to Russian together and the **full** profile
  stayed green — 175 checks, 0 failures — so no check reads a word of them; the near duplicates of
  that wording elsewhere (`test/parity.test.js:32,41`, `tools/make-fixture.js:127,150`) are not
  readers either: a single-line message cannot form a clone at 50 tokens and 5 lines. (b) The
  messages were taken by hand with a deliberately broken workflow: a block scalar, an unquoted
  `? … : …`, a bad list item and an open flow list each answered with the new English sentence.
- **`dup` asked its own question and answered no new twin** — “новых клонов нет (клонов 10, в базе
  15 отпечатков)”. The N29 pair (`firstDiff` here and in `tools/parity-live.js`) is untouched by
  this step and its three literals were left exactly as they were; `dup-baseline.json` was not read
  as a way around anything.

**Counters.** `tools/yaml.js` 10 → 0, `tools/page-harness.js` 3 → 0, the twelve files of this owner
235 → **212**, `tools/**` 415. `SITES` 27, `PRINTED` 2/2/1/2/4, `CASES` 38, checks 70 fast / 175
full, artifact 66 277 B byte-identical.

**Left in W1.** Steps 3–8, 187 lines minus N29's three: `run-tests.js` 25, `check-standards.js` 21 +
`pack-check.js` 21 + `parity-live.js` 35 (step 4 — it holds N29's other half), the comment in
`docs-facts.js`, the console lines of `parity-freeze.js` + `make-fixture.js`, `synthetic/repo.js:74`,
and the catalogue's prose with the narrowing of `ADVICE_LINE`.

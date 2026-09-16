# 0168 — i18n W1 step 4: the verdicts of the three instruments

**Request.** Point 5, portion of the turn: step 4 of subplan W1 — `tools/check-standards.js`,
`tools/pack-check.js`, `tools/parity-live.js`. Only literals; N29 and N30 are the user's decisions, so
`dup-baseline.json`, `plural` and `firstDiff` were not touched, and in `parity-live.js` everything
outside that pair was translated while the remainder was named. Full `verify` before the push.

**Done — 74 lines.**

- **`tools/pack-check.js` 21 → 0**: the tarball's whole report — the built package, the `files` list
  from both sides, nothing foreign, `the package carries the sources/the templates`, byte-identical
  templates, module parsing through a thread rather than a launch, `--json` and the report against the
  repository, `✓ the package works from the assembled tarball`, `✗ checks failed: N`.
- **`tools/check-standards.js` 21 → 0**: the re-takes — `the re-take did not match the committed one`,
  the manifest field that diverged, the bundle's history and refs, `✓ the references reproduce, the
  working tree is untouched`, `✗ divergences: N`, the byte-difference line (`bytes: N B against M B`)
  and `… lines in all: N`.
- **`tools/parity-live.js` 35 → 3**: both environment labels, every contract error, the verdict lines
  and the closing summary (`✓ parity with the live project: … 95 rows × 27 columns, 2 environments`).
  The three left are `firstDiff` — exactly **N29**'s pair (`:79`, `:80`, `:83`) — and nothing else in
  the file was touched.

**Red first, and stronger than the plan's grep.** All three files were returned to Russian together,
and the **full `verify` — all eight steps, not only the tests — stayed green**: their interface is the
exit code. The English lines of each were taken by hand and quoted in the report to the user.

**The two questions the step was asked, measured.**

- No translated word is inside a compared artifact: `fixtures/parity/artifact.sha256` still reads
  `1bdb27e1…` and `docs/size-report.html` still hashes to `40eda37d…`; `check-standards` compares the
  fixtures it re-takes (byte for byte for our files, by content for git's bundle), and the page is built
  from the locale dictionary, which this portion did not touch. `check:standards`, `pack:check` and
  `parity:live` are green in the profile.
- `pnpm run dup` asked its own question: no new twin (10 clones, 15 fingerprints). A near-twin was
  measured rather than met: `tools/gates/run.js:42` (W2's) describes this step in almost the same words
  as `check-standards.js`'s last line — one line cannot form a clone at 50 tokens and 5 lines, and no
  guard compares them; it is named in the plan for W2.

**Counters.** `pack-check.js` 21 → 0, `check-standards.js` 21 → 0, `parity-live.js` 35 → 3 (N29), the
twelve files of this owner 189 → **115**, `tools/**` 318. `SITES` 27, `PRINTED` 2/2/1/2/4, `CASES` 38,
70 fast / 175 full checks, artifact 66 277 B byte-identical, both fixture references reproduced.

**Left in W1.** Steps 5–8 and N29's six lines: the comment in `docs-facts.js`, the console lines of
`parity-freeze.js` (15 of 31; 16 are the allow-listed `manifestNote`) and `make-fixture.js` (14 of 17;
3 are the fixture's own config values), `synthetic/repo.js:74`, and the catalogue's prose with the
narrowing of `ADVICE_LINE`. Two decisions are still on the mission agent's table: N29 (two variants)
and N30 (one line).

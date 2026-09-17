# 0192 — step 6: the pasted program and styling carry no comments

Requested: implement step 06 (`06-strip-comments.md`) of `plans/2026-09-17-page-perf/` exactly by its
acceptance criteria — nothing beyond it, step 07 not started, nothing committed. Two conditions on top of
the plan, both from the accumulated context: **the sources must survive** (the squeeze touches only what is
pasted into the artifact, not the repository's readable code), and **the build must stay reproducible**
(two `--write` runs give the same md5, and the encoder/decoder round trip keeps reading the decoder from
disk).

## What changed

- **`src/page/build.js`** — `squeezedJs(code)` and `squeezedCss(css)`: `stripJs` / `stripCss` then
  `stripLines` from `src/strip.js`, the same stripping the `min` metric counts. `pageScript()` glues the
  chapters, strips the module syntax and squeezes **in that order** — the module stripping works line by
  line and a comment could otherwise hide a line's shape — then guards the result with
  `assertCompilable(code, '', 'the page’s program')`. `pageHtml()` squeezes both stylesheets the same way.
- **`src/strip/guard.js`** — the revision in the guard's failure message became optional: the assembler
  squeezes a text it built itself, so there is no revision to name it by. Everything else is untouched —
  one home for “the squeeze left something that is not code”.
- **The sources are untouched.** `src/page/*.js`, `src/derived.js`, `src/table.css` and `src/page/app.css`
  keep their comments, indentation and linting; only the copy inside `docs/size-report.html` is squeezed.
  `pageSource()` still returns the stripped-but-read text, which is what the page's suites read from disk.
- **`test/page-view.test.js`** — the checks around the paste were adapted rather than dropped: the program
  is compared with the squeezed computation, the styling with the squeezed stylesheets, and the name
  extractor reads `^[ \t]*function` because the squeezed text has no indentation. Two promises of the step
  became assertions inside existing checks: the pasted program holds no `/*` and no line starting `//`, and
  the pasted styling holds no comment **and is not the file itself** (`squeezedCss(TABLE_CSS) !== TABLE_CSS`)
  — which is what says the squeeze happens on the way in, not in the readable source.
- **`README.md`** — the module table's row for `src/page/build.js` says the pasted text is squeezed on the
  way in, and the architecture section gained the paragraph on what “squeezed” means (58 922 → 24 885 B of
  program, 15 505 → 5 905 B of styling, the artifact 166 305 → 122 668 B) with the guard named.

## Measured (2026-09-17, this repository; “before” is the artifact built by steps 01–05)

| | before | after |
|---|---:|---:|
| the pasted program | 58 922 B | **24 885 B** |
| the pasted styling (`table.css` + `page/app.css`) | 15 505 B | **5 905 B** |
| `docs/size-report.html` | 166 305 B | **122 668 B** (−43 637 B ≈ 42.6 KiB) |
| the fixture's artifact (`pack:check` prints it) | 81 701 B | 38 064 B |

The plan promised 68.4 → 25.5 KiB of JS+CSS; it came out 74 427 → 30 790 B, that is −42.6 KiB against the
promised −42.9 — 86 % of the reachable saving with no new dependency, exactly the plan's arithmetic. The
plan's rung “153 → 110 KiB” for the whole artifact does not match, and the reason is not this step: of the
remaining 122 668 B, 88 712 B is the sparse data block, and the pasted program is bigger than the one the
report measured (steps 02–05 grew it).

## Checks

`pnpm run verify:fast` green through its 5 steps, **77 checks of 182** — unchanged, because the new promises
are assertions inside existing checks rather than checks of their own. `pnpm run verify` green through its 8
steps (parity with the live project, the reproducibility of the standards, the tarball). The page suites
(10 + 6 + 9 checks) run over the squeezed text, and the paste's own guard was probed rather than trusted:
making the stripper eat code (a block comment swallowed to the end of its line) stops
`node bin/size.js --write` with «the stripper broke the page’s program: Unexpected token '*'»; the probe was
reverted and the sources are byte-identical afterwards.

Reproducibility as the user asked: two `--write` runs give the same bytes (md5 `ad86a408…`), and the round
trip is untouched — `pageDecode` still evaluates `src/page/payload.js` from disk.

By hand in Chrome, the artifact built before and after this step (same tree, `file://`, a fresh isolated
context so no remembered choice interferes), the same fingerprint on both: 217 rows, 174 468 cells, 183 048
nodes, total at HEAD 2 663 829. `getComputedStyle` identical for a delta up (rgb(30, 132, 73)), a delta down
(rgb(192, 57, 43)), a gap cell, the sticky header, the commit column, the sticky category row and the panel;
`border-collapse: collapse`, `table-layout: auto`, the commit column 315 px and a data row 24 px on both
sides. The styling survives as styling rather than as text.

## Left as assertion

- **That the squeezed text has no comments left anywhere I did not assert.** The two assertions look at the
  artifact's inline program and at the pasted styling; the report is one file with no other style or script.
- **Parsing cost.** I did not re-measure the page's parse/compile time before and after the squeeze — a
  third of the pasted text is gone, so it should be cheaper, but the number I have is from step 05's run,
  not a before/after of this step.
- **The fixture's numbers** come from `pack:check`'s printed size, not from a page opened on it.

Nothing is committed and nothing is released: the artifact on disk was rebuilt by the local engine, and
`node_modules/@vernikr/size-report` still holds the released copy. Step 07 is next.

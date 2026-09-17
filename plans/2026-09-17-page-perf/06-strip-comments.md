# 06 — Comments out of the pasted program and CSS

Source: report §4.1 and §7 step 6. Independent of everything else. Low risk, deterministic.
State: **done** (2026-09-17) — what it is in code, what was measured and how the acceptance answered are at the
end of this file.

## Why

The program and the styling are pasted into the artifact verbatim, and a third of what is pasted is
explanation meant for a developer reading `src/`. Measured (`asset-weight.mjs`):

| Step | JS | CSS | Together |
|---|---:|---:|---:|
| Today | 49.6 KiB | 18.8 KiB | 68.4 KiB |
| Comments removed by our own code | 19.8 KiB | 5.7 KiB | **25.5 KiB** |
| esbuild minification | 13.5 KiB | 4.7 KiB | **18.2 KiB** |

Removing comments is **42.9 KiB of the 50.1 KiB reachable**: 86 % of the effect with no new dependency and
no change of behaviour. The sources stay readable and linted exactly as they are — only the artifact is
squeezed, and the builder already rewrites it while pasting.

## What to build

Order of the paste in `src/page/build.js` (`pageScript`, `pageHtml`): glue the chapters, strip the module
syntax, **then squeeze the text**, then insert it into the HTML. The squeeze has to come after
`stripModules`, because that pass works line by line and a comment could otherwise hide a line's shape.

- JS: the stripper that already exists for the `min` metric (`stripJs` + `stripLines` in `src/strip.js`,
  dispatched by `minifyForm`). It is ours, deterministic, and its failure mode is loud: the guard
  (`assertCompilable`) refuses a text it does not understand instead of guessing.
- CSS: `stripCss` + `stripLines`, from the same module.

Both are already the package's own code and are already exercised (`test/guard.test.js`,
`test/minify.test.js`), so the step adds no dependency and no new parser.

## Acceptance

- The pasted program still parses and behaves: the page's own suites (`test/page-view.test.js`,
  `test/page-tree.test.js`, `test/page-choice.test.js`, `test/parity.test.js`) run over the squeezed text, and
  the paste grows a guard that the assembler's output compiles (`assertCompilable` on the assembled program,
  or `node --check` through the existing harness).
- No comment survives: a check that the pasted program and styling hold no `/* */` or `//` line start —
  this is the promise of the step, so it is checked rather than assumed.
- The frozen list of names (`test/page-view.test.js` compares `function` declarations between the sources and
  the pasted text) still holds: the squeeze must not rename or drop a declaration.
- The artifact shrinks by ~43 KiB; `pnpm run verify:fast` green.

## Risks

- **A stripper that misreads our own text** (a `//` inside a regex or a string literal). The program is
  ours and small, and the guard catches a broken result at build time rather than in a browser; the paste
  also has to keep `stripModules`' rule that an `import` is one line.
- **The artifact's bytes change**, so the report of this repository is rebuilt in a commit of its own and
  the pin/checks are re-read afterwards.

## What it is in code

- **`src/page/build.js`** — `squeezedJs(code)` and `squeezedCss(css)` are the form the artifact carries: `stripJs` /
  `stripCss` then `stripLines` from `src/strip.js`, the same stripping the `min` metric counts. `pageScript()` glues
  the chapters, strips the module syntax and squeezes — in that order, because the module stripping works line by
  line and a comment could otherwise hide a line's shape — and then **guards the result**: `assertCompilable(code,
  '', 'the page’s program')`. `pageHtml()` squeezes both stylesheets in the same way.
- **`src/strip/guard.js`** — one line: the revision in the guard's failure message became optional, because the
  assembler squeezes a text it built itself and there is no revision to name it by. Everything else in the guard is
  untouched: one home for "the squeeze left something that is not code".
- **The sources are untouched.** The squeeze lives in the paste path and nowhere else: `src/page/*.js`, `src/derived.js`,
  `src/table.css` and `src/page/app.css` keep their comments, their indentation and their linting — they are what a
  person reads and edits, and only the copy inside `docs/size-report.html` is squeezed. `pageSource()` still returns the
  stripped-but-read text, which is what the page's suites read from disk.
- **`test/page-view.test.js`** — the checks around the paste were adapted rather than dropped: the program is compared
  with the squeezed computation (`squeezedJs(stripModules(derivedSrc))` at its start), the styling with the squeezed
  stylesheets, and the name extractor reads `^[ \t]*function` because the squeezed text has no indentation and its
  first line is no longer blank. Two promises of this step became assertions: the pasted program holds no `/*` and no
  line starting `//`, the paste styling holds no comment **and is not the file itself** (`squeezedCss(TABLE_CSS) !=
  TABLE_CSS`) — which is what says the squeeze happens on the way in rather than in the readable source.

## Acceptance answered

- **The pasted program still parses and behaves** ✓ — the page's suites (10 + 6 + 9 checks) run over the squeezed text,
  and the build itself refuses a broken result: probed by making the stripper eat code (a block comment swallowed to the
  end of its line) — `node bin/size.js --write` stops with «the stripper broke the page’s program: Unexpected token
  '*'». Probe reverted; the sources are byte-identical afterwards.
- **No comment survives** ✓ — the two assertions above; in the assembled page the program holds 0 block openings and 0
  `//` lines, and the pasted styling 0.
- **The frozen list of names still holds** ✓ — the same 70 declarations in the pasted program as in the chapters and the
  calculation, and the duplicate-name count beside it (step 05's guard) is unchanged.
- **The artifact shrinks by ~43 KiB; `verify:fast` green** ✓ — measured below: −43 637 B, and `pnpm run verify:fast`
  green through its 5 steps (77 checks of 182 — unchanged, because the new promises are assertions inside existing
  checks rather than checks of their own).

## What was measured (2026-09-17)

| | before | after |
|---|---:|---:|
| the pasted program | 58 922 B | **24 885 B** |
| the pasted styling (`table.css` + `page/app.css`) | 15 505 B | **5 905 B** |
| `docs/size-report.html` | 166 305 B | **122 668 B** (−43 637 B ≈ 42.6 KiB) |
| the fixture's artifact (`pack:check` prints it) | 81 701 B | 38 064 B |

Read honestly: the plan's estimate was 68.4 → 25.5 KiB (JS+CSS) and it came true almost exactly — 74 427 → 30 790 B,
−42.6 KiB against the promised −42.9. The plan's rung "153 → 110 KiB" for the whole artifact does not match, and the
reason is not this step: 88 712 B of the remaining 122 668 B is the sparse data block, and the artifact's code is
grown by steps 02–05 (a bigger program than the one the report measured). The squeeze itself is what it promised.

By hand in Chrome, the artifact built before and after this step (both from the same tree, `file://`, fresh isolated
context so no remembered choice interferes), the same fingerprint in both: 217 rows, 174 468 cells, 183 048 nodes,
total at HEAD 2 663 829; `getComputedStyle` identical for a delta up (rgb(30, 132, 73)), a delta down (rgb(192, 57,
43)), a gap cell, the sticky header and commit column, the sticky category row and the panel; `border-collapse:
collapse`, `table-layout: auto`, the commit column 315 px and a data row 24 px on both sides. The styling survives the
squeeze as styling rather than as text.

And the fixed point the user asked about: two `--write` runs give the same bytes (md5 `ad86a408…`), while the round
trip of the encoder and the decoder is untouched — `pageDecode` still evaluates `src/page/payload.js` from disk.
`pnpm run verify` green through its 8 steps (the live project's parity, the reproducibility of the standards, the
tarball). Nothing is committed: the artifact on disk was rebuilt by the local engine.

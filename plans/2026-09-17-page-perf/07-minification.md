# 07 — Minification: a decision, not a default

Source: report §4.2 and §7 step 7. **Decision step** — the recommendation is to take it only together with
a pinned dependency and a refusal to build without it, and otherwise not at all.
State: **decided — not taken** (2026-09-17). The measurement priced the recommendation rather than changing
it: the number, the reason and the condition that reopens the decision are at the end of this file.

## What it buys and what it costs

Measured: esbuild takes the pasted program and CSS from 25.5 KiB (step 06) to 18.2 KiB — 7.3 KiB of the
artifact, 110 KiB → 103 KiB. Behaviour is unchanged: `derived.js` 5 127 → 1 353 B, `rowModel` yields the
same cells for all 213 rows, `group(1234567)` and `cellParts(5, -3)` match.

The price is not the 7.3 KiB, it is the contract:

- esbuild lives in `optionalDependencies` and `src/optional.js` treats its absence as **a different count
  rather than a refusal**. If the artifact's assembly starts depending on it, a machine without esbuild
  builds **a different file** — and the report is rebuilt by the post-commit hook after every commit on
  whatever machine made the commit. The file would stop being a fixed point, which is the property the
  whole hook design rests on (`src/hook.js`, `test/hook.test.js`).

## The two ways to have it

1. **Pinned and required for the build.** The builder asks for esbuild and refuses to assemble the page
   without it (a refusal with a fix, not a fallback), while the *measurement* of the `min` metric keeps its
   existing optional behaviour. The pin is `esbuild: <exact version>` in `package.json` and the refusal names
   it. Cost: a page can no longer be built on a machine without esbuild — the price of determinism.
2. **Not taken.** 7.3 KiB against that price.

The recommendation: **(2) now, (1) if and when the artifact's weight matters enough to pay for it.** Below
100 KiB the report only recommends the compressed data block (step 08), which is larger than 7.3 KiB and
cheaper to explain.

## If (1) is taken

- `package.json`: `optionalDependencies` keeps the entry but the builder treats it as required; the version
  is exact and the lockfile pins it (a `Gate-Change:` trailer goes on the commit).
- `src/page/build.js`: minify the assembled program and CSS after `stripModules` (the order of step 06), and
  refuse with a named cause and a fix when the minifier is missing.
- A check that the assembled page's program is the minified one and that a build without the minifier
  refuses rather than silently pastes something else — the defect this decision exists to prevent.

## Acceptance

Whichever way is chosen: `pnpm test:all` green, the artifact rebuilt byte-identically from the history by
`--write`, and the chosen behaviour stated in `README.md` (the `minify.engine` row and the ladder of
weights).

## The decision: not taken (2026-09-17)

The number, taken in one run on this repository's own artifact (`docs/size-report.html`, 217 rows): the two
texts step 06 leaves in the paste, pushed through the **already installed** esbuild 0.28.2 with the settings
the `min` metric uses (`minifyWithEsbuild`: `charset: utf8`, `legalComments: none`):

| | squeezed (step 06) | minified | would save |
|---|---:|---:|---:|
| the pasted program | 24 885 B | 18 128 B | −6 757 B |
| the pasted styling (`table.css` + `page/app.css`) | 5 906 B | 5 102 B | −804 B |
| `docs/size-report.html` | 122 668 B | 115 107 B | **−7 561 B (7.4 KiB)** |

The plan promised 7.3 KiB and it is 7.4 — the saving scaled with the program the steps 02–06 grew. The call
costs 86 ms for the program plus 5 ms for the styling on every build, on the path the post-commit hook takes
after every commit; parse and compile in Node move 0.010 → 0.008 ms, which is nothing beside the artifact's
183 048 nodes.

**The price is the contract, not the kilobytes.** esbuild lives in `optionalDependencies` and its absence is
**a different count rather than a refusal** (`src/optional.js`, the `min` metric). The artifact is rebuilt by
the post-commit hook on whatever machine made the commit, so a builder that minifies when it can would build
**a different file** there and the report would stop being a fixed point — the property `src/hook.js` and
`test/hook.test.js` rest on. Buying determinism instead (way 1) means an exact pin and a page that cannot be
assembled at all on a machine without esbuild. 7 561 B, 6 % of the file, against either a machine-dependent
artifact or a build that refuses: not taken.

**What reopens it:** the artifact's weight becoming the reason in itself — a consumer with a size budget, or a
step whose bytes would be freed by it — and then only in way (1): pinned, exact, refusing, with the check
that a build without the minifier refuses rather than silently pastes something else. Step 08's compressed
data block is the larger and cheaper win (103 → 62 KiB by the report) and does not touch this contract, so it
comes first; if the weight still matters after 08, the number above is the one to weigh.

## What was measured, and what stayed an assumption

Measured: the weights above in **bytes on disk** (not characters — the artifact is Russian, and the
difference is exactly what the removed comments and air were worth); and the behaviour of the hand-spliced
minified page in jsdom against the artifact as built, both over this repository's own history: the same 217
rows, 174 468 cells, **183 048 nodes**, 310 panel fields, the same text of the “now” row before and after
switching the first metric off (equal hashes), the same panel text. The splice was a string replacement of
the two texts inside the built artifact, checked to have landed exactly once: the builder was not touched, no
dependency was added, and the probe (a script under `reports/`, ignored by git) was deleted after the run.

Assumed rather than verified: that esbuild preserves behaviour **in a browser** — the comparison is jsdom's,
and computed styles were not part of it (step 06 did that comparison for the squeeze itself, the minified text
was not put through it); that minified names stay local to the pasted program (nothing outside it refers to
them — reasoned, not proven by a page suite run over a minified build); and the exact pin and the refusal of
way (1), which were never written, so their cost is read from `src/optional.js`'s design rather than paid.

To repeat the measurement: `minifyWithEsbuild(pageScript(), 'page.js', rev)` and
`minifyWithEsbuild(squeezedCss(TABLE_CSS) + '\n' + squeezedCss(PAGE_CSS), 'page.css', rev)`, replace those two
texts inside the built artifact, and weigh the result — the artifact's programme and styling occur in it once
each, which is what the run asserts before splicing.

Acceptance as closed: no code changed, so `pnpm test:all` and `pnpm run verify:fast` are green as they
stood, and the artifact is still the fixed point it was (`--write` gives the same md5, `ad86a408…`).
`README.md` states the decision beside the squeeze it is about, in the architecture section rather than in the
settings table: `minify.engine` there describes what counts the `min` metric of a measured file, and the page
that `src/page/build.js` pastes is not measured by that metric — it is assembled.

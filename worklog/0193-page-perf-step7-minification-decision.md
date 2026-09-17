# 0193 — step 7: minification decided against, with the number it would have bought

Requested: close step 07 of `plans/2026-09-17-page-perf/` as the decision it is, with proof — if the
minifier is not taken, measure in one run what it would give on top of step 06 (without touching the build and
without adding a dependency, then revert) and write into the step's file the closed decision with its number,
its reason and the condition that reopens it. If it were taken, the assembly had to stay free of the
optional/required dependency question and keep the fixed point. Nothing committed, the base not touched (the
drifted `origin/main` only recorded), step 08 not started.

## The decision: not taken

esbuild (0.28.2 — already installed, it is the `min` metric's optional dependency) on the two texts step 06
leaves in the paste, with the metric's own settings:

| | squeezed (step 06) | minified | would save |
|---|---:|---:|---:|
| the pasted program | 24 885 B | 18 128 B | −6 757 B |
| the pasted styling | 5 906 B | 5 102 B | −804 B |
| `docs/size-report.html` | 122 668 B | 115 107 B | **−7 561 B (7.4 KiB)** |

The report's own estimate was 7.3 KiB; it is 7.4, and the plan's ladder rung (110 → 103 KiB) holds. Cost of the
call: 86 ms for the program plus 5 ms for the styling per build — on the path the post-commit hook takes after
every commit. Parse and compile in Node move 0.010 → 0.008 ms, which is nothing beside the artifact's 183 048
nodes.

**Why the bytes are not worth it:** esbuild is an optional dependency, and its absence is *a different count
rather than a refusal* (`src/optional.js`, the `min` metric); the artifact is rebuilt by the post-commit hook
on whatever machine made the commit, so a builder that minifies when it can would build **a different file**
there and the report would stop being a fixed point — the property `src/hook.js` and `test/hook.test.js` rest
on. The other way, making it deterministic, means an exact pin and a page that cannot be assembled at all
without esbuild. 7 561 B — 6 % of the file — against either a machine-dependent artifact or a build that
refuses.

**What reopens it:** the artifact's weight becoming the reason in itself (a consumer with a size budget, or a
step whose bytes it would free), and then only pinned-and-refusing, and only after step 08 — the compressed
data block is the bigger and cheaper win (103 → 62 KiB by the report) and leaves this contract alone.

## How the measurement was taken, and what it does not prove

The two texts were pulled from the **built artifact** (each checked to occur in it exactly once) rather than
from the builder, pushed through `minifyWithEsbuild`, spliced back by string replacement, and the result
weighed in **bytes on disk** (not characters: the artifact is Russian, and the difference is exactly what the
removed comments and air were worth). The minified page was then opened in jsdom beside the artifact as built,
both over this repository's own history, and compared: the same 217 rows, 174 468 cells, **183 048 nodes**,
310 panel fields, the same text of the “now” row before and after switching the first metric off (equal
hashes), the same panel text. The probe was a script under `reports/` (ignored by git) and was **deleted after
the run** — the tree carries the decision, not the probe; the recipe stays in the step's file.

Not proven, and said so in the file: that esbuild preserves behaviour **in a browser** (the comparison is
jsdom's, without computed styles — that comparison was made for the squeeze itself in step 06, not for the
minified text); that minified names stay local to the pasted program (reasoned, not run through a page suite
on a minified build); and the cost of the pinned-refusing way, read from `src/optional.js`'s design rather than
paid.

## Files and checks

Only documentation changed: a paragraph in `README.md` beside the squeeze it is about (the settings table's
`minify.engine` row is about what counts a *measured* file, and the page's program is assembled rather than
measured), the decision sections in `plans/2026-09-17-page-perf/07-minification.md`, the state `decided: not
taken` in the plans index with the legend that explains the word, and this entry. No source, no test, no
sensor config, no gate file — the artifact is still the fixed point it was (`ad86a408…`), and the build is
untouched.

`pnpm test:all` was red once on `test/docs-paths.test.js`, and by the rule it was the documentation that was
wrong, not the check: the README named the step's file under `plans/`, which is not in the tree yet (`git
ls-files` cannot see an untracked directory), so the pointer was reworded to name the plan without a path.
With that, `pnpm test:all` and `pnpm run verify:fast` are green.

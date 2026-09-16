# 0159 — S3 step 2: the two refusals of the measurement

Requested (point 5 of the work): S3's step 2 — the minifier's refusal (`src/minify.js`), the guard's
(`src/strip/guard.js`) and the parse worker's fallback reason (`src/parse.js`), which lands inside the
guard's sentence, hence one commit.

## What changed

- `src/minify.js` — `esbuild did not parse <file> at <sha>: <reason>` plus `fix: the extension lied
  about its content or the minifier is older than the syntax; give this extension a simplification in
  minify.ext (for example {".ts": "strip-lines"})`. `ext` is still substituted as before.
- `src/strip/guard.js` — `the file <path> is not JavaScript: its source text parses neither as a script
  nor as a module, so the stripper is not to blame, while <ext> stands in minify.guard: <reason>` plus
  `fix: remove this extension from minify.guard or give it minify.ext — for example { ".js":
  "strip-lines" }`. (This sentence is still step 3's internal error below it; that one is untouched.)
- `src/parse.js` — the fallback reason `the module does not parse`.

Shape kept in both: the cause first, then `fix: <what to edit>`, and the settings keys spelled as a
file spells them (`minify.ext`, `minify.guard`) — `test/templates.test.js` and
`tools/docs-facts.js`'s `usageFlags` are why a key's spelling is never paraphrased.

## Readers moved with the text

| Reader | Change |
|---|---|
| `tools/refusals.js`, case `file is not JavaScript` | `must` `['не JavaScript']` → `['is not JavaScript']`; its `coveredBy` advice text → `remove this extension from minify.guard` |
| `tools/refusals.js`, case `minifier did not parse` | `must` `['esbuild не разобрал']` → `['esbuild did not parse']`; advice text → `give this extension a simplification in minify.ext` |
| `test/module.test.js:197` | `/esbuild не разобрал src\/view\.js/` → `/esbuild did not parse src\/view\.js/` |
| `test/module.test.js:205,223` | the two advice strings quoted from the refusals |
| `test/module.test.js:218` | `/не JavaScript/` → `/is not JavaScript/` |
| `test/doctor.test.js:208` | `/не JavaScript/` → `/is not JavaScript/` — **a reader the plan listed and a caution the plan raised against it**; measured: `doctor` prints the refusal as its finding and never prints the fixture's commit subject, so the pattern was reading the refusal text alone |

## The numbers

- Counter before → after: `src/minify.js` **4 → 1**, `src/strip/guard.js` **6 → 1**, `src/parse.js`
  **1 → 0**; `src/strip.js` still 1 and `src/metrics.js` still 16 (their internal errors are step 3).
- `SITES` (27), `PRINTED` (2/2/1/2/4) and `CASES` (38) unchanged; 38 checks green over
  `test/module.test.js`, `test/doctor.test.js`, `test/minify.test.js`, `test/refusals.test.js`,
  `test/refusals-catalog.test.js` and `test/tokens.test.js` — so the code-2 refusals still return 2
  with their advice, and the degraded paths still return 4.

## Red first — every string, one at a time

1. The minifier's sentence put back into Russian → `test/module.test.js` 13 reddens («отказ не называет
   ни файла, ни того, кто его не разобрал»), while **`test/minify.test.js`'s own check of the same
   refusal stays green**: it is anchored on the JSON example `{".js": "strip-lines"}` and on
   `"engine": "strip"` being absent. The plan expected that check to redden; the measurement says the
   reader is `test/module.test.js:197`.
2. The guard's sentence put back into Russian → `test/doctor.test.js` 7 («ответ не назвал причину») and
   `test/module.test.js` 15 («отказ не называет настоящую причину»).
3. The advice quoted in `test/module.test.js:223` put back into Russian → `test/refusals-catalog.test.js`
   4 reddens: «совет отдан другой проверке, а она его не исполняет».
4. The parse worker's fallback reason put back into Russian → **nothing**: 20 checks green over
   `test/module.test.js`, `test/guard.test.js` and `test/doctor.test.js`. It shows only on the Node
   `--check` path and lands inside a sentence whose opening words are what a check reads.

**A fact about the catalogue, found while measuring (3):** the `must` phrases of a `coveredBy` case are
never executed — `verify()` returns early for those — so `must: ['is not JavaScript']` there is
documentation, and the named file is the reader that holds the text. The advice of such a case *is*
checked, but as a string search inside the named file, which is why a stale quotation reddens instead
of passing quietly.

## Corrections to the subplan, by measurement

- `test/minify.test.js:236` needed no edit, and the plan's red-first for it was wrong (see 1).
- `test/doctor.test.js:208` did move, and the "three sources" worry resolved to the refusal text.

`src/parse.js:129`'s comment ("so it is Russian like the rest of the output") is now stale — prose, out
of this work's scope, recorded in `TODO.md` beside the `tools/refusals.js:134` one.

## What is left in S3

Step 3 — the four internal errors (`src/minify.js:40`, `src/strip.js:54`, `src/strip/guard.js:46`,
`src/metrics.js:265`), where `test/module.test.js:163` is a real reader and `:120`/`:195` are negative
ones — then the wash-up over the six files.

## Release and push

The portion changes bytes that ship (`src/**` is in `files`), so a PATCH release is owed; the release
half of `BLOCKERS.md` N20 is still open. Pushed with the full profile run by hand first.

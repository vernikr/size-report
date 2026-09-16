# The string work: subplan S3 (the measurement) planned

**Requested:** the next subplan of the map — S3, the measurement layer — as
`docs/plans/2026-09-16-i18n-english/measurement.md`: scope by the module's owner, readers of every
literal, terminology reconciled with S1 and S2 with the divergences named (including who owns a word
and who prints it), red-first experiments, verification by the existing sensors, an acceptance
criterion, a tracker update and this entry. Same limits as before: English content, literals only,
N19 and N24 untouched.

**Done.** `measurement.md` written, the tracker's S3 row corrected and marked **written 2026-09-16**,
its allow-list widened, and `TODO.md` opened its first entry.

**The measurement that shaped the plan.** The six files hold **33 lines with Cyrillic**, and the
whole point of the subplan is that only **18** of them are literals to translate:

| file | cyr | in scope | what the rest is |
|---|---|---|---|
| `src/metrics.js` | 20 | 5 | 12 lines are the **`ru` side of a dictionary inside the registry** (the metric notes, methods, the fallback and unavailability wordings, picked by `cfg.locale`), and **3 lines (61–63) are a Russian comment** |
| `src/minify.js` | 4 | 4 | the internal `Error('минификатор недоступен: …')` and the `минификатор не разобрал` refusal with its advice |
| `src/strip/guard.js` | 6 | 6 | the `файл не JavaScript` refusal with its advice and the internal `стриппер испортил …` |
| `src/strip.js` | 1 | 1 | the internal `неизвестная стратегия минификации «…»` |
| `src/parse.js` | 1 | 1 | the parse worker's fallback reason, which lands inside the guard's refusal |
| `src/optional.js` | 1 | 1 | the loader's `why`, which lands inside the sensor note |

A dictionary inside `src/metrics.js` is a finding the tracker did not carry: it is the same class as
`src/locales.js` (data, not a literal), so the allow-list row now names both files. The comment is a
leftover of the prose pass and the **only** Russian comment left in `src/` — measured with
`rg -c '^\s*(//|\*|/\*).*\p{Cyrillic}' src`, which answers `src/metrics.js:3` and nothing else. It is
prose, so the literals-only mission does not take it; it went into `TODO.md` instead, and the
subplan's acceptance counts it as a named exception rather than pretending its files reach zero.

Also measured and written down: `src/tokens.js` (and `src/strip/js.js`, `src/strip/forms.js`,
`src/data.js`, `src/derived.js`, `src/artifact.js`) hold **no** Cyrillic at all, so the measurement
layer has no other file to translate and the `tok` metric's words are the registry's.

**The divergence worth naming.** `sensorGaps` (metrics.js) owns four strings that **other subplans
print**: `src/modes.js` (S1) prints `'! ' + why` and `  fix: `, `src/check.js` and `src/doctor.js`
(S4) print the same pair their own way. So S3 owns the words, S1 and S4 own the markers and the
printing. The two causes of this layer (`файл не JavaScript`, `минификатор не разобрал`) follow S2's
rule: S3 never renames a cause — that is S1's step 3, in one commit with the registry, the catalogue
and the two refusal checks.

**A trap of a subtler kind, and the reason the readers table was worth building.** `test/minify.test.js`
reads *both* kinds of string in one file: line 195 asserts the **dictionary's** `unavailable` wording
(`'esbuild недоступен'`) and lines 181/217/223 assert the **literals** of `sensorGaps` (`/минификатор
недоступен/`). `test/tokens.test.js` splits the same way (113 dictionary, 105/106 literals). A
translate-by-grep pass would have translated the dictionary into the English report of a Russian
project; the plan names both sides, and the red-first experiment for step 1 (translate the `min` `why`
→ line 181 reddens while 195 stays green) shows the distinction is real rather than declared.

Two more constraints are pinned with their reasons: the JSON fragments inside the two `fix` strings
(`"minify": {"engine": "strip"}`, `"tok"` + `metrics`) must survive, because `test/minify.test.js:182`
matches `/minify.*engine.*strip/` and `test/tokens.test.js:106` matches `/"tok" из metrics/`; and the
four internal errors of step 3 have **no reader at all** — measured with a grep, quoted in the plan —
so the honest "red first" for that step is the grep itself rather than a test.

The expected green of `pnpm run verify` is measured: none of the in-scope strings appears in either
reference (`rg -c 'минификатор недоступен|не JavaScript|считает упрощением|необязательные|не разбирается' fixtures/parity/* fixtures/synthetic/*` answers nothing), and the metric captions that are
frozen come from the dictionaries, which do not move. The frozen Russian of this layer stays
`SKIP_WORDS` (N24, S4).

**Checks:** `pnpm run verify:fast` green (5 steps, 70 checks). Nothing ships — plan files are not in
the tarball — so there is no release, said in the commit. No code, no test, no gate file touched.

**Offered next:** the subplans that close the published runtime (`diagnostics.md`, S4, and
`automation.md`, S5), then the instruments and the checks.

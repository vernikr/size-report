# S3 — the measurement: the metric registry, the minifier, the stripper's guard, the parse worker

2026-09-16. Parent: `plan.md` (T0). Follows `surface.md` (S1) and `settings.md` (S2) — same rules
about the cause names and the advice marker, and the same habit: every literal gets its readers
named before it is touched.

Nothing here changes behaviour: only the values of string literals change. The metrics, their keys,
their `accuracy`, the formats they answer for, the strategy names, the rules of the guard and the
optional-dependency seam all stay exactly as they are.

## Scope: six files, 33 lines with Cyrillic — of which 18 are in scope

| File | Cyrillic lines | In scope | What the Russian is |
|---|---|---|---|
| `src/metrics.js` | 20 | **5** | `sensorGaps`' two `why` and two `fix` (the degraded-sensor note a run prints) and `measureBlob`'s internal `Error('метрике «…» нужно содержимое …')`. The other **12** lines are the `ru` side of the dictionaries (`STYLES.strip/esbuild/tok`, `METRICS.raw/gzip`), and **3** (lines 61–63) are a Russian comment |
| `src/minify.js` | 4 | 4 | the internal `Error('минификатор недоступен: …')` and the `refuseCause('минификатор не разобрал', 'esbuild не разобрал …')` message with its advice |
| `src/strip/guard.js` | 6 | 6 | the `refuseCause('файл не JavaScript', …)` message with its advice, and the internal `Error('стриппер испортил …')` |
| `src/strip.js` | 1 | 1 | the internal `Error('неизвестная стратегия минификации «…»')` |
| `src/parse.js` | 1 | 1 | the parse worker's fallback reason `'модуль не разбирается'`, which lands inside the guard's refusal as its cause |
| `src/optional.js` | 1 | 1 | the `why` of a switched-off optional dependency, which lands inside `sensorGaps`' `why` |

Under the tracker's instrument:

```bash
rg -cP '[\p{Cyrillic}]' src/metrics.js src/minify.js src/strip.js src/strip/guard.js src/parse.js src/optional.js
```

**A measured fact worth having:** `src/tokens.js` holds **no** Cyrillic at all — the words of the
`tok` metric live in the registry (`src/metrics.js`), not beside the counter. So the tokens module
is complete in this map and does not need a subplan of its own.

## What stays Russian here, and why

- **The dictionaries inside `src/metrics.js`** (12 lines): `metricView`/`minView`/`tokView` pick
  `note[cfg.locale]`, `method[cfg.locale]`, `fallback[cfg.locale]` and `unavailable[cfg.locale]` —
  these are the Russian captions of the report, exactly like the `ru` table in `src/locales.js`, and
  they are **data** rather than a literal to translate. Deleting the `ru` side would delete the
  Russian report. This is a named exception, and it widens the tracker's allow-list row: the row
  says "the `ru` dictionary in `src/locales.js`" today and has to say "the `ru` sides of the
  dictionaries in `src/locales.js` **and `src/metrics.js`**" — a change this subplan makes in the
  tracker, not in the code.
- **Identifiers.** Metric keys (`raw`, `min`, `tok`, `gzip`), `accuracy` values (`exact`,
  `approximate`), engine names (`strip`, `esbuild`), strategy names (`strip-js`, `strip-lines`, …),
  the seam's own name `SIZE_REPORT_NO_OPTIONAL`, and the JSON fragments inside the advice
  (`"minify": {"engine": "strip"}`, `"tok"` + `metrics`) are names a project writes and tests read.
  They do not change — and two of the tests below prove they must not.
- **The Russian comment** in `src/metrics.js` (lines 61–63, the only prose left in the file): a
  comment is not a string literal, and this mission is literals only. It is recorded in `TODO.md`
  rather than translated on the way past, and the acceptance below counts it as a named exception.
- The tracker's allow-list as a whole: journals, frozen fixtures, quoted old output in records.

## Reconciliation with S1's and S2's vocabulary

- **Causes.** S3's files are the site of two of the twenty-two: `файл не JavaScript` (`src/strip/guard.js`)
  and `минификатор не разобрал` (`src/minify.js`). S1's names are `file is not JavaScript` and
  `minifier did not parse it`, and the rule from S2 stands here unchanged: **S3 never renames a
  cause** — the registry (`CONFIG_CAUSES`), the call sites, `tools/refusals.js`'s `SITES`/`CASES` and
  the two refusal checks move in **S1's step 3**, one commit, so that the tree is never red between
  them. S3 translates the message beside the argument.
- **The advice marker.** Both refusals here carry `\n  починка: ` — S1's word is `fix: `, and the
  extractor's tolerance (`ADVICE_LINE`, S1's step 5) covers the transition.
- **The sensor note's shape.** `sensorGaps` returns `{why, fix}`; `src/modes.js` (S1) prints
  `'! ' + why` and `'  fix: ' + fix`, while `src/check.js` and `src/doctor.js` (S4) print the same
  pair their own way. So **S3 owns the words and two other subplans own the printing**: S1's and
  S4's steps must not touch this text, and a change of the marker inside `modes.js` (`  починка: ` →
  `  fix: `) is S1's, not S3's.

**One divergence to keep straight inside a single test file.** `test/minify.test.js` reads *both*
kinds of string: line 195 asserts `min.method.indexOf('esbuild недоступен') >= 0`, which is the `ru`
dictionary's `unavailable` (data — stays), while lines 181, 217 and 223 assert `/минификатор
недоступен/` on stderr, which is `sensorGaps`' `why` (this subplan). `test/tokens.test.js` splits the
same way: line 113 reads `view.method` (the dictionary), line 105 reads the `why` and line 106 reads
the `fix`. Translating by grep without this distinction would translate the dictionary's Russian into
the English report of a Russian project.

## Correction, measured 2026-09-16 while planning C1 — one internal error does have a reader

This plan said the four internal errors have no reader at all, "measured by grep". The grep answered
for the whole sentence `'стриппер испортил …'` and not for its first two words:
`test/module.test.js:163` asserts `assert.match(res.stderr, /стриппер испортил/, …)` **after mutating
`src/strip/js.js` for real** (the mutation loses the single-quote branch, the stripper eats the rest of
a line and the code stops parsing). So the internal error of `src/strip/guard.js:46` is covered by a
check, and the step that translates it has a red to prove itself with instead of a grep.

Two neighbours in the same file are readers of the **negative** kind and have to be re-pointed in that
same commit, or they quietly stop checking: `test/module.test.js:120` and `:195` assert
`assert.equal(/стриппер/.test(res.stderr), false, …)` — "the tool must not blame the stripper". A
negative match over a printed text is a reader too: once the sentence is English the regex matches
nothing whatever the tool says, and the assertion stays green forever. C1's plan states the rule for
every owner.

## Readers — each literal below is a promise about text, and each reader reddens if edited alone

| Reader | Where | What it reads |
|---|---|---|
| `tools/refusals.js` | case `id: 'приближение вместо точного счёта'` | `must: ['метрика «min» считает упрощением', 'метрика «tok» считает оценкой', 'починка: ']`, two advice texts quoted **word for word** from the two `fix` strings (`поставьте необязательные зависимости заново или задайте "minify": {"engine": "strip"}` and `… или уберите "tok" из metrics`), and the `works` alternatives that run both fixes |
| `tools/refusals.js` | case `key: 'файл не JavaScript'` (guarded by `test/module.test.js`) | `must: ['не JavaScript']` and the advice text `'уберите это расширение из minify.guard'` |
| `tools/refusals.js` | case `key: 'минификатор не разобрал'` (guarded by `test/module.test.js`) | `must: ['esbuild не разобрал']` and the advice text `'задайте этому расширению упрощение в minify.ext'` |
| `tools/refusals.js` | `SITES`, `PRINTED` | the site counts and the `✗ ` marks — **unchanged** here (no site is added or removed) |
| `test/minify.test.js:181,182` | `sensorGaps` | `/минификатор недоступен/` in stderr and the fix's shape `/minify.*engine.*strip/` — the JSON fragment `{"engine": "strip"}` has to survive the translation **in that order** |
| `test/minify.test.js:195` | the `ru` dictionary | `'esbuild недоступен'` inside `min.method` — data, unaffected |
| `test/minify.test.js:217,223` | `sensorGaps` | `/минификатор недоступен/` in the control mode's and `check`'s stderr |
| `test/minify.test.js:236` | the minifier's refusal | `e.message.indexOf('"engine": "strip"') >= 0` — the example JSON survives; the sentence around it is this subplan's |
| `test/module.test.js:205,218,223` | the guard's and the minifier's refusals | `'задайте этому расширению упрощение в minify.ext'`, `/не JavaScript/`, `'уберите это расширение из minify.guard'` |
| `test/doctor.test.js:196-208,228` | the guard's refusal and the sensor fix through `doctor` (S4's file) | it writes a fixture file whose **content** is `@@@ это не JavaScript` and whose **commit subject** is `не JavaScript`, then asserts `/не JavaScript/` over doctor's answer, and `/"engine": "strip"/` for the fix. The pattern has to be re-pointed at the new English phrase, and the experiment below is what proves which of the three sources it was matching |
| `test/tokens.test.js:105,106` | `sensorGaps` | `/метрика «tok» считает оценкой/` and `/"tok" из metrics/` — the second one keeps the JSON fragment `"tok"` and the key name `metrics` |
| `test/tokens.test.js:111,113,181` | the `ru` dictionary | `1 токен ≈ N знака`, `… недоступен`, `^gpt-tokenizer \d+\.\d+\.\d+, o200k_base \(BPE\)$` — data, unaffected |
| `test/api.test.js` | the freeze | the public list of 55 names, among them `strategyFor`, `metricView`, `sensorGaps`, `measureBlob` — none may be added or lost |

## Order of work — three steps and a wash-up, one commit each

Budget and habits as in S1 and S2: ≤ 600 lines and ≤ 10 files per commit, `pnpm run verify:fast`
green before each, the counter per file before and after, one red-first experiment quoted per step.

**Step 1 — the sensor note (`src/metrics.js`'s `sensorGaps` + `src/optional.js`'s `why`) — done
2026-09-16** (`src/metrics.js` 20 → 16, `src/optional.js` 1 → 0; commit
`feat(i18n): translate what a run says about a degraded sensor`). The four `why`/`fix` strings became
`the metric "min" counts by simplification: the minifier is unavailable — …` with `fix: install the
optional dependencies again or set "minify": {"engine": "strip"}`, and the same for `tok`
(`… or remove "tok" from metrics`); the loader's reason became `the optional dependencies are
switched off (SIZE_REPORT_NO_OPTIONAL)`. Joint edits landed as planned: the `приближение вместо
точного счёта` case's `must` and its two advice `text` fields (quoted word for word, so
`test/refusals.test.js` compares them with the output), `test/minify.test.js:181,217,223` and
`test/tokens.test.js:105,106`. **The JSON fragments and key names were kept**, which is what
`test/refusals.test.js`'s `works` alternatives run. Two things the plan expected to move did **not**:
`test/doctor.test.js:228` reads only `"engine": "strip"` (the JSON, not the sentence), and the
catalogue's `truth` line is the catalogue's own prose (W1's owner), as in S2.

**Measured, string by string** (each put back into Russian alone): the `min` `why` reddens
`test/minify.test.js` twice (`отступление не объяснено`, in the plain run and in the divergence run)
while the `ru` dictionary's line in the same test file stays satisfied — the two kinds of string in one
file, told apart by the message; the `tok` `fix` reddens `test/tokens.test.js` on the JSON fragment
(`отступление не назвало починку`); and the loader's own reason has **no reader at all** — with
`src/optional.js` back in Russian, `test/minify.test.js` and `test/tokens.test.js` answered 16 checks
green, because the reader reads the note's opening words rather than the reason appended to them. One
collision to know about: the pattern `/the minifier is unavailable/` matches **both** the sensor note
(`src/metrics.js`) and the internal error of `src/minify.js:40`, and it did the same in Russian — so
that check never told the two apart.

**Step 2 — the two refusals of the measurement — done 2026-09-16** (`src/minify.js` 4 → 1,
`src/strip/guard.js` 6 → 1, `src/parse.js` 1 → 0; commit
`feat(i18n): translate the two refusals of the measurement`). The minifier's refusal became
`esbuild did not parse <file> at <sha>: <reason>` with `fix: the extension lied about its content or
the minifier is older than the syntax; give this extension a simplification in minify.ext (for
example {".ts": "strip-lines"})`, and the guard's `the file <path> is not JavaScript: its source text
parses neither as a script nor as a module, so the stripper is not to blame, while <ext> stands in
minify.guard: <reason>` with `fix: remove this extension from minify.guard or give it minify.ext — for
example { ".js": "strip-lines" }`. The parse worker's fallback reason became `the module does not
parse`. Joint edits: the two catalogue cases, `test/module.test.js:197,205,218,223` and
`test/doctor.test.js:208`. Each refusal keeps its shape (the cause, then `fix: <what to edit>`) and the
settings keys stay spelled as a file spells them (`minify.ext`, `minify.guard`).

**Measured, string by string** (each put back into Russian alone):

| Put back | What reddens |
|---|---|
| the minifier's sentence | `test/module.test.js` 13 — «отказ не называет ни файла, ни того, кто его не разобрал». **`test/minify.test.js:236` stays green**, measured: that check is anchored on the JSON example (`{".js": "strip-lines"}`) and on `"engine": "strip"` being absent, not on the sentence — so the plan's expectation for it was wrong |
| the guard's sentence | `test/doctor.test.js` 7 («ответ не назвал причину») and `test/module.test.js` 15 («отказ не называет настоящую причину») |
| the advice quoted in `test/module.test.js:223` | `test/refusals-catalog.test.js` 4 — «совет отдан другой проверке, а она его не исполняет», which is how a `coveredBy` case's advice is held |
| the parse worker's fallback reason | **nothing** — 20 checks green over `test/module.test.js`, `test/guard.test.js` and `test/doctor.test.js`: it shows only on the Node `--check` path and lands inside a sentence whose opening words are what a check reads |

**A fact about the catalogue worth keeping:** the `must` phrases of a `coveredBy` case are never
executed — `verify()` in `test/refusals.test.js` returns early for those, so `must: ['is not
JavaScript']` is documentation and the named file is the reader that holds the text. The advice of
such a case *is* executed, but as a string search in the named file (`test/refusals-catalog.test.js`),
which is why a stale quotation there reddens rather than passing quietly. And the plan's worry about
`test/doctor.test.js:208`'s "three sources" resolves by measurement to one: `doctor` prints the
refusal as its finding and never prints the fixture's commit subject, so the pattern was reading the
refusal text alone.

**Step 3 — the internal errors — done 2026-09-16** (`src/minify.js` 1 → 0, `src/strip.js` 1 → 0,
`src/strip/guard.js` 1 → 0, `src/metrics.js` 16 → 15; commit
`feat(i18n): translate the internal errors of the measurement`). The four became `the minifier is
unavailable: <reason>`, `unknown minification strategy "<name>" (have: …)`, `the stripper broke <path>
at <sha>: <reason>` and `the metric "<name>" needs the content of <file> at <sha>, and it was not
read`. These are defect paths rather than messages: none is caught as a refusal, so a run that reaches
one ends with `src/cli.js`'s `✗ <internal error>` and code 5, and `tools/harness.js`'s `refusal()`
asserts there is no stack in a *refusal* only.

**Readers — measured, and the plan's own claim was wrong for one of the four.** The plan said no reader
exists for any of them and quoted a grep; the correction section below already found the first, and the
step measured the rest:

| String | Reader |
|---|---|
| `the stripper broke …` (`src/strip/guard.js`) | `test/module.test.js` 3 — «гард жив: сломанный стриппер не проходит молча», which mutates `src/strip/js.js` for real; measured: reddens with `текст отказа не называет причину` |
| the same word in two **negative** matches (`test/module.test.js` 2 and 15) | they had to be re-pointed at `/stripper/`; measured: left in Russian they stay **green and vacuous** (the whole 175-check run is green either way) |
| `the minifier is unavailable: …`, `unknown minification strategy …`, `the metric "…" needs the content of …` | **no reader at all** — measured by putting the three back into Russian and running the whole full suite: **175 checks green**. The grep agrees (`rg -n 'the minifier is unavailable:|unknown minification strategy|needs the content of' src test tools` answers inside `src/` alone) |

**Wash-up — done 2026-09-16.** The counter over the six files answers **exactly the named
exceptions** — the 12 dictionary lines and the 3 comment lines:

```bash
rg -cP '[\p{Cyrillic}]' src/metrics.js src/minify.js src/strip.js src/strip/guard.js src/parse.js src/optional.js
# expected: src/metrics.js:15, nothing for the other five
```

**Correction by measurement 2026-09-16.** The expectation here read `src/metrics.js:13` — "the 12
dictionary lines and the comment" as if the comment were one line. It is **three** (lines 61–63), so the
final answer is **15**, and after step 1 the file reads **16** (12 dictionary + 3 comment + the
internal error of step 3, still Russian at that point).

`ADVICE_LINE`'s tolerance stays, for the same reason and one round closer: after step 2 the mark
`починка: ` no longer exists in this layer, while S4 (`src/git.js`, `src/history.js`, `src/check.js`,
`src/doctor.js`, `src/explain.js`) and S5 (`src/hook.js`) still print their markers, so narrowing the
pattern now would redden the catalogue — it belongs to W1's step 8 (**N28**). No reflowing, no
renaming of strategies or metrics, no "while I am here".

## What proves each step (the sensors that already exist)

- `pnpm run verify:fast` — `test/refusals-catalog.test.js` (site counts and the `PRINTED` marks),
  `test/minify.test.js`, `test/tokens.test.js`, `test/module.test.js`, `test/doctor.test.js`,
  `test/guard.test.js` (the parse worker), `test/api.test.js`, plus `lint:strict`, `metrics`, `dup`
  (the two `fix` strings are near-twins by design — the sensor is the guard of that neatness, and the
  answer to a red is a re-wording, not a baseline) and `deps`.
- `pnpm run verify` before the portion is pushed — `test:all`, `parity:live`, `check:standards`,
  `pack:check`. **Expected green, and measured rather than hoped:** none of the in-scope strings
  appears in a reference — `rg -c 'минификатор недоступен|не JavaScript|считает упрощением|необязательные|не разбирается' fixtures/parity/* fixtures/synthetic/*` answers nothing — and the metric
  captions that *are* frozen (the report artifacts carry the `ru` captions) come from the
  dictionaries, which this subplan does not touch. The one frozen Russian of this layer remains
  `SKIP_WORDS` (`BLOCKERS.md` N24, S4's file).
- The counter per file, before and after — the only instrument that says a step is finished rather
  than merely green.

**Red first, per step:**

- step 1: translate the `min` `why` in `src/metrics.js` alone → `test/minify.test.js:181` reddens
  ("the degradation is not explained") while `:195` stays green, which is the proof that the two
  strings in one file are two different kinds; translate the `tok` `fix` alone → `test/tokens.test.js:106`
  reddens on the JSON fragment;
- step 2: translate the guard's phrase alone → `tools/refusals.js`'s `файл не JavaScript` case
  reddens through `test/refusals.test.js`, and `test/module.test.js:205` reddens on the advice;
  translate `minify.js`'s refusal alone → `test/minify.test.js:236` reddens on the example JSON, which
  shows what that check is really anchored on;
- step 3: nothing can redden — the experiment is the grep quoted above, and the commit says so;
- wash-up: the counter.

## Acceptance

- The counter over the six files answers **only** the named exceptions — met 2026-09-16:
  `src/metrics.js` **15** (the 12 `ru` dictionary lines and the comment at 61–63, recorded in
  `TODO.md`) and **nothing** for `src/minify.js`, `src/strip.js`, `src/strip/guard.js`, `src/parse.js`
  and `src/optional.js`. Every other Cyrillic line of these files is gone.
- `pnpm run verify` green (fast after every commit, full before the portion is pushed).
- **Behaviour provably untouched:** `SITES` and `PRINTED` unchanged (`test/refusals-catalog.test.js`);
  the public API list unchanged (`test/api.test.js`); the metric views' keys, labels and `accuracy`
  values unchanged (`test/contract-data.test.js`, `test/minify.test.js:104`); the fixture artifacts
  and both `--json`/`--data` answers unchanged (`test/parity.test.js`, `test/frozen.test.js`,
  `pnpm run check:standards`) — the dictionaries they are built from do not move; the optional
  seam still works in both states (`SIZE_REPORT_NO_OPTIONAL`, `test/minify.test.js`,
  `test/tokens.test.js`).
- The two cause arguments of this subplan are English exactly when S1's step 3 has landed, and the
  worklog entry says which of the two states the tree is in.
- The release rule applies (shipped literals changed): cadence per `BLOCKERS.md` N20.

## Out of scope of this subplan

- The `ru` sides of the dictionaries in `src/metrics.js` and `src/locales.js`, and
  `DEFAULT_CONFIG.locale` (N19 — a decision, not a step).
- The cause **registry** (`src/refusal.js`) and `tools/refusals.js`'s `SITES` names: S1's step 3.
- The printing of the sensor note: `src/modes.js` (S1) and `src/check.js` / `src/doctor.js` (S4)
  own their own lines and markers.
- `src/tokens.js`, `src/strip/js.js`, `src/strip/forms.js`, `src/data.js`, `src/derived.js` and
  `src/artifact.js` — **measured: no Cyrillic in any of them** (`rg -cP '[\p{Cyrillic}]'` over the
  six answers nothing), so the measurement layer has no other file to translate. The tests' own
  message texts (C2) and everything else on the tracker's map are out too.
- The Russian comment at `src/metrics.js:61-63`: prose, out of the mission's scope by definition,
  recorded in `TODO.md` with a pointer here so that the next prose pass finds it.

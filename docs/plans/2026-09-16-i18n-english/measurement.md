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

**Step 1 — the sensor note (`src/metrics.js`'s `sensorGaps` + `src/optional.js`'s `why`).** Four
`why`/`fix` strings and the loader's reason they concatenate. Joint edits: the `приближение вместо
точного счёта` case in `tools/refusals.js` (`must`, both advice texts, `truth`), the two patterns of
`test/minify.test.js:181,182`, `test/tokens.test.js:105,106`, and `test/doctor.test.js:228` if the
fix's wording changes shape. **Keep the JSON fragments and the key names in both fixes** — `"minify":
{"engine": "strip"}` and `"tok"` + `metrics` — because a pattern matching `/minify.*engine.*strip/`
and another matching `/"tok" из metrics/` are what hold the advice's usefulness, not its language.
Keep the two sentences parallel in structure (a cause, then a way out) so that the note reads as one
mechanism; `test/refusals.test.js` runs both fixes as alternatives (`works`), so both have to remain
actions a person can carry out.

**Step 2 — the two refusals of the measurement** (`src/minify.js`, `src/strip/guard.js`,
`src/parse.js`'s fallback reason). One commit, because the guard's message embeds the parse worker's
reason: translating one without the other would leave a Russian fragment inside an English sentence.
Joint edits: the two cases in `tools/refusals.js`, `test/module.test.js:205,218,223`,
`test/doctor.test.js:208`, and `test/minify.test.js:236` (only the sentence, not the JSON example).
Keep each refusal's shape: the cause, then `fix: <what to edit>`, with the settings keys quoted as
they are written in a file (`minify.ext`, `minify.guard`) — `test/templates.test.js` and
`tools/docs-facts.js`'s `usageFlags` are the reason a key's spelling is never paraphrased.

**Step 3 — the internal errors** (`src/minify.js:40`, `src/strip.js:54`, `src/strip/guard.js:46`,
`src/metrics.js:265`). These are defect paths rather than messages: none of them is caught as a
refusal, so a run that reaches one ends with `src/cli.js`'s `✗ <internal error>` and code 5, and
`tools/harness.js`'s `refusal()` asserts there is no stack in a *refusal* only. **No reader exists
for these four strings** — that is measured, not assumed: `rg -n "минификатор недоступен:|неизвестная стратегия|стриппер испортил|а оно не прочитано" src test tools` answers inside `src/` alone. The honest experiment here is therefore the grep itself, quoted in the commit, rather than a test that reddens.

**Wash-up.** The counter over the six files has to answer **exactly the named exceptions** — the 12
dictionary lines and the 1 comment:

```bash
rg -cP '[\p{Cyrillic}]' src/metrics.js src/minify.js src/strip.js src/strip/guard.js src/parse.js src/optional.js
# expected: src/metrics.js:13 (the 12 dictionary lines and the comment), nothing for the other five
```

Leave `ADVICE_LINE`'s tolerance alone if other subplans still print a Russian marker, and say so in
the commit. No reflowing, no renaming of strategies or metrics, no "while I am here".

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

- The counter over the six files answers **only** the named exceptions: the `ru` sides of the
  dictionaries in `src/metrics.js` (12 lines) and the Russian comment at lines 61–63 (1 line,
  recorded in `TODO.md`). Every other Cyrillic line of these files is gone.
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

# 0173 — N25 and N26: the panel's words into the dictionaries, the numbers into the machine's locale

**Request.** The mission agent decided two blockers: N25 — move the report page's panel words into the
locale dictionaries so a Russian report stays Russian throughout; N26 — format the numbers with
`Intl.NumberFormat` in the current locale. Both are code changes rather than translations, so each is
recorded in `BLOCKERS.md` with its price and the measurement that paid it.

**N25 — the panel reads the dictionary.** `src/page/panel.js` now takes `appUi.notOnHead`,
`appUi.category`, `appUi.categoryFromConfig` and `appUi.categoryByExtension` where it held four Russian
literals (the file's counter 3 → **0**); both dictionaries carry the four keys (`src/locales.js`, `ru`
in Russian and `en` in English); `uiText` (`src/page/build.js`) passes them into the page's own
dictionary, the path every other caption already travels. Measured in jsdom on pages built from the
fixture, both locales: the ru report's checkbox reads `data/table.toml · категория: по расширению`, the
en one `data/table.toml · category: by extension`, no tooltip holds `undefined`. The key for a file absent
on HEAD was exercised by naming one in the data block of an assembled page — `src/code.js (нет на HEAD) ·
категория: по расширению`. Price: four keys per dictionary instead of four literals, and a rebuild of this
repository's own report; `fixtures/parity/artifact.sha256` is still taken by the frozen copy (`1bdb27e1…`).

**N26 — one helper, the locale's separator.** `localeNumber(n, digits)` lives in `tools/harness.js`, the
module `run-tests.js` already imported from. `sec()` and `load()` are gone from `tools/run-tests.js`, and
both `toFixed(1).replace('.', ',')` calls are gone from `tools/gates/run.js`: four call sites, two files,
one implementation. No locale is pinned — the question "which language should the tooling print in" is one
nothing here asks. Measured: `LC_ALL=en_US.UTF-8` → `12.20`, `ru_RU.UTF-8` and `de_DE.UTF-8` → `12,20`;
a whole fast run under the Russian locale prints `✓ fast run: 70 checks, failures 0, 6,17 s (load at the
start 3,08; …)` and is green. The comment at `tools/run-tests.js:40` that explained the comma went with
`sec()` — it was the prose leftover the plan accounted for, so the owner's prose is one line (`:22`) and
`TODO.md`'s entry for it is closed.

**Docs moved with the code, by measurement.** `automation.md` (N25: the step's shape changed, the subplan
closes with the files reading nothing), `tools.md` (N26: the section, the acceptance, and the prose count),
`sensors.md` (W2's note: the profile summary's comma is no longer Russian), `plan.md` (the allowance's
dictionary entry grew by four lines, S5 closed, W1's 23 named file by file, `src/**` 65 today), `TODO.md`
(one entry closed). `tools/gates/run.js` is a gate file, so the commit carries a `Gate-Change:` trailer —
the change is a formatter rather than a threshold, and the trailer says so.

**Counters.** `src/page/panel.js` 3 → 0, `src/locales.js` 49 (the `ru` side, allow-listed data), `src/**`
64 → 65, `tools/**` 226 and W1's twelve files 23 (unchanged: no literal moved there). `SITES` 27, `PRINTED`
2/2/1/2/4, `CASES` 38, 70 checks in the fast run and 175 in the full one.

**Green.** `verify:fast` green after the edit and the full `verify` before the push; `check:standards`,
`parity:live` and `pack:check` green, the report from the tarball byte-identical. **This portion ships**
(`src/**` is in the tarball), so a release is owed; the cadence is still **N20** and is the user's call.

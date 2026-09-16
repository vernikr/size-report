# The string work: subplan S2 (the settings and their derivation) planned

**Requested:** the next subplan in the tracker's order — S2, the settings (`src/config.js`,
`src/init.js`, `src/project.js`) — as a file in `docs/plans/2026-09-16-i18n-english/`, named after
the module it owns. Same requirements as S1: English content, literals only, no decision on N19 or
N24, facts from the measurement already made, readers of every literal to be translated, red-first
experiments, verification by the existing sensors and an acceptance criterion — plus an explicit
reconciliation with S1's vocabulary and a tracker update.

**Done.** `settings.md` written (three files, 57 lines with Cyrillic: `src/config.js` 35,
`src/init.js` 18, `src/project.js` 4), the tracker's S2 row marked **written 2026-09-16**, and this
entry.

**What the subplan holds.** The scope with the literals named (the two git dead ends, the two file
readings, the whole `fail` family of `validateConfig` with its `конфиг <path>: …` prefix and
`починка: правьте <path>` tail, the value of `cfg.path`, `outsideFix`; the nine draft lines of
`draftLines`, the `конфиг уже есть` refusal and the `!` note of `noteNoColumns`; `derivedSummary`
and the `--init` hint of `derivedLines`). What stays Russian and why (the dictionaries, every key
name and identifier — they are quoted back in the messages and compared by tests — the settings
template, the tracker's allow-list). Four steps of one commit each plus a wash-up, each with its
readers and its red-first experiment, and the acceptance: the counter answers nothing over the three
files, `SITES`/`PRINTED` counts are unchanged, the public API list is unchanged, and the diff over
these files touches string literals only.

**Reconciliation with S1 (asked for explicitly, and it produced a real constraint).** The six causes
this subplan's files **emit** — `нет git`, `не git-репозиторий`, `нет файла настроек`,
`настройки не разобраны`, `настройки неверны`, `конфиг уже есть` — are given S1's English names in
a table, and the subplan states the rule: **S2 never renames a cause**, because a cause is one
vocabulary in three files (the registry, the call sites, the catalogue in `tools/refusals.js` plus
two refusal checks) and it moves in S1's step 3, in one commit. If S2 lands first the tree is green
with a Russian argument beside an English message, and the worklog entry says so. The advice family
(`починка: `, `создайте его: `, `дальше: `) is S1's `fix: `, `create it: `, `next: `, and the
extractor's tolerance covers the transition.

**The divergence worth naming is a literal in another subplan's output.** `outsideFix` lives in
`src/config.js` (S2) but is printed by `src/check.js:119` and `src/explain.js:78` (S4) and asserted
word for word by `test/check.test.js` and by the `покрытие неполно` case of the catalogue — so S2
translates the phrase and S4 must not touch it. The same shape, smaller: `derivedLines` and
`derivedSummary` are S2's words printed by `src/cli.js` (S1) and `src/doctor.js:97` (S4). And a
duplication risk is named with its price: `закрепить их файлом (…)` (config) beside
`закрепите их файлом: ` (doctor) are deliberately distinct spellings of one advice, and making them
alike would redden `pnpm run dup` — the answer is to change the phrasing, not the baseline.

**A machine reader that S1's method caught and a reading would not have:** `test/module.test.js:258`
and `:284` pull the `--init` hint out of the derived-settings note with
`/закрепить их файлом[^:]*: (.+)$/m` — a regex anchored on the Russian words, so the step that
translates the hint edits those two lines in the same commit. The other machine readers are named in
the same table (`test/check.test.js`'s `STEM` slice and `head = '  починка: '`,
`test/cli.test.js:45,69`, `test/doctor.test.js:64,132`).

**The expected green of `pnpm run verify` is measured, not hoped.** Checked before writing it down:
the two lines of `fixtures/parity/data.json` that contain the word `конфиг` are the consumer's
**commit subjects** (`refactor(tools): генератор таблицы стал переносимым — конфиг вместо ядра`),
that is, frozen history rather than a message of this tool; the fixtures' own settings carry
`title`, `heading`, labels and `fixCommand`, which are settings values this subplan does not touch.
So the only frozen Russian of this layer stays `SKIP_WORDS` (N24) — S4's file.

**Checks:** `pnpm run verify:fast` green (5 steps, 70 checks). Nothing ships — two plan files and a
tracker are not in the tarball — so there is no release, said in the commit. No code, no test, no
gate file touched.

**Offered next:** the following subplan in the map (`measurement.md`, S3), then `diagnostics.md`
(S4) and `automation.md` (S5), which would close the published runtime before the instruments.
Execution of the plans stays a separate item of the mission.

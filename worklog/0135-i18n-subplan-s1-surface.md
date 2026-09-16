# The string work: subplan S1 (the CLI surface) planned and measured

**Requested:** write the next subplan of the translation work — S1, the surface: the CLI help, the
registry of code-2 causes, the refusal texts — as `docs/plans/2026-09-16-i18n-english/surface.md`,
resting on the measurement and the map already made rather than on fresh guesses: named files,
named identifiers where useful, the order of work inside the subplan, what stays Russian and why,
and how the result is checked by the sensors that already exist. Update the tracker's S1 status in
the same portion. Two limits: literals only (no side changes of code or behaviour), and the default
locale (N19) stays an open decision rather than an assumption the plan leans on.

**Done.** `surface.md` written: the scope (measured below), the four reasons a line stays Russian,
the vocabulary the subplan fixes (cause names, the advice marker `fix:`, the migration rule for the
extractor), a table of the eleven readers that must be edited in the same commit, five steps of one
commit each with the red-first experiment named for each, the acceptance, and what is out of scope.
`plan.md`: S1 marked **written 2026-09-16** and its line count corrected, `docs/plans/…` added to the
allow-list (a subplan quotes the strings it translates), S4's row and the open questions extended
with the finding below. `BLOCKERS.md`: note **N24** added, in key order after N23.

**The scope, measured 2026-09-16** (`rg -cP '[\p{Cyrillic}]'`):
`src/refusal.js` 46, `src/args.js` 26, `src/modes.js` 13, `src/cli.js` 4 — **89 lines**. What they
hold: the whole `USAGE` help, five group names and 22 cause names of `CONFIG_CAUSES`, the internal
`Error('причина отказа не объявлена: …')`, the twelve refusal messages of the command-line grammar
with their `починка: ` tails, the `✗ ` prefix and the internal-error text of the entry point, and
what the modes print (`КБ`, the ✗/✓ prints of the size table, the `! ` sensor note, the
`состояние на HEAD` line). `src/locales.js` (45 lines) is **not** in the scope and the plan says why:
every one of its Cyrillic lines lies inside the `ru` dictionary (first at line 8, `heading`, last at
line 68, `noJournalMark`) and the `ru`/`en` key sets are equal — top level, `page` and `categories`
(measured with `node`).

**The readers named in the plan** (they are not gate files, but a text is a promise and each of them
reddens if it is edited alone): `tools/docs-facts.js:135` (`usageCommands` splits the help on
`'\nКоманды:\n'`), `tools/docs-facts.js:175,177` (`commandsAt` reads `'Команды:'`/`'Режимы:'` out of a
**historical** revision, so the pin's age matters), `test/docs-commands.test.js:36` and
`readmeCauses()`, `test/cli.test.js:33,189,193,246,297`, `tools/refusals.js` (`SITES`, `PRINTED`,
`ADVICE_LINE`/`adviceOf`, `CASES[].key/must/truth`), `test/refusals.test.js:305,317,318`,
`test/refusals-catalog.test.js` (including line 62, which counts the literal `'✗ '` per file),
`test/parity.test.js:57` (the machine-read shape `: N строк × M файлов`), and the code-2 table of
`README.md`.

**A finding that changes the tracker (N24).** `SKIP_WORDS` in `src/history.js` is not internal: it is
part of the frozen `--json` contract. Measured: `fixtures/parity/data.json` holds `только таблица`
**49** times and `без изменения объёма` **5** times, `fixtures/synthetic/golden.json` holds two of
them, and `test/parity.test.js` compares `--json` **byte for byte** with that reference. So S4 (the
diagnostics, which owns that file) is the one subplan whose translation moves a reference already,
and the choice is the same one N21 asks from the generator's side: re-take the references, move the
three words into the locale dictionaries (which keeps both references' bytes, since the fixtures pin
`locale: "ru"`), or name them in the allow-list. Written down rather than decided.

**The rest of S1's claim is checked, not assumed.** `rg -c 'починка|Команды|Режимы|Коды выхода'`
over `fixtures/**` answers nothing, and the report artifacts are built from the `ru` dictionary,
which S1 does not touch — so an untouched parity reference is a measured expectation in the plan
rather than a hope, and `pnpm run verify` (which adds `check:standards`, `parity:live` and
`pack:check`) is named as the check that proves it.

**Checks:** `pnpm run verify:fast` green (5 steps, 70 checks). Nothing ships in this portion — the
plan, the tracker and the blocker notes are not in the tarball — so there is nothing to release, and
that is said here as `AGENTS.md` asks. No code, no test, no gate file touched: the three files of
this portion are `docs/plans/2026-09-16-i18n-english/{plan,surface}.md` and `BLOCKERS.md`.

**Offered next:** the following subplan (`settings.md`, S2) or S1's first step — the help's prose and
its two machine-read markers — with the release cadence (N20) and the frozen layer (N21, N24) still
the mission agent's to decide.

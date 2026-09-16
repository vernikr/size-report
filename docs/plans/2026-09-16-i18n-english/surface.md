# S1 — the surface: the help, the refusal registry, the CLI and mode texts

2026-09-16. Parent: `plan.md` (T0). This is the first subplan of the string work: it takes the
texts a user meets **before** anything is measured — the help, the refusals of the command line
grammar, the registry of code-2 causes, and what the modes print about a run.

Nothing here changes behaviour: only the values of string literals change. No condition, no
argument, no exit code, no rule of the grammar, no name of a mode or a command.

## Scope: four files, 89 lines with Cyrillic (measured 2026-09-16)

| File | Lines with Cyrillic | What exactly is Russian |
|---|---|---|
| `src/refusal.js` | 46 | the whole `USAGE` help (`— отчёт об объёме файлов по коммитам…`, the `Команды:`/`Режимы:`/`Ключи:` sections, the code paragraph, `Причины отказа кодом 2`), the five group names and 22 cause names of `CONFIG_CAUSES`, and the internal `Error('причина отказа не объявлена: …')` in `refuseCause` |
| `src/args.js` | 26 | the twelve refusal messages of the grammar (`незнакомый ключ «…»`, `ключ «--write» назван дважды`, `у ключа «--config» нет значения`, `два режима сразу: …`, `ключ «--force» работает только с «--init»`, `лишнее слово «…»`, `неизвестная команда «…»`, `команда «check» и режим «--write»`, `команде «explain» нужен коммит`, `команда «explain» принимает один коммит`, `у команды «…» нет ответа в JSON`, `«--json» и режим «…»`) together with their `\n  починка: ` tails |
| `src/cli.js` | 4 | `· хук поставлен: … — отчёт обновляется после каждого коммита (снять: …)`, the `✗ ` prefix of a refusal, `✗ внутренняя ошибка (это дефект инструмента, а не проекта — пришлите, пожалуйста, этот текст целиком)` |
| `src/modes.js` | 13 | `КБ`, `✗ таблица размеров: нет файла … — соберите её: …`, `✗ таблица размеров: … расходится с историей git (строка N)`, `в файле:` / `по истории:` / `<строк нет>`, `строк нет в файле:`, `  починка: … — и закоммитить … отдельным коммитом.`, `✓ … : N строк × M файлов, … КБ (пропущено без строки: …)`, `  состояние на HEAD: `, `✓ отчёт: … совпадает с историей (…)`, and the `! ` + `\n  починка: ` pair of a sensor note |

Under the tracker's instrument:

```bash
rg -cP '[\p{Cyrillic}]' src/refusal.js src/args.js src/cli.js src/modes.js   # 46 26 4 13
```

## What stays Russian here, and why

- **`src/locales.js` is not in this subplan.** All 45 of its Cyrillic lines lie inside the `ru`
  dictionary (measured: the first is line 8, `heading`, the last is line 68, `noJournalMark`), and
  the `ru` and `en` key sets are **equal** today — top level, `page` and `categories` alike
  (measured with `node`). A locale is data rather than a literal: it is the Russian interface of
  the report, and deleting it deletes a feature. Which locale a project gets when it says nothing
  is `DEFAULT_CONFIG.locale` — a product decision, `BLOCKERS.md` N19, **not taken and not assumed
  here**. This subplan neither changes the default nor touches the dictionaries.
- **The marks stay marks.** `✗ `, `✓ `, `! ` and `· ` are not words: `tools/refusals.js`'s
  `PRINTED` counts the literal `'✗ '` per source file and `test/refusals-catalog.test.js:62`
  counts it again in the sources, so the mark is a machine-read token. Only the words after a mark
  change.
- **Quotations in records stay.** `AGENTS.md`, `BLOCKERS.md`, `worklog/**` and the archived plans
  quote output of its own day; the tracker's allow-list covers them.
- **Plans quote what they translate.** This file quotes a handful of the strings above so that a
  reader can see what is meant; the allow-list in `plan.md` names `docs/plans/2026-09-16-i18n-english/**`
  for exactly that reason.

## The vocabulary this subplan fixes, and who then follows it

S1 owns the words that every other subplan repeats, so it decides them first and writes the
decision in its commits. Three of them:

1. **The cause names** (22) — the union of `CONFIG_CAUSES` groups in `src/refusal.js` and the
   `SITES` map in `tools/refusals.js`. English names are plain lower-case phrases that say what
   went wrong (`unknown flag`, `flag without a value`, `repeated flag`, `two modes at once`,
   `extra word`, `command with a mode`, `unknown command`, `incompatible flag`, `no commit`,
   `no JSON answer`, `two answers at once`, `settings file missing`, `settings not parsed`,
   `settings invalid`, `no git`, `not a git repository`, `config already there`, `no such commit`,
   `commit named loosely`, `commit outside the history`, `foreign hook`, `foreign core.hooksPath`,
   `nothing to call the tool with`, `file is not JavaScript`, `minifier did not parse it`).
   The exact wording is settled in the commit where the rename happens; the constraint that matters
   is **one name per cause in three files at once** (below).
2. **The advice marker.** Today `починка: ` (17 occurrences in `tools/refusals.js` alone and 14 in
   `src/args.js`), with the family `создайте его: ` (`src/config.js`), `соберите её: `
   (`src/modes.js`, and the same words in `tools/gates/dup.js`), `локально: ` / `в CI: `
   (`src/git.js`), `дальше: ` (`src/init.js`). The proposal: **`fix: `** for the main marker,
   `create it: `, `build it: `, `locally: `, `in CI: `, `next: ` for the rest. `fix:` is chosen
   because it mirrors the current word in length and position (`  fix: <command>`), and the price
   of a longer marker (`to fix: `) is the width of the help and of every quoted line.
3. **The migration rule for the marker.** The extractor lives in one place —
   `ADVICE_LINE = /(?:починка|создайте его|соберите её|локально|в CI): (.+)$/` in
   `tools/refusals.js:111`, read by `adviceOf()`. Until the last subplan changes its own messages,
   that regex **accepts both** the Russian and the English marker; the tolerance is removed by the
   subplan that finishes the last module carrying advice — W1, whose wash-up removes the Russian
   alternative from `ADVICE_LINE` once no module prints a Russian marker. A `must` phrase in `CASES` is edited in the same commit as the message it quotes.

## Joint edits — the readers that must change in the same commit

These are not gate files (only `tools/gates/**`, `tools/suites.js`, `test/gates-*.test.js`,
`package.json`, the workflows, the hooks and the baselines are), so the edits are allowed — but
each one is a promise about the text, and skipping it reddens a guard rather than a document.

| Reader | Where | What it reads |
|---|---|---|
| `tools/docs-facts.js:135` | `usageCommands` | splits `USAGE` on `'\nКоманды:\n'` and takes the first word of every line of the section |
| `tools/docs-facts.js:175,177` | `commandsAt(rev)` | reads `'Команды:'` and `'Режимы:'` out of a **historical** revision (`git show <pin>:src/refusal.js`) |
| `test/docs-commands.test.js:36` | `usageCauses()` | splits `USAGE` on `'Причины отказа кодом 2'` and compares the lines with `CONFIG_CAUSES` |
| `test/docs-commands.test.js` | `readmeCauses()` | parses the `| 2 |` row of `README.md` as `**group** (cause, cause)` and compares it with `CONFIG_CAUSES` |
| `test/cli.test.js:33` | the help | `assert.match(res.stdout, /Коды выхода/)` |
| `test/cli.test.js:189,193,246,297` | the grammar's refusals | `/лишнее слово «b\.html»/`, `/«extra» лишний/`, `/нет ответа в JSON/` |
| `tools/refusals.js` | `SITES` (22 keys + `EXIT.*`), `PRINTED` (per-file counts of `'✗ '`), `ADVICE_LINE`, `adviceOf` | the cause names, the marks, the advice marker |
| `tools/refusals.js` | `CASES` | `key` (a cause name), `must` (phrases quoted from the printed texts), `truth` (one Russian line per case — a record, not a check, but it describes a case named by a key) |
| `test/refusals.test.js:305,317,318` | the catalogue's executor | compares `must` with live output, derives a case's subject from `CONFIG_CAUSES` group names and from the literal `'коды выхода'` |
| `test/refusals-catalog.test.js` | the catalogue's counter | matches `refuseCause('…')` literals in `src/**` against `SITES` keys and the counts, and counts `'✗ '` per file against `PRINTED` |
| `test/parity.test.js:57` | `writeMode`'s summary | `/: (\d+) строк × (\d+) файлов/` — a machine-read shape of a printed line |
| `README.md` | the code table | the `| 2 |` row names every group and cause of `CONFIG_CAUSES` |

Note what this means for the tracker's split: renaming a cause edits `tools/refusals.js` (W1) and
`test/refusals.test.js` / `test/refusals-catalog.test.js` (C2) **in the same commit**, and that
content is then done for those files' cause/catalogue lines — W1 and C2 keep the rest of their own
scopes. A cause is one vocabulary in three files; splitting it across subplans would leave the tree
red between commits, which the commit rule forbids.

## Correction, measured 2026-09-16 while planning C2 — a negative match is a reader too

The step that renames the causes has one more reader than this plan named:
`test/check.test.js:235` asserts `assert.ok(!/нет такого коммита/.test(away.stderr), …)` — the cause
`нет такого коммита` must **not** appear where the commit is known but outside the report. It is a
**negative** match over a printed text, so once the cause is renamed the regex matches nothing whatever
the tool says and the assertion becomes a statement about the absence of a Russian word: green forever,
guarding nothing. It has to be re-pointed to the English cause in the same commit as the registry, and
the same rule holds for every renaming in this subplan.

A negative match over **allow-listed data** is the other case and needs no re-pointing, because the
data does not move — the distinction is written out in `tests-cli.md` (C2), which also found two
readers of the same kind in S4's files.

## Order of work — five steps, one commit each

Measured discipline: ≤ 600 lines and ≤ 10 files per commit; `pnpm run verify:fast` green before
each; the counter above run per file before and after.

**Step 1 — the help, and its machine-read markers.** Translate the `USAGE` prose and headings
(`Commands:`, `Modes:`, `Flags:`, the code paragraph, the "one run at a time" paragraph, the
`the causes of a code-2 refusal` heading), keeping the section's **shape**: one entry per line,
the first word is the command or flag, continuation lines indented. Joint edits:
`tools/docs-facts.js:135` (the section marker) and `tests/docs-commands.test.js:36` (the cause-block
marker) in the same commit; `test/cli.test.js:33` changes its pattern. The cause lines themselves
stay Russian until step 3 — they are printed from `CONFIG_CAUSES`, and both sides of the
`usageCauses` comparison stay consistent meanwhile.
`commandsAt` (history) needs care: the pin in `README.md` points at a released revision whose file
still says `'Команды:'`, so the function gets **both** markers in this commit and the Russian one
is dropped only when the pin has moved past the rename (`BLOCKERS.md` N20 — the release cadence is
the mission agent's decision, so the tolerant form may live for a while).

**Step 2 — the grammar's refusal messages** (`src/args.js`, 12 messages + their advice tails).
Joint edits: the `must` phrases of the eleven command-line cases in `tools/refusals.js`, the
`ADVICE_LINE` regex (it gains the English markers, keeping the Russian ones), and the patterns of
`test/cli.test.js:189,193,246,297`. The `SITES` counts do not change: no cause is renamed and no
site is added.

**Step 3 — the cause registry** (`CONFIG_CAUSES` in `src/refusal.js`: five group names, 22 cause
names) together with the internal `Error('причина отказа не объявлена: …')`. This is the
cross-file step: `README.md`'s code table, `tools/refusals.js` (`SITES` keys, `CASES[].key`,
`must`, `truth`), `test/refusals.test.js:317-318` and `test/docs-commands.test.js` are edited in
the same commit. The check that proves the rename complete is
`test/refusals-catalog.test.js` (a key missing in one file is a discrepancy) and the check that
proves the texts still tell the truth is `test/refusals.test.js` (a live run per case).
`test/refusals-catalog.test.js` also holds the closed list of uncatchable refusals by **id**
(`'внутренняя ошибка'`) — that id is a name in the catalogue, so it moves with the case it names.

**Step 4 — what the modes print** (`src/cli.js`, 4 lines; `src/modes.js`, 13 lines). `КБ` → `KB`
(the only place that prints a unit); the `✗`/`✓`/`!`/`·` marks stay as they are; the summary
shape `: N строк × M файлов` becomes `: N rows × M files` and `test/parity.test.js:57` is edited
with it. Joint edits in `tools/refusals.js`: the cases `id: 'нет файла таблицы'` and
`id: 'таблица разошлась с историей'` — their ids and the `must` phrases quoting these lines.
`PRINTED` counts are unchanged (the marks did not move).

**Step 5 — the wash-up for the four files.** Remove the transitional tolerance from `ADVICE_LINE`
only if every module that prints advice has been translated (otherwise leave it and say so in the
commit: the tolerance is not a debt marker, it is a fact about the tree until the last subplan).
Run the counter: `rg -cP '[\p{Cyrillic}]' src/refusal.js src/args.js src/cli.js src/modes.js` must
answer nothing. Fix nothing else: no "while I am here" edits, no reflowing, no renaming.

## What proves each step (the sensors that already exist)

- `pnpm run verify:fast` — the strict linter, the bloat sensors, the duplication sensor, the
  dependency sensor, and the fast suite. The steps that matter here: `test/refusals-catalog.test.js`
  (the catalogue's counts and keys against the sources), `test/refusals.test.js`,
  `test/docs-commands.test.js` (the help against the registry and against `README.md`),
  `test/cli.test.js`, `test/docs-numbers.test.js` (nothing here changes a count, which is the
  point: a check that had to be re-counted would mean a test file changed).
- `pnpm run verify` before the portion is pushed — it adds `test:all`, `parity:live`,
  `check:standards` and `pack:check`. **Expected green, and that is a measured claim rather than a
  hope:** neither frozen reference carries any of these strings — `rg -c 'починка|Команды|Режимы|Коды выхода' fixtures/*/*` answers nothing, and the report artifacts are built
  from the `ru` dictionary, which this subplan does not touch. The one string of this layer that
  **does** live in the frozen `--json` is `SKIP_WORDS` in `src/history.js` (S4's file: `только
  таблица` 49× and `без изменения объёма` 5× inside `fixtures/parity/data.json`, and twice in
  `fixtures/synthetic/golden.json`) — recorded as `BLOCKERS.md` N24 and deliberately out of S1.
- The Cyrillic counter, per file, before and after — the only instrument that says the step is
  finished rather than merely green.

**Red first, per step, where a guard is involved** — the plan asks for one experiment per step,
quoted in the worklog entry, so that the promise "the guard would have caught it" is measured
rather than asserted:

- step 1: change the section marker in `USAGE` alone → `test/docs-commands.test.js` reddens on the
  call list (the commands the instructions name are no longer in it);
- step 2: translate one `must` phrase's text in `src/args.js` without the catalogue → a case in
  `test/refusals.test.js` reddens ("the catalogue promises advice that is not in the output");
- step 3: rename one cause in `src/refusal.js` alone → `test/refusals-catalog.test.js` reddens with
  the name of the orphaned key;
- step 4: change the summary shape without `test/parity.test.js:57` → that check reddens on the
  number of rows it cannot read;
- step 5: nothing new is written, so the experiment is the counter over the four files.

## Acceptance

- `rg -cP '[\p{Cyrillic}]' src/refusal.js src/args.js src/cli.js src/modes.js` answers **nothing**.
- `pnpm run verify` green (fast profile after every commit, full before the portion is pushed).
- The number of refusal sites (`SITES`), the number of printed refusals (`PRINTED`) and the
  command list derived from the help (`usageCommands`) are **unchanged** — a behaviour-change
  detector that costs nothing: they are counts of a machine-read vocabulary.
- Exit codes, the set of causes, the set of commands and flags, the format of `--json` and of
  `--data`, and the reference artifacts are untouched; `pnpm run check:standards` and
  `test/parity.test.js` prove the last two.
- The release rule of `AGENTS.md` applies (a shipped literal changed): cadence per `BLOCKERS.md`
  N20, and the journal section of the release names the user-visible change — the package now
  prints English.

## Out of scope of this subplan

- `src/locales.js` and `DEFAULT_CONFIG.locale` (`BLOCKERS.md` N19 — a decision, not a step).
- Every other module's texts: settings (`src/config.js`, `src/project.js`, `src/init.js`), the
  measurement (`src/metrics.js`, `src/minify.js`, `src/strip/**`), the diagnostics
  (`src/check.js`, `src/doctor.js`, `src/explain.js`, `src/git.js`, `src/history.js`), the hook
  (`src/hook.js`), the instruments and sensors of the repository, and the tests' own messages.
  Each is S2–S5, W*, C* of the tracker.
- `src/history.js`'s `SKIP_WORDS`: it is S4's file and it is frozen into both references
  (`BLOCKERS.md` N24) — S1 names it here only so that the expected-green claim above is honest.
- The help's *content*: no command, flag, cause or code is added, removed or reordered. Where the
  English wording wants a shorter sentence, the sentence gets shorter; the facts stay.

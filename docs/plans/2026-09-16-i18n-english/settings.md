# S2 — the settings: what a settings file says when it is wrong, and what `--init` prints

2026-09-16. Parent: `plan.md` (T0). Predecessor to read first: `surface.md` (S1) — this subplan
**follows S1's vocabulary** instead of inventing its own, and the reconciliation is below rather
than left to whoever gets there first.

Nothing here changes behaviour: only the values of string literals change. The keys of a settings
file, the defaults, the list of checks in `validateConfig`, the columns a profile derives, the
order of the printed lines, the exit codes and the returned fields all stay exactly as they are.

## Scope: three files, 57 lines with Cyrillic (measured 2026-09-16)

| File | Lines with Cyrillic | What exactly is Russian |
|---|---|---|
| `src/config.js` | 35 | the two git dead ends (`git не запустился: его нет в PATH … поставьте git …`, `git не видит здесь репозитория … git init`), the missing-file refusal (`нет файла настроек … создайте его: …`), the unparsable one (`не разобран …: … починка: правьте …`), the whole body of `validateConfig`'s `fail` texts (`не задано ни одной колонки (columns)`, `колонка №N должна быть {label, paths: […]}` , `метка колонки «…» повторяется`, `категория «…» … неизвестна`, `не заданы метрики (metrics)`, `неизвестная метрика «…»`, `неизвестный способ минификации «…»`, `неизвестное семейство токенизатора «…»`, `неизвестная кодировка токенизатора «…»`, `неизвестная локаль «…»`, `hooks.enabled — не «да/нет»: …`, `файл таблицы (…) не может быть колонкой`, `не задан output`, `journal.path не задан`, `journal.pattern не задан`, `journal.pattern не компилируется: …`) with the common prefix `конфиг <path>: ` and the tail `починка: правьте <path>`, the value `настройки, выведенные из проекта` of `cfg.path`, and `outsideFix`: `допишите эти пути колонкой или в «skip» файла size-table.config.json: …` |
| `src/init.js` | 18 | the nine draft lines of `draftLines` (`✓ настройки выведены из проекта и закреплены: …`, `колонок: …`, `исключено путей: …`, `метрика min: …`, `метрика tok: …`, `журнал: …`, `  дальше: правьте колонки и метрики …`, the `package.json` advice and the CI advice), the `конфиг уже есть: … перезапишите черновиком: …` refusal with its advice, and the `!` note of `noteNoColumns` |
| `src/project.js` | 4 | `derivedSummary` (`настройки выведены из проекта (файла нет): колонок N … исключено путей M`) and `derivedLines`'s second line (`  закрепить их файлом (…): ` + the `--init` call) |

Under the tracker's instrument:

```bash
rg -cP '[\p{Cyrillic}]' src/config.js src/init.js src/project.js   # 35 18 4
```

## What stays Russian here, and why

- **The dictionaries** (`src/locales.js`, 45 lines): S1's rule, unchanged — the `ru` table is data,
  and the `locale` key is a value of the settings rather than a message about them.
- **the settings file's shape**: `CONFIG_NAME` (`size-table.config.json`), every key name, the
  category and metric identifiers (`raw`, `min`, `tok`, `code`, `docs`, `chore`, `assets`), the
  engine names (`strip`, `esbuild`), the encoding (`o200k_base`) and the journal pattern's named
  groups are **names a project writes**, not prose: they are quoted back in the messages
  (`неизвестная метрика «min»`) and compared by tests (`test/minify.test.js` wants `strip, esbuild`
  in the text, which is the list of identifiers). They do not change.
- **The settings draft template** (`templates/size-report.config.json`, its Russian `title` and
  `heading`): subplan D1's file, not this one.
- **The tracker's allow-list**: journals, frozen fixtures, quoted old output in records.

## Reconciliation with S1's vocabulary (and the two divergences to be aware of)

S1 fixes three things this subplan emits. Written out so that neither subplan has to guess:

**1. Cause names.** S2's files are the site of six of the twenty-two causes, and their English names
were pinned by S1 (`surface.md`, "the vocabulary this subplan fixes"):

| Cause today | S1's name | Emitted from |
|---|---|---|
| `нет git` | `git missing` | `src/config.js` (`gitRoot`) |
| `не git-репозиторий` | `not a git repository` | `src/config.js` (`gitRoot`) |
| `нет файла настроек` | `no settings file` | `src/config.js` (`loadConfig`) |
| `настройки не разобраны` | `settings not parsed` | `src/config.js` (`loadConfig`) |
| `настройки неверны` | `settings invalid` | `src/config.js` (`validateConfig`) |
| `конфиг уже есть` | `config already exists` | `src/init.js` (`initMode`) |

**Corrected 2026-09-16 by measurement, after S1's step 3 landed:** three of the names above were
predicted differently while this subplan was being written (`no git`, `settings file missing`,
`config already there`) and the registry holds the three in the left column of this table instead.
S2 reads the names from `CONFIG_CAUSES` and writes no cause anywhere — that is what S1's step 3
did, and the table is here only so that a reader of this subplan sees the words it will find in
the messages.

**The divergence to respect:** the rename of a cause argument belongs to **S1's step 3**, which
edits the registry (`CONFIG_CAUSES`), the call sites, `tools/refusals.js`'s `SITES`/`CASES` and the
two refusal checks in **one commit** — that is what keeps the tree green. So S2 **never renames a
cause**: it translates the message beside the argument, and the argument changes in S1's commit.
If S2 lands before S1's step 3, the tree is green between them (the catalogue still keys on the
Russian cause while its message is English), and the worklog entry says so — an argument in Russian
beside an English message is a transitional state, not an oversight. The preferred order is S1's
steps 1–3 first, then S2; the reverse is allowed and costs nothing but that note.

**2. The advice marker.** S2 emits the whole family: `починка: ` (4 in `src/config.js`, 1 in
`src/init.js`), `создайте его: ` (`src/config.js`), `дальше: ` (`src/init.js`). S1's choice is
`fix: `, `create it: `, `next: `; S2 uses them and edits the readers that quote them (below).
The extractor's tolerance (`ADVICE_LINE`, S1's step 5) covers the transition, so no step of this
subplan has to wait for another.

**3. A literal this subplan owns but another subplan prints.** `outsideFix` (config.js) is printed
by `src/check.js:119` and `src/explain.js:78` — both **S4's files** — and it is the one phrase the
two answers share on purpose. Therefore: S2 translates `outsideFix`, S4 translates everything around
it and **does not touch the phrase itself**; the sentence stays one text for two answers (the reason
is written in `src/config.js`'s own comment). Same shape, smaller: `derivedSummary`/`derivedLines`
live in `src/project.js` (S2) while `derivedLines` is printed by `src/cli.js` (S1) and
`derivedSummary` by `src/doctor.js:97` (S4) — the words are S2's, the printing is not.

**A duplication risk to watch.** `src/config.js` says `закрепить их файлом (…): ` and
`src/doctor.js:97` says `закрепите их файлом: ` — two spellings of one advice, already distinct.
`pnpm run dup` guards new clones, and making the two more alike (both `fix the settings with: `, for
instance) would trip the sensor. Keep the two phrasings distinct, and if the sensor reddens, change
the phrasing rather than the baseline (`AGENTS.md`).

## Readers — the literals below are promises about text, and each reader reddens if edited alone

| Reader | Where | What it reads |
|---|---|---|
| `tools/refusals.js` | `CASES` | the seven cases keyed by S2's causes — `key`, the `must` phrases (`'git не видит здесь репозитория'`, `'сейчас смотрю в '`, `'git init'`, `'нет файла настроек'`, `'создайте его: '`, `'не разобран'`, `'починка: правьте'`, `'не задано ни одной колонки'`, `'должна быть {label, paths:'`, `'git не запустился: его нет в PATH'`, `'поставьте git'`, `'конфиг уже есть'`, `'перезапишите черновиком: '`) and the `truth` line of each |
| `tools/refusals.js` | the printed case `id: 'покрытие неполно'` | `must: ['покрытие:', 'починка: допишите эти пути колонкой или в «skip»']` and an advice text quoting `outsideFix` word for word |
| `tools/refusals.js` | `SITES` | the counts per cause — **unchanged** by this subplan (no site is added or removed) |
| `test/check.test.js:139,151,165` | `outsideFix` and the advice marker | `/колонкой или в «skip»/`, the exact `STEM = 'допишите эти пути колонкой или в «skip» файла size-table.config.json: '` (compared with `String.prototype.slice(0, STEM.length)` and with `line.slice(head.length, head.length + STEM.length)`), and `head = '  починка: '` |
| `test/cli.test.js:45,69` | `derivedLines` | `/настройки выведены из проекта/` and its absence once a file is pinned |
| `test/cli.test.js:149,157` | the settings refusals | codes only (through `refusal()` in `tools/harness.js:165`, which reads code, stack and non-empty stderr) — the patterns are the assertion's own words, so nothing here has to follow the text |
| `test/cli-paths.test.js:103` | the `git init` advice of the "no repository" refusal | `/^\s*починка: .*git init$/m` — a **machine** read of the marker **and** the command, **found by the full run rather than by this plan** (step 1 of S2 reddened it: the marker moved to `fix: ` and the check found no advice line at all). Its neighbour at `:94` reads `history.js`'s marker instead (S4), which is why only this one moves here |
| `test/module.test.js:258,284` | `derivedLines`'s `--init` hint | `res.stderr.match(/закрепить их файлом[^:]*: (.+)$/m)` — a **machine** read of the phrase, used to extract the hint it quotes |
| `test/doctor.test.js:64,132` | `derivedSummary` and `validateConfig`'s text through `doctor` | `/настройки выведены из проекта/` and `/неизвестная метрика/` over doctor's answer |
| `test/minify.test.js:286` | `checkMinify` | `/strip, esbuild/` — identifiers, so unaffected, and named here as the proof that the list of engines must stay |
| `test/templates.test.js:49,150` | the draft | reads the draft's **keys** and assembles a real report with it — no message text, but the draft has to keep passing `validateConfig` |
| `test/api.test.js` | the freeze | the public list of 55 names: none may be added or lost while these files are edited |

## Order of work — four steps and a wash-up, one commit each

Budget and habits as in S1: ≤ 600 lines and ≤ 10 files per commit, `pnpm run verify:fast` green
before each, the counter per file before and after.

**Step 1 — `src/config.js`.** The two git dead ends, the two file readings (`нет файла настроек`,
`настройки не разобраны`), the whole `fail` family of `validateConfig` with its prefix and tail, the
value of `cfg.path`, and `outsideFix`. Joint edits: the `must`/`advice` lines of the seven cases in
`tools/refusals.js`, `test/check.test.js:139,151`, `test/doctor.test.js:132`, and — found by walking
the strings rather than by reading this plan — the quotation of one of them inside `src/init.js:49`
(`«не задано ни одной колонки»` → `«no columns are given (columns)»`): the surrounding sentence is
step 2's, the quoted fragment belongs to the text it quotes.

The advice markers this step prints are `fix: ` (four sites) and `create it: ` (one). **Measured
correction to the plan:** `test/check.test.js`'s `head = '  починка: '` does **not** move here — that
line is printed by `src/check.js:119`, so the marker is S4's and the check's `head` moves with S4's
step. What step 1 moves in that check is the two places where the shared phrase is sliced
(`:139`, `:151`), because the phrase itself is `outsideFix` and this step owns it.
Keep the prefix-and-tail shape (`<settings file> <path>: <what is wrong>` + `fix: <what to edit>`):
two tests slice at a fixed length, and a reader's eye uses the same seam.

**Step 2 — `src/init.js`.** The nine draft lines, the `config already there` refusal with its
advice, and the `!` note of `noteNoColumns` (a note, not a refusal — the mark and the code must keep
saying the same thing, which `tools/refusals.js`'s `PRINTED` map counts). Joint edits: the
`конфиг уже есть` case in `tools/refusals.js` (`must` names `перезапишите черновиком: ` and
`--force`); `test/cli.test.js:137-140` reads the draft's columns, not the text. Do **not** reflow the
lines: `draftLines` returns a list read as a whole, and the two continuation lines (`          `)
keep their own indentation.

**Step 3 — `src/project.js`.** `derivedSummary` and the `--init` hint of `derivedLines`. Joint
edits: `test/cli.test.js:45,69` and `test/module.test.js:258,284` (the hint's regex is the second
machine reader of a phrase in this subplan, after the advice extractor). Note in the commit that the
words are this file's while the printing is `src/doctor.js`'s (S4) and `src/cli.js`'s (S1) — no edit
there, only the visible output changes.

**Step 4 — the cause arguments, or a statement that there is nothing to do.** If S1's step 3 has
landed, the six arguments of S2's files are already English: run the counter and record that the
step was empty. If it has not, this step stays empty anyway and the worklog entry says which commit
will carry the arguments (S1's step 3) and why the split is safe (the catalogue keys on the cause,
which keeps its name until the whole vocabulary moves in one commit).

**Wash-up.** The counter over the three files must answer nothing:

```bash
rg -cP '[\p{Cyrillic}]' src/config.js src/init.js src/project.js
```

Leave `ADVICE_LINE`'s tolerance alone if any other subplan still prints a Russian marker, and say so
in the commit. No reflowing, no renames of keys or fields, no "while I am here".

## What proves each step (the sensors that already exist)

- `pnpm run verify:fast` — `test/refusals-catalog.test.js` (site counts and `PRINTED`), the fast
  suite (`test/cli.test.js`, `test/check.test.js`, `test/doctor.test.js`, `test/module.test.js`,
  `test/minify.test.js`, `test/templates.test.js`, `test/api.test.js`), plus `lint:strict`, `metrics`,
  `dup` (see the duplication risk above) and `deps` (this subplan adds no import).
- `pnpm run verify` before the portion is pushed — `test:all`, `parity:live`, `check:standards`,
  `pack:check`. **Expected green, and it is a measurement rather than a hope.** Neither frozen
  reference carries a message of this subplan: the fixtures' own settings
  (`fixtures/*/config.json`) hold `title`, `heading`, column labels and `fixCommand` — settings
  *values*, which this subplan does not touch — and of the whole layer only two lines of
  `fixtures/parity/data.json` contain one of these words at all, both of them the **consumer's
  commit subjects** in the frozen history (`refactor(tools): генератор таблицы стал переносимым —
  конфиг вместо ядра`), measured with `rg -o '[^"]*(починка|настройки|конфиг)[^"]*'
  fixtures/parity/data.json`. A subject of someone's history is data, not a string of this tool.
  The one Russian string of this layer that **is** frozen is `SKIP_WORDS` in `src/history.js` —
  S4's file, `BLOCKERS.md` N24, deliberately out of this subplan.
- The counter per file, before and after — the only instrument that says a step is finished rather
  than merely green.

**Red first, per step** — one experiment, quoted in the worklog:

- step 1: translate the `must` phrase of the `настройки неверны` case's text in `src/config.js`
  alone → `test/refusals.test.js` reddens ("the catalogue promises a phrase that is not in the
  output");
- step 1 (the machine reader): change the `outsideFix` wording without `test/check.test.js` → that
  check reddens on its `STEM` slice;
- step 2: change the advice marker in `src/init.js` without `tools/refusals.js` → the
  `конфиг уже есть` case reddens;
- step 3: change the hint's opening words without `test/module.test.js` → the regex finds nothing and
  the test fails on an undefined hint (`res.stderr.match(...)` returns null);
- wash-up: the counter.

## Acceptance

- `rg -cP '[\p{Cyrillic}]' src/config.js src/init.js src/project.js` answers **nothing**.
- `pnpm run verify` green (fast after every commit, full before the portion is pushed).
- **Behaviour is provably untouched, and the proofs are cheap:** `SITES` and `PRINTED` counts
  unchanged (`test/refusals-catalog.test.js`); the public API list unchanged (`test/api.test.js`);
  the settings keys, the defaults and the derived profile identical — the diff over these three
  files touches string literals only, which `git diff -U0` shows at a glance and `test/api.test.js`,
  `test/contract-data.test.js` and `test/templates.test.js` hold from the outside.
- The cause arguments of this subplan are English exactly when S1's step 3 has landed, and the
  worklog entry says which of the two states the tree is in.
- The release rule applies (shipped literals changed): cadence per `BLOCKERS.md` N20.

## Out of scope of this subplan

- `src/locales.js` and `DEFAULT_CONFIG.locale` (N19 — a decision, not a step); the `ru`/`en`
  dictionaries are S1's named exception and stay.
- The cause **registry** in `src/refusal.js` (`CONFIG_CAUSES`) and the names in
  `tools/refusals.js`'s `SITES` — S1's step 3, in one commit with the call sites of this subplan.
- `src/check.js` and `src/explain.js`: they print `outsideFix` but own none of its words (S4).
- `src/doctor.js`'s own findings and the `закрепите их файлом: ` line (S4); `src/cli.js`'s texts and
  `derivedLines`'s printing (S1).
- The settings draft template and its Russian `title`/`heading` (D1).
- Everything else on the tracker's map: the tests' own message texts (C2), the instruments and the
  sensors (W1, W2), the reports (S3) and the hook (S5).

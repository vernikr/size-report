# S4 — the diagnostics: `check`, `explain`, `doctor`, and the git/history boundary

2026-09-16. Parent: `plan.md` (T0). Follows `surface.md` (S1), `settings.md` (S2) and
`measurement.md` (S3): same rules about cause names and advice markers, same habit of naming the
readers of every literal — and, because this layer owns the one frozen literal of the runtime, an
explicit order that keeps every commit green.

Nothing here changes behaviour: only the values of string literals change. The coverage rule, the
skip reasons, the `--json`/`--data` shapes, the exit codes, the doctor's order of findings and the
fields of every answer stay exactly as they are.

## Scope: five files, 84 lines with Cyrillic — one of them frozen

| File | Cyrillic lines | What exactly is Russian |
|---|---|---|
| `src/history.js` | 12 | **`SKIP_WORDS`** (`{merge: 'merge', report: 'только таблица', flat: 'без изменения объёма'}`) — the one frozen literal of this layer, below; the two `EXIT.VIOLATION` refusals of `assertMatchesDisk` (the lost edit carried between commits, and the edit that exists on disk only) with their advice; and the `!` note about a report updated together with code |
| `src/git.js` | 3 | the shallow-history refusal: `история обрезана (shallow clone): таблица строится по всей истории коммитов.` with the two ways out (`локально: git fetch --unshallow`, `в CI: actions/checkout с fetch-depth: 0`) |
| `src/check.js` | 12 | `REASON_WORD` (the three words of the reason summary) and the whole `coverageText`: the `✗ покрытие:`/`✓ покрытие:` line, the per-path lines with the introducing commit, the `… ещё N`, the `  история: N коммитов …` counts line, the wrapped reason lists and the `  пути: …` line |
| `src/explain.js` | 24 | `REASON_TEXT` (four explanations), `FIX` (three), the three refusals of `lookup` (`коммит вне истории`, `нет такого коммита`, `коммит назван неточно`) and the whole `explainText` |
| `src/doctor.js` | 33 | `UNREADABLE`, the two `не спрашивается: …` dependency notes, the note and fix of a hook installed but switched off, the note of a hook whose last run rebuilt nothing, the note of a coverage that was not counted, the six `HOOK_RESULT` words, `hookLine` and the whole `doctorText` (the verdict line, `окружение`, `git читается с закреплениями`, `настройки`, `зависимости`, `хук`, the findings and the `  починка: ` lines) |

Under the tracker's instrument:

```bash
rg -cP '[\p{Cyrillic}]' src/git.js src/history.js src/check.js src/explain.js src/doctor.js
```

## The frozen literal: `SKIP_WORDS` (this is `BLOCKERS.md` N24, and no decision is taken here)

Measured 2026-09-16, because it decides the order of this subplan:

- `src/data.js:79` puts `dropped.map(skipLine)` into the **contract** (`--data`) and
  `src/modes.js:175` into the older `--json`, so both answers carry one of these words per skipped
  commit;
- `fixtures/parity/data.json` holds `(только таблица)` 49 times and `(без изменения объёма)` 5 times,
  `fixtures/synthetic/golden.json` twice; `test/parity.test.js` compares `--json` with the synthetic
  golden **byte for byte** and `test/contract-data.test.js:47` compares `data.skipped` with the same
  golden;
- `test/frozen.test.js` runs the **frozen copy** and requires its `--json` to equal that golden — the
  copy is what tells "the standard moved" from "the engine broke", so a package that stops matching
  while the copy still matches is exactly the red the reference exists for;
- `pnpm run check:standards` stays **green**: both references are re-taken by the generators, and the
  generators call the frozen copy (`legacyTool()` in `tools/parity-freeze.js` and
  `tools/make-fixture.js`), not the package. `fixtures/parity/artifact.sha256` does not move either —
  the artifact deliberately leaves the skipped list out (`NOT_IN_FILE = ['skipped']`,
  `src/page/build.js:92`).

**The three options, with their price, left to the mission agent (`BLOCKERS.md` N24):**

1. **Move the three words into the locale dictionaries** (`src/locales.js`), picked by `cfg.locale`.
   The fixtures pin `"locale": "ru"`, so every frozen byte stays as it is and **nothing reddens**; the
   price is a source change in `src/history.js` (a constant becomes a lookup) and a behaviour change
   for a project that asks for `locale: "en"` — the English it asked for. It is not a translation of
   a literal, so it is a decision recorded in `BLOCKERS.md`, not a step of this subplan.
2. **Translate `SKIP_WORDS` and re-take the expectations by hand.** The red moves into
   `test/frozen.test.js`'s promise (the golden and the manifest's `legacy.goldenSha256` would have to
   be edited), i.e. the reference stops being the record of what that revision yields. The highest
   price, and the generators cannot pay it — they take the standard with the frozen copy.
3. **Leave them Russian and name them in the allow-list** beside the `ru` dictionaries: the cheapest,
   and the `--json`/`--data` answers keep one Russian word per reason in every locale — the mission's
   criterion then carries a named exception instead of a plan it cannot afford.

**Until that decision, the line is not touched**, and it is the reason this subplan's steps come in
the order below: everything else in S4 lands green without it, so the tree never goes red between
commits.

## What stays Russian here, and why

- `SKIP_WORDS` — until N24 is decided (above), named as an exception.
- The **dictionary's** words that these files print but do not own: the artifact's legend
  (`src/locales.js:67`, «Строки не получают коммиты…» — the one place in `docs/size-report.html`
  whose Cyrillic matches these files' vocabulary) is data, not a message of `check` or `doctor`.
- **`derivedSummary` and `outsideFix`**: printed by `src/doctor.js:97` and by
  `src/check.js:119`/`src/explain.js:78`, but **owned by S2** (`src/project.js`, `src/config.js`).
  S4 translates the sentences around them and never their words.
- Identifiers and flags: reason keys (`merge`, `report`, `flat`), `row.merges`, `hooks.enabled`,
  `--init`, `--unshallow`, `fetch-depth: 0`, `git log --all`, the JSON fragments
  (`"hooks": {"enabled": true}`, `"rows": { "merges": true }`), the `✗`/`✓`/`!`/`—` marks.

## Reconciliation with S1's and S2's vocabulary

- **Causes.** Three of the twenty-two are emitted here, all from `src/explain.js`: `коммит вне
  истории`, `нет такого коммита`, `коммит назван неточно`. A fourth entry of the catalogue belongs to
  the layer without being a cause: `EXIT.SHALLOW` (`src/git.js`), a code rather than a named cause, so
  it is keyed as `EXIT.SHALLOW` in `SITES` and its text is a refusal's message. The rule of S2 holds —
  the three causes are renamed in **S1's step 3**, one commit with the registry, the catalogue and the
  two refusal checks, and S4 translates the messages beside them. (`EXIT.SHALLOW` carries no cause name
  to rename: only its message and its two advice markers move, and those are this subplan's step 1.)
- **The advice marker.** S4's refusals carry `починка: ` (`git.js`, `history.js`, `explain.js`) and
  the printed texts carry `  починка: ` (`check.js`, `doctor.js`); S1's word is `fix: `, and the
  extractor's tolerance (`ADVICE_LINE`) covers the transition.
- **The `EXIT.SHALLOW` case** in the catalogue names its two ways out as `must` phrases
  (`'локально: git fetch --unshallow'`, `'в CI: fetch-depth: 0'` in the CI half) — so the two markers
  `локально:` and `в CI:` are renamed **with the catalogue**, not by grep.
- **A boundary to respect in both directions:** the hook's commit subject
  (`chore(report): отчёт пересобран после <sha>`) is **S5's** literal, asserted by
  `test/hook.test.js:191,254`; nothing in S4 may touch it. And the `!` note about a report updated
  together with code lives in `src/history.js` but is printed by every mode — its words are S4's, its
  place in a run is not.

## Readers — every literal below is a promise about text

| Reader | Where | What it reads |
|---|---|---|
| `tools/refusals.js` | case `EXIT.SHALLOW` | `must: ['история обрезана (shallow clone)', 'git fetch --unshallow', 'fetch-depth: 0']` and both advice entries |
| `tools/refusals.js` | two cases `EXIT.VIOLATION` (`coveredBy: test/disk.test.js`) | `must: ['перенос состояния между коммитами пропустил правку']` and `must: ['правка есть только на диске']`, with the advice texts naming `git checkout -- ` and `пересборкой это не лечится` |
| `tools/refusals.js` | cases `нет такого коммита`, `коммит вне истории`, `коммит назван неточно` | `must` phrases quoted from `src/explain.js` (`'не имя ревизии и не начало sha'`, `'git log'`, `'неоднозначен'`, `'починка: назовите больше знаков'`, `'нет в истории отчёта'`) and their advice |
| `tools/refusals.js` | case `id: 'покрытие неполно'` | `must: ['покрытие:', 'починка: …']` — the `✗ покрытие:` line and the fix line of `coverageText` |
| `test/disk.test.js:107,112,133,140,142,193,195,270,272` | the two violation refusals | `/правка есть только на диске/`, `/починка: закоммитьте правку или откатите её: git checkout -- /`, `/перенос состояния между коммитами пропустил правку/`, `/починка: пересборкой это не лечится/`, `/Разбор: git show HEAD:/`, `/в дереве src\/only-in-merge\.js/`, `/в состоянии файла нет/`, `/в дереве файла нет/`, `/в состоянии src\/gone\.js/` |
| `test/cli-paths.test.js:35,93,94` | the shallow refusal and the disk violation | `/--unshallow/`, `/правка есть только на диске/`, `/починка/` |
| `test/check.test.js:52,72,101,103,109,139,191,192,193,218,220,232,242,247,249,254,255` | `coverageText`, `explainText`, `REASON_TEXT`, `REASON_WORD` | `/починка: .*--init/`, `/только таблица 1/` (a `REASON_WORD`), `/числа не сдвинулись/`, `/починка: не требуется/`, `/тронут только сам отчёт/`, `/колонкой или в «skip»/` (S2's phrase, printed here), `/слияние/`, `/rows\.merges/`, `/"merges": true/`, `/не имя ревизии и не начало sha/`, `/git log/`, `/нет в истории отчёта/`, `/--help/`, `/неоднозначен/`, the prefix slicing on `head = '  починка: '` |
| `test/doctor.test.js:64,66,67,132,133,183,208,228,261,268,269` | `doctorText` | `/настройки выведены из проекта/` (S2's words), `/--init/`, `/покрытие:/`, `/неизвестная метрика/` (S2's text through doctor), `/нечитаемы/`, `/--unshallow/`, `/не JavaScript/` (S3's text through doctor), `/"engine": "strip"/` (S3's fix), `/не спрашивается/` (a dependency note), `/«extra» лишний/` and `/починка/` |
| `test/hook.test.js:313,315` | the hook findings of `doctor` | the `hooks.enabled` note and the "diagnostics silent about a switched-off hook" finding |
| `tools/harness.js:165` | `refusal()` | code, absence of a stack and non-empty stderr — the shape every refusal of this layer must keep |
| `test/api.test.js` | the freeze | the public list of 55 names (`coverage`, `coverageText`, `explainCommit`, `explainText`, `doctor`, `doctorText`, `skipLine`, `assertFullHistory`) — none may be added or lost |

## Order of work — three steps, one gated step and a wash-up

Budget and habits as in S1–S3: ≤ 600 lines and ≤ 10 files per commit, `pnpm run verify:fast` green
before each, the counter per file before and after, one red-first experiment quoted per step.

**The rule that keeps the tree green between commits:** the only frozen literal here is
`SKIP_WORDS`, and it is **not** in any of the first three steps; everything else of S4 reaches a
frozen file through no path (`--json` and `--data` carry refusals of nothing, the coverage and
doctor texts are not part of any reference, and the artifact leaves `skipped` out). So the steps
below can be done in any order, and the frozen line waits for its decision.

**Step 1 — the git boundary and the two disk violations** (`src/git.js`, the two `EXIT.VIOLATION`
refusals and the `!` note of `src/history.js`, 11 lines). Joint edits: the `EXIT.SHALLOW` case and
both `EXIT.VIOLATION` cases in `tools/refusals.js`, `test/disk.test.js:107,112,133,140,142,193,195,270,272`,
`test/cli-paths.test.js:35,93,94`. Keep the shape of both violations: the path, the two bites of
evidence, the sentence that names the class ("the edit was lost while state was carried"), and the
fix — `test/disk.test.js` slices at `Разбор: git show HEAD:` and at the `починка` marker.
**The `!` note has no reader at all** (measured: `rg -n 'обновляли вместе' src test tools` answers
inside `src/history.js` alone), so its experiment is the grep, quoted in the commit.

**Step 2 — the coverage and the explanation** (`src/check.js`, `src/explain.js`, 36 lines, one
commit, because `REASON_WORD` and `REASON_TEXT` are two spellings of one vocabulary: the coverage's
reason line and the explanation's reason sentence must agree in English as they do in Russian).
Joint edits: the three commit refusals and the `покрытие неполно` case in `tools/refusals.js`,
`test/check.test.js` (the list above), `test/doctor.test.js:67`, and the slicing assertions
(`head = '  починка: '`). Do not touch `outsideFix` — the sentence around it yes, its words no.

**Step 3 — the diagnostics** (`src/doctor.js`, 33 lines). Joint edits: `test/doctor.test.js` (the
list above), `test/hook.test.js:313,315`. Keep the shape of `doctorText`: one verdict line, the
indented blocks in order, the findings and their fixes each on its own line, and the marks
(`✓`, `✗`, `!`, `—`) where they are — `PRINTED` counts the `✗` marks per source file, and a mark
moved or doubled turns `test/refusals-catalog.test.js` red. Keep the fix line of the derived
settings (`закрепите их файлом: `) **distinct** from S2's phrasing in `src/project.js`
(`закрепить их файлом (…): `) — `pnpm run dup` is the guard of that distinction, and the answer to a
red is a re-wording, not a baseline.

**Step 4 — `SKIP_WORDS`, gated by N24.** Do not start it before the mission agent decides. Three
outcomes, each with its own commit shape: (1) the words move into the locale dictionaries — a source
change, recorded in `BLOCKERS.md` and committed with the reason, and the counter of `src/history.js`
then reaches zero; (2) the words are translated and the expectations re-taken — the commit carries
the edited `golden.json`, `data.json` and both manifests, the red-first experiment is
`test/parity.test.js` plus `test/contract-data.test.js:47`, and the commit body says plainly that the
reference stopped being reproducible by the frozen copy for that field; (3) the words stay and are
named in the allow-list — the commit is this subplan's wash-up and `src/history.js` keeps exactly one
Russian literal.

**Wash-up.** The counter over the five files answers the named exceptions only — `SKIP_WORDS` at
`src/history.js:18` (unless step 4 removed it) and nothing else:

```bash
rg -cP '[\p{Cyrillic}]' src/git.js src/history.js src/check.js src/explain.js src/doctor.js
# expected: src/history.js:1 (the skip words) and nothing for the other four
```

Leave `ADVICE_LINE`'s tolerance alone if other subplans still print a Russian marker. No reflowing,
no renames of reason keys or fields, no "while I am here".

## What proves each step (the sensors that already exist)

- `pnpm run verify:fast` — `test/refusals-catalog.test.js` (site counts and the per-file `✗` counts),
  the fast suite (`test/check.test.js`, `test/doctor.test.js`, `test/disk.test.js`,
  `test/cli-paths.test.js`, `test/hook.test.js`, `test/contract-data.test.js`, `test/parity.test.js`,
  `test/api.test.js`), plus `lint:strict`, `metrics`, `dup` (see the two phrasings of the settings
  fix) and `deps`.
- `pnpm run verify` before the portion is pushed — `test:all`, `parity:live`, `check:standards`,
  `pack:check`. **Expected green for steps 1–3, and that is measured rather than hoped:** no frozen
  reference carries a message of this layer — `rg -c 'покрытие|диагностика|история обрезана|числа не сдвинулись|не имя ревизии' fixtures/parity/data.json fixtures/synthetic/golden.json` answers
  nothing — and the two matches for the word `слияние` in the frozen data are a **commit subject** of
  another project's history (`fix(size-table): слияние — коммит как коммит: …`), not a message of
  this tool. The one frozen output of S4 is the `skipped` list, which is step 4.
- The counter per file, before and after — the only instrument that says a step is finished rather
  than merely green.

**Red first, per step:**

- step 1: translate the shallow refusal's first line alone → the `EXIT.SHALLOW` case reddens through
  `test/refusals.test.js`; translate the disk violation's advice without `test/disk.test.js:112` →
  that line reddens on the fixed slice; change the `!` note → nothing reddens, which is the measured
  statement that it has no reader;
- step 2: change a `REASON_WORD` alone → `test/check.test.js:72` reddens (`/только таблица 1/`);
  change `REASON_TEXT`'s `flat` sentence alone → `test/check.test.js:101` reddens; drop the
  `починка: не требуется` wording → `:103` reddens;
- step 3: change the verdict line's opening → `test/doctor.test.js` reddens on `/покрытие:/` or on the
  dependency note (`/не спрашивается/`); move a `✗` mark → `test/refusals-catalog.test.js` reddens on
  the `PRINTED` map, which is the proof that the marks are counted rather than decorative;
- step 4: the three outcomes each have their own experiment, named above.

## Acceptance

- The counter over the five files answers **only** the named exceptions: `SKIP_WORDS` at
  `src/history.js:18` (or nothing, if N24 is decided as (1) or (2)).
- `pnpm run verify` green (fast after every commit, full before the portion is pushed) — and for
  steps 1–3 the full profile is green **without touching a reference**, which is the whole point of
  the order.
- **Behaviour provably untouched:** `SITES` and `PRINTED` unchanged (`test/refusals-catalog.test.js`);
  the public API list unchanged (`test/api.test.js`); the `--json` and `--data` shapes unchanged
  (`test/parity.test.js`, `test/contract-data.test.js`); the coverage rule, the reasons and the
  doctor's order of findings unchanged (`test/check.test.js`, `test/doctor.test.js`); the artifact of
  this repository rebuilt by the hook only because of its own commit — one line, as always.
- The three cause arguments of this subplan are English exactly when S1's step 3 has landed, and the
  worklog entry says which of the two states the tree is in.
- The release rule applies (shipped literals changed): cadence per `BLOCKERS.md` N20.

## Out of scope of this subplan

- `SKIP_WORDS` before its decision (N24), and the `ru` dictionaries (N19).
- The cause **registry** and the catalogue's `SITES` names: S1's step 3.
- `outsideFix` and `derivedSummary`: S2's words, printed here.
- The hook's texts, its commit subject and its own diagostics (`src/hook.js`, S5); the printed
  markers and the summary shapes of `src/modes.js` (S1).
- The tests' own message texts (C2) — every reader above changes only where it asserts a phrase.
- `src/page/**`, which prints nothing of this layer; the instruments and the sensors (W1, W2).

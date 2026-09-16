# S5 — `automation`: the installed hook and the panel's chrome

Subplan of `plan.md` (T0). Owns `src/hook.js`, `src/page/panel.js`, `bin/postinstall.js`.
Written 2026-09-16; steps 1–5 and the post-install half of step 6 landed 2026-09-16, and the panel's four
literals went into the locale dictionaries the same day, when N25 was decided — not translated, so the
subplan is closed with its planned step changed in shape rather than taken. The last subplan of the runtime layer, and the only one whose
text lands **outside the repository**: the hook writes its own body into `.git/hooks/post-commit`
of someone else's project, and its commit subject into that project's history.

## Scope, by measurement

```
rg -cP '[\p{Cyrillic}]' src/hook.js src/page/panel.js bin/postinstall.js
```

| File | Lines | What the Russian is |
|---|---|---|
| `src/hook.js` | 40 | the hook file's own four lines (`script`, 114–117), three refusals (154–158, 162–164, 170–172, 246–247), what install and uninstall print (177–180, 190–198, 242, 252), the state record's `why` and the notes (344, 354, 370, 373, 380, 395, 409, 418, 421, 425, 428) |
| `src/page/panel.js` | 3 | the file box's tooltip (9–11) |
| `bin/postinstall.js` | 2 | the one line printed to stderr after the package is installed |
| | **45** | the tracker's row (45) holds |

The counter is a batch of about 45 lines, not a batch of 45 decisions: the groups below are what
the steps are built from.

## What is Russian, group by group

**1. The hook file's own text** (`script`, 114–117) — the mark line plus three comments, written
into `.git/hooks/post-commit` and `post-merge` of every project that installs the package.
`MARK` itself (`'# size-report: hook'`) is already English and is a **machine token**: `isOurs()`
(`src/hook.js:130`) and `test/hook.test.js:136` recognise the tool's own file by
`indexOf('size-report')`, and `uninstallHook` deletes by the same mark. The token survives any
translation; the words around it do not.

**2. Three refusals** — `'нечем звать инструмент'` (154), `'чужой core.hooksPath'` (162),
`'чужой хук'` twice (170, 246). Their **cause names** are S1's, not S5's (below); their texts, the
`починка: ` marker and the quoted ready line (`runLine`, 106: `node <path> hook-run`) are S5's.
The ready line carries no mark on purpose — it is copied into someone else's hook as it stands.

**3. What install and uninstall print** — the four-line answer to a repeated `install-hook`
(177–180), the five-line answer after installing (190–195), the `!` note when `hooks.enabled` is
false (198), the "nothing installed" line (242) and the "removed" line (252). `src/modes.js:146`
prints these lines (S1's file, S5's words).

**4. The state record's `why` and the notes** — the JSON in `<git-dir>/size-report/hook.json`
(`record`, 332–341): `'окружение без автообновления (CI)'` (344), `'обновление уже идёт (замок …)'`
(354), `'настройки нечитаемы: …'` (370), `'выключено настройкой hooks.enabled'` (373),
`'HEAD отделён (rebase, cherry-pick, bisect)'` (380), `'отчёт не отслеживается git: пересобран,
коммита нет'` (409); the three notes handed to stderr through `hookMode` (`src/modes.js:143`):
`'✗ size-report: внутренняя ошибка: …'` (395), `'✗ size-report: git diff -- …'` (418),
`'✗ size-report: коммит отчёта не прошёл: …'` (425), `'✓ size-report: … пересобран и закоммичен
(…)'` (428). Line 392 (`'✗ size-report: ' + e.message`) carries no Russian of its own.

**5. The panel's chrome** (`src/page/panel.js:9–11`) — `' (нет на HEAD)'`, `' · категория: '`,
`'из настроек'` / `'по расширению'`: the tooltip of every file checkbox in the report page. The
neighbouring `appUi.notMeasuredRule` / `notMeasuredChoice` come from the locale dictionary and are
**data** (S1's), not part of this batch.

**Decided 2026-09-16 (N25): these words went where their neighbours live — into the locale
dictionaries.** `src/page/panel.js` reads them from `appUi`, both dictionaries carry the four keys
(`src/locales.js`), and `uiText` (`src/page/build.js`) passes them into the page's own dictionary.
So the file's counter reads **0** and the words are data of the `ru` side, which the work's own
allow-list names — a translated chrome inside a Russian report was the one outcome the decision
ruled out. Measured in jsdom on the fixture: the ru report answers
`data/table.toml · категория: по расширению`, the en one `data/table.toml · category: by extension`.

**6. The post-install note** (`bin/postinstall.js:41–42`) — `'· size-report: хук поставлен (…) —
отчёт обновляется после каждого коммита; снять: size uninstall-hook'`, read by a person once,
after `npm i`.

## What stays Russian

| Item | Why |
|---|---|
| The `result` keys and the state's field names (`schema`, `at`, `result`, `head`, `report`, `why`, `commit`) | Identifiers, not text: `src/doctor.js` and `test/hook.test.js` read them as keys. Translating them is a behaviour change, and this work changes no behaviour. |
| The words of `src/doctor.js:217-218` (`committed: 'отчёт пересобран и закоммичен'`, `rebuilt: 'отчёт пересобран без коммита'`) | S5 owns the `result` **keys** (already English); S4 owns the words a person reads for them. S5 does not touch them. |
| The `hook-run` line of the help (`src/refusal.js:108`) and the `--json` rules around it | S1's file and S1's step. |
| The cause names of the group `хук` in `src/refusal.js:50` | S1's step 3 (`surface.md`) renames **every** cause of `CONFIG_CAUSES` and its sites in one commit — `src/hook.js` is one of those sites. By the time S5 runs, `refuseCause('foreign hook', …)` is already what stands in the file. S5 does not revisit them, and the counts of `SITES` and `PRINTED` are the free detector that it did not. |
| The marks `·`, `✓`, `✗`, `!` | Marks rather than words: `'✗ ` is counted per file by `test/refusals-catalog.test.js` (`PRINTED['src/hook.js'] = 4`). Only the words after a mark change. |
| The `ru` content of this project's own report (title, heading, category and metric labels) | Comes from the settings file and the locale dictionary; not S5's. |
| `.githooks/pre-commit` (2) and `.githooks/pre-push` (2) | Gate files, and they belong to W2 — see the map correction in `plan.md`. |

**N25 (`BLOCKERS.md`) — decided 2026-09-16: the words move into the locale dictionaries.** They were
hardcoded while every other caption of the page is picked by `cfg.locale`, so translating them would have
given a `locale: "ru"` report English chrome inside Russian content — and this repository's own tracked
report is such a report. The decision fell on the option that keeps both reports in one language each:
four keys in every dictionary instead of four literals, a lookup in `appUi` instead of a constant. It is a
code change, so it leaves the batch of literals this subplan is — and it is the step the subplan planned as
a translation, which is why the plan records the change of shape rather than a dropped step.

## Cross-ownership

| Literal | Owner | Note |
|---|---|---|
| The three cause names, the group name `хук`, the `fix: ` marker family | S1 (`surface.md`) | S1's step 3 lands them together with `tools/refusals.js` and the two refusal checks. S5 meets them already English. |
| `src/modes.js` printing the install/uninstall lines and the note | S1 | S5 owns the strings, S1 the call that prints them. |
| `tools/refusals.js`: `SITES` (4 sites here), `PRINTED['src/hook.js'] = 4`, the catalogue's four hook cases | W1 | The catalogue's `must` phrases quote S5's texts word for word, so step 3 edits them in the same commit. |
| `test/hook.test.js` — its own Russian (test names, assertion messages, the foreign hook's content) | C2 | S5 edits in it **only** the lines that read an S5 literal: 151, 191, 254, 323 (and the exact strings in them). Every other line waits for C2. |
| `package.json`'s `description` | D1 | Nothing in this subplan touches the manifest. |
| `.githooks/**`, the two baselines' `note` | W2 | Found while planning this file; the map correction is in `plan.md`, and both need the `Gate-Change:` trailer. |

## Readers of every literal

Machine readers, each named with the line that goes red:

- `test/hook.test.js:136` — `indexOf('size-report')` over the written hook file. Reads `MARK`
  (`src/hook.js:44`), not the comments.
- `test/hook.test.js:151` — `/установлен/` over the answer to a repeated `install-hook`; reads
  `src/hook.js:177`. The same commit must move the assertion.
- `test/hook.test.js:191` and `:254` — the commit subject compared **exactly**
  (`'chore(report): отчёт пересобран после ' + sha`); reads `src/hook.js:421`.
- `test/hook.test.js:295` (`/CI/`), `:308` (`/hooks\.enabled/`), `:323` (`/HEAD отделён/`) — the
  `why` of the state record; read `src/hook.js:344`, `:373`, `:380`. Only `:323` needs moving.
- `test/hook.test.js:339` — `/^✗ size-report: /` over the first line of the refusal note: the
  prefix is a contract, the words after it are not.
- `test/hook.test.js:152` (`/hooks.*enabled/`), `:404` (`/hook-run/`), `:412`
  (`/core\.hooksPath/`) — keep passing untouched: identifiers survive the translation.
- `test/hook.test.js:170`, `:173`, `:397`, `:405` — match on `'чужой хук'` written by the test
  itself into its own fixture file. The test's data, not the tool's text: no change needed.
- `tools/refusals.js:73-75` — `SITES` keys and counts (`'чужой хук': 2`,
  `'чужой core.hooksPath': 1`, `'нечем звать инструмент': 1`), counted by
  `test/refusals-catalog.test.js:62` from the sources: four `refuseCause('…')` calls in
  `src/hook.js`. S1's rename moves both sides; the **numbers** must not move.
- `tools/refusals.js:94` — `PRINTED['src/hook.js'] = 4`, refused against the four `'✗ ` literals
  measured in the file (392, 395, 418, 425). Step 5 must keep the count at 4.
- `tools/refusals.js:257-272` — the four catalogue cases for these refusals, with `must` phrases
  quoting the texts and `'починка: '` among them: step 3's second half.
- `README.md:792-793` — quotes the commit subject "as the hook writes it". A quotation that stops
  being what the tool prints is updated in the same commit (T0's rule).
- `README.md:768` — quotes the cause names of the group `хук` in the code-2 table; that is S1's
  rename, not S5's.
- `test/parity.test.js:47` — reads a built report, but asserts only `src="`, `<link `, `id="data"`
  and `<style>`: no panel word is read anywhere.

No reader at all, measured:

- the hook file's three comments (`rg -n 'обновление отчёта после коммита|Ставится и снимается|
  правки в этом файле|Коммитов хук сам не делает' src test tools` answers only `src/hook.js`);
  the only thing read out of that file is the mark;
- the panel's three literals (`rg -n 'нет на HEAD|категория:|из настроек|по расширению'` outside
  `src/` answers nothing but unrelated assertion texts of `src/config.js` and the tests' own
  messages);
- the post-install note (`rg -n 'хук поставлен|поставлен \(' tools/pack-check.js tools/gates test`
  answers nothing; `test/hook.test.js:165` is an assertion message of its own).

The frozen layer is clean for this layer, measured: `rg -c 'хук|hook' fixtures/*` answers nothing,
so no fixture carries a hook word, and `fixtures/parity/artifact.sha256` is taken by the frozen
copy (`tools/parity-freeze.js:62` spawns `legacyTool()`), which keeps printing Russian — the
artifact's *shape* moves with the frozen copy, not with the package. N24 (`SKIP_WORDS`) is S4's
and does not appear here.

## The dictionary this subplan fixes

- the commit subject: `chore(report): report rebuilt after <sha>` — the `chore(report): ` prefix
  and the scope stay (it is what a person's `git log` and `README.md:792` show, and the shape is a
  conventional commit the hooks of a consumer project would accept if they ever saw it; they do
  not: the commit is assembled with `commit-tree`);
- the advice marker: `  fix: ` (S1's family), never a second spelling — `ADVICE_LINE` accepts both
  until W1's last step, so no step here waits for another subplan;
- the state words (`why`): `environment without auto-updating (CI)`, `rebuild already running
  (lock …)`, `settings unreadable: …`, `disabled by the hooks.enabled setting`, `detached HEAD
  (rebase, cherry-pick, bisect)`, `report not tracked by git: rebuilt, no commit`;
- the stderr notes: `✗ size-report: internal error: …`, `✓ size-report: <path> rebuilt and
  committed (<sha>)`, `✗ size-report: report commit failed: …`;
- the hook file's comments: the mark line keeps `size-report`, the three comments say what the file
  is, that a command overwrites it whole, and that the hook itself commits nothing;
- the panel's tooltip (moved into the dictionaries by N25): `<path> (not on HEAD) · category: …`
  with `from the settings` / `by extension` in the `en` side while the `ru` side keeps its own words;
- the post-install note: `· size-report: hook installed (…) — the report refreshes after every
  commit; remove: size uninstall-hook`.

## Steps — one commit each, red first0. **Re-measure before starting — done 2026-09-16.** After S1–S4 the counter over the three files
   reads `src/hook.js` 40, `src/page/panel.js` 3, `bin/postinstall.js` 2 — **45**, the row's own number to
   the line. The `refuseCause` calls of group `хук` were already English (S1's step 3), exactly as predicted.
1. **The hook file's comments — done 2026-09-16** (114–117; the mark line and three comments, with
   `MARK` itself untouched — `test/hook.test.js:136` still reads `size-report` out of the written
   file). Red first: delete `size-report` from `MARK` alone → `test/hook.test.js:136` goes red; put it back.
2. **Install/uninstall output — done 2026-09-16** (177–180, 190–198, 242, 252) together with
   `test/hook.test.js:151` (`/установлен/` → `/already installed/`). The JSON fragment
   `"hooks": {"enabled": false}` and the commands survived verbatim, so `:152` (`/hooks.*enabled/`)
   and the uninstall cases kept passing untouched. Red first: line 177 back to Russian reddens `:151`.
3. **The three refusals — done 2026-09-16** (154–158, 162–164, 170–172, 246–247) with the `fix: `
   marker and the four catalogue cases in `tools/refusals.js` in the same commit. The cause names were
   **not** part of this step (S1's, already English), and `SITES` still reads 4 sites. Red first: a
   catalogue `must` phrase back to Russian reddens `test/refusals.test.js`
   (`«hook / foreign hook»: в отказе нет «уже есть и поставлен не этим инструментом»`).
4. **The commit subject — done 2026-09-16**: `chore(report): report rebuilt after <sha>` (421) with
   `test/hook.test.js:191`, `:254` and `README.md:792-793`. Red first, measured: the subject back to
   Russian reddens both assertions (`expected: 'chore(report): report rebuilt after 8cbb71a'` against
   `actual: 'chore(report): отчёт пересобран после 8cbb71a'`) — and that is all it does: no reference
   moves (`fixtures/**` still clean, `artifact.sha256` still `1bdb27e1…`, `check:standards`,
   `parity:live` and `pack:check` green with the 66 277-byte report byte-identical). The fixtures carry
   no hook word at all (`rg -c 'хук|hook' fixtures/*` answers nothing), and the report of *this*
   repository is built from the locale dictionary, so the page's bytes change only by the row of the
   next commit.
   One consequence worth naming: the repository's own `post-commit` hook calls the **attached copy**
   (`node_modules/@vernikr/size-report`, 2.4.0), so this project's report commits keep the old Russian
   subject until a release ships this literal — a fact about N20's cadence, not about the tree.
5. **The state records — done 2026-09-16** (344, 354, 370, 373, 380, 409, 418, 425, 428) with
   `test/hook.test.js:323` (`/HEAD отделён/` → `/detached HEAD/`). `:295` and `:308` kept passing
   untouched, as the plan said, because they match identifiers (`CI`, `hooks.enabled`);
   `PRINTED['src/hook.js']` stayed 4 (the four `'✗ ` marks were not touched). Red first: the `why`
   back to Russian reddens the test that reads it.
6. **The post-install note — done 2026-09-16** (41–42): `· size-report: hook installed (…) — the
   report refreshes after every commit; remove it: size uninstall-hook`. No reader, measured.
   **The panel's chrome (9–11) went into the dictionaries on 2026-09-16**, by N25's decision: the four
   literals are now keys of the locale dictionary (`notOnHead`, `category`, `categoryFromConfig`,
   `categoryByExtension`), `src/page/panel.js` reads them from `appUi` and `uiText` passes them into the
   page's own dictionary. Not translated: a `locale: "ru"` report keeps Russian chrome, which is what the
   decision was for. Translation of these lines was the plan's step 6 as written; the step's shape
   changed, and the subplan closes with it.

**Outcome of steps 1–5, measured 2026-09-16.** The counter over the two files answers nothing
(`src/hook.js` 40 → 0, `bin/postinstall.js` 2 → 0); `tools/refusals.js` 61 → 55, `test/hook.test.js`
111 → 109, and `README.md` now reads **0** — its last two Cyrillic lines were this subject, which makes
it the first document of the repository with no Russian at all. `SITES` 4 and
`PRINTED['src/hook.js']` 4 unmoved, the state keys untouched, `MARK` still `# size-report: hook`.

**The readers are proved the other way round here, and that is stronger.** The full profile was green
*after* every literal of the two files had been translated, and only four assertions were moved
(`test/hook.test.js:151,191,254,323`), four catalogue cases and the README quotation. Any other
reader would still be asserting the old Russian and would have reddened; it did not. So the hook
file's comments, both install/uninstall blocks (apart from `:151`), the `why` phrases (apart from
`:323`), the `✓`/`✗` notes and the post-install note have no reader at all — the same conclusion the
greps in the reader list gave, now confirmed by a green run rather than by a search.

**N28 after this step.** No module of `src/**` prints a Russian advice marker any more: the markers
that remain are `tools/gates/dup.js:139` and `tools/gates/coverage.js:93` (`соберите её: `), which
belong to W2 and which `ADVICE_LINE`'s extractor never reads. So the condition N28 named — "no module
prints a Russian marker" — now holds for the runtime, and narrowing `ADVICE_LINE` is W1's step 8 to
do, not this subplan's.

**Why the tree is green between the commits.** Each group that a machine reads lands in the same
commit as its reader (steps 2, 3, 4, 5); every other group has no reader at all (measured above),
so a step can land alone. No reference moves: the fixtures carry no hook word, and
`artifact.sha256` belongs to the frozen copy. Nothing in this layer is gated (`src/**`,
`bin/**`, `tools/refusals.js` are no gate files), so no step needs a `Gate-Change:` trailer.

## Acceptance

- The counter over the three files answers nothing:
  `rg -cP '[\p{Cyrillic}]' src/hook.js src/page/panel.js bin/postinstall.js`.
- The free detectors of unchanged behaviour hold: `SITES` counts 4 sites for the three hook causes,
  `PRINTED['src/hook.js']` stays 4, `MARK` still carries `size-report`, and the state keys are
  untouched — `node tools/gates/…` is not needed for this: `test/refusals-catalog.test.js` and
  `test/hook.test.js` are the run that says so.
- `pnpm run verify:fast` after every commit; `pnpm run verify` before the portion is pushed.
  Expected green rather than hoped for: the only reference in the tree that carries one of these
  words is the report's own content, and the step list is built so that each check-read string
  moves with its check.
- `git status` clean, the journal entry written, and the report's own commit present (expected).
- N25's four panel literals are **not** translated but moved into the locale dictionaries (decided
  2026-09-16): the counter over the three files answers nothing, and the ru report's own chrome is
  proved Russian in a real DOM — `data/table.toml · категория: по расширению` beside
  `data/table.toml · category: by extension` for the same build with `locale: "en"`.

**Release:** this subplan changes bytes that ship (`src/hook.js`, `bin/postinstall.js`), so the
portion owes a release; how to batch releases is N20 and is not decided here. If the cadence is
decided as "batch", the commits say in words that nothing is released by them.

**Not in scope:** the `ru` dictionaries (`src/locales.js`, `src/metrics.js`), `SKIP_WORDS` (S4,
N24), the default locale (S1, N19), the frozen layer (N21 — **decided 2026-09-16: it stays Russian**)
and every test file's own Russian (C2).

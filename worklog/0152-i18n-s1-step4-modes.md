# 0152 — S1 step 4: what the modes print, and the readers that name those lines

Requested (point 5 of the work, next portion): S1's step 4 — `src/cli.js` (4 lines) and `src/modes.js`
(13 lines) together with their readers in `test/parity.test.js`.

## What changed

`src/modes.js` — every line the modes print: the unit `' KB'` (the only place a unit is printed); the
sensor note, whose marker becomes `'  fix: '`; the `check` mode's four messages (no file, the
divergence with its line number, the two sides of the differences and the missing rows), `'<no rows>'`
for an absent side; the `--write` summary line — `': N rows × M files, … KB (skipped without a row: …)'`
and `'  state at HEAD: '`; and the `check` verdict `'✓ report: N commits × M files matches the history'`.
The **shape** is untouched: the same colons, the same `×`, the same word order — only the words moved.

`src/cli.js` — the auto-install note (`hook installed: … the report is rebuilt after every commit
(remove it: …)`) and the internal error (`internal error (this is a defect of the tool, not of the
project — please send this text whole)`).

Readers moved in the same commit, each found by walking the printed lines rather than by the plan:

| Reader | Change |
|---|---|
| `tools/refusals.js:306` | case id `нет файла таблицы` → `no size table file`, with `must: ['size table: no file docs/nope.html', 'build it: ']` |
| `tools/refusals.js:312` | case id `таблица разошлась с историей` → `size table diverged from the history`, with `must: [… 'in a commit of its own']` and the manual advice `and commit docs/size-table.html` |
| `tools/refusals.js:330` | the case about an approximation: its `must` marker moves with the note (`fix: `) |
| `test/parity.test.js:57` | the summary's regex: `/: (\d+) rows × (\d+) files/` — the reader the plan named |
| `test/minify.test.js:215` | `/diverged from the git history/` — a reader the plan had not named |
| `BLOCKERS.md:464` | N16's reproduction quotes the code-5 text, so the quotation moved with the text: it now reads “internal error (this is a defect of the tool…)” |

## The numbers, and the artifact

- Counter before → after: `src/modes.js` **13 → 0**, `src/cli.js` **4 → 0**, `tools/refusals.js`
  **94 → 89**, `test/parity.test.js` **16 → 15**, `BLOCKERS.md` **19 → 18**. The allowed quotations of
  the tracker therefore read 21 (`README.md` 3, `BLOCKERS.md` 18).
- **The references did not move, measured twice.** `docs/size-report.html` hashes to
  `dbcb24d1f7be373d8b9099d718a21dbdc4a840d4dc7c9f08a2efd228745ba5a4` before and after this step — the
  page is built from the `ru` dictionary, not from the CLI's own lines, so the CLI can turn English
  while the page of a `locale: "ru"` project stays Russian (the same fact `BLOCKERS.md` N25 names for
  the panel). `fixtures/**` is untouched (`git diff --stat -- fixtures` empty), and the parity
  reference still reads `1bdb27e14bac2036f96e50fa5ec6623f7f37faeea4e45b6f91c54e6bc3ba59cd` for
  `docs/size-table.html`; `check:standards` and `parity:live` reproduce both, so the frozen layer
  neither moved nor was re-taken.
- Invariants: `PRINTED` (`cli` 2, `modes` 2, `check` 1, `doctor` 2, `hook` 4) and `SITES` unchanged —
  the marks did not move, only the words — and the check counts stand at 70 in the fast run, 175 in
  the full one.

## Red first, three experiments

1. The summary put back to Russian while `test/parity.test.js` reads English: **red** —
   `сборка не отчиталась числом строк: ✓ docs/size-table.html: 14 строк × 10 файлов, 65 KB (skipped
   without a row: 2 — …)`. The line shows the rest of the step already working.
2. A catalogue `must` phrase put back to Russian: **red** — `«коды выхода / no size table file»:
   в отказе нет «таблица размеров: нет файла docs/nope.html»`.
3. The divergence text put back to Russian: **red** in `test/minify.test.js` — `расхождение не
   названо`.

**And one finding measured by the live catalogue, not by reasoning:** the English phrase in the
catalogue's `must` has to be as specific as the Russian word was. The first wording ended with
`'commit'`, and the case's `mustFix: true` rule (after the advice runs, none of the phrases may
remain) caught it: the healthy line `✓ report: 14 commits × 10 files …` contains `commits`, which
contains `commit`. The phrase now reads `'in a commit of its own'` — the words the drift message
really ends with — and the case is green. A phrase chosen by eye would have left the check quietly
weaker.

## What this means for step 5

The tolerance in `ADVICE_LINE` (`починка`, `создайте его`, `соберите её`, `локально`, `в CI` beside
the English markers) **must stay**: after this step the marker of this layer is English, but
`src/config.js`, `src/init.js`, `src/history.js`, `src/doctor.js`, `src/explain.js`, `src/hook.js`,
`src/strip/guard.js`, `src/minify.js` and the sensors' own scripts in `tools/gates/**` still print
Russian advice. Step 5 therefore has its answer already measured: the tolerance leaves with the last
subplan that prints advice, not with S1.

## Release and push

The portion changes bytes that ship (`src/**` is in `files`), so a PATCH release, a journal section
and the pin are owed; by the mission agent's instruction of 2026-09-16 the portion is pushed to
`origin/main` as soon as its commit is green, while the release half of `BLOCKERS.md` N20 stays open.
Before the push the full profile was run by hand: `pnpm run verify` green, eight steps (this portion
touches the parity reader and `pack:check`'s byte comparisons, which is why the full run was owed).

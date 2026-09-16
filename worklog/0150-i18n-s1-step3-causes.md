# 0150 — S1 step 3: the cause registry, renamed across the files that name it

Requested (point 5 of the work, next portion): S1's step 3 — the last eleven Cyrillic lines of
`src/refusal.js` and the cause names renamed in one commit through every place that declares, prints,
parses or compares them.

## What changed

`src/refusal.js` — `CONFIG_CAUSES`: five group names and **25 cause names** (the plan said 22;
counted, not remembered), and the internal message `'refusal cause is not declared: '`.

The **29 `refuseCause('…')` sites** of `src/**`, renamed by their cause argument and nothing else:
`args.js` 14, `config.js` 5, `explain.js` 3, `hook.js` 4, `init.js` 1, `minify.js` 1,
`strip/guard.js` 1. The refusal *messages* of those modules stay Russian — they belong to S2, S3 and
S5 — so only the first argument moved.

`tools/refusals.js` — the 25 `SITES` keys, the `key:` of every command-line case (29 lines for 25
causes: `incompatible flag` and `extra word` carry extra rows) and the catalogue id
`'внутренняя ошибка'` → `'internal error'`.

`README.md:768` — the code-2 row, which `readmeCauses()` parses and compares with `CONFIG_CAUSES`:
a contract rather than a quotation, exactly as C3 measured while planning it.

Two checks, each reading a text this step moves: `test/docs-commands.test.js`'s
`/причина отказа не объявлена/` → `/refusal cause is not declared/` (it reads the internal message),
and `test/refusals-catalog.test.js`'s closed list `['внутренняя ошибка']` → `['internal error']`.

Vocabulary, kept consistent with steps 1–2: *command line*, *settings and the project*, *history*,
*hook*, *measurement*; `unknown flag`, `flag without a value`, `repeated flag`, `two modes at once`,
`extra word`, `command and mode`, `unknown command`, `incompatible flag`, `no JSON answer`,
`two answers at once`, `no commit`, `no settings file`, `settings not parsed`, `settings invalid`,
`git missing`, `not a git repository`, `config already exists`, `no such commit`, `ambiguous commit`,
`commit outside the history`, `foreign hook`, `foreign core.hooksPath`, `no way to invoke the tool`,
`file is not JavaScript`, `minifier did not parse`.

## The numbers

- Counter, before → after: `src/refusal.js` **11 → 0**, `src/args.js` **14 → 0**,
  `src/config.js` **35 → 34**, `tools/refusals.js` **149 → 94**, `README.md` **4 → 3**. Unchanged:
  `explain.js` 24, `hook.js` 40, `init.js` 18, `minify.js` 4, `strip/guard.js` 6 — their cause lines
  carry their messages too, so only `config.js` loses a line entirely.
- Invariants: `SITES` values unchanged (the same 27 keys — 25 causes and 2 codes), `PRINTED`
  unchanged (`cli` 2, `modes` 2, `check` 1, `doctor` 2, `hook` 4), `CASES` 38, the check counts
  unchanged (70 in the fast run).
- The tracker's allowed-quotations cell, re-measured: **22** — `README.md` 3 after this step (the
  contract line left it), `BLOCKERS.md` 19, `AGENTS.md` 0. The row's own reading of 18 was
  `BLOCKERS.md` 14 + `README.md` 4.

## Readers the plan did not name — and readers it named that are not

Found by walking every renamed name, as asked:

- `test/docs-commands.test.js`'s `/причина отказа не объявлена/` — one assertion below the very
  comparison it belongs to, and neither the plan nor the tracker had it;
- `test/refusals-catalog.test.js`'s closed list of uncatchable ids (the plan named the id, not the
  list);
- and, in the other direction, three things the plan called readers: `test/cli.test.js:149`
  (`refusal(broken, 2, 'настройки не разобраны')`) is the check's own label, not an assertion about
  the text; `test/refusals.test.js:317-318`'s `groupOf` reads `CONFIG_CAUSES` **dynamically**, so it
  follows the rename by itself; and the `must` phrases of the catalogue quote each module's printed
  text (`must: ['нет файла настроек', …]` quotes `src/config.js`'s sentence), so they leave with
  their own subplan rather than with the cause.
- measured with a quoted-literal scan over `git ls-files` (117 occurrences of a cause name as a
  literal), so the list above is the whole of it outside `src/**` and the catalogue.

## Red first, measured three times

Each experiment put a Russian name back and was then restored:

1. One `SITES` key back to Russian → `test/refusals-catalog.test.js` **red twice**:
   `в исходниках есть место отказа без пункта каталога (tools/refusals.js): unknown flag` and
   `у каждого места отказа есть случай в каталоге`. The registry's line and the site that emits the
   cause move together.
2. `README.md`'s row back to Russian → `test/docs-commands.test.js` **red**:
   `таблица кодов README называет не те причины, что объявлены в CONFIG_CAUSES`.
3. The internal message back to Russian → the same file **red** with
   `причина отказа не объявлена: выдуманная причина`, i.e. the check's English regex no longer finds
   the text it reads.

`pnpm run verify:fast` is green (70 checks) and `node --test test/refusals.test.js` is green too — it
calls every refusal live, so the renamed keys still name the causes the modules hand out.

## Found in passing

`test/check.test.js:235` — a negative match on a cause name that is never printed, vacuous before and
after this step: recorded in `TODO.md`, not fixed (a check's behaviour, not a literal).

## What is left in S1

Step 4 — what the modes print (`src/cli.js` 4, `src/modes.js` 13, with `test/parity.test.js:57` and
the two catalogue ids `'нет файла таблицы'`, `'таблица разошлась с историей'`); step 5 — the wash-up,
where `ADVICE_LINE`'s Russian alternatives leave only once the last module printing advice is
translated. `SITES` and `PRINTED` are the free detector for both.

## Release

The portion changes bytes that ship (`src/**` is in `files`), so a PATCH release, a journal section
and the pin are owed; the cadence is `BLOCKERS.md` N20 (open), so nothing is released and no push is
made by this commit.

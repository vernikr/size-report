# TODO — size-report

Defects noticed **in passing** while doing other work: a wrong line, a stale number, a refusal
that names the wrong cause. It is not `BLOCKERS.md` (a blocker has a reproduction, a consequence
and a suggested fix, and it stops work) and not `worklog/` (what was done): an entry here is a
note to come back to, and nothing more.

Rules of keeping it:

- an entry names **where** (file and line), **what** is wrong and **how it shows** — a claim
  without a way to see it is a guess;
- an entry leave the tree alone: the defect is fixed in a portion of its own, not on the way past
  it (the translation work does not mix in unrelated edits — `AGENTS.md`);
- a fixed entry is deleted rather than struck through; the fact of the fix belongs to the
  `worklog/` entry of the portion that fixed it.

Opened 2026-09-16 with the string-translation work (`docs/plans/2026-09-16-i18n-english/`).

## Open

- **`tools/docs-facts.js` — `usageCommands` mixes the help's continuation lines into the command
  list.** Seen 2026-09-16 while translating the help (subplan S1, step 1). The derivation splits
  `USAGE` on the `Commands:` marker, takes the section up to the first blank line and keeps the first
  word of **every** line — including the indented continuation lines of an entry that wraps. Measured
  on both sides of the translation: the list holds ten words either way — the six commands at the
  same places in the same order, plus the first word of each of the four continuation lines (Russian
  words before the translation, `of`, `coverage`, `on`, `commit` after it). So nothing behaves
  differently today, but the list accepts four words that are not commands: a document calling
  `of something` passes `test/docs-commands.test.js`'s "calls only what the tool knows" check. How it shows: add a call to `of` in `README.md` and the check stays green. Fixing it
  means narrowing the derivation (two-space indent as the mark of an entry, or reading the section
  through the same parser as `commandsAt`), which is a change of a check's behaviour rather than of
  a literal — hence its own portion.
- **`tools/harness.js:272` — `commandIn` sees only an advice whose command carries a flag.** Seen
  2026-09-16 while translating the grammar's messages (subplan S1, step 2). The regex is
  `/node\s+(\S+)\s+(--\S+)/`, so an advice without a flag (`fix: node …/bin/size.js doctor`) reads as
  "no command": measured on the function itself — `commandIn('✗ x\n  fix: node /p/bin/size.js doctor')`
  is `null`, while the same line with `--init` answers `{ file, flag }`. Nothing is red today (every
  advice the two assertions in `test/cli.test.js:172,232` speak of carries a flag), but a correct
  flag-less advice would fail those assertions: the check reddens over good behaviour instead of
  staying silent. Fixing means widening the derivation (a command whose second token is a word) —
  a check's behaviour rather than a literal, hence a portion of its own.
- **`test/check.test.js:235` — a negative match on a cause name can never fail.** Seen 2026-09-16
  while renaming the causes (subplan S1, step 3). The assertion is
  `assert.ok(!/нет такого коммита/.test(away.stderr), …)`, and it reads a **cause name** — the
  registry's vocabulary. The tool never prints it: a refusal prints the sentence its caller passes
  (`src/refusal.js`), and the help prints the whole list. The sentence this case really prints is
  `«<target>» — это коммит <sha>, но его нет в истории отчёта: …`, so the regex matches nothing
  whichever answer the tool gives: green either way, before and after the rename (measured: the
  phrase appears in the registry alone, now as the English `no such commit`). Fixing it means
  matching the message's own words or the other cause's sentence — a check's behaviour rather than a
  literal, hence a portion of its own.
- **`src/init.js` — nothing reads what the settings draft prints.** Seen 2026-09-16 while
  translating it (subplan S2, step 2), and it is a measurement rather than an impression: putting
  four of the draft's lines back into Russian (the `columns:` line, the `min` metric, the `!` note's
  first line) left `pnpm run verify:fast` green, 70 checks. The catalogue's `--init` advice in an
  empty directory checks code 0 and the absence of a refusal, never the words, and no check reads the
  draft's stdout at all — so the draft's shape (one line per fact, `:` after each label, the `!` mark
  rather than `✗`) is held by nothing but an eye. The refusal of the same file **is** held
  (`config already exists`, `tools/refusals.js`). How it shows: drop the `journal:` line or turn the
  `!` into a `✗` and every check stays as it was. Fixing means a check of its own (the draft's lines
  for a project with and without a `package.json`, and that the mark and the code say the same thing)
  — a check rather than a literal, hence a portion of its own.
- **`tools/refusals.js:134` — the `template` doc comment names Russian placeholders.** Seen
  2026-09-16 while translating the settings draft (subplan S2, step 2): it reads "a shape with a
  substitution (`<файл>`, `<коммит>` — Russian, as the advice prints it)", while the shapes have been
  `<file>`/`<commit>` since S1's step 2 (measured: `rg -n "'<" tools/refusals.js` finds `<file>` and
  `<commit>` only). How it shows: a reader of the catalogue is told a Russian placeholder is the
  convention when the printed text has none. It is prose rather than a literal, so the translation
  work leaves it alone; fixing it is one comment, in a portion of its own.
- **`src/metrics.js:61-63` — the last Russian comment in `src/`.** Seen 2026-09-16 while measuring
  the measurement layer for subplan S3 (`docs/plans/2026-09-16-i18n-english/measurement.md`): the
  comment above `METRICS` explains why a metric declares `needsText`, and it is the only comment
  left by the prose pass — 3 lines, measured with
  `rg -c '^\s*(//|\*|/\*).*\p{Cyrillic}' src`, which answers `src/metrics.js:3` and nothing else.
  It is prose rather than a literal, so the string work does not touch it and `src/metrics.js` will
  not reach a zero Cyrillic count until someone does. Fix it in a portion of its own (one comment,
  no code), or name it permanently in that plan's allow-list.

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
  literal, hence a portion of its own. **A second instance of the same class, measured 2026-09-16**
  (subplan S2, step 3): `test/cli.test.js:69` is the negative half of a phrase pair
  (`assert.equal(/…/.test(again.stderr), false)`) and was left in Russian while the message beside it
  became English — green either way, measured by running that file alone (9 checks green). So a
  negative match has to move with the text (the rule C2 wrote down), and a check that reads
  "the phrase is gone" cannot tell you when it has stopped holding.
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
- **`src/metrics.js:61-63` — the last Russian comment in `src/`.** Seen 2026-09-16 while measuring
  the measurement layer for subplan S3 (`docs/plans/2026-09-16-i18n-english/measurement.md`): the
  comment above `METRICS` explains why a metric declares `needsText`, and it is the only comment
  left by the prose pass — 3 lines, measured with
  `rg -c '^\s*(//|\*|/\*).*\p{Cyrillic}' src`, which answers `src/metrics.js:3` and nothing else.
  It is prose rather than a literal, so the string work does not touch it and `src/metrics.js` will
  not reach a zero Cyrillic count until someone does. Fix it in a portion of its own (one comment,
  no code), or name it permanently in that plan's allow-list.
- **`tools/run-tests.js` — extra flags after the run's name never reach `node --test`.** Measured
  2026-09-17 (node 22.23.2) while removing the usage example this entry was opened for: the runner
  spawns `node --test <file> <flags>`, and node ignores options that follow the file — with
  `--test-name-pattern=byte-identical` **before** the file it selects one test of `test/parity.test.js`
  (`# tests 1`), **after** the file it selects all three (`# tests 3`), which is what the runner's
  order gives. How it shows: `node tools/run-tests.js fast --test-name-pattern=<anything>` answers
  exactly as without the flag, so a developer who passes a pattern runs the whole file and is told
  nothing. The example the entry was opened for also named a Russian test name, dead since C2/C3
  renamed the checks. The fix is one reordering (flags before the file) — behaviour rather than prose,
  hence a portion of its own; the comment in the file no longer promises what does not work.
- **`test/gates-verify.test.js:146-149` — an assertion that cannot fail.** Seen 2026-09-16 in W2's
  step 7, while measuring who reads the hooks' messages: the sweep over `pnpm run ([a-z:.-]+)` in the
  hook text asserts `scriptOf('pnpm run ' + m[1]) !== null`, and `scriptOf` returns the matched token
  for anything the pattern accepts — so the check is true for every match. Measured: the token inside
  the install message was replaced with `pnpm run hooks:no-such-script` and the probe stayed green,
  while its own message promises "the hook calls «…», which does not exist". What the sweep does hold:
  a hook has to call `pnpm run verify:fast` (`:142-143`) and may not inline check commands — replacing
  that call reddens the probe. The workflow side of the same idea (`:132`) compares against the real
  scripts and does check existence. A sensor's own defect, so the string work records it and does not
  chase it; the fix is one line (compare `m[1]` with `scripts`), and it is a gate-file edit, so it
  needs the trailer.

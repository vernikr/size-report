# 0148 — the string work begins: S1 step 1, the help

Requested (point 5 of the work): one portion per turn, starting with S1's step 1 — the `USAGE` help
and its readers, together with its markers.

## What changed

`src/refusal.js` — the whole `USAGE` prose and its four section names, and nothing else in the file:
the intro (`a report on how the size of files grows commit by commit`), `Usage: `, `Commands:`,
`Modes:`, `Flags: `, the `--json` paragraph, the "one run at a time" paragraph, the settings
paragraph, `Exit codes: `, and the cause heading (`Causes of a code-2 refusal`). The entry lines keep
their shape: one entry per line, the first word is the command or the flag, continuation lines
indented. The placeholders went with the words (`<коммит>` → `<commit>`, `[файл]` → `[file]`).

Readers edited in the same commit, so that the tree never depends on a half-translated pair:

| Reader | Change |
|---|---|
| `tools/docs-facts.js:135` | `usageCommands` splits on `'\nCommands:\n'` |
| `tools/docs-facts.js:171-185` | `commandsAt` reads **both** section spellings — the pin points at a released revision whose help is still Russian, so the Russian marker goes only when the pin moves past the rename (`BLOCKERS.md` N20) |
| `test/docs-commands.test.js:36` | `usageCauses()` splits on `Causes of a code-2 refusal` |
| `test/cli.test.js:33` | the help check matches `/Exit codes/` |
| `test/module.test.js:312` | the reader the plan had **not** named: `'Запуск: node '` → `'Usage: node '` (found by grepping each phrase of the help for readers, not by the plan) |

## The numbers

- Cyrillic counter: `src/refusal.js` **46 → 11**. The eleven are the cause vocabulary (five group
  names, four cause lines, the internal `Error`), which is S1's step 3; `src/args.js` 26, `src/cli.js`
  4, `src/modes.js` 13 are untouched.
- `usageCommands`: ten words before, ten after — the six commands (`check explain doctor install-hook
  uninstall-hook hook-run`) at the same places in the same order — recorded in `TODO.md` as a latent
  weakness of the derivation (four continuation-line words pass the "calls only what the tool knows"
  check). Not fixed here: that is a check's behaviour, not a literal.
- `SITES` 27 and `PRINTED` (`src/cli.js` 2, `src/modes.js` 2, `src/check.js` 1, `src/doctor.js` 2,
  `src/hook.js` 4) — unchanged, the free behaviour detector.
- `pnpm run verify:fast` green: 70 checks, 0 failures.

## Red first, as the plan asks

With everything but the reader in place, `tools/docs-facts.js` was temporarily put back to the
Russian marker `'\nКоманды:\n'` and `test/docs-commands.test.js` ran: **red**, with
`TypeError: Cannot read properties of undefined (reading 'split')` — the help's section is no longer
found, so `usageCommands` is `undefined` and every documentation guard falls over. The marker was
then restored, and the same file passed. That is the experiment the plan named for step 1, measured
rather than asserted.

## What is left in S1

Steps 2–5: the grammar's refusal messages (`src/args.js`, 26), the cause registry (`src/refusal.js`'s
remaining 11 plus the cross-file rename in `README.md`, `tools/refusals.js`, `test/refusals*.test.js`),
what the modes print (`src/cli.js` 4, `src/modes.js` 13, with `test/parity.test.js:57`), and the
wash-up. The transitional tolerance in `ADVICE_LINE` stays until the last module that prints advice
is translated (W1's wash-up).

## Release

This portion changes bytes that ship (`src/refusal.js` is in `files`), so a PATCH release, a journal
section and the pin are owed by `AGENTS.md` — but the cadence is `BLOCKERS.md` N20, still open, and
pushes are held with it. The commit says in words that nothing is released by it.

# 0149 — S1 step 2: the grammar's refusal messages and the advice marker

Requested (point 5 of the work, next portion): S1's step 2 — the command-line grammar's refusal
messages in `src/args.js`, the `must` phrases of the command-line cases in `tools/refusals.js`, and
the advice marker with its readers.

## What changed

`src/args.js` — the fourteen refusal messages of the grammar: the flag without a value, the unknown
flag, the repeated flag, two modes at once, `--force` without `--init`, `--init` with `--config`,
the extra word after a flag that takes a value, the unknown command, a command beside a mode,
`explain` without a commit, `explain` with two, a command that takes no arguments, no JSON answer,
and two answers at once. The quoting went from `«…»` to `"…"` inside them, and the placeholders with
the words (`<файл>` → `<file>`, `<коммит>` → `<commit>`). The cause names these calls pass
(`refuseCause('лишнее слово', …)`) stay Russian: that is step 3, which renames them across three
files at once.

`tools/refusals.js` — the `must` phrases of the fourteen command-line rows (eleven causes, two of
them carrying three extra rows) and the two advice shapes the rows declare (`template` with
`<файл>` and with `<коммит>`), because `verifyAdvice` compares the declared shape with the printed
advice. `ADVICE_LINE` gained the English markers beside the Russian ones (`fix`, `create it`,
`build it`, `locally`, `in CI`), each with a word boundary.

Readers edited in the same commit:

| Reader | Change |
|---|---|
| `test/cli.test.js:179,189,193,199,230,240,245-249,289,297` | thirteen assertion lines — the plan named four of them |
| `test/doctor.test.js:268,269` | a `must`-like regex **and** a bare `/fix/` reading the marker; neither named by the plan |

## The numbers

- Cyrillic counter: `src/args.js` **26 → 14**. The 26 were the fourteen messages plus twelve advice
  tails (two of the fourteen messages carry their advice on the same line); the 14 left are the
  cause arguments of step 3.
- `CASES` 38, `SITES` 27, `PRINTED` (`cli` 2, `modes` 2, `check` 1, `doctor` 2, `hook` 4) — unchanged,
  the free detector for a behaviour change.
- `test/cli.test.js` **79 → 76** (three assertion lines lose their last Russian characters) and
  `test/doctor.test.js` 83 → 83 (the two changed lines keep their own prose in Russian): the readers
  of the messages moved, while the checks' own prose belongs to C2.
- `pnpm run verify:fast` green: 70 checks, 0 failures.
- The `\b` in the English markers is measured, not assumed: without it the marker `fix` is found
  inside `prefix:` and a line with no advice reads as one (`'the prefix: something'` matches
  `/(?:fix|create it): (.+)$/`); with it, nothing matches.

## Red first, as the plan asks

Two experiments, both on `test/refusals.test.js` (`node --test`, then the file restored byte for byte
— md5 compared):

1. One `must` phrase put back to Russian (`незнакомый ключ «--wite»`) while the module prints English:
   **red** — `«командная строка / незнакомый ключ»: в отказе нет «незнакомый ключ «--wite»»`, with the
   module's own line and its advice printed below. The catalogue's phrase and the printed text are one
   pair, so the step may not be split.
2. The English alternatives taken out of `ADVICE_LINE` while the messages print `fix: `: **red** —
   `«командная строка / незнакомый ключ»: отказ ничего не советует, а каталог объявил совет`. The
   marker and the messages that use it land in one commit, which is exactly what the plan requires.

## What is left in S1

Steps 3–5: the cause registry (the last 11 lines of `src/refusal.js` plus the cross-file rename in
`README.md`, `tools/refusals.js` and `test/refusals*.test.js`), what the modes print (`src/cli.js` 4,
`src/modes.js` 13 with `test/parity.test.js:57`), and the wash-up. `SITES` and the Russian
alternatives in `ADVICE_LINE` go only in the wash-up, when no module prints advice in Russian.

## Found in passing

`tools/harness.js:272` — `commandIn` recognises an advice only when its command carries a flag;
recorded in `TODO.md`, not fixed (a check's behaviour, not a literal).

`surface.md` was corrected by measurement: the command-line rows are **fourteen**, not the eleven the
plan said, and the readers of the messages are thirteen assertion lines, not four.

## Release

This portion changes bytes that ship (`src/args.js` is in `files`), so a PATCH release, a journal
section and the pin are owed by `AGENTS.md`; the cadence is `BLOCKERS.md` N20, still open, and pushes
are held with it. The commit says in words that nothing is released by it.

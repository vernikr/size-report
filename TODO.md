# TODO — size-report

Defects noticed **in passing** while doing other work: a wrong line, a stale number, a refusal
that names the wrong cause. It is not `BLOCKERS.md` (a blocker has a reproduction, a consequence
and a suggested fix, and it stops work) and not `worklog/` (what was done): an entry here is a
note to come back to, and nothing more.

Rules of keeping it:

- an entry names **where** (file and line), **what** is wrong and **how it shows** — a claim
  without a way to see it is a guess;
- an entry leaves the tree alone: the defect is fixed in a portion of its own, not on the way past
  it (the translation work does not mix in unrelated edits — `AGENTS.md`);
- a fixed entry is deleted rather than struck through; the fact of the fix belongs to the
  `worklog/` entry of the portion that fixed it.

Opened 2026-09-16 with the string-translation work (`docs/plans/2026-09-16-i18n-english/`).

## Open

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

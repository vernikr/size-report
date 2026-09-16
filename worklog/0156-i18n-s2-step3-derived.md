# 0156 — S2 step 3: what is said about derived settings

Requested (point 5 of the work): S2's step 3 — `src/project.js`, the sentence `derivedSummary` and the
`--init` hint of `derivedLines`, with the readers the plan named.

## What changed

`src/project.js` reaches zero Cyrillic; the four lines were:

- `derivedSummary` — `settings derived from the project (no file): columns <N> (<labels>, …), paths
  skipped <N>`, the same shape as before (five labels and an ellipsis, the count of skipped paths in
  the tail);
- `derivedLines` — `! ` + that sentence, and `pin them with a file of their own (then edit it as you
  like; otherwise the set of columns changes from run to run): <command>`.

The words are this file's while the printing is `src/doctor.js`'s (S4) and `src/cli.js`'s (S1): no
edit there, only the visible output changes. One consequence is named on purpose: `doctor` now prints
an English finding sentence with a Russian `fix:` line (`закрепите их файлом: `, S4) — the same mixed
state `BLOCKERS.md` N25 records for the panel. The two spellings of the advice stay visibly different
from S4's, which is what keeps `pnpm run dup` quiet (it answered "no new clones" before and after).

## Readers, and the measurement that every one of them is invisible to the fast profile

Joint edits: `test/cli.test.js:45,69` and `test/doctor.test.js:64` (`/settings derived from the
project/` in both halves — the positive match and the absence check), `test/module.test.js:258,284`
(`/pin them with a file of their own[^:]*: (.+)$/m`, which extracts the command to run it).

| Experiment | Result |
|---|---|
| `derivedSummary` put back into Russian, rest English | `test/cli.test.js` and `test/doctor.test.js` redden (4 red checks of the three files' 26; the messages quote the whole line, `! настройки выведены из проекта (файла нет): колонок 12 (…)`) |
| the hint's first words put back into Russian | `test/module.test.js` reddens **twice**: «подсказка не называет команду починки» — the regex finds nothing and the check fails on `undefined` |
| both of the above reverted, then `pnpm run verify:fast` | **green, 70 checks** — the fast profile cannot see this step: all three readers live in full-only files (`tools/suites.js`) |
| the `paths skipped ` tail alone put back into Russian, then `pnpm run verify` | **green, all eight steps** — no reader reads the second half of that sentence |
| `test/cli.test.js:69`'s negative match left in Russian against the English source | **green and vacuous** — 9 checks green, so the assertion silently stopped holding (the second instance of the class already in `TODO.md`) |

## The numbers

- Counter before → after: `src/project.js` **4 → 0**; the wash-up over the three files of the subplan
  (`src/config.js`, `src/init.js`, `src/project.js`) answers nothing.
- `SITES` (27), `PRINTED` (2/2/1/2/4), `CASES` (38) and the check counts unchanged (70 fast, 175
  full); `pnpm run verify` green — eight steps, `pack:check` included (the report from the tarball
  byte for byte, 66 277 B).
- Step 4 of the subplan is **empty, and that is measured**: the cause arguments of these three files
  are already English (`git missing`, `not a git repository`, `no settings file`, `settings not
  parsed`, `settings invalid`, `config already exists`), since S1's step 3 (`a7c869b`) landed first.

## What is left in S2

Nothing: step 4 is empty by measurement and the wash-up criterion is met. `ADVICE_LINE`'s tolerance
stays, because S3, S4 and S5 still print Russian markers (**N28**).

## Release and push

The portion changes bytes that ship (`src/**` is in `files`), so a PATCH release is owed; the release
half of `BLOCKERS.md` N20 is still open. Pushed to `origin/main` with the full profile run by hand
first.

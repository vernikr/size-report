# 0154 — S2 step 1: what a settings file says when it is wrong

Requested (point 5 of the work, after closing S1): S2's step 1 — `src/config.js`, the two git dead ends
and the reading of the settings file, with the readers of every line.

## What changed

`src/config.js`, all 34 Cyrillic lines: the two git dead ends (`git did not start: it is not in PATH …`
with `fix: install git …`, and `git sees no repository here … create it: git init`), the missing
settings file (`no settings file … create it: <command> … without "--config" no settings are needed`),
the unparsable one (`cannot parse <file>: <message> … fix: edit <file>`), the whole `fail` family of
`validateConfig` — columns (`no columns are given`, `column #N has to be {label, paths: […]}`), labels,
categories, metrics, minification engines, tokenizer family and encoding, locale, `hooks.enabled`,
`output`, `journal.path`/`journal.pattern` — the value of `cfg.path` (`'derived from the project'`),
the shared prefix and tail (`'config ' + cfg.path + ': ' + msg + '\n  fix: edit ' + cfg.path`), and
`outsideFix`. The shape is kept line for line: the prefix-and-tail seam two checks slice at is the
same, and identifiers (`raw`, `strip`, `esbuild`, the locale keys) are untouched.

## Readers moved with the text

| Reader | Change |
|---|---|
| `tools/refusals.js` — six cases | `no settings file` (`['no settings file', 'create it: ', '--init']`), `settings not parsed` (`['cannot parse', 'fix: edit']`, advice `edit @broken`), `settings invalid` × 2 (`['no columns are given', 'fix: edit']`, `['has to be {label, paths:', 'fix: ']`, advices `edit @empty`/`edit @badtype`), `not a git repository` (`['git sees no repository here', 'the directory I look in is ', 'git init']`), `git missing` (`['git did not start: it is not in PATH', 'install git']`, advice `install git (https://git-scm.com)`) |
| `tools/refusals.js` — `id: 'покрытие неполно'` | the case belongs to `src/check.js` (S4) but quotes `outsideFix` word for word: `must`'s last phrase and the manual advice text move here, while the marker in `'починка: add these paths…'` stays S4's |
| `test/check.test.js:139,151` | `/as a column or to "skip"/` and the `STEM` the check slices by length |
| `test/doctor.test.js:132` | `/unknown metric/` over doctor's answer |
| `src/init.js:49` | the quotation *inside* another message: `«не задано ни одной колонки»` → `«no columns are given (columns)»`. The surrounding sentence is step 2's, the quoted fragment belongs to the text it quotes |
| `test/cli-paths.test.js:103` | `/^\s*починка: .*git init$/m` → `/^\s*fix: .*git init$/m` — **a reader the plan had not named**, found by the full run (see below) |

## The numbers

- Counter before → after: `src/config.js` **34 → 0**, `tools/refusals.js` **89 → 78**,
  `test/check.test.js` 84 → 83, `test/cli-paths.test.js` 31 → 30; `src/init.js` 18 → 18 and
  `test/doctor.test.js` 83 → 83 (the swapped lines keep their own Russian prose).
- `SITES` (27 keys), `PRINTED` (2/2/1/2/4) and `CASES` (38) unchanged; `test/api.test.js` and
  `test/templates.test.js` green, so no key, default or derived profile moved.
- `pnpm run verify:fast` green (70 checks) and `pnpm run verify` green — eight steps, including
  `test:all` (175), `parity:live`, `check:standards` and `pack:check` (the report from the tarball is
  byte-identical: 66 277 B). No reference carries a message of this step.

## Red first

1. One `must` phrase put back to Russian with the module printing English → `test/refusals.test.js`
   reddens: `«settings and the project / settings invalid»: в отказе нет «не задано ни одной колонки»`.
2. `STEM` put back to Russian in `test/check.test.js` while `outsideFix` is English → that check
   reddens: `объяснение говорит о таком пути своими словами` (the slice stops matching).

## The reader the plan did not know, and how it was found

`test/cli-paths.test.js:103` asserts `/^\s*починка: .*git init$/m` — a machine read of the marker and
of the command in the "no repository" refusal. It did not show up in `verify:fast` because
`test/cli-paths.test.js` is a **full-only** file (as are `test/check.test.js` and
`test/doctor.test.js`), and the string-by-string walk missed it because the phrase it reads
(`fix: … git init`) is a composition of the marker and the last words of the line rather than a
fragment of the message. The full profile is what caught it: `test:all` red, `error: отказ не назвал
команду починки`, with the whole advice line printed under it. This is the fourth portion in a row
where the plan knew fewer readers than the tree has — the lesson written into every journal entry, and
now into `settings.md`'s reader table as well.

## Corrections to the subplan, by measurement

- The cause-name table in `settings.md` predicted `no git`, `settings file missing` and
  `config already there`; S1's step 3 landed with `git missing`, `no settings file` and
  `config already exists`. The table now shows the names the registry holds.
- `settings.md` said step 1 moves `test/check.test.js:159`'s `head`; that line is printed by
  `src/check.js:119`, so its marker is S4's and the check's `head` moves with S4 instead.

## What is left in S2

Steps 2 (`src/init.js`: nine draft lines, the `config already exists` refusal and the `!` note of
`noteNoColumns`), 3 (`src/project.js`: `derivedSummary` and the `--init` hint) and 4 (the cause
arguments — already English after S1's step 3, so the step records that it is empty), then the wash-up
of the three files.

## Release and push

The portion changes bytes that ship (`src/**` is in `files`), so a PATCH release is owed; the release
half of `BLOCKERS.md` N20 is still open. The portion is pushed to `origin/main` on the mission
agent's instruction, with the full profile run by hand first.

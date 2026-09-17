# C3 closed: `suites`, `docs-numbers`, `docs-pin`, `frozen`

What was asked: the rest of the C3 subplan — step 6 (`suites`, `docs-numbers`) and the remaining halves
of steps 7–8 (`docs-pin`, `frozen`) — and closing C3 if the measurement confirms it. Translations only,
one commit, English message and journal entry, full `verify` before the push, CI checked afterwards.

## Done

- `test/suites.test.js` **16 → 0**, `test/docs-numbers.test.js` **12 → 0**,
  `test/docs-pin.test.js` **14 → 1**, `test/frozen.test.js` **16 → 0** — 57 lines of names and messages.
- **C3 is closed at 25 lines:** `gates-files` 8, `docs-commands` 5, `gates-metrics` 5, `git-pins` 5,
  `gates-dup` 1, `docs-pin` 1. Every one of them is allow-listed data (the scenario repositories, the
  probe payloads, the witness's Cyrillic path) or a past's own word — the one line in `docs-pin` names
  `«Команды»`, the section marker of the revision the pin still leads to.
- `test/**` as a whole now reads **130**: C1 18 + C2 87 + C3 25.

## Measured, not argued

- **Four experiments, sources restored byte-identical:** a `why` dropped from an entry of
  `tools/suites.js` reddens `suites` at check 2; a check added to a file without updating the table of
  `README.md` reddens `docs-numbers` at check 1; renaming the `Fast` row label in `README.md` reddens
  `docs-numbers` as well; and dropping the Russian branch of `commandsAt` (`tools/docs-facts.js`)
  reddens `docs-pin`.
- **The two readings that could rot, both checked by that last pair:** `commandsAt` resolves the
  section in two languages and the Russian branch is **live** today (the pin is a Russian revision) —
  it goes dead only when N20's release moves the pin, which is said rather than discovered later; and
  `publishedRuns()` cannot pass in silence, because a row that stops parsing reddens its own `assert.ok`.
- **What `docs-numbers` reads, measured rather than described:** the table of runs in `README.md` (by
  the labels `Fast`/`Full` and the command cells) and `tools/suites.js`'s `checksIn`/`FAST` — **no other
  document**, the tracker included. The N24 line (one value of `SKIP_WORDS` in `parity`) is untouched.
- Red first by the whole file: all four green at `HEAD` (3/1/1/4).
- Checks unchanged (3/1/1/4; 70 fast, 175 full); `dup` before and after `clones 5, lines 29`; the
  artifact's **content** digest (`fixtures/parity/artifact.sha256`) `1bdb27e1…` and the reference file's
  own sha256 `cdda8d01…` unmoved; the quotation row still **33, all of it `BLOCKERS.md`** (this portion
  added none); full `pnpm run verify` (8 steps) green before the push.

## Suggested

- No gate file was touched, so the commit needs no trailer (the hook confirms it).
- What is left of the campaign: **D1** (the declarative files — workflows, templates, dotfiles) and the
  two numbers the user keeps open, **N31** (the stale `dup` fingerprints) and **N32** (the coverage
  ratchet); **N20**'s release cadence is what would also retake the pin and, with it, retire the last
  Russian branch of `commandsAt`.

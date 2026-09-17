# Free compactness: stale explanations and dead branches, no behaviour

What was asked: a narrow portion of compactness with no behaviour change — take out outdated
explanations and dead branches — with the `Gate-Change:` trailer wherever a gate file is touched.

## Done

- **`tools/docs-facts.js` — the dead half is gone.** `commandsAt()` read two spellings of each section
  marker, the Russian ones kept only while the install example pinned a Russian help. The pin is the
  current release (`AGENTS.md`) and its help is English since 2.5.0, so the Russian halves could not
  match anything: `src.split("'Commands:'")[1]` and `section.split("'Modes:'")[0]` now, and the long
  paragraph about the old cadence became three lines that say what is true — including the one case the
  reader cannot serve (a pin to a pre-rename revision would need the Russian spellings back) and where
  that revision spells them (its own `src/refusal.js`, the file this function reads).
- **`tools/run-tests.js` — the usage example is gone, and the comment no longer promises what does not
  work.** It offered `--test-name-pattern=паритет` as the way to pass flags to `node --test`; measured
  today, that example failed twice over (see below), so the comment now states the measurement and names
  the defect as open rather than pretending the flags work.
- **`src/parse.js` — a comment that stated the opposite of the code.** It explained that the parse
  worker's fallback reason is Russian because it travels into a printed refusal; the literal beside it has
  been English since S3. It now says «worded like the rest of the output», which is true either way.
- **`test/cli.test.js` — a message pointing at a file that has moved.** `the exit codes diverged from
  PLAN.md §4.1` now names `plans/archive/PLAN.md §4.1` (the table really is at `:195` of it, measured).
- **`TODO.md` — three entries fixed and deleted** (the parse comment, the moved path, the dead half of
  `commandsAt`), and **one rewritten by measurement**: the entry about the Russian test-name example
  became the defect underneath it — flags placed after the file never reach `node --test`.
- **The records followed the tree**, in the same commit: W1's row in `plan.md`, its closing note in
  `tools.md`, the tracker's live sentence about the two G1 tolerances, and the campaign's closing
  inventory, which was re-measured whole (the page's Cyrillic figure had meanwhile fallen from 349 lines
  to 1 with the release that made the page's own words English).

## Measured, not argued

- **The dead half was dead:** with the Russian spellings cut out, `test/docs-pin.test.js` is green
  (1 check, `# pass 1`) against the tag; and `commandsAt`'s reader is that check alone.
- **The usage example failed twice:** `--test-name-pattern=паритет` names a test that no longer exists
  (the checks were renamed in C2/C3), and the runner spawns `node --test <file> <flags>`, where node
  ignores options that follow the file — with `--test-name-pattern=byte-identical` **before** the file
  `test/parity.test.js` runs one test (`# tests 1`), **after** the file it runs all three (`# tests 3`).
  That is now a `TODO.md` defect with its price (one reordering, behaviour rather than prose).
- **Counters:** `tools/**` **111 → 107** Cyrillic lines (the two spellings of `docs-facts.js` and the
  comment naming them, plus the example in `run-tests.js`); `TODO.md` **3 → 2**; the tracker's closing
  inventory re-measured whole, this entry included — `src/**` 65, `bin/**` 0, `tools/**` 107, `test/**` 123,
  `templates/**` 0, `fixtures/**` 308, `docs/**` 361 (the page 1, `docs/plans/**` 360), `worklog/**` 7 678,
  `plans/archive/**` 15, `eslint.metrics.config.js` 2, `BLOCKERS.md` 33, `TODO.md` 2, total **8 694**
  against 9 037 before the release (the page's lines are the bulk of the drop). The journal keeps growing,
  so the reading is dated rather than final.
- **Nothing else moved:** checks **70** fast and **175** full, `failures 0`; `dup` unchanged
  (`clones 5, lines 29`, the baseline holds 5 fingerprints); the artifact's content digest `1bdb27e1…` and
  the reference file's own sha256 `cdda8d01…` unmoved; the report from the tarball byte-identical
  (66 427 B); the full profile green before the push (8 steps, 92.3 s).
- **One red met on the way, and it was the linter's, not mine to talk away:** the metrics sensor flagged
  `tools/run-tests.js:2` for a debt marker — the comment cited `TODO.md` by name. The comment was
  rewritten to name the open notes in words, and the sensor went green without any threshold or baseline
  being touched.

## Not done

- No code behaviour changed: no condition, no argument order, no output. The one defect found (the
  runner's flag order) is written down instead of repaired, because repairing it is behaviour.
- `src/metrics.js:61-63` — the last Russian comment in `src/` — stays: it is true prose, not a stale or
  dead explanation, and its own `TODO.md` entry offers the choice of a portion of its own or a permanent
  name in the allow-list. The tracker's allow-list row for it is unchanged.

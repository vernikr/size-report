# C3 steps 7–8: `docs-commands` and `parity` speak English

What was asked: the next portion of point 5 — the two files the mission named (`docs-commands` and
`parity`, which the plan numbers as steps 7 and 8), then the `gates-*` files. Translations only, one
commit, English message and journal entry, full `verify` before the push, CI checked afterwards.

## Done

- `test/docs-commands.test.js` **22 → 5**, `test/parity.test.js` **15 → 0**; the owner C3 reads **177**
  (was 209). Seventeen names and messages in the first, fifteen in the second.
- The five lines left in `docs-commands` are named one by one: the invented cause and its text that
  the check feeds to `refuseCause` (`:146` — an input, not a message: the assertion around it reads
  only the English sentence `/refusal cause is not declared/`), the comment quoting the Russian word
  the tolerance exists for (`:155`) and the three tolerance regexes (`:181`, `:184`, `:186`).

## Measured, not argued

- **`docs-commands`, three experiments, sources restored byte-identical:** renaming the help's section
  marker in `src/refusal.js:136` alone reddens check 3; renaming one cause in `CONFIG_CAUSES` alone
  (`'unknown flag'` → `'unrecognised flag'`) reddens the same check, which is the measured proof that
  the `README.md` row is a contract read through `readmeCauses()`; and `docs-pin` stays green through
  both, its help coming from history.
- **`parity`, two experiments:** one value of `SKIP_WORDS` made English in `src/history.js` reddens
  `parity` at checks 1 and 3 while `frozen.test.js` stays green (4 of 4) — the pair that tells a moved
  standard from a broken engine, measured here rather than quoted; and `' rows × '` changed in
  `src/modes.js:89` reddens `parity` at check 2, so S1's summary shape is a live read.
- Red first by the whole file: both files at their `HEAD` version ran green (4 of 4 and 3 of 3).
- Checks unchanged (4 and 3; 70 fast, 175 full); `dup` unchanged (`clones 5, lines 29`); the artifact's
  **content** digest (`fixtures/parity/artifact.sha256`) stays `1bdb27e1…` and the reference file's own
  sha256 `cdda8d01…`; full `pnpm run verify` (8 steps) green before the push.
- Neither file is a gate file, so this commit carries **no** `Gate-Change:` trailer (checked by the
  hook); step 2, the six `gates-*` files, is where the trailer starts.

## Suggested

- The plan's step order was overridden by the mission's naming for this portion: `docs-commands` and
  `parity` are steps 7 and 8 of `tests-guards.md`, so their siblings (`docs-pin`, `frozen`) and steps
  2–6 (the six gate files) remain. Written into the tracker and the subplan so the next portion does
  not read the numbering as a promise.
- The owner's remainder still splits in two, as recorded: the **data** (fixtures' contents and names,
  the witnesses' Cyrillic paths and identities) and **D1's debt** (the workflow step names and the
  `.gitignore` reader).

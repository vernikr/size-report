# 0176 — i18n W2 step 3: the duplication sensor, and a baseline that is not one word

**Request.** Point 5, next portion: step 3 of subplan W2 — `tools/gates/dup.js` with its probe reader and
the script that re-takes its baseline. Only literals; behaviour, thresholds, fingerprints and the
composition of the baseline must not move; the trailer is due on every commit of this owner.

**What moved — 20 lines, and the file reads 0.** The fallback reason of a run without a report
(`'no report'`), the refusal of a failed run, the baseline's `note`, the re-take verdict
(`'dup: the baseline is re-taken — N fingerprints in … (clones N, lines N)'`) and its advice, the refusal
when there is no baseline (`'dup: there is no baseline (…) — collect it: pnpm run baseline:dup'`), the
names of the two looks (`'the baseline file'`, `'against <ref>'`), the unpacking failure, the failed run
over the ref's tree, the missing-ref note, the red verdict (`'dup: new clones N (the baseline holds X
fingerprints, the tree has Y)'`), the detail line of a clone, the advice and the green verdict. The two
probe reads moved with them: `test/gates-dup.test.js:72` → `/new clones 1/`, `:88` → `/no baseline/`.

**Red first, one printed message at a time** (each put back to Russian alone, the whole probe file run):
exactly two redden anything — the no-baseline refusal and the red verdict. The refusal of a failed run,
the re-take verdict and advice, both look names, the three ref notes, the clone detail line, the advice
and the green verdict all leave the probe **green**, which is the measurement of "no reader". One caveat
about method, recorded because it nearly read as a reader: the first attempt at the missing-ref note
patched the literal into a **syntax error of my own making**, which failed the sensor; patched correctly
the case is green, so nothing was hidden there.

**The baseline — the step's real finding (`BLOCKERS.md` N31).** The plan said to re-take it with its
script. Measured before doing so: the committed `dup-baseline.json` holds **15 fingerprints** while the
tree produces **8** (`clones 8, lines 47`), and `newer()` counts only what exceeds the baseline, so the
seven extras are tolerated leftovers. `pnpm run baseline:dup` writes `current.counts`, so it would prune
them — a composition change, which this portion's frame forbids even though the script is the prescribed
way to touch a baseline. So the `note` was moved **by hand**: the JSON diff is one line, the fingerprints
are byte-for-byte what they were (same 15, same counts, compared against `git show HEAD:`), the sensor
answers as before, and the hand-written text was proved **equal to the script's own two literals** — a
later re-take will not change the wording. Whether to prune the seven is the user's decision, with its
price stated: pruning is one script run with the trailer and makes the ratchet stricter, while the seven
sitting there would let seven historical clones return silently.

**Counters.** `tools/gates/dup.js` 20 → **0**, `dup-baseline.json` 1 → **0**, the owner 89 → **68**.
Untouched: the fingerprints (same set and counts), thresholds, `GATE_FILES`, the coverage baseline, the
profile split, `SITES` 27, `PRINTED` 2/2/1/2/4, `CASES` 38, 70 checks in the fast run and 175 in the full
one. `pnpm run dup` asked separately, twice: green both times, no new twin.

**Trailer.** The commit carries `Gate-Change:` (dup.js and its baseline are gate files, and so is the
probe); the hook confirmed it.

**W2 is not closed** — step 3 of seven. Left: `coverage.js` 18 with `coverage-baseline.json` (step 4, where
the same staleness question is measured rather than assumed), `gatefiles.js` 7 (step 5), `tools/suites.js`
38 (step 6) and the four hook messages (step 7) — 68 lines. Then C1–C3 and D1. Nothing ships here, so no
release is owed; N20 stays open.

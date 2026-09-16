# 0179 — i18n W2 step 6: the split declaration and the reasons it carries

**Request.** Point 5, next portion: step 6 of subplan W2 — `tools/suites.js` with its reader
`test/suites.test.js`. Only literals; the composition of the runs, the thresholds and the baselines stay put.

**What moved — 38 lines, and the file reads 0.** The thirty-seven `why` texts (19 in `FAST`, 18 in `SLOW`) and
the unknown-run error, now `unknown run “…” (there are: fast, full)`. **Keys and protocol were not touched:**
the `file` fields and the profile names `fast`/`full` stand as they were, and the `why` message keeps
`fast`/`full` as its protocol words.

**Red first, one reason at a time: all 38 stayed green.** Every reason went back to Russian on its own and
`node --test test/suites.test.js` answered the same both ways — that is the measurement of "no reader of the
text" rather than an assumption. What the probe really holds was measured in the same sitting: a reason
shorter than thirty characters reddens it, and the field renamed from `why` to `reason` reddens it. So the
guard reads **presence, the field's name and the size** of a reason, never its wording.

**The split itself is unchanged, measured.** The file lists are identical to `HEAD` (19 + 18 entries,
compared by importing both), every `why` is still longer than thirty characters, and `--list` prints the
same commands as before this step (`fast` five lines, `full` eight, `slow` ten — the counts step 1 recorded;
`tools/gates/run.js` was not touched either). The runs keep their size: 70 checks fast, 175 full.

**Counters.** `tools/suites.js` 38 → **0**; the owner W2 42 → **4** (only the two hooks' messages are left).
Untouched: `GATE_FILES`, thresholds, both baselines, the profile split, `SITES` 27, `PRINTED` 2/2/1/2/4,
`CASES` 38, 70 checks fast and 175 full. `dup` asked separately: green, 8 clones, 47 lines, 15 fingerprints,
no new twin — the long English reasons produced no clone.

**Trailer.** `tools/suites.js` is a gate file and so is the probe; the commit carries `Gate-Change:` and the
hook confirmed it.

**W2 is not closed** — step 6 of seven. Left: the four hook messages (step 7), the last portion of this
subplan. Then C1–C3 and D1. Nothing ships here, so no release is owed; N20 stays open, and N31 plus N32 wait
for the user.

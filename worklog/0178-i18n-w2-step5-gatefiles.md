# 0178 — i18n W2 step 5: the gate-file guard

**Request.** Point 5, next portion: step 5 of subplan W2 — `tools/gates/gatefiles.js` with its reader in
`test/gates-files.test.js`. Only literals; the `GATE_FILES` list, the thresholds and the baselines stay put.

**What moved — 7 lines, and the file reads 0.** The verdict that the trailer is there
(`✓ <what>: gate files N, the Gate-Change: trailer is there`), the red verdict of a gate edit with no
trailer (`<what>: a gate edit with no Gate-Change: trailer`), the two advice lines under it
(``add a line `Gate-Change: <reason>` to the commit message — thresholds and baselines are changed by a
person on purpose``), the commit-can-be-made verdict (`✓ gatefiles: the commit can be made (N files, gate
files M)`), the range verdict (`✓ gatefiles: across <ref>..HEAD there are N commits, none of them touched a
gate file without the trailer`) and the no-mode refusal. The three reads moved in the same commit:
`test/gates-files.test.js:77` and `:115` → `/a gate edit with no Gate-Change: trailer/`, `:106` →
`/the commit can be made/`.

**Red first, one printed message at a time:** exactly **two** of the seven redden the probe — the red verdict
of a gate edit (its two reads) and the commit-can-be-made verdict. The other five (the trailer-is-there
verdict, both advice lines, the range verdict, the no-mode refusal) leave the probe green — the measurement
of "no reader". No negative match over this text: the probe carries no `assert.equal(/…/.test(out), false)`.

**Behaviour was not reached.** The strings that decide whether a commit is a gate-file commit — the
`GATE_FILES` list, the `TRAILER` pattern, `hasTrailer`'s twelve-character reason — were not touched; only
words a person reads moved. That distinction matters here more than anywhere else in W2, because this
sensor's verdict is printed on every commit, including its own: the hook answered
`✓ gatefiles: gate files 3, the Gate-Change: trailer is there` for this commit, and
`node tools/gates/gatefiles.js --range origin/main` answered `✓ gatefiles: across origin/main..HEAD there are
0 commits, none of them touched a gate file without the trailer` (this portion is not committed yet, so the
range is empty — the pre-push hook will re-read it over the two commits that land).

**Counters.** `tools/gates/gatefiles.js` 7 → **0**, the owner W2 49 → **42** (left: `tools/suites.js` 38 and
the four hook messages). Untouched: `GATE_FILES`, thresholds, both baselines, the profile split, `SITES` 27,
`PRINTED` 2/2/1/2/4, `CASES` 38, 70 checks fast and 175 full. `dup` asked separately: green, 8 clones, 47
lines, 15 fingerprints, no new twin.

**Trailer.** The commit carries `Gate-Change:` (the sensor and its probe are gate files); the hook confirmed
it.

**W2 is not closed** — step 5 of seven. Left: `tools/suites.js` 38 (step 6) and the four hook messages
(step 7) — 42 lines. Then C1–C3 and D1. Nothing ships here, so no release is owed; N20 stays open, and N31
plus N32 wait for the user.

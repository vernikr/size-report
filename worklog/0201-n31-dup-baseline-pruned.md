# N31: the stale duplicate fingerprints are pruned

What was asked: the user's decision on `BLOCKERS.md` N31 — whether to prune the fingerprints the tree no
longer produces — given together with N19, N20 and N32. The answer: prune the garbage.

## Done

- `pnpm run baseline:dup` — the scripted re-take `AGENTS.md` prescribes, no hand editing anywhere.
- `dup-baseline.json`: **15 fingerprints → 5**, the diff 1 insertion and 11 deletions.
- The reason travels in the commit's `Gate-Change:` trailer, the baseline being a gate file. N32's
  decision (fix the sensor's unit) is recorded as decided with its price and its instrument, and is the
  next portion; N19 was done in its own commit before this one.

## Measured, not argued

- Nothing but the composition moved: `schema`, `config` and `note` compare **equal** to the previous
  revision (checked against a copy taken before the run), and every surviving fingerprint is an entry the
  file already had. The five that stay are `21bdd8cb03a5dc0d`, `8539b34ea1763009`, `3063b60f1af9e34c`,
  `2d97944126ee542e`, `e13341ade2407c21`.
- The sensor's reading is the same before and after — `✓ dup: no new clones (clones 5, lines 29, the
  baseline holds N fingerprints; looks 2: the baseline file, against origin/main)` — so the prune changed
  no verdict on today's tree, only what the file claims to tolerate.
- The ratchet is now **stricter**, which is the point of the decision: a fingerprint absent from the
  baseline can never hide anything, so a reappearance of any of the ten historical clones is a new clone
  rather than a tolerated leftover. Before the prune the file said 15 while the tree produced 5.

## Suggested

- The batch of `N20` is what this feeds: with N19 done and N31 done, one sensor repair (N32) is left
  before the single PATCH release, the journal section and the pin in `README.md`.
- The number the note predicted for a re-take (8) was itself overtaken by events: N33's and N34's
  extractions took their pairs out of the tree, so the honest count at the moment of the prune was 5 —
  said here rather than left as a discrepancy between the note and the file.

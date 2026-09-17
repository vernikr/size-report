# The audit's four findings: the records now say what the tree says

What was asked: take the four places where the records contradicted the tree, each by measurement rather
than memory — N14 in `BLOCKERS.md`, the head of `configs.md`, the `S4` row of the tracker, and
`worklog/0199-i18n-d1-closed.md` — writing only records, no code and no behaviour. The last portion in this
mode: if the measurement confirms nothing else is out of line, close it and say what stays with the user.

## Done

- **`BLOCKERS.md` N14 is answered rather than open.** The header now says so and points at N32; the closing
  paragraph («What became of this note») records that **option 2 was taken** (N32's work), **option 1 was
  consumed** by the baseline re-take the change of unit made inseparable from it, and **option 3 is moot** —
  with the present tense corrected: the slow profile is green today.
- **One class is left open in N14 on purpose** (see below): code arriving without any execution, which a
  floor over executed counts cannot see. Named with its two options and their prices, not decided here.
- **`N32` gained the mutual link** — a closing paragraph saying it is the answer to N14 and what N14 still
  holds.
- **`configs.md`'s head** no longer says «not started»: all nine steps done by 2026-09-17 and closed, its ten
  files reading 2.
- **The tracker's `S4` row** reads `**done 2026-09-16**` instead of `**in progress 2026-09-16**`, the same
  cell ending in «S4 is closed».
- **`worklog/0199-i18n-d1-closed.md`** kept as it was read that day, with one added bullet carrying the
  reverse links: which portion closed each of the five numbers it listed as open, and that N33–N35 came
  after the snapshot.
- **Three more of the same class, found while measuring and fixed in the same commit:** the tracker still
  introduced its closing rows as «the ones not started» and named `W2` twice, once un-struck; and both the
  `D1` row and the summary paragraph gave D1's counter as **4**, which N19's answer had already cut to 2.

## Measured, not argued

- **The slow profile is green, run again today:** `pnpm run cover` answers `cover: lines 80.6%, branches
  89.05%, functions 92.37% of the set (the ratchet compares executed counts per file)` and
  `✓ cover: no regressions (the baseline holds 39 files)`, exit 0 — the totals N14 recorded while red.
- **D1's counter, counted file by file:** the ten files read `eslint.metrics.config.js` 2 and nothing else;
  `templates/size-report.config.json` is 0 since N19.
- **The one regression that was `src/data.js` was of the mechanical class too:** today's summary gives it
  `lines 115 of 115` and `branches 34 of 38` (the 89.47 % N14 recorded as red), while the nearest integer
  pair fitting the old baseline's 91.66 % is 33 of 36 — so one more branch executed than the old floor held,
  and the fall was the denominator. Labelled as arithmetic in the record: the old baseline's shape
  (percentages) cannot settle it, which is the reason the unit changed.
- **The class that stays open, measured:** `src/data.js` carries 4 branches that never run and
  `src/cli.js` reads 71.3 % of its lines, and the run above stays green and exits 0.

## Not touched

- No code, no thresholds, no baselines, no gate file — so no `Gate-Change:` trailer (5 files, gate files 0,
  confirmed by the hook).
- `TODO.md`'s four open entries stay as they are, including the bracket in the third one that the audit also
  noticed; a defect is fixed in a portion of its own.

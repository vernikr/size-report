# Page performance: speed, weight on disk, memory

Source: `page-clicks-and-weight-cons.txt` (the report measured with `tools/perf/` scripts on
`docs/size-report.html` of this repository, 1 467 578 B, 213 commits × 263 files × 3 metrics).
The report's §7 order is one file per step here; the report itself stays the reasoning, these files are
what gets built and how it is proven.

Numbers below are quoted from the report, not re-measured: they were taken under jsdom 26 / Node 22.22.3,
which is slower than Chrome in node creation and class edits, so absolute milliseconds in a browser are
smaller while the **number of operations** — what the conclusions rest on — is the same.

## The steps

| File | Step (report §7) | Effect named by the report | State |
|---|---|---|---|
| [01-accuracy-removal.md](01-accuracy-removal.md) | 1 — remove the exact/approximate split | −56 310 B of data, −336 000 `charAt` per render | done |
| [02-columns-hidden.md](02-columns-hidden.md) | 2 — build the table once, toggle visibility | click ×193…×1710, zero nodes per click | done (measured: jsdom ×48 a file, ×585 a metric; Chrome ~13 ms a file; 0–651 nodes per click) |
| [03-panel-in-place.md](03-panel-in-place.md) | 3 — the panel stands still, indexes once | −29 ms per render, scroll and focus stop breaking | closed by step 02's code + two checks (the index maps: measured at 0.4–0.7 ms of a 143–175 ms click — not taken) |
| [04-write-cheap.md](04-write-cheap.md) | 4 — passport cache, debounced address | −4.6 ms per click (~15 % of what is left) | done (measured: the write 2.095 → 0.05 ms a click; the passport 0.0435 → 0.002 ms; the address call 2.3 ms of the click, now once per burst — a warmed burst of 5 clicks 41–50 ms → 14–27 ms; the deferred write has a guard of its own — a rebuild inside it reddens «разметку пересобирает таймер») |
| [05-sparse-model.md](05-sparse-model.md) | 5 — sparse history, `schema: 2` | 1 433 → 153 KiB, parse 11 → 3.9 ms | done (measured: data block 1 370 724 → 88 712 B, artifact 1 442 368 → 166 231 B, parse 11.62 → 0.58 ms + 3.33 ms of unrolling; the table's 217 rows / 173 817 cells / 182 386 nodes and the total at HEAD unchanged, start unchanged in Chrome — the DOM, not the data, is what it pays for) |
| [06-strip-comments.md](06-strip-comments.md) | 6 — comments out of the pasted program and CSS | 153 → 110 KiB, deterministic | done (measured: program 58 922 → 24 885 B, styling 15 505 → 5 905 B, artifact 166 305 → 122 668 B — −42.6 KiB against the promised −42.9; the sources keep their comments, the paste is guarded by the stripper's own `assertCompilable`, and in Chrome the squeezed page is identical to the unsqueezed one in every computed property, in the DOM counts and in the totals) |
| [07-minification.md](07-minification.md) | 7 — minification, if the fixed point allows | 110 → 103 KiB | decided: **not taken** (measured: program 24 885 → 18 128 B, styling 5 906 → 5 102 B, artifact 122 668 → 115 107 B — 7 561 B and 91 ms a build, against a builder that would be machine-dependent, or one that refuses without a pinned esbuild; reopens when the artifact's weight is the reason itself, then only pinned-and-refusing, and only after step 08) |
| [08-data-compression.md](08-data-compression.md) | 8 — compressed data block | 103 → 62 KiB, async load, unreadable data | taken (measured: block 88 786 → 42 856 B, artifact 122 668 → 78 319 B, unpack 1.0–2.1 ms in Chrome; the first drawing is one promise long, the block is no longer readable by eye, and a host without `DecompressionStream` is told in words — the suites read the page in jsdom with the platform's unpacker put in, and one check reads it without) |
| [09-fixed-layout.md](09-fixed-layout.md) | 9 — `table-layout: fixed`, widths from the builder | 170 759 cells not measured; unblocks 10 | taken, but **the promised win does not show**; the numbers are in the file (the widths 0.1 ms against 831–979 ms, one layout pass either way, costs 2 078 B and a 7.7 %-wider table) |
| [10-content-visibility.md](10-content-visibility.md) | 10 — `content-visibility: auto` on rows | layout memory ÷ ~7, nodes stay | decided: **not taken** — the property is dead on a table row in this Chrome; numbers in the file, probe `probes/archive/step-10-tables.mjs`; the report's fallback stands (step 12) |
| [11-border-collapse.md](11-border-collapse.md) | 11 — `border-collapse: separate` | the border map of the whole grid goes away | decided: **not taken** — every border softens from one pixel to two, and the win (130–180 ms, 7.8–10.6 %, off the low end of a first layout) is not confirmed on one table in one tab; numbers and the reopening condition in the file, probe `probes/archive/step-11-borders.mjs` |
| [12-virtualization.md](12-virtualization.md) | 12 — row virtualization | DOM and layout ÷ ~7, startup independent of history | **not planned by request** |

**Step 09's fate** is settled by a Chrome trace with a memory-infra dump: the layout objects and the raster of the 7.7 %-wider table against the 831–979 ms the automatic algorithm spends on the widths.

Steps 2–4 do not touch the data and step 5 does not touch the render, so 2, 3, 4 and 5 may go in any
order; the order above is the report's and is also the cheapest-first one. Steps 9–11 answer the memory
side of the report (§10) and are deliberately cheaper than step 12.

How to read the **State** column: `done` — the effect is measured and the checks stand behind it; `closed`
plus a reason — the step's work came with another step's code, and the file names which places close it;
`decided` — the step was a question, answered, with the number, the reason and the condition that reopens it
written in its file (07); `decision` — still a question rather than work, with the recommendation in its file
(08); `todo` — not started.

## Terms used by every file

- **Artifact** — `docs/size-report.html`, the single self-contained report of this repository, committed
  and refreshed by the post-commit hook.
- **Fixture** — the synthetic history under `fixtures/synthetic` (and the frozen reference under
  `fixtures/parity`) that the checks build against; frozen numbers live there rather than in a test.
- **Page program** — what `src/page/build.js` pastes into the artifact: `src/derived.js` first, then
  `src/page/{payload,state,dom,panel,table,app}.js`, with the module syntax stripped line by line and the text
  squeezed (comments and indentation out — the sources on disk keep them).
- **What proves nothing broke** — `pnpm run verify:fast` on every edit, `pnpm run verify` before a push.
  The checks that stand behind a claim are named in the file that makes it.

## Where this work stands against `main`

Steps 01–07 sit on a base **30 commits behind `origin/main`** (as of 2026-09-17). Main moved through the
i18n work (the default locale became English), pruned the stale fingerprints of `dup-baseline.json`, and
rebuilt `docs/size-report.html` on its own side, so the artifact differs on both sides by construction.
Nothing here was merged or rebased on purpose: a merge is a commit, and it is the user's decision. Two
consequences worth knowing before that merge — the artifact has to be rebuilt afterwards, and the figures in
this folder and in `README.md` were measured on **this** base, with a Russian report, so they have to be
re-taken rather than trusted after it.

## The rule all steps share

A step is closed only when a number moved in the direction the report promised and the checks stayed
green: `pnpm test:all` (both references, the page in a real DOM), the artifact rebuilt byte for byte from
the history, and — where the artifact's bytes are what changed — the report of this repository rebuilt by
`--write` and committed as a commit of its own.

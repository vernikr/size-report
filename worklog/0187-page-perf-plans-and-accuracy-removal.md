# 0187 — the page-performance plan set, and step 1: the exact/approximate split is gone

Requested: a folder under `plans/` with one implementation plan per item of
`page-clicks-and-weight-cons.txt`, then the steps taken one per pass with a stop after each for further
instructions. Everything except row virtualization is to be built; the splitting of numbers into exact
and approximate is to be taken out of the package entirely.

## The plan set

`plans/2026-09-17-page-perf/` — an index (`README.md`) and twelve files, one per step of the report's §7,
each with why, what changes (files and functions), acceptance, risks:

`01-accuracy-removal`, `02-columns-hidden` (build the table once, toggle visibility),
`03-panel-in-place`, `04-write-cheap`, `05-sparse-model`, `06-strip-comments`, `07-minification`
(decision: not taken — an optional dependency in the artifact's assembly breaks the fixed point),
`08-data-compression` (decision: only below 100 KiB), `09-fixed-layout`, `10-content-visibility`,
`11-border-collapse`, `12-virtualization` (**deferred by request**, the design and the risks recorded).

## Step 1 — measured

The split is gone from the engine, the data, the page, the styling and the dictionaries: `approx` out of
`reportData` and out of the carried state, `accuracy` out of the metric views, `pointExact` deleted,
`appApprox` deleted (it was 1 578 cell reads per row — ~336 000 `charAt` per render on the report's own
artifact), the `approx` class and the `#grid td.approx` rule out, the three words out of `LOCALES`.
Kept on purpose: `method` (it says how a number was obtained — the panel prints it) and the sensor gaps
(a missing optional dependency changes the way a number is counted; that is a fact about the run, and the
report's §6 does not name it).

The artifact of this repository, rebuilt by the local engine: **1 501 645 → 1 426 712 B (−74 933)**. The
report's own estimate for the report's artifact is −56 310 B of data plus the dictionary; the rest here
is the 32 286 cell `title` attributes of the removed marks and the removed page code. The data block now
carries no `approx` and every metric description is exactly `key, label, method, note`.

Checks: the four suites that asserted the removed behaviour were rewritten to assert the opposite promise
(the contract holds no field or mark of precision; the page marks no cell; the method still names the
formats counted another way) — check counts unchanged (70 fast, 175 full), so the documentation table of
runs did not move.

## A red sensor, fixed in the code

`dup` reddened on a near-clone between `test/cli-paths.test.js` and `test/doctor.test.js` (six lines of
building a shallow clone) that the smaller corpus surfaced. The baseline was not touched: the shared part
moved into `tools/harness.js` as `shallowClone(from, into)` — asserted shallow, hard links off — and the
four checks that built the seam by hand (`cli-paths`, `doctor`, `hook`, `refusals`) now call it.

## Measured after

`verify:fast` green (lint strict, metrics, dup, deps, 70 checks); `verify` green (8 steps: the full run,
parity with the live project, the reproducibility of the standards, the tarball), 175 checks, failures 0.

Left open for the next pass, in the order of the report: step 2 (visible columns, incremental totals),
step 3 (the panel in place), step 4 (passport cache, debounced address), step 5 (sparse model), then the
memory group 09–11. Not done and deliberately: the release (version, tag, attached copy) — the artifact
here is rebuilt by the local engine while `node_modules/@vernikr/size-report` still holds 2.4.0, so the
hook would rebuild it with the old code until the copy is attached.

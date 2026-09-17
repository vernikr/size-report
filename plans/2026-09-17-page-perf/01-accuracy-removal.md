# 01 — Removing the exact/approximate split

Source: report §6 (and §7 step 1). State: **done** (this pass; see "What was changed" for the sites).

## Why first

It is the only step that shrinks the data block, the render and everything else at once, and it costs no
new machinery — it deletes a mechanism. The report measures for this repository's artifact:

- `approx` — 56 310 B of data (bit strings "this cell is approximate", only for the `min` metric);
- the dictionary `#ui` loses three keys (`exact`, `approximate`, `approxCell`, 127 B of 2 330);
- `metrics[].accuracy` goes (read by one place, `src/page/panel.js`), `method` stays — it names how a
  number was obtained rather than how honest it is;
- the rule `#grid td.approx` and the `approx` class in `appCellClass` go, and with them 32 286 `title`
  attributes per report — one per approximate cell, built by concatenation;
- `appApprox` did **1 578 cell reads per row × 213 rows ≈ 336 000 `charAt` per render**, and it was the
  only place in the page that walked every switched-on file for every cell of every row.

## What is deliberately kept

- **`method`** — the panel prints it outside the question of accuracy ("raw — способ счёта: размер
  объекта git"), and it is what tells a reader which formats the minifier did not take.
- **Sensor gaps** (`sensorGaps`, `minEngine`, exit code 4, `doctor`'s `sensor` finding, the `!` note):
  a missing optional dependency changes the **way** a number is counted, which is a fact about the run
  rather than a per-cell judgement. The report's §6 does not name it, and dropping it would take away the
  only warning that a report was built by simplification. The wording of those texts is edited to drop
  the accuracy vocabulary while keeping the cause and the fix.
- **`--json` and `--data` shapes apart from the removed field**: `--json` is frozen by the parity fixture
  (`fixtures/parity`) and does not carry `accuracy` or `approx` at all, so parity stays untouched.

## What was changed

Engine:

- `src/metrics.js` — `accuracy` out of `METRICS.raw`, `METRICS.gzip`, out of `metricView` and out of both
  views (`minView`, `tokView`); `pointExact` deleted (its only caller was `history.js`);
  `approximateFormats` renamed `otherCountFormats` and kept — it is what lets the method name the formats
  counted another way; the trailing "— an approximation" / ", то есть приближение" clauses removed from
  the method and note texts, keeping the substance ("other formats (.md .toml) lose comments and
  indentation", "binary formats (.png) are counted by bytes rather than text").
- `src/history.js` — no `approx` in the carried state and no `approx` in a row; `pointExact` import gone.
- `src/data.js` — `reportData` no longer carries `approx`; `approxMarks` deleted.
- `src/strip.js` — the `EXACT_STRATEGIES` comment no longer speaks of exactness.
- `src/tokens.js`, `src/minify.js`, `src/optional.js`, `src/init.js`, `src/project.js`, `src/check.js`,
  `src/modes.js`, `src/doctor.js` — comments and the few texts that used the accuracy vocabulary.

Page (the pasted program and its styling):

- `src/page/table.js` — `appApprox`, the `approx` parameter of `appCell` / `appValueCell` /
  `appCellClass` and the tooltip built from `appUi.approxCell` are gone.
- `src/page/panel.js` — the metric switch's tooltip is `note` alone, with no "точное число"/"приближение".
- `src/page/build.js` — `exact`, `approximate`, `approxCell` out of the page's dictionary.
- `src/locales.js` — the three keys out of both locales.
- `src/page/app.css` — the `#grid td.approx` rule out; the comment above it says what is left.
- `src/page/state.js` — comments: the page draws no conclusion about a number's accuracy, and there is no
  second rule of it to drift from.

Checks and documents:

- `test/contract-data.test.js` — the two accuracy tests became two checks of the opposite promise (the
  contract holds no `accuracy` and no `approx`; the method still names the formats counted another way and
  nothing else).
- `test/page-view.test.js` — the precision test became "the page draws no accuracy of its own": no
  `approx` class anywhere, no cell tooltip, and the frozen list of the page's functions lost `appApprox`.
- `test/minify.test.js`, `test/tokens.test.js` — the assertions that read `accuracy` and `data.approx`
  were replaced by the same checks of the method text; the degraded-sensor assertions stayed.
- `README.md`, `templates/README.md` — the sections about accuracy rewritten (one contract fact fewer,
  the panel names the method, code 4 keeps its meaning as "another count").

## Acceptance

- `rg -n 'approx|accuracy' src bin tools templates` answers with nothing but the sensor-gap texts
  (reworded) — no field, no class, no key, no vocabulary left.
- `pnpm test:all` green, including both frozen references (`test/parity.test.js`, `test/frozen.test.js`)
  and the page in a real DOM (`test/page-view.test.js`).
- The artifact rebuilt from the history is byte-identical to the one on disk (`pnpm run sizes` / the
  `check` mode), and it is **smaller**: the data block loses the `approx` record and the page's dictionary
  loses three keys.
- `pnpm run verify:fast` green: the strict linter, the bloat sensors, the fast set.

Measured when it was done (2026-09-17, `worklog/0187-page-perf-plans-and-accuracy-removal.md`): this
repository's artifact **1 501 645 → 1 426 712 B (−74 933)**; check counts unchanged (70 fast, 175 full), so
the documentation's table of runs did not move; `verify` green, 8 steps.

## Risks and what was watched

- **The page's own rule of accuracy.** The removed mechanism existed because the page must not re-derive a
  fact: with `approx` gone there is nothing to re-derive, and the guard that the page grows no calculation
  (`test/page-view.test.js`) still holds.
- **Texts that a person reads.** The method is what stands in the report, so the wording was checked by
  eye on the rebuilt artifact, not only by the checks.
- **Baselines.** `coverage-baseline.json` and `.eslint-suppressions.json` are gate files: if the removed
  code moves them, they are re-taken by hand (`pnpm run baseline:coverage`, `baseline:metrics`) and the
  commit carries the `Gate-Change:` trailer.

# 12 — Row virtualization (not planned by request)

Source: report §5 and §7 step 12. **Deferred by the request that commissioned this set**: everything except
virtualization is to be implemented. This file records the design and the reasons, so the decision can be
revisited with the earlier steps in hand.

## What it is

Only the visible ~30–40 rows (plus two spacers that keep the height) live in the DOM; the rest is created as
the reader scrolls. Effect: 170 759 cells → ~25 000, startup and layout proportional, and startup stops
depending on the length of the history. It is consistent with step 02 (column visibility does not depend on
the windowing logic) and with step 05 (the window is taken by row index, no dense snapshots needed).

It is the **only step of the whole plan that lowers the page's baseline memory** rather than a spike: with
the numbers of the report, the DOM and the layout fall by roughly 7 times (§10.4).

## Why it is not cheap

- **Window logic and scroll synchronisation**: a scroll handler that decides which rows to keep, plus the
  spacers' heights, plus the interaction with a table (not a list) where rows cannot be absolutely
  positioned without leaving the table model.
- **The sticky pieces**: the two-row sticky header (`top: 0` / `top: 22px`) and the sticky commit column
  (`left: 0`) assume that all rows are present.
- **Accessibility, page search, printing, copying the table**: all four rely on the DOM holding the data.
  `Ctrl+F` would no longer find a row that is not rendered, and "select all + copy" would copy a window.
- **The point edits of step 02** would narrow to the visible rows — which is a simplification — but the
  totals then have to be maintained for invisible rows anyway (they already are, by the accumulator).

## Cheaper steps come first

Steps 09, 10 and 11 answer the same memory pressure for a fraction of the work:
`table-layout: fixed` removes the cell measurement (the biggest single layout cost), `content-visibility`
skips layout and paint for off-screen rows while keeping every node, and `border-collapse: separate` removes
the border map. If the memory is still the problem after those three, this step is the next move — and it is
the right moment to decide it, with the numbers measured in a browser rather than estimated.

## If it is taken

- Take it **after** 02 (so a visibility toggle touches only rendered rows) and **after** 05 (the window by
  row index over the sparse history is the cheapest possible read).
- Keep the totals accumulator independent of the DOM, and keep the "now" row always rendered.
- Guard it with checks: the set of rows in the DOM equals the window at a given scroll offset; the total is
  the same as with the whole table; the row heights sum to the same scroll height as before.
- Measure in a browser: DOM node count, layout count and duration, JS heap (`LayoutObject`, `ComputedStyle`
  in a heap snapshot — report §10.6), and the raster layer area in DevTools → Rendering → Layers.

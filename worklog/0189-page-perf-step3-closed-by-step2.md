# 0189 — step 3 closed: the panel half of it came with step 2

Requested: before writing code, check step 03 of `plans/2026-09-17-page-perf/` against what the tree
already holds after step 02; build exactly what is left by its acceptance criteria, and if nothing is left
do not duplicate code — close the step by naming the places it is closed by. Not committed, step 04 not
started.

## What was already here

Step 02 did this step's work as a consequence of doing its own: the panel cannot be rebuilt any more, so
`appPanel()` runs once (from `appFirst()`), a click writes only states (`appPanelState`, `appDirsOf`,
`appCatsOf`, `appDirState`, `appCatState`), and both workarounds the report complained about — the scroll
save-restore (`appScrollTop` / `appScrollBack`) and the focus found by its ordinal number among
`#panel input` — are gone. `appIndexes` / `appCount` are no longer per-click work: they are called from
`appDirHead` and `appTreeList`, that is, only while the panel is built.

## What was left, and what was done

Two acceptance criteria had no check behind them, so they were added to the existing checks (whose counts
stay 73 of 178):

- the "a click makes no table" check now asserts the panel as well: after all eight switches its root, its
  309 switches and its node count are the same node / the same objects / the same number;
- the keyboard check now walks every kind of switch — a metric, a file, a folder, a category — and requires
  the field under the keyboard to be the very same node afterwards, which is what "no ordinal lookup" means;
- and the risk section's drift guard became a check of its own (`test/page-tree.test.js`): after a mixed
  choice every folder's and category's field is compared with the leaves it speaks for, and the files'
  boxes with the table. Probed by taking `appDirsOf` out of `appPanelState`: the check reddens and names the
  folder («data»), and it goes green again with the call back. The panel is written in place now, so this
  is the one promise the old rebuild used to keep for free.

Code was not touched apart from that probe, which was reverted: there was nothing left of the step that the
code did not already do.

## The one part not built, measured first

The step's four precomputed maps (`filesByCategory`, `folderFiles`, `folderParents`, `fileFolders`) were
the only unbuilt item. In Chrome on this repository's artifact (218 × 266, 309 switches): a category click
of 144 files costs 143–173 ms, of which the panel's state update is 0.4–0.7 ms and `appCounts` under
0.05 ms; such a click makes 12 subtree queries, a folder click (117 files) one. Building the whole panel
costs 5.4 ms once, writing the state of all 266 files 1.2 ms. So the maps would replace 0.4 % of a click
and add four structures to keep in step with the view — the drift the step's own risk section names. Not
taken, and the number is written into the plan file instead of the code.

## Measured after

`verify:fast` green (5 steps, 73 checks of 178); `pnpm run verify` green (8 steps: the full run, parity
with the live project, the reproducibility of the standards, the tarball). Watched by hand in Chrome: a
file's box focused, a category switched, `document.activeElement` still that box; `#panel` 1 312 nodes
before and after, its 309 inputs identical by identity.

Left open: step 04 (passport cache, debounced address) — and the release, which stays the user's decision
(the artifact on disk is rebuilt by the local engine while `node_modules/@vernikr/size-report` holds
2.4.0).

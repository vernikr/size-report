# 03 — The panel stands still, the indexes are computed once

Source: report §2.7 and §7 step 3. Depends on: 02 (both change the same handler path). Low risk — this is
the half of the click that costs no time (28.9 ms, 0.6 %) but forces two workarounds. State: **closed**
(2026-09-17) — step 02 built this step's half of the work, and what remained was three checks (two
expectations of the acceptance and the drift guard this file asks for) plus one measurement that says no to
the precomputed index lists; the closing note at the end of this file names every place and every number.

## What is wrong today

`appPanel()` empties `#panel` and builds 306 checkboxes and 1 300 nodes again on every click, and the
structure never changes between renders — only `checked` and `indeterminate` do. Two consequences are
worked around by hand:

- the panel's scroll (and the file list's) is saved and restored (`appScrollTop` / `appScrollBack`);
- the field under the keyboard is found by its ordinal number among `#panel input` and focused again
  (`preventScroll`) after the rebuild.

Also `appIndexes` walks every subtree twice — once in `appTreeList` to learn whether a folder holds
columns and once in `appDirHead` to collect its files.

## What to build

**Build the panel once**, at startup, into the same nodes 02 caches. A click then writes states:

- `filesByCategory[key]` — file indexes of a category;
- `folderFiles[path]` — file indexes of a subtree;
- `folderParents[path]` — the paths of the folders above it;
- `fileFolders[i]` — the paths of the folders a file lies in.

All four are computed once at load; `appIndexes` / `appCount` stop being per-click work (the "2/5" counts
a folder prints are computed from them once).

**State updates on a click** (the rule of the panel is unchanged: only a file owns a state, a folder and a
category are ways to set the same checkboxes):

- file → its `input.checked`, then every folder of `fileFolders[i]` and its category recomputes
  `checked` / `indeterminate` from their index lists;
- folder → all files of `folderFiles[path]`, then the ancestors of `folderParents[path]` and the touched
  categories;
- category → its files, then every folder they lie in.

**The workarounds disappear.** Scroll is no longer reset and the focus node is no longer destroyed, so
`appScrollTop` / `appScrollBack` and the ordinal focus restore are deleted rather than kept in place.
That is the acceptance criterion as much as the speed: the two functions are the evidence that the
rebuild was pointless.

**Folding stays as it is** — a class on the row and a word in the memory, no render (this is the pattern
the rest of the filters now follow).

## Acceptance

- Toggling a file, a folder, a category and a metric leaves the number of `#panel` nodes unchanged and
  keeps the focus on the very input that was clicked (no ordinal lookup).
- `pnpm run verify:fast` green; `test/page-tree.test.js`, `test/page-choice.test.js` and
  `test/page-view.test.js` (the focus test) green.
- The frozen list of the page's function names in `test/page-view.test.js` shrinks by two and gains the
  state updaters.

## Risks

- **A state that drifts from the checkboxes.** Written, and it is the check this file asked for: after a mixed
  choice every folder's and category's field is compared with the leaves it speaks for, and the files' boxes with the
  table (`test/page-tree.test.js`). Probed rather than assumed: with `appDirsOf` taken out of `appPanelState` it reddens
  and names the folder («data»), and it goes green again when the call is put back — a guard that cannot fail is
  decoration.
- **The scroll positions in a narrow window** are two (the panel and the file list). They are no longer
  written by the rebuild, so a check that scrolls both and clicks a switch is worth keeping.

## Closed without new code: what step 02 had already built, and why nothing was added

### Already here when step 02 closed

- **The panel is built once.** `src/page/panel.js` — `appPanel()` runs once, from `appFirst()` in
  `src/page/app.js`; no click path calls it. `appFields` holds the nodes (by metric key, file index, folder path,
  category key).
- **A click writes states, not markup.** `appPanelState(indexes)` writes the files' boxes the click reached, `appDirsOf`
  the folders on their paths (deduplicated by `seen`), `appCatsOf` the categories that hold them; `appDirState` /
  `appCatState` compute a folder's or a category's `checked` / `indeterminate` from the files below it.
- **Both workarounds are gone.** `appScrollTop` / `appScrollBack` and the focus looked up by its ordinal number among
  `#panel input` do not exist: `src/page/app.js` has no path from a click to a drawing, and a check names the four
  removed functions as forbidden.
- **`appIndexes` / `appCount` stopped being per-click work.** They are called only from `appDirHead` and `appTreeList` —
  that is, while the panel is built — and the "2/5" counts a mixed folder prints come from there.
- **Folding is untouched**: a class on the row plus the note in the memory (`appFoldSet`), as this step asked.

### Added now: the acceptance half

- In `test/page-view.test.js`, the "a click makes no table" check now also asserts the panel: after all eight switches
  (a metric, a file, a folder, a category, and each back) `#panel`'s root is the same node, its 309 switches are the same
  objects, and its node count (1 312 here) is unchanged.
- In the same file, the keyboard check now walks **every kind** of switch — a metric, a file, a folder and a category —
  and requires the field under the keyboard to be the same node afterwards, which is what "no ordinal lookup" means.
- `test/page-tree.test.js` gains the drift guard the risk section asks for, as its own check: after a mixed choice
  (two files, three folders, a category and a metric) every folder's and every category's `checked` / `indeterminate`
  is compared with the leaves below it, and the files' boxes are held against the table — the panel and the numbers are
  two views of one state.

### The four index maps: measured, not taken

The only part of "what to build" that is not in the code is the precomputed maps (`filesByCategory`, `folderFiles`,
`folderParents`, `fileFolders`). Measured in Chrome on this repository's artifact (218 rows × 266 files, 309 switches):

| | |
|---|---:|
| a category click (`docs`, 144 files) | 143–173 ms |
| — of it the panel's state update (`appPanelState`) | 0.4–0.7 ms |
| — of it `appCounts` (metrics and files on) | < 0.05 ms |
| subtree queries that click makes | 12, one per touched folder |
| a folder click (117 files) | 115 ms, 1 subtree query |
| building the whole panel once (1 312 nodes) | 5.4 ms |
| writing the state of every file at once (266) | 1.2 ms |

The maps would replace 0.4–0.7 ms of a 143–175 ms click — 0.4 % — with four structures that have to be kept in step with
whatever switches every file, which is exactly the drift this step's risk section is about. The rest of such a click is
the columns' class toggles (144 files × 651 nodes = 93 744) and the totals, which the maps do not touch. The purpose the
maps served — "`appIndexes` walks every subtree twice per render" — is met by those walks happening once at build, and by
the state of a folder being read from the boxes it already owns.

### Acceptance answered

- **A click of any kind leaves the panel's nodes alone and the keyboard where it was** ✓ — checked in jsdom by the two
  checks above, and watched by hand in Chrome: a file's box focused, a category switched, `document.activeElement` still
  that box; `#panel` at 1 312 nodes and its 309 inputs identical by identity before and after.
- **`pnpm run verify:fast` green; `page-tree`, `page-choice`, `page-view` green** ✓ — 73 checks of 178 (one of them
  this step's drift guard; `README.md`'s table of runs moved with it).
- **The frozen list of the page's functions** ✓ — it lost the four names a click must not bring back
  (`appRender`, `appScrollTop`, `appScrollBack`, `appSubHead`, now named as forbidden rather than merely missing),
  and it gained 24 names: the state updaters (`appPanelState`, `appDirState`, `appCatState`, `appDirsOf`, `appCatsOf`,
  `appPanelAll`, `appDirPath`) and the table's own (`appColumn`, `appContribute`, `appTotals`, `appTotalsReset`,
  `appMetrics`, `appOrder`, `appRowCells`, …).

Nothing is committed: this step changed two checks and no page code, which is a result rather than a shortfall.

# 0191 — step 5: the history as changes, not as a snapshot per commit

Requested: continue the plan folder `plans/2026-09-17-page-perf/` — step 05 (`05-sparse-model.md`) by its
acceptance criteria and risk section: the page's block becomes sparse (`schema: 2`), the dense contract
(`--data`, `--json`) stays as it is, the page's numbers must not move, the artifact must stay a fixed point,
two encodes must give the same bytes, and nothing is committed or released.

## What changed

- **`src/page/build.js` — the encoder.** `pagePayload(data)` writes the block: `schema: 2`, the tool, the
  report's words the page reads, `hrefPrefix`, `strs`, `metrics`, `cats`, `files`, `catalog`, `rows`, `last`,
  `hist` (the closed list is `PAGE_KEYS`). `dictionary()` hands out an index per text and extends the list in
  the order of the walk (metrics → categories → files → catalogue → rows), which is what makes a rebuild
  byte-identical. `linkPrefix(rows)` cuts the part the links share — the commit template up to the sha — and
  the rest of an ordinary row's link is the sha the row already carries, so the dictionary reuses it and a
  link costs nothing beyond the prefix. `history()` records, per file, the rows where it appeared (absolute
  numbers), moved (deltas, `change()`) and disappeared (a record of the row alone). `last` travels as the
  list of the indexes the last commit touched.
- **`src/page/payload.js` — a new chapter, the decoder.** `appDecode` unrolls the block into exactly the
  dense contract; `appUnroll` publishes, per row, the object the file was; `appStep` applies one record;
  `appRowOf` and `appText` dress a row and look a text up. A value that did not move is **one object shared
  by every row that holds it** (1 183 objects against 31 651 non-empty cells), which is why the calculation
  (`rowModel`, `totalsOf`, `cellParts`, `valueParts`), the table and the panel were not touched at all.
  `"now"` is not carried: the tail of the unroll is the state at HEAD, and the round trip proves it.
- **`src/page/state.js`** unrolls the block once at load instead of parsing a snapshot per commit, and imports
  the chapter — the line the pasting strips, which also gives the relations sensor the dependency it wants.
- **`src/page/build.js`'s `PAGE_PARTS`** gained `./payload.js` first of the page's own chapters.
- **`tools/page-harness.js`** gained `pageDecode`: the chapter read from disk and evaluated the way the page
  carries it, so the check compares the encoder with the decoder that really unrolls the block.
- **`test/contract-data.test.js`** — one check: the round trip (encode the `--data` contract, decode it with
  the page's own chapter, compare with the dense contract, naming the three declared absences — `skipped`,
  `report.heading`, `report.journal`) plus “two encodes give the same bytes”.
- **`test/page-view.test.js`** — the block's fields are compared with `PAGE_KEYS`, `schema` must be 2, and the
  pasted program's **declarations are counted against distinct names**: a name declared twice in the shared
  scope does not collide loudly, and this step fell into exactly that.
- `README.md` — the check counts moved (77 of 182), a paragraph about the sparse block, the new chapter in
  the module table, and the `--data` wording (the page's block is the same data in sparse form).

## The trap this step walked into

The chapters are pasted into **one scope**, so the decoder's own row helper, first called `appRow`, was
silently shadowed by the table chapter's `appRow` and the page died on load (“Cannot access `appData` before
initialization”) — 22 of 39 page checks red with a stack pointing into `appRow`. It is `appRowOf` now, and
the duplicate-name count in `test/page-view.test.js` is the guard that would have said so at once.

## Measured (2026-09-17, this repository — “before” is the artifact built by steps 01–04)

| | dense (before) | sparse (after) |
|---|---:|---:|
| data block | 1 370 724 B | **88 712 B** (6.5 %) |
| artifact | 1 442 368 B | **166 231 B** (266 columns on both sides; 166 305 B once the chapter entered the index) |
| `JSON.parse` of the block, Node 22.23.2, best of 9 | 11.62 ms | 0.58 ms |
| the unroll (`appDecode`) | — | 3.33 ms |
| `JSON.parse` of the block, Chrome (by wrapping `JSON.parse`) | 10.0 ms | 0.9 ms |
| value objects in the unrolled heap | 31 651 | **1 183** |
| table: rows / cells / nodes in the document / total at HEAD | 217 / 173 817 / 182 386 / 2 663 829 | the same |
| `DOMContentLoaded` in Chrome, alternating runs | 2 691–3 109 ms | 2 795–3 387 ms |

Read honestly: what got cheaper is the parsing of the data (11.62 → 3.91 ms including the unroll), not the
startup — in Chrome the two pages come up in the same ~2.9 s because the table is 173 817 cells and 182 386
nodes, so the runs differ by less than the noise of a loaded machine. The block is 88 712 B against the
plan's 81.5 KiB (its prototype is not in the tree, so the last kilobytes cannot be compared line by line),
and the artifact is 162 KiB against the ladder's 153 KiB because the pasted program grew in steps 02–05 —
that is what steps 06–07 are for.

## Checks

`verify:fast` green (5 steps, 77 checks of 182 — one check added, so both README numbers moved) and
`pnpm run verify` green through its 8 steps (parity with the live project, the reproducibility of the
standards, the tarball). The three page suites: 25 checks, unchanged. The relations sensor named the new
chapter as an orphan until `src/page/state.js` imported it; the metrics sensor stopped
`test/page-view.test.js` at 455 lines, and the fix was the code's own comments (450 now), not a threshold.

By hand in Chrome, from disk: the rebuilt page holds the same 217 rows, 173 817 cells, 182 386 nodes and the
same total at HEAD as the dense one, and the same two switches (the `min` metric off, then `src/data.js` off)
give the same totals on both pages — 2 663 829 → 2 657 729 and 801 → 798 visible cells. `--write` twice gives
the same md5 (`b943b7c7d4decffbdd9260c09356571a`).

## Two gate files the step had to touch

- `git add -N src/page/payload.js` — the documentation guard reads the tree through `git ls-files`, so a new
  source file is invisible to it until it is added; intent to add, no commit. With the file in the index it also
  becomes a column of this repository's own report (267 rather than 266, the artifact 166 305 B).
- `coverage-baseline.json` gained one entry (`src/page/payload.js`: 0 / 0 / 0), written by hand: the ratchet's
  guard demands every tracked source, and a pasted chapter node never executes is honestly zero, like its
  siblings. The baseline was **not** re-taken as a whole — that is what moves the other figures, and it is a
  person's decision.

Both are gate files, so the commit that carries them needs a `Gate-Change:` trailer (the user's call — nothing
was committed here).

Left open: nothing is committed and nothing is released (`node_modules/@vernikr/size-report` still holds the
released copy), and step 06 (comments out of the pasted program) is next.

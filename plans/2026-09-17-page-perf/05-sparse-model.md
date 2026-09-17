# 05 — Sparse history instead of a snapshot per commit

Source: report §3 and §7 step 5. Depends on nothing; 02 depends on neither. State: **done** (2026-09-17) —
what it is in code, what was measured and how the acceptance answered are at the end of this file.

## Why

The data block is 95 % of the artifact (1 394 518 B of 1 467 578 B) and 91 % of it is `rows[].values` —
a snapshot of every file's size on every commit. Of 56 019 cells 30 856 are non-empty, the non-empty
values hold **1 169 distinct triples** (3.8 %), and **1 165 cells differ from the row above** (5.5 per
commit): 96 % of the payload repeats yesterday's numbers. `now` is byte-for-byte the last row's `values`
(a row appears only when a volume changed, its `cells` are the shared state, and that state is what `now`
is), so those 9 200 B are pure duplication. `href` is a constant prefix plus a 40-character sha already
present in the row.

Encoder and unrolling were written and run over this repository's artifact (`proto-payload-v3.mjs`): the
unrolled result is byte-identical in `tool`, `report`, `metrics`, `categories`, `files`, the row metadata,
all 56 019 cells of `values`, `now`, `last` and `catalog`. Data block 1 361.8 KiB → **81.5 KiB**, unrolling
(parse + dense model) **3.9 ms** against 10.3–11.0 ms for parsing today's block.

## Where it lives

**The page payload only.** `--json` is frozen by `fixtures/parity` and `--data` is the contract the page's
own checks compare with; neither is touched. The page's block is assembled separately by `pagePayload()`
in `src/page/build.js` with its own list of exclusions (`NOT_IN_FILE`), and that is where the sparse form
is produced. The page reads `schema: 2` from it — the schema is part of the record's passport, so records
and links written before the change are politely refused by `appRecordOk`, which exists already.

**Shape** (report §3.1): `v`, `tool`, `report` (without `heading` and `journal` — `heading` equals `title`,
`journal` is `null` today), `hrefPrefix`, `metrics`/`cats`/`files`/`rows`/`catalog` with their text
replaced by indexes into `strs`, `last` as a list of indexes, and per-file `hist`:

```js
[ row, raw, min, tok ]   // the file appears: absolute values
[ row, dRaw, dMin, dTok ] // it changes: deltas against the previous record
[ row, 0 ]                // it disappears
```

**Deterministic by construction**: files in column order, rows in history order, the dictionary extended in
order of first appearance. The artifact is rebuilt by the post-commit hook after every commit and has to be
byte-identical on any machine — so the order of the walk is part of the format, not an implementation
detail.

## Page side

`src/page/state.js` unrolls the history into dense snapshots once, in O(number of changes), and the whole
page keeps working in the model it already has: the calculation (`rowModel`, `totalsOf`, `cellParts`,
`valueParts`) stays the single place where a row is counted. The unrolled model is best laid out as typed
columns, which is also what the incremental totals of 02 read:

```js
values  = Int32Array(rows × files)   // 0 where the file is absent
exists  = Uint8Array(rows × files)
offset  = r * files + i
```

1 169 objects in the heap instead of 30 856.

## Keeping `method`

`method` is printed by the panel apart from any question of accuracy, so it survives whole: with `method`
kept the data block is 83 490 B against 83 208 B without it (the report's §3.5). Dropping it would lose
the caption "raw — способ счёта: размер объекта git".

## Acceptance

- Unrolling restores the old payload exactly: a check that takes `--data` (the dense contract), encodes it,
  decodes it and compares `deepEqual` — cells, `now`, `last`, `catalog`, the row metadata and the texts.
- Two encodes of one report are byte-identical, and a rebuild of this repository's artifact yields the same
  bytes as the committed file (`--write` and `git diff` empty) — the fixed point the hook relies on.
- The page's numbers do not move: `test/page-view.test.js`, `test/contract-derived.test.js`,
  `test/page-tree.test.js`, `test/page-choice.test.js` green.
- `pnpm run verify:fast` green; the artifact is smaller by ~1.28 MiB (report §4.4 ladder).

## Risks

- **The encoder and the page decoder are two copies of one format.** The guard is the round-trip check
  above, plus the artifact's own byte comparison against the committed file.
- **`reportData` keeps the dense form** for `--data`, so the engine carries both shapes for a while. That is
  deliberate: the contract stays readable for an agent, and the page's block is the one that has to be small.
- **Ordering.** Any incidental order (a `Set`, an object's key order) would make the artifact machine-dependent;
  the dictionary walk is therefore written explicitly and the reproducibility check has to run after an
  environment with a different machine's git settings (`pnpm run verify:slow`).

## What it is in code

- **`src/page/build.js` — the encoder.** `pagePayload(data)` writes the block: `schema: 2`, the tool, the report's words
  the page reads, `hrefPrefix`, `strs`, `metrics`, `cats`, `files`, `catalog`, `rows`, `last`, `hist`, in that order
  (`PAGE_KEYS` is the declared, closed list of them). `dictionary()` hands out an index per text, extending the list in
  the order of the walk — metrics, categories, files, catalogue, rows — which is what makes two builds of one history
  byte-identical. `linkPrefix(rows)` is the common beginning of the rows' links (the commit template with the sha cut
  out), so a row keeps only the rest of its link — for an ordinary row that rest of the link **is** the sha the row
  already carries, which the dictionary then reuses, so a link costs nothing beyond the prefix written once.
  `history(keys, files, rows)` walks the rows once and, per file, records the row where it appeared (absolute numbers),
  where it moved (deltas against its own previous record, `change()`) and where it disappeared (a record of the row
  alone). `last` travels as the list of the indexes the last commit touched.
- **`src/page/payload.js` — a new chapter, the decoder only.** `appDecode(p)` returns exactly the dense contract:
  `appUnroll` consumes every file's records in the order of the rows and publishes, per row, the object the file was;
  `appStep` applies one record (absolute when the file was absent, deltas otherwise, `null` when it is gone);
  `appRowOf` and `appText` dress a row and look a text up. **A value that did not move is one object shared by every
  row that holds it** (1 183 objects for 31 651 non-empty cells on this repository), and because `totalsOf`,
  `rowModel` and `appContribute` only read `v[metric]` and compare nothing by identity, sharing changes no answer —
  which is why the calculation and the table were not touched at all.
- **`"now" is not carried.** The last row of the report is its last commit that moved a number and the commits after it
  moved none, so the tail of the unroll *is* the state at HEAD. The round trip below is what proves it against the
  dense contract rather than the argument.
- **`src/page/state.js`** unrolls the block once at load (`appDecode`) instead of parsing a snapshot per commit, and
  imports the chapter (`import { appDecode } from './payload.js'`) — the line the pasting strips, which both satisfies
  the relations sensor (a chapter with no caller and no calls is an orphan) and keeps the real dependency visible.
- **`src/page/build.js`'s `PAGE_PARTS`** gained `./payload.js` first of the page's own chapters, so it is pasted before
  the state that calls it.
- **`tools/page-harness.js`** gained `pageDecode`: the chapter read from disk and evaluated the way the page carries it
  (`pageMath` does the same with the calculation), so the check compares the encoder with the decoder that really
  unrolls the block.
- **The name collision this step walked into** is worth recording: the chapters share one scope, and the decoder's own
  row helper was first called `appRow` — the table chapter's `appRow` silently won and the page died on load with
  “Cannot access `appData` before initialization”. The helper is `appRowOf` now, and `test/page-view.test.js` counts the
  distinct names of the pasted program against the number of declarations, so a name declared twice reddens instead of
  hiding (the sorted lists could not see it).

## Acceptance answered

- **The round trip restores the contract whole** ✓ — a new check in `test/contract-data.test.js` encodes the `--data`
  contract, decodes it with the page's own chapter and compares it with the dense contract (`deepEqual`), naming the
  three declared absences: the list of skipped commits (a fixed point), the report's `heading` (the artifact's `<h1>`,
  built before the block) and its `journal`. `schema` is re-marked rather than lost: 1 is the contract's form, 2 the
  block's.
- **Two encodes of one report are byte-identical** ✓ — the same check asserts it on two parse trees of the one answer.
  The stronger form, the artifact itself, was taken by hand: `--write` twice gives the same md5 (`b943b7c7…`).
- **The page's numbers do not move** ✓ — `test/page-view.test.js`, `test/contract-derived.test.js`, `test/page-tree.test.js`
  and `test/page-choice.test.js` green unchanged (25 checks in the three page suites), and in Chrome the rebuilt page
  holds the same 217 rows, 173 817 cells, 182 386 nodes and the same total at HEAD as the dense one, while the same two
  switches (the `min` metric off, then `src/data.js` off) give the same totals on both.
- **`pnpm run verify:fast` green; the artifact smaller** ✓ — 77 checks of 182 in the fast run (one check added, so both
  numbers in the README moved), `pnpm run verify` green through its 8 steps (the live project's parity, the
  reproducibility of the standards, the tarball), and `docs/size-report.html` 1 442 368 → **166 231 B**.
- **What the format costs the reader of an old record**: the block is `schema: 2`, the schema is part of the record's
  passport, so a choice remembered in a browser or a link sent before this step is refused as someone else's rather
  than applied to numbers it does not describe. That is the plan's intent (the refusal already exists and explains
  itself), and it is what the artifact of this repository did to the choice I had left in Chrome.

## What was measured (2026-09-17)

The artifact of this repository, both sides the same tree and the same history (`/tmp/after.html` — the artifact built by
steps 01–04 — against `docs/size-report.html` rebuilt here). Bytes are UTF-8, as the file weighs them.

| | dense (before) | sparse (after) |
|---|---:|---:|
| data block | 1 370 724 B | **88 712 B** (6.5 %) |
| artifact | 1 442 368 B | **166 231 B** (266 columns on both sides; 166 305 B once the new chapter entered the index and became a column of its own) |
| `JSON.parse` of the block, Node 22.23.2, best of 9 | 11.62 ms | 0.58 ms |
| the unroll (`appDecode`) | — | 3.33 ms |
| `JSON.parse` of the block, Chrome, measured by wrapping `JSON.parse` | 10.0 ms | 0.9 ms |
| value objects in the unrolled heap | 31 651 | **1 183** |
| rows × files × metrics of the table | 216 × 266 × 3 | the same |
| nodes in the document / total at HEAD | 182 386 / 2 663 829 | the same |
| `DOMContentLoaded` in Chrome (3 runs, alternating) | 2 691–3 109 ms | 2 795–3 387 ms |

Read honestly:

- **The block is 88 712 B against the plan's 81.5 KiB** (the prototype `proto-payload-v3.mjs` is not in the tree, so the
  last few kilobytes of its layout cannot be compared line by line; the walk and the three record shapes are as the
  plan describes). The load is 3.91 ms against the plan's 3.9 ms — the promise held where it was about time.
- **What got cheaper is the parsing of the data, not the startup.** In Chrome the two pages come up in the same ~2.9 s
  because the table is 173 817 cells and 182 386 nodes: the data was never what the start paid for, and the runs differ
  by less than the noise of a loaded machine. That is the honest reading of §10.4 — the block was the *file's* weight
  and the parse, and the remaining cost is the DOM, which is what steps 09–12 are for.
- **The artifact is 166 231 B (162 KiB) against the ladder's 153 KiB** — the difference is the pasted program, code and
  comments, which grew in steps 02–05 (+3.6 KB of code in step 02, ~+1.5 KB here) and which steps 06–07 are the ones to
  shrink. The data block itself is a little above the plan's figure.
- **The heap estimate is the one the plan made**: 1 183 objects in the unrolled model against 31 651 non-empty cells,
  because a value that did not move is shared. (The row arrays themselves are 216 × 266 slots either way.)

## Risks

- **The encoder and the decoder are two copies of one format.** The guard is the round-trip check on the contract plus
  the artifact's own byte comparison, exactly as the plan says; the check evaluates the chapter from disk rather than a
  paraphrase of it, so the two copies cannot part without one of them being the thing that reddens.
- **Ordering.** The dictionary walk is written out (`pagePayload`: metrics, categories, files, catalogue, rows) and
  measured: `--write` twice gives the same md5, and the reproducibility of the artifact is checked by the full profile in
  the environment with no machine git settings (`pnpm run verify:slow`, a scheduled run).
- **One name, one scope.** Found by falling into it (see above) and now guarded by the declaration count in
  `test/page-view.test.js`.
- **`reportData` keeps the dense form** for `--data`, deliberately: an agent reads the contract as it is, and the fixed
  point of the hook is not what this step makes smaller.
- **What was not done here, as instructed:** nothing is committed and nothing is released. The artifact on disk was
  rebuilt by the local engine (`node bin/size.js --write`) — `node_modules/@vernikr/size-report` still holds the released
  copy, whose page program would rebuild the report with the dense block. The release order is the user's decision.
  `--write` twice gives the same md5 (`39b7fa65…` once the new chapter is in the index, `b943b7c7…` before that), and
  `node bin/size.js check` is green over this repository (381 commits, 216 rows, every touched path tracked or excluded).

## The two gate files this step had to touch

- **The new chapter has to be in the git index, or the documentation guard is red** (`test/docs-paths.test.js` reads
  the tree through `git ls-files`, and a new source file is not there until it is added): `git add -N
  src/page/payload.js` — intent to add, no commit, and the index change is the user's to keep or drop. With the file in
  the index it also becomes a column of this repository's own report (267 rather than 266).
- **`coverage-baseline.json` gained one entry** (`src/page/payload.js`: 0 / 0 / 0) — the ratchet's own guard requires
  every tracked source to be named, and a pasted chapter that node never executes is honestly zero, the same as its five
  siblings. The entry was written by hand rather than by re-taking the whole baseline (`pnpm run baseline:coverage`): a
  re-take is what moves the other figures, and that is a person's decision. Both files are gate files, so the commit
  that carries them needs the `Gate-Change:` trailer.

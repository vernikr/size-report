# 0194 — step 8: the data block travels packed

Requested: implement step 08 of `plans/2026-09-17-page-perf/` by its acceptance criteria — its condition has come
true (the artifact stood at 122 668 B with 88 786 B of it the block, and step 07's minification was refused on
purpose). Three conditions on top of the plan: the artifact stays a self-contained HTML with no new dependencies
that opens from `file://`; unpacking has to work in the page suites as well (jsdom has no browser APIs — provide
a behaviour for their absence and say what is checked in which environment); the build stays reproducible (two
`--write` runs, the same md5; the round trip keeps reading the decoder from disk). Nothing committed, the base
untouched, step 09 not started.

## What was built

- **The packing** (`src/page/build.js`): `pagePacked(text)` — `zlib.gzipSync(…, { level: 9 })` then base64 — and the
  tag says how it is packed: `<script type="application/octet-stream" id="data" data-pack="base64+gzip">`. The type
  is what the content is (base64, not JSON); the marker is what says how to read it.
- **The page's side** (`src/page/payload.js`): `appUnpack(el)`. No marker → the block itself (a build that packs
  nothing still works); `base64+gzip` → the platform's own `DecompressionStream`; anything else → an error rather
  than a half-read block. `appBytes` reads base64 as bytes (`atob` gives one character per byte) and `appJoined`
  glues the chunks. The chapter keeps its subject (the block's shape and unrolling): the packing is a seam around
  the decoder, not a change of it.
- **The model is no longer a constant** (`src/page/state.js`): `appBoot(text)` sets `appData`, `appView`,
  `appMetric`, `appMeasured` and the two keys of the reader's memory (the key is the report's passport, so it can
  only be counted once the block is there). Names and shapes are what they were.
- **One asynchronous step** (`src/page/app.js`): `appBegin()` unpacks, boots, then restores and draws exactly as
  before, and publishes `window.appDrawn`. `hashchange` waits for the boot instead of reading a model that is not
  there yet. A host that cannot unpack gets a sentence (`appUi.unpack`, a new text in `src/locales.js`, carried
  into the page by `uiText`) rather than an empty table.
- **The stripper** (`src/page/build.js`): `export async function` is a form it has to know — the pasted page has no
  module syntax to resolve it with — and the page's closed list of function names in `test/page-view.test.js` now
  sees async declarations too (it gained `appBegin`, `appBoot`, `appBytes`, `appJoined`, `appUnpack`).
- **The harness** (`tools/page-harness.js`): jsdom has no `DecompressionStream` and no `TextDecoder`, so the
  harness puts the platform's own implementations into the window before the page runs; `openPage` became
  asynchronous and waits for `window.appDrawn`; `pageBlock(text)` unpacks a built page with the platform's zlib and
  `unpackPack` unpacks the packing itself. The three page suites now `await openPage(…)` everywhere — the price the
  plan predicted for every check that opens the page.
- **The seam without the platform**: one check (`test/page-choice.test.js`, `{ platform: false }`) opens a host
  that cannot unpack and demands the sentence in words, no table and no panel. It stands with the choice checks
  because the host's abilities are that suite's subject (no storage, no address writes) — and `page-view` was at
  its line limit (the metrics sensor stopped it at 471 lines; the check moved rather than a threshold).
- `README.md` — the check counts (78 of 183), the paragraph about the packed block beside the sparse one, and the
  page harness's row (the platform's unpacker put into jsdom).

## Measured (2026-09-17)

| | before (step 06's build) | after |
|---|---:|---:|
| the data block | 88 786 B | **42 856 B** |
| the pasted program | 24 885 B | 26 163 B |
| `docs/size-report.html` | 122 668 B | **78 319 B** (−44 349 B ≈ 43.3 KiB) |

The same page with the block written out plain and everything else identical is **124 217 B**: the transport alone
is 45 898 B. The plan promised 62 KiB for the artifact (76 KiB here — the page's program is 26 163 B now) and
41.1 KiB for the block: it is 42 856 B, with base64's third on top of gzip's 32 142 B.

**The price of unpacking, measured:** in Chrome on this artifact (`file://`, the platform's own API) the unpack is
**1.0–2.1 ms**, best 1.0 ms over five runs (42 856 B → 82 314 characters of JSON). In jsdom the page was drawn in
6.9 s packed against 7.8 s plain — one run each on a loaded machine, so that is noise rather than a claim;
`DOMContentLoaded` in Chrome is 3 382 ms and `load` 3 386 ms, which is the 183 048 nodes.

## Checks

`pnpm test:all` green: **183 checks**, 0 failures. `pnpm run verify:fast` green: 5 steps, **78 checks of 183**.
Two `--write` runs give the same bytes (md5 `85664ca7…`), and the round trip is taken through the packing as well
(`contract-data`, the decoder still read from disk, plus “the packing is smaller than what it carries” and “two
packings of one block are equal”).

By hand in Chrome (`file://`, the platform's own unpacker): **217 rows, 174 468 cells, 183 048 nodes**, 310 panel
fields, the total at HEAD 2 663 829 and the last row +70 589 — the same fingerprint as the same page with the block
written out plain (compared in jsdom, side by side); switching the `min` metric off shows 804 → 536 visible cells,
moves the total by nothing and builds no node, in 1.2 ms of JavaScript; the message about unpacking is hidden, as
it should be where the API exists.

Two environments, told apart deliberately: the **suites** read the page in jsdom with the platform's
`DecompressionStream`/`TextDecoder` put in by the harness (everything except one check), and the **one** check that
does without them asserts the sentence and the empty grid; a **browser's** real API is what the Chrome run above
exercised, since jsdom can only borrow the platform's implementation and not the browser's.

## What stayed an assumption

- The bytes of a gzip stream are the machine's zlib: the header carries no time (that is why two runs are equal),
  but the compressor's version is the machine's, like git's. The artifact stays a fixed point for the hook that
  rebuilds it on the same machine; a different Node minor could give different bytes. This is the same class of
  assumption step 07 refused to take for esbuild — there the *form* would have depended on a dependency's presence.
- Browsers other than Chrome are reasoned from the platform's API, not measured (Firefox and Safari have
  `DecompressionStream`; the absent API is jsdom's).
- The rendering of the two forms of the block was compared in jsdom, without computed styles or layout (step 06
  did that for the squeeze itself).

Nothing is committed and nothing is released; the artifact on disk was rebuilt by the local engine. Step 09 (a
fixed layout) is next — and it is the first step of the memory half, where the 183 048 nodes finally matter.

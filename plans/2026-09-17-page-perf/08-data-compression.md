# 08 — Compressing the data block

Source: report §4.3–§4.4 and §7 step 8. **Decision step** — take it only when the artifact has to go below
100 KiB.
State: **taken** (2026-09-17). The condition of the rule below has come true: the artifact stood at 122 668 B
with 88 786 B of it the data block, and step 07's minification was refused on purpose, so nothing else was
left to pay with. What was built, what was measured and how the acceptance answered are at the end of this
file.

## The numbers

gzip level 9 on today's data block gives 49.6 KiB, 66.2 KiB in base64 — **−90 % of the block's size without
changing the model at all**: embed the compressed block and unpack it at load. It also composes with step 05
(the sparse block compresses to 41.1 KiB), so the ladder ends at 62.3 KiB instead of 110 KiB.

## The price, which is not the size

- `DecompressionStream('gzip')` is asynchronous: loading the page stops being synchronous and the first
  render waits for a promise. Today the page is one parse and one render, with no async seam at all.
- The data block stops being readable: no eye and no `diff` can look at it any more. Every other step of this
  plan keeps the data inspectable.

Self-containment is preserved: unpacking happens in the browser, with no network.

## What it would look like

- `pagePayload()` (or the encoder of step 05) serialises, gzips and base64-encodes; the `<script
  id="data">` tag carries the payload plus a marker that it is compressed.
- The page's state chapter becomes an async bootstrap: unpack, parse, unroll (step 05), then the first
  render. The panel and the table are built after that, so every check that opens the page has to wait for
  the ready state rather than for the document.
- A refusal-free fallback is not possible (a browser without `DecompressionStream` — no such browser is
  current), so the promise is the page's only path.

## Decision rule

Take it when a named need puts the artifact below 100 KiB (a report attached to a review, a size budget of
its own). Otherwise leave it: steps 01, 05 and 06 already reach 110 KiB with readable data, and this step's
cost is paid by whoever debugs the page next.

## Acceptance (if taken)

- The page renders the same numbers as the uncompressed build (the existing page suites, run against a
  compressed assembly).
- The first render still happens after one parse + one render, no extra pass.
- The artifact's size is what the ladder promises, and the artifact is still rebuilt byte-identically by the
  hook.

## What it is in code

- **`src/page/build.js`** — `pagePacked(text)`: `zlib.gzipSync(…, { level: 9 })` then base64, level 9 because the
  block is written once per commit and read by whoever opens the file. The tag carries the marker:
  `<script type="application/octet-stream" id="data" data-pack="base64+gzip">`. The type is what the content
  is: the text inside is base64, not JSON, and it is the marker rather than the type that says how to read it.
- **`src/page/payload.js`** — `appUnpack(el)` is the page's side of the transport: a tag without `data-pack`
  carries the block itself (a build that packs nothing works), `base64+gzip` is unpacked with the platform's own
  `DecompressionStream`, and an unknown packing is an error rather than a half-read block. `appBytes` reads
  base64 as bytes (`atob` gives one character per byte), `appJoined` glues the chunks the platform hands out.
  The chapter stays what it was — the block's shape and its unrolling — so the packing is a seam of its own
  around the decoder, not a change of it.
- **`src/page/state.js`** — the model is no longer a constant: `appBoot(text)` sets `appData`, `appView`,
  `appMetric`, `appMeasured` and the two keys the reader's memory lives under (the key is the report's
  passport, so it can only be counted once the block is there). The names and shapes are what they were.
- **`src/page/app.js`** — `appBegin()` is the page's **only** asynchronous step: unpack, boot, then the
  restoring and the first drawing exactly as before, and `window.appDrawn` publishes the promise. Everything
  after the first drawing is as synchronous as it was, and `hashchange` waits for the boot rather than reading
  a model that is not there yet. A host that cannot unpack is told in words (`appUi.unpack`, a text of the
  page's own in `src/locales.js`) instead of being left with an empty table.
- **`tools/page-harness.js`** — the seam the checks need: jsdom has no `DecompressionStream` and no
  `TextDecoder` (it has `atob`, which the page uses), so the harness puts the platform's own implementations into
  the window before the page runs, and `openPage` is now asynchronous — it waits for `window.appDrawn` rather
  than for the document. `pageBlock(text)` unpacks a built page with the platform's zlib and `unpackPack` unpacks
  the packing itself (used by `contract-data`). The page suites call `await openPage(…)` everywhere, which is the
  price the plan's §"The price" predicted: every check that opens the page waits for the ready state.
- **`test/page-choice.test.js`** — the check of the seam without the platform: `{ platform: false }` opens a
  host that cannot unpack, and the page has to say so in words with no table and no panel. It stands with the
  choice checks because the host's abilities are the same subject (a browser without storage, without address
  writes) — and `page-view` was at its line limit.
- **`src/page/build.js`'s `stripModules`** — `export async function` is a form the stripper has to know:
  a declaration marked `export async` is an ordinary source, and the pasted page has no module syntax to resolve
  it with. The page's closed list of function names in `test/page-view.test.js` now sees async declarations too,
  and gained `appBegin`, `appBoot`, `appBytes`, `appJoined` and `appUnpack`.

## What was measured (2026-09-17)

| | before (step 06's build) | after |
|---|---:|---:|
| the data block | 88 786 B | **42 856 B** (gzip 32 142 B + base64) |
| the pasted program | 24 885 B | 26 163 B |
| `docs/size-report.html` | 122 668 B | **78 319 B** (−44 349 B ≈ 43.3 KiB) |

The same page with the block written out plain, everything else identical (measured in jsdom, in memory):
**124 217 B** against 78 319 B — the transport alone is 45 898 B. The plan's ladder said 103 → 62 KiB
(76 KiB here, because the page's program is bigger than the one the report measured — steps 02–08 put 26 163 B
of it into the file) and predicted 41.1 KiB for the sparse block: it is 42 856 B with base64's third.

**The price of unpacking, measured rather than asserted.** In Chrome on this repository's artifact
(`file://`, the platform's own `DecompressionStream`): the unpack is **1.0–2.1 ms**, best 1.0 ms over five
runs (42 856 B → 82 314 characters of JSON). In jsdom, where the platform's implementation is Node's: the page
was *drawn* in 6.9 s packed against 7.8 s plain — one run each on a loaded machine, with the packed one ahead,
which is noise rather than a claim; what the transport costs in jsdom is not visible beside jsdom's own cost.
Chrome's `DOMContentLoaded` on the artifact is 3 382 ms and `load` 3 386 ms — the artifact's price is its
183 048 nodes, as every step of this plan has said.

## Acceptance answered

- **The page renders the same numbers** ✓ — the packed artifact and the same page with the block written out
  plain were opened side by side in jsdom: the same 217 rows, 174 468 cells, **183 048 nodes**, 310 panel
  fields, the same text of the “now” row (total 2 663 829) and of the last row (+70 589) — and the page suites
  (10 + 6 + 10 checks) run over the packed pages. In Chrome the same fingerprint stands: 217 rows, 174 468
  cells, 183 048 nodes, total 2 663 829; switching the `min` metric off shows 804 → 536 cells, moves the total
  by nothing and builds no node, in 1.2 ms of JavaScript (the same behaviour step 02 bought).
- **One parse + one render, no extra pass** ✓ — the page draws once, after the unpack; there is no second
  rendering pass and no second drawing path (`appBegin` → `appFirst`, and the click paths are untouched). The
  asynchronous seam before it is this step's declared price rather than a surprise: the plan named it, and it is
  one promise long.
- **The size and the fixed point** ✓ — 78 319 B (below the 100 KiB the rule asked for), and two `--write` runs
  give the same bytes (md5 `85664ca7…`). The round trip through the encoder and the decoder is taken through the
  packing as well (`contract-data`, the decoder still read from disk), and the packing is checked to be smaller
  than what it carries.

## What stayed an assumption

- **The bytes of a gzip stream are the machine's zlib.** The header carries no time (that is what makes two runs
  equal), but the compressor version is the machine's, like the version of git: the artifact stays a fixed point
  for the hook that rebuilds it on the same machine, and it would not be surprising if a different Node minor
  gave different compressed bytes. This is the same class of assumption step 07 refused to take on esbuild's
  behalf; there the artifact's *form* would have depended on a dependency's presence, here the artifact's bytes
  depend on the platform's zlib, and the file is rebuilt by the machine that commits.
- **The unpack in a browser other than Chrome** is asserted from the platform's API rather than measured:
  Firefox and Safari have `DecompressionStream` too, and the check of the absent API is jsdom's.
- **The rendering was compared with jsdom's** for the two forms of the block: computed styles and layout were
  not part of that comparison (step 06 did that for the squeeze itself).

To repeat the comparison: take the artifact, unpack the tag's text with `zlib.gunzipSync` + base64, replace the
whole tag with `<script type="application/json" id="data">` + that text, and open both in the page harness
(`openPage` of `tools/page-harness.js`) — the script was a one-off under `reports/` and was deleted after the
run; the figures it printed are in `worklog/0194-page-perf-step8-packed-block.md`.

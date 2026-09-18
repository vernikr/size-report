# 0223 — the report lost its band of words above the numbers

**Asked:** three things about the report's page. **(1)** The way each metric is counted — `raw` "the size of the git
object", `min` "esbuild 0.28.2 (minify, rename); other formats (.md .yml) lose comments and indentation", `tok`
"gpt-tokenizer 4.0.0, o200k_base (BPE)" — to stand as the tooltip of the checkbox that switches that metric. **(2)** The
report's heading moved inside the panel of files. **(3)** The grey subheading under the heading (`{tool} {version} ·
{artifact}`) and the grey hint under the table ("Absolute sizes appear once…") removed.

**Done:**

- **The method moved into the switch it belongs to.** The lines were visible text — one `<p class="about">` per metric
  under the row of switches (`appPanel`, written in the same loop that built the boxes) — and they took the room beside
  the numbers, which is what the reader came for. The box now carries what the metric is and how its number was obtained
  in one tooltip: `m.note + ' — ' + appUi.methodLabel + ' ' + m.method`, the same two fields the payload has always
  carried (`note` — what the number means, `method` — how it was counted, `src/metrics.js`). The paragraphs, their
  styling and the check that pinned them are gone; the check now reads the box's own `title` (`metricTitle` in
  `tools/page-harness.js`), so it stays a check about the words rather than about their place.
- **The heading opens the panel.** It was a band of its own above everything (`<header><h1>`), and the artifact's path and
  the tool's version stood under it — words about a file that is opened from the directory whose name already says where
  it lies. The heading is now the card's other child (`<div class="panel"><h1>…</h1><div id="panel">`), which is why it
  is written in the markup rather than built by the script: `#panel` is emptied and rebuilt on every opening, and a
  heading inside it would be rebuilt with the fields. In the wide layout the card spans all the rows, so the heading
  scrolls away with the list and the switches stand at the top — the body's grid falls from five rows to three, and the
  panel's top padding travels with the heading (`src/page/app.css`).
- **Two grey texts gone, with what they quoted.** The subheading and the note under the table (`#note`, filled once by
  `appNote`) are out of the markup, the styling and the locale (`sub`, `note` — both locales), and the page reads
  `fixCommand` no longer: the payload drops it (`src/page/build.js`), while the contract `--data` still hands it to an
  agent, which is what `docs/wiring.md` now says. `contract-data.test.js` declares five fields as not surviving instead
  of four.

**Evidence, in a browser rather than in jsdom:** the page opened from the assembled report in Chromium, the three boxes
asked for their `title` — `"the file as it is — method: the size of the git object"`, `"real minification: names
shortened, whitespace removed — method: esbuild 0.28.2 (minify, rename); other formats (.md .yml) lose comments and
indentation"`, `"weight for a language model: how many text units (tokens) it splits into — method: gpt-tokenizer 4.0.0,
o200k_base (BPE)"` — and the heading inside the card, no band above it, no third grey line under the table.

**What holds it:** `pnpm run verify:fast` and the full `pnpm run verify` green (8 steps: the whole suite, parity with the
live project, the references, the tarball). `test/page-view.test.js` keeps both halves of the move — the tooltip of a
metric's own switch carries its `method` and its `note`, and there is not one `.about` paragraph left — and it pins the
`appNote` the shell no longer has. `test/contract-data.test.js` holds the round trip without `fixCommand`.

**Files:** `src/page/panel.js`, `src/page/build.js`, `src/page/app.js`, `src/page/app.css`, `src/locales.js`,
`tools/page-harness.js`, `test/page-view.test.js`, `test/contract-data.test.js`, `docs/module-design.md`,
`docs/wiring.md`, `templates/README.md`, `worklog/0223-the-report-lost-its-band-of-words.md`, and
`docs/size-report.html` (rebuilt).

**Owed:** the section of this journal in the release commit, the tag, and the re-pin of the attached copy. This portion
ships in the same release as 0222: both change `src/`, and the reader's memory of the choice is not something to announce
in two steps.

## Release 2.9.0 — what changes in the numbers

Two portions ship together, and both live in `src/` — which is what the tarball carries (`files`: `bin`, `src`,
`templates`, `README.md`, `LICENSE`) — so the release is due and it takes a MINOR: the page behaves differently, and
nothing of it is a fix to something broken. 0222 makes the reader's choice the report's rather than a build's, 0223 moves
the way of counting into the tooltip of the switch that does the counting and takes the band of words above the numbers
out.

- **The artifact is a little smaller: 90 707 B built by 2.8.9 → 90 559 B built by 2.9.0** (−148 B). The markup lost the
  note's paragraph, the answer lost one key of its dictionary (`note`, which quoted the fix command), and the styling
  lost two rules (`.sub`, `.note`) and a row of the wide layout's grid — while the tooltip of a metric carries its method
  in the box's own attribute rather than in a paragraph under it.
- **The reader's memory is a record per form, not per build.** A browser that lived through the report's many rebuilds
  holds one address per build of every past naming; what this release writes lives under `size-report:2:<the report's
  identity>` and the addresses of the older naming are swept when the report is opened. So the choice the reader makes
  after this release is asked for **once more** — and after that it survives every rebuild, which is the whole point.
- **The engine's answers are what they were:** `--data` and `--json` (the shape and the fields; the page's block merely
  stops carrying `fixCommand`), parity with the fixture and with the consumer's live history, both references, the
  tarball's entries. `pnpm run verify` green throughout.
- **The attached copy** is re-pinned to 2.9.0 in a commit of its own, with the `Gate-Change:` trailer; the report is
  then rebuilt by the copy (2.8.9's files build it until that moment, as the release order always has it).


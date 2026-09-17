# Probes: the measurements behind the page-performance steps

What a suite cannot answer — jsdom has no layout, no paint and no `content-visibility` — is measured in **live Chrome**
over `file://`, spoken to over the DevTools protocol directly (Node's own `WebSocket`; nothing of the package is used).
Each file belongs to one step of `plans/2026-09-17-page-perf/`, and the numbers in that step's file are that probe's
output: the file is the single home of the measurement, and the README rows and worklog entries point here.

**Running one.** Start Chrome with a debug port and run the probe from the repository root:

```sh
open -na "Google Chrome" --args --remote-debugging-port=9222
node probes/step-11-borders.mjs before=/tmp/before.html after=/tmp/after.html
```

Two artifacts are compared where a step has a before/after. `before` and `after` are labels; the rounds are interleaved
and a fresh tab is used for each, so the machine's drifting load does not line up with the build being measured. Read one
at a time — they each open real windows and take a minute.

**Making the pair, without a guess.** The shipped side is the committed page itself: `cp docs/size-report.html
/tmp/before-11.html`. The other side is the same page with the step's declaration written into the sources and built to
a path *outside* the repository, so the tree stays as it is shipped:

```sh
cp src/table.css /tmp/table.css.keep
python3 - <<'PY'
p = 'src/table.css'; s = open(p, encoding='utf-8').read()
open(p, 'w', encoding='utf-8').write(s.replace('border-collapse: collapse;', 'border-collapse: separate; border-spacing: 0;', 1))
PY
node bin/size.js --write /tmp/after-11.html
cp /tmp/table.css.keep src/table.css   # the styling is back as it ships; docs/size-report.html was never written to
```

Step 11's build was 80 397 → 80 460 B this way, and the probe's own first lines name the model and the geometry it found
(`border model separate / spacing 0px`, the table's box), so a pair that was built wrongly shows up in the output rather
than in the numbers. The two copies carry their own path in the page's subtitle (`…· /tmp/before-11.html`); nothing the
probe reads — geometry, load timings, the pixels of the table — depends on it.

**Build both sides of a pair in one sitting, from one index state.** The newest column of the report is the **index**,
not the working tree (`src/project.js` reads `git ls-files -s`), so a file staged and not yet committed is a file of the
report: the five probe files staged here move a build of the shipped page from 80 397 to 80 582 B, and five `git add -N`
entries — empty blobs, the same five names — move it by the **same 185 B**, so what counts is the list of names rather
than the bytes behind them. Untracked files are not counted (a plan draft lying in the tree changes nothing), and the
byte-for-byte check of the artifact — two `--write` to the *same* path, one md5, equal to the page the hook committed —
holds while the index holds what that page was built from. A pair measured across a change of that state would compare
two different data sets; the pair above was built twice in a row, in one state.

| Probe | What it answers |
|---|---|
| `step-09-layout.mjs` | The fixed layout: where the columns get their width, whether a number is clipped, the sticky header and commit column, and the two layout algorithms against each other on one table |
| `step-10-tables.mjs` | Where `content-visibility: auto` skips anything at all: rows, `<tbody>`s, a wrapper `<div>`, and plain `<div>`s as the control — the witness is the platform's own `contentvisibilityautostatechange` |
| `step-10-skip.mjs` | The same artifact with and without the declaration, both witnesses side by side (rectangles, which lie, and the event, which does not), the geometry, a scripted scroll, search and printing |
| `step-11-borders.mjs` | `border-collapse: collapse` against `separate`: the load's timings, the geometry, the two models laid out in one tab, **and the pixels** — the screenshots are read back in the browser that drew them, so the line positions, their thickness and the difference between the builds need no imaging library |

**Not part of the suite, and deliberately outside the sensors.** Probes are instruments rather than product code: they
live outside the paths the gates walk (`src bin tools test`, and coverage's `src bin`), so no threshold, ratchet or
coverage baseline has anything to say about them. They are still linted (`pnpm run lint:strict` runs `eslint .`), because
a script that can be run should be clean.

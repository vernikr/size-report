# W1 — `tools`: the repository's instruments

Subplan of `plan.md` (T0). Owns the instruments outside `tools/gates/**` and
`tools/synthetic/**`: 11 files, 349 measured lines. Written 2026-09-16, not started. These are the
texts a **developer** reads — a profile run, a re-taken reference, a pack check, a catalogue — not
the tool's interface, so the reason of the work here is the second reader named in T0: an agent
reads a verdict as the whole report of a failure.

## Scope, by measurement — and the hole check

The mission asked whether this owner has the same holes the map had when S5 was planned. Measured:

```
git ls-files tools | while read -r f; do printf '%5s %s\n' "$(rg -cP '[\p{Cyrillic}]' "$f" 2>/dev/null || echo 0)" "$f"; done | sort -rn
```

| File | Lines | Owner |
|---|---|---|
| `tools/refusals.js` | 169 | **W1** |
| `tools/suites.js` | 38 | W2 |
| `tools/synthetic/*` (4 files) | 89 | W3 |
| `tools/parity-live.js` | 35 | **W1** |
| `tools/parity-freeze.js` | 31 | **W1** |
| `tools/run-tests.js` | 25 | **W1** |
| `tools/pack-check.js` | 21 | **W1** |
| `tools/gates/*` (6 files) | 77 | W2 |
| `tools/check-standards.js` | 21 | **W1** |
| `tools/make-fixture.js` | 17 | **W1** |
| `tools/harness.js` | 13 | **W1** |
| `tools/yaml.js` | 10 | **W1** |
| `tools/docs-facts.js` | 4 | **W1** |
| `tools/page-harness.js` | 3 | **W1** |
| `tools/gate-probe.js`, `tools/gates/common.js` | 0 | — |

The eleven W1 files sum to **349**, the tracker's row, and every file under `tools/**` is named by
one of W1, W2 or W3: **no hole in this owner**. `tools/gate-probe.js` and `tools/gates/common.js`
were measured too and carry no Cyrillic at all.

## What is Russian, group by group — and who a group belongs to

**1. `tools/refusals.js`** — the catalogue of refusals, and the one file of this owner that other
subplans touch. It has three parts with three different owners, and separating them is most of the
planning:

- **`SITES` keys** (the cause names, 22 of them across five groups) and the `must` phrases that quote
  what a refusal prints word for word: **the owner of the printed text, not W1.** By the map's order
  (S1–S5 first) every cause name and every `must` phrase is English before W1 starts; each `must`
  moves in the commit of the subplan whose text it quotes (S5's plan does exactly that for the four
  hook cases). W1's job is what nobody else owns;
- **the catalogue's own prose**: `truth` (37 lines: "what this refusal owes a person"), `advice.why`
  (40 lines: why an advice cannot be run), the `uncatchable`/`noCase` reasons, and the three header
  comments. W1's, and read by no machine — the file says so itself ("`truth` is one Russian line per
  case: no machine checks it");
- **the extraction device**: `ADVICE_LINE` (`:111`, the markers `починка|создайте его|соберите её|
  локально|в CI`), the `template` shapes with the placeholders `<файл>` and `<коммит>`, and
  `PRINTED`/`SITES`' own counts. The tolerance rule of S1's dictionary says the extractor accepts
  both languages **until the last subplan that prints advice** — and the markers of the tool's
  refusals are all S\*'s, so W1 is that last subplan and its final step narrows the regex.

**2. The instruments' verdicts** — `tools/run-tests.js` (25), `tools/check-standards.js` (21),
`tools/pack-check.js` (21), `tools/parity-live.js` (35). Printed to a log; measured as read by no
machine: `tools/gates/run.js` says it out loud ("A step's output is not captured … What matters here
is the exit code"), and no test reads these words (measured: `test/gates-*.test.js` reads the
`--list` commands and the CI files, never a verdict). Two peculiarities inside this group:
`tools/run-tests.js:38` (`MODES = { fast: 'быстрый', full: 'полный' }`) — the **keys are CLI words**
(`node tools/run-tests.js fast`) and only the values are text, which is the file's own "red first"
experiment; and `:56`/`:60` — `plural(n, 'проверка', 'проверки', 'проверок')`, three literals of one
counter, and `:43`/`:64` — a decimal **comma** made by code rather than by a literal (N26).

**3. `tools/harness.js`** (13) — two **names** (`PACKAGE.name = 'движок пакета'` at 45 and 188,
`'замороженная копия реализации'` at 77) and the assertion messages of the shared helpers. The
names are printed in reports and are duplicated outside this owner — `test/refusals.test.js:169`
builds its own tool object with the same name, and `test/parity.test.js`'s three test names say
`движок пакета` as well. Not a reader and not a mismatch a check can see: C1 and C2 align their own
copies when they come, and `pnpm run dup` is the sensor that watches token twins.

**4. `tools/yaml.js`** (10) — the messages *thrown* when the CI template steps outside the supported
YAML subset. Imported by `test/templates.test.js`, `test/release.test.js` and
`test/gates-verify.test.js`; a message is never matched by an assertion, it is what a person reads
when a workflow stops being parseable.

**5. `tools/docs-facts.js`** (4) — the two **section names** of the help, and the sharpest dependency
of this owner (below).

**6. `tools/page-harness.js`** (3) — the assertion messages of the page harness (28, 69, 72), read by
the page checks when they fail.

**7. The part that writes into the frozen layer** — `tools/parity-freeze.js:98-118` (`manifestNote`)
writes `fixtures/parity/README.md`, and `tools/make-fixture.js:56-64` writes the synthetic fixture's
`config.json` values (`title`, `heading`, the column label `заметки.md`). Both are **allow-listed
data, not this owner's text**: `tools/parity-freeze.js:92` says it in its own words ("it is the
standard's data rather than this file's documentation and stays Russian"), and
`fixtures/synthetic/config.json` holds the same title string (measured, 1 line). The **console** lines
around them (`parity-freeze.js:205-211`, `make-fixture.js:197-206`) are W1's and freeze nothing.

## What stays Russian

| Item | Why |
|---|---|
| `manifestNote` (`parity-freeze.js:98-118`) and the fixture config values (`make-fixture.js:56-64`) | The fixture's own data, named in T0's allow-list. Translating them re-takes a reference (N21) **and** changes data the allow-list keeps Russian. `parity-freeze.js:92` is the file's own statement of the rule. |
| `<файл>` and `<коммит>` in the `template` shapes (`:146-184`) | Placeholders **of the printed advice**, whose literals are S1's (`src/args.js:39,92,129,133`, `src/config.js:144`, `src/refusal.js:101,117`) and whose `must` phrases are the catalogue's. They move with S1's step 2, not here. |
| The cause names (`SITES` keys) and every `must` phrase | The owner of the printed text, per the table above. |
| Six comments (prose, not literals): `tools/refusals.js` 3, `tools/run-tests.js` 2 (`:22` quotes a command with a Russian test-name pattern, `:40` explains the Russian numbers), `tools/docs-facts.js` 1 (`:170`) | Leftovers of the prose pass, out of this work's scope by definition. `TODO.md` (like S3's `src/metrics.js:61-63`). The `docs-facts.js` one is the exception: step 5 aligns its wording if the tolerance is chosen, since the comment would otherwise claim the wrong thing — prose, no behaviour. |
| The sensors' own advice markers (`tools/gates/dup.js:1`, `tools/gates/coverage.js:1`) | W2's texts, and never parsed by `adviceOf` (the extractor reads the *tool's* output). Measured, so that narrowing the regex in step 7 cannot surprise anyone. |

**New open question — N26 (`BLOCKERS.md`): the numbers stay Russian while the words turn English.**
`tools/run-tests.js:43` and `:64` format a duration with `.replace('.', ',')`, and `tools/gates/run.js:111,114` (W2) do the same, so a translated profile prints "total 12,2 s". A comma is
formatting, not a literal, and this work changes literals only: options and price are recorded there
for the mission agent. Nothing else of this owner formats a number this way (measured: two files,
four call sites).

## Cross-ownership

| Literal | Owner | Rule |
|---|---|---|
| The cause names, the `must` phrases, the `починка: `-family markers **of the tool's refusals** | S1–S5 | Already English when W1 starts; W1 does not revisit them, and the `SITES`/`PRINTED` counts must read the same before and after. |
| `tools/docs-facts.js:135` — the working tree's section split | S1's step 1 | Joint: S1 renames the help's section, so this split is edited **in that commit** or `usageCommands` throws (`USAGE.split(...)[1]` of an absent name) and every docs guard goes red. |
| `fixtureNote` (`tools/make-fixture.js:233`) and the fixture's README text | W3 (`tools/synthetic/note.js`) | The text is W3's, the call is here; W1 never touches the note itself. |
| `tools/suites.js` (38) and `tools/gates/**` (77) | W2 | Not one line of them is edited here. Step labels exist twice (`tools/suites.js`, `tools/gates/run.js:38-39`) and no guard compares them (measured) — a drift risk worth W2's attention, named here because it was found here. |
| `test/refusals.test.js`, `test/refusals-catalog.test.js`, `test/runner.test.js` and the other checks' own Russian | C1–C3 | W1 edits no assertion message; the two checks read this owner's data (`ADVICE_LINE`, the markers) and are named as readers below. |

## Readers of every literal

Machine readers, measured:

- `test/refusals-catalog.test.js:29,70,85,90` — imports `CASES`, `PRINTED`, `SITES`; counts the
  sources' `refuseCause('…')` sites and `'✗ ` marks and compares them with the maps. So the **keys**
  and the **counts** are data of a check: a W1 step must not touch a key or a number.
- `test/refusals.test.js:30,280` — `usageCommands` from `tools/docs-facts.js` and `adviceOf` (the
  `ADVICE_LINE` markers): a `template` shape's first word is asserted to be a command the help
  knows. Step 5 and step 7 each have this check as their "red first".
- `test/docs-pin.test.js` — `commandsAt(commit)` of the **pinned revision**: the only reader of
  `'Команды:'`/`'Режимы:'` in `tools/docs-facts.js:175,177`.
- `test/docs-commands.test.js:30,45,87,126` — `usageCommands`, `usageFlags`, a README table compared
  with `CONFIG_CAUSES` (S1's data, not W1's).
- `test/gates-verify.test.js:19` — `parseWorkflow` from `tools/yaml.js`: the parser is loaded, its
  messages are not read.
- `tools/gates/run.js` — runs every instrument as a step and reads **only its exit code**.
- `.github/workflows/release.yml:71` — `pnpm run pack:check`: the code, not the words.

No reader at all, measured:

- every verdict text of `run-tests.js`, `check-standards.js`, `pack-check.js`, `parity-live.js`
  (`rg -n 'зелён|провал|расхожд' test/ tools/gates/` answers assertion messages of the sensors'
  own checks and the sensors' own verdicts, never a reader of an instrument's output);
- `tools/harness.js`'s names and messages (printed only when a check fails), and
  `tools/page-harness.js`'s three messages;
- the six comments named above.

## Steps — one commit each, red first

0. **Re-measure before starting.** By the map's order S1–S5 have landed: the cause names, the
   `must` phrases and the marker family of `tools/refusals.js` are English, and
   `tools/docs-facts.js:135` already carries the English section name. Take the counter's baseline
   for the eleven files and write it into the journal — the expectation is 349 minus whatever S1's
   joint edit moved, and it is a measurement rather than a guess.
1. **`tools/harness.js`** — the two names and the messages. Red first: none is read by a check
   (measured), so the experiment is the counter plus `pnpm test` staying green; the names' two
   duplicates (`test/refusals.test.js:169`, `test/parity.test.js`'s test names) are left to C1/C2 and
   said so in the commit body.
2. **`tools/yaml.js` + `tools/page-harness.js`** — thrown and assertion messages. Red first: make a
   template violate the subset and watch the message a person now reads (English) while
   `test/templates.test.js` stays green — the message is what the check prints, not what it matches.
3. **`tools/run-tests.js`** — the verdicts and the three `plural` word-triples. Red first: translate
   `MODES`' **keys** instead of its values → `node tools/run-tests.js fast` answers with the "run not
   named" message; put the keys back and translate the values. The `sec()`/`load()` comma is **not**
   touched (N26).
4. **`tools/check-standards.js` + `tools/pack-check.js` + `tools/parity-live.js`** — the verdicts.
   Red first: the exit code is the interface (`tools/gates/run.js`), so the experiment is
   `pnpm run check:standards` still answering 0 and `pack:check` still passing; the absence of a
   reader is proven by the grep above rather than assumed.
5. **`tools/docs-facts.js`** — the pinned revision's section name. The working-tree split (135) is
   already S1's; what is left is `commandsAt` (175, 177), which reads a revision **older than the
   rename** — today's pin. Red first: replace `'Команды:'` with the English name instead of adding it
   → `test/docs-pin.test.js` goes red with "у ревизии … нет справки с разделом «Команды»"; the same
   red arrives by itself on the release that moves the pin past S1's rename (N20). So the step
   **adds** the English name, keeps the Russian one with its reason in the comment, and is the one
   allowed exception of this owner for G1 (the guard has to name it, or the tolerance is decided
   against in favour of a structural parse — a code change, not this plan's).
6. **`tools/parity-freeze.js` + `tools/make-fixture.js`** — the console lines only. Red first: the
   allow-list's own evidence — the string of `make-fixture.js:56` stands in the frozen
   `fixtures/synthetic/config.json` (measured, 1 line), so translating it reddens `test/frozen.test.js`
   on the next re-take; the step proves the two writing functions are untouched by staying green.
7. **`tools/refusals.js`** — the catalogue's own prose (`truth` 37, `advice.why` 40, the reason
   lines, the header comments), then, in the same step or its own, the **narrowing of
   `ADVICE_LINE`**. Red first: put `починка: ` back into one refusal's text → after the narrowing
   `adviceOf` returns nothing for it and the catalogue's advice assertion goes red. The condition
   for narrowing is measured, not assumed: no refusal in `src/**` prints a Russian marker, and the
   sensors' markers (`tools/gates/dup.js`, `coverage.js`) are never parsed by the extractor.

**Why the tree is green between the commits.** Every instrument here talks through its **exit code**
to the profile runner, and no test reads a verdict (both measured above), so a step can land alone;
the three literals that a check *does* read are handled by construction — `docs-facts.js:135` moved
with S1, `commandsAt` gains the English name while keeping the old one, and the `ADVICE_LINE`
narrowing comes last, when no Russian marker is left to extract. No reference moves: the two files
that write into the frozen layer are touched only in their console lines, and step 6 proves it. No
gate file is edited here (`tools/gates/**`, `tools/suites.js`, `package.json` and the hooks are
W2's), so no step needs a `Gate-Change:` trailer.

## Acceptance

- The counter over the eleven files answers **only** the two named exceptions — the fixture-writing
  texts of steps 5 and 6 (`parity-freeze.js:98-118` and `make-fixture.js:56-64`) and the six
  comments, minus the two that step 5/its journal record as prose:
  `rg -cP '[\p{Cyrillic}]' tools/refusals.js tools/parity-live.js tools/parity-freeze.js tools/run-tests.js tools/pack-check.js tools/check-standards.js tools/make-fixture.js tools/harness.js tools/yaml.js tools/docs-facts.js tools/page-harness.js`.
- The counts and the keys are untouched — `test/refusals-catalog.test.js` says so, and it is the
  sensor that would catch a renamed cause or a lost `✗ `.
- The instruments still answer 0: `pnpm run check:standards`, `pnpm run pack:check`,
  `pnpm run parity:live`, `node tools/run-tests.js fast`.
- `pnpm run verify:fast` after every commit, `pnpm run verify` before the portion is pushed; the
  full profile is where `check:standards`, `parity:live` and `pack:check` actually run.
- The reports of the sensors (`reports/`, gitignored) are diffed rather than read: a step that moved
  a number of checks or a threshold was a step that changed behaviour, and there is none.

**Release:** the instruments do not ship — `package.json`'s `files` names `bin`, `src`, `templates`,
`README.md` and `LICENSE`, and nothing of this owner is among them (measured) — so this portion
changes no byte of the tarball and releases nothing; each commit says so in words, where S5 had to
say the opposite about its own.

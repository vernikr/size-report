# W1 — `tools`: the repository's instruments

Subplan of `plan.md` (T0). Owns the instruments outside `tools/gates/**`: 11 files, 349 measured
lines, plus the fixture builders folded in on 2026-09-16 (W3: their one remaining line, the other 88
being the reference's data and allow-listed by N21). Written 2026-09-16; **step 0 (re-measure) and
step 1 (`tools/harness.js`) done 2026-09-16**, the re-measured baseline standing below. These are the
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
| `tools/synthetic/*` (4 files) | 89 | **folded into W1** 2026-09-16: 88 lines are the fixture's own data (allow-listed, N21), 1 is this owner's (`repo.js:74`) |
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

The twelve W1 files sum to **350** — **331 of this owner's own** and the 19 fixture-writing lines N21's
decision keeps Russian — and every file under `tools/**` is named by
one of W1 or W2: **no hole in this owner**. `tools/gate-probe.js` and `tools/gates/common.js`
were measured too and carry no Cyrillic at all.

**Step 0, re-measured 2026-09-16 after S1–S5 — this owner's real baseline.** The twelve files sum to
**235**, not the 350 of the planning table, and the difference is exactly what S1–S5 moved:
`tools/refusals.js` 169 → 55 (the cause names, the `must` phrases and the marker family went with
them) and `docs-facts.js` 4 → 3. Of the 235:

- **21 stay by rule** — `manifestNote` 16 and the fixture's config values 3 (N21, permanent),
  and the two section names of `tools/docs-facts.js` (the pin still points at a Russian help;
  N20's release moves it);
- **4 are prose**, not literals — `tools/refusals.js:134`, `tools/run-tests.js:22,40`,
  `tools/docs-facts.js:170`;
- **210 are this owner's own**; step 1 lands 10 of them and **three are blocked** (`BLOCKERS.md`
  N29), step 2 lands 13, step 3 lands 23, step 4 lands 74, step 6 lands 29, step 7 lands 1 and step 8
  lands 55, and **the two decisions landed on 2026-09-16 as well** (N29's repair and N30's, one commit): the
  six blocked literals are English and `plural` prints `21 checks`. So **every step is done** and the twelve
  files read **23** (`tools/**` as a whole reads **226**). Step 5 was closed by measurement without editing
  anything. The measurement expected 31, then 30, and lands at 23: one line was the catalogue's own comment at
  `:134`, which step 8 translated rather than leaving it as prose, and seven more went with the two repairs
  (six `firstDiff` literals and the word half of `run-tests.js:40`, whose comment now carries no Russian
  quotation). The 23 by file: `parity-freeze.js` 16 + `make-fixture.js` 3 (N21, permanent), `docs-facts.js` 3
  (2 section names of the pinned revision — gone with the release that moves the pin, N20 — and its comment),
  and one comment in `run-tests.js` (`:22`, the example naming a Russian test). Nothing else in this owner is
  left to translate; what is left is the two allow-lists of other owners and one comment of prose.

And the same measurement for step 8: `tools/refusals.js`'s 55 Cyrillic lines are `truth` **37** +
`advice.why` **12** + the case `id`s **2** + the `uncatchable` prose **2** + `ADVICE_LINE` **1** +
one comment **1**, and **not one `must` phrase carries Cyrillic any more** — the catalogue half of
the tolerance is spent.

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
counter, and `:43`/`:64` — the two `sec()`/`load()` call sites of the number formatting (N26, decided 2026-09-16:
they now call `localeNumber` from `tools/harness.js`).

**3. `tools/harness.js`** (13, **done 2026-09-16**) — two **names** (`PACKAGE.name = 'движок пакета'` at 45 and 188,
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
data, not this owner's text** — permanently, since `BLOCKERS.md` N21 was decided 2026-09-16 as "the
references stay Russian", which is what this step now is: a proof that the console lines around them
are this owner's and the writing lines are not: `tools/parity-freeze.js:92` says it in its own words ("it is the
standard's data rather than this file's documentation and stays Russian"), and
`fixtures/synthetic/config.json` holds the same title string (measured, 1 line). The **console** lines
around them (`parity-freeze.js:205-211`, `make-fixture.js:197-206`) are W1's and freeze nothing.

## What stays Russian

| Item | Why |
|---|---|
| `manifestNote` (`parity-freeze.js:98-118`, 16 lines) and the fixture config values (`make-fixture.js:56,57,64`, 3) | The fixture's own data, named in T0's allow-list, and **permanent since 2026-09-16**: `BLOCKERS.md` N21 was decided as "the references stay Russian", so translating these would re-take `parity` and `synthetic` and their hashes. `parity-freeze.js:92` is the file's own statement of the rule. |
| `<файл>` and `<коммит>` in the `template` shapes (`:146-184`) | Placeholders **of the printed advice**, whose literals are S1's (`src/args.js:39,92,129,133`, `src/config.js:144`, `src/refusal.js:101,117`) and whose `must` phrases are the catalogue's. They move with S1's step 2, not here. |
| The cause names (`SITES` keys) and every `must` phrase | The owner of the printed text, per the table above. |
| Six comments (prose, not literals): `tools/refusals.js` 3, `tools/run-tests.js` 2 (`:22` quotes a command with a Russian test-name pattern, `:40` explains the Russian numbers), `tools/docs-facts.js` 1 (`:170`) | Leftovers of the prose pass, out of this work's scope by definition. `TODO.md` (like S3's `src/metrics.js:61-63`). The `docs-facts.js` one is the exception: step 5 aligns its wording if the tolerance is chosen, since the comment would otherwise claim the wrong thing — prose, no behaviour. |
| The sensors' own advice markers (`tools/gates/dup.js:139`, `tools/gates/coverage.js:93` — measured 2026-09-16; the `:1` of the first writing of this plan was a guess, and since W1's step 8 these two are the only Russian advice markers left in the tree, the tolerance of `ADVICE_LINE` being spent) | W2's texts, and never parsed by `adviceOf` (the extractor reads the *tool's* output). Measured, so that narrowing the regex in step 7 cannot surprise anyone — and measured for step 8 too: these two are the **only** Russian advice markers left in the repository, so the `src/**` half of its condition holds by measurement rather than by assumption. |

**N26 (`BLOCKERS.md`) — decided 2026-09-16: a number is formatted by `Intl.NumberFormat` in the locale the
machine runs in.** `sec()` and `load()` are gone from `tools/run-tests.js` and both
`toFixed(1).replace('.', ',')` calls are gone from `tools/gates/run.js`: four call sites of two files now use
one helper, `localeNumber(n, digits)` in `tools/harness.js` — the module `run-tests.js` already imported from
and the one `gates/run.js` imports now. No locale is pinned, so the separator follows the machine
(`en_US.UTF-8` → `12.20`, `ru_RU.UTF-8` → `12,20`; a whole fast run under the Russian locale prints
`6,17 s` and stays green). Nothing else of this owner formats a number this way (measured: two files, four
call sites), and the comment at `run-tests.js:40` that explained the comma went with `sec()` — it was the prose
leftover this plan accounted for, so the owner's prose comments read **1** (`:22`) now. `tools/gates/run.js` is a
gate file, hence the `Gate-Change:` trailer on that commit.

## Cross-ownership

| Literal | Owner | Rule |
|---|---|---|
| The cause names, the `must` phrases, the `починка: `-family markers **of the tool's refusals** | S1–S5 | Already English when W1 starts; W1 does not revisit them, and the `SITES`/`PRINTED` counts must read the same before and after. |
| `tools/docs-facts.js:135` — the working tree's section split | S1's step 1 | Joint: S1 renames the help's section, so this split is edited **in that commit** or `usageCommands` throws (`USAGE.split(...)[1]` of an absent name) and every docs guard goes red. |
| `fixtureNote` (`tools/make-fixture.js:233`) and the fixture's README text | allow-listed (N21); the builders were folded into W1 on 2026-09-16 | The note is the fixture's own data (`tools/synthetic/note.js`) and stays Russian with the references; only its **call** stands in this owner's file, and W1 never touches the text itself. |
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

0. **Re-measure before starting — done 2026-09-16.** S1–S5 have landed: the cause names, the
   `must` phrases and the marker family of `tools/refusals.js` are English, and
   `tools/docs-facts.js:135` already carries the English section name. Measured: **235** over the
   twelve files, 210 of them this owner's own, and step 8's inventory (see the scope section): the
   planning figure of 331 was the pre-S1–S5 reading, and the plan's own `advice.why` count of 40 is
   **12** by measurement — so the numbers below are the counter's, not the plan's.
1. **`tools/harness.js` — done 2026-09-16, 13 → 0** (the three of `firstDiff` followed on the same day, when N29's repair landed: the copy in `tools/parity-live.js` went, and with it the twin that held the literals in Russian). The two names
   (`the package engine`, `the frozen copy of the implementation`) and the messages of `legacyTool`,
   `requireTarget`, `refusal` and `runSize`. Red first, and it was worth the full profile: the file was
   returned to Russian **whole** and the full run stayed green — 175 checks, 0 failures — which is the
   measurement that no machine reads any of these words, and (with `test/parity.test.js` and
   `test/frozen.test.js` inside that run) that the names reach no compared artifact. The names'
   duplicates (`test/refusals.test.js:169`, `test/parity.test.js:29,37,63`) were left to C1/C2 and the
   commit says so: a check cannot see the drift, `pnpm run dup` is what watches a token twin.
   **The measurement that closed the step is also what stopped three of its literals:** the `dup`
   sensor reads the same pair — `firstDiff` here and its copy in `tools/parity-live.js:74` — as a
   clone the baseline accepts, and a translated string is a different token, so rewording it makes
   the twin **new**. Measured: English file → “новых клонов 4”; everything English except these three
   literals → green. Repair (1) — remove `parity-live.js`'s redundant copy, which two other consumers
   already take from this file — is a code change and waits for the mission agent, so the three stay
   Russian and the step is closed with a named hole rather than hidden one.
2. **`tools/yaml.js` + `tools/page-harness.js` — done 2026-09-16, 10 + 3 → 0.** `yaml.js`: the eight
   throws of the parser (`linesOf`, `scalar` twice, the flow list, `map`, `list`, `node`,
   `parseWorkflow`). `page-harness.js`: the three messages of `contractData` and `pageHtml`.
   Red first, measured two ways. (a) Both files were returned to Russian together and the **full**
   profile stayed green (175 checks, 0 failures) — no check reads a word of them, and the near
   duplicates the wording has elsewhere (`test/parity.test.js:32,41`, `tools/make-fixture.js:127,150`)
   are no reader either, because a single-line message cannot form a clone (jsdom's rule here is 50
   tokens and 5 lines). (b) The message a person now reads was taken by hand: a block scalar answers
   `line 4: the block scalar (`|`) is outside the subset — assemble the step value into one line`, an
   unquoted `? … : …` answers `line 4: a colon with a space in an unquoted value — YAML reads it as the
   end of the value; quote the value or rewrite the command`, a bad item answers `line 3: the list item
   is not a mapping`, and an open flow list answers `the flow list is not closed: [v1`. `pnpm run dup`
   was run after the translation as its own question — translating two instruments could have made a
   **new** twin the way `firstDiff` did — and answered “новых клонов нет (клонов 10 …)”; the N29 pair
   is untouched by this step, and its three literals stay as they were.
3. **`tools/run-tests.js` — done 2026-09-16, 25 → 2** (the two left are the comments of the prose
   pass). The verdicts (`▶ fast run`, the summary line, `— FAILED` in `measure`, the window line, the
   stale-declaration pair, the “no run was named” pair) and the two word-triples of `checks`/`files`.
   `MODES`' **keys are the CLI words** and stayed; only its values moved, and the red-first rule of the
   plan was measured on the way: with `fast` translated the runner no longer takes its own name.
   Measured, three ways: (a) returned to Russian whole, the **full** profile stayed green (175 checks) —
   no check reads a word of this file, and `tools/gates/coverage.js:63` runs it for its exit code alone;
   (b) the helpers were taken out of the file's own source text and run over real counts — `1 check`,
   `2 checks`, `5 checks`, `11 checks`, `70 checks` correct, and **`21 check`** wrong, which is
   `BLOCKERS.md` **N30** (the rule in `plural` is Russian grammar: no choice of three English words can
   be right for both 1 and 21); (c) `node tools/run-tests.js nope` answers the English “No run was
   named” and exits 2. `pnpm run dup` was asked its own question and answered no new twin. The
   word half of the comment stopped being an exception on 2026-09-16, when N30's repair landed, and the
   comma half went with `sec()` when N26 was decided the same day: the file's second prose comment is gone,
   so the owner's prose is one line (`:22`) — the counter reads `tools/run-tests.js:1`.
4. **`tools/check-standards.js` + `tools/pack-check.js` + `tools/parity-live.js` — done 2026-09-16,
   21 + 21 + 35 → 0 + 0 + 3.** All the verdicts of the two re-take checks and of the live parity, plus
   the two environment labels and the contract lines; the three left in `parity-live.js` are exactly
   **N29**'s pair, and nothing else in the file was touched. Red first, and the evidence is stronger
   than the plan's grep: all three files were returned to Russian together and the **full `verify` —
   the eight steps, not only the tests — stayed green**, so the interface of all three is the exit code
   and not a word; the printed lines of each were taken in English by hand (see the journal). Measured
   for the question the step was asked: neither the artifact's hash (`fixtures/parity/artifact.sha256`,
   `1bdb27e1…`) nor the built page's (`docs/size-report.html`, `40eda37d…`) moved — `check-standards`
   compares the fixtures it re-takes, and the page is built from the locale dictionary, so no
   translated word is inside a compared artifact. `pnpm run dup` was asked its own question and
   answered no new twin. One near-twin was measured on the way: `tools/gates/run.js:42` (W2's) describes
   this step in almost the same words as its final line — no guard compares them, one line cannot form
   a clone, and it is named here so W2 sees it.
5. **`tools/docs-facts.js` — closed 2026-09-16 by measurement: nothing is left to translate.** The file
   reads **3** Cyrillic lines and all three stay: the comment at `:170`, which quotes the pinned
   revision's section name as the very thing the code scans, and the two code lines (`:182`, `:184`),
   which already carry **both** spellings — `'Команды:'` or `'Commands:'`, `'Режимы:'` or `'Modes:'` —
   so the English half this step was to add arrived with S1's joint edit. The Russian half is live, not
   tolerated for its own sake, and measured: the pin of `README.md:593` is `v2.4.0`, and
   `git show v2.4.0:src/refusal.js` holds `'Команды:'` at `:99` and `'Режимы:'` at `:111`. The red
   experiment was run in the direction the plan named: with the Russian alternative taken out,
   `node --test test/docs-pin.test.js` goes red with `у ревизии «v2.4.0» нет справки с разделом
   «Команды» — она старше того, чему учит текст`. And the question of what a translated name would do to
   the standards sensor is answered by measurement too: **nothing** — none of the four instruments that
   run under `pnpm run verify` imports `tools/docs-facts.js` (measured); the readers are
   `test/docs-pin.test.js`, `docs-commands`, `docs-paths`, `docs-numbers`, `refusals`, `templates`,
   `module` and `page-tree`, and only the pin guard reads a revision older than the rename.
   **The working-tree split (`:135`) is S1's and the alternative named in the plan — a structural parse of
   the help instead of a section name — is a code change, not this plan's.** No file was edited by this
   step: `git status` while closing it showed `tools/docs-facts.js` byte-identical to the tree, and
   `pnpm run verify` was green with it untouched.
6. **`tools/parity-freeze.js` + `tools/make-fixture.js` — done 2026-09-16, 15 + 14 → 0 + 0, with the
   19 allow-listed lines standing word for word.** Of the 31 Cyrillic lines of `parity-freeze.js`,
   **16 are `manifestNote` (`:98-118`)** and of the 17 of `make-fixture.js`, **3 are the fixture's
   config values (`:56`, `:57`, `:64`)** — those 19 stay, and that is N21 rather than an oversight:
   they are written into `fixtures/**` (`parity-freeze` writes `README.md` from `manifestNote(ctx)`, the
   builder writes `config.json` from `CONFIG`), so translating them re-takes both references.
   **Measured for the question this step was asked:** the re-takes were compared with what is committed
   in the tree — `node tools/make-fixture.js --out …` answers byte-identically to `fixtures/synthetic`
   for every file, and `node tools/parity-freeze.js fixtures/live/history.bundle --out …` differs from
   `fixtures/parity` in exactly two files: `manifest.json`, whose `name`/`path` fields record the path
   the reference was taken from (the difference the plan already names as legitimate), and
   `README.md`, **in one interpolated word of that same field** — `Проект: `history.bundle`` against
   `Проект: `safe-resets``, the Russian template standing word for word. `fixtures/**` is unmodified in
   the tree and `fixtures/parity/artifact.sha256` still reads `1bdb27e1…`. Red first: both builders
   returned to Russian together leave the **full verify** green. `pnpm run dup` answered no new twin.
   The step's own plan text, kept for the record: Red first:
   the allow-list's own evidence — the string of `make-fixture.js:56` stands in the frozen
   `fixtures/synthetic/config.json` (measured, 1 line), so translating it reddens `test/frozen.test.js`
   on the next re-take; the step proves the two writing functions are untouched by staying green.
7. **`tools/synthetic/repo.js` — done 2026-09-16, 1 → 0.** The thrown message of the merge the fixture
   builder expects to conflict (`:74`), now `the merge in the fixture went through without a conflict`.
   Red first, and it was taken live rather than by grep: a clean merge was put in front of
   `mergeConflicted` in a scratch repository of two branches that merge without a conflict, and the
   builder answered with exactly that sentence. Measured for the question this step was asked: the
   message stands in **no** file of `fixtures/**` (`rg` over the folder answers nothing), so it is
   thrown only when the build goes wrong and reaches no frozen byte; `check:standards` re-took both
   references green, `fixtures/parity/artifact.sha256` still reads `1bdb27e1…`, and the built page is
   byte-identical to the committed one (`git status` names no change to it). `pnpm run dup` answered no
   new twin.
8. **`tools/refusals.js`** — the catalogue's own prose, **measured 2026-09-16 as `truth` 37, — the catalogue's own prose, **measured 2026-09-16 as `truth` 37,
   `advice.why` 12, the case `id`s 2, the `uncatchable` prose 2 and the header comment 1** (55 in
   all; the plan's `advice.why` 40 and its silence about the `id`s are both corrected here — the two
   Cyrillic `id`s, `покрытие неполно` and `приближение вместо точного счёта`, are read only inside
   the checks' own failure messages, `test/refusals.test.js:301` and
   `test/refusals-catalog.test.js:94,104,107,113,116,126,130`, and no assertion matches their text),
   then, in the same step or its own, the **narrowing of `ADVICE_LINE`**. Red first: put `починка: `
   back into one refusal's text → after the narrowing `adviceOf` returns nothing for it and the
   catalogue's advice assertion goes red. The condition for narrowing is measured, not assumed: no
   refusal in `src/**` prints a Russian marker, and the sensors' markers are never parsed by the
   extractor — the only two Russian markers left in the repository are W2's
   (`tools/gates/dup.js:139`, `coverage.js:93`, measured above).
   **What holds this step, measured 2026-09-16: nothing.** Its condition is met (no `src/**` module
   prints a Russian marker since S5, and the two sensors' markers are never parsed by the extractor),
   the tree is green around it, and N29/N30 touch `firstDiff` and `plural` rather than the catalogue —
   so the step is waiting on a portion, not on a decision.
   **DoNE 2026-09-16, and W1 with it: 55 → 0.** The prose was translated line by line (49
   `truth`/`why` lines, the two case `id`s, the two lines of the one `uncatchable` reason) and the
   stale `template` comment now names `<file>`/`<commit>`, as the advice prints them. **The narrowing
   landed** — `ADVICE_LINE` keeps only the English markers — and the price was measured: the extractor
   has one call site (`test/refusals.test.js:245`), it reads the tool's output alone, and the only
   Russian advice markers left anywhere are W2's two sensors. The plan's red experiment was run
   **twice**: on the shallow case it did **not** redden (that refusal prints two advice lines, and the
   extractor asserts about texts rather than about markers — green, which is a finding rather than a
   failure), and on `config already exists`, which prints one line, it reddened exactly as promised:
   `«settings and the project / config already exists»: отказ ничего не советует, а каталог объявил
   совет`. Which of the 55 the tolerance was worth is recorded as narrower than it looked: an advice
   that loses its marker while a second advice line stays is invisible to the catalogue either way.
   **What the step asked about the machine-read lines:** of the 55, only the two `id`s and the
   `uncatchable` text are read by a check — the `id`s inside failure messages
   (`test/refusals.test.js:301`, `test/refusals-catalog.test.js:94,104,107,113,116,126,130`, and the
   `deepEqual` at `:113` names `'internal error'`, which is not one of them) and the `uncatchable`
   text only by its length (`:116`, more than 40 characters — kept at ~150). `truth` and `advice.why`
   are read by no machine at all (measured). The counts stand untouched: `SITES` 27, `PRINTED`
   2/2/1/2/4, `CASES` 38, and both catalogue checks green. `pnpm run dup` answered no new twin;
   `tools/refusals.js` is **not** a gate file (`tools/gates/gatefiles.js`), so the commit carries no
   `Gate-Change:` trailer — the hook says it itself: “гейт-файлов 0”.

**Why the tree is green between the commits.** Every instrument here talks through its **exit code**
to the profile runner, and no test reads a verdict (both measured above), so a step can land alone;
the three literals that a check *does* read are handled by construction — `docs-facts.js:135` moved
with S1, `commandsAt` gains the English name while keeping the old one, and the `ADVICE_LINE`
narrowing comes last, when no Russian marker is left to extract. No reference moves: the two files
that write into the frozen layer are touched only in their console lines, and step 6 proves it. No
gate file is edited here (`tools/gates/**`, `tools/suites.js`, `package.json` and the hooks are
W2's), so no step needs a `Gate-Change:` trailer.

## Acceptance

- The counter over the twelve files answers **exactly 23**, and every one of the 23 is named: the 16
  lines of `manifestNote` (`parity-freeze.js:98-118`) and the 3 config values of the fixture
  (`make-fixture.js:56,57,64`), permanent since N21 was decided; the 3 lines of `docs-facts.js` — its 2
  section names of the pinned revision, which N20's release moves, and the one comment that names them —
  and 1 prose comment (`run-tests.js:22`), the only one left after N26's decision took the comment that
  explained the comma with `sec()`. 16 + 3 + 3 + 1 = 23. The command:
  `rg -cP '[\p{Cyrillic}]' tools/refusals.js tools/parity-live.js tools/parity-freeze.js tools/run-tests.js tools/pack-check.js tools/check-standards.js tools/make-fixture.js tools/harness.js tools/yaml.js tools/docs-facts.js tools/page-harness.js tools/synthetic/repo.js`.
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

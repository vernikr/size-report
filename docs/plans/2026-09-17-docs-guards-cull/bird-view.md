# Documentation guards — bird view

2026-09-17. The opening inventory of the campaign `plan.md` opens beside it. One table per
dimension: what every guard promises, what it costs in seconds and what it costs in lines.
Nothing here is a decision; the decisions are the campaign's.

## What was counted, and how the line falls

A **documentation guard** is a check whose red would mean *a document says what is no longer
true* — a path the tree does not hold, a command the help does not know, a count that has moved,
an address that leads nowhere. Two readings of one thing: the documents are read as promises
about today's tree.

- **Tier 1 — the prose itself.** The four documentation guards, their shared reader, and the
  template guard where it reads the templates' note. The documents read are markdown:
  `README.md`, `plans/archive/PLAN.md`, `plans/archive/REFACTOR.md`, `BLOCKERS.md`,
  `templates/README.md`, and three more as addresses only (`worklog/archive/WORKLOG.md`,
  `docs/requirements.md`, `docs/module-design.md`).
- **Tier 2 — the declarations that stand in for prose.** The workflows, the hooks, the split of
  the suite and the list of gate files are read textually and held against the tree. Their red
  means *the declaration and what runs have diverged* — the same defect class, one layer down,
  and a reader may reasonably draw the line elsewhere.
- **Tier 3 — named and not counted**, each with the reason: `check:standards` (`pnpm run
  check:standards`) re-takes the frozen references byte for byte — that is data, not prose;
  `test/refusals-catalog.test.js` holds the *test* catalogue (`tools/refusals.js`) against the
  sources; the metrics sensor's `assert-in-test` / `weak-assert` / `no-skipped-test` are checks
  about checks; the `dup`, `deps` and `coverage` sensors read no document at all.

## Tier 1 and Tier 2 — the inventory

Checks are `test(` declarations at the start of a line (`tools/suites.js`, `checksIn`). Lines
are whole file: total / code / comment / blank. `run` is the run the file is declared in
(`tools/suites.js`: `FAST` / `SLOW`).

| # | Guard | Promises | Checks | Total | Code | Comment | Blank | Run |
|---|---|---|---|---|---|---|---|---|
| A1 | `test/docs-paths.test.js` | every path-like span of the five documents exists in the tree, in the fixture's history or in the hand-kept foreign list; the README file table covers the tree **both ways** | 2 | 66 | 46 | 13 | 7 | fast |
| A2 | `test/docs-commands.test.js` | the instructions call only commands and flags from the help; the call works with the package absent; the code-2 cause table of README equals `CONFIG_CAUSES`; every `§` reference resolves | 4 | 208 | 127 | 65 | 16 | fast |
| A3 | `test/docs-numbers.test.js` | the check counts in README equal the files on disk (fast and full) | 1 | 53 | 31 | 17 | 5 | fast |
| A4 | `test/docs-pin.test.js` | the install pin names a revision whose help knows the commands the text teaches | 1 | 62 | 37 | 17 | 8 | fast |
| A0 | `tools/docs-facts.js` | the reader all four share — documents, foreign paths, targets, spans, calls, sections | — | 232 | 125 | 88 | 19 | — |
| | **Tier 1, the four guards** | | **8** | **389** | **241** | **112** | **36** | |
| | **Tier 1 with the reader** | | **8** | **621** | **366** | **200** | **55** | |
| B1 | `test/templates.test.js` | the note about the templates names the files that ship (and the one left out); the draft and the CI check name flags the help has (the third check builds a report — behaviour, not a document) | 3 | 163 | 103 | 39 | 21 | fast |
| B2 | `test/gates-verify.test.js` | the profile (`tools/gates/run.js`), the workflows and the hooks say one thing; "one command is the source of truth" | 5 | 162 | 109 | 31 | 22 | fast |
| B3 | `test/suites.test.js` | every file of the suite is classified with a reason of its own: the split cannot age in silence | 3 | 78 | 45 | 24 | 9 | fast |
| B4 | `test/release.test.js` | the release description parses and says what is true: a tag starts it, no secret, the version from the manifest, the full set before publishing | 3 | 138 | 85 | 40 | 13 | slow |
| B5 | `test/gates-files.test.js` | the probe of the gate-file rule: a change to a threshold or a baseline passes only with the `Gate-Change:` trailer | 3 | 117 | 79 | 23 | 15 | slow |
| | **Tier 2** | | **17** | **658** | **421** | **157** | **80** | |

Supporting modules whose users are not only these guards, named rather than hidden:
`tools/suites.js` 100 (62 code / 29 comment — the split, read by A3 and B3),
`tools/gates/gatefiles.js` 100 (65 / 26 — B5's subject),
`tools/yaml.js` 135 (92 / 33 — shared by B1, B4, B2),
`tools/gate-probe.js` 67 (35 / 21 — B2 and the four `gates-*` probes). **402 lines**, of which the
doc-guard share cannot be separated honestly.

Footprint: the nine guard files are **1 047 lines of the 6 048 in `test/`** (17 %); with
`tools/docs-facts.js` **1 279 lines** (21 %). `src` is 5 238, `tools` 3 741 lines. Comment lines
are **about a third of a Tier-1 guard** (`docs-facts.js` 38 %, `docs-commands.test.js` 31 %) and
about a quarter of Tier 2 — and they are the part that says *why the guard exists*, so they are
cancelled with it.

## Time — every file on its own, one at a time

`node --test <file>`, wall clock, one process per file, in the order below. Window: 2026-09-17
16:55, node 22.23.2, load 6.31 on the way in. Seconds of different windows are not comparable
(`tools/suites.js` says why); the same run on a quieter window (16:51, load 3.24) gave the four
Tier-1 guards 0.58 / 0.63 / 0.44 / 0.60 against 0.62 / 0.51 / 0.40 / 0.57 — the order of
magnitude is the measurement, not the digit.

| Rank | Guard | Seconds | Checks | Why it costs this |
|---|---|---|---|---|
| 1 | `test/gates-files.test.js` | 1.90 | 3 | a temporary repository of its own, commits and an amend: the cost is in git |
| 2 | `test/templates.test.js` | 1.41 | 3 | a clone of the fixture and a real report assembled with the draft |
| 3 | `test/gates-verify.test.js` | 0.71 | 5 | three process calls for the profile's step lists, plus two workflows parsed |
| 4 | `test/docs-commands.test.js` | 0.63 | 4 | reads the tree and git, and parses the help — no subprocess of the tool |
| 5 | `test/docs-pin.test.js` | 0.60 | 1 | `git show <pin>:src/refusal.js` — history, not the tree |
| 6 | `test/docs-paths.test.js` | 0.58 | 2 | one clone of the fixture for the renames' sake |
| 7 | `test/release.test.js` | 0.47 | 3 | parses one workflow |
| 8 | `test/docs-numbers.test.js` | 0.44 | 1 | reads every file of `test/` (37) and counts declarations |
| 9 | `test/suites.test.js` | 0.33 | 3 | reads the declaration and the sources |
| | **Tier 1 (A1–A4)** | **2.25** | **8** | |
| | **Tier 2 (B1–B5)** | **4.82** | **17** | |
| | **Both tiers** | **7.07** | **25** | |

Against the whole set, one file at a time: the fast set sums to **26.49 s** in its own window
(load 5.60) — so both tiers are about **a quarter of the fast set's serial time**, and Tier 1
about **8 %**. Pooled by the runner the fast set is 6.83 s of wall clock (70 checks, load 3.99),
and there the guards are mostly hidden behind the checks that clone fixtures and run the tool.

The whole `verify:fast` profile in that same window: `lint:strict` 2.4 s, `metrics` 4.3 s, `dup`
2.1 s, `deps` 2.7 s, `test` 7.4 s — **18.9 s**. That is the price of one commit, and seven of the
nine guards above are inside it: A1–A4, B1, B2, B3 run **on every edit** through `.githooks/`.

Time is not where the guards are expensive. Five of the nine cost under 0.75 s, and none of them
runs the tool over a history; what the table shows is a floor of about 0.3–0.6 s per file — the
process, the harness and one git read — repeated nine times.

## Code — where the volume is

Ordered by total lines; a line here is one the campaign can delete.

| Rank | File | Total | Code | Comment | Blank | Share of the file that is prose |
|---|---|---|---|---|---|---|
| 1 | `tools/docs-facts.js` | 232 | 125 | 88 | 19 | 38 % |
| 2 | `test/docs-commands.test.js` | 208 | 127 | 65 | 16 | 31 % |
| 3 | `test/templates.test.js` | 163 | 103 | 39 | 21 | 24 % |
| 4 | `test/gates-verify.test.js` | 162 | 109 | 31 | 22 | 19 % |
| 5 | `test/release.test.js` | 138 | 85 | 40 | 13 | 29 % |
| 6 | `test/gates-files.test.js` | 117 | 79 | 23 | 15 | 20 % |
| 7 | `test/suites.test.js` | 78 | 45 | 24 | 9 | 31 % |
| 8 | `test/docs-paths.test.js` | 66 | 46 | 13 | 7 | 20 % |
| 9 | `test/docs-pin.test.js` | 62 | 37 | 17 | 8 | 27 % |
| 10 | `test/docs-numbers.test.js` | 53 | 31 | 17 | 5 | 32 % |
| | **All ten** | **1 279** | **787** | **357** | **135** | **28 %** |

The two largest entries say where the code goes: **`docs-facts.js` (232) is the reader**, and
`docs-commands.test.js` (208) is the guard that uses nine of its eleven exports. Half of Tier 1's
volume (**200 lines, 32 %**) is the reason behind each promise written out in a header — exactly
what the campaign's "delete the guard" path removes and its "keep the guard" path has to pay for.

## What the guards hold of the documents

The other side of the same cost: how much of a document is not free to age.

| Held by | Demand | Measured now |
|---|---|---|
| A1 | every path-like span of the five documents exists | **871** spans scanned, **26** foreign paths kept by hand |
| A1 | the README file table covers the tree both ways | the tree holds **298** tracked files |
| A2 | the instructions call only known commands and flags | **45** calls, 5 commands taught; the help declares **10** commands and **13** flags |
| A2 | the code-2 cause table equals the registry | the registry (`CONFIG_CAUSES`) is the single source, the help prints it |
| A2 | every `§` reference resolves to an existing section | **250** references scanned; **919** addressable sections in 7 target files |
| A3 | the run counts in README are the real ones | **70** checks fast, **175** full — must be edited whenever a check is added or removed |
| A4 | the install pin matches `installSpec()` and its revision's help knows the taught commands | pin `v2.5.0`; the release order (tag first, branch second) is fixed by `AGENTS.md` because of it |
| B1 | the templates' note names what ships | 2 files named, plus the one left out |
| B2 | a check outside the profile cannot be in CI | 3 profiles, 2 workflows, 3 hook files |
| B3 | every file of the suite has a reason of its own | 37 files, 19 + 18 in `FAST` / `SLOW` |
| B5 | gate files change only with a `Gate-Change:` trailer | the list in `tools/gates/gatefiles.js` |

Documents read: the five of Tier 1 are **3 634 lines**; the addresses add **5 980 lines** of
journal, requirements and design. What the guards deliberately do not take is stated in their own
headers: wording and meaning, promises about the future, and whether a file's role is described
rightly.

## Cost of ownership

From the history of the tree: the four Tier-1 guards plus their reader have been touched in **29
commits**, **44 file-touches**, **+982 / −366 lines** — the reader alone in 19 of those commits.
The documentation rework of 2026-09-15/16 ran **255 commits over `*.md`**, and its plan states the
rule that makes the pair indivisible: "the documentation guards read the *shape* of these files,
so translating a document means editing its reader in the same commit". Every pass over the
documents pays twice.

Three costs that do not show in any line count, and do not leave with the code alone:

- the hand-kept lists — `FOREIGN` (26), `DOCS`, `TARGETS`, `NOT_TODAY`, `OWN_PROJECT`: a new
  foreign path, a renamed document or a new "not yet" section is a deliberate edit, or the guard
  reddens on the absent;
- the release ritual the pin fixes: the tag is placed before the release commit and pushed in one
  command with the branch, or the pin guard reddens in CI (`AGENTS.md`, `test/docs-pin.test.js`);
- a guard that is edited in the same commit as its document tends to be edited *to fit* the
  document — the red-first experiments in `docs/plans/2026-09-16-i18n-english/**` record how much
  work that pattern costs when a whole language moves.

## What the numbers say, in one paragraph

By time the guards are cheap and uniform, and only two stand out — the gate-file probe (1.90 s)
and the template guard (1.41 s) — and neither is expensive *because* it reads a document; they
pay for a repository of their own and a fixture. By volume the picture is the reverse: one
reader (232 lines) and one guard (`docs-commands`, 208) hold half of the 1 279 lines, and a
quarter of all of it is prose explaining why the promise exists. By documents held, the dearness
is concentrated in `README.md`, which four guards read at once, and in the release order the pin
fixes. The guards whose volume is smallest — `docs-numbers` (53) and `docs-pin` (62) — are the
ones that constrain the *process* rather than the text, and they are the only two a single number
can redden.

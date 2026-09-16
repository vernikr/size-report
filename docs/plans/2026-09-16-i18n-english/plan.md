# Russian strings out — meta plan (tracker)

2026-09-16. Subplans: one per subsystem, listed in the map below. **This file tracks them:** a
subplan appears here as *written*, a step as *done* or *dropped*, and nothing is marked done
without a measurement. One subplan is planned and one chunk of work is done per portion;
progress is journalled in `worklog/NNNN-*.md`, one file per portion (`worklog/0134-*.md` opened
this work).

Predecessor: `docs/plans/2026-09-15-docs-rework/` put the **prose** (comments, markdown) into
English and named user-facing strings out of scope. This work is exactly that leftover: the
strings. Its own definition of done listed them — "user-facing strings, locale dictionaries,
sensor verdicts, test assertion messages" — and its open question "the report's own language"
is answered here.

## Goal

Every **Russian string constant and literal** in the repository becomes English: what the tool
prints to a user, what a sensor prints to a developer, what a check says when it fails, what the
templates and the workflows say in their comments, and what the tools write into generated files.

Two readers, and each is a reason of its own. The tool is a published package: a refusal, the
help, a diagnostic answer and a commit subject the hook writes into someone else's history are
read by people who do not read Russian. The repository is worked on by agents: an assertion
message is the only description of a failure a machine gets, and a sensor's verdict is the whole
report.

## What stays Russian (the allow-list, not an oversight)

| Layer | Why |
|---|---|
| `worklog/**` | The journal is the record of the request and of the work; it is read in the language of the request and is not a product. |
| The `ru` dictionary in `src/locales.js` | A locale is **data**: it is the Russian interface of the report, and deleting it deletes a feature. Its counterpart `en` is the target of every other string. |
| `fixtures/**` | Frozen references: `pnpm run check:standards` re-takes them and compares byte for byte, and `test/frozen.test.js` holds their hashes. Inventories: the consumer's `history.bundle` (2 270 lines of the tool's own output, frozen in September), `fixtures/parity/data.json` (214), `fixtures/*/config.json` (`title`, `heading`, column labels — the sample data being measured), `fixtures/*/golden.json` (commit subjects of the synthetic history) and the fixtures' `README.md` (written by the generator, compared byte for byte). Touching any of them means re-taking both references — a decision with a price, `BLOCKERS.md` N21. |
| Russian sample data (`docs/заметки.md`, subjects, file names, labels) | It is what the measurement is measured **on**: the traps of the synthetic fixture exist to prove that a non-ASCII path, a quoted subject and an HTML-escaped signature survive. |
| Quotes of old output in records (`BLOCKERS.md`, the archived plans, `worklog/`) | A record of what a reader saw then is true of then; `BLOCKERS.md` states the rule in its own header. |
| `docs/plans/2026-09-16-i18n-english/**` | A subplan quotes the strings it translates and carries the counter's own pattern; without the quotation a reader cannot see what is meant, and the guard `G1` therefore skips this folder. |

## Current state — measured 2026-09-16

The instrument (PCRE2, so the pattern carries no Cyrillic and cannot match itself):

```bash
git ls-files | rg -v '^worklog/' | while read -r f; do
  n=$(rg -cP '[\p{Cyrillic}]' "$f" 2>/dev/null); [ -n "$n" ] && printf '%6d %s\n' "$n" "$f"
done | sort -rn
```

Whole tree: **5 385 lines in 110 files**. Of them the frozen layer (`fixtures/` 2 602 lines in 9
files), the built report (`docs/size-report.html` 349 lines — the tool's own `ru` output, rebuilt
by the hook) and the archived plans (15 lines, `plans/archive/REFACTOR.md`). What this work has to
carry is **2 396 lines** in code, checks, tools and configs:

| Subsystem | Files | Lines | Where the Russian is |
|---|---|---|---|
| `src/**` | 24 | 351 | the help and refusal texts, diagnostics, the hook's commit subject, metric captions |
| `bin/**` | 2 | 2 | the post-install note |
| `tools/**` (instruments) | 12 | 387 | every instrument's console output: the sensor runs, the reference takings, the harness, the pack check |
| `tools/gates/**` (sensors) | 6 | 77 | each sensor's verdict, its hints and the profile's step names |
| `tools/synthetic/**` (fixture builders) | 4 | 89 | the generated fixture's note and content — **feeds the frozen layer** |
| `test/**` | 37 | 1 320 | test names and assertion messages, one per check |
| `templates/**` | 3 | 35 | the comments of the settings draft, the CI template, the note |
| `.github/workflows/**` | 3 | 78 | the comments of the three workflows |
| `package.json` | 1 | 1 | `description` — what the registry shows |
| `AGENTS.md`, `BLOCKERS.md`, `README.md` | 3 | 10 | quotations of printed Russian, allowed by the allow-list |
| `docs/size-report.html` | 1 | 349 | generated; turns English with the source of its texts, not by hand |

Of these 2 396 lines only **10 are comments** (`src/` 3, `tools/` 6, `test/` 1 — leftovers of the
prose pass); the rest are string literals, test names and YAML/markdown comments. The measurement
that separates them:

```bash
rg -c '^\s*(//|\*|/\*).*\p{Cyrillic}' <file>
```

## The map: one subplan per subsystem

`T0` is this file. `S*` — the published runtime, `W*` — the repository's instruments, `C*` — the
checks, `D*` — the declarative files, `G*` — the guard. Sums are the measured lines above.

| # | Subplan | Owns | Lines | Status |
|---|---|---|---|---|
| T0 | `plan.md` | this tracker: the map, the allow-list, the criterion, the order | — | **written 2026-09-16** |
| S1 | `surface.md` | `src/refusal.js` (46), `src/args.js` (26), `src/cli.js` (4), `src/modes.js` (13) — the help, the cause registry, the CLI refusals and what the modes print; `src/locales.js` (45) is named there as staying Russian (**default locale** = `BLOCKERS.md` N19, not decided) | 89 | **written 2026-09-16** |
| S2 | `settings.md` | `src/config.js` (35), `src/project.js` (4), `src/init.js` (18) — what a settings file says when it is wrong, and what `--init` prints | 57 | not started |
| S3 | `measurement.md` | `src/metrics.js` (20), `src/minify.js` (4), `src/strip.js` (1), `src/strip/guard.js` (6), `src/parse.js` (1), `src/optional.js` (1) — metric captions, the method and accuracy marks, the guard's verdicts | 33 | not started |
| S4 | `diagnostics.md` | `src/git.js` (3), `src/history.js` (12), `src/check.js` (12), `src/doctor.js` (33), `src/explain.js` (24) — `check`, `explain`, `doctor` and the skip reasons; **`SKIP_WORDS` in `src/history.js` is frozen into both references** (`BLOCKERS.md` N24), so it depends on the N21 decision | 84 | not started |
| S5 | `automation.md` | `src/hook.js` (40), `src/page/panel.js` (3), `bin/postinstall.js` (2) — the installed hook's text and its commit subject, the panel's service words | 45 | not started |
| W1 | `tools.md` | the 12 instruments: `tools/refusals.js` (169), `parity-live.js` (35), `parity-freeze.js` (31), `run-tests.js` (25), `pack-check.js` (21), `check-standards.js` (21), `make-fixture.js` (17), `harness.js` (13), `yaml.js` (10), `docs-facts.js` (4), `page-harness.js` (3) | 349 | not started |
| W2 | `sensors.md` | `tools/gates/**` (77) and the `why` of every entry in `tools/suites.js` (38) — **gate files: `Gate-Change:` trailer required** | 115 | not started |
| W3 | `fixture-builders.md` | `tools/synthetic/note.js` (37), `content.js` (31), `history.js` (20), `repo.js` (1) — the fixture's note and subjects; **decides whether the frozen layer is re-taken** (`BLOCKERS.md` N21) | 89 | not started |
| C1 | `tests-page.md` | the checks of the page and the contract (355 lines): `page-view` 72, `page-choice` 67, `module` 66, `page-tree` 55, `contract-data` 51, `contract-derived` 18, `guard` 11, `runner` 11, `api` 4 | 355 | not started |
| C2 | `tests-cli.md` | the checks that drive the tool (739 lines): `hook` 113, `check` 84, `doctor` 83, `cli` 79, `minify` 75, `disk` 68, `tokens` 54, `release` 41, `templates` 33, `cli-paths` 31, `refusals-catalog` 26, `refusals` 25, `environment` 18, `crlf` 9 | 739 | not started |
| C3 | `tests-guards.md` | the checks of the repository itself (226 lines): `gates-verify` 26, `gates-files` 26, `docs-commands` 23, `gates-metrics` 22, `suites` 16, `parity` 16, `frozen` 16, `gates-coverage` 16, `docs-pin` 14, `gates-dup` 13, `git-pins` 12, `docs-numbers` 12, `gates-deps` 8, `docs-paths` 6 | 226 | not started |
| D1 | `configs.md` | `.github/workflows/**` (78), `templates/**` (35), `package.json` `description` (1) — the declarative files and what the registry shows | 114 | not started |
| G1 | `guard.md` | the check that holds the allow-list: a scan over the tree that reddens on a new Russian literal outside the named exceptions | — | not started |

`AGENTS.md`, `BLOCKERS.md`, `README.md` and the built report are not a subplan of their own: the
first three hold allowed quotations of printed output, and the report is regenerated by whichever
subplan changes the texts it is built from (S1 first, since it owns the dictionaries).

## Order

1. **S1 → S5** (the published runtime) — the reader who installs the package is the reason the
   work exists, and the texts of `src/` are what the generated report and the templates quote.
2. **D1 and W1** — the workflows and the instruments, cheapest first: they print to a developer
   and nothing else depends on their wording.
3. **W2** — the sensors: gate files, each commit with the `Gate-Change:` trailer and the reason
   in words ("the verdict's language"), one file per commit as the budget allows.
4. **C1 → C3** — the checks last of the code: after the runtime, because a message that repeats
   the printed text has to match it, and because a translation of a message is proven by the run
   of the check that carries it.
5. **W3** — the fixture builders, with the decision about the frozen layer taken first (N21).
6. **G1** — the guard that closes the allowance: last, when the tree allows a green run.

Nothing in this order is a prerequisite in substance: S*, W*, C* and D1 do not import each
other's texts. The order is a choice (the reader who pays is first), not a dependency.

## Rules shared by every subplan

- **Behaviour is not changed.** Only a literal's value changes: no condition, no argument, no
  control flow, no API. A subplan that needs one stops and records the need in `BLOCKERS.md`
  rather than widening itself.
- **A message read by a check is edited together with the check.** Several guards read text
  rather than behaviour, and each has to be named before its strings are touched:
  - `tools/docs-facts.js` (`commandsAt`) finds the help's command list by the literal section name
    `'Команды:'` in the revision the install example pins, read **out of git history**
    (`git show <pin>:src/refusal.js`), and `test/docs-pin.test.js` fails with "у ревизии … нет
    справки с разделом «Команды»" when it finds nothing. The pin moves with every release, so the
    commit that renames the section and the commit that moves the pin have to be the same one —
    otherwise the guard is green on the old revision and red on the new.
  - `test/refusals.test.js` and `test/refusals-catalog.test.js` match refusal **causes** (the
    registry in `src/refusal.js` and the `README.md` code table are compared with each other, so
    a cause renamed in one place must be renamed in the other) and read `refuseCause('…')`'s first
    argument as a literal.
  - The documentation guards (`test/docs-*.test.js`) parse the shell's shape from the help
    (`USAGE`) and the instruction documents — S1 changes both sides at once.
  - `test/release.test.js` and `test/hook.test.js` read the text of workflow and hook files.

  Each subplan names the readers of the strings it translates.
- **A literal quoted in a document is a claim.** `README.md`, `BLOCKERS.md` and the plans quote
  printed output; a quotation that stops being what the tool prints is updated in the same commit.
- **The allow-list is the only exemption.** No `eslint-disable`, no threshold moved, no baseline
  edited: a red sensor is fixed in the code (`AGENTS.md`).
- **Commit budget: ≤ 600 lines and ≤ 10 files.** A bigger chunk is justified in the commit body.
- **Gate files need the trailer**: `tools/gates/**`, `tools/suites.js`, `test/gates-*.test.js`,
  `package.json`, the workflows, the hooks, the baselines, the sensor configs. W2 and G1 are the
  subplans that meet it; for the others, needing it means the plan is wrong.
- **Release per portion** — a string that ships changes the tarball's bytes, so
  `AGENTS.md`'s rule applies: a PATCH release, a journal section and the pin in `README.md`.
  Whether to release per subplan or to batch is a question for the mission agent
  (`BLOCKERS.md` N20).
- **The `post-commit` hook** rebuilds and commits `docs/size-report.html` by itself; a portion
  therefore ends with two commits, and the second one is expected rather than a defect.

## Definition of done

- `rg -lP '[\p{Cyrillic}]'` over the tree names **only** the allow-list: `worklog/**`, the `ru`
  dictionary, `fixtures/**`, the Russian sample data of the fixtures and the quoted old output of
  `BLOCKERS.md` and the archived plans. The measurement is quoted per subplan, before and after,
  with the file list.
- Every subplan's own acceptance holds, and `pnpm run verify:fast` is green after every commit and
  `pnpm run verify` before the portion is pushed.
- A literal that a test matched on is proven by the test still reddening where it should: the
  subplan quotes the run that would have caught a mistake (a reversed `assert`, a missing cause).
- The guard `G1` is in the suite, or its absence is a recorded decision with a reason.

## Out of scope

- `worklog/**` — the journal, per the allow-list.
- The consumer project `safe-resets`, which holds its own repository and its own report.
- The package's public API: a name in `src/size-table.js`'s re-export list is frozen by
  `test/api.test.js` and does not change.
- The parts of the frozen layer named in the allow-list, until N21 is decided.

## Open questions

- **The default locale.** `DEFAULT_CONFIG.locale` is `'ru'`, so a project with no settings gets
  a Russian report and a fresh install prints Russian. Making the package English by default
  means changing a default — a behaviour change, so it is a decision rather than a step: S1 owns
  it, the options and their price are `BLOCKERS.md` N19.
- **The frozen layer.** `tools/synthetic/**` writes the fixture's note and subjects, and the
  fixtures are compared byte for byte; so a translated generator re-takes both references
  (`artifact.sha256`, `golden.json`, the manifests and the `README.md` of each fixture). Options
  and price: `BLOCKERS.md` N21.
- **Releases.** A portion that changes a shipped literal changes the package's bytes. Release a
  PATCH per portion, or batch the releases and say so in the commits: `BLOCKERS.md` N20.
- **The `--json` contract carries Russian of its own.** Measured 2026-09-16 while planning S1: the
  skip words of `src/history.js` (`SKIP_WORDS`: `только таблица` 49 times and `без изменения
  объёма` 5 times inside `fixtures/parity/data.json`, twice in `fixtures/synthetic/golden.json`)
  are part of the frozen contract, and `test/parity.test.js` compares `--json` byte for byte with
  the synthetic reference. So S4's skip reasons are the one place where a translation moves a
  reference already — the options are `BLOCKERS.md` N24, and the decision belongs with N21
  (may the frozen layer move). S1's own claim of an untouched reference is checked in
  `surface.md` and holds: neither reference carries the help, the causes or the mode texts.

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
| The `ru` sides of the dictionaries in `src/locales.js` and `src/metrics.js` | A locale is **data**: it is the Russian interface of the report, and deleting it deletes a feature. Its counterpart `en` is the target of every other string. `src/metrics.js` holds a dictionary of its own (the metric notes, methods and the degradation wordings) picked by `cfg.locale`, measured while planning S3. |
| The Russian comment at `src/metrics.js:61-63` | Prose rather than a literal: a comment, left by the prose pass, out of this work's scope by definition. Recorded in `TODO.md` so that the next prose pass finds it (`measurement.md`, S3). |
| `fixtures/**` | Frozen references: `pnpm run check:standards` re-takes them and compares byte for byte, and `test/frozen.test.js` holds their hashes. Inventories: the consumer's `history.bundle` (2 270 lines of the tool's own output, frozen in September), `fixtures/parity/data.json` (214), `fixtures/*/config.json` (`title`, `heading`, column labels — the sample data being measured), `fixtures/*/golden.json` (commit subjects of the synthetic history) and the fixtures' `README.md` (written by the generator, compared byte for byte). Touching any of them means re-taking both references — and that price is not paid: **`BLOCKERS.md` N21 was decided 2026-09-16, the references stay Russian.** |
| The builders that write the frozen layer | `tools/synthetic/note.js` 37, `content.js` 31, `history.js` 20 and the instrument lines that write into a reference (`tools/parity-freeze.js:98-118` 16, `tools/make-fixture.js:56,57,64` 3) — **107 lines**. The reference's text is the reference's data: a translated builder changes the bytes `pnpm run check:standards` compares, so this row is part of N21's decision rather than a second one. |
| The `ru` interface's own values in the draft, and a term (`templates/size-report.config.json` 2, `eslint.metrics.config.js:30` 1) | 3 lines. The draft's `title`/`heading` are **the same string** as `src/locales.js:8`'s `heading` (measured), so they are the locale's words placed in a file a person copies: translating them gives a `locale: "ru"` project a page titled in English while the rest of that page stays Russian (the mixing N25 records). `отложено` is a **term the linter matches** rather than a message — translating it stops the sensor seeing the marker (behaviour, not wording). Named by D1 (`configs.md`), and neither is a new question. |
| `SKIP_WORDS` (`src/history.js:18`) | 1 line, part of the frozen `--json`: **N24 was decided 2026-09-16 — the three words stay Russian** (`BLOCKERS.md`), on the ground that the references stay Russian and that editing `src/history.js` would change behaviour rather than a literal. The decision is reversible and its price is recorded there. |
| Russian sample data (`docs/заметки.md`, subjects, file names, labels) | It is what the measurement is measured **on**: the traps of the synthetic fixture exist to prove that a non-ASCII path, a quoted subject and an HTML-escaped signature survive. |
| Quotes of old output in records (`BLOCKERS.md`, the archived plans, `worklog/`) | A record of what a reader saw then is true of then; `BLOCKERS.md` states the rule in its own header. |
| `docs/plans/2026-09-16-i18n-english/**` | A subplan quotes the strings it translates and carries the counter's own pattern; without the quotation a reader cannot see what is meant, and, with the language guard withdrawn (below), this folder simply joins the allowance. |

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
| `AGENTS.md`, `BLOCKERS.md`, `README.md` | 3 | 21 | quotations of printed Russian, allowed by the allow-list (re-measured 2026-09-16 after S1's step 4: **21 — `BLOCKERS.md` 18, `README.md` 3, `AGENTS.md` 0**; the row said 10, then 18 with `README.md` 4). **Measured while planning C3 and confirmed by doing it: `README.md`'s four were not all quotations** — the code-2 row is parsed by `readmeCauses()` and compared with `CONFIG_CAUSES`, so it is a contract, and S1's step 3 moved it in English (one line less, and the cell fell from 18 to 22 only because `BLOCKERS.md` grew by five quotation lines in the decisions N21–N27). The other three move with S4's `!` note and S5's hook subject |
| `docs/size-report.html` | 1 | 349 | generated; turns English with the source of its texts, not by hand |

Of these 2 396 lines only **10 are comments** (`src/` 3, `tools/` 6, `test/` 1 — leftovers of the
prose pass); the rest are string literals, test names and YAML/markdown comments. The measurement
that separates them:

```bash
rg -c '^\s*(//|\*|/\*).*\p{Cyrillic}' <file>
```

## The map: one subplan per subsystem

`T0` is this file. `S*` — the published runtime, `W*` — the repository's instruments, `C*` — the
checks, `D*` — the declarative files. The fifth letter, `G*` — the guard that was to hold the
allowance — is withdrawn (below), so the map closes with `D1`. Sums are the measured lines above.

| # | Subplan | Owns | Lines | Status |
|---|---|---|---|---|
| T0 | `plan.md` | this tracker: the map, the allow-list, the criterion, the order | — | **written 2026-09-16** |
| S1 | `surface.md` | `src/refusal.js` (46), `src/args.js` (26), `src/cli.js` (4), `src/modes.js` (13) — the help, the cause registry, the CLI refusals and what the modes print; `src/locales.js` (45) is named there as staying Russian (**default locale** = `BLOCKERS.md` N19, not decided) | 89 | **done 2026-09-16** — steps 1–4 landed (`c0df1fb` the help, `cb64f12` the grammar's messages, `a7c869b` the cause registry, `230640e` what the modes print; the four files read 0 Cyrillic). **The wash-up is deferred, not dropped** (`BLOCKERS.md` N28): its counter half holds, while narrowing `ADVICE_LINE` waits for S2, S3, S4 and S5 and belongs to W1's step 8 |
| S2 | `settings.md` | `src/config.js` (35), `src/project.js` (4), `src/init.js` (18) — what a settings file says when it is wrong, and what `--init` prints; follows S1's cause names and advice markers, and owns `outsideFix`, which S4 prints | 57 | **done 2026-09-16** — all four steps landed and the wash-up met: `src/config.js` 34 → 0 (`ea6b743`, six catalogue cases), `src/init.js` 18 → 0 with `tools/refusals.js` 78 → 77 (the `config already exists` case moved with the text), `src/project.js` 4 → 0 with its three readers, and step 4 recorded **empty** by measurement (the cause arguments were already English after S1's step 3). The counter over the three files answers nothing; `ADVICE_LINE`'s tolerance stays for S3–S5 (**N28**) |
| S3 | `measurement.md` | `src/metrics.js` (20), `src/minify.js` (4), `src/strip.js` (1), `src/strip/guard.js` (6), `src/parse.js` (1), `src/optional.js` (1) — the sensor note, the two refusals of the measurement, the internal errors; **18 of the 33 lines are in scope**, 12 are the `ru` dictionary of `src/metrics.js` and 1 is a comment (`TODO.md`) | 18 | **in progress 2026-09-16** — steps 1–2 landed (step 1: `src/metrics.js` 20 → 16, `src/optional.js` 1 → 0, the `приближение вместо точного счёта` case and the patterns of `test/minify.test.js`/`test/tokens.test.js`; step 2: `src/minify.js` 4 → 1, `src/strip/guard.js` 6 → 1, `src/parse.js` 1 → 0, the two refusal cases and four patterns). Step 3 (the four internal errors) and the wash-up remain; the wash-up's own expectation was corrected by measurement (**15**, not 13 — the comment is three lines) |
| S4 | `diagnostics.md` | `src/git.js` (3), `src/history.js` (12), `src/check.js` (12), `src/doctor.js` (33), `src/explain.js` (24) — `check`, `explain`, `doctor`, the git boundary and the skip reasons. **`SKIP_WORDS` (`src/history.js:18`) is the only frozen literal of the runtime** — and **N24 was decided 2026-09-16: it stays Russian** (`BLOCKERS.md`), so its gated step becomes a named exception and the three words join the allow-list; everything else lands green without touching a reference | 84 (83 free + 1 allowed) | **written 2026-09-16** |
| S5 | `automation.md` | `src/hook.js` (40), `src/page/panel.js` (3), `bin/postinstall.js` (2) — the installed hook's text and its commit subject, the panel's service words. The panel's three strings are **not localized** (`BLOCKERS.md` N25): a report whose `locale` is `ru` gets English chrome, and this project's own report is such a report | 45 | **written 2026-09-16** |
| W1 | `tools.md` | the 11 instruments: `tools/refusals.js` (169), `parity-live.js` (35), `parity-freeze.js` (31), `run-tests.js` (25), `pack-check.js` (21), `check-standards.js` (21), `make-fixture.js` (17), `harness.js` (13), `yaml.js` (10), `docs-facts.js` (4), `page-harness.js` (3) — **no hole in this owner**: every file under `tools/**` belongs to W1 or W2, and `gate-probe.js`/`gates/common.js` carry no Cyrillic (measured). It also inherited the fixture builders on 2026-09-16 (below): `tools/synthetic/repo.js:74`, one internal error written into no file, while the folder's other 88 lines are allow-listed by N21. The catalogue's `must` phrases and cause names are **not** W1's (the owner of the printed text); `manifestNote` and the fixture config values stay Russian — **19 lines**, allow-listed by N21's decision, so 330 are this owner's own (measured); the numbers' decimal comma is `BLOCKERS.md` N26 | 331 (19 allowed) | **written 2026-09-16** |
| W2 | `sensors.md` | `tools/gates/**` (77: `run.js` 21, `dup.js` 20, `coverage.js` 18, `gatefiles.js` 7, `metrics.js` 6, `deps.js` 5, `common.js` 0), the `why` of every entry in `tools/suites.js` (38), `.githooks/**` (4) and the two baselines' `note` the sensors write (2) — **121 holds by measurement, and every commit of this owner is a gate-file commit: `Gate-Change:` trailer required**. Seven verdicts are read word for word by the sensors' own probes (`test/gates-*.test.js`), so each moves with its assertion | 121 | **written 2026-09-16** |
| C1 | `tests-page.md` | the checks of the page and the contract (355 lines, confirmed file by file): `page-view` 72, `page-choice` 67, `module` 66, `page-tree` 55, `contract-data` 51, `contract-derived` 18, `guard` 11, `runner` 11, `api` 4. **The first owner whose lines are read by two other subplans at once**, and one of those reads is `assert.equal(/стриппер/.test(res.stderr), false, …)` — a *negative* match that stops checking, green, the moment S3's sentence changes; `test/module.test.js:163` is a reader of the internal error that S3's plan counted as unread (corrected in `measurement.md`) | 355 | **written 2026-09-16** |
| C2 | `tests-cli.md` | the checks that drive the tool (739 lines): `hook` 113, `check` 84, `doctor` 83, `cli` 79, `minify` 75, `disk` 68, `tokens` 54, `release` 41, `templates` 33, `cli-paths` 31, `refusals-catalog` 26, `refusals` 25, `environment` 18, `crlf` 9 | 739 | not started |
| C3 | `tests-guards.md` | the checks of the repository itself (226 lines, confirmed file by file): `gates-verify` 26, `gates-files` 26, `docs-commands` 23, `gates-metrics` 22, `suites` 16, `parity` 16, `frozen` 16, `gates-coverage` 16, `docs-pin` 14, `gates-dup` 13, `git-pins` 12, `docs-numbers` 12, `gates-deps` 8, `docs-paths` 6. **Six of them are gate files** (111 lines) and those commits carry the trailer; the eight assertion lines W2's steps move with their verdicts; **no negative match in this owner** (measured); one kept tolerance (`требовани|requirements?`, dead in the tree) named as an exception of the allow-list; and the finding that `README.md`'s code table is a contract parsed by `readmeCauses()`, not a quotation | 226 | **written 2026-09-16** |
| D1 | `configs.md` | `.github/workflows/**` (78), `templates/**` (35), `package.json` `description` (1), the declarative dotfiles (17: `.dependency-cruiser.cjs` 7, `eslint.metrics.config.js` 6, `.gitignore` 4) — the declarative files and what the registry shows. Measured while planning it: **131 gross = 127 this owner's own + 3 allow-listed (the draft's two values, the debt term) + 1 English comment**; four of its files are gate files, so **six of its commits carry the `Gate-Change:` trailer**; six workflow step names are read as literals by `test/release.test.js`, and the `verify` job key is a branch-protection contract outside the tree | 127 | **written 2026-09-16** |

**G1 is withdrawn — decided 2026-09-16 by the mission agent.** The guard that was to redden on a new
Russian literal outside the allow-list is not written, and the reason is that the question it asked has
stopped being live: the instruction this work follows says English everywhere but the chat, so Cyrillic
arriving in new code or documentation is a near-impossibility rather than a risk to watch. What holds
the allowance instead is the work's own acceptance — the counter per file, before and after, quoted in
each subplan and each journal entry — and the allow-list above as a recorded enumeration. **The price is
named:** a stray Russian literal added later is caught by a person running the counter rather than by
the suite, and a future reader finds the enumeration in this file rather than in a failing check.
`BLOCKERS.md` N27 holds the decision and its reversibility. The measurements taken for the design are
kept there too, so that a later hand does not have to take them again: a counter over `git ls-files`
with the pattern `\p{Cyrillic}` (no Cyrillic in the pattern itself) runs in **3.0 s** over the tree,
**122 files** carry Cyrillic outside `worklog/**` today, and such a check would be a test file whose
declaration `test/suites.test.js` demands in `tools/suites.js` — a gate file, hence a `Gate-Change:`
trailer.

`AGENTS.md`, `BLOCKERS.md`, `README.md` and the built report are not a subplan of their own: the
first three hold allowed quotations of printed output (re-measured 2026-09-16 after S1's step 4: 21
lines, `BLOCKERS.md` 18 and `README.md` 3 — the row above said 10, then 18, then 22), and the report is
regenerated by whichever subplan changes the texts it is built from (S1 first, since it owns the
dictionaries).

### Map correction — measured 2026-09-16 while planning S5

The map's own total (2 396) is its first reading; the split below is today's, and it is exact.
The instrument (unchanged) now answers **5 512 lines** outside `worklog/**`, against the 5 385 of
the map above; this folder's own subplans and the notes they added to `BLOCKERS.md` are the growth.
Two files the map did not name, found by grouping the instrument's own output:

- **`.githooks/**`** (4 lines: `pre-commit` 2, `pre-push` 2) — the hooks that run the profiles;
they are **gate files** (`tools/gates/gatefiles.js`), so they belong to W2 and need the trailer.
- **The declarative dotfiles** (17 lines: `.dependency-cruiser.cjs` 7, `eslint.metrics.config.js` 6,
  `.gitignore` 4) and **the two baselines' `note`** (2 lines, written by `tools/gates/dup.js:128`
  and `tools/gates/coverage.js:81`, so W2's) — D1 and W2 respectively. The first two of the
  dotfiles are gate files.

With those two corrected the map is **complete** and the sum is exact: the instrument's 5 512 lines
split into the allow-list — the frozen layer 2 602, the archived plans 15, `docs/plans/**` 165, the
builders that write a reference 107 → **2 889** (re-measured 2026-09-16, when N21 was decided) — and
everything else → **2 623**, held by the map's owners: `src/**` 351, `bin/**` 2, `tools/**` 368,
`tools/gates/**` 77, `tools/synthetic/**` 1, `test/**` 1 320, `templates/**` 35,
`.github/**` 78, `.githooks/**` 4, the declarative dotfiles and the baselines' `note` 19,
`package.json` 1, the allowed quotations 18, the built report 349 (2 623 = 5 512 − 2 889). Every
line the instrument names has an owner, and the rows above are gross of the 58 allow-listed
dictionary lines inside `src/**`.

### Re-measured 2026-09-16, after S1's step 4 (the work, point 5)

The instrument over `git ls-files` answers **13 024 lines**, of which `worklog/**` is 7 569, so the
tree outside the journal is **5 455** — the reading taken after S1's step 4 and before this section's
own text, which adds a few lines every time it is rewritten. The map's own reading was 5 512, the
first re-measurement 5 474 and then 5 480: the subplans written meanwhile add to `docs/plans/**`, the
runtime steps take out of `src/**`, `test/**` and the catalogue, and this section's own text is part
of the last figure. That is why what follows is measured per bucket of one reading rather than
subtracted. Measured per bucket: the allow-list — the frozen layer `fixtures/**` 2 602, the archive
15, `docs/plans/**` **282** (the row above says 165, which was its reading before the subplans
existed), the builders that write a reference 107 → **3 006** — and everything else → **2 449**:
`src/**` 261, `bin/**` 2, the `tools/**` instruments 306, `tools/gates/**` 77,
`tools/synthetic/**` 1 (the folder's 89 less the builders' 88), `test/**` 1 312, `templates/**` 35,
`.github/**` 78, `.githooks/**` 4, the dotfiles with the two baselines' `note` 19, `package.json` 1,
the allowed quotations **21**, the built report 349 — the same 349 the plan recorded, because no
step touches the dictionary the page is built from. The 19 lines of the two instrument ranges are
counted inside `tools/**`, not twice.

What the work's own acceptance measures — the counter per file, before and after each step, quoted in
every journal entry — reads like this so far: `src/refusal.js` 46 → 11 → **0** (`c0df1fb` the help,
this commit the registry), `src/args.js` 26 → 14 → **0** (`cb64f12` the messages, this commit the
causes), `src/config.js` 35 → 34, `tools/refusals.js` 149 → 94, `README.md` 4 → 3,
`test/cli.test.js` 79 → 76, `src/cli.js` 4 → **0** and `src/modes.js` 13 → **0** (step 4, with the
summary's shape kept: `: N rows × M files`) — **149 lines out of the eight**, while the live catalogue
of refusals (`test/refusals.test.js`, one run per case) is green after each step and
`test/refusals-catalog.test.js` counts every refusal site, so no cause was renamed in one file alone.
The artifact is untouched by all of it, measured rather than assumed: `docs/size-report.html` hashes to
`dbcb24d1f7be373d8b9099d718a21dbdc4a840d4dc7c9f08a2efd228745ba5a4` before and after step 4 (the page
is built from the `ru` dictionary, not from the CLI's own lines), and `fixtures/**` is clean through
every step (`git diff --stat -- fixtures` empty; the parity reference's
`artifact.sha256` = `1bdb27e14bac2036f96e50fa5ec6623f7f37faeea4e45b6f91c54e6bc3ba59cd` for
`docs/size-table.html`, and `check:standards` reproduces both).

### What is left, measured 2026-09-16

The only row left is unwritten; everything else on the map is written — S1–S5 293 net of the
dictionary lines, W1 331, W2 121, C1 355, C2 739, C3 226 (1 320: the whole of `test/**`) and D1 127.
The numbers are the counter's, not a subtraction: the map's rows sum **exactly** to the instrument's
reading — `src/**` 351 (of which the allow-listed dictionaries 57, one comment of 3 and `SKIP_WORDS` 1),
`bin/**` 2, the `tools/**` family 452 (W1 331 + W2 121), `test/**` 1 320 (C1 355 + C2 739 + C3 226),
D1 131 (of which 127 are this owner's — 3 allowed values and 1 comment), the allowed quotations 18, the
built report 349 — and with the allow-list (the frozen layer 2 602 + `docs/plans/**` 165 + the archive
15 + the builders 107 = 2 889) the sum is 5 512, today's reading.

**Nothing is left to write.** The last row, `G1`, is withdrawn (`BLOCKERS.md` N27), so every row of the
map is written and point 4 of the work is complete. The two tolerances that would have
been named to G1 — W1's `commandsAt` and C3's `требовани|requirements?` resolver — are named in the
allow-list above instead.

**The order has been respected, and is now decided once.** The table's row order has been followed
without skipping a row: T0, S1, S2, S3, S4, S5, W1, W2, C1. The one place where this file contradicted
itself — the **Order** section below grouped D1 with W1 in step 2 while the table listed D1 after W3 —
is settled in that section, which now follows the table's row order and names its reasons. It was the
third place where the map's own two readings differed from the measurement (the twelfth instrument
became eleven, and `.githooks/**` with the dotfiles had no row); all three are corrected by
measurement, and this one by a decision written down rather than left to the reader.

**A fourth correction, 2026-09-16, decided rather than measured:** N21's answer left the fixture
builders with one line of their own, so **W3 is folded into W1** and the map no longer promises a
subplan for a single internal error. The measurement behind it is in `BLOCKERS.md` N21 (107 lines
allow-listed, one left) and the fold is recorded here, in the W1 row and in `tools.md`.

## Order — decided once, 2026-09-16; the table above is the only authority

1. **S1 → S5** (the published runtime) — the reader who installs the package is the reason the
   work exists, and the texts of `src/` are what the generated report and the templates quote.
2. **W1 → W2** — the instruments, then the sensors: they print to a developer and to CI, and
   nothing else depends on their wording; W2's commits carry the `Gate-Change:` trailer.
3. **C1 → C3** — the checks last of the code: after the runtime, because a message that repeats
   the printed text has to match it, and because a translation of a message is proven by the run
   of the check that carries it.
4. **D1** — the declarative files (the workflows, the templates, `package.json`, the dotfiles):
   they speak to CI and to a registry rather than to a person, four of them are gate files, and
   they are the last of the non-test files whose text a check reads — measured while planning it,
   **six** workflow step names are read as literals (`test/release.test.js:62,66,101,114,127,132`),
   and they move with D1's own commits (the rule: a reader inside another owner's file follows the
   text, so the order cannot break it).
5. ~~**W3** — the fixture builders.~~ **Folded into W1 on 2026-09-16**, by the mission agent's
   instruction and confirmed by measurement: after N21 this owner was one line
   (`tools/synthetic/repo.js:74`),which is no portion. W1's row
grew by that line, and the map has one row fewer.
6. ~~**G1** — the guard that closes the allowance.~~ **Withdrawn 2026-09-16** (`BLOCKERS.md` N27): the
alternative to a guard is the counter run by a person per portion, which is what the acceptance of
every subplan already asks for.

Nothing in this order is a prerequisite in substance: S*, W*, C* and D1 do not import each other's
texts — a line that reads another owner's text moves with that text, not with the file it stands in.
The order is a choice (the reader who pays is first), not a dependency, and from here on the row
order of the table above is what a portion follows.

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
  `package.json`, the workflows, the hooks, the baselines, the sensor configs. W2 meets it as a matter
  of course, and `configs.md` (D1) meets it in six of its commits; for the others, needing it means the plan is wrong.
- **Release per portion** — a string that ships changes the tarball's bytes, so
  `AGENTS.md`'s rule applies: a PATCH release, a journal section and the pin in `README.md`.
  Whether to release per subplan or to batch is a question for the mission agent
  (`BLOCKERS.md` N20).
- **The `post-commit` hook** rebuilds and commits `docs/size-report.html` by itself; a portion
  therefore ends with two commits, and the second one is expected rather than a defect.

## Definition of done

- `rg -lP '[\p{Cyrillic}]'` over the tree names **only** the allow-list:  `worklog/**`, the `ru` dictionary, `fixtures/**`, the builders that write them, the Russian sample data of the fixtures and the quoted old output of
  `BLOCKERS.md` and the archived plans. The measurement is quoted per subplan, before and after,
  with the file list.
- Every subplan's own acceptance holds, and `pnpm run verify:fast` is green after every commit and
  `pnpm run verify` before the portion is pushed.
- A literal that a test matched on is proven by the test still reddening where it should: the
  subplan quotes the run that would have caught a mistake (a reversed `assert`, a missing cause).
- The guard `G1` is in the suite, or its absence is a recorded decision with a reason — which is the
  case: withdrawn 2026-09-16 (`BLOCKERS.md` N27), with the counter per portion named as what holds the
  allowance instead.

## Out of scope

- `worklog/**` — the journal, per the allow-list.
- The consumer project `safe-resets`, which holds its own repository and its own report.
- The package's public API: a name in `src/size-table.js`'s re-export list is frozen by
  `test/api.test.js` and does not change.
- The frozen layer, the builders that write it and the Russian sample data of the fixtures — allow-listed,
  `BLOCKERS.md` N21 decided 2026-09-16.

## Open questions

- **The default locale.** `DEFAULT_CONFIG.locale` is `'ru'`, so a project with no settings gets
  a Russian report and a fresh install prints Russian. Making the package English by default
  means changing a default — a behaviour change, so it is a decision rather than a step: S1 owns
  it, the options and their price are `BLOCKERS.md` N19.
- ~~**The frozen layer.**~~ **Decided 2026-09-16: it stays Russian** (`BLOCKERS.md` N21, option 1), and
  the 107 lines that write it — `tools/synthetic/note.js`/`content.js`/`history.js` and the two
  instrument ranges — are in the allow-list with it. The decision is what made W3 a one-line owner, and that
  line has since been folded into W1 (see the order section).
- **Releases.** A portion that changes a shipped literal changes the package's bytes. Release a
  PATCH per portion, or batch the releases and say so in the commits: `BLOCKERS.md` N20.
- **The numbers stay Russian while the words turn English.** `tools/run-tests.js:43,64` and
  `tools/gates/run.js:111,114` (W2) format a duration with a decimal comma made by code, so a
  translated profile would print "total 12,2 s". A comma is formatting rather than a literal, and
  this work changes literals only: options and price are `BLOCKERS.md` N26, owned by W1's step 3.
- **The panel's chrome is not localized.** `src/page/panel.js:9-11` holds three Russian strings
  hardcoded while every other caption of the page is picked by `cfg.locale`, so translating them
  gives a `locale: "ru"` report English chrome. Options and price: `BLOCKERS.md` N25, owned by S5's
  step 6.
- **The `--json` contract carries Russian of its own.** Measured 2026-09-16 while planning S1: the
  skip words of `src/history.js` (`SKIP_WORDS`: `только таблица` 49 times and `без изменения
  объёма` 5 times inside `fixtures/parity/data.json`, twice in `fixtures/synthetic/golden.json`)
  are part of the frozen contract, and `test/parity.test.js` compares `--json` byte for byte with
  the synthetic reference. So S4's skip reasons are the one place where a translation moves a
  reference already — the options are `BLOCKERS.md` N24, and  the decision belongs with N21
  (may the frozen layer move) — and **decided 2026-09-16: the three words stay Russian and are named as
  an exception** (`BLOCKERS.md` N24), on the same ground as N21: the references stay Russian, and
  editing `src/history.js` would change behaviour rather than a literal. No reference moves, S4's
  gated step becomes a named exception, and the decision is reversible at a recorded price. S1's own claim of an untouched reference is checked in
  `surface.md` and holds: neither reference carries the help, the causes or the mode texts.

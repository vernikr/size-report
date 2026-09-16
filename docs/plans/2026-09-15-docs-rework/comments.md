# Subplan: comments in the sources

Parent: `plan.md`. Scope: comments in `src/**`, `bin/**`, `tools/**`, `test/**`,
`.githooks/*`, `eslint*.js`, `.dependency-cruiser.cjs`. Not scope: user-facing strings
(`src/locales.js`, refusal texts, sensor verdicts, assertion messages), markdown, fixtures.

## The rule

A comment says only what cannot be derived from the file it sits in. It answers *why this
way and not the obvious one*, or records the failure that happened without it, or names the
measurement a threshold came from, or states the invariant a caller must hold. What the code
beside it already says is deleted — even when the sentence is good.

Therefore, in the rewrite:

- **Deleted:** narration of the next line, restatement of a function name, examples the tests
  already hold, `WORKLOG.md` §-references that a reader cannot open from here, and the story
  of a long-finished pass ("was X, now Y") when only the resulting invariant matters.
- **Kept:** the reason for a non-obvious choice, the defect class the code defends against,
  the reason a threshold has this value, the pointer to the test that guards the invariant.
- **One idea per sentence.** The house style is short paragraphs of reasoning, not prose
  essays; a nine-line comment that says one thing becomes one line.

## Procedure, per file

1. **Date the claim.** `git log -1 --format='%h %ad %s' -L <from>,<to>:<file>` — or `git
   blame` for a single line. The date says which portion of work wrote it and whether it is a
   statement about today's tree or about a revision of the past.
2. **Check it is still true** — read the current code, run the thing, ask the gate. A comment
   describing a state that no longer exists is **deleted, not translated**; the deletion is
   named in the worklog entry.
3. **Rewrite in English** by the rule above.
4. **Prove the file.** `pnpm run lint:strict` and `pnpm run metrics` — zero findings, and the
   report rebuilds through the hook.

## What must not change

- Identifiers, string literals, refusal causes, locale dictionaries, assertion messages.
- In `src/page/*.js` the word `import(` must not appear in a comment —
  `test/page-view.test.js` reads those sources for that literal.
- `src/refusal.js` keeps its `'Команды:'` block: it is data, read out of git history by
  `test/docs-pin.test.js`.
- **Comments only.** A chunk that cannot be done without touching code stops and reports
  itself; behaviour changes need their own proof (a red-before-green check), not a comment
  rewrite.

## Modules (imaginary, by subject of the work)

Line counts are the file totals, not the comment totals; a module fits one commit while its
comment diff stays under the commit budget, otherwise it is split by file groups.

- [x] **M1 entry** — `bin/size.js`, `bin/postinstall.js`, `src/size-table.js`, `src/cli.js`,
  `src/args.js`, `src/modes.js` (610 → 568 lines; journal entry `worklog/0071`, 2026-09-15).
- [x] **M2 texts** — `src/refusal.js`, `src/locales.js` (271 → 270; journal entry `worklog/0072`,
  2026-09-15). Comments only: the dictionaries themselves are data.
- [x] **M3a stripping and parsing** — `src/strip.js`, `src/strip/js.js`, `src/strip/forms.js`,
  `src/strip/guard.js`, `src/parse.js`, `src/parse-worker.js` (449 → 442; journal entry
  `worklog/0073`, 2026-09-15).
- [x] **M3b metrics and tokens** — `src/metrics.js`, `src/minify.js`, `src/tokens.js`,
  `src/optional.js` (442 → 446; module M3 as a whole 891 → 888; journal entry `worklog/0074`,
  2026-09-15).
- [x] **M4 history** — `src/git.js`, `src/history.js`, `src/journal.js` (525 → 519; journal
  entry `worklog/0075`, 2026-09-15).
- [x] **M5a project: derived settings** — `src/project.js`, `src/config.js`, `src/init.js`
  (614 → 604; journal entry `worklog/0076`, 2026-09-15).
- [x] **M5b project: diagnostics and coverage** — `src/doctor.js`, `src/check.js`,
  `src/explain.js` (551 → 544; module M5 as a whole 1165 → 1148; journal entry `worklog/0077`,
  2026-09-15).
- [x] **M6 report data** — `src/data.js`, `src/derived.js`, `src/artifact.js`, `src/css.js`
  (302 → 292; journal entry `worklog/0078`, 2026-09-15).
- [x] **M7a page: builder, nodes, panel, table assembly** — `src/page/app.js`, `build.js`,
  `dom.js`, `panel.js` (483 → 467; journal entry `worklog/0079`, 2026-09-15).
- [x] **M7b page: state and styles** — `src/page/state.js`, `src/page/table.js`,
  `src/page/app.css`, `src/table.css` (704 → 669; module M7 as a whole 1187 → 1136; journal entry
  `worklog/0080`, 2026-09-15).
- [x] **M8 hook and tool** — `src/hook.js`, `src/tool.js` (472 → 452; journal entry `worklog/0081`,
  2026-09-15).
- [x] **M8-fix, found outside the module** — the outdated justification ("the registry name is someone
  else's package") stood in `src/refusal.js`, `src/config.js`, `src/project.js`, `test/docs-pin.test.js`
  and, found while fixing them, `test/docs-commands.test.js`; all five now say what is true: a call by
  the name goes to the registry and runs a revision the project never pinned, while a path inside the
  project refuses on the spot, and the release link names the revision the documentation describes
  (comments only; journal entry `worklog/0082`, 2026-09-15).
- [x] **M9a tools: the shared part of the run** — `tools/harness.js`, `tools/run-tests.js`,
  `tools/suites.js`, `tools/check-standards.js` (752 → 728; journal entry `worklog/0083`,
  2026-09-15).
- [x] **M9b tools: facts, probes, refusals** — `tools/docs-facts.js`, `tools/gate-probe.js`,
  `tools/page-harness.js`, `tools/refusals.js` (742 → 737; journal entry `worklog/0084`,
  2026-09-15). The outdated registry justification turned up here a sixth time (in the catalogue,
  at the "nothing to call the tool with" advice), found by searching the tree for its wording
  after the five places of M8-fix were done.
- [x] **M9c tools: frozen and live copies** — `tools/make-fixture.js`, `tools/parity-freeze.js`,
  `tools/yaml.js` (611 → 608; journal entry `worklog/0085`, 2026-09-15). Both copies of the
  `core.quotePath=false` reasoning pointed at `harness.FROZEN`, a name that does not exist (the
  frozen copy is taken through `frozenTarget()`); both now point at what is there.
- [x] **M9d tools: live parity and the tarball** — `tools/parity-live.js`, `tools/pack-check.js`
  (419 → 417; journal entry `worklog/0087`, 2026-09-15). Both were run live after the pass: the
  report no longer promised "not a single byte of the artifact" (that comparison is gone) and the
  tarball check no longer promised exit code 2, which no path in it returns.
- [x] **M9e tools: the gates** — `tools/gates/**` (769 → 767, 7 files; journal entry
  `worklog/0088`, 2026-09-15). First gate files of the module, so the commit carries the
  `Gate-Change:` trailer with its measurement. Three claims about *where and when* these scripts are
  called turned out wrong: `gatefiles.js` does not run in CI (the range check is the `pre-push`
  hook's job, and no profile step calls it), the shared harness serves six files rather than "five
  sensors", and `dup.js` skipped its second look silently by `--no-ref` (than the ref-missing case
  alone). Two time promises went too ("≤ 90 s", "tens of seconds"), as they would age with the
  machine; the reason for the slow profile does not rest on them.
- [x] **M9f tools: the synthetic project** — `tools/synthetic/**` (405 → 403, 4 files; module M9
  as a whole 3698 → 3660; journal entry `worklog/0090`, 2026-09-15). Module M9 is closed here. Two claims fell: the artifact path was
  called a column of the settings (it is their `output`, and the ten columns are labelled paths), and
  `content.js` claimed every edit names the trap it holds (only the edits holding a trap of their own
  do). Everything else held, and the byte-compared fixture proved the data was left alone:
  `pnpm run check:standards` rebuilds the fixture from these sources and finds 4 of 4 files equal.
  Data-level staleness left alone on purpose: the note's warning branch is live but unprinted
  (`manifest.json` says `localeStable: true`), and its text names a step of a finished plan — changing
  it means re-taking the fixture, which is a decision, not a comment pass.

  The module was estimated at "three or four commits" before it was measured. A comment pass
  rewrites 60–80 % of a file's lines, and the commit budget is hard (≤ 600 changed lines, ≤ 10
  files), so the parts above are the measured split: six passes. M9e and M9f stay last, as the
  plan says.
- **M10 tests** — `test/*.test.js`: 38 files, 6221 lines. Measured before the pass: 1234 comment
  lines are in Russian (the work), 125 are already English, and 1347 non-comment lines hold Russian
  text (test names and assertion messages — data, left alone). A comment pass changes ~2.0 lines
  per Russian comment line (measured on M9e: 167 comment lines → 337 changed source lines), so the
  module is seven parts of 153–204 comment lines each (≈310–410 changed lines), 3–9 files per part:
  - [x] **M10a the report page** — `page-view` (93), `page-tree` (58), `page-choice` (53);
    204 comment lines → 397 changed lines in 3 files (journal entry `worklog/0091`, 2026-09-15).
    Two claims fell: a comment counted "148 paths of the project" while the fixture's tree holds 12
    (measured by cloning the bundle — the number belonged to this repository), and the styling
    comment spoke of "two outputs" while the report is one page carrying both sheets, the shared
    one frozen by the artifact's bytes.
  - [x] **M10b the entry, the refusal and the CLI** — `cli` 314 → 312, `cli-paths` 105 → 105,
    `refusals` 338 → 338, `refusals-catalog` 136 → 134; 181 comment lines → 360 changed lines in
    4 files (journal entry `worklog/0092`, 2026-09-15), exactly the size the split predicted. The
    catalogue re-proved the data: 27 registry sites (32 sites) and 11 "✗" marks in 5 files match it
    to the count, so no refusal site moved through any pass. Deletions: the plan-section address in
    `cli.test.js` (the codes are now named by their home, `EXIT` in the engine), the BLOCKERS and
    REFACTOR addresses in `refusals.test.js` (the four accidental finds stay as the defect class),
    and the "was X, now Y" narration in two places (what a check forbids matters, not when it was
    added).
  - [x] **M10c the disk, the module and the hook** — `hook` 413 → 414, `module` 315 → 314,
    `disk` 310 → 309; 202 comment lines → 405 changed lines in 3 files (journal entry
    `worklog/0093`, 2026-09-15). Three claims fell. The hook header explained "someone else's work
    and the index untouched" by `git commit --only`, a call the engine no longer makes: the report's
    commit is assembled with plumbing (`hash-object`/`write-tree`/`commit-tree`/`update-ref`), and
    `src/hook.js` says why `--only` was given up (it refuses during a merge). The loop protection was
    half-explained — the missing half, that plumbing calls no hooks at all, is named by `src/hook.js`
    as the reason a nested run is impossible by construction. And `disk.test.js` read
    `--diff-merges=first-parent` as the cause of the loss, while the mutation **takes that flag away**
    from the pinned git reads. Dropped: three addresses into documents this same work rewrites
    (§7.1–§7.3, step 5, `REFACTOR.md` §3) and the fixture's commit count — the substance stays as
    words.
  - [x] **M10d the measures** — `doctor` 275 → 270, `minify` 286 → 285, `check` 261 → 256,
    `guard` 75 → 72, `tokens` 195 → 196; 153 comment lines → 295 changed lines in 5 files (journal
    entry `worklog/0094`, 2026-09-15). Four claims fell. `tokens` attributed its anchor ("`hello
    world`" = 2) to the tiktoken documentation, which states no such count — the phrase appears there
    only in a decode/encode round-trip, so the anchor is now named as hand-written (verified against the
    dictionary: 2 in both encodings, 5 versus 7 for the Russian string). `guard` justified its coarse
    threshold with "86–97 ms per parse, ~26 s for 300", re-measured at 70.6 ms and 21.7 s — the figures
    had drifted while the threshold does not depend on them, so only orders of magnitude stay. `minify`
    named three extensions as the minifier's whole answer while the engine's `MINIFY_LOADERS` also holds
    `.cjs`/`.ts`/`.mts`/`.cts`. `doctor` promised the coverage block "byte for byte" equal to `size
    check` while the check compares parsed data. Dropped: three `REFACTOR.md` §3 addresses and the
    "budget of time" formula (no run in this project promises seconds), plus "taken from the code's
    side" narration in `check`. Measured and kept: `3294a69` is the fixture's root commit and it added
    `README.md` (16 commits, matching `rep.history.commits`); both frozen fixtures were taken under
    ballast removal (no `minify` key); `.json` is the only exact strategy; the coverage kind is picked
    by the refusal's code and `WEIGHT` puts coverage ahead of a sensor.
  - [x] **M10e the documentation guards and the release** — `docs-commands` 183 → 177,
    `release` 141 → 137, `templates` 166 → 162, `changelog` 123 → 125, `docs-numbers` 53 → 52,
    `docs-pin` 63 → 61, `docs-paths` 66 → 65; 192 comment lines → 370 changed lines in 7 files
    (journal entry `worklog/0095`, 2026-09-15). Three claims fell. The guards numbered their promises
    from a six-promise list that no longer exists — "first" in `docs-paths`, "fourth" in
    `docs-numbers`, "fifth" in `docs-pin`, "sixth" in `changelog`, while `docs-commands` listed four
    inside itself and the README speaks of one promise per file (calling the changelog guard the
    fifth); the ordinals are gone and each promise is named in words. `docs-commands` named
    `WORKLOG.md` among the documents it does not check for calls — a file that left the root with the
    journal, and one that is not in the path-checked set at all. And `templates` carried two addresses
    into `REFACTOR.md` (R-4.21), which this same work rewrites. One duplicate rule was folded into
    one place (`docs-numbers`). Also measured: the comment pass broke the size sensor — one arrow
    function in `templates` reached 61 lines against a limit of 60, because comment lines inside a
    function count towards its length; fixed by compressing the comments (61 → 57), not by touching the
    threshold.
  - [x] **M10f the probes of the gates** — `gates-metrics` 152 → 148, `gates-verify` 164 → 161,
    `suites` 79 → 77, `gates-files` 117 → 116, `gates-dup` 87 → 89, `gates-coverage` 86 → 85,
    `gates-deps` 61 → 61 (plus `tools/gates/dup.js` 205 → 209, where a claim proved false — the two
    files grew because the measured correction needs more words than the false short one); 153 comment
    lines → 313 changed lines in 8 files (journal entry `worklog/0096`, 2026-09-15). Correcting the plan
    itself: **six of the seven are gate files** (`test/gates-*.test.js` matches, `test/suites.test.js`
    does not — the gate list holds `tools/suites.js`), which changes nothing practically since the
    trailer is needed anyway. Measured, and the reason the pass was worth it: `tools/gates/dup.js` and
    `gates-dup` both claimed that jscpd's own `--baseline` is bound to the checkout path. **It is not**
    for the pinned 5.2.0: a baseline jscpd wrote keeps the same tree green in another directory
    (`--fail-on-new-clones=0`, exit 0), survives renames and shifted lines, and reddens on a genuinely
    new copy — measured on a toy tree and on the package's whole tree (11 fingerprints). What produces
    "every clone is new" is handing jscpd the project's own `dup-baseline.json`: it answers `missing
    field version` and exits 1, which is probably what the old measurement ("15 new clones", and the
    project's baseline holds 15 fingerprints) actually observed. Both comments now say what is true
    (the project's file is what `gatefiles` guards, carries a schema and a note, and is what the gate's
    counters speak about), and the question of whether the own fingerprint is still needed at all is
    recorded as note **N15** in `BLOCKERS.md` — a user's decision, not this pass's. Also removed: two
    "was X, now Y" stretches and one stale count ("a graph of eight dozen modules" — the sensor reports
    well over a hundred), and one future tense that had already happened (the required check `verify`
    is required, not about to become it).
  - [x] **M10g the contracts and the frozen copies** — `contract-data` 187 → 185, `frozen` 90 → 87,
    `git-pins` 87 → 85, `environment` 93 → 98, `contract-derived` 135 → 135, `parity` 74 → 70,
    `runner` 37 → 35, `crlf` 46 → 45, `api` 30 → 29; 149 comment lines → 286 changed comment lines
    (journal entry `worklog/0097`, 2026-09-15). Module M10 is closed here. **The duplication sensor
    reddened on an edit that changed no code:** a clone's fingerprint is a hash of its fragment text,
    and the two checks in `environment.test.js` shared a window holding one of the rewritten comments,
    so the old fingerprint no longer matched and a new one appeared. Measured on two copies of the tree
    (origin/main's comments against the new ones: 11 clones either way, one fingerprint different), and
    no comment edit can mend it — hence the sensor's own advice, `вынести общее`: the shared read became
    one `quotePath(args, env)` helper, the duplication is gone (11 → 10 clones), and behaviour, test
    names and assertion messages are untouched. Claims dropped: the `REFACTOR.md` R-1.5 and R-3.4
    addresses in `frozen`, and in `runner` the address `WORKLOG.md` §21 — which was also **wrong**: §21
    of the archived journal is about CI, and the split-symbol failure is not recorded there at all.
    Checked by measurement and kept: the frozen copy really does write a static table (`--write` run by
    hand: `<style>` present, no `<script>` and no `id="data"`), which is why `parity` compares no
    artifact bytes; the copy is run under `core.quotePath=false` (`frozenTarget`), which is what "the
    copy has no fix for B1" means; `check:standards` re-takes both standards **with that copy**
    (`make-fixture` and `parity-freeze` both call `legacyTool`); and one format only is exact — measured
    from the contract, `package.json` is exact while every other format is measured by stripping,
    because the fixture asks for no minifier (the default engine is `strip`), so the list of extensions
    the old comment gave was both incomplete and beside its own reason.
- [x] **M11 shell and configs** — `.githooks/commit-msg` 7 → 7, `.githooks/post-commit` 18 → 18,
  `.githooks/pre-commit` 25 → 23, `.githooks/pre-push` 16 → 17, `eslint.config.js` 89 → 87,
  `eslint.metrics.config.js` 241 → 245, `.dependency-cruiser.cjs` 71 → 73; 128 Russian comment lines →
  259 changed lines (journal entry `worklog/0098`, 2026-09-15). **The subplan is closed here.** All
  seven files are gate files, so the commit carries the `Gate-Change:` trailer with its measurement.
  The three known defects are fixed: the metrics header now names the ratchet
  `.eslint-suppressions.json` **and says why the dot matters** (a flagless ESLint run reads the
  undotted default location beside its own config, and stale entries there fail that run with code 2),
  the threshold table is dated by `worklog/archive/WORKLOG.md` §58.3 — the section that really holds it
  and a document this work does not rewrite — instead of the root `WORKLOG.md` §14 (a file that no
  longer exists, and a section about the shared harness and test speed). Claims deleted as false, each
  measured: `pre-push` promised that CI checks the `Gate-Change:` trailer over the range, while CI runs
  the profile and no step of it reads trailers (checked in all three workflows) — the range check lives
  in that hook alone; the linter header explained the `fixtures/` exclusion by "the frozen copy of the
  old implementation" lying there, but that copy left the tree for the history in `d36c88f` (the
  directory holds data: bundles and taken standards); the metrics header promised that every rejected
  rule was rejected for a measured reason, naming `sonarjs/no-duplicate-string` **twice** and
  `sonarjs/no-nested-template-literals` beside it, while the archive (§58.8) lists only the first and
  the second reports nothing anywhere in the tree today (measured: 42 findings for the first, 0 for the
  second); the same header quoted a function-length distribution (p50 7 / p90 27 / p99 73 / max 118,
  "14 functions above 60") that belongs to the tree of that measurement — today the longest function is
  58 lines and nothing is above the threshold (measured with the rule at `max: 0` over `src bin tools
  test`: 1537 functions) — so the figures now name their source and their date rather than the present
  tense; and `max-statements-per-line` was justified by "39 findings on a clean tree" while it reports
  82 today, so the count is gone and the reason (it cuts the accepted style, and does not catch the
  gluing anyway) stays. Kept as measured: `git` passes a hook `GIT_INDEX_FILE` (`.git/index`, or a
  temporary `next-index-*.lock` for a commit named by paths) and `GIT_PREFIX` (the subdirectory) —
  re-measured on 2.50.1, which is why `pre-commit` drops them; the page's shared globals are exactly
  the ones the chapters declare and set. Judgement call, named: the `comment` of every
  dependency-cruiser rule and the `messages` of the local rules stay Russian — the sensor prints them
  as its verdict (`tools/gates/deps.js` puts the rule comment into `reports/deps.json`), and verdicts
  and other printed strings are out of scope.

- [ ] **Leftover, found 2026-09-16 by pass M17 of `markdown.md`:** a re-scan of comment lines holding
  Cyrillic over `src bin tools test` finds **22 lines of Russian prose in five files the modules above
  had declared done** — `src/parse.js` 39, 40, 42 (M3a); `tools/docs-facts.js` 28–30, 35 (M9b, touched
  again by M7 of `markdown.md`); `tools/parity-freeze.js` 91–92 (M9c); `tools/refusals.js` 204–205,
  230–231, 278–279, 289, 299, 303–304, 326–327 (M9b); `test/minify.test.js` 268 (M10d). They are prose
  rather than data — two of them quote the tool's printed advice, and inside a sentence — so they were
  in scope. Cost: one pass over five files (22 comment lines, ≈90 changed source lines), no code.

Order within a module: the file a reader opens first (entry, then what it calls), so the
diffs read in the same order as the code.

## Definition of done, per chunk

- The module's comments are English and pass the rule above; code, strings and structure
  unchanged apart from whitespace.
- `pnpm run verify:fast` green; `wc -l` per file recorded before/after in the worklog entry,
  together with the list of claims deleted as stale.
- One commit per chunk, `refactor(comments): <module>` (or `test(comments)` for M10),
  with the portion's journal entry in `worklog/NNNN-*.md` written the same turn.

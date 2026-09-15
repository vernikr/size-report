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
- [ ] **M10 tests** — `test/*.test.js` (6221; four or five commits).
- [ ] **M11 shell and configs** — `.githooks/*`, `eslint.config.js`,
  `eslint.metrics.config.js`, `.dependency-cruiser.cjs` (~500). Known defect to fix here, found
  during M9e: `eslint.metrics.config.js` (line 5) names the ratchet `eslint-suppressions.json` —
  without the leading dot, that is, the very name the strict formatting linter picks up by default
  (measured on ESLint 9.39.5: the file beside a config is read with no flag, and unused entries
  fail the run with code 2). The baseline itself is `.eslint-suppressions.json`.

Order within a module: the file a reader opens first (entry, then what it calls), so the
diffs read in the same order as the code.

## Definition of done, per chunk

- The module's comments are English and pass the rule above; code, strings and structure
  unchanged apart from whitespace.
- `pnpm run verify:fast` green; `wc -l` per file recorded before/after in the worklog entry,
  together with the list of claims deleted as stale.
- One commit per chunk, `refactor(comments): <module>` (or `test(comments)` for M10),
  with the portion's journal entry in `worklog/NNNN-*.md` written the same turn.

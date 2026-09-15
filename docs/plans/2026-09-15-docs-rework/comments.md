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
- [ ] **M2 texts** — `src/refusal.js`, `src/locales.js` (271). Comments only: the
  dictionaries themselves are data.
- [ ] **M3 measures** — `src/metrics.js`, `src/minify.js`, `src/tokens.js`, `src/optional.js`,
  `src/strip.js`, `src/strip/js.js`, `src/strip/forms.js`, `src/strip/guard.js`,
  `src/parse.js`, `src/parse-worker.js` (891).
- [ ] **M4 history** — `src/git.js`, `src/history.js`, `src/journal.js` (525).
- [ ] **M5 project** — `src/project.js`, `src/config.js`, `src/init.js`, `src/doctor.js`,
  `src/check.js`, `src/explain.js` (1165; two commits).
- [ ] **M6 report data** — `src/data.js`, `src/derived.js`, `src/artifact.js`, `src/css.js`
  (302).
- [ ] **M7 page** — `src/page/app.js`, `build.js`, `dom.js`, `panel.js`, `state.js`,
  `table.js`, `app.css`, `src/table.css` (940; two commits).
- [ ] **M8 hook and tool** — `src/hook.js`, `src/tool.js` (472).
- [ ] **M9 tools** — `tools/**` (3520; three or four commits, `tools/gates/**` and
  `tools/synthetic/**` last).
- [ ] **M10 tests** — `test/*.test.js` (6221; four or five commits).
- [ ] **M11 shell and configs** — `.githooks/*`, `eslint.config.js`,
  `eslint.metrics.config.js`, `.dependency-cruiser.cjs` (~500).

Order within a module: the file a reader opens first (entry, then what it calls), so the
diffs read in the same order as the code.

## Definition of done, per chunk

- The module's comments are English and pass the rule above; code, strings and structure
  unchanged apart from whitespace.
- `pnpm run verify:fast` green; `wc -l` per file recorded before/after in the worklog entry,
  together with the list of claims deleted as stale.
- One commit per chunk, `refactor(comments): <module>` (or `test(comments)` for M10),
  with the portion's journal entry in `worklog/NNNN-*.md` written the same turn.

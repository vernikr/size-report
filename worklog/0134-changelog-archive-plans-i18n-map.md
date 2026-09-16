# Russian strings: CHANGELOG.md removed, the finished plans archived, the work split by subsystem

**Requested:** (1) delete `CHANGELOG.md` — its content is already in the journal; (2) move `PLAN.md` and
`REFACTOR.md` into `plans/archive/`; (3) read the repository as a set of imaginary modules and open a folder
under `docs/plans/` for the plans of translating every Russian string constant and literal into English. Then:
one plan per portion, then one chunk of work per portion, each ending with a report to the mission agent.

**Done.**

- `CHANGELOG.md` deleted (42 KB, 690 lines), and `test/changelog.test.js` with it — the guard had no subject
  left, because it parsed that very file. The readers were edited in the same pass, or the documentation
  guards redden (`test/docs-paths.test.js` demands that what a document names exists and that every file of
  the tree is named in the README table): `README.md` (the release section, the file table, the guard's row,
  three places of prose), `AGENTS.md` (the release item), the comment of `release.yml`, `package.json`
  (`files`), `tools/docs-facts.js` (the list of documents and the list of paths a document may name although
  the tree has none — `test/changelog.test.js` joined it, because the archived plans cite it and that is true
  of them) and `tools/suites.js` (the file's row in the fast set). The check counts in `README.md` were
  re-measured: **72 of 177 → 70 of 175** (test files 38 → 37).
- `PLAN.md` and `REFACTOR.md` moved to `plans/archive/` (`git mv`, history kept). Their readers were updated:
  `tools/docs-facts.js` (`DOCS` and `TARGETS` — the guards read those files by path, while a section address
  written in prose resolves by **basename**, so every citation of `PLAN.md`/`REFACTOR.md` still resolves) and
  `README.md` (the file table and three places of prose). `test/cli.test.js` names `PLAN.md` in a message
  string only — untouched.
- The folder `docs/plans/2026-09-16-i18n-english/` was opened with the tracker `plan.md`: the goal, the
  allow-list (what stays Russian and why), the measurement, the map of subsystems into subplans, the order,
  the shared rules, the definition of done and the questions for a decision. `TODO.md` was opened at the root
  (for defects noticed in passing) together with its row in the README table.
- `BLOCKERS.md` gained notes **N19–N23**: the `ru` default locale as a decision, re-taking both references if
  the fixture builders are translated, the cadence of releases, the release guard that left with
  `CHANGELOG.md`, and the plans' move with its readers.

**The measurement the map rests on (2026-09-16).** The instrument:

```bash
git ls-files | rg -v '^worklog/' | while read -r f; do
  n=$(rg -cP '[\p{Cyrillic}]' "$f" 2>/dev/null); [ -n "$n" ] && printf '%6d %s\n' "$n" "$f"
done | sort -rn
```

The tree holds **5 385 lines in 110 files**. Of them the frozen layer `fixtures/` is 2 602 lines in 9 files
(`history.bundle` alone 2 270), the built report `docs/size-report.html` 349, the archived plans 15
(`REFACTOR.md`; `PLAN.md` is already free of Cyrillic). The work itself is **2 396 lines**: `src/**` 351 in 24
files, `bin/**` 2, the instruments `tools/**` 387 in 12 files, the sensors `tools/gates/**` 77, the fixture
builders `tools/synthetic/**` 89, the checks `test/**` 1 320 in 37 files, `templates/**` 35,
`.github/workflows/**` 78, the manifest's `description` 1, and 10 lines of quoted old output in
`AGENTS.md`/`BLOCKERS.md`/`README.md`. Only **10** of those lines are comments (3 in `src/`, 6 in `tools/`,
1 in `test/`); the rest are string literals, check names and YAML/Markdown comments.

**Not done:** not one line of code in substance — only the values of reference literals in documents and in the
guards' lists; no threshold, baseline or rule touched; no release (see below).

**Checks:** `pnpm run verify:fast` green (5 steps, 70 checks) after every edit, and `pnpm run verify` green
whole (8 steps, including `check:standards` — both references reproduce — and `pack:check` — the tarball works
after `CHANGELOG.md` left `files`).

**Release and push.** Nothing was pushed: the `AGENTS.md` release item asks for a tag, and the cadence of
releases is left to a person — **N20**. One commit of this portion changes `files` in the manifest, that is,
what the tarball carries, so without that decision there is nothing to release; the changes are committed
locally only. The `Gate-Change:` trailer is present: `package.json`, `tools/suites.js` and
`.github/workflows/release.yml` were touched.

**Offered next:** the first subplan, `surface.md` (S1) — the help, the registry of refusal causes, the CLI
refusals and the locale dictionaries, together with the decision about the default language (N19).

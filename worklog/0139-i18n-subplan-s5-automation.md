# The string work: subplan S5 (the automation) planned, and the tracker's map completed

**Requested:** the next subplan of the map — S5, the last one of the published runtime
(`docs/plans/2026-09-16-i18n-english/automation.md`), by the owner of the files: the installed
hook's text and its commit subject, the panel's chrome, the post-install note. Same rules as
S1–S4, plus: readers named including the machine ones and the absences, "red first" experiments,
the rule that keeps the tree green between commits, terminology checked against S1's dictionary
with foreign ownership marked, acceptance by the existing sensors. Tracker update and this entry
included. N19 and N24 left open.

**Done.** `automation.md` written; the tracker's S5 row marked **written 2026-09-16**; the map
**corrected and completed**; `BLOCKERS.md` given **N25**.

**The scope, measured:** `src/hook.js` 40, `src/page/panel.js` 3, `bin/postinstall.js` 2 — 45
lines, the tracker's number. The plan names them in six groups rather than as a batch, because only
four of them are read by anything.

**The hook's own body is the part that leaves the repository.** `script()` writes four lines into
`.git/hooks/post-commit` and `post-merge` of a consumer project: the mark plus three comments. The
mark is a **machine token** (`MARK = '# size-report: hook'`): `isOurs()` and
`test/hook.test.js:136` find the tool's own file by `indexOf('size-report')`, and `uninstallHook`
deletes by it. So the token survives and only the words change — the plan's step 1 is a one-file
commit whose "red first" is deleting the token and watching `:136` go red.

**Four machine-read groups, each landing with its reader.** The subject is compared **exactly**
(`test/hook.test.js:191`, `:254`), and `README.md:792` quotes it in prose; the state record's
`why` is read by `:295` (`/CI/`), `:308` (`/hooks\.enabled/`) and `:323` (`/HEAD отделён/`); the
answer to a repeated `install-hook` by `:151` (`/установлен/`); the catalogue in
`tools/refusals.js` quotes the three refusals word for word and requires the `починка: ` marker,
which step 3 moves to S1's `fix: ` in the same commit. The plan checks the counts that must **not**
move: four `refuseCause('…')` sites in the file and `PRINTED['src/hook.js'] = 4` — the four `'✗ `
literals measured at 392, 395, 418 and 425.

**Three literals have no reader at all, and that is measured, not assumed:** the hook file's three
comments (the only thing read out of that file is the mark), the panel's three strings (no test, no
document; `test/parity.test.js:47` reads a built report but asserts only `src="`, `<link `,
`id="data"`, `<style>`), and the post-install note (no grep hit in `tools/pack-check.js`,
`tools/gates/**` or `test/**`). The frozen layer is clean for this layer too:
`rg -c 'хук|hook' fixtures/*` answers nothing, and `fixtures/parity/artifact.sha256` is taken by
the frozen copy (`legacyTool()`), which keeps printing Russian.

**Foreign ownership, named in both directions.** The three hook causes and the group name `хук` are
S1's step 3 — S1 renames every cause of `CONFIG_CAUSES` with its sites in one commit, `src/hook.js`
among them, so by the time S5 runs they are already English and S5 does not revisit them. The words
`src/doctor.js:217-218` prints for the hook's `result` are S4's, the keys are S5's; the help line
for `hook-run` is S1's; `tools/refusals.js` is W1's, edited in step 3 for the four hook cases only;
`test/hook.test.js`'s own Russian is C2's, and S5 touches in it **only** the four lines that read an
S5 literal (151, 191, 254, 323). `README.md:768` quotes the cause names — S1's rename again.

**The map was incomplete, and the instrument says so.** Grouping the counter's own output found two
owners that had no row: **`.githooks/**`** (4 lines: `pre-commit` 2, `pre-push` 2 — the hooks that
run the profiles, and **gate files**, so W2's, with the trailer) and the **declarative dotfiles**
(`.dependency-cruiser.cjs` 7, `eslint.metrics.config.js` 6, `.gitignore` 4 — D1's, the first two of
them gate files) plus the **baselines' `note`** (2 lines, written by `tools/gates/dup.js:128` and
`tools/gates/coverage.js:81`, so W2's). With those rows corrected the map is complete and the sum is
exact: 2 782 (allow-list: frozen 2 602, archived plans 15, `docs/plans/**` 165) + 2 730 (everything
else) = **5 512**, today's reading of the instrument, of which `BLOCKERS.md` 14 and `README.md` 4
are the allowed quotations (the row said 10). The correction is written into `plan.md`.

**N25 — the panel's three strings are not localized.** `src/page/panel.js:9-11` holds them as
literals while every other caption of the page is picked by `cfg.locale`, and the map puts the file
in S5. The consequence is visible rather than theoretical: a `locale: "ru"` project (both fixture
configs, and this repository) keeps a Russian report and gets English chrome inside it — and this
project's own tracked `docs/size-report.html` is such a report. Options and price in `BLOCKERS.md`
(translate / move them into the dictionaries, a source change out of this work's scope / name them
in the allow-list), the subplan plans the first and notes that steps 1–5 do not depend on the
answer.

**Checks:** `pnpm run verify:fast` green. The plan, the tracker and the notes are not in the
tarball, so there is no release — said in the commit. No code, no test and no gate file touched.

**Offered next:** the first instrument subplan (W1 — `tools/refusals.js`, the reference takings, the
harness, the pack check), or the first chunk of work under a written plan (S1's help and cause
registry, which unblocks the transition the other subplans wait on).

# Wiring it into your project

The instruction was walked through command by command in a fresh project (the protocol is in
`worklog/archive/WORKLOG.md` §54): below are exactly the commands that work today. What does **not** work
today is named here too, with its reason, so that nobody has to find it out by trying.

What is needed: **a git repository with history** — at least one commit, because the table is built from
commits (a repository with none ends in an internal error today: `BLOCKERS.md` §N16) — and
**Node ≥ 20.19** (`engines` of the package).

### 1. Installation

```bash
pnpm add -D @vernikr/size-report
```

The package is **published in the registry**, and publicly: `npm view @vernikr/size-report version`
answers the same version the manifest names, `npm access get status @vernikr/size-report` says `public`,
and an anonymous request for the tarball is a 200. `npm i -D` and `yarn add -D` take the same name; no key
and no link to the repository are needed.

With no network (or nothing to fetch from codeload) — the tarball: `pnpm pack` in the package clone, then
`pnpm add -D ./vernikr-size-report-<version>.tgz`, where the name is the one `pnpm pack` printed.

The package repository is **public** (it was private until 2026-09-14), and that is exactly what makes the
installation simple: no developer key and no CI step with access. Checked by a run in an empty project
where git had neither global settings nor a credential helper (`GIT_CONFIG_GLOBAL=/dev/null
GIT_CONFIG_SYSTEM=/dev/null GIT_SSH_COMMAND=false`): `size --write` and `size` work there
(`worklog/archive/WORKLOG.md` §44). The earlier requirement was the price of privacy: a key locally and a
read-only deploy key before `pnpm install` in CI (that first wiring, `worklog/archive/WORKLOG.md` §18);
the template's key step went away together with the privacy. The publication to npm happened on
2026-09-15, and it had a price: the name `size-report` in the registry is taken by someone else's package
(2017, three versions), so the release was also a renaming into the owner's scope (`@vernikr/size-report`)
rather than just an upload of an archive; what the renaming touched — `plans/archive/PLAN.md` §10, what proves the
publication — `worklog/archive/WORKLOG.md` §53.

### 2. Settings: you need not create them

```bash
pnpm exec size --write     # the table; no settings — the tool derives them itself
pnpm exec size --init      # pin what it derived into size-table.config.json
```

There is no need to start with settings: without a file the tool derives them from the project — the
columns are **every tracked file git can measure** (the report names the volume of the project rather than
of a sample of it, and the only limits are what cannot be a column at all: the report itself, dependency
locks, built output, an unknown format and a file above 512 KB), while everything else is named in `skip`;
the journal is the first familiar one (`WORKLOG.md`, `CHANGELOG.md`, …); the report file is
`docs/size-report.html` (the directory is created by the writer); the fix command is the declared `sizes`
script, or the path to the installed package without one (the report's signature and the refusals quote it,
so it has to work right here and now); the commit link comes from the `origin` address; the metrics are
`raw`, `min` and `tok`. The `min` metric is counted by real compression here (`"minify": {"engine":
"esbuild"}`), and `tok` by a dictionary (`"tokens": {"family": "openai", "encoding": "o200k_base"}`):
without those optional dependencies the metric honestly falls back to another count and the run returns
code 4 — no settings need editing for that either.

Everything that cannot be a column (the report itself, dependency locks, maps, built output, an unknown
format, a file too large) and everything git does not track is named in `skip` — which is why the first
`size check` is complete rather than red: "paths past the columns" appear from new edits, not from a
project that has not been described yet. That the settings were derived, the tool says in a line on stderr
and names the command that pins them, `--init`; what is pinned passes the same check as any settings file,
and afterwards it is edited by hand (the `--init` itself prints what it pinned and what to do next — the
scripts and the CI check). Without pinning, the profile is derived anew on every run: the column set
changes from run to run (the tool says so with that very line), so repeating the same measurement — by the
hook and by the check included — is possible only from a file.

What is pinned is **the very thing the project runs on without a file**: the derivation from the project
on top of the defaults. That is why the pinned file holds values nobody wrote in the project — then a
change of the defaults in a new version of the package does not travel over an already configured project
in silence.

> `size init` as a command does not exist — `--init` is a mode: the commands are `check`, `explain`,
> `doctor` and the hook, and the full list is given by `size --help`.

### 3. What is edited in the config

The derivation knows about the project only what the tree and the history show — which columns matter is
known to a person. What is edited most often:

| Key | What it is |
|---|---|
| `columns` | the table's columns: `{label, paths: [...]}`; **a column is a file**: the list of paths is its renames (a revision takes whichever of them it holds), not several files at once; `label` is what a person will see |
| `metrics` | what a number is made of: `raw` (the size of the git object), `min` (the minified form — which one, `minify.engine` decides), `tok` (tokens), `gzip` |
| `tokens.family`, `tokens.encoding` | the dictionary for `tok`: the family (`openai`) and the encoding (`o200k_base` or `cl100k_base`) — the encoding changes the number, which is why it is both in the settings and in the metric's label |
| `minify.engine` | what counts `min`: `strip` (comments and indentation — a simplification, and the method names it as one) or `esbuild` (real compression; a format the minifier does not take counts as stripping, and the method says so) |
| `output` | the report file (in the derived profile `docs/size-report.html`; the directory is created by the writer). The path enters the report's passport — the key of the saved choice — so a changed path means a fresh choice |
| `journal` | where to look for the journal sections the rows refer to |
| `links.commitUrl` | the commit link template, for example `https://github.com/org/repo/commit/{sha}`; derived from the `origin` address for GitHub and GitLab (for other hosts — empty rather than a guess) |
| `skip` | the paths that did not become columns: both those that cannot be (the report itself, dependency locks) and those that did not fit (the derived profile declares everything else an exception — which is why the first `check` is complete) |
| `fixCommand` | the command the report's signature quotes and a refusal suggests; in the derived profile it is your `sizes` script if it is declared, and otherwise the path to the installed package inside the project (a call by package name goes to the registry — `REFACTOR.md` R-4.21) |
| `locale`, `title`, `heading` | the language of the report's texts and its headings; empty `title`/`heading` mean "take them from the locale" |
| `minify.guard` | the extensions whose stripper output is checked by parsing; a module in `.js` the guard understands by itself, and there is nothing to touch there |
| `hooks.enabled` | the switch of the self-updating hook (`false` — the hook is not installed by itself and keeps quiet if it is already there; it is removed only by `size uninstall-hook`) |

The other keys and defaults are in `src/config.js` (`DEFAULT_CONFIG`).

### 4. Scripts and the first report

```jsonc
// package.json
"scripts": { "sizes": "size --write", "test:sizes": "size" }
```

```bash
pnpm run sizes            # → docs/size-report.html — the report: the table, the filters, the link
```

The report is one self-contained file: it opens with a double click, with no server and no network (it
holds no external references at all — the data, the styling and the program are pasted in). What is
derived (the deltas, the totals, the filters) is counted by the page itself — from the absolute values the
engine gives, and by the same code as the engine's own calculation.

**The order of edits:** code → `pnpm run sizes` → a commit with the table alone. The table is updated in a
**commit of its own**, because a commit cannot have a row inside itself: update it together with the code
and the tool warns (the text is quoted as the tool prints it: `! the table was updated together with the code: <sha>`)
and names the commit that dropped out.
The `size` check rebuilds the table and compares it with the file on disk, so it catches a forgotten
rebuild too. Dropping the report from git altogether is possible as well: the completeness check exists
for that, and `templates/ci.yml` says which step to put in its place when the report is not in git.

### 5. The check in CI and before a commit

```bash
pnpm run test:sizes       # 0 — the table agrees with the history
pnpm exec size check      # 0 — not one change went past the columns
pnpm exec size doctor     # 0 — nothing to do; otherwise the first code by importance
```

`size check` answers a different question than the `size` command itself: that one says "the table agrees
with the history", while this one says "the whole history is counted": every path the commits touched has
to be either a column or a declared exception (`skip` and the report file itself), otherwise it is **code
1** with the list of paths, the commit that introduced the path and a fix command. The report need not lie
in git for that — completeness is exactly the check that replaces "artifact ↔ history". When a single
commit is in doubt, `pnpm exec size explain <commit>` explains why it has no row: the report alone was
touched, the numbers did not move, the commit went past the columns, or a merge is hidden by a setting —
with evidence and a fix where there is one. The commit may be named the way git names it: `HEAD`,
`HEAD~1`, a branch or a tag, a full sha or its beginning. If the name leads to a commit outside the
report's history (another branch), the tool says exactly that and names its sha — rather than "no such
commit".

`size doctor` gathers all the diagnostics into one answer: the environment and its influence on the numbers
(the machine's settings do not influence them — the engine pins them at the call's border), the state of
the optional dependencies and what it means for the count, the validity of the settings and the completeness
of the coverage. It answers with the same pieces as the other commands: the coverage block is exactly the
answer of `size check` rather than a second calculation. The exit code is the first by importance rather
than "something was found": `2` the settings are unreadable (there is nothing else to read), `3` the
history is cut short, `1` the coverage is incomplete, `4` a sensor counted another way, `0` nothing to do. A
sensor the settings are silent about is named unneeded rather than missing, and it is not loaded: the
dictionary weighs megabytes, and there is nothing to pay with for an answer the numbers never needed.

The completeness check is deliberately **not** in the template CI (`templates/ci.yml`): the columns there
are an example, and in a project whose columns are not chosen yet such a check would be red for no reason.
Once the columns describe the project, it is added in one line (`pnpm exec size check`).

The ready line for CI: `pnpm run test:sizes` — nothing else is needed: the check *is* the `size` command,
and a consumer has no test suite of its own to install. The `--init` prompt says the same: the check is a
command of the package and brings no files of its own into the project.

The package also ships a ready description of that check: `templates/ci.yml` from the package
(`node_modules/@vernikr/size-report/templates/ci.yml`) goes to `.github/workflows/size-report.yml` without
edits — the table rebuilt and compared with the file on disk, two snapshots of the numbers (a plain one
and one in an environment without the machine's git settings) and their comparison. It needs no secrets.
For `npm`/`yarn` the file itself says which two lines to replace. Next to it is
`templates/size-report.config.json`, a sample of settings: its columns are examples (`README.md`,
`package.json`) that nearly any project has, so the first report is built at once. It is needed only to
start from an edited file: with no file the settings are derived from the project (`--init` pins the
derived ones), and the sample is copied to the project root as `size-table.config.json`.

The package's own CI is `.github/workflows/ci.yml`: it runs at home the same list of checks as a local run
(one command, `pnpm run verify`, whose list lives in `tools/gates/run.js`), while what a consumer's CI is
put together from are the templates above.

| Code | What happened | What to do |
|---|---|---|
| 0 | everything agrees | nothing |
| 1 | the table diverged from the history (or an edit on disk is not committed); for `size check` — a path of the history is neither tracked nor excluded | `pnpm run sizes` and commit the table; for `check` — add the path as a column or to `skip` |
| 2 | something in the call or in the project — the causes are quoted as the tool prints them: **command line** (unknown flag, flag without a value, repeated flag, two modes at once, extra word, command and mode, unknown command, incompatible flag, no JSON answer, two answers at once, no commit); **settings and the project** (no settings file, settings not parsed, settings invalid, git missing, not a git repository, config already exists); **history** (no such commit, ambiguous commit, commit outside the history); **hook** (foreign hook, foreign core.hooksPath, no way to invoke the tool); **measurement** (file is not JavaScript, minifier did not parse) | the refusal text names the reason and a ready command — and it is executable: `test/refusals.test.js` guards that |
| 3 | a shallow history (a clone with `--depth`) | a full clone: `git fetch --unshallow` |
| 4 | no sensor | `minify.engine: "esbuild"` with no minifier: the numbers are stripped rather than minified. The report is built, and its text carries the reason and the fix; if the table also diverges from the history, the code stays **1** (a mismatch outranks the sensor note) while the note about the other count is printed next to it |
| 5 | an internal error | this is a defect of the tool: we are the ones who need the text — see "Traps worth testing the engine on" in `docs/architecture.md` |

The cell of code 2 quotes the tool rather than describing it: those are the names of the refusal registry
(`CONFIG_CAUSES` in `src/refusal.js`), and the documentation guard compares this table with it word by
word — which is why that one cell speaks the language of the command line, while the report's own texts
are translated by the `locale` key.

### 6. The report updates itself after a commit

```bash
pnpm exec size install-hook     # install post-commit and post-merge
pnpm exec size uninstall-hook   # remove them and return the project to its previous behaviour
```

The hooks install themselves, and that is the only thing a project notices about installing the package:
after `npm i` by an install script, with pnpm 10 by the tool's first run (pnpm does not run dependency
scripts — "Ignored build scripts"; it can be allowed with `pnpm.onlyBuiltDependencies:
["@vernikr/size-report"]` in your manifest). The files land in `.git`, `git status` does not see them, and the
command above takes them away. It installs only where that is safe — an ordinary hooks directory, no hook of
someone else's, something to call the tool with — and stays silent where it is not. After every commit and
merge the report is rebuilt: the `docs` directory and `size-report.html` are created if they are not there
yet, and a report **tracked** by git lands as a commit of its own signed `chore(report): report rebuilt
after <sha>` (the signature is quoted as the hook writes it, like every other line of the tool's output in
this document). Only the report's path is committed: the tree comes from HEAD with that one path replaced, so
neither someone's index nor uncommitted work can enter the commit.

The first report is the exception: while the report is untracked the hook rebuilds it and says so in words
instead of committing — adding a new file to someone else's history is a person's decision. One `git add
docs/size-report.html` (or a plain `git add -A` if the report belongs in the project) and from then on it
travels by commits itself. A merge is the same case as an ordinary commit, with one correction to what git
does: the merge commit is made by git itself and does not run `post-commit`, hence the second file,
`post-merge` (checked on git 2.50).

There is no looping, and by construction rather than by a flag: the report's commit is assembled with
plumbing (`commit-tree` calls no hooks at all), and the report itself gets no row, so the same rebuild yields
the same bytes. A refusal by the tool does not bring the commit down — the commit has been made already: the
cause is printed as one line and remembered, and `pnpm exec size doctor` shows what the hook did and how the
last run ended. The automation is switched off in two ways — `"hooks": {"enabled": false}` in the settings
(the hook stays but keeps quiet) or `size uninstall-hook` — while in an environment where updating is not
wanted at all (CI, someone else's machine) the hook keeps quiet by itself: the hook file lies in `.git`
rather than in git, so every clone has one of its own, and the body checks whether there is anything to call
the tool with. `SIZE_REPORT_NO_HOOK` is the lever for one who would rather not edit the settings.

### 7. Traps found by this very instruction

Two of them were found by the walkthrough and are closed already — they are kept here as an explanation of
behaviour rather than as workarounds:

- **A module in a `.js` extension** (`import`/`export` in `.js` is ordinary in projects with a bundler) is
  measured like any other file, with `type: module` in the manifest or without it: the guard parses the
  result both as a script and as a module. It used to try the script alone and fell with code 5 on the
  `export` itself, blaming the stripper; that is impossible today and no settings need editing
  (`REFACTOR.md` R-4.6).
- **Not JavaScript in a column** (markup or types straight in `.js`) is code 2 and a refusal naming the
  reason and what to fix. The reason comes from the way the file was counted: with `minify.engine:
  "esbuild"` the refusal names the minifier and its **one** way out (a simplification for that extension in
  `minify.ext` — the `strip` way would hand the same file to the guard, whose verdict would be the same),
  while with stripping it is the guard's refusal and **two** ways out (take the extension out of
  `minify.guard`, or set `minify.ext`). Neither looks like a stack.
- **No minifier** (an installation without the optional dependencies, a platform without `esbuild`) — the
  metric honestly falls back to stripping: the numbers are the same as `strip`, the label says so in words,
  and a **build** (`--write`) returns **code 4** with a ready fix. A **check** answers in two parts in that
  case, and it is named here because it is what CI advises: if the report on disk was built with the real
  minifier while the run goes without it, the numbers were counted another way — the numbers in the table
  no longer agree with the history, so the check says as much (**code 1**), showing the diverged signature
  row and **naming the other count right there** in a note with a ready fix. The verdict stays with the
  divergence: code 4 would claim the difference is explained by the sensor, and nobody checked that — the
  divergence may also be an edit that went past the report (the same order as `size check` and `doctor`: a
  mismatch outranks the sensor note). The fix in both cases is `pnpm run sizes`; on this environment it returns
  **code 4**. This can be checked without reinstalling by the `SIZE_REPORT_NO_OPTIONAL=1` environment — the
  same way `test/minify.test.js` does it.
- **The module parse is one worker raised once per a run** (`REFACTOR.md` R-5.4): the fallback to
  `node --check` (a Node run per cell) remains for when the worker's file is not in the package, the worker
  does not answer, or the Node build has no vm modules; and the worker is raised only if the measured files
  hold modules at all. The measured price of both is in `REFACTOR.md` R-5.4 rather than promised in numbers
  here.
- **A new column file has to be committed** before the run: the table is built from commits, so a file git
  does not track has nothing to measure and its column stays empty. The run itself does not complain — the
  file is named by the settings rather than by the project — it is the numbers that would be missing in
  silence. So `git add` + commit first, then `pnpm run sizes`.
- **An edit to the journal is an edit too.** A commit that touched the journal or any column file gets a row
  in the table, so the table is rebuilt after it — otherwise the check says "diverged from the git history"
  and names the row. An uncommitted edit does not move the table ("now" comes from the commit), so a
  rebuild is not broken by documentation being edited next to it.
- **`--init` does not edit `.gitignore`** (`REFACTOR.md` R-4.8) — add the report by hand if it has no place
  in the history.

Not on words: the section was walked through command by command in a fresh repository, and the findings are
in `worklog/archive/WORKLOG.md` §16. What keeps it true is the documentation guard (`REFACTOR.md` R-4.1):
paths, the file table, the calls and flags of the instructions and references to sections
are checked by machine. **No time target is declared anywhere** — seconds depend on the
window, so there is nothing to check against (`tools/suites.js` says why). Wording, meaning and promises
about the future are not checked by machine; a person holds those.

### 8. If a copy of the tool is already in the project

The order above is for a project wiring the tool in for the first time. When a copy is already there (its
own `size-table.js` and its tests), the steps go in another order; below is the one `safe-resets` migrated
by (`worklog/archive/WORKLOG.md` §18):

1. **Install without removing the copy** — two implementations live side by side for a while, and that
   gives a free comparison on one tree: the package's command with the project's config has to assemble the
   same artifact byte for byte (for `safe-resets` — 225 673 B, sha256 `1bdb27e1…`, and both are frozen in
   the parity reference, `fixtures/parity/manifest.json`). No match — do not go further.
2. **Move the project's commands to the package:** `"test:sizes": "size"`, `"sizes": "size --write"`.
3. **Remove the copy** — the tool and its test alike: the package's suite checks the same claims, and one
   command stays in the project. If the test was called from a shared runner, the runner's step becomes a
   single one calling the package's command rather than the project's file (in `safe-resets` the path comes
   from the installed package's manifest, so the step knows no internal file names).
4. **Take the deleted files' columns out of the settings** and rebuild the artifact in a **commit of its
   own**: commits that touched only those files move no number without them, and such commits get no rows.
5. **Clean the project's documentation:** references to the tool's files are replaced by the package's name
   and its commands, while a description of the internals (the stripper, reading the history in batches,
   the assembly) moves from the project's docs into the package's — otherwise there are two copies and they
   will drift apart.

No access to the package is needed either locally or in CI — the repository is public (§1), so there is no
key step in this order.

What is lost: the checks that compared the project's settings with the tool's expectations no longer run as
a suite of their own. Most of them are covered by the command itself (an unknown flag or an unfamiliar
metric in the config is a refusal with an explanation; the report file cannot be a column), but the
_content of the signature_ (the heading and the fix command taken from the config) is checked by nobody: if
that matters, it is one check on top of `--data` in the project.

## For an AI agent

- `pnpm run verify:fast` before every edit, `pnpm run verify` before pushing; what is wrong and what
  must not be touched when a sensor is red — `AGENTS.md`.
- `size check --json` — whether everything is in: how much of the history is covered, which paths went
  past the columns (with the commit that introduced them) and which commits dropped out without a row.
- `size explain <commit> --json` — why one commit has no row: the reason, the files it touched (columns,
  excluded, untracked) and a ready fix. The commit is named by a revision (`HEAD`, a branch, a tag), by a
  full sha or by its beginning.
- The data without the markup — the rows, the numbers, the totals — is `--json` (the earlier form, frozen
  byte for byte by the parity reference) and `--data` (the contract: absolute values and the shape of the
  table, with nothing derived — whatever the page can count itself is not there; the page's own block is the
  same data in sparse form). A `size measure` command does not exist yet.
- `--json` is a form of answer rather than a mode of its own, and it has one rule: exactly four calls have
  an answer. With no command it is the earlier form of the data (frozen by the parity reference), and for
  `check`, `explain` and `doctor` it is their answer. For a command with no answer, and next to a mode
  (`--write`, `--data`, `--init`), it is a refusal rather than silence: asking for JSON where there is none
  is an error of the call.
- `size doctor --json` — all the diagnostics in one answer: the environment, the dependencies, the
  settings, the coverage and findings with their level (`action` — to be done, `note` — to be known).
- Exit codes: `0` all is well · `1` a mismatch with the history or incomplete coverage · `2` the settings,
  the environment, an unknown or extra word, two modes at once · `3` a shallow history · `4` no sensor ·
  `5` an internal error. They work already: a refusal is a code and one line with a ready fix, with no
  stack. `--help` prints both.
- There are two runs, and both are named: `pnpm test` is the fast one (every edit), `pnpm test:all` the
  full one (a release and CI); what is in which and why is in `tools/suites.js`, while the numbers and the
  durations are printed by the run itself.
- Arguments are parsed once, on the way in and before the project is read: either one mode or a refusal
  naming both; a command and a mode do not work together; a flag with no value and a flag named twice are
  such refusals too. So a call the tool did not understand cannot be confused with a healthy run: instead
  of zero comes code 2 and a ready command.

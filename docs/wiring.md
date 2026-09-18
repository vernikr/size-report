# Wiring it into your project

Walked through command by command in a fresh project: below are the commands that work today, and what
does **not** work today is named with its reason, so that nobody finds it out by trying.

Needed: **a git repository with history** — at least one commit, because the table is built from
commits (a repository with none ends in an internal error today: `BLOCKERS.md` §N16) — and
**Node ≥ 20.19** (the package's `engines`).

### 1. Installation

```bash
pnpm add -D @vernikr/size-report
```

The package is published in the registry and publicly: no key, no link to the repository, no CI step
with access. `npm i -D` and `yarn add -D` take the same name. With no network (or nothing to fetch from
codeload) — the tarball: `pnpm pack` in the package clone, then
`pnpm add -D ./vernikr-size-report-<version>.tgz`.

### 2. Settings: you need not create them

```bash
pnpm exec size --write     # the table; no settings — the tool derives them itself
pnpm exec size --init      # pin what it derived into size-table.config.json
```

Without a file the tool derives the settings from the project: the columns are **every tracked file git
can measure** (the report names the volume of the project rather than of a sample of it; the limits are
what cannot be a column at all — the report itself, dependency locks, built output, an unknown format,
a file above a size limit), everything else is named in `skip`; the journal is the first familiar one
(`WORKLOG.md`, `CHANGELOG.md`, …); the report file is `docs/size-report.html`; the fix command is the
declared `sizes` script or the path to the installed package without one (the signature and the refusals
quote it, so it has to work here and now); the commit link comes from the `origin` address; the metrics
are `raw`, `min` and `tok`, counted for real — by real compression
(`"minify": {"engine": "esbuild"}`) and by a dictionary
(`"tokens": {"family": "openai", "encoding": "o200k_base"}`). Without those optional dependencies a
metric honestly falls back to another count and the run returns code 4 — no settings need editing for
that either.

That everything git does not track is named in `skip` is why the first `size check` is complete rather
than red: "paths past the columns" appear from new edits, not from a project that has not been described
yet. The tool says in a line on stderr that the settings were derived and names `--init`; what is pinned
passes the same check as any settings file and is afterwards edited by hand. Without pinning the profile
is derived anew on every run, so the column set changes from run to run and repeating a measurement —
by the hook and by the check included — is possible only from a file. What is pinned is **the very thing
the project runs on without a file**, derivation on top of the defaults: hence values nobody wrote in
the project, and a change of the defaults in a new version does not travel over an already configured
project in silence.

> `size init` as a command does not exist — `--init` is a mode: the commands are `check`, `explain`,
> `doctor` and the hook, and the full list is given by `size --help`.

### 3. What is edited in the config

The derivation knows only what the tree and the history show; which columns matter is known to a person.
Edited most often:

| Key | What it is |
|---|---|
| `columns` | the table's columns, `{label, paths: [...]}`; **a column is a file**: the list of paths is its renames (a revision takes whichever of them it holds), not several files at once |
| `metrics` | what a number is made of: `raw` (the size of the git object), `min` (the minified form — which one, `minify.engine` decides), `tok` (tokens), `gzip` |
| `tokens.family`, `tokens.encoding` | the dictionary for `tok` (`openai`, `o200k_base` or `cl100k_base`) — the encoding changes the number, which is why it is in the settings and in the metric's label |
| `minify.engine` | what counts `min`: `strip` (comments and indentation — a simplification, and the method names it as one) or `esbuild` (real compression; a format the minifier does not take counts as stripping) |
| `output` | the report file (derived: `docs/size-report.html`; the directory is created by the writer). The path is where the file is written and nothing else: the reader's choice of columns lives in his browser and does not follow the path |
| `journal` | where to look for the journal sections the rows refer to |
| `links.commitUrl` | the commit link template, e.g. `https://github.com/org/repo/commit/{sha}`; derived from the `origin` address for GitHub and GitLab (for other hosts — empty rather than a guess) |
| `skip` | the paths that did not become columns: both those that cannot be (the report itself, dependency locks) and those that did not fit |
| `fixCommand` | the command a refusal suggests and the contract hands to an agent (the page prints nothing of it); derived: your `sizes` script, or the path to the installed package inside the project |
| `locale`, `title`, `heading` | the language of the report's texts and its headings; an empty `title`/`heading` means "take them from the locale" |
| `minify.guard` | the extensions whose stripper output is checked by parsing; a module in `.js` the guard understands by itself, so there is nothing to touch there |
| `hooks.enabled` | the switch of the self-updating hook (`false` — the hook is not installed by itself and keeps quiet if it is already there; it is removed only by `size uninstall-hook`) |

The other keys and the defaults are in `src/config.js` (`DEFAULT_CONFIG`).

### 4. Scripts and the first report

```jsonc
// package.json
"scripts": { "sizes": "size --write", "test:sizes": "size" }
```

```bash
pnpm run sizes            # → docs/size-report.html — the report: the table, the filters, the link
```

The report is one self-contained file: it opens with a double click, with no server and no network. What
is derived — the deltas, the totals, the filters — is counted by the page itself, from the absolute
values the engine gives and by the same code as the engine's own calculation.

**The order of edits:** code → `pnpm run sizes` → a commit with the table alone, because a commit cannot
have a row inside itself: update it together with the code and the tool warns
(`! the table was updated together with the code: <sha>`) and names the commit that dropped out.
Dropping the report from git altogether is possible as well: the completeness check exists for that, and
the template of the CI check says which step to put in its place.

### 5. The check in CI and before a commit

```bash
pnpm run test:sizes       # 0 — the table agrees with the history
pnpm exec size check      # 0 — not one change went past the columns
pnpm exec size doctor     # 0 — nothing to do; otherwise the first code by importance
```

`size check` answers a different question than the `size` command itself: that one says "the table
agrees with the history", this one says "the whole history is counted" — every path the commits touched
has to be either a column or a declared exception (`skip` and the report file itself), otherwise it is
**code 1** with the list of paths, the commit that introduced the path and a fix command. The report
need not lie in git for that. When a single commit is in doubt, `pnpm exec size explain <commit>` says
why it has no row (the report alone was touched, the numbers did not move, the commit went past the
columns, or a merge is hidden by a setting); the commit may be named the way git names it, and a name
leading outside the report's history is said to be exactly that rather than "no such commit".

`size doctor` gathers all the diagnostics into one answer: the environment and its influence on the
numbers (the machine's settings do not influence them — the engine pins them at the call's border), the
state of the optional dependencies, the validity of the settings, and the coverage, which is exactly the
answer of `size check` rather than a second calculation. The exit code is the first by importance rather
than "something was found": `2` the settings are unreadable, `3` the history is cut short, `1` the
coverage is incomplete, `4` a sensor counted another way, `0` nothing to do. A sensor the settings are
silent about is named unneeded rather than missing, and is not loaded at all.

The completeness check is deliberately **not** in the template CI: the columns there are an example, and
in a project whose columns are not chosen yet such a check would be red for no reason. Once the columns
describe the project, it is added in one line. The ready line for CI is `pnpm run test:sizes` — nothing
else is needed: the check *is* the `size` command, and a consumer has no test suite of its own to
install.

The package ships a ready description of that check: `templates/ci.yml` from the package goes to
`.github/workflows/size-report.yml` without edits — the table rebuilt and compared with the file on
disk, two snapshots of the numbers (a plain one and one without the machine's git settings) and their
comparison; it needs no secrets, and for `npm`/`yarn` the file itself says which two lines to replace.
Next to it `templates/size-report.config.json` is a sample of settings whose columns nearly any project
has, so the first report is built at once; it is needed only to start from an edited file, and it is
copied to the project root as `size-table.config.json`.

| Code | What happened | What to do |
|---|---|---|
| 0 | everything agrees | nothing |
| 1 | the table diverged from the history (or an edit on disk is not committed); for `size check` — a path of the history is neither tracked nor excluded | `pnpm run sizes` and commit the table; for `check` — add the path as a column or to `skip` |
| 2 | something in the call or in the project — the causes are quoted as the tool prints them: **command line** (unknown flag, flag without a value, repeated flag, two modes at once, extra word, command and mode, unknown command, incompatible flag, no JSON answer, two answers at once, no commit); **settings and the project** (no settings file, settings not parsed, settings invalid, git missing, not a git repository, config already exists); **history** (no such commit, ambiguous commit, commit outside the history); **hook** (foreign hook, foreign core.hooksPath, no way to invoke the tool); **measurement** (file is not JavaScript, minifier did not parse) | the refusal text names the reason and a ready command — and it is executable: `test/refusals.test.js` guards that |
| 3 | a shallow history (a clone with `--depth`) | a full clone: `git fetch --unshallow` |
| 4 | no sensor | with `minify.engine: "esbuild"` and no minifier the numbers are stripped rather than minified: the report is built, its text carries the reason and the fix, and a check that finds a divergence says **1** while naming the other count in a note with a ready fix |
| 5 | an internal error | a defect of the tool: we are the ones who need the text |

The cell of code 2 quotes the tool rather than describing it: those are the names of the refusal
registry (`CONFIG_CAUSES` in `src/refusal.js`), and the documentation guard compares this table with it
word by word — which is why that cell speaks the language of the command line, while the report's own
texts are translated by the `locale` key.

### 6. The report updates itself after a commit

```bash
pnpm exec size install-hook     # install post-commit and post-merge
pnpm exec size uninstall-hook   # remove them and return the project to its previous behaviour
```

The hooks install themselves, and that is the only thing a project notices about installing the package:
after `npm i` by an install script, with pnpm 10 by the tool's first run (pnpm does not run dependency
scripts — "Ignored build scripts"; it can be allowed with
`pnpm.onlyBuiltDependencies: ["@vernikr/size-report"]`). The files land in `.git`, `git status` does not
see them, and the command above takes them away. It installs only where that is safe — an ordinary hooks
directory, no hook of someone else's, something to call the tool with — and stays silent where it is
not.

After every commit and merge the report is rebuilt (the directory and the file are created if they are
not there yet), and a report **tracked** by git lands as a commit of its own signed
`chore(report): report rebuilt after <sha>`. Only the report's path is committed: the tree comes from
HEAD with that one path replaced, so neither someone's index nor uncommitted work can enter the commit.
The first report is the exception: while it is untracked the hook rebuilds it and says so in words
instead of committing, since adding a new file to someone else's history is a person's decision; one
`git add docs/size-report.html` and from then on it travels by commits itself. A merge is the same case
as an ordinary commit, with one correction to what git does: the merge commit is made by git itself and
does not run `post-commit`, hence the second file, `post-merge`.

There is no looping, and by construction rather than by a flag: the report's commit is assembled with
plumbing (`commit-tree` calls no hooks at all), and the report itself gets no row, so the same rebuild
yields the same bytes. A refusal by the tool does not bring the commit down — the cause is printed as one
line and remembered, and `pnpm exec size doctor` shows what the hook did. The automation is switched off
by `"hooks": {"enabled": false}` (the hook stays but keeps quiet), by `size uninstall-hook`, or by
`SIZE_REPORT_NO_HOOK`; in an environment where updating is not wanted at all the hook keeps quiet by
itself, since the file lies in `.git` rather than in git.

### 7. Traps found by this very instruction

- **A module in a `.js` extension** (`import`/`export` in `.js` is ordinary in projects with a bundler)
  is measured like any other file, with `type: module` in the manifest or without it: the guard parses
  the result both as a script and as a module, so no settings need editing.
- **Not JavaScript in a column** (markup or types straight in `.js`) is code 2 and a refusal naming the
  reason and what to fix. With `minify.engine: "esbuild"` the refusal names the minifier and its **one**
  way out (a simplification for that extension in `minify.ext`); with stripping it is the guard's
  refusal and **two** ways out (take the extension out of `minify.guard`, or set `minify.ext`). Neither
  looks like a stack.
- **No minifier** (an installation without the optional dependencies) — the metric honestly falls back
  to stripping: the numbers are the same as `strip`, the label says so in words, and a build
  (`--write`) returns **code 4** with a ready fix. A **check** answers in two parts: if the report on
  disk was built with the real minifier while the run goes without it, the numbers differ, so the check
  says **code 1**, showing the diverged row and naming the other count right there in a note with a
  ready fix — the verdict stays with the divergence, since the difference may also be an edit that went
  past the report. The fix is `pnpm run sizes`; `SIZE_REPORT_NO_OPTIONAL` shows the same without
  reinstalling.
- **The module parse is one worker raised once per run**: the fallback to `node --check` remains for when
  the worker's file is not in the package, the worker does not answer, or the Node build has no vm
  modules.
- **A new column file has to be committed** before the run: the table is built from commits, so a file
  git does not track has nothing to measure and its column stays empty. The run does not complain — the
  file is named by the settings rather than by the project — it is the numbers that would be missing in
  silence.
- **An edit to the journal is an edit too.** A commit that touched the journal or any column file gets a
  row in the table, so the table is rebuilt after it — otherwise the check says "diverged from the git
  history" and names the row. An uncommitted edit does not move the table.
- **`--init` does not edit `.gitignore`** — add the report by hand if it has no place in the history.

The section was walked through command by command in a fresh repository, and what keeps it true is the
documentation guard: paths, calls and flags are checked by machine, and **no time target is declared
anywhere** — seconds depend on the window, so there is nothing to check against. Wording, meaning and
promises about the future are not checked by machine; a person holds those.

### 8. If a copy of the tool is already in the project

1. **Install without removing the copy** — two implementations live side by side for a while, which
   gives a free comparison on one tree: the package's command with the project's config has to assemble
   the same artifact byte for byte. No match — do not go further.
2. **Move the project's commands to the package:** `"test:sizes": "size"`, `"sizes": "size --write"`.
3. **Remove the copy** — the tool and its test alike: the package's suite checks the same claims, and
   one command stays in the project. If the test was called from a shared runner, the runner's step
   becomes a single one calling the package's command.
4. **Take the deleted files' columns out of the settings** and rebuild the artifact in a **commit of its
   own**: commits that touched only those files move no number without them, and such commits get no
   rows.
5. **Clean the project's documentation:** references to the tool's files are replaced by the package's
   name and its commands, while a description of the internals moves from the project's docs into the
   package's — otherwise there are two copies and they will drift apart.

No access to the package is needed either locally or in CI, since the repository is public (§1). What is
lost: the checks that compared the project's settings with the tool's expectations no longer run as a
suite of their own. Most of them are covered by the command itself, but the _content of the signature_
(the heading and the fix command taken from the config) is checked by nobody: if that matters, it is one
check on top of `--data` in the project.

## For an AI agent

- `pnpm run verify:fast` before every edit, `pnpm run verify` before pushing; what is wrong and what
  must not be touched when a sensor is red — `AGENTS.md`.
- `size check --json` — whether everything is in: how much of the history is covered, which paths went
  past the columns (with the commit that introduced them), which commits dropped out without a row.
- `size explain <commit> --json` — why one commit has no row: the reason, the files it touched and a
  ready fix.
- `size doctor --json` — all the diagnostics in one answer: the environment, the dependencies, the
  settings, the coverage and findings with their level (`action` — to be done, `note` — to be known).
- The data without the markup is `--json` (the earlier form, frozen byte for byte by the parity
  reference) and `--data` (the contract: absolute values and the shape of the table, with nothing
  derived). `--json` is a form of answer rather than a mode of its own: exactly four calls have an
  answer — with no command it is the earlier form of the data, and for `check`, `explain` and `doctor`
  it is theirs — and elsewhere it is a refusal rather than silence.
- Exit codes: `0` all is well · `1` a mismatch with the history or incomplete coverage · `2` the
  settings, the environment, an unknown or extra word, two modes at once · `3` a shallow history · `4`
  no sensor · `5` an internal error. A refusal is a code and one line with a ready fix, with no stack;
  `--help` prints both.
- Two runs: `pnpm test` is the fast one, `pnpm test:all` the full one; what is in which and why is in
  `tools/suites.js`, while the durations are printed by the run itself.
- Arguments are parsed once, on the way in and before the project is read: either one mode or a refusal
  naming both, and a command and a mode do not work together — so a call the tool did not understand
  cannot be confused with a healthy run.

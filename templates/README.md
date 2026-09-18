# Templates for a project wiring the tool in

Two files a project takes as they are: settings that pass the tool's own check, and a description of the CI
check. They are installed together with the package, which is why they travel in its delivery (`files` in
`package.json`) and are guarded by `test/templates.test.js`: the draft has to be valid, and the commands of
the description have to exist in the tool.

| File | Where | What to do |
|---|---|---|
| `size-report.config.json` | `size-table.config.json` in the project root | **Fix the columns** and, if needed, the rest |
| `ci.yml` | `.github/workflows/size-report.yml` | Nothing: the file works as it is |

The report appears in the project without manual work: after the package is installed and the tool runs for
the first time, it installs the hooks `post-commit`/`post-merge` itself, and `docs/size-report.html` is
created by the very first commit. To take the automation away — `size uninstall-hook`; to switch it off
without removing it — `"hooks": {"enabled": false}`.

## Settings

**A settings file is not needed.** Without one the tool derives the profile from the project itself: the
columns are every tracked file that can be measured (the report then describes the project as a whole rather
than a few of its largest files), the journal is the first familiar one (`WORKLOG.md`, `CHANGELOG.md`, …),
the report file is `docs/size-report.html`, the fix command is the declared `sizes` script, and the commit
link comes from the `origin` address. That the settings were derived the tool says in a line, and it pins
them to a file with `size --init`: from then on they are ordinary settings, edited by hand.

This sample is for another case: starting from an edited file, or seeing all the keys at once. **Its columns
are an example** rather than a list of your files: the template holds `README.md` and `package.json` because
nearly any project has them, and with them the first report is assembled at once. Your own columns come from
`size --init` (it takes them from your tree and history; documentation is included): either take its file
whole and carry over the keys the template has and it does not, or copy the template and write the columns in
by hand. The expectation grows from the same place: the columns are examples, so `size check` will name the
paths that are not columns — the project's own sources and its journal — and that is deliberate.

What is worth knowing about the template's values:

- `metrics: ["raw", "min", "tok"]` — the report's three measurements. `min` is counted by the real minifier
  (`minify.engine: "esbuild"`) and `tok` by the `o200k_base` dictionary. Both travel as optional
  dependencies of the package and are installed by an ordinary installation; without them (an installation
  without the optional dependencies, a platform that has none) the tool still works, but says that the
  numbers were counted another way, and returns **code 4** — that is a named different count rather than an
  error of the settings.
- `fixCommand` — the command the refusals quote and the contract hands to an agent (the page prints
  nothing of it). In the template it is
  `node node_modules/@vernikr/size-report/bin/size.js --write` — the path to the installed package inside
  the project. **The package name as a command cannot stand here:** `npx <name>` in a project without the
  installed package goes to the registry and pulls the package over the network, so the advice that is meant
  to help would depend on access to the registry and on what lies there. If the project has a script of its
  own — `pnpm run sizes`, say — write it in: the report's signature will lead to it.
- `journal: null` — there will be no references to journal sections. If the project has `WORKLOG.md` or
  `CHANGELOG.md`, put an object with `path`, `url` and `pattern`: that very object is what `size --init`
  derives when the project has a journal.
- `paths` inside a column are aliases of one file: if the file was renamed, list both the old name and the
  new one, and the column will not break apart.
- `output: "docs/size-report.html"` — the report file (there is one of it: a self-contained page with all the
  numbers, the filters and the link); the tool creates the directory itself. The updating hook is installed by
  itself — by the install script (npm, yarn) or by the first run (pnpm 10 does not run dependency scripts
  unless `pnpm.onlyBuiltDependencies` allows it) — and the report is rebuilt after every commit. The first
  report stays untracked until you add it to git; from then on it updates itself by commits.

## The check in CI

Copy `ci.yml` to `.github/workflows/size-report.yml` — it needs no edits if the project is on `pnpm`. What it
does and why exactly so is written in its comments; in short: it assembles the table again and compares it
with the file on disk, then takes the report's data twice — usually and in an environment with no git
settings at all (`GIT_CONFIG_GLOBAL=/dev/null`) — and compares the snapshots byte for byte. The second one is
the check that the numbers do not depend on the machine.

It needs no secrets of its own, and must not: the package is installed from a public repository, and pnpm
pulls its archive over HTTPS — neither the installation nor the check itself needs a key or a token. Should
the project move to a private registry or to a copy of the package of its own, the key step will have to be
added by hand: bringing it into the template on the project's behalf is not the tool's business.

For `npm` and `yarn` the file itself says what to replace.

There is deliberately no completeness check (`pnpm exec size check`) in the template: it demands that
**every** path of the history be a column or an exception, while the template's columns are examples — and in
a project whose columns are not chosen yet such a check would be red for no reason. Once the columns describe
the project, add the step yourself: `check` names the paths a column does not track and the commits that
introduced them; those that need not be counted go to `skip` — the same list makes a path an exception as
well. About a single commit `pnpm exec size explain <sha>` answers.

## What the templates do not have

A block for the project's own agent files (`AGENTS.md` and the like) is deliberately absent here: the
requirements do not ask for such a file, and inventing the format of someone else's repository is not
something the tool should do. What an agent needs to know it will take from `size --help` and
`size --data` — the commands and the data are described there rather than in a file of the tool's own.

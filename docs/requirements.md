# Requirements for the tool that tracks the growth of code and documents

What the product must be, derived from a series of decisions. **Required** — without it the product does not
do its job; **desirable** — it clearly improves the product, but the first version can ship without it;
**deferred** — deliberately not done now, recorded so that the question is not reopened. A requirement says
what the tool is meant to be rather than what the tree holds today; where a question is settled, the answer
lives in the code or in `docs/architecture.md`.

## 1. What the product is for

The tool shows how the volume of a project's code and documents moves from change to change — how much the
project grew or shrank in this change, in the measures of §3 — with almost no manual action by a person or an
agent. The target scenario of the first version is **one project**, developed under the control of an AI agent
and watched by a person.

## 2. Users and what they need

2.1. **A person (a developer)** opens the report by double-clicking a file on the local machine — no server,
no network — and sees where the project is swelling; understands how each number was obtained; and does not
want the report to litter the project's history.

2.2. **An AI agent** reads the report as data rather than as a picture, so that it can weigh its own changes
before making them (`--data` — the data contract on stdout; `--json` — the former shape), and needs no manual
care: the tool finds the files, refreshes the report and asks no questions.

## 3. The measures

3.1. **The required measures.** For every tracked file and for the totals: `raw` — the file as it lies in the
project, every character, space and comment, the base measure; `min` — what is left once the ballast is gone,
either by stripping comments and indentation (the default: a simplification rather than minification, names
are not shortened) or by real compression with esbuild, which the settings turn on per extension, a format the
minifier cannot take falling back to stripping; `tok` — how many text units the file splits into when read by
a language model, counted with the dictionary of the chosen family, an estimate by length without it, and
bytes for formats without text. The settings choose which of them reach the report — `gzip` is in the registry
and ships, but is not part of the first version's set (§12).

3.2. **Every change carries its own growth or shrink** — how far this change moved the measure — beside the
current total, and the report names the way that produced each number.

3.3. **The counting method is transparent.** For every measure the report says how it was obtained — a real
minifier, stripping, a dictionary or an estimate by length — in the metric's method, which names the tool's
version and the formats the way does not take; a measure that could not be counted as asked is not passed off
silently (the method names the way actually used, and the run reports a degraded sensor, exit code 4). The
report is about this as much as about the numbers: not only the number, but whether the number is honest.

## 4. Which files are tracked

4.1. **Discovery is automatic.** The tool finds the project's files itself, nothing listed by hand: the paths
git reports as tracked, minus what cannot be a column. Every exclusion is by rule and named with its reason
rather than dropped in silence — the report itself, dependency locks, built output, an unknown format, a
non-text file, a file too large to be anything but generated.

4.2. **Completeness is guaranteed (a required rule).** No change slips past the report: a change that touched a
path the tool does not track and the settings do not declare an exception is a violation, and says so — the
check fails instead of ignoring it in silence. A new kind of file therefore has to be either tracked or
deliberately declared an exception.

4.3. **Manual control.** A person can always add or drop a single file, or a group of them, by hand,
overruling the automatic decision; the settings carry that list, and hand-made settings outrank the automatic
ones but stay visible and explained.

4.4. **Unfamiliar formats.** A file of an unfamiliar format is measured the way everything else is — the
ballast stripped — and no minifier is pretended: the method names the way, so a simplification is not mistaken
for real compression.

## 5. How it reaches a project

The tool ships as **a ready package through the language's standard dependency manager** (JavaScript / Node),
installed and updated like an ordinary library. Its code is not copied into the project and is not stored in
its history — it lives in `node_modules/`, which git does not carry — so what remains in the project is the
minimum: the settings file and, where wanted, the notes the package brings.

## 6. What enters the project's history and what does not

6.1. **The report is an output, not a part of the history.** The report and its data can be rebuilt from the
history at any moment: the tool puts them into no commit and edits no ignore list — adding the report by hand
is the project's decision. Untracked, a rebuild leaves the history alone; tracked, the hook commits it as a
commit of its own, so it never mixes with a change to the code.

6.2. **The shape of the report** is one self-contained file that opens by double-clicking on the local
machine, with no server and no network: the data, the styling and the program live inside it.

6.3. **Machine-readable for an agent.** Beside the page for a person the numbers are readable as data: `--data`
prints the contract the page itself is built on, `--json` the former shape. The page is a visualization over
those data, not the only carrier of them.

## 7. When and how the report is refreshed

7.1. **It refreshes by itself, on every change.** The report is rebuilt after every commit and every merge by
the git hooks (`post-commit`, `post-merge`), so neither a person nor an agent has to remember a command. The
hooks install themselves — after the package is installed and on the first run in a project; where installing
is unsafe (someone else's `core.hooksPath`, a hook that is not ours, an environment without the engine, CI)
they stay silent, while the explicit command names the cause and hands over a ready line.

7.2. **No loop can start.** A loop is impossible by construction rather than by a flag: the report's commit is
assembled with git's plumbing, which calls no hooks at all, and the report's own path gets no row — the same
rebuild yields the same bytes. A lock covers the other case: two hooks at once must not rebuild one file.

7.3. **The automation is visible and switchable.** `size doctor` says whether the hook is installed and how
its last run ended; it can be switched off without being removed (`"hooks": {"enabled": false}`), silenced in
one environment (`SIZE_REPORT_NO_HOOK`, and CI is such an environment), or removed altogether
(`size uninstall-hook`), after which the report is rebuilt by an explicit command.

## 8. Show or also restrain

The first version **only shows** growth: it forbids nothing and blocks nothing — a refusal does not bring a
commit down, and no hard thresholds are part of it. Notifications and soft warnings about a threshold being
crossed stay **deferred**; what exists is a check a person or CI runs (`size check`, exit code 1 on a
violation, 4 on a degraded sensor).

## 9. Platforms and environment

9.1. **GitHub comes first**: the package brings a CI description for it, and the settings can name the commit
URL the report links to.

9.2. **Portability, as long as it costs little**: the count must not be welded to one platform — the report is
a local file built from the git history, and platform extras are a thin shell over that core.

9.3. **Runtime**: JavaScript / Node — the current stack; nothing is rewritten in another language.

## 10. The scale of the first version

One independent project; managing many projects centrally — one policy for an organisation, mass updates — is
out of scope, but must not be ruled out architecturally.

## 11. Non-functional requirements

11.1. **Wiring is minimal**: installing the package and running one init command is all of it, and after that
the tool works on its own.

11.2. **Transparency and explanation**: for any number a reader can find out how it was obtained — which
counting method, which file is in or out and why — and for a missing row, which of the reasons applies
(`size explain`); no hidden counts and no number without a reason.

11.3. **A truncated history is named, not silently survived**: where the full history is unavailable (a shallow
clone) the tool does not assemble a partial report but refuses (exit code 3) and names the fix —
`git fetch --unshallow` locally, `fetch-depth: 0` in CI.

11.4. **Determinism**: the same history yields the same report — no number depends on the time of the run, the
path on disk or the machine's locale (checks hold this).

11.5. **Speed**: the count has to be fast enough that refreshing after every change is no nuisance, and there
are no time goals — the cost grows with the length of the history rather than with the number of measures, and
intermediate results may be cached as long as §11.3 and §11.4 hold.

11.6. **Offline**: looking at the report and rebuilding it work without a network — a self-contained file and
a local count; the network is needed only to install or update the package.

## 12. Explicitly out of the first version (recorded so as not to come back)

Compressed size as a delivery measure (gzip and the like) — the registry carries gzip alone, and counts it when
the settings ask; hard growth limits and blocking a change; notifications about a threshold being crossed;
central management of many projects of one organisation; several implementation languages (JavaScript / Node);
deep support for platforms other than GitHub (portability is laid down, not implemented); tokenization in the
browser itself — it happens at build time.

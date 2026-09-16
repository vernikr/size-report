# Requirements for the tool that tracks the growth of code and documents

What the product must be, derived from a series of decisions. Priorities:

- **Required** — without it the product does not do its job.
- **Desirable** — it clearly improves the product, but the first version can ship without it.
- **Deferred / for later** — deliberately not done now, recorded so that the question is not reopened.

The requirements say what the tool is meant to be rather than what the tree holds today; where the first version has settled a question, the answer is named with the place it lives (§14).

---

## 1. What the product is for

The tool shows how the volume of a project's code and documents moves from change to change. It answers "how much did the project grow or shrink in this change" in the measures of §3, and does so with almost no manual action by a person or an agent.

The first version's target scenario is **one project**, developed under the control of an AI agent and watched by a person.

---

## 2. Users and what they need

### 2.1. The main user is a person (a developer)

- Opens the report by double-clicking a file on the local machine — no server, no network — and sees by eye where the project is swelling.
- Understands how each number was obtained: the count is transparent.
- Does not want the report to litter the project's history.

### 2.2. The second user is an AI agent

- Reads the report as data rather than as a picture, so that it can weigh its own changes before making them. The modes `--data` (the data contract in stdout) and `--json` (the former shape) exist for it.
- Needs no manual care: the tool finds the files, refreshes the report and asks no questions.

---

## 3. The measures

### 3.1. The required measures

For every tracked file and for the totals, three quantities:

1. **As written (the raw size).** The file as it lies in the project — every character, space and comment as it is. The base measure, always available.
2. **Without ballast (the substance).** What is left of the file once the ballast is gone. Two engines give this measure: **stripping comments and indentation** (the default, and not minification: names are not shortened) and **real compression by a minifier** (esbuild), which the settings turn on per extension, formats the minifier cannot take falling back to stripping. The measure names the engine it used and whether it is exact (§3.3).
3. **In tokens (the weight for an AI agent).** How many text units the file splits into when read by a language model. With the tokenizer available the count is exact; without it the number is an estimate by length, marked as an approximation, and binary formats are counted by bytes.

The settings choose which of the three reaches the report: the default set is `raw` and `min`, and `tok` is switched on in the settings, its tokenizer being an optional dependency.

### 3.2. How the measures are counted

- Every change in history carries its own growth or shrink (how far this change moved the measure) beside the current total.
- Compressed size for delivery (gzip and the like) is not part of the first version's set. The registry does carry gzip (zlib, level 9) and counts it exactly when the settings switch it on, but the first version neither shows it nor needs it (§12).

### 3.3. The counting method is transparent

- Beside the number the report says **how it was obtained** — a real minifier, stripping, an exact dictionary or an estimate by length — and marks an approximation as an approximation.
- This follows from the same thing the whole report is about: not only the number, but whether the number is honest.

---

## 4. Which files are tracked

### 4.1. Discovery is automatic

- The tool finds the project's files itself, with nothing listed by hand; a column is a file the tree holds.
- What cannot be a column is excluded by rule — an unknown format, a file too large to be anything but built output, a non-text file, dependency locks, built output, the report itself — and every exclusion is named with its reason rather than dropped in silence.

### 4.2. Completeness is guaranteed (a required rule)

- **No change slips past the report:** a change that touched a path the tool does not track and the settings do not declare an exception is a violation, and says so (the project fails the check) instead of being ignored in silence.
- A new kind of file therefore has to be either tracked or deliberately declared an exception.

### 4.3. Manual control

- A person can always add or drop a single file, or a group of them, by hand, overruling the automatic decision; the settings carry that list.
- Hand-made settings outrank the automatic ones but stay visible and explained (§6.3, §11.2).

### 4.4. Unfamiliar formats

- A file of an unfamiliar format is measured the way everything else is — the ballast stripped — and no minifier is pretended: the measure is marked an approximation and names its method.
- The mark sits beside the number rather than in a footnote, so that an approximation is not mistaken for real compression (§3.3).

---

## 5. How it reaches a project

- The tool ships as **a ready package through the language's standard dependency manager** (JavaScript / Node): installed and updated like an ordinary library.
- The tool's own code is not copied into the project and is not stored in its history: it lives in `node_modules/`, which git does not carry.
- What remains in the project after wiring is the minimum: the settings file and, where wanted, the notes the package brings (how the check runs, what goes where).
- Updating the tool is the dependency manager's business.

---

## 6. What enters the project's history and what does not

### 6.1. The report is an output, not a part of the history

- The report and its data are **outputs**: either can be rebuilt from the history at any moment. The tool puts them into no commit and edits no ignore list — adding the report by hand is the project's decision.
- Where the report is not tracked, a rebuild leaves the history alone. Where it is tracked, the hook commits it as **a commit of its own**, so the report never mixes with a change to the code.

### 6.2. The shape of the report

- The report is **one self-contained file that opens by double-clicking on the local machine, with no server and no network**: the data, the styling and the program live inside it.

### 6.3. Machine-readable for an agent

- Beside the page for a person, the numbers are readable as data: `--data` prints the data contract the page itself is built on, `--json` the former shape.
- The page is a **visualization over those data**, not the only carrier of them.

---

## 7. When and how the report is refreshed

### 7.1. It refreshes by itself, on every change

- The report is rebuilt **after every commit and every merge** by the git hooks (`post-commit`, `post-merge`), so neither a person nor an agent has to remember a command: "made a change — the report is already current".
- The hooks install themselves — after the package is installed and on the first run in a project. Where installing is unsafe (someone else's `core.hooksPath`, a hook that is not ours, an environment without the engine, CI), the hook stays silent and the explicit command names the cause and hands over a ready line.

### 7.2. No loop can start

- A loop is impossible by construction rather than by a flag: the report's commit is assembled with git's plumbing, which calls no hooks at all, and the report's own path gets no row — so the same rebuild yields the same bytes and there is no second commit to make.
- A lock covers the other case: two hooks at once (a commit from two terminals) must not rebuild one file.

### 7.3. The automation is visible and switchable

- `size doctor` says whether the hook is installed and how its last run ended.
- It can be switched off without being removed (`"hooks": {"enabled": false}`), silenced in one environment (`SIZE_REPORT_NO_HOOK`, and CI is such an environment), or removed altogether (`size uninstall-hook`), after which the project behaves as before the installation and the report is rebuilt by an explicit command.

---

## 8. Show or also restrain

- The first version **only shows** growth: it forbids nothing and blocks nothing — a refusal of the tool does not bring a commit down.
- No hard thresholds are part of the first version.
- Notifications and soft warnings about a threshold being crossed stay **deferred**; what exists is a check that a person or CI runs (`size check`, exit code 1 on a violation, 4 on a degraded sensor).

---

## 9. Platforms and environment

### 9.1. GitHub comes first

- The target platform is **GitHub**: the package brings a CI description for it, and the settings can name the commit URL the report links to.

### 9.2. Portability, as long as it costs little

- The count must not be welded to one platform: the report is a local file built from the git history, and platform extras are a thin shell over that core.

### 9.3. Runtime

- **JavaScript / Node** — the current stack; nothing is rewritten in another language.

---

## 10. The scale of the first version

- One independent project.
- Managing many projects centrally (one policy for an organisation, mass updates) is out of the first version's scope, but must not be ruled out architecturally.

---

## 11. Non-functional requirements

### 11.1. Wiring is minimal

- Installing the package and running one init command is all of it; after that the tool works on its own.

### 11.2. Transparency and explanation

- For any number a reader can find out **how it was obtained** — which counting method, which file is in or out and why — and for a missing row, which of the reasons applies (`size explain`).
- No hidden counts and no number without a reason.

### 11.3. A truncated history is named, not silently survived

- Where the full history is unavailable (a shallow clone), the tool does not assemble a partial report: it refuses (exit code 3) and names the fix — `git fetch --unshallow` locally, `fetch-depth: 0` in CI.

### 11.4. Determinism

- The same history yields the same report: no number depends on the time of the run, the path on disk or the machine's locale — checks hold this.

### 11.5. Speed

- The count has to be fast enough that refreshing after every change is no nuisance. There are no time goals: the cost grows with the length of the history rather than with the number of measures, and intermediate results may be cached as long as §11.3 and §11.4 hold.

### 11.6. Offline

- Looking at the report and rebuilding it work **without a network** (a self-contained file and a local count); the network is needed only to install or update the package.

---

## 12. Explicitly out of the first version (recorded so as not to come back)

- Compressed size as a delivery measure (gzip and the like): the registry carries gzip alone, and counts it when the settings ask — not part of the first version's set.
- Hard growth limits and blocking a change (only showing remains).
- Notifications about a threshold being crossed.
- Central management of many projects of one organisation.
- Several implementation languages (JavaScript / Node).
- Deep support for platforms other than GitHub (portability is laid down, not implemented).

---

## 13. The smallest user scenario (how it should feel)

1. The package is installed in a project with one command.
2. One init command runs: the tool finds the project's files, decides itself what to exclude and writes the settings file.
3. Where wanted, a person edits the list by hand (a file in, a file out).
4. From then on the tool refreshes the report after every commit and merge.
5. A person opens the report by double-clicking and sees how the volume moved over the chosen measures, each with the story of how it was counted.
6. An agent reads the same numbers as data at any moment, and weighs its change before making it.
7. The history carries no litter from the report: the file is either untracked or committed on its own.

---

## 14. Small questions the first version has settled

These were open at the start and are decisions now; each names where it lives, so that the question is not reopened:

- **Where the report file lies:** in the project, at the path the settings name (`docs/size-report.html` by default); with no settings file the path is derived from the project itself.
- **The machine-readable shape for an agent:** the data contract (`--data`) is the layer the page itself is built on, so an agent reads what the page shows rather than a second, parallel copy.
- **The minifier for each language:** one minifier (esbuild) where real compression is wanted, stripping everywhere else, and the settings decide per extension.
- **The mark about the counting method:** it sits beside the number in the report — the method in the column's description, the accuracy of the metric as a whole — rather than in a separate place.

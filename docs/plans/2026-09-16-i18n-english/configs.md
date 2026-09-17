# D1 — `configs`: the declarative files

Subplan of `plan.md` (T0). Owns `.github/workflows/**`, `templates/**`, `package.json`'s
`description` and the declarative dotfiles. Written 2026-09-16, not started. **The last owner of
the non-test files**, and the only one whose translated bytes leave the repository twice: three of
its files ship (`templates/**` is a name in `files`, measured) and one is what the registry shows.

## Scope — measured 2026-09-16, file by file

| File | Cyrillic | Own | What the rest is |
|---|---|---|---|
| `.github/workflows/release.yml` | 48 | 48 | comments, nine step names (six Russian), the `workflow_dispatch` input's `description`, two `run:` echoes |
| `.github/workflows/ci.yml` | 19 | 19 | comments and three step names |
| `.github/workflows/verify-slow.yml` | 11 | 11 | comments and three step names |
| `templates/ci.yml` | 33 | 33 | comments only — its `name:`, `on:` and `run:` lines are ASCII |
| `package.json` | 1 | 1 | `description`, the only Russian in the manifest |
| `.dependency-cruiser.cjs` | 7 | 7 | the `comment:` of seven rules |
| `eslint.metrics.config.js` | 6 | 4 | four messages; `отложено` in `DEBT_TERMS` is allow-listed below, and the English comment above it quoting the term stays |
| `.gitignore` | 4 | 4 | four comments |
| `templates/size-report.config.json` | 2 | 0 | `title` and `heading` — the `ru` dictionary's own words, allow-listed below |
| `templates/README.md` | 0 | 0 | already English (measured) |

**131 lines gross = 127 this owner's own + 3 allow-listed + 1 English comment that quotes a
Russian term.** The tracker's row said 131 and is now split.

**No hole in this owner**, measured: `.jscpd.json`, `.c8rc.json`, `eslint.config.js` and
`.eslint-suppressions.json` carry no Cyrillic at all, and `coverage-baseline.json`'s single line is
the baseline's `note`, written by the sensor (`tools/gates/coverage.js:84`) and W2's.

## What stays Russian, and why

| Item | Why |
|---|---|
| `title` and `heading` of `templates/size-report.config.json` (2 lines) | Measured: they are **the same string** as `src/locales.js:8`'s `heading`, that is, the `ru` dictionary's own words placed in a draft a person copies. `DEFAULT_CONFIG.title` and `.heading` are `''` with the comment "by default: the heading from the locale" (`src/config.js:20-21`), so the draft is where a project pins the locale's wording. Translating it gives a `locale: "ru"` project a page titled in English while every other caption of that page stays Russian — the mixing S5 recorded for the panel (`BLOCKERS.md` N25) — while a project that wants English asks for `locale: "en"`, which is S1's dictionary. **The alternative's price is measured rather than guessed:** no check reads these two values (`test/templates.test.js` reads the draft through `loadConfig` and its `fixCommand`, its keys and its columns), so translating them reddens nothing and buys a draft that disagrees with the report it produces. |
| `отложено` in `DEBT_TERMS` (`eslint.metrics.config.js:30`) | A **term the linter matches**, not a message: translating it stops the sensor seeing the marker it exists to see. Behaviour rather than wording — the same class as S1's `✗ ` marks, which stay marks for the same reason. The English comment above it (`:29`) says why the Russian word is in the list and stays as it is. |

## Terminology against S1's dictionary

Nothing to align, and that is measured rather than hoped: **this owner holds no cause name, no
`fix: ` marker and no `✗ `** — the printed texts are S1–S5's. What it does hold is the tool's
commands, and they are ASCII throughout: `pnpm run verify`, `pnpm run verify:slow`,
`pnpm run lint:strict`, `pnpm test:all`, `pnpm exec size`, `pack:check`,
`node node_modules/@vernikr/size-report/bin/size.js`. So a divergence from S1's vocabulary is
impossible here by construction.

Two places where D1's text and the tool meet, named so that a translator does not bring them
together:

- **The draft's `fixCommand`** is read by `test/templates.test.js` (`INSTALL_RE`, `BY_NAME_RE`) and
  has to keep the `node node_modules/<pkg>/bin/size.js …` form — the package name comes from the
  manifest, so renaming the package breaks the check rather than hollowing it out.
- **`templates/ci.yml`'s commands** — their `--flags` are held against the help
  (`knownFlags()` reads `USAGE`, which S1 owns). A translated comment may rewrite the prose around
  a command; it may not invent a flag.

## Readers of every literal

Machine readers, exact:

- `test/release.test.js:62,66,86,101,114,127,132` — **seven step names of `release.yml` are read as
  literals** (`step(doc, 'Версия манифеста — в окружение')`, `… 'Тег называет ту же версию, что
  манифест'`, `… 'npm поновее (для trusted publishing)'`, `… 'Публикация'`, `… 'Черновой прогон —
  в реестр ничего не ушло'`, `… 'Проверки перед выпуском'`, `… 'Работа из собранного пакета'`).
  Each moves with its assertion line in the same commit. **This bullet said six and called `:86`'s
  step name English; the measurement corrects it to seven** — `npm поновее (для trusted publishing)`
  carries the Russian word `поновее`, is found by `step()` through its name, and therefore moved with
  its line too.
- `test/release.test.js:69,71` — `$GITHUB_REF_NAME` and `$WANT` inside the tag step's `run:` echo:
  the words may change, the variables may not.
- `test/release.test.js:102,104,106,107,115,117,133` — `/dry_run == false/`,
  `/contains\(github\.ref_name, '-'\)/`, `'next'`, `'latest'`, `/npm publish --dry-run/`,
  `/npm version prerelease --preid=draft --no-git-tag-version/`, `/pack:check/` — commands inside
  the steps' `run:` values.
- `test/release.test.js:120` — `input.default === 'true'`: the `workflow_dispatch` input's
  **`description` is read by nothing**, its `default` is what the check holds.
- `test/release.test.js:130` with `:139` — the file has to contain its own basename `release.yml`,
  and today it does so inside a comment (`:11`, the `npm trust … --file release.yml` instruction):
  **the token has to survive whatever the prose around it becomes.** This is the step's sharpest
  "red first".
- `test/gates-verify.test.js:83-89,119-126` — `parseWorkflow` over `ci.yml`, `verify-slow.yml` and
  `release.yml`: it reads the **`run:` lines** and holds them against `SETUP`
  (`/^pnpm install /`, `/^git fetch /`, `/^npm install -g /`) and against the profile's scripts.
  `:119-121` asserts `ci.jobs.verify` exists — the job key is ASCII and is the required check of
  branch protection.
- `test/gates-verify.test.js:153-160` — `.gitignore` is read **by pattern** (`/^reports\/$/m`,
  `/^node_modules\/$/m`, and `tools/gates/common.js`'s `'reports'`). The comments around those
  lines are read by nothing; the lines themselves may not go.
- `test/templates.test.js:46-95` — the draft through `loadConfig` (keys known to `DEFAULT_CONFIG`,
  columns present, `output` inside the project, the `fixCommand`'s flags known to the help),
  `templates/ci.yml` through `parseWorkflow` (name, `on`, one job, `runs-on`, `fetch-depth: 0`, the
  run commands), and `templates/README.md` **by file names only** (`:80-84`).
- `tools/docs-facts.js:38,47` — `templates/README.md` is one of the documents the guards read, and
  the installed `node_modules/<pkg>/templates/ci.yml` is a named foreign path: names, not text.

No reader at all, measured:

- every comment of the three workflows and of `templates/ci.yml`;
- the workflows' `name:` fields — `name: Проверки по расписанию` is what the Actions UI shows and
  no check reads it (`rg` for it over `test/` and `tools/` answers nothing);
- the seven `comment:` fields of `.dependency-cruiser.cjs` (the first words of each answer nothing
  in `test/` or `tools/`: they are printed only when a rule fires, and the sensor reports the rule
  rather than the comment);
- the four messages of `eslint.metrics.config.js` (nothing in the tree matches their text);
- `package.json`'s `description` (the registry shows it; the tree says it nowhere else).

**Negative matches: none in this owner** — measured, a Cyrillic pattern together with
`false`/`doesNotMatch` over its ten files answers nothing. The rule C1 and C2 formulated therefore
has no case here, and saying so is the point: a reader of this plan does not have to check.

Machine counters that must not move: the check counts (`test/docs-numbers.test.js`), the document
list (`tools/docs-facts.js`), the profile comparison (`test/gates-verify.test.js`) and the parse
(`test/release.test.js`). A translated comment moves none of them; a translated step name moves
exactly the line that names it.

## How the tree stays green between commits

One rule, and the measurement above is what makes it cheap: **the only text of this owner a check
reads is the six step names of `release.yml`, so only they land in couple with their reader** — and
they all live in one file, so one commit can carry all six. Every other Russian line of this owner
has no reader and can land alone; the lines a check *does* read here are not prose but commands,
variables and patterns, and this work does not touch them (measured: every one of those lines is
ASCII).

Two things that rule does not cover, named rather than left to luck:

- **The `verify` job key** (`ci.yml`) is the required check of branch protection — a contract
  outside the tree, so the key stays ASCII and the comment that explains why stays with it.
- **The `Gate-Change:` trailer.** Six of the nine commits below touch a gate file
  (`package.json`, `.dependency-cruiser.cjs`, `eslint.metrics.config.js`, `.github/workflows/**` —
  measured against `tools/gates/gatefiles.js`), so each carries
  `Gate-Change: <reason — what changed, by which measurement>`; the `commit-msg` hook answers
  first and `pre-push` re-reads the range. `templates/**` and `.gitignore` are not gate files.

## Steps — one commit each, red first

0. **Re-measure before starting.** Take the counter's baseline for the ten files and write it into
   the journal: the expectation is **127 of this owner's own, 3 allow-listed, 1 comment**, and it is
   a measurement rather than a guess. **Done 2026-09-17: the expectation held to the line** —
   `release.yml` 48, `templates/ci.yml` 33, `ci.yml` 19, `verify-slow.yml` 11, `.dependency-cruiser.cjs`
   7, `eslint.metrics.config.js` 6, `.gitignore` 4, `size-report.config.json` 2, `package.json` 1,
   `templates/README.md` **0** = **131 gross**, that is 127 own + 3 allow-listed + 1 English comment.
   This is the first owner whose plan's number survived its own step 0 without a correction.
1. **`templates/ci.yml`** (33) — **the file's text that no check reads, and it is not only comments:**
   28 comment lines and 5 step names, measured. Red first: the counter, plus
   `test/templates.test.js` staying green after a translated comment (it reads the parsed document,
   not the prose). Constraint: a command keeps its flags (the help is the list). No trailer —
   `templates/**` is not a gate file. **These bytes ship** (below). **Done 2026-09-17: 33 → 0.**
   Red first, four probes over the file, each restored byte for byte: a **step name** renamed
   (`- name: Установка` → `- name: Setup`) — green; a **flag in a comment** broken (`--write` →
   `--writ`, the only occurrence of the flag is in the comment at `:28`) — green; a **comment**
   rewritten — green; a **flag inside a `run:`** broken (`--data` → `--dat` at `:60`) — **red** at
   check 2 (`the CI workflow parses, and it runs what it declares`), and `fetch-depth: 0` → `1` —
   also **red** at check 2. So the split is measured rather than argued: comments *and* step names
   are free, the parsed document is the contract. `pnpm run dup` cannot see this file at all
   (below). No trailer needed, and the hook confirmed it (`gate files 0`).
2. **`.gitignore`** (4) — red first: fold the `reports/` line into another comment and watch
   `test/gates-verify.test.js` redden with its own message; translating the comment above it does
   not. No trailer. **Done 2026-09-17: 4 → 0**, the four comments. Red first, both halves of the
   experiment measured with the file restored byte for byte: folding `reports/` away reddens
   `test/gates-verify.test.js` (4 of 5) with its own message — `the directory `reports/` is not in
   .gitignore: the reports would go into the history` — while the same four comments translated
   leave it green (5 of 5). The line itself is the only thing read (`/^reports\/$/m`, beside
   `tools/gates/common.js`'s `'reports'`) and it did not move.
3. **`package.json`** (1) — red first: the counter, and `pnpm run pack:check` green (it reads
   `files`, not the description). **Trailer**; these bytes are what the registry shows. **Done
   2026-09-17: 1 → 0**, the `description`. Red first: the translated description leaves
   `test/templates.test.js` green (3 of 3) — no reader anywhere, measured (`rg` for its words over
   `test/`, `tools/`, `src/`, `bin/` answers nothing; the registry is the only place it shows).
   `pnpm run pack:check` green.

**Both steps landed in one commit that carries the trailer** — the portion's rule is one commit,
and `package.json` is a gate file, so the hook demanded the `Gate-Change:` line and accepted it
(`gate files 1`). The counter over the ten files now reads **93**: 89 of this owner's own, 3
allow-listed, 1 English comment. The owner reads **89 own**.
4. **`.dependency-cruiser.cjs`** (7) — red first: the counter, and `pnpm run deps` green with the
   same numbers (a rule's `comment` is not a rule's name). **Trailer.** **Done 2026-09-17: 7 → 0**,
   the seven `comment:` values. Measured: `pnpm run deps` answers `no findings (113 modules, 472
   relations)` before and after, and `require`ing the config gives the same seven names with the same
   `severity: 'error'` — so the diff's changed lines are `comment:` alone. The file's own header says
   these comments are the sensor's verdict printed with the finding, and that is now measured the
   other way round too: a scratch copy of the config with one rule made to fire answers 17 findings
   and the `comment` **is carried into the machine report** as well as printed, so the text is what a
   person reads when the sensor speaks. **And the sensor does read the file:** while writing this
   step an apostrophe got into one comment, breaking the string — `pnpm run deps` failed at
   `tools/gates/deps.js:33` and `test/gates-deps.test.js` went red at four checks. The slip is
   recorded because it is the cheapest possible proof that the config is parsed rather than ignored.
5. **`eslint.metrics.config.js`** (4 messages) — red first: the counter, and `pnpm run metrics`
   green with the same finding counts (the sensor counts rather than reads the text; `reports/` is
   gitignored). `DEBT_TERMS` and the comment above it are left. **Trailer.** **Done 2026-09-17:
   4 messages → 0**, the rule names, the schema and every number untouched — the diff is four
   `messages:` values. Measured: `pnpm run metrics` answers `no new violations (the baseline holds 0
   in 0 files)` before and after (`.eslint-suppressions.json` is `{}` and holds no message text at
   all), the placeholders `{{what}}`/`{{term}}` survive, and `rg` for the four messages answers
   nothing outside the file itself. The report does carry a `message` field per finding
   (`tools/gates/metrics.js:47`) — today it holds none, and nothing compares the text.
6. **`.github/workflows/verify-slow.yml`** (11) — red first: break a `run:` prefix in a scratch copy
   (`git fetch` → `git clone`) and read `test/gates-verify.test.js`'s "не входит ни в один профиль";
   that line is the only thing in this file a check reads, so the experiment proves the check would
   notice a translated command while it does not notice a translated comment. **Trailer.** **Done
   2026-09-17: 11 → 0** — seven comments, three step names and the echo of the preparation step.
   Measured, each file restored byte for byte: `git fetch` → `git clone` in `ci.yml` reddens
   `gates-verify` with its own message (`the step «git clone --no-tags origin main || echo …» is in
   no profile`), while the workflow's **top-level `name:`** translated and a step name translated
   leave it green (5 of 5) — so the display name and the step names are read by nobody, and the
   comments that quote the display name (the `Actions → … → Run workflow` line) were moved with it
   by the C2 rule (a quote of a translated text travels with it). The `name:` of a workflow is what
   the Actions UI shows: changing it is cosmetic and no check reads it (measured).
7. **`.github/workflows/ci.yml`** (19) — the same, plus the job key: red first, rename `verify` in a
   scratch copy and watch `test/gates-verify.test.js:119` redden. **Trailer.** **Done 2026-09-17:
   19 → 0** — fourteen comment lines, three step names, the echo of the preparation step and the
   top-level `name:` (already ASCII, left alone). The job key `verify` was **not** touched, and the
   measurement says why: renaming it reddens `gates-verify` with `the CI description holds no job
   «verify»`, because branch protection requires that check — a contract outside the tree. The
   measurement also settled the sibling: `verify-slow`'s job key is read by no check at all (renamed
   in a scratch copy → green), so its key was left for the same reason it was never a text — it is
   an identifier, and the rule of this campaign is literals only. The two echo lines of the two
   workflows are the twin lines the plan named, and `pnpm run dup` cannot see them
   (`.jscpd.json` scans `src`, `bin`, `tools`, `test`).

**These four steps (4–7) landed in one commit that carries the trailer** — the portion's rule is one
commit, and all four files are gate files, so the hook demanded the `Gate-Change:` line and accepted
it (`gate files 4` of 7). `release.yml`, step 8, went to a portion of its own together with its
reader (`test/release.test.js`), as the mission asked. The counter over the ten files now reads
**52**: 48 of this owner's own — all of them `release.yml` — plus 3 allow-listed and 1 English
comment; **the owner reads 48 own**. The `.eslint-suppressions.json` baseline and the dup baselines were
not touched; the artifact's content digest `1bdb27e1…` and the reference file's own sha256
`cdda8d01…` did not move; checks stay at 70 fast and 175 full.

8. **`.github/workflows/release.yml`** (48) — the six step names **and** their six assertion lines in
   one commit; keep `$GITHUB_REF_NAME`, `$WANT`, `'next'`, `'latest'`, the four `run:` commands the
   check matches, `default: true`, and the basename `release.yml` in the comment at `:11`. Red
   first, two experiments: translate «Публикация» without `test/release.test.js:101` → the check
   fails with "в описании выпуска нет ровно одного шага «Публикация»"; rewrite the `:11` comment
   without the basename → `:130` reddens. **Trailer.** The heaviest commit of the owner (54 lines
   with the two check lines), inside the budget. **Done 2026-09-17: 48 → 0**, and the seven readers
   of `test/release.test.js` moved with it **in the same commit**, as the rule demands — that file
   now reads 0 too, so C2's last debt is paid. Red first, three probes, every file restored byte for
   byte: the step name `Публикация` translated **alone** reddens `release` (2 of 3) with its own
   message — `the release workflow holds no single step «Публикация»`; the hint rewritten without the
   basename (`--file release.yml` → `--file release-workflow.yml`) reddens it with `the hint does
   not name the workflow file: the one-time setting on npmjs.com would point at another file…`, so
   the file's own self-naming is load-bearing and the `:11` instruction kept the exact token; and a
   step name translated that no check reads (`Установка`) leaves it green (3 of 3). The document
   still parses: `parseWorkflow` answers the same **11 steps** with the translated names, and
   `input.default` is still `true`. Identifiers untouched and named: the `jobs:` key `release`, the
   `permissions` block, the two `if:` conditions, the four pinned `uses:` SHAs, `runs-on`, every
   `run:` command and the `tags: ['v*']` range — the changed lines are comments, step names, the
   input's `description` and the words inside the tag step's `echo`.
9. **Wash-up** — the counter over the ten files answers the 3 allow-listed lines and the 1 comment
   and nothing else; `pnpm run verify` green; `git status` clean. **Measured 2026-09-17: it reads
   4** — `templates/size-report.config.json` 2 and `eslint.metrics.config.js` 2 (the term line and
   the English comment quoting it) — and nothing else. **D1 is closed**, and with it the campaign's
   last source owner: every other line of its ten files is English.

## Acceptance

- The counter over the ten files answers **only** the named exceptions:
  `rg -cP '[\p{Cyrillic}]' .github/workflows/ci.yml .github/workflows/release.yml .github/workflows/verify-slow.yml templates/ci.yml templates/size-report.config.json templates/README.md package.json .dependency-cruiser.cjs eslint.metrics.config.js .gitignore`
  — expecting `size-report.config.json` 2 and, until step 8, `release.yml` 48, `eslint.metrics.config.js`
  **2** (the term line at `:30` and the English comment at `:29` that quotes the term in Cyrillic —
  the scope table counted the comment as one line, this acceptance sentence counted the same file as
  one, and the measurement corrected it to two; both lines are allow-listed), everything else empty.
- `pnpm run verify:fast` after every commit, `pnpm run verify` before the portion is pushed; the six
  gate-file commits carry the trailer (`git log --format='%b' <range>` shows it, and the hooks
  answer first).
- The parsers stay green: `test/release.test.js`, `test/gates-verify.test.js`,
  `test/templates.test.js`, `test/docs-paths.test.js` (this owner adds no file, so the README's file
  table does not move). Measured for step 1: `test/templates.test.js` **3 of 3** green after the
  translation, and `tools/pack-check.js:110-112`'s byte comparison of `templates/**` is unaffected
  because it compares the tree against the tarball built from that same tree.
- The instruments still answer 0: `pnpm run check:standards`, `pnpm run pack:check`, `pnpm run deps`,
  `pnpm run metrics`.
- **A free detector of behaviour change:** `git diff --stat` over the ten files shows only literal
  values and comments. And `pnpm run dup` cannot move at all — measured: `.jscpd.json` scans `src`,
  `bin`, `tools` and `test` only, so the two twin `git fetch … || echo "…"` lines of the workflows
  are invisible to it. Said here because a reader would otherwise expect a duplicate sensor to
  notice them.

## Release

This owner **does** ship: `package.json`'s `files` names `templates` (measured), so
`templates/ci.yml`'s comments travel in the tarball, and `description` is what the registry shows.
Per `AGENTS.md` the portion owes a PATCH release, a journal section and the pin in `README.md`;
whether to release per portion or to batch is `BLOCKERS.md` N20 and is not decided here. The
workflows, `.gitignore` and the dotfiles ship nothing.

## Not in scope

- `tools/gates/**`, `tools/suites.js` and `.githooks/**` (W2), and the printed texts (S1–S5).
- Every check file's own Russian (C1–C3) — including the strings of `test/release.test.js` and
  `test/templates.test.js`: this owner edits the **step names they match**, not their messages.
- The `ru` dictionaries (`src/locales.js`, `src/metrics.js`, `src/history.js`'s `SKIP_WORDS` — N24,
  decided 2026-09-16 as "stay Russian") and the default locale (N19).
- The three allow-listed lines and the comment above the debt term.

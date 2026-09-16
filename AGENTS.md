# AGENTS.md — how to work in this repository

Only what cannot be derived from the code: what to run, what to do when a sensor is red, what
must not be touched. The gate itself is described in `README.md`.

## What to run

- `pnpm run verify:fast` — before every edit and in the `pre-commit` hook: the strict linter,
  the bloat sensors (size and complexity, duplication, dependencies) and the fast set of checks.
- `pnpm run verify` — before pushing an edit and in CI: the same plus the full set, parity with
  the live project, reproducibility of the standards, and work from the built tarball.
- `pnpm run verify:slow` — on a schedule: the same plus the full set in an environment without
  the machine's git settings (`GIT_CONFIG_GLOBAL=/dev/null`) and coverage under c8.
- One sensor at a time: `pnpm run metrics`, `pnpm run dup`, `pnpm run deps`, `pnpm run cover`.
  The list of profile steps lives in one place (`tools/gates/run.js`), and CI runs the same
  commands: a check that is not in the profile cannot be in CI
  (`test/gates-verify.test.js`).

## Look before writing

Before writing a new function or module, check whether it already exists and **show what you
found before the code**:

- `pnpm run dup` — what is already duplicated in the tree (copy-paste and token twins);
- `rg -n '<name or fragment>' src tools test`, and for shape rather than substring a structural
  search — `ast-grep run -p 'function $N($$$) { $$$ }'` (`sg` is the same tool under a
  deprecated name);
- `pnpm run deps` — which modules are already connected, and whether you are about to close a
  cycle.

## When a sensor is red

Fix the **code**, not the sensor. Forbidden: raising a threshold, widening `ignore`, editing or
deleting a baseline (`.eslint-suppressions.json`, `dup-baseline.json`, `coverage-baseline.json`),
switching a rule off, downgrading `error`, writing `eslint-disable`. If a threshold looks
unfair, put that in the report: a person decides, not the thing it stopped.

## Gate files and the trailer

The list of gate files is in `tools/gates/gatefiles.js` (thresholds, baselines, sensor configs,
`package.json`, the lockfile, `.github/workflows/`, `.githooks/`, `tools/gates/`,
`tools/suites.js`, the sensors' own tests). A change to any of them passes only with a trailer
in the commit message:

```text
Gate-Change: <reason — what changed, by which measurement>
```

Without it the `commit-msg` hook is red on that commit and the `pre-push` hook is red over the
range; CI runs the profiles and reads no trailers. Baselines are updated by hand:
`pnpm run baseline:metrics`, `baseline:dup`, `baseline:coverage`.

## Commit size

The budget comes from the p75 of the repository's history (591 lines / 7 files when it was set,
419 / 7 measured on 2026-09-16) and is a bound rather than a target: **≤ 600 lines and ≤ 10
files**. More needs a justification in the commit body (on that alone a `Gate-Change:` trailer
is not given).

## Release and attaching the copy

After every portion of work the package is released to the registry, and the attached copy in
this project is updated — that is part of the work, not a separate decision.

1. The version by SemVer (`docs`/`fix`/`refactor`/`chore` → PATCH, `feat` → MINOR), a section in the
   journal (`worklog/`, the earlier one in `worklog/archive/WORKLOG.md`) saying what changes in the
   numbers, and the pin in `README.md` (it equals `installSpec()`, that is, the tag of the current
   version) — in one commit.
2. The tag `v<version>` is placed locally **before** that commit and moved onto it afterwards:
   `test/docs-pin.test.js` requires the pin to lead to an existing revision, and before the
   release commit there is no such tag. The push is **one command with the tag first**:
   `git push origin v<version> main`. Pushed as two commands (the branch first, the tag after),
   CI has time to run the branch without the tag and reddens on the pin guard — the green run is
   the one where the tag is already there. The release itself runs from CI on GitHub Actions
   attestation (the tag and the manifest version are compared).
3. After the release — `pnpm add -D -E @vernikr/size-report@<version>` (`package.json` plus the
   lockfile) and a commit carrying the `Gate-Change:` trailer. That commit **needs no new
   release**: the registry already holds the same code, and releasing for it again would mean
   releasing forever.

The exception is always the same one: when a commit changes nothing that ships in the tarball
(only the journal, the sensors' baselines, the reports), there is nothing to release — say so in
the commit in words.

## The size report

The report is one file, a self-contained page: `docs/size-report.html`. A hook
(`post-commit` + `post-merge`) refreshes it, and **it lands as a commit of its own**: the hook
edits that path only, and the index and the uncommitted work are left alone. Writing the report
by hand (`--write` and committing it) is needed only when the hook is switched off.

In this repository `core.hooksPath = .githooks`, so the line calling the tool was written by a
person into `.githooks/post-commit` (the tool refuses to edit someone else's hooks directory).
Two reasons to know this: another commit may appear after yours (the report) — that is normal,
not a failure; and the automation can be switched off here only by editing the hook file
(`hooks.enabled` is about hooks installed into `.git`).

## Environment

- Hooks are installed once: `pnpm run hooks:install` (`core.hooksPath = .githooks`). The full
  profile is not put into hooks — it lives in CI and is run by hand.
- The sensors' reports live in `reports/` (in `.gitignore`), machine-readable (JSON), with a
  stable sort: they are diffed rather than read in history by eye.
- The scanners do not read `.git`, `node_modules`, `fixtures`, `reports`: those are sources of
  false findings (clones of frozen copies, "secrets" in fixtures).

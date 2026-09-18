# AGENTS.md — how to work in this repository

Only what cannot be derived from the code: what to run, what to do when a sensor is red, what must not
be touched.

Where the rest is: `README.md` — what the package is, for a person; `docs/architecture.md` — the gate,
the decisions and the invariants of the engine and the page; `docs/files.md` — the map of the tree;
`docs/wiring.md` — the settings and the surface for a consumer's agent.

## What to run

- `pnpm run verify:fast` — before every edit and in the `pre-commit` hook: the strict linter, the bloat
  sensors (size and complexity, duplication, dependencies) and the fast set of checks.
- `pnpm run verify` — before pushing and in CI: the same plus the full set, parity with the live
  project, reproducibility of the standards, and work from the built tarball.
- `pnpm run verify:slow` — on a schedule: the same plus the full set without the machine's git settings
  (`GIT_CONFIG_GLOBAL=/dev/null`) and coverage under c8.
- One sensor at a time: `pnpm run metrics`, `pnpm run dup`, `pnpm run deps`, `pnpm run cover`.

The list of profile steps lives in one place (`tools/gates/run.js`) and CI runs those same commands, so
a check that is not in the profile cannot be in CI (`test/gates-verify.test.js`).

## Look before writing

Before writing a new function or module, check whether it already exists and **show what you found
before the code**:

- `pnpm run dup` — what is already duplicated in the tree (copy-paste and token twins);
- `rg -n '<name or fragment>' src tools test`, and for shape rather than substring a structural search —
  `ast-grep run -p 'function $N($$$) { $$$ }'` (`sg` is the same tool under a deprecated name);
- `pnpm run deps` — which modules are already connected, and whether you are about to close a cycle.

## When a sensor is red

Fix the **code**, not the sensor. Forbidden: raising a threshold, widening `ignore`, editing or deleting
a baseline (`.eslint-suppressions.json`, `dup-baseline.json`, `coverage-baseline.json`), switching a
rule off, downgrading `error`, writing `eslint-disable`. If a threshold looks unfair, put that in the
report: a person decides, not the thing it stopped.

## Gate files and the trailer

The gate files are listed in `tools/gates/gatefiles.js` (thresholds, baselines, sensor configs,
`package.json`, the lockfile, `.github/workflows/`, `.githooks/`, `tools/gates/`, `tools/suites.js`, the
sensors' own tests). A change to any of them passes only with a trailer in the commit message:

```text
Gate-Change: <reason — what changed, by which measurement>
```

Without it the `commit-msg` hook is red on that commit and the `pre-push` hook over the range; CI reads
no trailers. Baselines are updated by hand: `pnpm run baseline:metrics`, `baseline:dup`,
`baseline:coverage`.

## Commit size

**≤ 600 lines and ≤ 10 files** — a bound rather than a target. More needs a justification in the commit
body (on that alone a `Gate-Change:` trailer is not given).

## Release and attaching the copy

Every portion of work is released to the registry and the attached copy in this project is updated —
part of the work, not a separate decision.

1. The version by SemVer (`docs`/`fix`/`refactor`/`chore` → PATCH, `feat` → MINOR) and a section in the
   journal (`worklog/`, the earlier one in `worklog/archive/WORKLOG.md`) saying what changes in the
   numbers — in one commit.
2. The tag `v<version>` on that commit, pushed as **one command with the tag first**:
   `git push origin v<version> main`. The release runs in CI on the GitHub Actions attestation (the tag
   and the manifest version are compared). **Place the tag by sha**, not on `HEAD`: the `post-commit`
   hook lands the report's commit right after the release commit, so `HEAD` is already that one.
3. After the release — `pnpm add -D -E @vernikr/size-report@<version>` (`package.json` plus the lockfile)
   and a commit with the `Gate-Change:` trailer. That commit **needs no new release**: the registry
   already holds the same code.

The exception: a commit that changes nothing shipped in the tarball (only the journal, the baselines,
the reports) is not released — say so in the commit in words. **A portion is pushed as soon as its
commit is green** (`git push origin main`, the full profile run by hand first): holding it back only
lets the attached copy drift from the tree.

## The size report

The report is one self-contained page, `docs/size-report.html`. A hook (`post-commit` + `post-merge`)
refreshes it, and **it lands as a commit of its own**: the hook edits that path only, leaving the index
and uncommitted work alone. Writing it by hand (`--write` and committing) is needed only when the hook
is off.

`core.hooksPath = .githooks` here, so the line calling the tool was written by a person into
`.githooks/post-commit` (the tool does not edit someone else's hooks directory). Hence: another commit
may appear after yours (the report) — normal, not a failure; and the automation is switched off here
only by editing the hook file (`hooks.enabled` concerns hooks installed into `.git`).

## Environment

- Hooks are installed once: `pnpm run hooks:install`. The full profile is not in hooks — it lives in CI
  and is run by hand.
- The sensors' reports live in `reports/` (git-ignored), machine-readable (JSON), with a stable sort:
  they are diffed rather than read by eye.
- The scanners do not read `.git`, `node_modules`, `fixtures`, `reports`: sources of false findings.

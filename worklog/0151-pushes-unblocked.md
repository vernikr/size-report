# 0151 — pushes unblocked: the held commits go to `origin/main`

Requested: push everything to GitHub and keep doing so for every later portion.

## What was done

The push half of `BLOCKERS.md` N20 is answered by the mission agent: portions are no longer held
locally. That is also what the repository's own rule asks ("after every portion of work … the
attached copy in this project is updated"), so the only thing N20 still holds is the release
cadence — a PATCH per portion or batched.

Before pushing, the full profile was run by hand: `pnpm run verify` green, eight steps
(`lint:strict`, `metrics`, `dup`, `deps`, `test:all` 175 checks, `parity:live`,
`check:standards`, `pack:check`). The 36 commits held since the plan work began went to `origin/main`
in one push — no tag, so `release.yml` (which runs on `v*` tags only) stays untouched and nothing is
published by it.

## Watch out

`ci.yml` runs on every push and on pull requests, so from here a push is followed by a CI run over
the same profiles. `release.yml` still needs the tag: nothing is released by a branch push.

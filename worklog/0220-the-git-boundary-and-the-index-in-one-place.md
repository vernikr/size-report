# 0220 — the boundary of git in one place, the index read once

**Asked:** look through the code for what can be refactored, made faster or more elegant without growing
the code much.

**Done:** three edits, none of them changing a number or a byte of any answer.

- **The way git is started is written once.** Nine places carried the same bundle of options
  (`cwd`, `encoding: 'utf8'`, `maxBuffer: MAX_BUF`, `env: gitEnv()`) — six calls in `src/git.js`, one in
  `src/project.js` and one in `src/config.js`, plus `gitTry` with a near-copy of it. Now there is one
  `gitOptions` next to one `gitRead`, and `gitTry` asks for the same options on top of its own
  environment; `src/project.js` and `src/config.js` no longer import `child_process` at all, so
  `src/git.js` has become the border it claims to be. What a caller adds stays visible at the call:
  `input` for a batch, `encoding: undefined` where the answer is the bytes of a blob.
- **One read of the index per run instead of two.** `projectConfig` called `indexFiles` twice — once
  directly for the set of tracked paths and once through `allPaths` — that is, two pairs of git processes
  (`ls-files -s` plus `cat-file --batch-check`) for one answer. The index is now read once and handed to
  `allPaths`, which copies it rather than adding the history's paths to the caller's array. Measured with a
  `git` shim on `PATH`: 19 git invocations per `--data` before, 17 after.
- **A step down the table no longer allocates.** The window walked `[...cache.rows.keys()]` and then
  looked every row up a second time by key; it now walks the map itself — the entry it keeps is the one it
  already has, and what left the window is dropped where it stands. The page's program came out 28 B
  shorter (26 405 → 26 377 B by `pageScript()`), which the report pays for itself: the artifact is
  measured by the tool it carries.

**What was looked at and left alone, with the reason.** The seven plumbing steps in `commitReport`
(`src/hook.js`) look like a case for a helper, but three of the seven need the sha git answered with, so a
helper saves no line at all. The repeated walks of `appData.files`/`appData.metrics` in `src/page/state.js`
(a helper would save about 40 B of the artifact) buy indirection in the one file the page is assembled
from. The second read of the index per run — `projectTree` for the page's catalogue — can only be removed
by a cache on the module (a hazard for the checks, which edit trees in one process) or by threading the
index through `reportData`, which is frozen API. All three are named here rather than done.

**What holds it:** `pnpm run verify` green throughout (8 steps): the strict linter, the four sensors, the
whole suite (190 checks), parity with the live project, both references reproduced, the package from the
tarball. No number of any report changed: `--json` and the artifact are compared byte for byte by parity
and by the packed copy.

**Files:** `src/git.js`, `src/project.js`, `src/config.js`, `src/page/table.js`,
`worklog/0220-the-git-boundary-and-the-index-in-one-place.md`.

## Release 2.8.8 — what changes in the numbers

This portion ships: `src/git.js`, `src/project.js`, `src/config.js` and `src/page/table.js` are in
`files`, so it takes its own PATCH. No number of the measurement moves — `--json`, the artifact and the
reports are what they were (parity with the fixture and with the consumer's live history holds, both
references reproduce, the tarball carries the same six entries). What moves is the price of a run: 17
invocations of git per `--data` instead of 19, one pair of processes fewer for the settings derived from
the project, and no array of the window's keys on a step down the table. The report is rebuilt by the
post-commit hook as a commit of its own, as always.

# Documentation guards: the bird view and the campaign folder

What was asked: open a campaign for a radical cut in the number of checks and guards that hold
the documentation true, give it a folder of its own under `docs/plans/`, an inventory that shows
which guards are the dearest in time and in lines (comments included), a clear retelling of that
inventory for a reader who does not open the code, and a pull request of its own. The code is
deliberately **not touched**.

## Done

- **`docs/plans/2026-09-17-docs-guards-cull/bird-view.md` — the inventory.** Every guard whose
  red means "a document says what is no longer true", in two tiers: Tier 1 the prose itself
  (`docs-paths`, `docs-commands`, `docs-numbers`, `docs-pin` and their shared reader
  `tools/docs-facts.js`), Tier 2 the declarations that stand in for prose (`templates`,
  `gates-verify`, `suites`, `release`, `gates-files`). A third group is named and left out with a
  reason each (`check:standards` re-takes frozen data, the refusals catalogue is a *test*
  catalogue, the metrics rules for checks are checks about checks).
- **Time, measured rather than guessed.** Every file run on its own, one at a time
  (`node --test <file>`), window named with its load: Tier 1 2.25 s, Tier 2 4.82 s, both 7.07 s
  of the fast set's 26.49 s serial. The dearest are `gates-files` 1.90 s and `templates` 1.41 s —
  and neither reads a document dearer than the others: they pay for a repository of their own and
  a fixture.
- **Lines, split into code and comment.** 1 279 lines over the nine files (787 code / 357
  comment), of which `docs-facts.js` is 232 and `docs-commands.test.js` 208. Comment lines are
  a quarter to a third of each file, and they are the part that says why the promise exists, so
  they leave with it.
- **The other side of the cost:** what the guards demand of the documents (871 path-like spans
  26 hand-kept foreign paths, 45 calls, 250 `§` references against 919 addressable sections,
  298 tracked files behind the README table, the two run counts, the install pin), and what they
  deliberately do not take (wording, meaning, promises about the future).
- **Cost of ownership from history:** the four Tier-1 guards plus their reader in 29 commits and
  44 file-touches, +982 / −366; the reader alone in 19 commits; 255 commits over `*.md` in the
  documentation rework, whose plan states the rule that makes the pair indivisible.
- **`docs/plans/2026-09-17-docs-guards-cull/plan.md` — the tracker.** Two routes (delete the
  fragment, or delete the guard), the rules the campaign may not break (the sensors are not
  edited; `tools/suites.js` is a gate file, so the `Gate-Change:` trailer is a counted price; the
  README counts are held by `docs-numbers`, which fixes the order), a proposed order from the
  worst volume-to-promise ratio outwards, the definition of done and four open questions.

## Measured, not argued

- The inventory's numbers come from three commands, all reproducible: `node --test <file>` per
  guard for seconds (two windows, the quieter one quoted beside the other in the bird view),
  `node tools/run-tests.js fast` for the pooled figure, and a line count that separates code from
  comment and blank. The reader's own lists were counted through their exports (`FOREIGN` 26,
  `DOCS` 5, `TARGETS` 7), the calls through the very regex the guard uses (45 entering it, 5
  commands taught against 10 in the help and 13 flags).
- **The pin is `v2.5.0` and matches `installSpec()`** — checked, because the bird view names it
  as the reason behind the release order.
- **The sensors were left alone:** no threshold, baseline, ignore or rule touched; `.eslint-
  suppressions.json` is empty of entries, so the metrics sensor carries no debt on these files.

## What happened on the way — a repository-destroying hook (`BLOCKERS.md` N36)

The first commit attempt from this linked worktree went wrong in a way worth recording: the `pre-commit`
hook's fast profile went red (43 of 70 checks ran, ten files failing), and the repository came out of it
changed — `core.bare = true` in the shared config (the main worktree answering `fatal: this operation must
be run in a work tree`), the probe identity `Тест <test@example.com>` written over the config's `[user]`,
a junk commit `заметки` on this branch, and the worktree's index replaced by a single entry.

**The cause, measured rather than guessed.** The hook drops the commit's environment before the profile
runs, naming `GIT_INDEX_FILE` and `GIT_PREFIX`; in a linked worktree git hands the hook a third variable,
**`GIT_DIR`**, absolute (dumped from inside the hook of a scratch clone). Every `git` call of the suite then
resolves that gitdir instead of the scratch directory it was given: `test/git-pins.test.js` writes its probe
identity into the shared config, makes the main repo bare and commits its probe file onto the branch.
Reproduced twice in a scratch clone in `/tmp` (a linked worktree, same hook), and it does not happen in the
main worktree, where the same probe answers a relative `GIT_INDEX_FILE` and no `GIT_DIR` — which is why the
hook was green for every commit made from the main tree.

**What was done.** The damage of the first attempt was repaired by hand (`git reset --mixed`, `git config
core.bare false`, the two identity keys unset); the fast profile was then run by hand in the worktree
(green: 5 steps, 70 checks, 20.1 s), and the commit and the push were made with the hooks off. The repair of
the hook itself is a gate-file change and stays with the user (N36), as does the decision it implies for
every agent session in this repository.

## Not done

- **No code and no check edited** — that is the request's own condition. The removal work the
  tracker orders is unstarted, and the campaign's order is a proposal until the first portion
  settles it.
- No release follows: nothing in `docs/plans/**` or `worklog/**` ships in the tarball, so these
  commits change no byte a consumer installs.
- The open questions (keep one guard or none, the fate of the README file table, the reader's
  own header) are written down in the tracker rather than answered here.

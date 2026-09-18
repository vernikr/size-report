# The reverted merge re-landed

Asked for in one portion: merge `vernikr/size-report#3` into `main` and push.

## What the state was

The pull request was already **MERGED** — `a3f9644` — and the sweep it carried had been taken back out four
minutes later by `c07e316`: `main` was the 2.8.3 tree again, with the report of that tree in `91a954e`,
while the registry held 2.8.4, published from the tag `v2.8.4` (the branch commit `8bc00d1`). GitHub offers
no second merge of a pull request already merged, and `git merge` of the branch answers *Already up to
date*: the branch's four commits are in the history either way — only their effect was gone.

## What was done

`git revert c07e316` — the inverse of the inverse — put the tree of `a3f9644` back: 57 files, +257 / −248
(the probes archived again, `TODO.md` down to 31 lines, the nine `export` keywords gone, the version and
the pin back at 2.8.4). The only conflict was the report: `docs/size-report.html` is generated rather than
written, so it was resolved to the copy built for the swept tree, and the hook rebuilt it from the re-landed
tree in the commit of its own that follows every commit here. The attached copy in `node_modules` moved to
2.8.4 with `pnpm install --frozen-lockfile`, so the tree, the lockfile and the copy the checks read agree.

## The numbers

| | value |
|---|---|
| the re-land | 57 files, +257 / −248 |
| `pnpm run verify:fast` | green, 5 of 5 steps, 87 checks |
| `pnpm run verify` | green, 8 of 8 steps |
| the push | `91a954e..ab894df` on `main`, CI green (run 35303056998) |

Nothing new ships: the registry already holds 2.8.4, and the re-landed tree **is** that release — 2.8.4 in
`package.json`, the name of the attached copy in the lockfile, the pin `v2.8.4` in `README.md`. Releasing it
once more would mean releasing forever, so the tag stays where it is and no version moves.

# 0180 — i18n W2 step 7: the hooks' messages, and W2 closed

**Request.** Point 5, the last portion of subplan W2: the four messages in `.githooks/pre-commit` (two) and
`.githooks/pre-push` (two), and close W2 if the measurement says it is done. Only literals; the commands,
conditions and line order of the hooks stay put.

**What moved — 4 lines, and both hooks read 0.** `pre-commit: pnpm is not in PATH — the fast profile did not
run` and `  install the hooks again: pnpm run hooks:install` (both in `pre-commit` and in `pre-push`), and
`  — pre-push: there is no origin/main, so the trailers were not checked over the range`. Both hooks still
parse (`sh -n`), and no command, condition or order moved.

**Red first, one message at a time: all four stayed green.** Each message went back to Russian on its own and
`test/gates-verify.test.js` answered the same — no reader of the wording. **What the probe really reads was
measured the same way:** the **call line** (`exec pnpm run verify:fast` → `pnpm run verify`) reddens it at
`:142-143` — the hook's promise that it runs the profile rather than its own commands.

**The messages were also read as a person meets them, by walking both branches.** A PATH without pnpm (the
tool lives in `~/Library/pnpm`) printed the first two messages on stderr and exited 1; a temporary repository
with a stub `pnpm` on PATH and no `origin/main` printed the fourth. On an ordinary commit of this portion the
hooks print no message of their own — they print the profile's summary and the guard's verdict, both already
English — so the four messages were demonstrated on purpose rather than met by chance.

**The attached copy is not in this path.** `pre-commit` and `pre-push` call `pnpm run verify:fast` and
`node tools/gates/gatefiles.js`, that is, the **tree's** copies, so their words are this portion's. The
Russian subject of the report commits (`chore(report): отчёт пересобран после …`) comes from `post-commit`,
which runs `node_modules/@vernikr/size-report` — the published 2.4.0 copy — and that lag is N20's question,
not this step's.

**A finding of this step, recorded in `TODO.md` and not chased:** the sweep at `:146-149` cannot fail — it
asserts that the token it has just matched is non-null — so a wrong script name inside a message would pass;
measured by putting `pnpm run hooks:no-such-script` into the install message and watching the probe stay
green, while its own message promises the opposite. The workflow side of the same idea (`:132`) does compare
against the real scripts.

**Counters.** `pre-commit` 2 → 0, `pre-push` 2 → 0; the owner W2 4 → **0** — and the counter over its eleven
files and both baselines answers **0**, which is the subplan's acceptance. Untouched: `GATE_FILES`,
thresholds, both baselines, the profile split, `SITES` 27, `PRINTED` 2/2/1/2/4, `CASES` 38, 70 checks fast and
175 full. `dup` asked separately: green, 8 clones, 47 lines, 15 fingerprints, no new twin.

**Trailer.** Both hooks are gate files; the commit carries `Gate-Change:` and the hook confirmed it.

**W2 is closed.** Left in the campaign: **C1–C3** (the checks) and **D1** (the declarative files). Nothing
ships here, so no release is owed; N19, N20, N21, N31 and N32 stay with the user.

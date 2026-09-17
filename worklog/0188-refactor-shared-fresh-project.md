# 0188 — refactor: the fresh project both the minifier's and the tokens' check start from

Requested: the user's decision on `BLOCKERS.md` **N33** — the translation of C2's steps 4–5 turned a
pre-existing accepted clone pair (`test/minify.test.js` ↔ `test/tokens.test.js`) into a *new* clone for
the `dup` sensor, because a fingerprint is a shape and a translation is a different shape. The chosen
way: **take the shared part out** (the sensor's own advice, and the repair N29 took).

Done:
- `tools/harness.js` — one new helper, `draftedRepo(dir, code)`, next to `initRepo`: a fresh project
  (`initRepo`) + the file under measure + the two git commands + `--init` + the assertion that the draft
  was built, returning `{ dir, file }`. The one literal that moved out of the two checks is the commit
  subject; it is now the helper's own (`the first commit`) and nothing asserts on it.
- `test/minify.test.js` and `test/tokens.test.js` — the hand-rolled setup (seven lines each, four of
  which were already what `initRepo` does) and the `--init` call with its assertion became a two-line
  call; `draftedRepo` was added to the import list of both.

Measured: both files green (9 + 7 checks), `dup` green with the count **falling** rather than rising —
`clones 7, lines 42` before the refactor (measured with the two files as at `HEAD`: the pairs are
accepted twins of the baseline) and `clones 5, lines 29` after it; no new clone, and no baseline was
touched. The two files' checks assert the same numbers as before, so nothing of what they measure moved.

This is a code change rather than a translation, which is why it is a commit of its own (the portion's
own commit follows); no gate file is in it, so no `Gate-Change:` trailer.

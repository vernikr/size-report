# Release 2.6.0 — the page stops weighing like the history

What was asked: publish the portion that reworked the report page (the twelve steps of
`plans/2026-09-17-page-perf/`, of which nine landed and three were measured and refused), and move the
version in this repository with it. Version by SemVer, a section in the journal saying what changes in
the numbers, the pin in `README.md`, the tag placed before the commit and moved onto it, one push with the
tag first.

## What changes in the numbers

- **The page: 1 899 370 B → 85 955 B for this repository's history** (−1 813 415 B, −95.5 %, 22.1 times
  smaller). Both sides were written by the two engines into the *same* target path from the same index, so
  the difference is the engine and not the project: `before` is the report `@vernikr/size-report@2.5.0`
  writes, `after` is the report this tree writes.
- **What is inside the smaller page:** the data block 49 392 B (`base64+gzip`, `schema: 2`), the UI strings
  1 673 B, the program 28 007 B, the styling 6 172 B, the markup 711 B. In the 2.5.0 page the same parts were
  1 842 349 / 1 593 / 40 275 / 14 474 / 679 B — the data was a list of rows, not a packed block.
- **The click no longer costs a table:** a filter rewrites the nodes in place and recomputes the totals, the
  columns carry widths computed before the first node under a fixed layout, and the state is written once
  per commit rather than per cell.
- **Two candidates were measured and refused, with proof of the refusal:** `content-visibility: auto` does
  nothing on a table row in Chrome 153 (0 of 200 rows skipped, against 138 of 200 divs in the control), and
  `border-collapse: separate` buys ~8 % of the first layout at the price of every border in the grid going
  soft (one pixel at `210` becomes two at `233 + 233`). Fixed layout (step 09) stayed: it moves width
  assignment from 831–979 ms to 0.1 ms although it does not reduce the number of layout passes.
- **The contract loses fields** (breaking for a reader of `--data`): `metrics[].accuracy` and the `approx`
  bit map are gone, and with them the division of numbers into exact and approximate ones. The schema
  numbers do not move: `1` for the contract, `2` for the packed block.
- **The checks grow with the work:** 70 → **81** in the fast profile, 175 → **186** in the full one;
  `verify:fast` and `verify` (8 steps, 97.1 s) are green on the release commit.
- **The package:** 2.5.0 → 2.6.0, the tarball 48 entries / 139 347 B packed / 414 275 B unpacked as built
  here; the pin in `README.md` moves with it (`installSpec()` → `github:vernikr/size-report#v2.6.0`).

## Why MINOR, not MAJOR

The user chose MINOR. By the repository's own rule (`feat` → MINOR) the portion carries a feature — the
page is a program now, it draws the tree, the fold and the checkboxes itself — while the fields that leave
the contract were counted by nobody but the page: the splitting of numbers into exact and approximate was
removed from the project by the same portion that removed their only reader.

## Done

- `package.json`: the version; `README.md`: the release line, the note of what changes in the numbers, and
  the pin in both places that name it; this entry.
- The tag `v2.6.0` was placed before the release commit and moved onto it afterwards; the push is one
  command, `git push origin v2.6.0 main`.
- The report of this repository is rebuilt by hand for the release: the attached copy is still 2.5.0, so the
  `post-commit` hook would write the pre-portion page over the new one. Its line is switched off in the
  working tree for the length of the release and goes back with the commit that attaches the released copy.

## Measured after the release

- **The published tarball is what the tag holds — all of it.** `npm pack @vernikr/size-report@2.6.0` was
  compared file by file with `git show v2.6.0:<path>`: **48 of 48 byte-identical**, and the tarball's sha1
  `a0770fe9c5fe0aee8c8f5b40436ecc9327a8af30` is the `dist.shasum` the registry answers. The manifest's keys
  are the same 18 on both sides (npm re-orders them; it adds and loses nothing).
- **The runs:** CI on the tag green (`35241768642`), CI on `main` green (`35241768421`), and the Release
  workflow green in 1 m 2 s (`35241768908`) — it published with a provenance statement
  (`logIndex 2878946948`) and `npm notice + @vernikr/size-report@2.6.0`; `latest` moved to `2.6.0` five
  polls later.
- **This repository's page is built by the attached copy again:** the `post-commit` hook rebuilt it after
  the attach commit and committed it as `494c678` (86 085 B, md5 `8dfb0b2883161760c86d36c88e39a095`). The
  packed block of that page decodes to `schema: 2`, `tool {name, version: "2.6.0"}` and the keys
  `schema, tool, report, hrefPrefix, strs, metrics, cats, files, catalog, rows, last, hist` — no `approx`
  and no `accuracy` anywhere in the contract (the two words survive only inside commit subjects of `strs`).
- **The hook is back on in the working tree** (`git checkout -- .githooks/post-commit`): the line was
  switched off only while the attached copy was older than the tree, which is the window this release
  closed.

# The string work: subplan C3 (the guard checks) planned, and a table that is a contract

**Requested:** the next subplan of the settled order — C3, the checks of the repository itself
(`docs/plans/2026-09-16-i18n-english/tests-guards.md`, 226 lines in fourteen files). Same rules as
S1–C2, with both halves of C2's rule applied to every literal and every regex. Tracker update and this
entry included; no open N-number touched.

**Done.** `tests-guards.md` written; the tracker's C3 row marked **written 2026-09-16**; the
"what is left" block now lists only D1, W3 and G1 (the checks are complete: 355 + 739 + 226 = 1 320,
the whole of `test/**`).

**The counts hold:** 26+26+23+22+16+16+16+16+14+13+12+12+8+6 = **226**, file by file. **Six of the
fourteen are gate files** (`test/gates-[a-z-]+\.test\.js` matches the gate list) — 111 of the 226
lines — so those commits carry the `Gate-Change:` trailer, and the acceptance says so.

**The finding: `README.md`'s code table is a contract, not a quotation.** The tracker's allow-list
counts `README.md`'s four Russian lines as "quotations of printed Russian". Measured while planning
C3, one of them — the code-2 row with the cause names — is **parsed by `readmeCauses()` and compared
with `CONFIG_CAUSES`**, so S1's rename edits it in the same commit and the cell shrinks as S1's, S4's
and S5's steps land (the `!` note's quotation and the hook's subject are the other two). The cell reads
18 today and is marked in the tracker for re-measurement once those steps are done, so that a stale
number is not read as a promise. S1's plan had already named both readers (`surface.md:83,84`), so this
is an accounting correction rather than a missed reader.

**Both halves of C2's rule, measured here: this owner has no negative match at all.** The grep for a
Cyrillic regex together with `false`/`doesNotMatch` over the fourteen files answers nothing, so the
first half has no case and the plan states the absence rather than leaving a reader to look for it. The
neighbouring half — a negative match over allow-listed data is not touched — is illustrated by the
owner next door only.

**One tolerance kept, and decided rather than left loose.** `namedSection()` in
`test/docs-commands.test.js` resolves a reference that names no document by the word of its sentence
in two languages (`требовани|requirements?`, three regexes), and the file's own comment explains why:
documents were translated one by one, and a reference the check stopped resolving would pass **in
silence**. Measured today the Russian alternative matches nothing in the tree — no document cites a
section in Russian, `docs/requirements.md` and `docs/module-design.md` carry no Cyrillic, and the only
instances are in the prose of the docs-rework plan, which is allow-listed. Decision: **keep it** and
name it as C3's exception for the guard G1, with the price of the other option written down — dropping
it is a coverage change rather than a literal one, because the check would again pass a Russian
citation in silence, and it buys nothing but a smaller allow-list.

**Reader lines, one by one.** The eight W2 verdict reads (`test/gates-files.test.js:77,106,115`,
`gates-dup:72,88`, `gates-coverage:49,63`, `gates-deps:48`, `gates-metrics:144`) are W2's to move and
C3's to verify; S1's are `docs-commands.test.js:36` (`usageCauses()` splitting on the help's block
name), the `README.md` row, `:147` (the internal error of `refuseCause`) and `parity.test.js:57` (the
summary shape); D1's is `.gitignore` read by `gates-verify.test.js:155`; W2's are the hooks' call
lines at `:142-144`; and the counters (`docs-numbers`' `test(` counts, `SITES`/`PRINTED`,
`git-pins`' pinned settings in `src/git.js` and `tools/gates/common.js`) may not move — they are the
free proof that no source literal and no count was touched.

**Checks:** `pnpm run verify:fast` green. This turn changed plans, the tracker and the journal only —
no code, no test, no gate file. Nothing here ships.

**Offered next:** D1 (`configs.md`, 131 — the workflows, the templates, `package.json` and the
dotfiles, two of them gate files, and the two workflow step names `test/release.test.js:62,66` reads),
then W3 (89, gated on N21) and G1, the guard that closes the allowance.

# The string work: subplan S4 (the diagnostics) planned, and the frozen skip words measured exactly

**Requested:** the next subplan of the map — S4, the diagnostics layer (`src/git.js`,
`src/history.js`, `src/check.js`, `src/explain.js`, `src/doctor.js`) — as
`docs/plans/2026-09-16-i18n-english/diagnostics.md`, by the owner of the files. Same rules as
S1–S3, plus two of its own: N24's options listed with their price but **left open**, and the plan
has to show how the tree avoids going red between the commits of this layer. Tracker update and
this entry included.

**Done.** `diagnostics.md` written (five files, 84 lines with Cyrillic: `src/git.js` 3,
`src/history.js` 12, `src/check.js` 12, `src/explain.js` 24, `src/doctor.js` 33), the tracker's S4
row corrected and marked **written 2026-09-16**, and the N24 note in `BLOCKERS.md` **corrected by a
better measurement**.

**How the tree stays green — the order is the answer.** Every S4 literal except one reaches no
reference: `--json` and `--data` carry no refusal, coverage or doctor text, and the artifact
deliberately leaves the skipped list out (`NOT_IN_FILE = ['skipped']`, `src/page/build.js:92`). The
exception is `SKIP_WORDS` (`src/history.js:18`), and it is **not in any of the first three steps**:
steps 1–3 (the git boundary and the two disk violations; the coverage and the explanation; the
diagnostics) land green one commit at a time, and the frozen line waits for its own gated step 4.
That is written out in the plan as a rule rather than left to the person doing the work.

**N24 measured exactly, and my earlier note was wrong about which sensor reddens.** A translation of
`SKIP_WORDS` makes `test/parity.test.js` (the package's `--json` against `fixtures/synthetic/golden.json`,
byte for byte) and `test/contract-data.test.js:47` (`data.skipped` against the same golden) red — and
with them `test/frozen.test.js`, which runs the **frozen copy** and requires *its* `--json` to equal
the golden: the copy keeps matching while the package stops, which is precisely the red that
reference exists to produce. But `pnpm run check:standards` stays **green**, because both references
are re-taken by the generators and the generators call the frozen copy (`legacyTool()`), not the
package; and `fixtures/parity/artifact.sha256` does not move either, because the artifact leaves the
skipped list out. The three options were restated with that price: moving the three words into the
locale dictionaries (nothing reddens — the fixtures pin `locale: "ru"` — at the cost of a source
change and English for a project that asks for `en`), translating and re-taking the expectations by
hand (the red moves into the reference's own promise, and the generators cannot pay it), or the
allow-list (cheapest, one Russian word per reason stays in `--json`/`--data` for every locale). The
choice stays with the mission agent; the plan decides nothing.

**The readers are named one by one, including the machine ones and the absences.** Two the plan calls
out: the `!` note about a report updated together with code has **no reader at all** (measured:
`rg -n 'обновляли вместе' src test tools` answers inside `src/history.js` alone), so its experiment is
the grep rather than a test; and the three cause arguments of `src/explain.js` follow S2's rule — they
are renamed in S1's step 3 or not at all. Boundaries in both directions are named as well: the hook's
commit subject is asserted by `test/hook.test.js:191,254` and belongs to S5, while `outsideFix` and
`derivedSummary` are S2's words printed by `src/check.js:119`, `src/explain.js:78` and
`src/doctor.js:97` — S4 translates the sentences around them and never their words. The two spellings
of the settings fix (`закрепите их файлом: ` here, `закрепить их файлом (…): ` in S2) stay distinct,
because `pnpm run dup` is the guard of that distinction.

**The expected green of `pnpm run verify` for steps 1–3 is measured:** no frozen reference carries a
message of this layer, and the two matches for the word `слияние` in the frozen data are a commit
subject of another project's history (`fix(size-table): слияние — коммит как коммит: …`), not a
message of this tool.

**Checks:** `pnpm run verify:fast` green (5 steps, 70 checks). Nothing ships — plans and  blocker
notes are not in the tarball — so there is no release, said in the commit. No code, no test, no gate
file touched.

**Offered next:** `automation.md` (S5 — the hook, the panel's service words, the post-install note),
which would close the published runtime, then the instruments (W1), the sensors (W2), the fixture
builders (W3, gated like N21/N24) and the checks (C1–C3), then the guard (G1).

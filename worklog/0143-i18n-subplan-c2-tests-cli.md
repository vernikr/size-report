# The string work: subplan C2 (the CLI checks) planned, three unnamed readers found, and the order settled

**Requested:** the next subplan of the map — C2, the checks that drive the tool
(`docs/plans/2026-09-16-i18n-english/tests-cli.md`, 739 lines in fourteen files). Same rules as
S1–C1, plus C1's rule applied to every literal **and every regex**: a negative match over a printed
text is a reader too. And one more thing: the map's order has contradicted itself twice already
(the twelfth instrument, D1 against the table), so this portion had to settle the order of the
remaining subplans once. Tracker update and this entry included; open N-numbers untouched.

**Done.** `tests-cli.md` written; the tracker's C2 row marked **written 2026-09-16**; the **Order**
section of the tracker rewritten as a decision with the table as the only authority; **three
unnamed readers** written into `surface.md` (S1) and `diagnostics.md` (S4) as measured corrections.

**The counts hold, file by file:** 113 + 84 + 83 + 79 + 75 + 68 + 54 + 41 + 33 + 31 + 26 + 25 + 18 + 9
= **739**, the tracker's number. This owner is where the promises of S1–S5 are read back, so the plan
is largely a consolidation of readers those plans already named — and it verifies them at step 0
rather than re-opening them, because by the map's order those texts are already English.

**The find of this portion: four negative matches over printed text, and three of them are named by
no plan.** `test/check.test.js:184` asserts that the benign `check` mode's text carries no fix command
(`/починка:/` false — S4's text); `test/check.test.js:235` asserts that the cause `нет такого коммита`
does **not** appear where the commit is known but outside the report (S1's cause);
`test/disk.test.js:219` asserts that the sentence about carried-over state does not appear out of place
(S4's text). Only `test/cli.test.js:69` (S2's derived line) was already named, in `settings.md:92`,
with its reason. Each of the other three goes vacuous the moment its text turns English: the regex
matches nothing whatever the tool says and the assertion stays green forever. The fix belongs to the
step that moves the text, so the correction is written into S1's and S4's own plan files — the way
S3's was corrected while planning C1.

**The distinction that makes the rule usable, and it is measured:** a negative match over
**allow-listed data** does not rot. `test/minify.test.js:124` (`indexOf('приближение') < 0`), `:195`
(`indexOf('esbuild недоступен') >= 0`) and `test/tokens.test.js:113` (the same in `tokens`) all read
the `ru` dictionary's `method` field — data, which no subplan moves. So the rule is stated in two
halves: a negative match over a **translated** text is re-pointed in the same commit; a negative match
over **data** is not touched at all.

**A joint line that crosses to a subplan planned later.** `test/release.test.js:62,66` fetch two
workflow steps by their Russian names, and the workflow belongs to **D1** — which, in the order settled
today, comes after C2. The rule that makes that safe is the one S5's plan used for the hook's subject:
a reader inside another owner's file follows the **text**, so D1's commit edits those two lines itself,
and the order cannot break it. `test/templates.test.js:82,84` read `templates/README.md` by **file
name** only (measured), so no prose of D1's is frozen by a check.

**The order, decided once and written down.** The table's row order has been the one used (T0, S1–S5,
W1, W2, C1), so the Order section now follows it and says why: S1→S5 (the paying reader first),
W1→W2 (instruments, then sensors with their trailer), C1→C3 (the checks last of the code), **D1**
(declarative files: CI and the registry, two gate files, and the two workflow step names a check
reads), W3 (the fixture builders, gated on N21), G1 (the guard that closes the allowance). The
sentence that made the two readings differ — D1 grouped with W1 in step 2 — is gone, and the section
now ends with the rule that a portion follows the row order of the table. It is the third time this
map's own two readings diverged (the twelfth instrument became eleven, `.githooks/**` and the dotfiles
had no row); the first two were corrected by measurement, this one by a decision.

**Checks:** `pnpm run verify:fast` green. This turn touched plans, the tracker and the journal only —
no code, no test, no gate file. Nothing of this owner ships, so the portion releases nothing.

**Offered next:** C3 (`tests-guards.md`, 226 — where the eight assertion lines W2's steps move with
their verdicts are verified, and the numbers table of `README.md` is met), then D1 (131, the
declarative files and the two workflow step names), W3 (89, gated on N21) and G1, the guard that
closes the allowance.

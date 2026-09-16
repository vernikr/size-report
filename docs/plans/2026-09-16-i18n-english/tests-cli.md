# C2 — `tests-cli`: the checks that drive the tool

Subplan of `plan.md` (T0). Owns fourteen checks, **739 lines measured** — `hook` 113, `check` 84,
`doctor` 83, `cli` 79, `minify` 75, `disk` 68, `tokens` 54, `release` 41, `templates` 33,
`cli-paths` 31, `refusals-catalog` 26, `refusals` 25, `environment` 18, `crlf` 9 — the tracker's row,
confirmed file by file (113+84+83+79+75+68+54+41+33+31+26+25+18+9 = 739). Written 2026-09-16, not
started.

By the map's order S1–S5, W1 and W2, C1 have landed before this one, so these files are where the
promises of the printed runtime are **read back**: every subplan above named the lines of this owner
that quote its texts. This plan gathers them, adds the readings nobody named, and keeps the rule
found while planning C1: **a negative match over a printed text is a reader too**.

## Scope, by measurement

```
for f in hook check doctor cli minify disk tokens release templates cli-paths refusals-catalog refusals environment crlf; do
  printf '%5s %s\n' "$(rg -cP '[\p{Cyrillic}]' test/$f.test.js)" "test/$f.test.js"
done
```

| File | Lines | Whose printed text it reads |
|---|---|---|
| `test/hook.test.js` | 113 | S5's (install, subject, state `why`, the `✗ size-report: ` prefix) |
| `test/check.test.js` | 84 | S4's (`coverageText`, `explainText`, the disk violations) and S1's causes |
| `test/doctor.test.js` | 83 | S4's (the answer) and S2's/S3's texts it prints |
| `test/cli.test.js` | 79 | S1's (help, grammar refusals) and S2's derived line |
| `test/minify.test.js` | 75 | **both** the `ru` dictionary and S3's `sensorGaps` — the split S3's plan describes |
| `test/disk.test.js` | 68 | S4's two violation refusals |
| `test/tokens.test.js` | 54 | the dictionary and S3's notes, same split |
| `test/release.test.js` | 41 | **D1's** workflow step names, by exact string |
| `test/templates.test.js` | 33 | D1's templates (file names only), by exact string |
| `test/cli-paths.test.js` | 31 | S4's disk text through a path |
| `test/refusals-catalog.test.js` | 26 | W1's maps and the **sources' shape** (`refuseCause('…')`, `'✗ `) |
| `test/refusals.test.js` | 25 | W1's `adviceOf`/`ADVICE_LINE` and the catalogue's `must` phrases |
| `test/environment.test.js` | 18 | the fixture's golden data |
| `test/crlf.test.js` | 9 | the fixture's golden data |

## Read by another owner

**(1) Positive reads of printed texts — the owner of the text moves the line.** Every one of these is
already named in the plan of the subplan that prints it (measured against the plan files): S1 names
`cli.test.js:33,189,193,246,297`; S2 names `cli.test.js:45` and `doctor.test.js:64,132`; S3 names
`minify.test.js:181,182,195,215,217,223,236` and `tokens.test.js:105,106`; S4 names
`check.test.js:52,72,101,103,109,139,191,192,193,218,220,232,242,247,249,254,255`,
`disk.test.js:107,112,133,140,142,193,195,270,272`, `cli-paths.test.js:93,103` and the long list of
`doctor.test.js`; S5 names `hook.test.js:136,151,191,254,295,308,323,339`; W1 and W2 name the
catalogue's readers. Nothing is re-opened here — C2 **verifies** at step 0 that those lines are
English, and the verification is in the acceptance.

**(2) Negative matches over a printed text — four, and three of them are named by no plan.** This is
the rule C1 found, applied to this owner, and the measurement is exact:

| Line | Reads | Owner that must re-point it |
|---|---|---|
| `test/check.test.js:184` (`assert.equal(/починка:/.test(text), false, …)`) | the marker of the **benign** `check` mode's text (`src/check.js`) | **S4 — unnamed in every plan** (S4 named `check.test.js:52,72,…` and not `:184`) |
| `test/check.test.js:235` (`assert.ok(!/нет такого коммита/.test(away.stderr), …)`) | S1's cause name | **S1 — unnamed in every plan** |
| `test/disk.test.js:219` (`assert.equal(/перенос состояния/.test(res.stderr), false, …)`) | S4's sentence | **S4 — unnamed** (S4 named `107,112,133,140,142,193,195,270,272`, not `:219`) |
| `test/cli.test.js:69` (`assert.equal(/настройки выведены из проекта/.test(again.stderr), false, …)`) | S2's `derivedLines` | S2 — **named** in `settings.md:92`, with its reason |

Each of the three unnamed ones goes vacuous the moment its text turns English: the regex matches
nothing whatever the tool says, and the check stays green. The fix belongs to the step that moves the
text, and the correction is written into `surface.md` (S1) and `diagnostics.md` (S4) by this portion —
the same way S3's plan was corrected while planning C1.

**The distinction that makes the rule usable: data does not rot.** A negative match over an
**allow-listed** string stays a real check, because the string does not move:
`test/minify.test.js:124` (`min.method.indexOf('приближение') < 0`), `:195`
(`indexOf('esbuild недоступен') >= 0`) and `test/tokens.test.js:113`
(`view.method.indexOf('недоступен') >= 0`) all read the `ru` dictionary's `method` field, and the
dictionary is data. So the rule is stated in two halves: a negative match over a **translated** text is
a reader that must be re-pointed in the same commit; a negative match over **data** is not touched at
all.

**(3) Exact-string reads of D1's texts — two, and D1 is planned after this one.**
`test/release.test.js:62,66` fetch the workflow's steps by their Russian names —
`step(doc, 'Версия манифеста — в окружение')` and `step(doc, 'Тег называет ту же версию, что
манифест')`. The text is `.github/workflows/release.yml`'s, so **D1's step edits these two lines in
its own commit**, exactly as S5's step edits `test/hook.test.js`'s assertions; the order of the
subplans does not matter to that rule. `test/templates.test.js:82,84` read `templates/README.md` by
**file name** (`note.indexOf(file)`), never by wording — measured, so nothing of D1's prose is frozen
by this check.

**(4) Reads of allow-listed data.** `test/crlf.test.js` and `test/environment.test.js` compare the
tool's `--json` with the fixture's golden text; the fixture labels and the `ru` dictionary's values
are read as expected values throughout (`ui.<key>` appears in C1's files; here the shape is
`goldenText`, `goldenJson`). And `test/hook.test.js:170,173,397,405` match `чужой хук` written by the
test **itself** into its own foreign hook — the test's data, not the tool's text.

**(5) Shape readers — the counters that must not move.** `test/refusals-catalog.test.js` reads the
**sources** (`refuseCause('…')` sites, `'✗ ` marks) and compares them with `SITES`/`PRINTED`;
`test/refusals.test.js` runs the catalogue and extracts advice by the markers; `tools/suites.js`'s
`checksIn` counts the `test(` calls of every file and `test/docs-numbers.test.js` holds that count
against the numbers table of `README.md`. A name or a message is free; a **count** and a **source
literal** are not.

## What stays Russian here

| Item | Why |
|---|---|
| Every expected value read from the `ru` dictionary, the fixture's `golden.json`/`data.json` and the fixture configs | T0's allow-list: a check asserting Russian data asserts the data it exists for. |
| `чужой хук` in `test/hook.test.js`'s own fixtures (170, 173, 397, 405) | The test's own file content, written by the test. |
| The two workflow step names in `test/release.test.js:62,66` | D1's texts: they move with D1's commit, not here. |
| The cause names and `must` phrases quoted anywhere | Their owner's step; by now English, and C2 verifies rather than edits. |

## Steps — one commit each, red first

0. **Re-measure and verify the joint lines.** S1–S5, W1, W2 and C1 have landed, so every positive read
   of section (1) is English and every marker is `fix: `. This step measures the four negatives of
   section (2) and writes down which of them its owner re-pointed; if one was missed, the fix lands
   with its owner (the text is theirs), and the gap is recorded in `TODO.md`/`BLOCKERS.md` rather than
   patched inside a check. The counter's baseline for the fourteen files, and the check count per file
   from `tools/suites.js`'s `checksIn`, go into the journal.
1. **`test/refusals.test.js` (25) + `test/refusals-catalog.test.js` (26).** Red first: narrow
   `ADVICE_LINE` to the English markers (W1's last step) with one refusal still printing a Russian
   marker → `adviceOf` returns nothing and the catalogue's advice assertion reddens in
   `test/refusals.test.js`; and rename a `must` phrase in `tools/refusals.js` alone → the same check
   reddens. These two files are the harness of that promise, so their own messages are translated last
   within their step, after the experiment.
2. **`test/crlf.test.js` (9) + `test/environment.test.js` (18).** Red first: the golden comparison is
   data; the experiment is the counters and `pnpm test` staying green, plus one name rename proving
   `checksIn` counts calls rather than names.
3. **`test/cli-paths.test.js` (31) + `test/cli.test.js` (79).** Red first: translate
   `test/cli.test.js:45`'s read alone → S2's own step would have reddened it; here the check is that it
   is already English, and the negative at `:69` still guards the absence of a derived line once a file
   is pinned.
4. **`test/templates.test.js` (33) + `test/release.test.js` (41).** Red first: change one workflow step
   name alone in `.github/workflows/release.yml` → `test/release.test.js:62` or `:66` reddens (that is
   D1's experiment, quoted here so its owner has the red ready).
5. **`test/minify.test.js` (75) + `test/tokens.test.js` (54).** Red first: translate the
   **dictionary**'s `method` instead of the sensor's note → `:195` (`esbuild недоступен`) and
   `tokens.test.js:113` redden against the Russian data; then leave them alone. This is S3's trap seen
   from the check's side, and it is the one place in this owner where the wrong target is tempting.
6. **`test/doctor.test.js` (83).** Red first: the long list of S4's reads — pick `/не спрашивается/`
   (a dependency note) and translate it alone in `src/doctor.js` → reddens.
7. **`test/check.test.js` (84) + `test/disk.test.js` (68).** Red first: the three negatives of section
   (2) are the experiment — with the text already English, each has to redden when the sentence it
   names comes back, which is what makes them guards rather than tautologies; the step records how the
   red was produced (a temporary re-inserted word in a scratch copy, never in the tree).
8. **`test/hook.test.js` (113)** — the largest file, and the one S5's plan named most precisely; the
   step verifies the six reads and then translates the file's own names and messages.

**Why the tree is green between the commits.** The printed texts moved in earlier steps, and every
line that reads one of them is either already English or waits for its owner; the data reads stay
Russian by design; the counters are untouched. The sensor that can react to this owner is
`pnpm run dup` — 739 lines of parallel messages are the widest field for a twin in the whole work, and
the answer to a twin is a varied wording, never the baseline. Each step runs `pnpm run verify:fast`;
`verify` runs before the portion is pushed, and it is also where the tool-driving checks meet the full
profile.

## Acceptance

- `pnpm test` green, and the number of checks per file unchanged (`checksIn` before and after, plus
  `test/docs-numbers.test.js` holding the table of `README.md`).
- The counter for the fourteen files answers **only** the allow-listed data and the five joint lines
  named above.
- The four negatives of section (2) still guard: each reddens when the sentence it names is put back,
  and the three that no plan had named are written into `surface.md` (S1) and `diagnostics.md` (S4) so
  their steps carry them.
- `test/refusals-catalog.test.js`'s counts and `SITES`/`PRINTED` are unchanged, which is the free
  proof that no source literal was touched.
- `pnpm run verify:fast` after every commit, `pnpm run verify` before the portion is pushed;
  `pnpm run dup` and `pnpm run metrics` green (a message is not a check's weight).
- Every line of section (3) moved with D1's commit, or the acceptance says in words why it did not.

**Release:** checks do not ship (`files` names `bin`, `src`, `templates`, `README.md`, `LICENSE` —
measured while planning W1), so nothing here is released; each commit says so in words.

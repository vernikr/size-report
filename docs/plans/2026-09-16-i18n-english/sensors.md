# W2 — `sensors`: the gate files, and the verdicts their own probes read

Subplan of `plan.md` (T0). Owns `tools/gates/**` (6 files, 77 lines), `tools/suites.js` (38),
`.githooks/**` (4) and the `note` of the two baselines (2) — **121 lines, the tracker's row, and it
holds by measurement** (77 + 38 + 4 + 2). Written 2026-09-16, not started. Unlike W1, this owner is
**entirely gate files**: every commit of this subplan needs the `Gate-Change:` trailer, and that is
not a formality here — it is the shape of the acceptance.

## Scope, by measurement

```
git ls-files tools/gates .githooks | while read -r f; do printf '%5s %s\n' "$(rg -cP '[\p{Cyrillic}]' "$f" 2>/dev/null || echo 0)" "$f"; done; sort -rn
rg -cP '[\p{Cyrillic}]' tools/suites.js dup-baseline.json coverage-baseline.json
```

| File | Lines | What the Russian is |
|---|---|---|
| `tools/gates/run.js` | 21 | the eleven step labels of `STEPS` (35–45), the `:hermetic` mark of a step's name (72), the unknown-profile refusal (87–88) and the profile's own words — the summary header, the `s`/`steps` of the total, the red-steps verdict and its advice (109–123) — **done 2026-09-16, 21 → 0** |
| `tools/gates/dup.js` | 20 | the sensor's verdicts, its advice lines, the names of its two looks, and the baseline's `note` (128–129) — **done 2026-09-16, 20 → 0**, with the `note` inside `dup-baseline.json` (its 1 line) moved with it |
| `tools/gates/coverage.js` | 18 | the verdicts, the totals line, the regression lines, the advice, the gone/new lines and the baseline's `note` (81–84) — **done 2026-09-16, 18 → 0**, with the `note` inside `coverage-baseline.json` (1 line) moved by hand |
| `tools/gates/gatefiles.js` | 7 | the guard's verdicts (61, 64, 76–77, 96, 98) and its advice (66–67) — **done 2026-09-16, 7 → 0** |
| `tools/gates/metrics.js` | 6 | two verdicts, the refusal of a failed run, the overflow line and the advice (37, 63–71) — **done 2026-09-16, 6 → 0** |
| `tools/gates/deps.js` | 5 | the verdicts, the refusal of a failed run, the advice and the "for information" line (26, 47, 51, 53, 56) — **done 2026-09-16, 5 → 0** |
| `tools/gates/common.js` | **0** | measured: the shared harness carries no Russian at all |
| `tools/suites.js` | 38 | the `why` of every entry in `FAST` and `SLOW`, and the unknown-run error (98) |
| `.githooks/pre-commit` | 2 | the "pnpm is not on PATH" message and how to reinstall the hooks |
| `.githooks/pre-push` | 2 | the same message, and the "no `origin/main`" notice about the range |
| `dup-baseline.json`, `coverage-baseline.json` | 2 | the `note` the sensors write into them |

The two baseline lines are the **file side** of the notes whose source is inside the 77
(`dup.js:128-129`, `coverage.js:81-84`): the same text counts once as a literal and once as data, and
the plan treats them as one step each, not as four.

## What is Russian, group by group

**1. The profile runner's labels** (`tools/gates/run.js:34-44`) — eleven descriptions of the steps a
person reads as `▶ <label> — <description>`. Measured as read by no machine: `--list` prints the
**commands** alone (`test/gates-verify.test.js:48` asserts its code and parses the command lines), and
a step's output is not captured at all (the file says so). The same file's verdicts (118, 122) go to
a log.

**2. Five sensor verdicts that their own probes match word for word** — this is what makes W2
different from W1, and the list is exact:

| Verdict in the sensor | Probe that reads it |
|---|---|
| `'gatefiles: правка гейта без трейлера Gate-Change:'` (`gatefiles.js:64`) | `test/gates-files.test.js:77`, `:115` (`/правка гейта без трейлера/`) — **moved 2026-09-16 to `'… : a gate edit with no Gate-Change: trailer'` / `/a gate edit with no Gate-Change: trailer/`** |
| `'✓ gatefiles: коммит можно ставить (…)'` (`gatefiles.js:76`) | `test/gates-files.test.js:106` (`/коммит можно ставить/`) — **moved 2026-09-16 to `'✓ gatefiles: the commit can be made (…)'` / `/the commit can be made/`** |
| `'dup: новых клонов N (…)'` (`dup.js:197`) | `test/gates-dup.test.js:72` (`/новых клонов 1/`) — **moved 2026-09-16 to `'dup: new clones N (…)'` / `/new clones 1/`** |
| `'dup: базы нет (…)'` (`dup.js:139`) | `test/gates-dup.test.js:88` (`/базы нет/`) — **moved 2026-09-16 to `'dup: there is no baseline (…)'` / `/no baseline/`** |
| `'<файл> — <метрика>: было X, стало Y'` and `'не в базе'` (`coverage.js:115-116`) | `test/gates-coverage.test.js:49`, `:63` — **moved 2026-09-16 to `… : was X, now Y` / `was not in the baseline` and `/… was 80, now 50/`, `/… was not in the baseline, now 0/`** |
| `'deps: находок нет (…)'` (`deps.js:53`) | `test/gates-deps.test.js:48` (`/находок нет/`) — **moved 2026-09-16 to `'deps: no findings (…)'` / `/no findings/`** |
| `'metrics: новых нарушений N (…)'` (`metrics.js:63`) | `test/gates-metrics.test.js:144` (`/новых нарушений 1/`) — **moved 2026-09-16 to `'metrics: new violations N (…)'` / `/new violations 1/`** |

Seven verdicts, seven readers, and each goes red the moment one of the two sides moves alone. The
rest of every sensor — the "fix the code, not the sensor" advice lines, the "…for information"
lines, the counting prose — has no reader.

**3. The two baselines' `note`** — written by the sensors when the baseline is re-taken
(`pnpm run baseline:dup`, `pnpm run baseline:coverage`), read by no machine (measured: the probes
mention a note only in a comment, and no test matches it; re-measured for `dup` on 2026-09-16 across
the probes and the hooks). It is a **human** sentence inside a gate file, which is why the plan said
translating it means **re-taking the baselines with their scripts**, the way `AGENTS.md` says they are
updated, and not editing the JSON by hand. **For `dup` that turned out to be wrong, and the measurement
says why** (`BLOCKERS.md` **N31**): the script writes `current.counts`, the committed baseline holds 15
fingerprints while the tree produces 8, so a re-take would prune seven of them — a composition change
rather than a wording one. The `note` was therefore moved by hand, with the fingerprints byte-identical
and the text proved equal to the script's own literals; the pruning is the user's decision. **The same
question was measured for `coverage-baseline.json` in step 4, and the answer is a different one:** its
scripted re-take would neither add nor drop a key (39 keys in, 39 out) but would move **20** metric
values (13 falls and 7 rises over 4 files), so
there too the `note` was moved by hand — and that baseline is already red on the tree, which is
`BLOCKERS.md` **N32**. Two baselines, two failure modes: one would lose keys, the other would rewrite
values.

**4. `tools/suites.js`'s `why`** (38) — one reason per check in `FAST` and `SLOW`, read by
`test/suites.test.js` for its **presence** (`:51`: a file in the full run without a named reason is
red), never for its wording. Plus the unknown-run error (98), which a person meets by a typo.

**5. The two hooks** (4) — the messages `.githooks/pre-commit` and `.githooks/pre-push` print when
`pnpm` is missing from `PATH` or when there is no `origin/main`. Their readers are people: the guards
assert the **call lines** inside those files (`pnpm run verify:fast`, `tools/gates/gatefiles.js` —
`test/gates-verify.test.js:142-144`), not the words around them.

## What stays Russian

| Item | Why |
|---|---|
| The `--list` output and the step commands | Identifiers and shell words, not text: `test/gates-verify.test.js` compares CI's steps with them. |
| The rule names of `deps.js` (`.dependency-cruiser.cjs`'s ids), metric keys (`lines`, `branches`…) and the report schema's keys | Data of the reports and of the config; D1 owns the config's own comments. |
| The reports in `reports/` | Measured: they carry keys and metric names only, no Russian (`tools/gates/common.js:5-7` says they are diffed, not read). |
| The decimal comma of the profile summary (`tools/gates/run.js:111,114`) | Formatting made by code, not a literal — `BLOCKERS.md` N26, the same question W1 met in `tools/run-tests.js`, **decided 2026-09-16 and already applied**: both call sites read `localeNumber(n, 1)` from `tools/harness.js`, so the separator now follows the machine's locale (`ru_RU.UTF-8` → `12,2`, `en_US.UTF-8` → `12.2`) and this step has nothing left to do about it — the comma is no longer a Russian habit of the tooling. |
| `eslint.metrics.config.js` (6), `.dependency-cruiser.cjs` (7), `.gitignore` (4) | D1's declarative files, and gate files of their own. |
| The probes' own Russian (`test/gates-*.test.js`) | C3's checks: W2 edits in them **only** the assertion lines that read a W2 verdict (the seven above). |

## Cross-ownership

| Literal | Owner | Rule |
|---|---|---|
| `test/gates-*.test.js`'s own test names and messages | C3 | W2 touches 8 lines in four probe files (the seven reads, plus `:63`'s second read), named one by one in the steps, and nothing else. |
| `tools/gates/gatefiles.js`'s `GATE_FILES` list and `tools/suites.js`'s split | nobody in this work | Data the sensors' own guards protect (`test/gates-files.test.js`, `test/suites.test.js`): a translation must not touch either. |
| The step labels in `tools/gates/run.js:34-44` and the `why` lines in `tools/suites.js` | one owner, two texts | They describe the same steps in different words, and **no guard compares them** (measured while planning W1). The plan translates both in the same portion and names the drift as a known risk rather than fixing it (that would be a code change). |
| `eslint.metrics.config.js`'s six Russian lines | D1 | A gate file with the trailer, but not this owner's. |

## Readers of every literal

Machine readers, measured:

- the seven probe assertions above — they are the only machine readers of this owner's **verdicts**;
- `test/suites.test.js:23,51` — imports `FAST`, `SLOW`, `checksIn`, `testFiles` and requires a `why`
  per full-run file: the **field** is a contract, its text is not;
- `test/gates-verify.test.js:48,64-79,95-144` — the `--list` commands against `package.json` and
  `.github/workflows/`, and the **call lines** in the hooks and workflows;
- `tools/gates/run.js` — runs the four sensors and reads only their **exit codes**;
- the `commit-msg` and `pre-push` hooks — call `tools/gates/gatefiles.js` with `--commit-msg` /
  `--range`, so the guard's **own** verdicts about the trailer are what a person sees next.

No reader at all, measured: the step labels and every verdict of `run.js`; the advice lines of the
four sensors; `deps.js:56`'s "for information" line; the two baselines' `note`; the four hook
messages; and the `why` texts of `tools/suites.js`.

## Steps — one commit each, red first, trailer on every one

Every commit here carries `Gate-Change: <reason — what changed, by which measurement>`, the shape
`AGENTS.md` asks for and `tools/gates/gatefiles.js` checks (a reason of at least twelve characters,
not a mark). The `commit-msg` hook answers at once; the `pre-push` hook re-reads the range.

0. **Re-measure before starting — done 2026-09-16.** The counter holds to the line: `run.js` 21,
   `dup.js` 20, `coverage.js` 18, `gatefiles.js` 7, `metrics.js` 6, `deps.js` 5, `common.js` 0,
   `pre-commit` 2, `pre-push` 2 (and `commit-msg`/`post-commit` 0, measured), `tools/suites.js` 38,
   each baseline 1 — **121**, exactly the row's own number, and none of W1's decisions moved it.
1. **`tools/gates/run.js` — done 2026-09-16, 21 → 0.** The eleven step labels of `STEPS`, the
   `:hermetic` env mark on a step's name, the unknown-profile refusal, the summary's own words
   (`profile summary “…”`, `total … s (…, steps N)`, `red steps N of M`, the advice to fix the code
   rather than the sensor) and the green verdict. Red first: the absence of a reader was measured
   again rather than inherited — `--list` prints commands and nothing else, the guard
   (`test/gates-verify.test.js`, five checks) parses those command lines and the hooks' **call**
   lines, and a step's output is not captured at all — so the experiment was the profile itself:
   `pnpm run verify:fast` green with the English labels (`profile summary “fast” … total 16.3 s
   (size-report, steps 5)`, `✓ verify: the “fast” profile is green throughout (5 steps)`) and
   `node tools/gates/run.js nope` exiting 1 with `✗ verify: no profile was named, or the name is
   unknown (there are: fast, full, slow)`. The commands are unchanged: `--list slow` still prints
   the same ten lines, which is what CI is compared with. The comma in the summary is gone (N26 decided 2026-09-16: the summary numbers go through
   `localeNumber`, so they follow the machine's locale while the words stay English).
2. **`tools/gates/deps.js` and `tools/gates/metrics.js`** — their verdicts and advice, with the two
   probe reads (`test/gates-deps.test.js:48`, `test/gates-metrics.test.js:144`) in the same commit.
   Red first: translate `'deps: находок нет (…)'` alone → the probe goes red in the same run.

   **Done 2026-09-16 — `tools/gates/deps.js` 5 → 0 and `tools/gates/metrics.js` 6 → 0, with their two
   readers in the same commit.** The five of `deps.js`: the refusal of a failed run (`'deps: the
   analysis did not happen (…)'`, `'no report'`), the findings verdict (`'deps: findings N (M modules,
   K relations)'`), the advice (`'fix the relations, not the rule'`), the green verdict (`'deps: no
   findings (…)'`) and the "for information" line (`'  — for information: '`); the six of `metrics.js`:
   the failed run (`'metrics: the linter did not run (…)'`), the red verdict (`'metrics: new violations
   N (the baseline holds X in Y files)'`), the overflow line (`'    … new violations in all: N'`), the
   advice (`'fix the code, not the sensor; a threshold or a baseline is changed by a person'`) and the
   green verdict (`'metrics: no new violations (…)'`). The two probe lines moved with them
   (`test/gates-deps.test.js:48` → `/no findings/`, `test/gates-metrics.test.js:144` → `/new
   violations 1/`). **Red first, one literal at a time, all ten** (a script that puts each one back to
   Russian alone and runs the whole probe file): only the two green/red verdicts redden their probe —
   `RED ← deps: the green verdict`, `RED ← metrics: the red verdict` — while the refusal, the findings
   verdict, both advice lines, the overflow line, the for-information line and `metrics`' green verdict
   leave the run **green**, which is the measurement of "no reader" rather than a guess. Neither probe
   has a negative match (`assert.equal(/…/.test(out), false)`) over this text — measured: the two files
   hold none at all — so nothing could go empty instead of red here; that hazard is C1's and C2's.
   Thresholds, `GATE_FILES`, the baselines and the profile split are untouched, and both sensors answer
   on this repository as before: `✓ deps: no findings (113 modules, 472 relations)`,
   `✓ metrics: no new violations (the baseline holds 0 in 0 files)`.
3. **`tools/gates/dup.js` — done 2026-09-16, 20 → 0**, with `dup-baseline.json`'s `note` (1 line) and the
   two probe reads (`test/gates-dup.test.js:72` → `/new clones 1/`, `:88` → `/no baseline/`) in the same
   commit. The twenty lines: the fallback reason of a run without a report (`'no report'`), the refusal of a
   failed run, the baseline's `note`, the re-take verdict and its advice, the refusal when there is no
   baseline, the names of the two looks (`'the baseline file'`, `'against <ref>'`), the unpacking failure,
   the failed run over the ref's tree, the missing-ref note, the red verdict, the detail line of a clone, the
   advice and the green verdict. **Red first, one printed message at a time** (each put back to Russian alone
   with the whole probe file run): exactly two redden anything — `'dup: there is no baseline (…)'` (the probe's `:88`) and
   `'dup: new clones N (…)'` (:72) — while the refusal paths, the re-take verdict and advice, both look names,
   the three ref notes, the detail line, the advice and the green verdict leave the probe green. One honest
   caveat about method: the first attempt at the missing-ref note patched the literal into a **syntax error**
   of my own making, which made the sensor fail; patched correctly, that case is green too, so no reader was
   hidden there. The baseline: **the script's re-take was measured and refused** — it would prune seven stale
   fingerprints (15 in the file against 8 in the tree), so the `note` was moved by hand, the fingerprints
   byte-identical and the text proved equal to the script's literals (`BLOCKERS.md` **N31**, the pruning left
   to the user). The sensor answers as before: `✓ dup: no new clones (clones 8, lines 47, the baseline holds
   15 fingerprints; looks 2: the baseline file, against origin/main)` — **the translation moved no finding**,
   which is the step's own acceptance.
4. **`tools/gates/coverage.js` — done 2026-09-16, 18 → 0**, with `coverage-baseline.json`'s `note` (1
   line) and the two probe reads (`test/gates-coverage.test.js:49` → `/… was 80, now 50/`, `:63` →
   `/… was not in the baseline, now 0/`) in the same commit. The eighteen lines: the fallback reason
   (`'no report'`), the refusal of a run that produced no coverage, the baseline's `note`, the re-take
   verdict and its advice, the refusal when there is no baseline, the totals line (`lines 80.6%,
   branches 89.05%, functions 92.37%`), the regressions verdict and its detail lines, the advice, the
   green verdict and the gone/new lines. **Red first, one printed message at a time:** exactly **one**
   reddens anything — the regression detail line, which carries both probe reads — while the other twelve
   (both refusals, the note, the re-take verdict and advice, the totals line, the regressions verdict, the
   advice, the green verdict, the gone and new lines) leave the probe green.

   **The baseline is where this step differs from step 3, and the difference is the finding.** The scripted
   re-take was measured into a temporary file, never over the repository: it would keep the same **39**   keys (0 new, 0 gone) but change **20** metric values — thirteen falls and seven rises over four files —
   because the ratchet is
   already red without this work: `pnpm run cover` answered `✗ cover: regressions 13 (the baseline holds 39
   files)` **before** the translation and answers the same thirteen and the same totals after it. So the
   `note` was moved by hand (one-line diff, `files` byte-identical, the text proved equal to the script's
   four literals), and the red is recorded as **N32** with the thirteen values, the baseline's age (261
   commits since `202c768`) and the price of each answer. Unlike N31, no key would move — the two baselines
   fail in two different ways, which is why the step's own acceptance reads "the sensor answers the same
   way": 13 regressions, 39 files, the totals unchanged.
5. **`tools/gates/gatefiles.js` — done 2026-09-16, 7 → 0**, with the three reads in
   `test/gates-files.test.js` (`:77` and `:115` → `/a gate edit with no Gate-Change: trailer/`, `:106`
   → `/the commit can be made/`) in the same commit. The seven lines: the verdict that the trailer is
   there (`gate files N, the Gate-Change: trailer is there`), the red verdict of a gate edit with no
   trailer, the two advice lines under it, the commit-can-be-made verdict, the range verdict
   (`across <ref>..HEAD there are N commits, none of them touched a gate file without the trailer`)
   and the no-mode refusal. **Red first, one printed message at a time:** exactly **two** redden the
   probe — the red verdict (both its reads) and the commit-can-be-made verdict — while the other five
   (the trailer-is-there verdict, both advice lines, the range verdict, the no-mode refusal) leave the
   probe green, which is the measurement of "no reader". No negative match over this text (measured:
   the probe has no `assert.equal(/…/.test(out), false)`). What the translation did **not** touch: the
   `GATE_FILES` list, the `TRAILER` pattern and `hasTrailer`'s twelve-character reason — the strings
   that decide whether a commit is a gate-file commit stay as they were, so this step reached no
   behaviour. Measured on the step's own commit: the hook printed
   `✓ gatefiles: gate files 3, the Gate-Change: trailer is there` and
   `✓ gatefiles: the commit can be made (7 files, gate files 3)`, and
   `node tools/gates/gatefiles.js --range origin/main` answered with the English range verdict — the
   two places a person meets this sensor's words.
6. **`tools/suites.js`** — the `why` of every entry and the unknown-run error. Red first: rename the
   **field** `why` instead of its text → `test/suites.test.js:51` red ("в полном прогоне файл без
   названной причины"), which proves the field is what the guard reads; then the values.
7. **`.githooks/pre-commit` and `.githooks/pre-push`** — the four messages. Red first: rewrite the
   **call** (`pnpm run verify:fast` → anything else) → `test/gates-verify.test.js:142-143` red; the
   words around the call are free. This step is the one where the trailer's own subject is met: the
   hooks are gate files, and a person meets their messages on the next commit.

**Why the tree is green between the commits.** Each read verdict moves with its reader in the same
commit (steps 2–5); everything else of this owner has no reader (measured one by one above), so a
step can land alone; `tools/gates/gatefiles.js` is the only file whose red is the point of the file,
and its step is the one that proves it by hand. Nothing outside this owner moves: no reference
(`check:standards` compares fixtures, and no sensor writes a fixture), no product file, and the two
baselines change only through their scripts.

## Acceptance

- The counter over the eleven files answers nothing:
  `rg -cP '[\p{Cyrillic}]' tools/gates/*.js tools/suites.js .githooks/* dup-baseline.json coverage-baseline.json`.
- The seven verdicts keep their readers: `node --test test/gates-metrics.test.js test/gates-dup.test.js
  test/gates-deps.test.js test/gates-coverage.test.js test/gates-files.test.js` is the run that says so,
  and it is part of `pnpm test`.
- The sensors still answer the same way on this repository: `pnpm run metrics`, `pnpm run dup`,
  `pnpm run deps`, and `pnpm run cover` + `pnpm run baseline:coverage` for the re-take; the reports in
  `reports/` are diffed rather than read, so a moved number is a behaviour change and there is none.
- The profile is unchanged in what it runs: `pnpm run verify:fast --list` command for command against
  `main`, and `pnpm run verify:fast` green after every commit, `pnpm run verify` before the portion is
  pushed (the full profile is where `check:standards`, `parity:live` and `pack:check` run).
- Every commit of this subplan carries a `Gate-Change:` trailer with a reason, and
  `node tools/gates/gatefiles.js --range origin/main` — the same call the `pre-push` hook makes —
  is green over the range.
- The thresholds, the `GATE_FILES` list, the baselines' fingerprints and the split in
  `tools/suites.js` are untouched: `AGENTS.md` forbids the other answer, and a moved threshold would
  be exactly the defect the guard exists for.

**Release:** the gate files are outside `files` in the manifest (measured while planning W1:
`bin`, `src`, `templates`, `README.md`, `LICENSE`), so nothing here ships and nothing is released —
said in each commit in words, and N20 (the cadence) stays open.

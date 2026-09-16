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
| `tools/gates/run.js` | 21 | the eleven step labels of `STEPS` (34–44) and the profile's own verdicts (118, 122) |
| `tools/gates/dup.js` | 20 | the sensor's verdicts, its advice lines, and the baseline's `note` (128–129) |
| `tools/gates/coverage.js` | 18 | the verdicts, the regression lines, the advice, and the baseline's `note` (81–84) |
| `tools/gates/gatefiles.js` | 7 | the guard's verdicts (94, 98–99, 103, 110, 117) |
| `tools/gates/metrics.js` | 6 | two verdicts and the advice line (37, 63–71) |
| `tools/gates/deps.js` | 5 | the verdicts and the "for information" line (26, 47, 51, 53, 56) |
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
| `'gatefiles: правка гейта без трейлера Gate-Change:'` (`gatefiles.js:94`) | `test/gates-files.test.js:77`, `:115` (`/правка гейта без трейлера/`) |
| `'✓ gatefiles: коммит можно ставить (…)'` (`gatefiles.js:~103`) | `test/gates-files.test.js:106` (`/коммит можно ставить/`) |
| `'dup: новых клонов N (…)'` (`dup.js:197`) | `test/gates-dup.test.js:72` (`/новых клонов 1/`) |
| `'dup: базы нет (…)'` (`dup.js:139`) | `test/gates-dup.test.js:88` (`/базы нет/`) |
| `'<файл> — <метрика>: было X, стало Y'` and `'не в базе'` (`coverage.js:115-116`) | `test/gates-coverage.test.js:49`, `:63` |
| `'deps: находок нет (…)'` (`deps.js:53`) | `test/gates-deps.test.js:48` (`/находок нет/`) |
| `'metrics: новых нарушений N (…)'` (`metrics.js:63`) | `test/gates-metrics.test.js:144` (`/новых нарушений 1/`) |

Seven verdicts, seven readers, and each goes red the moment one of the two sides moves alone. The
rest of every sensor — the "fix the code, not the sensor" advice lines, the "…for information"
lines, the counting prose — has no reader.

**3. The two baselines' `note`** — written by the sensors when the baseline is re-taken
(`pnpm run baseline:dup`, `pnpm run baseline:coverage`), read by no machine (measured: the probes
mention a note only in a comment, and no test matches it). It is a **human** sentence inside a gate
file, which is why translating it means **re-taking the baselines with their scripts**, the way
`AGENTS.md` says they are updated, and not editing the JSON by hand.

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

0. **Re-measure before starting.** S1–S5 and W1 have landed, so the counter for the eleven files and
   the twelve probe-read verdicts is taken again and written into the journal — measured, not
   inherited.
1. **`tools/gates/run.js`** — the eleven step labels and the profile's verdicts. Red first: the
   measured absence of a reader (`--list` prints commands; a step's output is not captured), so the
   experiment is `pnpm run verify:fast` still green and `pnpm run verify:fast --list` unchanged
   command for command. The comma in the summary is gone (N26 decided 2026-09-16: the summary numbers go through
   `localeNumber`, so they follow the machine's locale while the words stay English).
2. **`tools/gates/deps.js` and `tools/gates/metrics.js`** — their verdicts and advice, with the two
   probe reads (`test/gates-deps.test.js:48`, `test/gates-metrics.test.js:144`) in the same commit.
   Red first: translate `'deps: находок нет (…)'` alone → the probe goes red in the same run.
3. **`tools/gates/dup.js`** — the verdicts, the advice, the baseline's `note`, and the two probe
   reads (`test/gates-dup.test.js:72`, `:88`) with the baseline itself re-taken by
   `pnpm run baseline:dup` (the note is written by the script, never by hand). Red first: translate
   `'dup: новых клонов N'` alone → `:72` red; and the re-take must leave the fingerprint counts
   otherwise unchanged, which the sensor's own verdict then says.
4. **`tools/gates/coverage.js`** — the verdicts, the regression lines, the advice, the `note`, the two
   probe reads (`test/gates-coverage.test.js:49`, `:63`) and `coverage-baseline.json` re-taken with
   `pnpm run baseline:coverage` (which needs `pnpm run cover` first). Red first: translate
   `'было … стало …'` alone → `:49` red. The re-take is the slowest step of this owner and the reason
   the profile's `cover` step exists.
5. **`tools/gates/gatefiles.js`** — the guard's verdicts (94, 98–99, 103, 110, 117) and the three
   reads in `test/gates-files.test.js:77`, `:106`, `:115`. Red first: this is the one sensor whose red
   is cheap to produce by hand — commit a gate change without a trailer and read the message; the
   probe does the same in a temporary repository.
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

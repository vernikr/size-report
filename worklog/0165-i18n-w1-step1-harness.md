# 0165 — i18n W1 step 1: `tools/harness.js`, and the owner's real baseline

**Request.** Point 5 of the work, portion of the turn: step 1 of subplan W1 (`tools/**`), plus step 0
of that plan (re-measure before starting). Only literals; no behaviour, no counters; state by
measurement which lines of `tools/refusals.js` are printed to a user and which are read by developers
only, touch only the former; say whose debt the sensors' advice markers are; say by measurement what
still prints a Russian advice marker and whether N28's condition holds; correct the plan by
measurement; one commit, green tests before the push, English commit and journal entry.

**Done.**

- **Step 1: `tools/harness.js` 13 → 3.** The two names — `the package engine` (45 and 188) and
  `the frozen copy of the implementation` (77) — and the messages of `legacyTool` (63, 68–69),
  `requireTarget` (161) and `refusal` (166, 169, 170). The three of `firstDiff` (259–260, 263) stayed
  Russian: **`BLOCKERS.md` N29**, where a literal meets the `dup` baseline.
- **Red first, and the full profile was the point of it.** The file was returned to Russian whole and
  the **full** run stayed green — 175 checks, 0 failures. With `test/parity.test.js` and
  `test/frozen.test.js` inside that run, the measurement says two things at once: no machine reads
  these words and the tool's name reaches no compared artifact. The names' duplicates
  (`test/refusals.test.js:169`, `test/parity.test.js:29,37,63`) are C1/C2's and the commit says so.
- **N29: a literal that cannot be bought out.** `firstDiff` here and its copy in
  `tools/parity-live.js:74` are a clone `dup-baseline.json` accepts; a translated string is a different
  token, so rewording makes the twin **new** and no fix belongs to the sensor. Measured three ways:
  Russian file → “новых клонов нет (клонов 10, в базе 15 отпечатков)”; English file → “новых клонов 4”
  between the same two ranges; English everywhere except these three literals → green. Repair (1),
  **remove the redundant copy** (`tools/check-standards.js:27`, `test/parity.test.js:16` and
  `test/crlf.test.js:14` already take the shared one; `parity-live.js` imports `collectOutput, gitIn`
  from the same module), is ~13 deleted lines and no behaviour — but it is a code change in the file of
  **another step of this subplan**, so it is recorded and left for the mission agent.
- **Step 0: baseline 235, not 331.** The planning figure was the pre-S1–S5 reading; the whole
  difference is theirs — `tools/refusals.js` 169 → 55 measured, `docs-facts.js` 4 → 3. Of the 235:
  21 stay by rule (N21's 16 + 3, the pin's 2 names), 4 are prose comments, 210 are this owner's own;
  after this step the twelve files read 225 and `tools/**` reads 428.
- **The catalogue, measured rather than guessed.** `tools/refusals.js` prints **nothing** to a user:
  no shipped file imports it (`package.json`'s `files` are `bin`, `src`, `templates`, `README.md`,
  `LICENSE`, and `src/args.js` names it in comments only), so all 55 of its Cyrillic lines are
  developer-side. They are `truth` 37, `advice.why` **12** (the plan guessed 40), the two case `id`s,
  the `uncatchable` prose 2, `ADVICE_LINE` 1 and one comment; **no `must` phrase carries Cyrillic**,
  which is the measured proof that S1–S5 moved every quotation of printed text with its owner.
- **Whose debt the markers are, and N28.** The two sensors' markers are W2's
  (`tools/gates/dup.js:139`, `coverage.js:93` — the plan's `:1` was a guess) and the extractor never
  reads them: `adviceOf` parses the tool's output, not a sensor's. They are the **only** Russian
  advice markers left in the repository, so step 8's condition for narrowing `ADVICE_LINE` holds by
  measurement.

**Suggested.** Two things for the next turn. (1) N29's repair (1): one small commit deleting
`tools/parity-live.js`'s redundant `firstDiff` and taking the shared one — it unblocks the last three
literals here and W1's step 4 as well, which would otherwise land in the same blocker. (2) Step 5 of
this plan is half-spent already: `tools/docs-facts.js` reads 3 Cyrillic lines and `commandsAt` carries
both spellings (`'Команды:'` or `'Commands:'`), so what is left there is one comment. The plan and the
tracker now say so, and the journal records it here so the next portion does not pay for the
measurement twice.

# D1 step 8: the release workflow — and D1 closed, with the campaign

What was asked: the last step of the D1 subplan — `.github/workflows/release.yml` (48 lines) and
closing D1 if the measurement confirms it. Translations only, one commit with an English message and
a journal entry, trailer (a workflow is a gate file), full `verify` before the push, CI checked after.

## Done

- **`release.yml` 48 → 0:** the comments, eight step names, the `workflow_dispatch` input's
  `description`, the comment on the `id-token` permission and the words inside the tag step's `echo`.
- **`test/release.test.js`'s seven step-name reads moved in the same commit** — the rule of this
  campaign (`step()` finds a step by its name, so the verdict and its assertion ride together). That
  file now reads 0 as well, which pays C2's last debt.
- The changed lines are 48 in `release.yml` plus 7 in the check — 55 pairs. Identifiers were not
  touched and are named: the `jobs:` key `release`, `permissions`, the two `if:` conditions, the four
  pinned `uses:` SHAs, `runs-on`, every `run:` command and the `tags: ['v*']` range.

## Measured, not argued

- **Red first, every file restored byte for byte:** the step name `Публикация` translated **alone**
  reddens `release` (2 of 3) with `the release workflow holds no single step «Публикация»`; the hint
  rewritten without the basename (`--file release.yml` → `--file release-workflow.yml`) reddens it
  with `the hint does not name the workflow file: the one-time setting on npmjs.com would point at
  another file…` — so the file's self-naming is load-bearing and the instruction kept the exact
  token; a step name no check reads (`Установка`) leaves it green (3 of 3).
- **The document still parses:** `parseWorkflow` answers the same **11 steps** with the translated
  names, and `input.default` is still `true`.
- **The plan's count of readers was wrong by one and is corrected:** it said six step names, and
  `:86`'s name (`npm поновее (для trusted publishing)`) was called English. It carries the Russian
  word and is found by `step()` through its name, so it moved with its line — **seven**, in one
  commit.
- **The wash-up (step 9):** the counter over D1's ten files reads **4** — `templates/size-report.config.json`
  2 (the draft's `title`/`heading`, the `ru` dictionary's own words) and `eslint.metrics.config.js` 2
  (the `DEBT_TERMS` line and the English comment quoting the term) — and nothing else. **D1 is
  closed, and with it every row of the map.**
- Sensors and checks as before: `deps` `no findings (113 modules, 472 relations)`, `metrics`
  `no new violations (the baseline holds 0 in 0 files)`, `dup` `clones 5, lines 29` (it cannot see
  workflows at all — `.jscpd.json` scans `src`, `bin`, `tools`, `test`); checks **70** fast and
  **175** full; the artifact's content digest `1bdb27e1…` and the reference file's own sha256
  `cdda8d01…` unmoved; full `pnpm run verify` (8 steps) green before the push.

## Suggested

- **The campaign's closing inventory, measured 2026-09-17** (lines carrying Cyrillic): `src/**` 65
  (the `ru` dictionaries 49 + 15, `SKIP_WORDS` 1), `bin/**` 0, `tools/**` 111 (the fixture
  generators' payload 88, `manifestNote` 16, the draft's values 3, the pinned help's two names and
  their comment 3, one usage comment 1), `test/**` 123 (each file's own scenario data),
  `templates/**` 2 + `eslint.metrics.config.js` 2, `BLOCKERS.md` 33, `TODO.md` 3, `fixtures/**` 308
  (the frozen standard), `docs/**` 706 (of which the generated page 349 — the default locale is
  `ru`, and `docs/plans/**` 357), `worklog/**` 7 669 (the journal), `plans/archive/REFACTOR.md` 15.
  Total **9 037**, and the growth over 2026-09-16's 5 512 is mostly the journal itself.
- **The fixture payload proved to be data, not an oversight:** translating one string of
  `tools/synthetic/content.js` leaves `test/frozen.test.js` green (4 of 4) and reddens
  `check:standards` with 8 divergences (exit 1) — the reader sits in the full profile, as everywhere
  in this campaign.
- Open with the user: **N19** (the report's default locale), **N20** (the release cadence — it also
  moves the pin and with it the last Russian branch of `commandsAt`), **N21** (the reserved values),
  **N31** (seven stale `dup` fingerprints), **N32** (the red coverage cap). N24 is decided.
- This owner ships: the registry now shows the English `description`, and `templates/**` travels in
  the tarball. The version stood still, as in every portion before: the release is N20 and is not
  decided here.

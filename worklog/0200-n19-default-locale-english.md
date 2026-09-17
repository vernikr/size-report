# N19: the default locale becomes English

What was asked: a decision on `BLOCKERS.md` N19 — which of the three ways to treat the package's default
locale — given together with the answers to N20, N31 and N32. The user chose option (2): the default
becomes `en`.

## Done

- `src/config.js:19`: `locale: 'ru'` → `'en'` — one word, and the only place the default lives.
- `templates/size-report.config.json` follows in the same commit: `"locale": "en"` and the `en`
  dictionary's own heading (`File size by commit`) in `title`/`heading`, the same relationship to the
  dictionary the two Russian values had.
- The decisions are recorded: N19 and N20 here (N20 reads "few portions are left — batch", and the
  campaign's last portion is written, so the batch is chosen), N31 and N32 in their own entries of
  `BLOCKERS.md`.

## Measured, not argued

- **The blast radius is exactly the two files the note predicted, and it is the whole profile that says
  so:** with the change in place `pnpm run verify` (8 steps, 90.5 s) is **green** — `check:standards`
  reproduces both references, `parity:live` passes, `frozen` stays green, and `pack:check` answers
  `the report from the package is byte-identical: 66427 B`. The reason is named: both fixture configs pin
  `"locale": "ru"` and so does the builder (`tools/make-fixture.js:55`), so every frozen byte stands.
- **What a person meets instead:** `--init`'s derived draft, run in an empty repository, now pins
  `"locale": "en"` (measured); a fresh project's report is English; and the repository's own page follows
  the tree only after the release — the post-commit hook runs the engine of the **attached copy** in
  `node_modules`, which is `2.4.0` and still carries `locale: 'ru'` at `src/config.js:20` (measured).
  That is `AGENTS.md`'s release step 3, not a defect.
- Nothing else moved: the `ru` dictionary is data and untouched, no check changed a verdict, the
  artifact's content digest `1bdb27e1…` and the reference file's own sha256 `cdda8d01…` stand, and
  `dup` reads `clones 5, lines 29`.

## Suggested

- **Consequence for the i18n campaign's allow-list:** the draft's two values were allow-listed as "the
  `ru` dictionary's own words placed in a file a person copies"; with the default English they are English
  and leave the allow-list, so D1's ten files now read **2** (`eslint.metrics.config.js` only) — corrected
  in `configs.md` and in the tracker.
- No trailer: neither `src/config.js` nor `templates/size-report.config.json` is a gate file (checked by
  the hook). This is a behaviour change rather than a translation, and it is the user's decision of
  2026-09-17 — the one place in this work where a literal's language was decided by a product decision
  rather than by a reader.
- Still open from the same answer: N31 (prune the stale `dup` fingerprints) and N32 (fix the coverage
  sensor to count what actually executed). The release is N20's batch and comes after them.

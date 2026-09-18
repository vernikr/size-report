# 0224 — the memory of the choice keeps no passport

**Asked:** the report's passport must not exist in the new logic at all. Reports are one and the same thing from the
storage's point of view, so an identity counted per report is a thing the page does not need. (0222 is the portion this
corrects: it made the passport the *report's* rather than a build's, and this one removes the entity it described.)

**Found — nothing on the page needs the identity, once the memory is one record.** The passport did two jobs: it was the
key of the record and the guard that refused a link of another report. The first is answered by a name: the memory is
the reader's, the page has a namespace of its own, and two names inside it — the choice and the unfolded tree — are all
the addressing it takes. The second is answered by the shape: a record that cannot be read (`v` unknown, JSON broken) is
refused, and every other link is a choice, applied **by name** — a path, a metric's key, a category's key — so a name
this report does not hold matches nothing, and what it does hold is applied. Removing the guard removes the case it named:
a link of another report is now the sender's choice applied to what both reports share, which is what a reader sending a
link means by it, and what the memory itself does (all `file://` pages share one storage).

**Done:**

- **Two names, no identity** (`src/page/state.js`): `APP_KEY = 'size-report:choice'`, `APP_FOLD_KEY =
  'size-report:tree'`, both under one namespace. `appPassport`, `appPassportValue`, the FNV fingerprint `appHash` and the
  form's mark in the address are gone; the keys are constants of the module rather than values counted at boot, so
  `appBoot` no longer sets them and there is nothing left to count from the data.
- **The record is the choice alone:** `{v, metrics, cats, files}` — no `passport` field, and `appRecordOk` checks the
  format rather than an identity. The unfolded tree is written the same way (`{v, open}`).
- **The sweep covers the whole namespace:** the memory is read under the two names and under nothing else, so every other
  name — an address counted per build by an earlier release, the form-2 records of 2.9.0, a tree record beside them — goes
  when a report is opened. The predicate is the keys themselves rather than a prefix of an identity.
- **One refusal for a link:** `linkForeign` is out of the page's dictionary (both locales), out of the block's texts
  (`src/page/build.js`) and out of the checks; an unreadable link stays `linkBroken`, and a link whose names are partly
  unknown is still counted in `linkExtra`.

**The price, stated rather than hidden:** the choice is now the browser's, so **two reports of one browser share it** — a
category switched off in one is switched off in the other, and a file whose path both hold follows both. That is what one
record means, and it is the point of the change: a reader has preferences, not a preference per project. And the reader
sets his boxes **once more**: every name outside this page's two keys is swept on the first opening, which is what makes
the count of records in a browser exactly one per kind.

**What holds it:** `pnpm run verify:fast` and the full `pnpm run verify` green (8 steps). `test/page-choice.test.js` keeps
10 checks, renamed where the property changed: a record of another format and an unreadable one are not applied; a name in
the namespace that is not one of the two keys is swept with the rest; a choice left under the page's own key is still
applied. `test/page-view.test.js` pins the shell's functions without `appHash` and `appPassport`. The stale claims about
the passport that lived in the block's decoder (`src/page/payload.js`) and in the block's own check are corrected with it.

**Files:** `src/page/state.js`, `src/page/payload.js`, `src/page/build.js`, `src/locales.js`, `test/page-choice.test.js`,
`test/page-view.test.js`, `docs/architecture.md`, `docs/module-design.md`, `docs/wiring.md`, `docs/files.md`,
`worklog/0224-the-memory-keeps-no-passport.md`, and `docs/size-report.html` (rebuilt).

**Owed:** the section of this journal in the release commit, the tag, and the re-pin of the attached copy.

## Release 2.9.1 — what changes in the numbers

Two refactors of the page ship in one PATCH: 0223's comments say what the code is, and this one takes the identity out of
the memory. Both live in `src/`, which the tarball carries, so the release is due; nothing of either is a repair of a
broken behaviour, which is why it is not a MINOR.

The two are measured against each other on one and the same tree and history, and the same output path, so nothing but
the page's own program and words differ:

- **The artifact: 90 791 B built by 2.9.0 → 89 957 B built by these sources (−834 B).** Of that, the program loses 696 B
  (the FNV fingerprint, the passport and the form's mark, with `appBoot` no longer counting anything from the data) and
  the page's dictionary loses 138 B (the key `linkForeign` in two languages).
- **The packed data is byte-identical:** the same history, the same columns, the same numbers — the change is in the page
  around them.
- **What a reader's browser holds** is now `{"v":1,"metrics":…,"cats":…,"files":…}` under `size-report:choice`, and
  the unfolded tree under `size-report:tree`; every other name in the namespace goes on the first opening, so his boxes
  are set once more — the same price as 2.9.0, paid for a smaller result.
- **The engine's answers are what they were:** `--data`, `--json`, both references, parity with the fixture and with the
  consumer's live history, the tarball's entries, and the shape of the block (`schema: 2`, `PAGE_KEYS`).
- **The attached copy** is re-pinned to 2.9.1 in a commit of its own, with the `Gate-Change:` trailer.

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

**Owed:** the section of this journal in the release commit, the tag, and the re-pin of the attached copy. Like 0223,
this portion changes `src/` and ships in a release of its own — the tooltip-and-comments step of 0223 and this correction
of 0222 are two refactors, so they land as one PATCH.

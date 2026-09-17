# Release 2.5.0 — the tool speaks English

What was asked: the decision on `BLOCKERS.md` N20 — the batched release after N32 closed. Version by
SemVer, a section in the journal saying what changes in the numbers, the pin in `README.md`, the tag
placed before the commit and moved onto it, and one push with the tag first.

## What changes in the numbers

- **Nothing in the measurement.** `schema: 1` stays frozen, the fixture artifact is byte for byte the
  same (`sha256 1bdb27e1…`, the digest file itself `cdda8d01…`), and the frozen layer keeps its Russian
  values: the release moves words, not the meaning of a number.
- **Nothing in the checks:** 70 in the fast profile, 175 in the full one, 10 steps in the slow one;
  `dup` 5 clones / 29 lines; the coverage baseline holds 39 files.
- **What moves is the interface:** the help, the refusal catalogue, the diagnostics and the page are
  English, and a project with no config file derives `locale: en` rather than `ru`. The Russian
  dictionaries stay in `src/locales.js` and are chosen by `locale` in the settings.
- **The package:** 2.4.0 → 2.5.0, the tarball **47 entries, 124 787 B** as built here; the pin in
  `README.md` moves with it (`installSpec()` → `github:vernikr/size-report#v2.5.0`).
- **The page of this repository** follows the release twice over: this repository's own report is built
  by the attached copy, so its bytes and its `locale` field turn over at the `pnpm add -D -E` step
  rather than at the tag.

## Why PATCH, not MINOR

The user chose MINOR (2.4.0 → 2.5.0): the default locale is visible behaviour rather than wording, so a
project that pins the version sees a different page language and a different `--init` draft after an
upgrade. SemVer by the repository's own rule: `feat` → MINOR.

## Done

- `package.json`: the version; `README.md`: the release line, the note of what this release changes, and
  the pin in both places that name it; this entry.
- `BLOCKERS.md` N20 answered with its price named (the registry served 2.4.0 with the Russian interface
  while the tree was English — this release closes that window).
- The tag `v2.5.0` was placed on `e5677ac` before the release commit and moved onto it (`c19a81d`)
  afterwards; the push was one command, `git push origin v2.5.0 main`. GitHub bypassed the branch's
  required `verify` check for that push (the account may), and the check answered green on
  `4466ae5` a minute later (`35217359835`).

## Measured after the release

- **The published tarball is what was built here.** `npm view @vernikr/size-report@2.5.0` answers
  `dist.shasum 7d78ea4e…`, which is byte for byte the sha1 of the tarball downloaded from the
  registry (`47 files`, `unpacked 369 542 B`, a provenance attestation present). File by file against
  the local `pnpm pack` of this revision: **46 of 47 identical**; the 47th is `package.json`, whose
  keys npm re-orders — no field added or lost (the two manifests compared field by field).
- **The runs:** CI green on the tag and on `main` (`35217359450`, `35217359835`), the Release workflow
  green and publishing with provenance (`35217359524`); `npm view` answers `2.5.0`, `npm access`
  `public`.
- **This repository's own page turned English with the attached copy** (the `pnpm add -D -E` commit):
  the page the hook rebuilt reads `"version":"2.5.0"`, `"locale":"en"`, 1 695 779 B, where the page
  built by the 2.4.0 copy read `"version":"2.4.0"`, `"locale":"ru"`, 1 712 114 B. The frozen layer's
  Russian reasons are untouched: the same run still lists its 183 skipped commits as `только таблица`
  and `без изменения объёма` (N21, N24).
- **The Russian branch of `commandsAt()` is dead — measured, not assumed.** With the
  `'Команды:'`/`'Режимы:'` halves cut out of `tools/docs-facts.js` after the pin moved, the guards run
  green: `docs-pin` check 5 passes (5 of 5, no failures), because the pin reads its help from an
  English revision. The file was restored byte for byte (`shasum -c` OK), and the leftover cleanup is
  recorded in `TODO.md` rather than done on the way past.

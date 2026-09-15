# Documentation rework — meta plan

2026-09-15. Subplans: `comments.md` (comments in the sources), `markdown.md` (every other
markdown file). Progress is journalled in `worklog/NNNN-*.md`, one file per portion
(`worklog/0070-docs-rework-plans.md` opened this work).

## Goal

The prose of this repository — comments in the code and every markdown file except the
journal — becomes **English**, says only what is still **true**, and is as **short** as its
content allows. A comment keeps only what cannot be derived from the file it sits in: the
reason behind a decision, the defect class it defends against, the measurement a threshold
came from. A sentence that repeats the code beside it goes, however well written.

Two readers, and each is the reason for one half of the rule. A human never opens the code:
for them the documents *are* the product, so a stale claim there is a defect of the product.
An agent edits the tree every day: for them a comment is the only place where the reason
behind a decision survives the next rewrite.

## Current state

| Artifact | Lines | Today | Target |
|---|---|---|---|
| `README.md` | 1137 | instructions, tables, samples | English, tightened |
| `PLAN.md` | 1218 | plan of the finished move | English; keep architecture and invariants, compact the steps |
| `REFACTOR.md` | 269 | wave log, very long lines | English, compacted |
| `BLOCKERS.md` | 387 | open blockers | English |
| `CHANGELOG.md` | 690 | per-release "what changes in numbers" | English framing; release numbers and tables stay facts |
| `AGENTS.md` | 97 | agent instructions | English |
| `templates/README.md`, `fixtures/live/README.md`, `fixtures/parity/README.md` | 145 | notes for the consumer | English |
| `docs/requirements.md` | 216 | product requirements | English |
| `docs/module-design.md` | 557 | design of the move | English; the design of the past, compacted |
| `docs/plans/**` | new | — | English (this plan) |
| `worklog/**` | 5243 | journal of the past | **stays Russian** |
| `src/**`, `bin/**`, `tools/**`, `test/**` | ~15 000 | Russian comments | English comments, code untouched |

## Order

1. **`comments.md`** — self-contained, and every chunk is provable by the sensors that
   already watch those files (`lint:strict`, `metrics`, `deps`, the fast suite). Done
   module by module, one commit per module as long as it fits the commit budget.
2. **`markdown.md`** — largest reader impact first, one document per commit, because the
   documentation guards read the *shape* of these files and have to be edited in step.

The subplans do not depend on each other; the order is a choice (cheapest risk first), not
a prerequisite.

## Rules shared by both subplans

- **Language.** English for comments and for every markdown file except `worklog/**`. The
  journal stays Russian: it is the record of what was asked and what was done, and it is
  read in the language of the request.
- **Strings are not comments.** What the program prints keeps the language it prints today:
  `src/locales.js` holds `ru` and `en` side by side, refusal texts, sensor verdicts and test
  assertion messages are user-facing strings. Translating them is a product decision, not
  this rework.
- **Truth is proven, not remembered.** A claim survives only if a run, a gate, the tree or
  `git blame` still supports it; the date tells whether a sentence is about today's tree or
  about a revision of the past, and only a document that is explicitly about the past keeps
  the latter.
- **Numbers live where they are checked.** The README run table is verified against the test
  files, `CHANGELOG.md` tables against a fixture run; a number is updated there and nowhere
  else.
- **No new promises.** Nothing is added "for completeness"; a document that loses material
  gets shorter, not padded.

## Gates that constrain both subplans

- `pnpm run verify:fast` before every commit; `pnpm run verify` before a portion is pushed.
- Comment rules the sensors enforce: no debt markers `todo`/`fixme`/`xxx`/`hack`/`отложено`
  (`local/no-debt-marker`), no `eslint-disable` (`noInlineConfig`), and the literal `import(`
  must never appear in a `src/page/*.js` comment (`test/page-view.test.js` reads those files
  for it).
- Text read by guards, which a comment rewrite must not break: `refuseCause('…')` keeps a
  string literal as its first argument in `src/**`, and `src/refusal.js` keeps its
  `'Команды:'` block — `test/docs-pin.test.js` reads that file **out of git history**.
- The documentation guards read the shape of the markdown, so translating a document means
  editing its reader in the same commit (the readers are not gate files; the edit is allowed,
  but it must be visible in the diff). `markdown.md` lists them with the exact places.
- Commit budget: ≤ 600 lines and ≤ 10 files — p75 of this history. A larger chunk is
  justified in the commit body.
- Gate files (`tools/gates/**`, `tools/suites.js`, `test/gates-*.test.js`, `package.json`,
  the lockfile, workflows, hooks, baselines, sensor configs) need the `Gate-Change:` trailer.
  Neither subplan should need one — needing it would mean the plan is wrong, and the answer
  is to re-plan rather than to weaken a gate.
- The `post-commit` hook rebuilds and commits `docs/size-report.html` on its own. Every
  portion therefore ends with **two** commits; that second one is expected, not a defect.

## Definition of done

- No Russian prose left outside `worklog/**` and user-visible strings; checked with
  `rg -l '[А-Яа-яЁё]' -g '*.md' -g '!worklog/**' -g '!docs/size-report.html'`.
- `pnpm run verify` green after every portion; `pnpm run verify:slow` green once at the end.
- Every document checked against the tree of the day it was rewritten; every deleted claim
  named in the worklog entry together with why it no longer held.
- `wc -l` before and after recorded per file in the worklog entry, and the report's own
  numbers quoted where a portion changes them.

## Out of scope

- User-facing strings, locale dictionaries, sensor verdicts, test assertion messages.
- `worklog/**` (the journal) and `fixtures/**` (frozen data, byte-compared — never touched).
- `docs/size-report.html` (generated by the tool; the hook owns it).
- The consumer project `safe-resets` and the package's public API.

## Open questions

- **Journal after the move — settled 2026-09-15.** The report picks the first known journal name
  at the repository root (`JOURNALS` in `src/project.js`), so with `WORKLOG.md` moved to
  `worklog/archive/` the report's journal is `CHANGELOG.md`. That is now the agreement rather than
  an accident: the tool is left alone (pinning a journal in this project's settings would mean
  carrying the whole profile by hand — a behaviour change — and anything else is a code change),
  and the measured state is correct: of the report's 113 rows, 14 carry a section, 13 of them from
  the release commit that opened it and the one that touched an existing section touched only
  that one. Evidence, the three options with their costs and what is left for the user:
  `BLOCKERS.md`, note N11.
- **Release per comment-only portion.** A comment rewrite changes the bytes that ship in the
  tarball without changing behaviour. Decide once, with the mission agent: release a PATCH
  per portion, or batch the releases and say so in the commit.
- **The report's own language.** The page is built with the tool's default locale (`ru`), so
  an English repository still shows a Russian report. Changing that is a product decision
  (default locale, or a config file in this repository), not part of this rework.

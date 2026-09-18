# The rest of the living prose leaves the archived README

Asked for in one portion: move the rest of the archived README's living prose — the file table, the
wiring instruction, the settings and the traps — into real documents under `docs/`, leaving only the
journal notes in the archive. It is the second half of the split begun in
`worklog/0216-prose-out-of-the-archived-readme.md`.

## What was done

| file | change |
|---|---|
| `docs/files.md` | new, 143 lines: the tree map — the file table moved out of the archive, with rows for the new documents |
| `docs/wiring.md` | new, 335 lines: `Wiring it into your project` (§1–§8: installation, the derived settings, the config table, scripts, the CI check and the exit-code table, the self-updating hook, the traps of the instruction, migrating off a copy) and `For an AI agent` |
| `docs/architecture.md` | 462 → 543 lines: `The gate against bloat`, `Traps worth testing the engine on` and `What is not here yet` appended, and its lead repointed |
| `docs/archive/README_old.md` | **695 → 132 lines**: the release notes alone, under a note naming where the prose went |
| `tools/docs-facts.js` | `FILES` and `WIRING` replace `ARCHIVE` in `DOCS`/`TARGETS`; the exclusions follow the sections (`What is not here yet` → the architecture, `For an AI agent` → the wiring guide, the wiring guide's paths dropped as a whole document); the archive joins the journals that stay out of the fact check |
| `test/docs-paths.test.js` | the file table is read from `docs/files.md`; the section regex takes an H1 and runs to the end of the document |
| `test/docs-commands.test.js` | the code-2 table is read from `docs/wiring.md`; the wiring guide joins the instruction set in place of the archive |
| `README.md`, `AGENTS.md` | the pointers name the three documents; the gate is no longer "described in the archived README" |
| `plans/archive/REFACTOR.md` | three section citations repointed to `docs/wiring.md` (the sections moved there) |

## Why nothing is lost

Every moved block is **verbatim**: `diff` of the new documents against the archive's own ranges — the
table against lines 142–278, the wiring guide against 305–605, the agent surface against 638–666, the
notes against 13–134 — reports no difference. The guards follow the text rather than the file: both
documentation checks are green (6 checks), and `verify:fast` and the full `verify` are green besides.

## Taking the archive out of the fact check

The archive is now a journal — the release notes the main page used to carry — and the guard's own
rule is that a document describing today is checked while a snapshot of the past is not
(`worklog/archive/WORKLOG.md` is out for the same reason). Its two machine-read facts moved into
documents that do describe today: the file table into `docs/files.md`, the code-2 table into
`docs/wiring.md`, which is where the guards read them now.

## Suggested next steps

- `docs/architecture.md` is 543 lines of bold paragraphs; a table of contents would make it navigable.
- The wiring guide's code-2 cell and the file table are two long hand-kept lists; the second is already
  checked both ways, and the first could be generated from `CONFIG_CAUSES` rather than quoted.

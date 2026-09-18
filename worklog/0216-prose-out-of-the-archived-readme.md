# The living prose leaves the archived README

Asked for in one portion: split the archived README — move the living prose about how the tool is put
together into a real architecture document under `docs/`, and leave the journal notes about releases in
the archive. It is the first suggested next step of `worklog/0215-readme-as-a-landing-page.md`.

## What was done

| file | change |
|---|---|
| `docs/architecture.md` | new: the 455-line device prose taken out of the archive's `## Status`, moved **verbatim** (checked with `diff` against the source range), with a lead that points back at the archive |
| `docs/archive/README_old.md` | **1 146 → 695 lines**: the prose replaced by one pointer paragraph; the section renamed `## Status and release notes` (the intro and the 2.8.4–2.6.0 notes stay) |
| `tools/docs-facts.js` | `docs/architecture.md` added to `DOCS` and `TARGETS`, so the moved text keeps its path, command and section checks |
| `README.md` | the pointer to where the rest of the description lives now names the architecture document beside the archive |
| the file table | a row for `docs/architecture.md`; the archive's own row says what it no longer holds |

## Why the move is safe

The prose was copied, not rewritten: `diff` of the archive's old lines 136–590 against the new document
reports no difference. The guards follow it — `test/docs-paths.test.js` and `test/docs-commands.test.js`
green (6 checks) once the new file is tracked, and the full `verify` green (8 steps) besides.

## Release 2.8.6 — what changes in the numbers

This portion ships: `README.md` is in `files`, so the tarball's own text moves, and it takes its own
PATCH. Nothing of the measurement moves — no line of `src/` is touched, only the documents and the
guards that read them: the engine's output on the fixture and on the consumer's live history is as it
was (parity with the live project 95 × 27, both references reproduced, the tarball 6 entries). The
tool's own report is rebuilt by the post-commit hook as a commit of its own, as always.

## Suggested next steps

- `docs/architecture.md` is a wall of bold paragraphs; a table of contents or the section split it
  deserves (engine, page, checks, releases) would make it navigable.
- The archive still carries the file table, the wiring instructions and the traps — the second half of
  the same split: those are live too and could move out the same way.

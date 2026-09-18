# The README becomes a landing page

Asked for in one portion: keep a copy of the current `README.md` under `docs/archive/`, replace the
root `README.md` with a short human description for the repository's main page, and report what the
archived file holds that `AGENTS.md` does not.

## What was done

| file | change |
|---|---|
| `docs/archive/README_old.md` | the README whole, **1 145 → 1 146 lines** (its own row in the file table added); 113 835 B |
| `README.md` | **1 145 → 40 lines**, 113 597 → 1 743 B: what the tool is, install, the six commands, where the rest lives |
| `test/docs-paths.test.js` | the file table is read from the archived README rather than `README.md` |
| `test/docs-commands.test.js` | the code-2 table is read from the archived README; the archive joins the instruction set, so its calls stay checked |
| `tools/docs-facts.js` | `ARCHIVE` added to `DOCS`, `TARGETS`, `NOT_TODAY`, `OWN_PROJECT` — the checked facts follow the text |
| `plans/archive/REFACTOR.md` | two `§` citations (`README.md` §7, §8) repointed to the archived README |
| `AGENTS.md` | the pointer to where the gate is described follows the moved text |
| `templates/README.md` | the note no longer points at a README section that is gone: the help and `--data` name the facts |
| `src/refusal.js` | the help's parenthetical about the README's code table drops the file name (the table left the shipped README); the causes are still printed from the registry |

## No number of the measurement moved

The engine's behaviour is unchanged: `verify:fast` green (85 checks, 0 failures, 19 files), the full
`verify` green (8 steps) — parity with the live project 95 × 27, both references reproduced, the
tarball 6 entries. The only shipped line touched is a help string; the artifact and the parity
references are as they were.

## The report

The ranked list of what the archive holds and `AGENTS.md` does not, with each block's volume, was
delivered in the portion's answer rather than copied here.

## Release 2.8.5 — what changes in the numbers

This portion ships (`README.md` and a help string in `src/refusal.js` are in the tarball), so it takes
its own PATCH. Nothing of the measurement moves: the engine's output on the fixture and on the
consumer's live history is as it was (parity 95 × 27, both references reproduced, the tarball 6
entries), because the only shipped line touched is the help's parenthetical about a file that no
longer carries the code table — the causes are still printed from the registry, and the code table
now lives in the archived README, which the guard reads there. The tool's own report is rebuilt by
the post-commit hook as a commit of its own, as always.

## Suggested next steps

- The `Status` section of the archive mixes release notes with live design prose — the design half
  could move to `docs/` as a real architecture document.
- `AGENTS.md` could name the two commands the archive teaches (`size check`, `size doctor`) so the
  agent instruction is self-contained.

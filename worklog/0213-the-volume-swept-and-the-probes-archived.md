# The volume swept again, and the probes archived

Asked for in one portion: an aggressive sweep for the volume of the code — duplicated logic, dead
code, functionality nothing uses, hollow checks, comments that have gone stale — with the page probes
moved out of the tree's working part.

## What was there

The sweep of 0212 had already taken the clones the ratchet tolerated and the one dead symbol, and the
sensors have been green since: `pnpm run dup` reports no clone beyond the baseline, `no-orphans`
nothing, and a scan over every declaration in `src`, `tools`, `bin`, `test` and `probes` (the name
counted in the whole tree) leaves no name that is declaration and nothing else. So this portion began
from the other end: the **open notes** (`TODO.md`, six entries, each with a measurement of how it
shows), the **duplication below the sensors' thresholds**, and the comments that could be shown to be
wrong rather than felt to be long.

## The six notes, and what closed them

| where | what was wrong | what changed |
|---|---|---|
| `tools/docs-facts.js` | `usageCommands` read the first word of **every** line of the help's command section, continuation lines included, so a document could call `of something` and stay green | the derivation keeps the entries — the lines whose word stands at two spaces of indent: **10 words → 6** |
| `tools/harness.js` | `commandIn` matched only an advice whose command carries a flag, so a flag-less advice (`fix: … doctor`) read as "no command" and a check would have reddened over good behaviour | the second word is enough; the flag is `null` when that word is not one |
| `test/check.test.js` | a negative match on a cause name — the tool never prints one, so the assertion could not fail | removed |
| `test/gates-verify.test.js` | `scriptOf('pnpm run X')` compared with `null`, while the helper re-derives the name it was given — the comparison held nothing | the hook's word is looked up in the scripts of the manifest |
| `src/metrics.js`, `src/locales.js` | the last two Russian comments in `src/` (the strings of the Russian locale stay: they are data) | removed |
| `tools/run-tests.js` | extra flags were handed to `node --test` **after** the file, where node 22 ignores them — the documented example selected nothing | the flags go **before** the file (measured both ways: after, a pattern selects every check; before, only the named one) |

`TODO.md` keeps the one entry that is still open (`src/init.js` — the draft's output is read by no
check) and falls from **96 lines to 31**: a fixed entry is deleted rather than struck through.

## The duplication the sensors could not see

| what was copied | copies | what replaced them |
|---|---|---|
| the frozen copy's spawn, with its pinned environment | 2 builders | `runFrozenTool` in `tools/harness.js`: the environment of a taking belongs to the golden, and it now sits in one place |
| the identity git refuses to commit without | 3 sites | `setIdentity(dir)`, used by `initRepo` and by the two suites that lay a project out themselves |
| a suite's temporary directory and its removal | 25 suites + `tools/page-harness.js` | `tempDir` registers the removal itself, once per process — `after` from `node:test` was measured to work from an imported module, but the harness is imported by the tools as well, and importing the test runner makes node print a TAP summary where a tool's output is read |

## Dead surface

Nine `export` keywords sat on names that nothing outside their own module reads: `derivedConfig`
(`src/config.js`), `minEngine` (`src/metrics.js`), `BINARY_EXTS` (`src/tokens.js`), `stamp` and
`AUTHOR` (`tools/synthetic/repo.js`), `reportSetup` and `PAGE_URL` (`tools/page-harness.js`),
`withoutSection` (`tools/docs-facts.js`), `TEST_DIR` (`tools/suites.js`). The keywords are gone, and
a scan of the whole tree finds no other such name — except the three in `src/page/*.js` (`appMetric`,
`APP_MIN_ROWS`, `APP_MIN_COLS`), where the keyword stays by 0212's decision: the pasted chapters keep
one uniform surface rather than a half-cleaned one.

## The probes archived

The six live-Chrome probes — 1 458 lines, outside the sensors' paths on purpose — move to
`probes/archive/`: the plan they measured is settled, and they are the record of **how** its numbers
were taken rather than a working part of the tree. The index (`probes/README.md`) says so, and every
reference follows: the four in `README.md`, the three in `src/page/table.js`, the three in
`test/page-view.test.js`, the seven in `plans/2026-09-17-page-perf/` and the three in the probes' own
instructions. The worklog entries that name the old paths stay as they are — an entry is the record
of the day it was written.

## Where the numbers went

| | before | after |
|---|---|---|
| the code (`src`, `tools`, `bin`, `test`) | — | 40 files, **+82 / −126**: net **−44 lines** |
| the comments of the same files | — | **+33 / −22** (the two new helpers say why they exist) |
| `TODO.md` | 96 lines | **31** |
| `probes/` | six files in the working tree | six files under `probes/archive/` |
| the checks | 87 fast / 192 full | **87 / 192** — none added, none removed |

The whole profile is green (`pnpm run verify`): 8 of 8 steps, `test:all` at 192 checks, the fixture
and the parity golden byte-for-byte where they were, the tarball unchanged. The commit touches gate
files — `package.json` carries the version, `tools/suites.js` the keyword above and
`test/gates-verify.test.js` the assertion — so it carries the `Gate-Change:` trailer; no threshold,
baseline or sensor rule moved.

## What was looked for and was not there

- **Comments that contradict the code**: every `file.ext:NN` reference in a comment resolves (the
  file exists, the line is inside it), every backticked identifier in a comment is defined somewhere,
  and no comment waits for a portion that has already happened. The rest is prose, and the request
  left it alone.
- **Hollow checks**: the check names hold no two of a shape, no check lacks an assertion (the ones
  that call a helper carrying them were read one by one), and the two assertions that could not fail
  are the two named above.
- **Clones below the sensor**: a pass at 3 lines / 25 tokens (the gate's own thresholds are 5 / 50)
  finds 50 small clones, all of them import blocks, a suite's opening lines and identical assertion
  trios — the ordinary shape of a suite rather than logic that drifted apart, and 0212 left the same
  shape alone.

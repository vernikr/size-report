# The duplicates the baseline tolerated, and one dead helper

Asked for in one portion: cut the volume of the code — take out the most obvious duplications and the dead code, using
`jscpd`, `knip` and the `deps` sensor's `no-orphans` among others.

## What was there

The sensors were green, so the tree held no *new* clone, no cycle, no orphan — and the `dup` baseline held **five
fingerprints** (29 duplicated lines): the clones the ratchet had accepted while they waited for a portion of their own.

| where | what was copied |
|---|---|
| `tools/parity-live.js` ↔ `tools/parity-freeze.js` | `parseArgs` — flag reading written out twice |
| `tools/make-fixture.js` ↔ `tools/parity-freeze.js` | the `try { main() } catch` tail of a tool's own script |
| `test/check.test.js` ↔ `test/doctor.test.js` | the settings-copy helper (`configWith` / `configAs`) |
| `test/environment.test.js` ↔ `test/parity.test.js` | the golden's text, its parsed form and the shared clone |
| `test/git-pins.test.js` ↔ `test/module.test.js` | five git commands that take a repository from empty to committed |

Beside the clones, the same helper had grown a third and a fourth time (`test/minify.test.js`,
`test/tokens.test.js`, `test/disk.test.js`), which the token sensor did not see: the signatures differ, the five
commands are the same. And `src/hook.js` had two imports from one module (`./tool.js`) and the writing of the two hook
files written out in both paths of the install; `src/strip/js.js` repeated the tail of a token-take in two of its
three cases.

## What was found and was not there

- **Dead code: one symbol.** A scan over every declaration in `src`, `bin`, `tools` and `test` (occurrences of the
  name in the whole tree) left exactly one: `contractRow` in `tools/page-harness.js`, exported and called by nothing
  since the suites moved to `gridRows`/`rowNumbers`. Removed.
- **`knip` names nothing that is dead here.** Its 56 "unused files" are the suites (the runner counts them), the page
  chapters (`src/page/*.js`, pasted into the assembled page as text, so nothing imports them) and the tool entry
  points; its 43 "unused exports" are symbols used inside their own module or by a suite (`PAGE_KEYS`, `parseMode`,
  `squeezedJs`, `CONFIG_CAUSES` — all read by `test/*.test.js`). Four exports are genuinely used only inside their
  file (`derivedConfig`, `minEngine`, `NO_OPTIONAL`, `BINARY_EXTS`); the keyword is redundant there, and it stayed:
  in `src/page/*.js` the same redundancy is a **linter's requirement** (a chapter uses a name another chapter
  declares), so the surface is uniform rather than half-cleaned.
- **`no-orphans`: nothing.** `pnpm run deps`: 116 modules, no findings — the relations go 491 → 490, and the one
  gone is the second import of `./tool.js` in `src/hook.js`, merged into the first.
- **Hollow checks: nothing.** An eslint pass with a much wider rule set than the project's own
  (`no-unreachable`, `no-constant-condition`, `no-self-compare`, `no-empty`, `no-else-return`, `sonarjs`'s
  `no-gratuitous-expressions`, `no-identical-expressions`, `no-all-duplicated-branches`, `no-redundant-jump`,
  `no-collapsible-if`, `no-invariant-returns`, `no-unused-collection`, `no-element-overwrite`, `no-undefined-argument`)
  left two remarks and no findings: a temporary variable in `src/page/build.js` that could be returned directly, and
  the deliberately empty `catch` in `src/tool.js` (a missing manifest is not a reason to fail). Both are the shape
  the project chose; neither is dead code.

## What changed

- **The flag reader of a tool lives in the harness** (`flagArgs`): one copy for the two parity commands, which had
  written it out twice. It returns the positional word as well, which only `parity-freeze` reads.
- **The tail of a tool's script lives in the harness** (`runMain`): `main` answers with an exit code (or with
  nothing), a failure is one line with git's own words if it has any, and the caller names the code — `make-fixture`
  and `parity-freeze` 1, `parity-live` 2.
- **The settings-copy helper lives in the harness** (`configWith(dir, name, edit)`): one copy where five suites had
  it, with each suite keeping only what is its own — `minify`'s engine, `tokens`' metrics and dictionary.
- **The golden lives in the harness** (`golden()`): the text and its parsed form in one place, used by the five
  suites that read it. `frozen.test.js` hashes the text now rather than the buffer of the same bytes.
- **A repository from empty to committed lives in the harness** (`commitAll(dir, name, email, subject)`) beside
  `initRepo` — the author name is a parameter, because `git-pins.test.js` checks what a non-ASCII one does to the
  parse.
- **`src/hook.js`**: one import of `./tool.js` instead of two, and the writing of the hook files (`installFiles`) is
  one function for both paths of the install — the named command and the silent one.
- **`src/strip/js.js`**: the take-tail (`s.out`, `s.i`, `s.last`, `s.word`) is one function (`take`), called by the
  regex case and the string case.
- **`src/project.js`**: `outputOf()` was called with an argument it does not take.

## What it is worth

| | before | after |
|---|---|---|
| clones (`pnpm run dup`) | 5 | **0** |
| duplicated lines | 29 | **0** |
| the tree (`git diff --stat`) | — | 19 files, **+132 / −166** |
| modules and relations (`deps`) | 116 / 491 | 116 / **490** |

The `dup` baseline is **not** re-taken: the ratchet only counts a clone that is not in it, so a baseline with five
stale fingerprints stays green. Re-taking it is a human action (`pnpm run baseline:dup`, `Gate-Change:` trailer) and
belongs to whoever wants the file to describe today's tree.

## The checks

The whole profile is green (`pnpm run verify`): 8 of 8 steps, the full set at **192 checks**, no check added and none
removed — the count in `README.md` does not move, and `test/docs-numbers.test.js` and `check:standards` agree. The
change touches no gate file (no threshold, no baseline, no sensor config), so no `Gate-Change:` trailer is needed.

## Still open

- The change is 19 files against the project's own budget of 10 — the portions named above (the three sources, the
  five tools, the suites by subject) fit it one by one.
- The `minify`/`tokens`/`disk` suites keep a one-line wrapper over `configWith` where their signature differs from the
  shared one; a caller-shape (`{metrics, tokens}`) would let it go, at the price of a fourth argument shape.
- `src/page/build.js`'s `pagePayload` and `src/tool.js`'s empty catch stand as the wider lint pass named them; the
  first is one line, the second is documented intent.

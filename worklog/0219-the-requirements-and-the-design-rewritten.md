# 0219 — the requirements and the design, brought to the same density

**Asked:** bring `docs/requirements.md` and `docs/module-design.md` to the density of the other standing
documents — requirements only, module boundaries only, without repetitions and measurements — and take out
what is no longer true.

**Done:** both rewritten; nothing in the code changed.

- **`docs/requirements.md`** — the same twelve sections with the same numbers (other documents cite them),
  but each requirement is one numbered item of one or two sentences instead of a heading with a list under
  it. Gone: the "smallest scenario" and the "questions the first version has settled" sections — the first
  repeated §7.1 and §11.1, the second named decisions that live in the code. Corrected: the promises about a
  per-cell mark of exactness (§3.3, §4.4) — that split has left the package, and what is promised today is
  the metric's method plus a degraded sensor reported with exit code 4.
- **`docs/module-design.md`** — kept as a design: the boundary between the project and the package, the six
  invariants, the split between data and display, the discovery and the five categories, the data contract,
  the sensors, the page, the settings, the cache, the refresh, the commands, the agents and the tests. Gone:
  the plan of the move with its five steps, the "settled questions" section, the "what v1 does not do" list
  (it duplicates the requirements), the drawing of the old build-time generator, the whole Figma-plugin
  history of §1, and the measurements (git calls per run, the file-size threshold, dates and journal
  numbers). Corrected: the categories are five rather than four (`tests` was missing) and the contract keys
  are the ones the engine really hands over (no `commits`/`series` of the first sketch).

**What holds it:** `pnpm test` green throughout, the section references of `plans/archive/PLAN.md` and
`REFACTOR.md` included — the numbers the plans cite (§2.2, §3.1, §3.3, §4.2, §4.3, §6.1–6.3, §7.1–7.3, §8,
§9.2, §11.2, §11.3, §11.6, §12 of the requirements; §3, §6, §7.3, §8.2, §8.4, §9, §13 of the design) all
still lead to a section, which is what `test/docs-commands.test.js` checks. Volume: 735 lines and 46 KB
before, 463 lines and 30 KB after.

**Files:** `docs/requirements.md`, `docs/module-design.md`, `docs/files.md` (the design's row),
`worklog/0219-the-requirements-and-the-design-rewritten.md`.

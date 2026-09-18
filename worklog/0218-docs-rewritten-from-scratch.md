# 0218 — the five documents, rewritten as if from scratch

**Asked:** refactor `README.md`, `AGENTS.md`, `docs/architecture.md`, `docs/files.md` and
`docs/wiring.md` for brevity and density — drop the water and the obvious, as if the documents were
written from scratch. A person reads only the README, the rest is for agents, so context is the
currency. Remove numeric facts (and their checks, if any are left). The volume of text is expected to
fall.

**Done:** all five rewritten; nothing in the project's behaviour changed, since only documents were
touched.

- **README** — the landing page for a person: what the tool is, what it measures, install and use, and
  where the rest is. The release notes of the old main page are no longer linked from it (`docs/files.md`
  keeps the path).
- **AGENTS.md** — rules only: what to run, look before writing, what to do when a sensor is red, the
  gate-files trailer, the commit budget, the release order, the report hook, the environment. The
  measured derivation of the commit budget (the p75 numbers and the date) is gone, the bound stays.
- **`docs/architecture.md`** — the decisions and the invariants without the measurements: data flow,
  the page (sparse packed block, stripping rather than minification, the tree, the window table, the
  memory, the read-only link, the layout), the metrics, the commands, the checks and their promises, the
  gate, the fixture's traps, what is not here yet. Every measured figure (bytes, milliseconds, node
  counts, memory, versions, dates, the `WORKLOG.md` section numbers behind them) is gone; the reasons
  the decisions were taken stay.
- **`docs/wiring.md`** — the same walkthrough in fewer words. Two parts are load-bearing and untouched
  in substance: the code-2 table (the documentation guard compares its causes with `CONFIG_CAUSES` word
  by word) and the config table. The migration order and the traps stay, with the measurements and the
  journal references out.
- **`docs/files.md`** — the tree map stays a map (the guard requires the table to cover every tracked
  file, both ways), but related files share a row and the roles are one line each.

**What holds it:** `pnpm test` is green throughout, the documentation guards included — the paths, the
calls and the section addresses of the rewritten documents still lead somewhere. Volume: 1 175 lines
and 110 KB before, 824 lines and 66 KB after (the two large documents roughly halved; the block of
references added to `AGENTS.md` below accounts for the four lines the first count missed).

**Afterwards:** a short block of references to the other four documents stands at the top of
`AGENTS.md` — the agent's entry point should name what a person's README, the architecture, the tree map
and the wiring guide are for.

**Files:** `README.md`, `AGENTS.md`, `docs/architecture.md`, `docs/files.md`, `docs/wiring.md`,
`worklog/0218-docs-rewritten-from-scratch.md`.

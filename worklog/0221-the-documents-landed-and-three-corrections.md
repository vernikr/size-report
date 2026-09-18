# 0221 — the rewritten documents landed, three corrections with them

**Asked:** fix the three inaccuracies found while reading the other thread's portion — the claim about the
default set of metrics, the stale count of lines in its journal, the disagreement with
`docs/architecture.md` — then land the rewritten documents as a `docs:` commit, take the PATCH release with
the re-pin of the attached copy, and check that the report came back with the new row.

**Done:** three corrections, then the portion committed and released. Not a line of code was touched.

- **The default set of metrics (`docs/module-design.md` §7.1).** The text said the set by default is `raw`,
  `min` and `tok`, with `gzip` merely sitting in the registry. Read from the code: the settings' own default
  is two — `DEFAULT_CONFIG.metrics` is `['raw', 'min']` (`src/config.js`) — while `raw`, `min` and `tok` is
  what a project without a settings file runs on: `projectConfig` answers exactly that (run on this tree:
  `metrics: ["raw","min","tok"]`, `minify: {"engine":"esbuild"}`,
  `tokens: {"family":"openai","encoding":"o200k_base"}`), and `--init` pins it. The sentence now names both:
  the registry holds four, `gzip` among them; the settings' default is `raw` and `min`; the derived profile
  adds `tok`. The same claim stood in the settings table (§9), as a list of what is counted — it now reads
  `raw`, `min`, `tok`, `gzip` with `raw` and `min` by default.
- **The count of lines in the journal.** `worklog/0218` quoted 820 lines for the five documents it rewrote;
  `wc -l` over them answers **824**. The missing four are the block of references the journal records as
  added to `AGENTS.md` afterwards ("**Afterwards:** a short block of references … stands at the top of
  `AGENTS.md`") — the count was taken before that block landed.
- **The draft of the settings (`docs/module-design.md` §9).** The text said the draft in the package "is
  copied under the name the tool reads", which `docs/architecture.md` contradicts: what the pinning writes
  is the project's own derivation (`src/init.js` takes `derivedProfile(root)`), and the draft is a sample a
  person copies by hand (`templates/README.md` and `docs/wiring.md` call it a sample). The sentence now says
  the draft is a sample for a hand-written file, not what `--init` writes.

**Both edits in `module-design.md` were kept line-neutral on purpose:** the file is 308 lines before and
after, so the volumes quoted by `0218` (824 lines) and `0219` (463 lines) stay the measurement of what
stands — correcting one count by making another stale would have been a poor trade.

**What holds it:** `pnpm run verify:fast` green (85 checks), the documentation guards included — the paths,
the calls and the section addresses of the rewritten documents still lead somewhere.

**Files:** `docs/module-design.md`, `worklog/0218-docs-rewritten-from-scratch.md`,
`worklog/0221-the-documents-landed-and-three-corrections.md`, and with them the portion itself:
`README.md`, `AGENTS.md`, `docs/architecture.md`, `docs/files.md`, `docs/wiring.md`,
`docs/requirements.md`, `worklog/0218-docs-rewritten-from-scratch.md`,
`worklog/0219-the-requirements-and-the-design-rewritten.md`.

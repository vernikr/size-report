# @vernikr/size-report

Watches how much code and documentation a project carries, commit by commit. Every file is measured
as written (`raw`), minified (`min`) and in tokens for a language model (`tok`), so a person sees
where a project swells and an agent sees what a change weighs in its own context. It forbids nothing
and blocks nothing: it only shows.

The report is a single self-contained page (`docs/size-report.html`) — no server, no network — and it
refreshes itself after every commit. A project needs no settings to start: with no config file the
tool derives them from the project and says so in one line.

## Install

```bash
pnpm add -D @vernikr/size-report     # npm i -D / yarn add -D work too
```

Needs a git repository with history and Node ≥ 20.19.

## Use

```bash
pnpm exec size --write            # build the report; the settings are derived from the project
pnpm exec size --init             # pin what was derived into a config file
pnpm exec size check              # did anything in the history go past the columns?
pnpm exec size explain <commit>   # why one commit has no row
pnpm exec size doctor             # all diagnostics in one answer
pnpm exec size install-hook       # rebuild the report after every commit and merge
```

## Where the rest is

- [`docs/architecture.md`](docs/architecture.md) — how the tool is built, the checks and the gate
  against bloat.
- [`docs/wiring.md`](docs/wiring.md) — wiring it into a project, the settings, the surface for an
  agent.
- [`docs/files.md`](docs/files.md) — what is in this repository.
- [`AGENTS.md`](AGENTS.md) — how to work inside this repository.

## License

MIT

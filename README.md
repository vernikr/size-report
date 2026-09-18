# @vernikr/size-report

A tool that watches how much code and documentation a project carries, commit by commit. Every
change is shown in three measures at once — as written (`raw`), minified (`min`) and in tokens for a
language model (`tok`) — so a person can see where a project is swelling and an agent can see what a
change weighs in its own context. It forbids nothing and blocks nothing: it only shows.

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

How the tool is put together — the engine, the report page, the checks and the promises they hold —
is in [`docs/architecture.md`](docs/architecture.md). The rest of the description this project used to
carry on its main page (the status and the release notes, the file table, the step-by-step wiring
instructions, the settings, the gate against bloat and the traps) is kept in
[`docs/archive/README_old.md`](docs/archive/README_old.md). How to work inside this repository (what to
run, what to do when a sensor is red) is in [`AGENTS.md`](AGENTS.md).

## License

MIT

# The consumer project's history — a frozen bundle

`history.bundle` is the history of the `safe-resets` project at revision `bd6ef9d`, the one the parity
reference was taken from (`fixtures/parity/manifest.json`). The bundle's `main` branch points at exactly that
revision, so a clone from it gives the history the project had back then: 149 commits, 95 rows × 27 columns,
`docs/size-table.html` at 225 673 B.

Why the copy. The project is private, and the package's CI has neither a key to it nor access to it, while the
comparison with the live history is needed on every push. The bundle makes that possible for anyone and
without secrets: `pnpm run parity:live` takes the reference from `fixtures/parity` and the history from here.

The bundle's bytes depend on the version of git and are recorded nowhere — what matters is which revision it
carries. That is checked by the tools themselves: `tools/parity-live.js` clones the bundle and switches to the
revision from the reference, while `tools/parity-freeze.js` compares the assembled artifact with the blob of
that same revision, so a substituted history cannot go unnoticed.

The bundle also has to carry `HEAD`: without it a clone guesses for itself which branch to lay out, and
different versions of git guess differently — one lays out `main` while another lays out `master` and prints
`hint: Using 'master' as the name for the initial branch`. A bundle without `HEAD` is no replacement for the
project, and `pnpm run check:standards` guards that.

There is no need to rebuild it: the reference's revision is immovable. If it is moved after all
(`--at <sha>`), the bundle is rebuilt like this:

```bash
git clone --no-hardlinks ../figma/safe-resets /tmp/live
git -C /tmp/live checkout -B main <new-revision>
git -C /tmp/live bundle create fixtures/live/history.bundle HEAD main
```

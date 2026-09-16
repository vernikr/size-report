# 0157 — S2 closed: step 4 empty, wash-up met

Requested (point 5 of the work): close subplan S2 if the measurement allows — step 4 (the cause
arguments) and the wash-up over the three files.

## Step 4 — empty, and measured rather than assumed

The step was to translate the cause arguments of S2's files. S1's step 3 (`a7c869b`) renamed the whole
registry first, so the arguments are already English:

- `src/config.js` — `git missing`, `not a git repository`, `no settings file`, `settings not parsed`,
  `settings invalid` (the `fail` helper);
- `src/init.js` — `config already exists`;
- `src/project.js` — raises none.

Nothing was edited for this step. The split was safe because the catalogue keys on the cause and the
cause kept its name until the whole vocabulary moved in one commit — which is what the subplan said
would make it safe, now confirmed.

## Wash-up — met

```bash
rg -cP '[\p{Cyrillic}]' src/config.js src/init.js src/project.js
# (no output)
```

The subplan's acceptance line says the same, and it now carries the date it was met. `ADVICE_LINE`'s
Russian alternatives are deliberately **not** removed: S3 (`src/minify.js`, `src/strip/guard.js`), S4
(`src/git.js`, `src/history.js`, `src/check.js`, `src/doctor.js`, `src/explain.js`) and S5
(`src/hook.js`) still print Russian markers, and narrowing the pattern now would redden the catalogue.
The removal belongs to W1's step 8, condition measured and recorded as **N28**.

## Where the work stands

- **S1 done** (steps 1–4; the wash-up deferred per N28), **S2 done** (four steps, the last one empty).
- The runtime layer still to do: S3 (`measurement`), S4 (`diagnostics`), S5 (`automation`); then W1,
  W2, C1–C3, D1.
- The tracker's S2 row is now `done` with the four commits and the counters; the wash-up criterion is
  in the subplan with its date.

## Release and push

This entry and the tracker row ship nothing (plans and the journal are outside the tarball), so the
commit carries no release; the code half of the portion (step 3) is the commit before it. Both are
pushed to `origin/main` with the full profile run by hand first.

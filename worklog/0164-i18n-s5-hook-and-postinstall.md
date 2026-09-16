# S5 steps 1–5 and the post-install note — the hook is English, the panel waits on N25

Requested: keep item 5 going — start S5 with the hook's texts, the commit subject and the doctor
findings that read it; close the subplan in the same portion if the measurement supports it.

Landed in one commit: `src/hook.js` 40 → **0** and `bin/postinstall.js` 2 → **0** — the hook file's own
four lines (mark plus three comments, with `MARK` still `# size-report: hook`), all three refusals and
the `fix: ` marker with them, both install answers and the "nothing installed"/"removed" lines, the
lock/CI/settings/detached-HEAD/un-tracked `why` phrases, the `✓`/`✗` notes, the commit subject
(`chore(report): report rebuilt after <sha>`) and the post-install note. Readers moved with the text:
`test/hook.test.js:151,191,254,323`, the four catalogue cases in `tools/refusals.js` (61 → 55) and the
README quotation — which makes `README.md` read **0** Cyrillic lines, the first document of the
repository with none at all. `test/hook.test.js` 111 → 109.

**S5 is not closed, and the reason is a decision rather than a translation.** The one step left is
`src/page/panel.js:9-11` — the tooltip of every file checkbox: `' (нет на HEAD)'`, `' · категория: '`,
`'из настроек'` / `'по расширению'`. Translating them makes the chrome inside a `locale: "ru"` report
English, and this repository's own tracked report is exactly such a report; N25 is that question and
has not been answered. So the three lines stay Russian, the counter over the three files answers
`src/page/panel.js` 3 alone, and `BLOCKERS.md` N25 now carries the status line saying it is the only
thing keeping S5 open.

**The commit subject changes no reference, measured.** `rg -c 'хук|hook' fixtures/*` answers nothing;
`fixtures/**` is clean in `git status`; `fixtures/parity/artifact.sha256` is still `1bdb27e1…`;
`check:standards`, `parity:live` and `pack:check` are green with the 66 277-byte report byte-identical
(the artifact is taken by the frozen copy, and the page is built from the locale dictionary). Red first,
twice: the subject back to Russian reddens both exact comparisons — `expected: 'chore(report): report
rebuilt after 8cbb71a'` against `actual: 'chore(report): отчёт пересобран после 8cbb71a'` — and a
catalogue `must` phrase back to Russian reddens the refusal run
(`«hook / foreign hook»: в отказе нет «уже есть и поставлен не этим инструментом»`).

One consequence named rather than hidden: this repository's own `post-commit` hook calls the attached
copy (`node_modules/@vernikr/size-report`, 2.4.0), so report commits here keep the old Russian subject
until a release ships the literal. That is N20's cadence question, not the tree's state.

**Who reads nothing, proved the other way round.** The full profile is green *after* every literal of
the two files was translated, and only four assertions were moved — so any other reader would still be
asserting the old Russian and would have reddened. It did not. Hence the hook file's comments, both
install blocks apart from `:151`, the `why` phrases apart from `:323`, the `✓`/`✗` notes and the
post-install note have no reader; the same answer the reader list's greps gave, now confirmed by a green
run rather than by a search.

**N28.** No module of `src/**` prints a Russian advice marker any more; what is left is
`tools/gates/dup.js:139` and `tools/gates/coverage.js:93` (`соберите её: `), which belong to W2 and which
the extractor never reads. So the condition now holds for the runtime, and narrowing `ADVICE_LINE` is
W1's step 8.

Sensors: `verify:fast` green, the full `verify` green (eight steps, `test:all` 175); `SITES` 4 and
`PRINTED['src/hook.js']` 4 unmoved, state keys and `MARK` untouched.

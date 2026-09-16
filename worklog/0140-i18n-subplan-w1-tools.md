# The string work: subplan W1 (the instruments) planned, and the template dependency found

**Requested:** the next subplan of the map — W1, the repository's instruments
(`docs/plans/2026-09-16-i18n-english/tools.md`), by the owner of the files. Same rules as S1–S5,
plus: the hole check S5's planning prompted (are there files in this owner without one?), the
readers named including the machine ones and the absences, "red first" experiments, the rule that
keeps the tree green between commits, terminology checked against S1 with foreign ownership marked,
acceptance by the existing sensors. Tracker update and this entry included. N19, N24 and N25 left
open.

**Done.** `tools.md` written; the tracker's W1 row corrected (eleven files, not twelve) and marked
**written 2026-09-16**, with the hole check in it; `BLOCKERS.md` given **N26**.

**No hole in this owner — measured, since that was the question.** Every file under `tools/**` is
named by W1, W2 or W3: the eleven instrument files sum to 349, the tracker's number,
`tools/gate-probe.js` and `tools/gates/common.js` carry no Cyrillic at all, and the two files that
did have Russian and no row anywhere (`.githooks/**`, the declarative dotfiles) were found while
planning S5 and are W2's and D1's now.

**The file that three owners share.** `tools/refusals.js` (169, the largest single batch of this
work) splits by ownership rather than by lines: the `SITES` keys and every `must` phrase belong to
the subplan whose printed text they quote (already English by the map's order, each moved in that
subplan's own commit), the catalogue's prose — `truth` 37 lines, `advice.why` 40, the header — is
W1's and read by no machine, and the extraction device is the joint part: `ADVICE_LINE` carries the
marker family, and by the tolerance rule of S1's dictionary the Russian alternatives may go only in
the last subplan that prints advice — which is W1, since every refused marker belongs to S*. The
`<файл>`/`<коммит>` placeholders turn out to be S1's literals (`src/args.js:39,92,129,133`,
`src/config.js:144`, `src/refusal.js:101,117`) quoted by the catalogue's `template` shapes, so they
move in S1's step 2.

**The sharpest dependency, and it belongs to the install pin.** `tools/docs-facts.js` reads the help
twice: the working tree's (line 135, jointly with S1 — without it `USAGE.split('\\nКоманды:\\n')[1]`
is `undefined` and every docs guard throws) and a **pinned revision's** help read out of git history
(`commandsAt`, 175–177) — and today's pin is older than S1's rename. Replace the Russian section name
instead of adding the English one and `test/docs-pin.test.js` goes red with "у ревизии … нет справки
с разделом «Команды»"; the same red arrives by itself on the release that moves the pin past the
rename (N20). So the step **adds** the English name, keeps the Russian one with its reason, and is
the single exception this owner claims from the guard G1 — with the alternative (a structural parse)
named as the code change it is. Nothing else here reads a verdict: `tools/gates/run.js` says in its
own words that a step's output is not captured, and `.github/workflows/release.yml:71` reads the exit
code of `pack:check`.

**The frozen layer is touched in exactly one place, and the plan says why it is left alone.**
`tools/parity-freeze.js:98-118` writes `fixtures/parity/README.md` and `tools/make-fixture.js:56-64`
writes the synthetic fixture's `config.json` values — both allow-listed data, and the first says so
in its own comment ("it is the standard's data rather than this file's documentation and stays
Russian"). The console lines around them are W1's; the step proves the writing functions are
untouched by staying green (the title string stands in the frozen `fixtures/synthetic/config.json`,
measured). `fixtureNote` (the synthetic README) is W3's text, called here.

**N26 — the numbers stay Russian.** `tools/run-tests.js:43,64` and `tools/gates/run.js:111,114`
format a duration with a decimal comma made by **code**, so `total 12,2 s` is what a translated
profile prints. It is formatting rather than a literal, no check reads it (measured: no test matches
`[0-9],[0-9]`), and the options — leave and name it, change four call sites (one of them in a gate
file, with the trailer), or force a locale — are recorded for the mission agent, together with N25
as the same kind of question.

**The readers that are the red.** `test/refusals-catalog.test.js` reads the maps and the **counts**
of `refuseCause('…')` sites and `'✗ ` marks, so no step may touch a key or a number;
`test/refusals.test.js:280` asserts a `template` shape's first word is a command the help knows; and
`test/gates-verify.test.js:19` loads `parseWorkflow` without ever matching a message. Two
duplications are named rather than fixed: `test/refusals.test.js:169` builds its own tool object
with `harness.js`'s name, and the three test names of `test/parity.test.js` say the same words —
C1's and C2's to align, `pnpm run dup` the sensor that watches them. Six comments left in this
owner's files (three in the catalogue, two in `run-tests.js`, one in `docs-facts.js`) are prose,
recorded in `TODO.md` as S3's was.

**Checks:** `pnpm run verify:fast` green. The instruments are outside `files` in the manifest
(`bin`, `src`, `templates`, `README.md`, `LICENSE` — measured), so this whole portion will ship
nothing and release nothing. No code, no test and no gate file touched this time either.

**Offered next:** the sensors (W2 — `tools/gates/**`, `tools/suites.js`, `.githooks/**`, the
baselines' notes, where every commit carries the `Gate-Change:` trailer), or the first chunk of work
under a written plan, which is where the translation itself starts.

# @vernikr/size-report

A tool that tracks how the volume of code and documents grows: every change shows how much the
project grew or shrank, in three measures — as written (`raw`), minified (`min`) and in tokens for a
language model (`tok`).

It answers two questions: for a person, "where is the project swelling"; for an AI agent, "how
much does my change weigh in its own context". It forbids nothing and blocks nothing: it only
shows.

## Status

**Release 2.4.0 (2026-09-15).** The tool lives as a package of its own: the registry name is
`@vernikr/size-report` (published by tag from CI, with no secret). A project may keep no settings at
all: without a config file the tool derives them from the project itself and says so in one line,
and `--init` pins what was derived into a file. The report is **one file**, the self-contained page
`docs/size-report.html`, and it appears by itself: the updating hook is installed after the package
is installed and on the first run. The version is in the manifest, and every release has a
`CHANGELOG.md` section saying what changes in the numbers: the table there is not a retelling but a
measurement on the fixture, checked against a live run (`test/changelog.test.js`).

2.4.0 changes nothing in the numbers; what it changes is **what is visible and in which order**:
with no config file every tracked file is a column (rather than a sample of twelve), folders fold in
the tree, and everything outside the report stands after the rest with its box cleared and
unavailable; in the table, the columns the last commit touched come first. The data `schema: 1`,
frozen at 1.0.0, stays what it was: the release added a field rather than changing the meaning of
the old ones.

**Parity with the implementation the move started from is proven, not asserted.** The command is
`bin/size.js` and the package's entry point is `src/size-table.js` (a re-export only), with the
mechanics laid out in modules under `src/`. `pnpm test` compares the package with the frozen
standard byte by byte on the fixture and in four deliberately hostile environments (the machine's
git settings, the locale); `pnpm run parity:live` does the same on the consumer project's live
history in two environments — 95 rows × 27 columns, the artifact self-contained and passing its own
control mode. The output does not depend on the machine: the git settings that change what is
parsed are pinned inside the engine (`BLOCKERS.md` §B1). The comparison against the working tree
compares content rather than sizes, so a tree with CRLF newlines (`.gitattributes`; `core.autocrlf`,
the default of Git's installer for Windows) is no obstacle (`BLOCKERS.md` §B2).

**A history with deletions is no longer a dead end** (`BLOCKERS.md` §B3): a column whose file lived
in history and was deleted before HEAD used to fail the whole run with code 1 and the text "no file
instead of no file" — that is, a project with deleted files got no report at all. Now only a
**disagreement** between the two sides of the comparison is a refusal: a lost creation, a lost edit
and a lost deletion still fail the run, but with the real cause and a ready command, while a file
deleted before HEAD is simply empty in the table. Proven by numbers rather than by a word: the
column's size at every commit is checked against the blob size from git — a returned file gives the
same number as its first appearance — and a witness, the file that appears only in a merge, fails
the run naming both sides. The boundary of the same parse is closed as well (`BLOCKERS.md` §N8):
the path for the state was chosen by the order of the settings rather than by what the commit holds,
so with `diff.renames=false` — when git returns the old name of a renamed file and the new one in a
single commit — the engine took the vanished alias and the comparison refused on a legitimate case;
now it takes the alias git returned a blob for. The old numbers could not move: both logics agree
wherever the first alias in the commit exists, that is, in every run that ended with a report
before.

**The consumer project is connected** (2026-09-14). `safe-resets` installs the package from git by
the release tag and keeps no copy of the tool of its own — neither `tools/size-table.js` nor a test
for it: the table is built and checked by the `size` command (`pnpm run test:sizes`), and its part
in that project is one line of its runner (`worklog/archive/WORKLOG.md` §18). The connecting
instruction turned out to be right and incomplete in two places — the step giving CI access to the
package and the order of moving off an already installed copy — and both are written into the
instruction below. The step with a key left it later, along with private access.

**The data contract and the page.** The engine hands over absolute values and the shape of the table
(`--data`), while deltas, totals, "now" and the filters are computed by the page — which is the
report itself (`size-report.html`): without that split the filters and "the total over the
selection" are impossible in principle. The contract carries the accuracy of a number as well, a
row of `approx` marks per cell, because that is a fact of the measurement rather than a conclusion:
the page shows what the engine said and keeps no rule of accuracy of its own. The page's panel is a
tree of files by folder, with a switch per folder for the whole subtree; a reader's choice survives
a revisit and travels in a link — the page's address is the link. The contract carries the **project
catalogue** too: every path git sees, so the page's tree is the project's tree, while numbers exist
only for the files that became columns (`CHANGELOG.md` 2.2.0).

The tool grew out of one script in the consumer project [`safe-resets`](../figma/safe-resets) — the
metrics `raw` and "a simplification instead of minification", a static report in git; that path
does not exist in this repository, and it is not named anywhere without the project.
**A project whose code is JavaScript modules in `.js` reports too**: the stripper's guard understands
both forms, a script and a module, so connecting needs no setting edited by hand, and when the graph
really is not JavaScript the refusal names the cause and the command. Hints, the help text, the
default fix command and the templates name the **path inside the project**
(`node node_modules/@vernikr/size-report/bin/size.js`) rather than the package name: `npx <name>`
runs an installed package only while it is there, and in a project without it the name goes to the
registry and pulls a package over the network.

**What the documentation promises is checked, not assumed**, and the promises are split one per file:
existence and completeness of paths (`test/docs-paths.test.js`), commands, refusal causes and section
links (`test/docs-commands.test.js`), the count of checks (`test/docs-numbers.test.js`), the install
example leading to a revision whose help knows the named commands (`test/docs-pin.test.js`) and, with
the releases, the version of the manifest and the table of what changes in the numbers
(`test/changelog.test.js`). One reader of facts serves them all (`tools/docs-facts.js`). What a
machine cannot check — wording, promises about the future, whether a file's role is described
correctly — the guards do not take on, and they say so in their headers.

**git is read through one boundary, in the checks too**: the list of pins (`core.quotePath`,
colouring, the signature block, the encoding) is one for the engine and for the harness, so the
checks and the tools reach git through a common place — and an unpinned place is guarded by
`test/git-pins.test.js`, which also shows by witness that a pin works: the same read without it
returns a non-English path quoted. It is the same defect as B1, only found in the harness: without
the pins a check is green on a machine with our settings and red on a machine with the default ones.
The check that measures the environment itself keeps its unpinned read deliberately — it is named,
and it stands in a list of its own.

**Every refusal of the tool tells the truth, and that is guarded rather than assumed.** A false cause
in a refusal text was found by a live run, four times in a row, each time by accident — so the class
is closed not by a fifth fix: `tools/refusals.js` holds a line per refusal saying what it must
convey, which code to answer with and which phrases must stay in the output, and two checks split
that promise. `test/refusals.test.js` **calls** each refusal and compares the exit code and the
phrases; `test/refusals-catalog.test.js` reads the sources and requires a catalogue entry for every
refusal site — the maps `SITES` and `PRINTED` hold the counts — and a case in the catalogue for every
entry, so a new refusal cannot appear without a check. Refusals a run cannot reach are named
explicitly: four are guarded by a check of their own (the catalogue names the file and the phrases),
and one cannot be caught at all — "internal error" — which is said where it stands. What the
catalogue does not take on is said in words: wording beyond the listed phrases, and meaning, and the
"!" sign, which is a note (an approximation, a mixed commit, the automation switched off) rather
than a refusal, with exit code zero.

**And the advice in a refusal is executable — that is checked as well.** The truth about the cause is
half the promise; the other half is that the suggested command can be run. A live case started this:
a hint called out to a registry name no package carried, and in a project without that package
installed it ran someone else's code. Now every catalogue case says what the refusal advises, and the
advice is executed in the state that printed it: the exit code is compared (including "the refusal is
gone" — the same call after the advice must answer differently), while an advice that is a form
without values is checked against the help output (the same commands and flags). Advice a person has
to carry out is named with its reason — editing settings, committing, installing a dependency — and
that is said there too, in the catalogue. A new advice inside an existing refusal cannot pass
silently: the advice is taken out of the output by its markers, and it has to have a catalogue entry.

**A module no longer costs a Node process per cell**: the guard parses a module through
`vm.SourceTextModule`, which exists only under `--experimental-vm-modules`, and that is where the
per-cell process came from. Today one worker thread parses the modules for a whole run, and the price
has not disappeared but become one-time; the parse also rests on an experimental API (without it the
guard falls back to `node --check`: slower, no softer). What a run costs today the run prints itself
(`pnpm run suites:measure`).

**The checks' shared part lives in one place** (`tools/harness.js`): one clone of the fixture per
environment rather than one per check, a read-only run of the tool is not repeated, and a check that
edits files takes a clone of its own. The files go in a pool over the cores (`tools/run-tests.js`),
and the numbers add up: the run counts the checks of every file against the `test(` declarations in
it, so a file that did not run is a failure rather than fewer checks.

**There are two runs, and the choice between them follows the price of a file, not the alphabet.**
The cost of a check here is not the size of the file but how many times it launches the tool and git:
a launch is a Node process, while cloning the fixture or building the artifact takes hundreds of
milliseconds. So the fast run gathers what it proves from reading (sources, tree, help, reference
numbers on a shared fixture), and the full one adds what runs the tool many times on its own clones,
commits and installs hooks; the reason for each expensive file is named line by line in
`tools/suites.js`.

| Run | Command | Checks |
|---|---|---|
| Fast — every edit | `pnpm test` | **72 of 177** |
| Full — release and CI | `pnpm test:all` | **177** |

No check is lost or weakened: the full run starts all 177 with the same files, the fast one takes part
of them. The default is the full run — a file becomes fast only explicitly and with a reason — so new
expensive work cannot quietly move into the fast one. Two declarations guard that:
`test/suites.test.js` (every file classified, and a reason for each) and the documentation guard
`test/docs-numbers.test.js` (the numbers in the table above).

**The runs have no time targets, and that is a decision rather than an omission.** Seconds depend on
the window — the machine is under very different load at different times — so neither the suite nor CI
fails over time, and this document promises no seconds: `pnpm run suites:measure` prints every file's
duration in a run of its own (and a run prints it next to its tick), but that is a measurement, not a
threshold. The split rests on what a file is about rather than on how long it takes. CI calls the full
run twice: in the usual environment and with none of the machine's settings
(`GIT_CONFIG_GLOBAL=/dev/null`).

**What the package promises is down to fact.** The shipped-file list named four paths the repository
does not have (`dist/`, `templates/`, `CHANGELOG.md`, `LICENSE`): today it promises only what exists —
`templates/` and `CHANGELOG.md` came back into the list together with their files, not before them —
while `pnpm run pack:check` checks it from both sides, that the list names nothing absent and that the
tarball carries nothing the list does not promise. Taking both references works again (`pnpm run
parity`, `pnpm run fixture`) and no longer depends either on whether the consumer project keeps a copy
of the tool or on the machine's git settings. Two texts that promised the same were fixed as well: the
`--init` hint (it said the checks travel with the package, while the suite is not part of it) and the
default `fixCommand` (it named a package that does not exist, `npx size-table --write`).

**The checks run themselves** (`.github/workflows/ci.yml`). On every push and every pull request one
job `verify` calls **one command** — `pnpm run verify`; the list of steps lives in one place
(`tools/gates/run.js`) and matches the local one, so a check that is not in a profile cannot be in CI
(`test/gates-verify.test.js` watches that). The profile, in order: the strict linter, the bloat
sensors, the whole suite, parity with the history of the consumer project, reproducibility of both
references and the work from the assembled tarball. Two steps are dearer and live in the slow profile
instead — the same suite in an environment with none of the machine's git settings
(`GIT_CONFIG_GLOBAL=/dev/null`) and coverage under c8: `pnpm run verify:slow`,
`.github/workflows/verify-slow.yml` on a schedule. The job needs no secrets: the consumer's history
lies in the repository as a bundle at the revision recorded in the reference (`fixtures/live/`), and a
re-take goes into a temporary directory and is compared with what is committed, so the working tree
stays clean. The job pins Node 22 and the actions by commit SHA, and there is deliberately no matrix
over Node versions: this pass is about control.

**A release is a tag** (`.github/workflows/release.yml`). Pushing `v<version>` runs the strict linter
and the whole suite, checks the work from the assembled package, compares the manifest version with the
tag and sends the package to the registry — no secret and no code from an authenticator: publishing
goes by the attestation GitHub Actions issues for that job (trusted publishing), which npm accepts
instead of a token. A prerelease goes to `next` rather than `latest`, so a draft is not what a default
install picks up. The publisher is set up once and lives on npmjs.com, not in the repository:
`npm trust github @vernikr/size-report --file release.yml --repo vernikr/size-report
--allow-publish` (the same is the Trusted Publisher button in the package's settings), and
`npm trust list @vernikr/size-report` shows whether the link is there. The job raises no version: a
person names it in the manifest and `CHANGELOG.md`, and both are compared with the tag rather than
derived from it.

One trap cost an edit of its own, and it is about `setup-node` rather than this package: with
`registry-url` the action writes `_authToken=${NODE_AUTH_TOKEN}` into `.npmrc`, npm then considers
credentials given and does **not** go for the OIDC attestation — publishing fails 404 with a correctly
set-up publisher. So `registry-url` is not given here: npmjs.org is the default registry anyway, and
`publishConfig` in the manifest carries `access: public` only. A draft run from Actions ("Run
workflow": nothing is published by default) goes the whole list up to the publishing step itself — the
strict linter and the whole suite, the work from the tarball, and a package built on a draft version
above the manifest's own, so that the registry does not refuse an already released number. Whether the
publisher is set up a draft run does not show: `--dry-run` exchanges no attestation and passes without
any credentials at all — only a real tag tells the truth about that.

**Two rules came out of the first live runs of CI, and both are about the border of a call.** Process
output is collected by the harness rather than glued into a string: a multi-byte character torn at a
chunk border would turn into two replacement characters, and where those chunks fall is the kernel's
business — a local run does not show it (`test/runner.test.js`). And of the references only what this
repository writes by itself is compared byte for byte: a history bundle is packed by git, whose bytes
depend on its version, so the bundle is compared by content — the branches, the tip and the number of
commits, that is, what makes it a replacement for the consumer project. The bundle also has to carry
`HEAD` and the branch `main` at the reference revision, or a clone decides on its own which branch to
lay out (`tools/check-standards.js`).

**Страница отчёта выглядит и ведёт себя как инструмент** (`REFACTOR.md` R-2.2):
один набор стилей таблицы на оба вывода (`src/table.css`) — странице достались
липкие шапка и колонка коммита, которые раньше были только у статического
артефакта, и она больше не уезжает вбок в узком окне (до правки — 1518px при
окне 620). Добавились состояния «нечего показать» (сняты все метрики или все
файлы) и переключатели, доступные с клавиатуры. Цвет
deльт задан один раз и по артефакту: рост зелёный, спад красный — смена это две
строки в `src/table.css` плюс пересборка эталона артефакта, больше цвета нигде нет.

**Левая панель страницы — дерево файлов проекта** (`REFACTOR.md` R-2.4, каталог
путей — `CHANGELOG.md` 2.2.0, складывание папок — 2.3.0, вид того, чего в отчёте
нет, — 2.4.0). Дерево строится по путям проекта, а не по одним
колонкам, поэтому в нём видно и то, что в отчёт не попало: у такого листа (и у
папки, где измерять нечего) галочка стоит на месте, но **снята и недоступна** —
включать нечего, — а причина в всплывающей строке («колонкой быть не может» —
правило пакета — или «в набор колонок не попал» — выбор проекта). Снятая, а не
убранная: ряд строк остаётся ровным (глаз сравнивает одно с одним), а недоступность
говорит, что это не выбор читателя. Заодно счётчик папки со смешанным
составом написан долей («2/5»: два файла в отчёте из пяти в папке). Сам отчёт в
дереве назван всегда: его отслеживаемость — свойство момента, и от неё содержимое
страницы не зависит. **Всё, чего в отчёте нет, стоит после того, что в нём есть** —
и папки, и листья: в списке, где половина строк не переключается, отчёт должен
быть виден сразу, а не среди чужого (`test/page-tree.test.js`). У
папки три состояния — все её файлы включены, часть, ни одного, — и переключатель
папки ведёт за собой всё поддерево; рядом стоит число файлов. Своего состояния у
папки и у быстрой кнопки категории нет: обе переставляют галочки файлов, поэтому
дерево, кнопки и таблица не могут разойтись. У каждой папки есть ещё свой знак
(▾/▸): он отвечает за то, сколько дерева видно, — это дело смотрящего, а не выбор
читателя, поэтому знак помнится между заходами и в ссылку не идёт (у записи свой
ключ и тот же паспорт отчёта; разворот всех папок её убирает, как возврат галочек —
запись выбора). Список файлов длиннее панели
прокручивается, а не выталкивает таблицу, — и прокрутка эта одна: на широком
экране листается панель целиком (при окне 1440×900 страница укладывается в окно, а
таблица берёт всю оставшуюся высоту), а на узком — сам список, потому что там
панель растёт вместе со страницей. Дерево стало длинным (в этом репозитории 148
подписей), поэтому папки и складываются: иначе до его середины не добраться.

**Складывание папки — чистый вид, и оно не считает числа** (`CHANGELOG.md` 2.4.0).
Поддерево лежит в разметке и прячется классом на строке: клик по знаку меняет три
вещи, которые читатель и видит, — класс, знак и запись в памяти. Пересборка здесь
была бы честной работой впустую: она строит таблицу целиком (в этом репозитории —
97 строк × 136 колонок, 39 576 клеток), то есть платит за числа, которых складывание
не меняет, — и это было видно глазом как задержка. Замер в настоящем Chrome на этой
же странице: клик по знаку папки `src/` (42 строки поддерева) — **0,6 мс** в
обработчике и 6 мс на перекладку против **107 + 380 мс** перерисовки, которую он
вызывал раньше (столько же стоит переключение одного файла у той же страницы).
Стережёт это проверка о том, что после складывания таблица осталась той же самой
разметкой (`test/page-tree.test.js`), а не собранной заново.

**Колонки, которых коснулся последний коммит, идут впереди** (`CHANGELOG.md` 2.4.0).
Отчёт пересобирается после каждого коммита, и первый вопрос читателя — что принесла
эта правка. Знак приходит из истории, а не из чисел: правка без изменения размера —
тоже правка. Берётся последний коммит, задевший хотя бы одну колонку, — считая от
верхушки назад: коммиты мимо колонок (и, прежде всего, сам отчёт, который коммитит
хук) пропускаются, — иначе знак зависел бы от собственного коммита отчёта, а тот же
прогон давал бы другие байты. Внутри каждой части порядок прежний, из настроек
(`sort` устойчив): порядок колонок — то, к чему читатель привык, и своим выбором
файлов он его не переставляет (`test/page-view.test.js`, поле `last` контракта).

**На широком экране панель стоит слева от таблицы и не вытесняет числа**
(от 900 px, `src/page/app.css`). Это не украшение: на десктопе бокового места
много, а вертикального мало — переключатели, дерево и числа видны одновременно, и
ни прокрутка чисел, ни прокрутка дерева не уводит управление за верх экрана.
Раскладка сделана сеткой на `body`: обёртки в разметке нет, потому что страница
собирается вклейкой глав и форма страницы должна жить в одном месте. Строк у сетки
пять и они названы по предмету (заголовок, сообщение о ссылке, работа, сообщение
пустоты, подпись), тянется только рабочая: таблица берёт всю оставшуюся высоту, а
панель — не больше неё. Цена прежнего поведения была видна глазом: высоту страницы
задавал список файлов, и под таблицей оставалась пустота (замер до правки при окне
1440×900: панель 883 px, страница 1097 при окне 900, под таблицей 195 px).
Измерено в настоящем Chrome после правки: при 1440×900 страница ровно в окно
(900), панель — колонка 300 px слева (103…888, содержимое 804 — дальше она
прокручивается), таблица 1060 × 735 на том же верху 103 (до правки 1060 × 602), а
под ней остаётся только подпись под таблицей (62 px); при 1024×800 — те же 300 и
таблица 651 × 620; при 899 раскладка снимается и столбцы снова идут друг под
другом (панель 871, таблица 871 × 442, страница прокручивается — 972).
Стрежет это проверка на числах таблицы, а не на разметке: выключение папки убирает
ровно её колонки и ровно её объём из итога (`test/contract.test.js`). Проверено в
настоящем Chrome: 9 папок до трёх уровней вложенности (`.github/workflows`,
`tests/golden`), 25 файлов, ни одного внешнего запроса (сеть — только сам файл),
ни одной ошибки в консоли, `docs/6` после выключения одного своего файла показала
третье состояние, а после выключения целиком — 52 колонки → 40.

**Галочка не отбирает ни прокрутку, ни место у чисел** (правка вида страницы
2026-09-15, `src/page/app.js`, `src/page/app.css`). Панель рисуется заново после
каждого переключения, и вместе с ней терялось место, до которого читатель
долистал: клик по галочке возвращал список к началу, а до нижних файлов дерева так
и не добирались. Теперь прокрутка панели и списка — часть вида, как галочки: она
запоминается перед пересборкой и ставится обратно после (фокус возвращается без
прокрутки — `preventScroll`), а поле «Файлы» больше не режет дерево своим
потолком в 62vh. Строка категорий («Код», «Документация», «Служебные») в широкой
раскладке липнет к верху панели — фон у неё тот же, что у панели, поэтому под ней
не читаются проезжающие файлы; верхний отступ панели для этого переехал в первое
поле (прокручиваемое видно и в отступе прокрутки — замер: до него в полосе 13 px
читались «parity/» и «data.json», после — сама строка). Шрифт подписей файлов
стал как у чисел таблицы (12,5 px), а расшифровка под деревом убрана: она
отодвигала числа, а её смысл и так стоит у того, что объясняет (знак числа называет
цвет дельты, способ и точность — под переключателями метрик, знак пропуска —
в подсказке клетки). Заодно граница широкой раскладки стала 899 px: при ровно
900 px обе половины оформления применялись к одной странице, и от «узкой» в
«широкой» оставался потолок высоты таблицы — те же пустые 179 px под ней на одном
единственном размере окна. Проверено в настоящем Chrome на этой странице: при
окне 1440×500 (панель прокручивается) и прокрутке до последнего файла
`panel.scrollTop` = 421 до клика и 421 после, строка категорий стоит на 1 px от
верхнего края панели, а под ней на всех полосах прокрутки — только её же подписи.

**Панель помнит выбор читателя** (`REFACTOR.md` R-2.5). Запись хранится в памяти
браузера, и она привязана к «паспорту отчёта» — имя инструмента, схема данных,
путь артефакта, заголовок и метки колонок; в ключ входит отпечаток паспорта,
поэтому чужие отчёты живут порознь и не видят выбора друг друга (в браузере все
страницы `file://` делят одну память, так что это не мелочь). Внутри записи выбор
лежит **по именам** — файл путём, метрика ключом, — и хранится только выключенное:
колонка, перенаправленная на другое, или метрика, убранная из настроек, просто
ничего не значит, появившееся остаётся включённым, а «включил всё обратно»
возвращает страницу к умолчанию и стирает запись. Первому читателю (и тому, чья
запись испорчена или устарела) достаётся именно умолчание — состояние на числа и
разметку не влияет. Проверено перезаходом в настоящем Chrome с диска, без сети:
после выключения метрики и одного файла следующий заход даёт те же **25 колонок
вместо 52** и тот же итог **994 335 вместо 1 133 362**; два отчёта в одном браузере
держат по своей записи (`size-report:4684b2b2` и `size-report:5dcd0db1`), и выбор
одного не трогает другой.

**Ту же выборку отдают ссылкой** (`REFACTOR.md` R-2.6). Адрес страницы — это и есть
ссылка: та же запись, что ложится в память браузера, ложится и в якорь
(`#size-report=…`), поэтому отправитель просто копирует адрес, а получатель видит
его выбор без единого действия. Ссылка старше памяти: она — явный выбор
отправителя, а память читателя она не подменяет, пока тот сам чего-нибудь не
поменяет. Чужой или испорченный адрес не применяется — и не молчит: над таблицей
появляется строка с причиной («ссылка собрана в другом отчёте» / «выбор в адресе
нечитаем»), вид остаётся читательским, а присланный адрес не переписывается; о
именах, которых в отчёте нет, сообщается числом, они пропускаются, остальное
применяется. Ссылка работает и когда отчёт уже открыт: браузер на смену якоря
документ не перезагружает, поэтому страница слушает адрес сама (без этого ссылка
срабатывала бы только в новой вкладке — этот разрыв нашёлся в браузерной
проверке, а не в тестах). Проверено на живом отчёте в Chrome с диска: получатель с
пустой памятью по ссылке видит те же **25 колонок и тот же итог 994 335**, что и
отправитель; чужой адрес оставляет 52 колонки и 1 133 362 и объясняет отказ; на
уже открытой странице ссылка меняет вид с 52 колонок на 25, а консоль остаётся
пустой. Ни одного обращения в сеть в странице нет — это отдельное утверждение
проверки, а не обещание.

**Метрика `min` умеет считать по-настоящему** (шаг 3 плана, срез 1). Способ
выбирается в настройках: `"minify": {"engine": "esbuild"}` — настоящее сжатие
(JS/TS/CSS) необязательной зависимостью, `"engine": "strip"` — прежнее снятие
комментариев и отступов; умолчание не менялось, потому что под ним сняты оба
замороженных эталона. На фикстуре сжатие меньше упрощения в **44 клетках и ни разу
не больше**: `src/code.js` **276 → 185 Б**, `src/style.css` **55 → 43 Б**, по фикстуре
**−1 372 Б**. Цена сжатия названа, а не спрятана: на живой истории (95 строк ×
27 колонок) прогон стал **1,48 → 1,71 с** — это запуск минификатора и разбор тех
файлов, которые он берёт. JSON минифицируется разбором и потому
остаётся точным, а форматы, которых минификатор не берёт, честно названы в подписи
метрики вместе с теми, которые он берёт. Точность объявлена дважды, и это не два
ответа на один вопрос: подпись метрики говорит про **худшее в колонке** (один
формат без минификатора делает метрику приближённой целиком, а не прячется за
«точное» соседа), а каждая клетка — про своё число, и приближённая помечена
пунктиром с подписью способа. Худшее берётся у клеток, а не у названия способа:
отчёт из одного JSON точен и под снятием балласта — разбор теряет только
незначащие пробелы, короче его не сделает никто, — и подпись так и говорит.
Оба ответа считаются одним правилом (`pointExact` в
`src/metrics.js`), поэтому разойтись не могут. Минификатора нет (установка без необязательных
зависимостей, платформа без него) — метрика отступает к упрощению, способ говорит
об этом словами, а прогон отдаёт **код 4**, а не молчание: числа при этом те же, что
у прежнего способа, — побайтово со эталоном. Выведенный профиль ведёт новые проекты
сразу на сжатие (и `--init` закрепляет то же самое); цена названа прямо в его подсказке. Файл, который минификатор не
разобрал (разметка в `.js`, чужой синтаксис), — отказ кодом 2 с причиной от него
самого и двумя готовыми выходами.

**Метрика `tok` считает токены настоящим словарём** (шаг 4 плана, срез 1). Токены —
третье измерение отчёта: вес файла для языковой модели. Словарь выбирается в
настройках (`"tokens": {"family": "openai", "encoding": "o200k_base"}`), и
кодировка — часть числа, а не подробность: на фикстуре `src/code.js` это **168
токенов** в `o200k_base` и **196** в `cl100k_base`, поэтому кодировка называется
рядом с семейством, а способ метрики цитирует ровно ту, что посчитана. Токены —
не байты и не сжатие, и расхождение видно, а не заглажено: та же клетка — **735 Б**
`raw`, **276 Б** упрощением, **185 Б** настоящим сжатием и **168** токенов; байт на
токен отличается по файлам в **2,5 раза** (от 2,56 у `package.json` до 6,30 у
`crlf.txt`), то есть считается текст, а не отношение. Семейство в этой версии одно —
`openai`: у остальных нет словаря, который можно было бы назвать их собственным, а
считать чужим и называть это семейством значило бы обещать то, чего нет.
Переключателя словаря на странице нет намеренно: страница получает готовые числа и
сама не считает ничего, а посчитать токены другим словарём ей нечем. Сосчитать все
семейства на каждый прогон — это платить временем за числа, о которых читатель,
может быть, и не спросит, поэтому выбор семейства и кодировки живёт там, где стоит
времени (в настройках запуска), а страница его **называет**: способ каждой метрики
виден под переключателями текстом, а не только во всплывающей строке (решение
плана §4.8.4 отменено осознанно — `PLAN.md`, шаг 4).
Форматы без текста (картинка, шрифт, архив) названы в подписи метрики вместе с
причиной: у них число идёт по байтам, и по тому же правилу помечена клетка такого
файла, а подпись метрики берёт худшее в колонке — двум ответам разойтись нечем.
Словаря нет (установка без необязательных зависимостей, платформа без него) — счёт
идёт оценкой по длине с названным коэффициентом, а прогон отдаёт **код 4**; числа
при этом те же, что у прежнего отчёта без токенов, а сам шов проверяется
окружением `SIZE_REPORT_NO_OPTIONAL`. Прогон этим платит временем, и это честная
цена словаря, а не разбор: таблицы словаря читаются **0,3 с на процесс**, а на
живой истории (95 строк × 27 колонок, 1,23 МБ текста) тот же отчёт идёт
**1,55 → 6,35 с** — умножается именно сбор истории, а не таблица: токенов в
«сейчас» — **303 705**, то есть 4,05 Б на токен. Отсюда и цена набора проверок:
**7,3–7,9 → 10,4 с** при 66 → 73 проверках (запас и новый бюджет — ниже). Выведенный
профиль ведёт новые проекты сразу на токены.

**Волна 0 чистки пройдена** (`REFACTOR.md`): у отказов командной строки появились
коды выхода и справка вместо стека, `--help` отвечает, `--write`
создаёт недостающий каталог, подсказка в отказе ведёт к работающей команде, а
вывод настроек больше не предлагает колонкой саму таблицу — иначе первая же
проверка настроек его отвергала.

**Появились две команды: полнота и объяснение** (шаг 5 плана). `size check`
отвечает, всё ли в истории попало в отчёт: каждый путь, тронутый коммитами,
обязан быть колонкой или объявленным исключением, а непонятый путь — это код 1,
путь, коммит, который его завёл, и готовая починка. Тем же ответом идут сводка по
выпавшим коммитам (сколько и почему) и списки их sha — то есть «какая часть
истории покрыта». `size explain <коммит>` отвечает про один коммит — назвать его
можно и именем ревизии (`HEAD`, ветка, тег, `HEAD~1`), и sha, и началом sha:
строка есть (и которая) либо причина, почему её нет, — тронут только отчёт, числа не сдвинулись
при тронутых файлах колонок, коммит мимо колонок, слияние скрыто `rows.merges`.
Обе берут причину у того же прохода, что и отчёты, а улики — из списка изменённых
путей коммита: чего в истории нет, о том молчание вместо догадки. Полнота — из требований (§4.2: «ни одно изменение не
просочилось мимо отчёта»), и она же заменяет контроль
«артефакт ↔ история»: отчёт можно не хранить в git. Смысл `skip` в настройках от
этого не изменился, но **значение расширилось**: это не только «пути, которые
колонками быть не могут», но и объявленные исключения полноты — тот же список, и
чеканить второй инструмент не стал. Цена названа: `check` — это проход по истории,
как и любой отчёт (**1,5 с** на живой истории), а набор проверок подорожал на
тринадцать запусков инструмента (бюджет — ниже). К ним добавился `size doctor` —
диагностика одним ответом (ниже, в разделе про проверки).

**Отчёт обновляется сам** (последний пункт шага 5 плана). `size install-hook`
ставит два хука — `post-commit` и `post-merge` (`post-commit` при `git merge` не
выполняется вовсе, поэтому одного файла мало), — и после каждого коммита и слияния
отчёт пересобирается, а лежащий в git — ложится **отдельным коммитом**: ручного шага
«код, потом таблица» больше нет. Коммит отчёта собирается плумбингом git
(`commit-tree`): в него физически не могут попасть ни индекс, ни чужая
незакоммиченная работа, и зацикливание невозможно по устройству, а не по флагу в
окружении. Отказ инструмента коммит не роняет — причина печатается строкой и
видна в `size doctor`.

Перенос, доработка и оформление в пакет расписаны в `PLAN.md` по шагам, с
приёмкой каждого.

## Что в репозитории

| Файл | Роль |
|---|---|
| `PLAN.md` | **Главный документ:** инвентаризация, границы, инварианты, архитектура, семь шагов переноса, приёмка, риски, открытые вопросы |
| `docs/requirements.md` | Требования заказчика: что и зачем |
| `docs/module-design.md` | Архитектурный проект выноса: как устроен модуль |
| `docs/size-report.html` | Отчёт об объёме этого самого проекта: один самодостаточный файл, который обновляет хук после каждого коммита (отдельным коммитом) |
| `worklog/` | Журнал запросов и сделанного: запись на каждую порцию работы, имя — `NNNN-слаг.md`; `worklog/archive/WORKLOG.md` — прежний журнал одним файлом |
| `docs/plans/` | Планы работ: папка `yyyy-mm-dd-имя` на работу, в ней главный план и подпланы |
| `BLOCKERS.md` | Открытые блокеры и известные пробелы (обход обязан держаться проверкой) |
| `REFACTOR.md` | Поканальный план чистки: объём кода, потом скорость; границы и чем доказывается, что поведение не изменилось |
| `CHANGELOG.md` | История выпусков и, у каждого выпуска, раздел «Что изменится в числах»: у кого числа поедут и почему |
| `tools/parity-freeze.js` | Снимает эталон паритета (`pnpm run parity`): замороженной копией, на ревизии проекта из манифеста — `--json`, конфиг, хеш артефакта, хеш инструмента |
| `tools/make-fixture.js` | Собирает синтетическую фикстуру (`pnpm run fixture`): детерминированную историю с ловушками плюс эталонные числа |
| `tools/synthetic/` | Сюжеты той сборки по предметам: `repo.js` — как говорим с git (закреплённые время, автор, настройки), `content.js` — что лежит в файлах, `history.js` — какие коммиты из этого получаются, `note.js` — записка к фикстуре со списком ловушек |
| `tools/parity-live.js` | Сверяет движок с живым проектом на клоне: числа и самодостаточный отчёт по пути из настроек потребителя (`pnpm run parity:live`) |
| `tools/pack-check.js` | Собирает тарболл и проверяет, что из него всё работает: все исходники доехали, числа и отчёт — как из репозитория (`pnpm run pack:check`) |
| `tools/check-standards.js` | Проверяет, что оба эталона воспроизводятся: пересъём идёт в никуда и сверяется с закоммиченным (наши файлы — побайтово, бандл — по содержимому) и что бандл живой истории несёт `HEAD` (`pnpm run check:standards`) |
| `.github/workflows/ci.yml` | CI: работа `verify` на каждый пуш и запрос правки зовёт `pnpm run verify` — тот же профиль, что локально; действия закреплены по SHA коммита |
| `.github/workflows/verify-slow.yml` | Slow-профиль по расписанию: то же плюс покрытие под c8 — дорогое не в каждом прогоне |
| `tools/gates/run.js` | Профили проверок — единственный список шагов: `fast` (каждая правка), `full` (перед отправкой и в CI), `slow` (+ покрытие); `--list` печатает команды |
| `tools/gates/metrics.js` | Датчик раздувания: правила размера и сложности, вес проверок, пометки долга — с храповиком подавлений ESLint (`.eslint-suppressions.json`) |
| `tools/gates/dup.js` | Датчик дублей: отпечатки клонов по содержимому (`dup-baseline.json`), взгляд против файла базы и против дерева `origin/main` |
| `tools/gates/deps.js` | Датчик связей: циклы, сироты, направление слоёв и неразрешимые импорты (`dependency-cruiser`) |
| `tools/gates/coverage.js` | Датчик покрытия: храповик по файлам против `coverage-baseline.json`, а не процент по репозиторию |
| `tools/gates/gatefiles.js` | Защита гейт-файлов: правка порогов, баз и обвязки без трейлера `Gate-Change:` — красный (хук `commit-msg` и CI по диапазону) |
| `tools/gates/common.js`, `tools/gate-probe.js` | Общее у датчиков (корень, разбор ключей, отчёты) и обвязка их проб: датчик зовётся командой, а не импортом |
| `.githooks/commit-msg`, `.githooks/pre-commit`, `.githooks/pre-push` | Хуки: защита гейт-файлов, быстрый профиль на правку и перед отправкой; ставятся `pnpm run hooks:install` (свой менеджер хуков не заводится) |
| `.githooks/post-commit` | Обновление отчёта после коммита: зов установленной копии пакета (строка вписана человеком — инструмент чужие каталоги хуков не правит) |
| `eslint.metrics.config.js`, `.eslint-suppressions.json` | Правила датчика раздувания и его база: пороги из замеров, всё, что выше, — в базе и разбирается постепенно |
| `.jscpd.json`, `dup-baseline.json` | Настройки и база датчика дублей: отпечаток считается по содержимому клона, поэтому база переносима |
| `.dependency-cruiser.cjs`, `.c8rc.json`, `coverage-baseline.json` | Правила графа связей, настройки снятия покрытия и его база по файлам |
| `AGENTS.md` | Короткая инструкция агенту репозитория: что запускать, что делать при красном, что нельзя менять |
| `.github/workflows/release.yml` | Выпуск по тегу: тот же полный набор, сверка версии манифеста с тегом и публикация в реестр по удостоверению GitHub Actions — без секрета и без кода из аутентификатора |
| `templates/` | То, что проект берёт как есть: `size-report.config.json` (черновик настроек), `ci.yml` (описание проверки) и `README.md` (куда что кладётся и что в них менять); едут в поставке и стерегутся `pack:check` и `test/templates.test.js` |
| `fixtures/parity/` | Эталон с `safe-resets` на коммите `bd6ef9d`: 95 строк × 27 колонок. Копия реализации, которой он снят, в дереве не лежит — её байты живут в истории и берутся оттуда по требованию (`REFACTOR.md` R-1.5) |
| `fixtures/synthetic/` | Бандл фикстуры на 16 коммитов, её конфиг, эталонные числа (`--json` прежней копии) и хеш её артефакта прежней формы — запись того, с чем сверялся перенос |
| `fixtures/live/history.bundle`, `fixtures/live/README.md` | История проекта-потребителя на ревизии эталона `bd6ef9d` и записка о том, какую ревизию бандл несёт и почему он лежит в репозитории: живая сверка работает без доступа к приватному проекту |
| `bin/size.js` | Команда `size`: то, что ставит пакет (`package.json` → `bin`); сама ничего не считает, только зовёт точку входа |
| `LICENSE` | MIT: условия лицензии едут в поставке вместе с пакетом |
| `.gitignore`, `pnpm-lock.yaml` | Что в репозиторий не идёт; lock-файл pnpm, а версия менеджера — в поле `packageManager` (оттуда её берёт CI) |
| `src/size-table.js` | Точка входа пакета: только реэкспорт публичного API (55 имён), ни одного расчёта |
| `src/derived.js` | Общий расчёт отчёта: итоги, дельты, клетка, подпись коммита — один на движок и программу страницы |
| `src/css.js` | Чтение оформления с диска: какие наборы стилей есть и какая у них роль |
| `src/table.css` | Таблица отчёта: геометрия клеток, липкие шапка и колонка, цвет дельт |
| `src/page/app.css` | Оформление страницы сверх общей части: панель с деревом файлов и липкой строкой категорий (на широком экране — колонка слева, страница в окно), состояния пустоты, узкое окно |
| `src/page/state.js` | Состояние страницы: данные отчёта, вид галочек, указатель «какой путь — какая колонка», сложенные папки, паспорт записи, память браузера и обмен ссылкой — глава программы страницы |
| `src/page/dom.js` | Узлы страницы: мелкие помощники разметки (`appEl`, `appBox`) — одни на панель и таблицу |
| `src/page/panel.js` | Панель выбора: галочки метрик и файлов, категории, дерево путей проекта (файлы вне отчёта — снятой галочкой с причиной, после остальных; папки — со знаком складывания, который прячет поддерево классом, а не пересборкой); перерисовку просит у главы сборки |
| `src/page/table.js` | Таблица страницы: клетка, подпись коммита, шапка и состояния пустоты — разметка поверх общего расчёта |
| `src/page/app.js` | Сборка и запуск страницы: таблица целиком, перерисовка по выбору читателя (с возвратом фокуса и прокрутки), первая отрисовка и смена якоря; вклеивается в собранную страницу
| `src/page/build.js` | Сборка страницы: данные, оформление и программа в одном файле без внешних ссылок |
| `src/git.js` | Единственная граница вызова git: закрепления настроек, блобы пачкой, история, сверка с диском |
| `src/strip.js` | Снятие балласта: какая форма к какому файлу (расширение, стратегия) и что считать точным числом — вход разбора форм |
| `src/strip/js.js` | Снятие комментариев и отступов в JS: проход по случаям (комментарий, регексп, строка, символ) — строки и шаблоны насквозь |
| `src/strip/forms.js` | Формы текста со своим снятием балласта: разметка, стили, строки файла и JSON |
| `src/strip/guard.js` | Гард стриппера: снятое обязано компилироваться — скриптом в процессе или модулем в рабочем потоке |
| `src/parse.js` | Разбор модуля: рабочий поток на прогон и отступление к `node --check`, способ разбора последнего модуля |
| `src/parse-worker.js` | Сам разбор внутри потока: разбирает текст без исполнения, сообщает, что модулей vm в Node нет |
| `src/metrics.js` | Реестр метрик: что измеряется, нужен ли текст и насколько честна цифра; описание метрики для читателя — в одном месте |
| `src/minify.js` | Настоящий минификатор: необязательная зависимость, загружается один раз и не роняет прогон, если её нет |
| `src/tokens.js` | Токены: словарь по семейству и кодировке, оценка по длине как запасной счёт, форматы без текста |
| `src/optional.js` | Общее устройство необязательных зависимостей (минификатор и словарь): ленивая загрузка, версия пакета, шов отсутствия |
| `src/history.js` | Обход истории: измерение по коммитам, сдвиг чисел, сборка, сверка с деревом, знак «какой колонки коснулся последний коммит» и причина пропуска у каждого выпавшего коммита |
| `src/check.js` | Полнота покрытия (`size check`): настройки, история, пути, датчики — что прошло мимо колонок и чем это чинится |
| `src/explain.js` | Объяснение пропущенной строки (`size explain <коммит>`): причина, улики и готовая починка |
| `src/doctor.js` | Диагностика одним ответом (`size doctor`): окружение, зависимости, настройки, покрытие, состояние хука — сборкой из существующих кусков |
| `src/hook.js` | Хуки автообновления: постановка сама (`autoInstall` — из входа и `bin/postinstall.js`), снятие командой, коммит только отчёта, замок и запись о запуске |
| `bin/postinstall.js` | Установка хука после постановки пакета: ищет проект-потребитель и молчит, если поставить негде |
| `src/artifact.js` | Отчёт на диске: единственное место, где он превращается в файл (им пользуются и `--write`, и хук); отчёт — самодостаточная страница |
| `src/journal.js` | Журнал и ссылки: к какому разделу относится коммит и куда ведёт описание |
| `src/data.js` | Категории файлов и контракт со страницей (`--data`): числа, устройство таблицы и каталог путей проекта |
| `src/config.js` | Настройки проекта-потребителя: умолчания, чтение, проверка |
| `src/project.js` | Настройки, выведенные из самого проекта (дерево и история): колонки, журнал, исключения, каталог путей для дерева страницы. Без файла настроек он и есть настройки; `--init` закрепляет его файлом |
| `src/locales.js`, `src/refusal.js`, `src/tool.js` | Тексты отчёта; коды выхода и справка; имя и версия пакета |
| `src/cli.js` | Вход инструмента: разбор строки, чтение проекта и доставка запроса режиму; главный файл пакета |
| `src/args.js` | Грамматика командной строки: режимы, ключи и команды плюс проверки их сочетаний — отказ называет виновника и готовую команду |
| `src/modes.js` | Режимы: собрать отчёт, сверить его с историей, отдать данные, полноту покрытия и диагностику |
| `src/init.js` | Закрепление настроек файлом (`--init`): то, что проект вывел о себе сам, ложится файлом — и проходит ту же проверку, что первый запуск |
| `test/api.test.js` | Публичный API пакета: список имён заморожен, разбиение не имеет права его менять |
| `eslint.config.js` | Правила оформления: те же, что у проекта-потребителя, плюс запрет склейки операторов в строке (`pnpm run lint`, `pnpm run lint:strict`) |
| `tools/harness.js` | Обвязка проверок: пути, клоны фикстуры (в том числе общий на набор и с CRLF), запуск инструмента, разбор отказов, хеши |
| `tools/page-harness.js` | Обвязка проверок контракта и страницы: данные контракта, собранная страница, чтение её в настоящем DOM, переключатели панели — одна на четыре набора |
| `tools/suites.js` | Разделение набора: какие файлы идут в быстрый прогон (с причиной для каждого), почему каждый дорогой — в полном |
| `tools/run-tests.js` | Прогон набора (`pnpm test`, `pnpm test:all`, `pnpm run suites:measure`): длительность каждого файла своим замером и сверка числа проверок |
| `tools/docs-facts.js` | Чтение фактов из документации — один слой на четыре проверки сторожа: что документ называет (пути, зовы, адреса разделов) против того, что есть в репозитории |
| `tools/yaml.js` | Разбор подмножества YAML — один разборщик на два сторожа описаний (`templates/ci.yml` и `.github/workflows/release.yml`): вне подмножества — ошибка, а не молча пропущенная строка, включая двоеточие с пробелом в незакавыченном значении (именно оно делало описание выпуска неразбираемым, пока проверка искала подстроки) |
| `tools/refusals.js` | Каталог отказов: по строке на каждый — причина, код выхода, обязательные фразы вывода, **что отказ советует** (`advice`: `run` — команда, `template` — форма с подстановкой, `manual` — действие человека с причиной, `coveredBy` — отдан другой проверке), а для непроверяемого — почему; карты мест отказа (`SITES`, `PRINTED`) держат числа, чтобы новый отказ не появился молча, а маркеры совета — чтобы не появился молча новый совет |
| `test/parity.test.js` | Паритет движка с эталоном: числа, самодостаточность отчёта, локаль |
| `test/frozen.test.js` | Замороженная копия: та ли это ревизия, с которой снят эталон, и воспроизводит ли она его |
| `test/environment.test.js` | Герметичность: вывод не зависит от настроек git машины и локали |
| `test/crlf.test.js` | Выкладка с CRLF (`core.autocrlf`) не мешает сверке |
| `test/disk.test.js` | Сверка с рабочим деревом: правка только на диске, три вида потери (правка, создание, удаление — все мутацией), файл, удалённый до HEAD, и переименование внутри псевдонимов — не потеря (`BLOCKERS.md` §B3, §N8) |
| `test/cli.test.js`, `test/cli-paths.test.js` | Отказы командной строки: справка, настройки, коды выхода — и куда инструмент пишет |
| `test/refusals.test.js` | Отказы исполняются: каждый вызван прогоном, сверены код выхода и обещанные фразы (свои клоны — для чужого хука, обрезанной истории и ветки мимо отчёта), и **совет выполняется** — команда даёт обещанный код, не падает стеком, а где объявлено «отказ ушёл», тот же зов после неё отвечает другим |
| `test/refusals-catalog.test.js` | Сторож каталога отказов: у каждого места отказа в исходниках есть пункт, у каждого пункта — объявленный совет, а отказы, отданные другой проверке, ею в самом деле утверждаются (названные файл и строка проверяются) |
| `test/contract-data.test.js` | Контракт данных: числа против эталона, состав полей против производных, пометки приближения против подписи метрики |
| `test/contract-derived.test.js` | Производные против чисел артефакта: итоги строки, дельты клетки и дельта итога — на коде, который лежит в дереве |
| `test/page-view.test.js` | Собранная страница: вклейка без копий расчёта, самодостаточность, состояния пустоты, оформление и переключатели |
| `test/page-tree.test.js` | Дерево файлов панели: папки по путям проекта, три состояния, поддерево, файлы и папки вне отчёта (снятая галочка и место после остальных), складывание без пересборки и прокрутка при пересборке |
| `test/page-choice.test.js` | Память выбора и обмен ссылкой: перезаход, чужой отчёт, чужая и битая запись, смена адреса на открытой странице |
| `test/module.test.js` | Модуль в расширении `.js`: измеряется без правок настроек; гард стриппера жив (доказано мутацией) и не обвиняет невиновного |
| `test/guard.test.js` | Разбор модуля: идёт потоком, оба пути дают один вердикт, отступление работает без файла потока, сотни разборов дешевле запуска |
| `test/runner.test.js` | Чтение вывода процесса: куски склеиваются буферами, а не приклеиваются к строке — многобайтовый символ на границе кусков не превращается в два символа-заменителя |
| `test/git-pins.test.js` | Сторож границы git: прямых вызовов git без общего списка закреплений нет, и незакреплённое чтение показывается свидетелем (путь кавычками) |
| `test/docs-paths.test.js`, `test/docs-commands.test.js`, `test/docs-numbers.test.js`, `test/docs-pin.test.js` | Сторож документации, по файлу на обещание: пути и таблица файлов; зовы, причины отказа и адреса разделов; числа проверок; пин в примере установки |
| `test/changelog.test.js` | Сторож выпуска: версия в `CHANGELOG.md` — версия манифеста, а таблица «что изменится в числах» — это замер на фикстуре, сверенный с живым прогоном |
| `test/release.test.js` | Сторож выпуска из CI: он начинается тегом, версия берётся из манифеста, секрета и одноразового кода не требует, prerelease не уезжает в `latest`, перед публикацией идёт полный набор — и подсказка на npmjs.com называет этот же файл |
| `test/suites.test.js` | Сторож разделения набора: полнота классификации (быстрый — явно, полный — с причиной), причина у каждого файла, что быстрый прогон остаётся частью набора |
| `test/gates-metrics.test.js`, `test/gates-dup.test.js`, `test/gates-deps.test.js`, `test/gates-coverage.test.js`, `test/gates-files.test.js` | Пробы датчиков: искусственное нарушение → датчик красный, снятие → снова зелёный; прогон зовёт датчик командой, а не импортом, поэтому доказывает и код возврата |
| `test/gates-verify.test.js` | Сторож единственного списка: команды профиля против рабочих процессов, хуков и `templates/ci.yml` — проверки, которой нет в профиле, в CI быть не может |
| `test/check.test.js` | Полнота и объяснение на настоящих коммитах фикстуры: непокрытый путь, «только отчёт», «число не сдвинулось», «мимо колонок», слияние — и что починка настроек не двигает числа |
| `test/doctor.test.js` | Диагностика на пяти состояниях проекта: без настроек (2), полное покрытие (0), неполное (1), обрезанная история (3), нет датчика (4) — и блок покрытия равен ответу `size check`, а не считается вторым разом |
| `test/hook.test.js` | Хуки на свежем клоне: ставятся только командой, дают отдельный коммит отчёта (в том числе после слияния), повторный запуск молчит, чужая работа и индекс не тронуты, в CI и при отказе инструмента ничего не делают, снятие возвращает проект к прежнему |
| `test/templates.test.js` | Шаблоны: черновик настроек проходит проверку инструмента и собирает настоящий отчёт; описание проверки разбирается и зовёт только существующие команды и ключи |
| `test/minify.test.js`, `test/tokens.test.js` | Настоящее сжатие и токены: числа против упрощения, кодировка как часть числа, честность подписи, работа без необязательной зависимости (код 4) и шов `SIZE_REPORT_NO_OPTIONAL` |
| `package.json` | Манифест пакета: имя `@vernikr/size-report`, версия `1.2.0`, список поставки — только существующее |

Оба каталога эталонов снимаются заново теми же инструментами: `pnpm run parity` и
`pnpm run fixture` дают те же файлы. Побайтово сверяется наше — конфиг, эталонные
числа, хеш артефакта, описание; у бандла истории сверяется содержимое (ветки,
верхушка, число коммитов), потому что упаковку пишет git и её байты зависят от его
версии. Обе стороны пары закреплены — инструмент это замороженная копия реализации,
чьи байты лежат в истории (`fixtures/legacy/size-table.cjs`, `REFACTOR.md` R-1.5) и
сверяются с записью о происхождении эталона, а ревизия проекта берётся из манифеста
(`--at` сдвигает её осознанно), окружение снятия задано (`core.quotePath=false`).
Без закрепления окружения эталон снимается другими числами: на машине с настройками
git по умолчанию фикстура с не-английским именем файла теряет строку. Проверено
тремя прогонами: повтор даёт те же байты и прогон без настроек машины
(`GIT_CONFIG_GLOBAL=/dev/null`) — тоже. Сходимость записанного в манифестах с
файлами стережёт `test/frozen.test.js`.

## Чего ещё нет

```text
dist/app.js        пре-собранная программа отчёта для публикации
size init/measure  командами вместо флагов: сейчас командами стали только check, explain, doctor и хук
блок для агентов   инструкция агенту проекта: требования её не просят, поэтому в шаблонах её нет
минификация HTML   минификатор разметки: пока HTML считается упрощением (шаг 3)
JSX и TSX          выход зависит от настройки jsx самого проекта — упрощение (шаг 3)
семейства токенов  кроме openai: у остальных нет своего словаря — считали бы чужим (шаг 4)
```

Швы между модулями проходят по границам данных: сверху — то, что читает git и
файловую систему (`git`, `strip`, `metrics`, `history`), ниже — то, что работает на
уже собранных значениях (`data`, `render`, `page`), а настройки, тексты и отказ —
по краям, потому что их знает любой и они не знают никого. Оба отчёта считаются на
сборке: страница получает исходники общего расчёта и своей программы вклеенными
(`src/derived.js`, `src/page/*.js`), потому что открывается она с диска, без
сервера и без сети. Остальное — по шагам 2–6 (`PLAN.md` §5).

## Как подключить к своему проекту

Инструкция проверена покомандно на свежем проекте (три коммита, ESM в `src/`,
`pnpm`): ниже — ровно те команды, которые работают сегодня. Всё, что сегодня
**не** работает, названо здесь же и с причиной, чтобы это не искали опытом;
каждый такой случай — отдельный пункт `REFACTOR.md`.

Эта же инструкция — рецепт для шага 5 (`PLAN.md`): интеграция в проект-потребитель
идёт по ней, а не по памяти.

Нужны: **git-репозиторий с историей** (хотя бы один коммит — таблица строится по
коммитам) и **Node ≥ 20.19** (`engines` пакета).

### 1. Установка

```bash
pnpm add -D @vernikr/size-report
```

Пакет **опубликован в реестре**, и публично: `npm view @vernikr/size-report
version` отвечает `2.4.0`, `npm access get status @vernikr/size-report` — `public`,
а анонимный запрос тарболла — код 200. `npm i -D` и `yarn add -D` принимают то же
имя; ни ключа, ни ссылки на репозиторий не нужно.

Тот же выпуск можно взять ссылкой на репозиторий — так установка не зависит от
реестра, но остаётся привязанной к ревизии:

```bash
pnpm add -D github:vernikr/size-report#v2.4.0
```

Без сети (или если тянуть из codeload нечем) — тарболл: `pnpm pack` в клоне
пакета, затем `pnpm add -D ./vernikr-size-report-2.4.0.tgz`.

**Почему тег, а не sha.** Короткий sha pnpm разрешает только через видимые рефы, а
`git ls-remote` отдаёт одни верхушки веток: пока ревизия — верхушка, короткий sha
работает, а как только ветка ушла вперёд, установка падает с `Could not resolve
<sha> to a commit`. Это не рассуждение, а проба: короткий пин `6530237` ставился,
пока `main` стоял на нём, и перестал — на следующем же коммите, а тот же sha
целиком поставился. Имя ветки (`#main`) или тег принимаются оба, но ветка —
движущаяся цель, а тег постоянен: этот выпуск стоит на теге `v2.4.0`, он же и в
примере (сорок знаков тоже годятся, но их придётся брать глазами из истории).

Ревизия в примере — не украшение, а часть утверждения: она закреплена за тем, что
описано ниже. Пин старше подкоманд (`check`, `doctor`, `explain`, `install-hook`)
означал бы, что текст учит командам, которых в установленной ревизии нет, а
лишнее слово там не отвергается, а молча пропускается — то есть вместо отказа
человек получил бы ноль и решил, что всё в порядке. Поэтому пин берётся не «какой был под рукой», а
ревизией, в которой есть всё названное ниже — включая отказы на незнакомое слово. За этим следит сторож документации (`test/docs-pin.test.js`): пин обязан вести
на ревизию этого репозитория, и все названные в тексте команды обязаны быть в её
справке.

Репозиторий пакета **публичный** (приватным был до 2026-09-14), и это ровно то,
что упрощает установку: ни ключа разработчика, ни шага в CI с доступом. Проверено
прогоном в пустом проекте, где у git не было ни глобальных настроек, ни
помощника учётных данных (`GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
GIT_SSH_COMMAND=false`): установка 3,4 с, дальше `size --write` и `size` работают
(`WORKLOG.md` §44). Прежнее требование было ценой приватности: локально — ключ, а
в CI — read-only deploy key перед `pnpm install` (то самое первое подключение,
`WORKLOG.md` §18); шаг с ключом из шаблона ушёл вместе с приватностью. Публикация
в npm сделана 2026-09-15, и у неё была цена: имя `size-report` в реестре занято чужим
пакетом (2017 год, три версии), поэтому выкладка — это ещё и смена имени на имя в
области владельца (`@vernikr/size-report`), а не только отправка архива; что
затронуло переименование — `PLAN.md` §10, чем доказана выкладка — `WORKLOG.md` §53.

### 2. Настройки: их можно не заводить

```bash
pnpm exec size --write     # таблица; настроек нет — их выведет сам инструмент
pnpm exec size --init      # закрепить выведенное в size-table.config.json
```

Начинать с настроек не нужно: без файла инструмент выводит их из проекта — колонками
берёт **каждый отслеживаемый git файл, который можно измерить** (отчёт называет
объём проекта, а не выборки из него; границы остались только у того, что колонкой
быть не может: сам отчёт, замки зависимостей, собранное, незнакомый формат и файл
сверх 512 КБ), а прочие называет в `skip`, журналом —
первый знакомый (`WORKLOG.md`, `CHANGELOG.md`, …), файлом отчёта — `docs/`, если
каталог есть, командой починки — объявленный скрипт `sizes`, а без него — путь
к установленному пакету (его цитируют подпись отчёта и отказы, поэтому он обязан
работать уже сейчас), ссылкой на коммит — адрес `origin`, метриками — `raw`, `min`,
`tok`. Метрика `min` считается настоящим сжатием (`"minify": {"engine": "esbuild"}`),
а `tok` — словарём (`"tokens": {"family": "openai", "encoding": "o200k_base"}`): без
этих необязательных зависимостей метрика честно отступает к другому счёту и прогон
отдаёт код 4 — правки настроек и тут не требуются.

Всё, что колонкой быть не может (сам отчёт, замки зависимостей, карты, собранное,
незнакомый формат, слишком крупный файл) и чего git не отслеживает, называется
в `skip` — поэтому первый же `size check`
полон, а не красен: «пути мимо колонок» появляются от новых правок, а не от того, что
проект ещё не описан. О том, что настройки выведены, инструмент говорит строкой в
stderr и называет команду, которая их закрепляет, — `--init`; закреплённое проходит
ту же проверку, что любой файл настроек, и дальше его правят глазами (сам `--init`
печатает, что закрепил, и что делать дальше — скрипты и проверку в CI). Без
закрепления профиль выводится заново на каждом запуске: числа не «поедут», но
повторить прежний замер — в том числе хуком и проверкой — можно только по файлу.

Закрепляется **то же, чем проект работает без файла**: вывод из проекта поверх
умолчаний. Поэтому в закреплённом файле видны и значения, которых в проекте никто не
писал, — тогда смена умолчаний в новой версии пакета не поедет по уже настроенному
проекту молча.

> Subкоманды `size init` пока нет — CLI знает только флаги (`--init`, `--write`,
> `--data`, `--json`, без флага — проверка); полный список даёт `size --help`.
> Subкоманды — шаг 5 плана (`REFACTOR.md` R-4.5).

### 3. Что правится в конфиге

Вывод знает про проект только то, что видно в дереве и истории, — какие колонки важны,
знает человек. Чаще всего правят:

| Ключ | Что это |
|---|---|
| `columns` | колонки таблицы: `{label, paths: [...]}`; **колонка — это файл**: список путей — её переименования (в ревизии берётся тот путь, который в ней есть), а не несколько файлов разом; `label` — то, что увидит человек |
| `metrics` | из чего состоит число: `raw` (размер объекта git), `min` (минифицированная форма — какая именно, решает `minify.engine`), `tok` (токены), `gzip` |
| `tokens.family`, `tokens.encoding` | словарь для `tok`: семейство (`openai`) и кодировка (`o200k_base` или `cl100k_base`) — кодировка меняет число, поэтому она и в настройках, и в подписи метрики |
| `minify.engine` | чем считается `min`: `strip` (комментарии и отступы, точность не обещается) или `esbuild` (настоящее сжатие; форматы без минификатора — упрощение, и это видно в подписи метрики) |
| `output` | файл отчёта (в выведенном профиле — `docs/size-report.html`; каталог создаётся сам, имя отчёта — его имя) |
| `journal` | где искать разделы журнала, на которые ссылаются строки |
| `links.commitUrl` | шаблон ссылки на коммит, например `https://github.com/org/repo/commit/{sha}`; выводится из адреса `origin` у GitHub и GitLab (у остальных хозяев — пусто, а не догадка) |
| `skip` | пути, которые колонкой не стали: и те, что ею быть не могут (сам отчёт, замки зависимостей), и те, что в колонки не поместились (выведенный профиль объявляет исключениями всё остальное — поэтому первый `check` полон) |
| `fixCommand` | команда, которую цитирует подпись отчёта и подсказывает отказ; в выведенном профиле — ваш скрипт `sizes`, если он объявлен, иначе путь к установленному пакету внутри проекта (зов по имени пакета уходит в реестр — `REFACTOR.md` R-4.21) |
| `locale`, `title`, `heading` | язык текстов отчёта и его заголовки; пустые `title`/`heading` значат «взять из локали» |
| `minify.guard` | расширения, где результат стриппера проверяется разбором; модуль в `.js` гард понимает сам, трогать его не нужно |
| `hooks.enabled` | выключатель хука автообновления (`false` — хук не ставится сам и молчит, если уже стоит; убирается он только `size uninstall-hook`) |

Остальные ключи и умолчания — `src/config.js` (`DEFAULT_CONFIG`).

### 4. Скрипты и первый отчёт

```jsonc
// package.json
"scripts": { "sizes": "size --write", "test:sizes": "size" }
```

```bash
pnpm run sizes            # → docs/size-report.html — отчёт: таблица, фильтры, ссылка
```

Отчёт — один самодостаточный файл: открывается двойным щелчком, без сервера и без
сети (внешних ссылок в нём нет вовсе, данные, оформление и программа вклеены).
Производные (дельты, итоги, фильтры) считает сама страница — из абсолютных
значений, которые даёт движок, и тем же кодом, что и его расчёт.

**Порядок правок:** код → `pnpm run sizes` → коммит с одной таблицей. Таблица
обновляется **отдельным коммитом**, потому что строка коммита не может попасть в
саму таблицу: обновили её вместе с кодом — инструмент предупредит
(`! таблицу обновляли вместе с кодом: <sha>`) и назовёт коммит, который выпал.
Проверка `size` собирает таблицу заново и сверяет с файлом на диске, поэтому она
же ловит и забытую пересборку. Убрать отчёт из git совсем — шаг 5 плана
(`PLAN.md` §5).

### 5. Проверка в CI и перед коммитом

```bash
pnpm run test:sizes       # 0 — таблица сходится с историей
pnpm exec size check      # 0 — ни одно изменение не прошло мимо колонок
pnpm exec size doctor     # 0 — делать нечего; иначе первый по важности код
```

`size check` отвечает на другой вопрос, чем сама команда `size`: та говорит
«таблица совпадает с историей», а эта — «история вся посчитана»: каждый путь,
который трогали коммиты, должен быть либо колонкой, либо объявленным исключением
(`skip` и сам файл отчёта), иначе это **код 1** со списком путей, коммитом,
который путь завёл, и командой починки. Отчёт при этом не обязан лежать в git —
полнота и есть та проверка, которой заменяют «артефакт ↔ история».
Если сомнение вызывает один коммит, `pnpm exec size explain <коммит>` объяснит,
почему строки нет: тронут только отчёт, числа не сдвинулись, коммит мимо колонок
или слияние скрыто настройкой — с уликами и починкой, где она есть. Коммит можно
назвать так, как его зовёт git: `HEAD`, `HEAD~1`, имя ветки или тега, полный sha
или его начало. Если имя ведёт на коммит вне истории отчёта (другая ветка),
инструмент скажет именно это и назовёт его sha — а не «нет такого коммита».

`size doctor` собирает всю диагностику в один ответ: окружение и его влияние на
числа (настройки машины на числа не влияют — движок закрепляет их на границе
вызова), состояние необязательных зависимостей и что оно значит для точности,
годность настроек и полноту покрытия. Отвечает он теми же кусками, что и
остальные команды: блок покрытия — это ровно ответ `size check`, а не второй
расчёт. Код выхода — первый по важности, а не «что-то нашлось»: `2` настройки
нечитаемы (читать больше нечего), `3` история обрезана, `1` покрытие неполно,
`4` число приближённо, `0` делать нечего. Датчик, о котором настройки молчат,
назван ненужным, а не отсутствующим, и не загружается: словарь весит мегабайты,
а платить за строку ответа, которой у чисел не было, нечем.

В шаблонный CI (`templates/ci.yml`) полнота намеренно **не** входит: колонки в
шаблоне — пример, и на проекте, где колонки ещё не подобраны, такая проверка была
бы красной не по делу. Когда колонки обрисуют проект, её добавляют одной строкой
(`pnpm exec size check`).

Готовая строка для CI: `pnpm run test:sizes` — больше ничего не нужно: проверка —
это и есть команда `size`, своего набора тестов потребителю ставить не надо.
Подсказка `--init` говорит то же самое: проверка — команда пакета, своих файлов в
проект она не приносит.

В поставке лежит и готовое описание этой проверки: `templates/ci.yml` из пакета
(`node_modules/@vernikr/size-report/templates/ci.yml`) кладётся в
`.github/workflows/size-report.yml` без правок — сборка таблицы, сверка с файлом
на диске, два снимка чисел (обычный и в среде без настроек git) и их сравнение.
Секретов оно не требует. Для `npm`/`yarn` в самом файле сказано, какие две строки
заменить. Рядом — `templates/size-report.config.json`, образец настроек: колонки в нём
примерные (`README.md`, `package.json`), они есть почти в любом проекте, поэтому
первый отчёт собирается сразу. Нужен он, только если хочется начать с правленого
файла: без файла настройки выводятся из проекта (`--init` закрепляет выведенное).

Свой CI у пакета — `.github/workflows/ci.yml`: он гоняет у себя тот же список
команд, что описан ниже, и его можно взять за образец для шага потребителя.

| Код | Что случилось | Что делать |
|---|---|---|
| 0 | всё сходится | ничего |
| 1 | таблица разошлась с историей (или правка на диске не закоммичена); у `size check` — путь истории не отслеживается и не исключён | `pnpm run sizes` и закоммитить таблицу; для `check` — дописать путь колонкой или в `skip` |
| 2 | что-то в вызове или в проекте — **командная строка** (незнакомый ключ, ключ без значения, повтор ключа, два режима сразу, лишнее слово, команда и режим, неизвестная команда, несовместимый ключ, нет ответа в JSON, два ответа сразу, нет коммита); **настройки и проект** (нет файла настроек, настройки не разобраны, настройки неверны, нет git, не git-репозиторий, конфиг уже есть); **история** (нет такого коммита, коммит назван неточно, коммит вне истории); **хук** (чужой хук, чужой core.hooksPath, нечем звать инструмент); **измерение** (файл не JavaScript, минификатор не разобрал) | текст отказа называет причину и готовую команду — и она выполнима: это сторожит `test/refusals.test.js` |
| 3 | неполная история (clone с `--depth`) | полный клон: `git fetch --unshallow` |
| 4 | нет датчика | `minify.engine: "esbuild"`, а минификатора нет: числа получены упрощением. Отчёт собран, причина и починка — в тексте; если при этом таблица расходится с историей, код остаётся **1** (нарушение старше приближения), а заметка о другом счёте печатается рядом |
| 5 | внутренняя ошибка | это дефект инструмента: текст нужен нам, см. «Ловушки» ниже |

### 6. Отчёт обновляется сам после коммита

```bash
pnpm exec size install-hook     # поставить post-commit и post-merge
pnpm exec size uninstall-hook   # снять и вернуть проект к прежнему поведению
```

Хуки ставятся **сами**, и это единственное, что проект замечает от установки пакета:
после `npm i` — скриптом установки, у pnpm 10 — первым запуском инструмента (pnpm не
исполняет скрипты зависимостей: «Ignored build scripts»; разрешить можно
`pnpm.onlyBuiltDependencies: ["@vernikr/size-report"]` в своём манифесте). Ставшие
файлы живут в `.git`, `git status` их не видит, снимаются командой выше. После
каждого коммита и слияния отчёт пересобирается: каталог `docs` и файл `size-report.html`
создаются, если их ещё нет, а **отслеживаемый** в git отчёт ложится отдельным коммитом
с подписью `chore(report): отчёт пересобран после <sha>`. Коммитится только путь отчёта:
чужой индекс и незакоммиченная работа не тронуты.

Первый отчёт — исключение из «сам»: файл создан, но не закоммичен, потому что новый
файл в чужой истории — решение человека, а не услуга. Один `git add docs/size-report.html`
(или обычный `git add -A`, если отчёт нужен в проекте) — и дальше он едет коммитами сам.
Слияние обрабатывается тем же входом, что обычный коммит, но другим файлом —
`post-merge`: git создаёт коммит слияния сам и `post-commit` при этом не зовёт.

Зацикливания нет по устройству, а не по флагу: коммит отчёта собирается
плумбингом (`commit-tree` — хуков не зовёт), и сам отчёт строки не получает.
Выключается автоматика двумя способами — `"hooks": {"enabled": false}` в
настройках (хук остаётся, но молчит) или `size uninstall-hook`; в окружениях, где
обновлять отчёт не нужно (CI, чужая машина, зависимости не поставлены), хук молчит
сам и ничего не пишет в вывод коммита. Что он делает и чем кончился последний
запуск, видно в `pnpm exec size doctor`; отказ инструмента коммит не роняет —
причина едет одной строкой и остаётся в записи о запуске.

### 7. Ловушки, найденные этой же инструкцией

Две из них найдены прогоном и уже закрыты — они оставлены здесь как объяснение
поведения, а не как обходные пути:

- **Модуль в расширении `.js`** (`import`/`export` в `.js` — обычное дело в
  проектах с бандлером) измеряется как любой другой файл, с `type: module` в
  манифесте или без него: гард разбирает результат и как скрипт, и как модуль.
  Раньше он пробовал только скрипт и падал кодом 5 на самом `export`, обвиняя
  стриппер; сегодня это невозможно, и правки в настройках не требуются
  (`REFACTOR.md` R-4.6);
- **Не JavaScript в графе** (разметка или типы прямо в `.js`) — это код 2 и
  отказ, который называет причину и что править. Причина берётся с того способа,
  которым файл считали: при `minify.engine: "esbuild"` отказ называет минификатор
  и даёт два выхода (расширению — упрощение в `minify.ext` или способ `strip`), а
  при упрощении — `minify.guard`. Стеком такой случай не выглядит ни там, ни там;
- **Минификатора нет** (установка без необязательных зависимостей, платформа без
  `esbuild`) — метрика честно отступает к упрощению: числа те же, что у `strip`,
  способ говорит об этом словами, а **сборка** (`--write`) отдаёт **код 4** с
  готовой починкой. У **проверки** в этом случае ответ из двух частей, и он назван
  здесь потому, что именно её советует CI: если отчёт на диске собран с настоящим
  минификатором, а прогон идёт без него, точность изменилась — значит числа в
  таблице больше не совпадают с историей, и проверка скажет про расхождение
  (**код 1**), показав разошедшуюся строку подписи, **и тут же назовёт другой счёт**
  заметкой с готовой починкой. Вердикт при этом остаётся за расхождением: код 4
  утверждал бы, что разница объясняется датчиком, а это никто не проверял —
  расхождение может быть и правкой мимо отчёта (тот же порядок, что у `size check` и
  у `doctor`: нарушение старше приближения). Починка в обоих случаях — `pnpm run
  sizes`; на этом окружении она вернёт **код 4**.
  Проверить это без переустановки можно окружением `SIZE_REPORT_NO_OPTIONAL=1` —
  тем же приёмом это делает `test/minify.test.js`;
- **Разбор модуля — рабочий поток, поднятый один раз на прогон** (`REFACTOR.md`
  R-5.4): сам разбор стоит ~0,1 мс, а платится за него стартовой ценой потока
  (≈ 54 мс) — и только если в измеряемых файлах вообще есть модули. Отступление
  к `node --check` (≈ 86 мс на клетку) осталось на случай, когда файла потока нет
  в упаковке, поток не ответил или в Node нет модулей vm;
- **Новый файл-колонка должен быть закоммичен** до запуска: иначе проверка
  состояния скажет «не совпало с деревом коммита» (сначала `git add` + коммит,
  потом `pnpm run sizes`);
- **Доковая правка — тоже правка.** Коммит, тронувший `WORKLOG.md` или любой
  файл-колонку, получает в таблице строку, поэтому после него таблицу собирают
  заново — иначе проверка говорит «расходится с историей git» и называет строку.
  Незакоммиченная правка таблицу не двигает («сейчас» берётся из коммита), поэтому
  сборка не ломается от того, что рядом с ней правят доки.
- **`--init` не правит `.gitignore`** (`REFACTOR.md` R-4.8) — добавьте отчёты
  руками, если им не место в истории.

Проверено не на словах: раздел пройден покомандно на свежем репозитории (три
коммита, ESM в `src/`) — протокол и найденные расхождения в `WORKLOG.md` §16, а
пути, которые README называет своими, сверены с деревом. За этим следит сторож
документации, и он падает вместе с документом, а не по желанию (`REFACTOR.md`
R-4.1): пути, таблица файлов, зовы и ключи инструкций, числа проверок и цели по
времени, ссылки на разделы и пин установки проверяются машинно. Формулировки,
смысл и обещания о будущем машиной не проверяются — их держит человек.

### 8. Если в проекте уже лежит копия инструмента

Порядок выше — для проекта, который подключает инструмент впервые. Когда копия
уже лежит (свои `size-table.js` и его тесты), шаги идут в другом порядке; ниже —
тот, которым переезжал `safe-resets` (`WORKLOG.md` §18):

1. **Установить, не удаляя копию** — две реализации какое-то время сосуществуют,
   и это даёт бесплатную сверку на одном дереве: команда пакета с конфигом проекта
   обязана собрать тот же артефакт байт в байт (у `safe-resets` — 225 673 Б,
   sha256 `1bdb27e1…`). Не совпало — дальше не идём.
2. **Перевести команды проекта на пакет:** `"test:sizes": "size"`,
   `"sizes": "size --write"`.
3. **Удалить копию** — и инструмент, и его тест: те же утверждения проверяет
   набор пакета, а в проекте остаётся одна команда. Если тест звался из общего
   раннера, шаг раннера становится одним и зовёт команду пакета, а не файл
   проекта (в `safe-resets` путь берётся из манифеста установленного пакета,
   чтобы шаг не знал внутренних имён файлов).
4. **Убрать колонки удалённых файлов из настроек** и пересобрать артефакт
   **отдельным коммитом**: коммиты, трогавшие только эти файлы, без них не
   двигают ни одного числа, а такие коммиты строк не получают (у `safe-resets`
   95 × 27 → 91 × 25).
5. **Почистить документацию проекта:** ссылки на файлы инструмента заменяются
   именем пакета и его командами, а описание внутренностей (стриппер, чтение
   истории пачкой, вёрстка) из доков проекта уходит в доки пакета — иначе их две
   копии и они разойдутся.

Доступа к пакету не требуется ни локально, ни в CI — репозиторий публичный (§1),
поэтому шага с ключом в этом порядке нет.

Что при этом теряется: проверки, которые сверяли настройки проекта с ожиданиями
инструмента, отдельным набором больше не идут. Большую часть закрывает сама
команда (чужой ключ или незнакомая метрика в конфиге — отказ с объяснением, файл
таблицы не может быть колонкой), но _содержимое_ подписи (заголовок и команда
починки взяты из конфига) не проверяет никто: если это важно, это одна проверка
поверх `--data` в проекте.

## Гейт против раздувания

**Список проверок — один, и он же в CI.** Профиль проверок задан в одном месте
(`tools/gates/run.js`): `pnpm run verify:fast` (десятки секунд — каждая правка),
`pnpm run verify` (полный — перед отправкой и в CI) и `pnpm run verify:slow`
(по расписанию — то же плюс покрытие). CI зовёт эту же команду, а не свой список:
работа `verify` (`.github/workflows/ci.yml`) на каждый пуш и запрос правки, работа
`verify-slow` — по расписанию. Совпадение стережёт `test/gates-verify.test.js`:
проверка, которой нет в профиле, в CI не пройдёт.

**Датчики ловят раздувание, а не стиль** (стиль — у линтера): размер и сложность
функций, размер модулей, дубли веток и функций (`sonarjs`), вес проверок (проверка
без утверждения, утверждение без сравнения, выключенная проверка), пометки долга,
клоны по токенам (`jscpd`), циклы и сироты связей (`dependency-cruiser`), просадка
покрытия против своей же базы (`c8`).

**Порог взят из замера, а не из головы, и он храповик.** По исходному замеру:
сложность функции p50 1 / p90 4 / p99 11 / max 27 — порог 12 (в базе осталось 5
функций); длина функции p50 7 / p90 27 / p99 73 / max 118 — порог 60 (9 в базе);
модуль p90 381 строка / max 907 — порог 450 (в базе не осталось ни одного: три
толстых файла — контракт, программа страницы и сборка фикстуры — разделены,
`WORKLOG.md` §59–§61). Всё, что выше порога
сегодня, лежит в базе (`.eslint-suppressions.json`) и работе не мешает; новое валит
прогон. Дубли — 13 клонов / 84 строки (0,67 %), связи — 112 модулей / 468 связей и ни
одной находки.

**Базы обновляет человек.** `pnpm run baseline:metrics`, `baseline:dup`,
`baseline:coverage` — и только с трейлером `Gate-Change:` в сообщении коммита: правка
гейт-файла без него красна и локально (хук `commit-msg`), и в CI (по каждому коммиту
диапазона). Иначе гейт ослаблялся бы тем же коммитом, который он останавливает.
Таблица замеров, отвергнутые инструменты (knip, ast-grep, size-limit, gitleaks) и
действия человека — в `WORKLOG.md` §58.

## Для ИИ-агента

- `pnpm run verify:fast` — перед каждой правкой, `pnpm run verify` — перед отправкой;
  что не так и что нельзя трогать при красном — `AGENTS.md`.
- `size check --json` — готово ли всё: какая часть истории покрыта, какие пути
  мимо колонок (с коммитом-первопричиной) и какие коммиты выпали без строки.
- `size explain <коммит> --json` — почему у конкретного коммита нет строки: причина,
  тронутые файлы (колонки, исключённые, непокрытые) и готовая починка. Коммит —
  именем ревизии (`HEAD`, ветка, тег), полным sha или его началом.
- `size measure --json` — данные без вёрстки: строки, числа, суммы. Сегодня это
  `--json` (прежняя форма, заморожена эталоном) и `--data` (контракт страницы).
- `--json` — форма ответа, а не отдельный режим, и правило у него одно: ответ
  бывает ровно у четырёх вызовов. Без команды это прежняя форма данных
  (заморожена эталоном паритета), у `check`, `explain` и `doctor` — их ответ.
  У команды без ответа и рядом с режимом (`--write`, `--data`, `--init`)
  он отказ, а не тишина: просить JSON там, где его не бывает, — ошибка вызова.
- `size doctor --json` — вся диагностика одним ответом: окружение, зависимости,
  настройки, покрытие и находки с уровнем (`action` — делать, `note` — знать).
- Коды выхода: `0` всё хорошо · `1` расхождение с историей или неполнота ·
  `2` настройки, окружение, неизвестное или лишнее слово, два режима сразу ·
  `3` неполная история · `4` нет датчика · `5` внутренняя ошибка (таблица —
  `PLAN.md` §4.1). Действуют уже сейчас: отказ — это код и одна строка с готовой
  командой починки, без стека. `--help` печатает и то, и другое.
- Прогонов два, и оба названы: `pnpm test` — быстрый (каждая правка), `pnpm test:all` —
  полный (выкладка и CI); что в каком и почему — `tools/suites.js`, печатает числа и
  стоимости сам прогон.
- Разбор аргументов один на входе и до чтения проекта: режим либо один, либо
  отказ с обоими названными; команда и режим вместе не работают; ключ без
  значения и ключ, названный дважды, — такой же отказ. Поэтому зов, который
  инструмент не понял, нельзя спутать с исправным прогоном: вместо нуля придёт
  код 2 и готовая команда.

## Ловушки, на которых стоит проверять движок

Фикстура (`fixtures/synthetic/history.bundle`) — это история, в которой
собрано то, на чём ломаются такие инструменты: `//` внутри строки, регексп с
экранированным слэшем, шаблон с выражением, `.mjs` с `export`, не-английское имя
файла, CRLF, переименование файла, коммит «только отчёт», смешанный коммит,
слияние с правкой разрешения конфликта, замена символа без изменения объёма,
удаление и возврат файла, пустой файл, незнакомое расширение. Полный список — в
`fixtures/synthetic/README.md`.

```bash
pnpm test                      # быстрый прогон (каждая правка): паритет на фикстуре,
                               # контракт данных и страница, сторож документации и выпуска
pnpm test:all                  # полный прогон (выкладка и CI): то же плюс интеграционные —
                               # сборка на дисках, сверка с деревом, хуки, метрики
pnpm run suites:measure        # замерить длительность каждого файла набора
pnpm run parity:live           # паритет с живым проектом на клоне, две среды
node bin/size.js --data        # контракт данных: отчёт и агент
node bin/size.js --write       # минимальный отчёт
node bin/size.js --help        # справка и коды выхода
pnpm run parity                # переснять эталон паритета: проект и ревизия — из манифеста
pnpm run fixture               # пересобрать фикстуру и её эталон
pnpm run pack:check            # работает ли движок из собранного тарболла
pnpm run check:standards       # эталоны воспроизводятся, а дерево остаётся чистым
git clone fixtures/synthetic/history.bundle /tmp/size-report-fixture
```

Открытые блокеры и известные пробелы — в `BLOCKERS.md`; там же таблица настроек,
которые проверены и оказались инертными (чтобы не проверять их заново).

# BLOCKERS — size-report

The journal of blockers and known gaps. An entry is something that silence must not close: either the work
stops, or the defect is known and worked around in a way that cannot be forgotten.

The rules of keeping it:

- a **blocker** (B\*) has a **reproduction** (a command rather than a story), a **consequence** and a **suggested
  fix**; a **note** (N\*) is an observation: it names the measurement that established it, and a gap among them
  names the options with their price;
- a worked-around gap must be held by a check that reddens **when the gap is closed** — otherwise the workaround
  becomes silence;
- a closed entry is not deleted: it is dated, and says what was done and what holds it now.

Quoted lines of the tool's own output stay in the language it prints (Russian): they are what a reader sees.

---

## B1. Paths outside ASCII depended on `core.quotePath` — CLOSED 2026-09-14

**The essence.** The engine takes the list of changed files from `git log --name-only` and used to rely on git's
`core.quotePath`, which is **on** by default: non-English paths then arrive quoted and escaped, and no path from
the settings matches such a string, so a column holding one found no file in any commit.

```text
"docs/\320\267\320\260\320\274\320\265\321\202\320\272\320\270.md"
```

**The consequence was double:**

1. a column with such a path was empty through the whole history — the file seemed not to exist for the tool;
2. a commit whose **only** change of volume was that column lost its row altogether (in the fixture, “a branch —
   an edit of code and notes”): it landed among the skipped ones as “no change of volume”.

The defect did not show on the live project (`safe-resets`, all paths ASCII), so the parity reference did not
depend on the setting, while the fixture did: on a machine with git's default settings it gave 13 rows instead
of 14.

**What was done.** One boundary of git calls (`src/git.js`, the list `GIT_PINS`): every call goes through one
argument builder that adds `-c core.quotePath=false` and three settings of the same class (colouring, the
signature block, the encoding of subjects), while the subprocess environment gets a pinned locale (`gitEnv`). A
command-line key outranks both the machine's settings and the ones from the environment, so the guarantee does
not depend on who has what configured — and that is asserted separately.

**What holds it** — `test/environment.test.js`, four checks: the output does not depend on git's settings and the
locale; the pin cannot be overridden from the environment; in an environment without the machine's settings the
fixture gives **14 rows** and all columns are filled. **Re-verified by mutation on 2026-09-16:** with
`core.quotePath=false` taken out of `GIT_PINS` reddens exactly two of them — the one asserting the engine's output
does not depend on git's settings and the locale, and the one asking the fixture for 14 rows with every column
filled in an environment without the machine's settings — and the other two stay green.

**What confirms it on the live project.** `pnpm run parity:live` compares the numbers and the artifact with the
`safe-resets` reference in two environments: the ordinary one and the one with unreadable machine settings.

**Reproduction** — for the day the pin is taken away. Before the fix this printed `13`; today, measured
2026-09-16, it prints `14` (and `skipped` of 2), because the command-line pin outranks the variable:

```bash
SR=$(git rev-parse --show-toplevel)
git clone $SR/fixtures/synthetic/history.bundle /tmp/size-report-b1
cd /tmp/size-report-b1
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.quotePath GIT_CONFIG_VALUE_0=true \
  node $SR/bin/size.js --config $SR/fixtures/synthetic/config.json --json | jq '.rows | length'
```

---

## B2. `core.autocrlf` broke the comparison with the working tree — CLOSED 2026-09-14

**The essence.** The comparison with the working tree (`assertMatchesDisk`, `src/history.js`) compared the size of
the blob from the history with the size of the file on disk. With `core.autocrlf=true` (the default of Git's
installer for Windows) the disk holds CRLF while git holds LF: not a lost edit, yet the sizes differ — and the
tool refused to work at all, saying “the carried state missed an edit”, which lied about the cause.

**Reproduction** — for the day the comparison is weakened. Measured 2026-09-16: green (code 0) today, where
before the fix it refused.

```bash
SR=$(git rev-parse --show-toplevel)
T=$(mktemp -d)
git -c core.autocrlf=true clone -q $SR/fixtures/synthetic/history.bundle "$T/a"
git -C "$T/a" config core.autocrlf true     # a consistent checkout: the status is clean
(cd "$T/a" && node $SR/bin/size.js --config $SR/fixtures/synthetic/config.json --json)
# before the fix (the tool prints in Russian):
# Error: размер src/code.js на HEAD (735 B) не совпал с файлом на диске (749 B):
#        перенос состояния между коммитами пропустил правку
```

**Why a pin did not work here, unlike B1.** Pinning `core.autocrlf=false` on git calls does not help this
comparison: the content is read from the disk rather than from git. Worse, it would weaken it — in a CRLF
checkout the whole working directory would look modified, every file would land among the dirty ones, and the
comparison would quietly stop checking anything.

**What was found along the way.** Comparing content rather than sizes is not enough on its own: git does not
always restore line endings. A file whose CRLF lie in the commit itself (in the fixture, `notes/crlf.txt`) is
checked out as it is under `core.autocrlf=true`, while the “cleanup” would put LF back — so `hash-object` of the
file on disk gives a blob other than the one in HEAD. Git itself warns about such a file (“CRLF will be replaced
by LF”) while `git status` calls it clean, since it looks at the index's record rather than re-reading the
content. One such file, and a blunt fix would bring the tool down again — measured on `notes/crlf.txt`.

**What was done.** The comparison became two-sided, and both sides compare content rather than sizes:

1. **The carried state against the commit's tree.** `git ls-tree -r -z HEAD` is the truth about HEAD's content
   independent of reading blobs. A column with no file in its state must be empty in the tree as well (otherwise
   a creation was lost). That is the very check the comparison exists for: it catches an edit lost while the
   state was carried between commits.
2. **The file on disk against that same content.** `git hash-object --stdin-paths` (one call for all files)
   gives the hash of what git would put into the index. Where that does not match, one case remains — a file git
   does not give back in this checkout — and there the content on disk is compared with
   `git cat-file --filters HEAD:<path>`, which is what git itself would have laid out for that blob. Files edited
   in the tree stay out of the disk comparison, as before: their content differs between the commit and the disk
   lawfully.

**The consequence is wider than the fix.** The comparison became more precise rather than merely more tolerant:
with content compared, an edit that changed no size is caught now (it used to slip past), and so is a column
whose file creation was lost.

**What holds it** — one check per side:

| Check | What it asserts | The mutation that reddens it |
|---|---|---|
| `test/crlf.test.js`: a CRLF checkout does not hinder the comparison | the numbers and the artifact's sha256 match the ordinary checkout; the check itself asserts the clone came out with CRLF and a clean status | green today; red on the engine before the fix |
| `test/disk.test.js`: an edit on disk alone is caught, in both checkouts | a file marked `--assume-unchanged` and edited on disk (git stays silent about it) must bring the comparison down | a tree-against-tree comparison (an empty check) reddens exactly this one |
| `test/disk.test.js`: a lost edit of a merge commit is caught by the state against the tree | an engine without `--diff-merges=first-parent` must fail on the state comparison | turning the state comparison off reddens exactly this one |

**Status:** closed.

---

## B3. A column whose file was deleted before HEAD brought the run down — CLOSED 2026-09-14

**The essence.** A file added and then deleted in the history (an everyday thing: a temporary module, a script
that was removed) did not work in a column at all — the run refused with **code 1** and a message that meant
nothing.

**Reproduction** (the hypothesis: the file went through the history and vanished before HEAD). Measured
2026-09-16: green (code 0) today, with the column empty at HEAD and holding its 13 bytes where the file existed.

```bash
SR=$(git rev-parse --show-toplevel)
git clone -q --no-hardlinks $SR/fixtures/synthetic/history.bundle /tmp/b3 && cd /tmp/b3
printf 'const a = 1;\n' > src/gone.js && git add src/gone.js && git commit -qm 'added'
rm src/gone.js && git add -A && git commit -qm 'removed'
# the column {label: "gone.js", paths: ["src/gone.js"]} added to a copy of the fixture's config
node $SR/bin/size.js --config /tmp/b3.json --json
# before the fix (the tool prints in Russian):
# ✗ состояние «gone.js» на HEAD не совпало с деревом коммита (файла нет вместо файла нет):
#   перенос состояния между коммитами пропустил правку
```

**The cause.** In `assertMatchesDisk` (`src/history.js`) the condition `p === undefined || tree.get(p) !==
state[i].sha` counted as a loss the case where the file is absent **both** in the state and in the tree — that
is, where a column is empty at HEAD lawfully (the file was deleted rather than lost). The comment beside it said
the opposite, and the message was the two halves “there is no file” glued together.

**The consequence.** A report over a project with such a column could not be assembled at all: running the tool
over someone else's repository with a history of deletions was impossible without editing the settings by hand.
The workaround was to declare no such column — that is, to lose the number.

**What was done.** Only a **disagreement** of the two sides is a loss now, not emptiness on both. Three things
count as lost, and all three still bring the run down: a creation (the tree has the file, the state does not know
it), an edit (the file is on both sides with different content) and a deletion (the state knows the file, the
tree does not). A column whose file lived in the history and was deleted before HEAD is empty on both sides —
which is not a loss. The message itself no longer breaks on `tree.get(p)` when a path from the state is not found
in the tree (in the old code that would have been a stack instead of an explanation), and it now names **both**
sides (the tool prints in Russian): “в дереве `src/only-in-merge.js` 77d3e2f, в состоянии файла нет”.

**What holds it** — `test/disk.test.js`, three checks, all of them on numbers and texts:

| Check | What it asserts | The mutation that reddens it |
|---|---|---|
| a file deleted before HEAD does not bring the run down and the numbers agree with the history | a history with an addition, an edit, a deletion, a return and a second deletion assembles with code 0, and each commit's number equals the size of the blob git holds (the return gives the same number as the first appearance) | putting the old condition `p === undefined` back reddens this one together with the second, on the message's text |
| a lost creation is caught by the state against the tree | a file that appeared **only in a merge** must bring the run down when the list of changed paths of the merge commit is lost, naming the tree's side and the state's side | the mutation lives inside the check: an engine without `--diff-merges=first-parent` is assembled at once and must refuse; the check also asserts the file exists in neither parent, or the mutation would be about something else |
| a lost deletion is caught by the state against the tree | the state remembers a file the tree does not have (the file is deleted only in a merge): the mutated engine must refuse, naming “there is no file in the tree” and the path from the state | the same mutation — without `--diff-merges=first-parent` the deletion is invisible, and the check catches it; before the fix this case was an internal error, **code 5** with a stack |

A lost **edit** is held by the same fixture check (an engine without the first parent), and an edit on disk alone
by the check over the two checkouts.

**Status:** closed. The fix ran in `worklog/archive/WORKLOG.md` §28; neither the live project nor the fixture
showed the defect (no column there has a file deleted before HEAD), and the numbers, the artifact and both
references stayed the same after the fix.

---

## Заметки (не блокеры)

- **N1. Контрольный режим в свежем клоне фикстуры красный.** В фикстуре артефакт
  закоммичен (коммит «только отчёт» сдвигает его содержимое), поэтому до
  `--write` файл не совпадает с историей. Порядок проверок поэтому такой:
  `--json`, затем `--write`, затем контрольный режим — так же поступает и
  `tools/make-fixture.js`.
- ~~**N2. Путь движка в тексте ошибки меняется при переносе**~~ — закрыто
  2026-09-14 (волна 0 чистки, `REFACTOR.md` R-0.1/R-0.3). Подсказка больше не
  цитирует файл движка: она называет точку входа (`bin/size.js`), и её выполнение
  создаёт настройки, по которым инструмент сразу работает. Заодно у отказов
  появились коды выхода по таблице `PLAN.md` §4.1 и справка вместо стека.
  Стережёт `test/cli.test.js` (10 проверок, все красные на движке до правки).
- **N3. Что проверено и оказалось инертным** (чтобы не перепроверять). Каждая
  строка — это прогон движка в клоне фикстуры с подсунутой настройкой и сравнение
  с эталоном побайтово:

  | Настройка | Результат |
  |---|---|
  | `diff.renames=true/false` | не влияет на числа: проверено сравнением вывода движка в обоих значениях (закрыто в N8) |
  | `color.ui=always` | не влияет (свой формат вывода не раскрашивается), но закреплено — чтобы не полагаться на это |
  | `log.showSignature=true` | не влияет без подписанных коммитов; закреплено — блок подписи попал бы в разбор путей |
  | `i18n.logOutputEncoding`, `i18n.commitEncoding` | не влияет без коммитов с чужим заголовком `encoding`; кодировка закреплена |
  | `pager.log=true`, `GIT_PAGER=less` | не влияет (вывод не в терминал); `--no-pager` закреплён |
  | `LC_ALL`, `LANG` | не влияет; локаль подпроцессов закреплена |
  | `core.abbrev=4`, `log.date=relative`, `log.decorate=full` | не влияет: инструмент просит `%H`, `--date=format:` и свой формат |
  | `status.showUntrackedFiles=no` | не влияет на числа (только на список грязных файлов в сверке с диском) |
  | `core.autocrlf=true` | на числа не влияет; сверку с диском ломало — закрыто сравнением содержимого (B2) |

- **N4. «Сумма дельт сходится с текущим размером» — верно не для всех колонок.** У
  файла, удалённого и возвращённого (в фикстуре — `notes/crlf.txt`), в колонке две
  клетки роста: первое появление и возврат. «Сейчас» — один размер, поэтому сумма
  дельт больше него (117 против 63 на фикстуре). В колонке «Общий объём» уход файла
  виден: её дельта падает на объём исчезнувшего, тогда как в клетке самого файла
  стоит `—` (дельты нет). Так работает артефакт, и страница повторяет то же
  правило — поэтому числа двух отчётов совпадают. Тесты называют такие колонки
  поимённо и утверждают точные числа (`test/contract.test.js`): правило нельзя
  поменять молча. Менять его (например, показывать уход файла как спад) — это
  менять числа отчёта, то есть отдельный проход, а не правка контракта.
- **N6. В браузере все страницы `file://` делят одну память.** Отчёт читают с диска,
  а не с сервера, поэтому запись выбора не может лежать под одним ключом: ключ —
  отпечаток паспорта отчёта (имя инструмента, схема данных, путь артефакта,
  заголовок и метки колонок в порядке отчёта). Проверено в Chrome 153 на двух
  отчётах одной истории: оба держат по своей записи (`size-report:4684b2b2` и
  `size-report:5dcd0db1`) и выбор одного не трогает другой. Там, где браузер памяти
  не даёт вовсе (приватное окно, чужой отчёт без адреса), страница работает без неё:
  все проверки в `test/contract.test.js`, кроме проверок памяти, идут на документе
  без адреса — это и есть окружение без памяти.

- **N7. Смена якоря не перезагружает документ.** Ссылку на выбор страница носит в
  адресе (`#size-report=…`). Если отчёт у читателя уже открыт, переход по ссылке для
  браузера — это смена якоря в том же документе: загрузки не происходит, и без
  обработчика `hashchange` ссылка срабатывала бы только в новой вкладке. Проверено в
  Chrome: при пустом обработчике адрес менялся, а вид — нет. Держится проверкой
  «ссылка: смена адреса на открытой странице тоже применяется» (jsdom поднимает
  `hashchange` так же асинхронно).

- **N5. Причины пропущенных коммитов в контракте — строками движка**
  (`"cd78fd9 (только таблица)"`). Разложить их по полям (`{sha, why}`) — вместе с
  командой объяснения (`size explain`, план §5, шаг 5): сейчас это единственное
  поле контракта, которое описывает формулировку, а не данные.

- **N8. Псевдоним колонки и `diff.renames` — ЗАКРЫТО 2026-09-14.** Колонка может
  перечислять несколько путей одного файла (`modern.js` — это `src/modern.js` или
  `src/legacy.js`). При выключенном распознавании переименований git отдаёт в
  коммите-переименовании **оба** пути, движок брал первый по порядку настроек —
  тот, которого в коммите уже нет, — и состояние теряло файл (сверка отказывала на
  законном случае). Воспроизведение (на фикстуре, где у колонки `modern.js` два
  псевдонима):

  ```bash
  git clone -q --no-hardlinks $SR/fixtures/synthetic/history.bundle /tmp/n8 && cd /tmp/n8
  git mv src/modern.js src/legacy.js && git commit -qm 'имя вернулось'
  git config diff.renames false          # не умолчание, но и не запрет
  node $SR/bin/size.js --config $SR/fixtures/synthetic/config.json --json
  # было: ✗ состояние «modern.js» на HEAD не совпало с деревом коммита
  #         (в дереве src/legacy.js aa07bce, в состоянии файла нет)
  # стало: ✓ 14 строк, modern.js = 246 — тот же размер, что у блоба в git
  ```

  **Что сделано.** Путь для состояния выбирается по тому, что в коммите **есть**, а
  не по порядку настроек: план собирает все псевдонимы, которых коммит коснулся, а
  берётся первый, для которого git отдал блоб (`src/history.js`). Прежние числа
  поехать не могли и не поехали: старая логика и новая совпадают всюду, где первый
  по порядку псевдоним в коммите существует, — то есть в любом прогоне, который до
  сих пор заканчивался отчётом, — и различаются только там, где раньше состояния не
  было вовсе. Проверено тремя способами: вывод движка до и после правки побайтово
  совпал на истории фикстуры при `diff.renames` в обоих значениях (12 824 Б),
  оба замороженных эталона воспроизводятся байт в байт, живой отчёт — те же
  95 × 27 и 225 673 Б, а прогон на живой истории остался **1,56–1,58 с**.

  **Чем держится.** «переименование внутри псевдонимов колонки не роняет прогон»
  (`test/disk.test.js`): история с переименованием в другой псевдоним собирается и
  при умолчании git, и при `diff.renames=false`, а число колонки сверяется с блобом
  из git (`cat-file -s`), а не с самим движком. Красная до правки: клон `237bbdd` с
  этим тестом — 5 из 6 зелёные, красная ровно она, текстом «состояние «modern.js»
  на HEAD не совпало с деревом коммита». Ловля расхождений при этом не ослабла:
  третьим свидетелем той же мутации закрыто потерянное **удаление** (файл удаляется
  только в слиянии — состояние о нём помнит, а в дереве его нет).

- **N9. Пометка приближения — по формату, а не по содержимому.** Точность клетки
  решает расширение пути (`pointExact` в `src/metrics.js`), потому что именно
  расширение говорит, возьмёт ли формат минификатор. Следствие, которое стоит
  знать: пустой файл (`src/empty.js` фикстуры) помечен приближённым, хотя пустое
  минифицируется точно, а `.md` из одних ASCII-слов мог бы терять только
  комментарии. Ошибка в эту сторону безопасна (приближение, объявленное там, где
  число точное, — осторожность, а не обман) и зеркальна тому, как решён `min` под
  снятием балласта: там точность тоже считается по формату, а не по содержимому.
  Если понадобится точность по содержимому (пустой файл, JSON под снятием
  балласта — он уже точен), это правка того же одного правила, а не формы данных.

- **N12. Проверка, которая читает окружение машины, — тот же класс, что B1 и N10.**
  Первый пуш хука был красным только в CI: GitHub ставит всему набору `CI`, хук в
  этом окружении молчит по устройству, и девять сценариев честно получали
  «пропущено по причине CI». Продукт был прав, проверка — нет: она зависела от
  окружения. Правило из этого: проверка сама задаёт своё окружение
  (`delete process.env.CI` в `test/hook.test.js`), а сценарий про выключатели
  передаёт их вызовом, не рассчитывая на машину. Осталось ли такое где-то ещё —
  стережёт прогон: CI гоняет набор в двух средах (`GIT_CONFIG_GLOBAL=/dev/null` и
  обычной), поэтому чужое окружение видно сразу, но не видно того, что CI ставит и
  что в обеих среда одинаково (тот же `CI`) — это ловится только самим CI.

- **N11. Склейка без пробелов мимо линтера — наблюдение, не блокер.** Два класса
  склейки выглядят похоже, а ловит линтер только один. `no-multi-spaces` (заведён
  в `R-1.2`) берёт случай, когда от склейки остался лишний пробел (`, } else {      const …`).
  Обратный случай — пропавшая между операторами строка, где лишних пробелов нет
  (`}function writeMode(cfg, root) {`): такое нашлось глазами в диффе прохода
  `WORKLOG.md` §36 и было бы видно только в истории. Дешёвый кандидат —
  `padding-line-between-statements` с требованием пустой строки перед объявлением
  функции; он ловит именно этот случай и не рубит принятые однострочники. Пока не
  заведён: сначала надо посмотреть, сколько замечаний он даёт на живом дереве
  (если десятки — это переформатирование, а не правило).

- **Слияние: git не зовёт `post-commit` — проверено опытом, не догадкой.** При
  `git merge` хуков `pre-commit`/`commit-msg`/`post-commit` не бывает вовсе: git
  создаёт коммит слияния сам, и вызывается `post-merge` (опыт на git 2.50: три
  обычных коммита дали три `POST-COMMIT`, слияние — только `POST-MERGE`). Хук
  автообновления из-за этого ставится двумя файлами (`src/hook.js`), и
  `git commit --only` на слиянии отказывает (`cannot do a partial commit during a
  merge`, потому что `MERGE_HEAD` жив, пока работает `post-merge`) — поэтому
  коммит отчёта собирается плумбингом. Оба факта — про API git, а не про этот
  проект, и стоят здесь, чтобы их не переоткрывали.

- **N13. Пин в примере установки отстал, а лишнее слово не отвергалось** — **закрыто 2026-09-14** (`REFACTOR.md` R-4.13).
  **Воспроизведение.** `README.md` §1 ставил пакет примером
  `pnpm add -D github:vernikr/size-report#d63468d`, а §5–§6 учат `size check`,
  `size doctor`, `size explain <sha>` и `size install-hook`. На той ревизии справка
  знает только флаги, а `plainWords` собирал слова без разбора: любой лишний или
  неизвестный ключ просто не читался, и прогон отвечал обычной проверкой таблицы.
  **Следствие.** Документированный путь установки вёл в пустоту, причём без отказа:
  `check`, `doctor`, `explain` и `install-hook` отвечали нулём, ничего не сделав (хук
  не ставился), а `templates/` в поставке не было. «Всё хорошо» на то, чего
  инструмент не умеет, хуже отказа — именно это и нашёл сквозной прогон. Тот же
  пи́н держал и проект-потребитель, так что шаг 5 (интеграция) стоял на ревизии без
  всего, что шаг 5 добавил.
  **Починка.** Незнакомый ключ, ключ со значением без значения (`--config`),
  `--force` без `--init` и слово после режима со значением — отказ кодом 2 с
  названным виновником и готовой командой, и разбор аргументов идёт **до чтения
  проекта**. Пример установки ведёт на ревизию, где названные команды есть, причём
  **сорока знаками**: короткий sha pnpm разрешает только через верхушки веток, и он
  же перестаёт разрешаться на следующем коммите в неё — сторож документации
  проверяет и это, и то, что в справке **той** ревизии есть названные команды;
  пи́н в потребителе поднят. Держится: `test/cli.test.js` (набор отказов) и
  `test/docs-pin.test.js` («пример установки ведёт на ревизию, чья справка знает
  названные команды»).

- **N11. Журнал отчёта — `CHANGELOG.md`, и это соглашение, а не случайность.** Настройки,
  выведенные из проекта, ищут журнал среди четырёх имён в **корне** и берут первое, которое есть
  (`src/project.js`: `JOURNALS`, `journalOf`). Список начинается с `WORKLOG.md`, а такого файла в
  корне больше нет: рабочий журнал стал каталогом записей `worklog/`. Поэтому вывод останавливается
  на `CHANGELOG.md`, и отчёт этого репозитория считает коммиты по выпускам, а не по проходам журнала.

  **Что измерено перед тем, как это принять.** В собранном отчёте (113 строк на момент записи) раздел
  несут 14 строк: 13 — релизные коммиты, заведшие новый раздел (случай «заведён новый», он не зависит
  от порядка документа), и одна — коммит, который правил существующий раздел `1.0.0`, единственный им
  затронутый, так что и там имя верное. Ссылки живые: якорь вида
  `CHANGELOG.md#240--2026-09-15` ведёт на настоящий заголовок. Ни числа, ни артефакт, ни оба
  замороженных эталона от имени журнала не зависят.

  **Принятая цена.** Два следствия, о которых стоит знать: отчёт больше не привязывает строку к
  проходу рабочего журнала, и становится достижимо известное ограничение — `touchedSection`
  отступает к последнему правленому разделу **в порядке документа**, а список выпусков написан
  сверху вниз, поэтому коммит, правящий **два** существующих раздела, будет назван по старшему из
  них (сегодня такого коммита нет: единственный правящий касается одного раздела). Против этого —
  выбранный журнал растёт: каждый выпуск заводит в нём раздел, тогда как архивный
  `worklog/archive/WORKLOG.md` заморожен на разделе 73 и оставил бы все коммиты после переезда
  без раздела.

  **Варианты и их цена.**
  1. **Принять и записать словами (выбрано).** Ничего не меняется, инструмент работает ровно как
     раньше.
  2. **Закрепить журнал настройками проекта.** `size-table.config.json` неполным быть не может:
     отсутствие файла — это и есть «настройки выводятся из проекта», а файл без единой колонки
     отказ проверки настроек. Закрепление значит нести весь профиль руками, и после этого каждый
     новый путь обязан стать колонкой или записью `skip`, иначе `check` отвечает кодом 1 — проект
     меняет автоматический отчёт на поддерживаемый вручную. Это смена поведения, поэтому внутри
     прохода по документации не берётся.
  3. **Научить инструмент журналу вне корня** (или каталогу записей, читаемому как один журнал).
     Это единственный способ изменить, **какой** журнал выбирает вывод, и это правка кода:
     `journalOf` и собираемые рядом образец и адрес, плюс решение о контракте отчёта —
     `journal.path` перестал бы быть одним путём. Это новая возможность, а не починка, и ей нужен
     свой выпуск.

  **Решать пользователю:** должен ли журнал отчёта быть рабочим журналом вообще (вариант 3 вместе с
  вопросом о контракте). Пока это не решено, соглашение выше в силе, и отчёт верен как есть.

- ~~**N10. Обвязка читает git без закреплённых настроек**~~ — **закрыто 2026-09-14**
  (`REFACTOR.md` R-1.4). В `tools/harness.js` `gitIn` звал `git -C …` как есть,
  тогда как движок закрепляет окружение на своей границе (`src/git.js`, закрыто в
  `B1`). Пока это ни на что не влияло: все пути самого репозитория ASCII, а числа
  и вывод инструмента читает не обвязка, а сам инструмент. Но проверка, которая
  читает git напрямую, зависит от машины — сторож документации это нашёл первым:
  с `GIT_CONFIG_GLOBAL=/dev/null` `git log --name-only` вернул путь фикстуры
  закавыченным, и `docs/заметки.md` из `BLOCKERS.md` стал «несуществующим»
  (`quotePath` по умолчанию включён). Сторож был бы зелёным на этой машине и
  красным на другой, то есть ложной сетью. Стало: список закреплений и локаль — из
  `src/git.js`, им пользуются и движок, и обвязка; незакреплённых вызовов git в
  проверках и инструментах нет, и это стережёт `test/git-pins.test.js`, а не этот
  абзац. Обход, который держался проверкой, снят вместе с пробелом.

- **N14. Храповик покрытия падает от комментариев, а не от кода: просадок 11, из них 10 — наши,
  одна — давняя.** Шаг `cover` в slow-профиле красный. Разобрано тремя замерами в отдельных
  рабочих копиях (`git worktree`), а не по памяти.

  **Где он был красным.**
  1. На ревизии `202c768` (там `coverage-baseline.json` и снят): **зелёный** — «в базе 39 файлов,
     просадок нет» (83.29 % строк). Значит база была верна своему дереву.
  2. На ревизии `758a385` (**родитель первого прохода по комментариям** этой переработки):
     **уже красный**, ровно одна просадка — `src/data.js`, ветви 91.66 → 89.47. Этот красный к
     переработке комментариев отношения не имеет: он приехал с работами по дереву отчёта и странице
     (`364a0ac`, `da69a32`, `4079329` — они между базой и этой ревизией), а база после них не
     переснималась. То же число `89.47` стоит и сейчас — то есть эта просадка не наша ни строкой.
  3. Сейчас: 11 просадок — та же `data.js` плюс десять файлов с падением доли на десятые доли
     процента (`cli.js` 91.95 → 91.66, `hook.js` 88.16 → 87.64, `derived.js` 75.86 → 75 и т. д.).

  **Механизм, доказанный числами.** `c8` считает строкой **каждую строку файла, попавшую в диапазон
  покрытия**, а покрытой — ту, что лежит внутри исполнившегося диапазона; поэтому удаление
  комментария внутри исполнившегося кода уменьшает и числитель, и знаменатель на единицу, а доля
  как отношение падает. Подтверждение по десяти файлам: `Δпокрытых = Δвсего = число удалённых строк`
  (`hook.js` −19 = −19 = −19: 395/448 → 376/429; `cli.js` −3 = −3 = −3: 80/87 → 77/84). И
  `lines.total` совпадает с числом строк файла минус строку в конце: у `derived.js` это 112 против
  113. Десятый файл — единственный, где числа разошлись: `strip/guard.js` 57/59 → 55/58, то есть в
  числителе пропало на строку больше (там комментарии переписаны и в шапке, и внутри кода, а
  `total` считает все строки файла, тогда как `covered` — только попавшие в исполнившийся диапазон).

  **При этом проверок не потеряно ни одной.** Итоги по дереву не упали, а чуть выросли: было 80.53 %
  строк (на `758a385`) — стало 80.57 %; ветви 89.05 % и функции 92.37 % — те же. И код в проходах не
  тронут: ни в одном коммите `refactor(comments)` в `src`/`bin` нет ни одной добавленной, удалённой
  или изменённой строки кода — единственное, что там менялось, — текст комментариев в концах строк.

  **Цена такого датчика.** Красный шаг читается как «код приехал без проверки», хотя означает
  «комментарий стал короче». Обещание храповика для этого случая неверно, и на проходе по
  комментариям он краснеет гарантированно — то есть остаток работы (`M9f`, `M10` ~6200 строк, `M11`)
  будет краснеть на каждом шаге.

  **Варианты и их цена.**
  1. **Переснять базу** (`pnpm run baseline:coverage`, человеческое действие, трейлер `Gate-Change:`).
     Дешево и честно ровно наполовину: заодно прощаются настоящие просадки, а они есть — та самая
     `data.js`, которая не переснималась с момента, когда её уронила работа по отчёту. И следующий
     проход по комментариям покраснеет снова.
  2. **Научить датчик считать исполнившиеся строки, а не долю от всех** (сравнивать `covered` с
     исполнившимися строками или перейти на `statements`/`branches` без `lines`). Тогда комментарии
     перестанут влиять вовсе. Это правка датчика, то есть гейт-файла: своя цена (трейлер, проверки
     датчика, выпуск) и смена смысла храповика — с «доли строк файла» на «сколько проверок
     исполнилось».
  3. **Оставить как есть и записать соглашение**: после каждого прохода по комментариям база
     переснимается человеком. Красный шаг остаётся сигналом, но требует человеческого шага в каждом
     таком проходе — и до этого шага slow-профиль и расписание CI красные.

  **Решать пользователю:** какой вариант принять. До решения `pnpm run verify:fast` и `pnpm run
  verify` зелёные (в полном профиле `cover` не гоняется вовсе), а `pnpm run verify:slow` и
  `verify-slow.yml` по расписанию — красные: одна просадка давняя, десять наши-механические.

- **N15. Свой отпечаток клонов у датчика дублей — возможно, уже лишний.** Нашлось на проходе M10f
  (2026-09-15) при сверке комментариев: и в `tools/gates/dup.js`, и в `test/gates-dup.test.js` стояло,
  что родная база jscpd (`--baseline`) привязана к пути выкладки, и потому храповик построен на своём
  отпечатке. **Измерено — для закреплённого jscpd 5.2.0 это неверно.** База, снятая самим jscpd
  (`--update-baseline`, формат `{version, fingerprints}`), применённая к тому же дереву в другом
  каталоге, остаётся зелёной (`--fail-on-new-clones=0`, выход 0); переживает переименование файлов и
  сдвиг строк; на действительно новой копии краснеет («1 new clones»). Замеры: игрушечное дерево (13
  строк, два одинаковых файла) и всё дерево пакета (`src bin tools test`, 11 отпечатков — столько же
  клонов датчик называет сегодня). А «все клоны новые» получается, если подсунуть jscpd **наш файл**
  `dup-baseline.json`: он отвечает `missing field version` и выходит с кодом 1 — похоже, прежний замер
  («15 новых клонов» на чистой копии) был именно этим, в нашей базе 15 отпечатков.

  **Что остаётся верным и почему свой файл пока есть.** Наш `dup-baseline.json` — это гейт-файл под
  защитой `gatefiles`, с `schema`, именем конфига и пометкой для человека, и о нём же говорят счётчики
  датчика и его машинный отчёт. У файла jscpd нет ни схемы, ни пометок, и никто его не стережёт (в
  дереве ему и не обязательно лежать: `--baseline` берёт путь).

  **Варианты и цена.** (1) Оставить как есть: свой отпечаток дублирует родной, зато формат файла и
  счётчики наши. Цена — около тридцати строк лишнего кода и два способа говорить об одном и том же.
  (2) Перейти на `--baseline` и `--baseline-from-ref origin/main`: второй взгляд против дерева главной
  ветки у jscpd уже есть, датчик сократится, но база станет чужим форматом (без пометки и схемы), а её
  обновление — `--update-baseline` вместо `pnpm run baseline:dup`, то есть гейт-файл меняет вид и
  храповик переснимается. (3) Гибрид: свой файл для чтения человеком и защиты `gatefiles`, а
  сравнение с главной веткой — через `--baseline-from-ref`. Цена — два механизма в одном гейте.

  **Решать пользователю:** нужен ли свой отпечаток при родном. До решения поведение не тронуто,
  исправлены только комментарии, которые утверждали обратное.

- **N16. Репозиторий без коммитов — внутренняя ошибка с чужим стеком.** Нашлось на проходе M7 подплана
  `markdown` (2026-09-16) при сверке требования README «git-репозиторий с историей».

  **Воспроизведение.** Свежий `git init`, один файл в индексе, ни одного коммита:
  `node bin/size.js --write` → **код 5** и «внутренняя ошибка (это дефект инструмента…)» со стеком от
  `execFileSync` в `readHistory` (`src/git.js`), потому что `git log` в таком репозитории отвечает
  `fatal: your current branch 'main' does not have any commits yet`. С первым коммитом та же команда
  зелёная и пишет `docs/size-report.html` (код 0).

  **Следствие.** Первый запуск до первого коммита — ровно тот случай, который `--init` переживает
  намеренно (`src/project.js` ловит «нет коммитов» и продолжает) — объявлен дефектом инструмента с
  просьбой прислать текст, а готовая починка («сделайте коммит») до читателя не доходит. Код 5 значит
  «внутренняя ошибка», а это состояние проекта, а не поломка движка.

  **Что верно в документации.** Требование README не лжёт: история нужна, и коммит хотя бы один. Это
  пробел кода, а не документа; код в этом проходе не трогался — проход документационный.

  **Варианты и цена.** (1) Свой отказ («история пуста») с готовой командой — дешёвый, но добавляет
  место отказа, а их считает каталог (`test/refusals-catalog.test.js`), значит нужна строка в каталоге
  и, возможно, случай в `test/refusals.test.js`. (2) Считать пустую историю пустым отчётом (ноль
  строк) — отчёт честно скажет, что коммитов нет, но это новое поведение отчёта. (3) Оставить как есть:
  код 5 остаётся, а требование «хотя бы один коммит» живёт в README.

  **Решать пользователю:** какой вариант принять. До решения поведение не тронуто, README называет
  требование и ссылается сюда.

- **N17. Три обещания проекта модуля, которых нет в коде: схема настроек, миграция и блок для агентов.**
  Нашлось на проходе M12 подплана `markdown` (2026-09-16) при сверке §9 и §13 `docs/module-design.md`.

  **Что обещано и что есть.** Три места проекта обещают то, что без правки кода неверно:

  1. «формальная схема настроек» (§9) — схемы в поставке нет: `package.json` объявляет `bin`, `src`,
     `templates`, `README.md`, `CHANGELOG.md`, `LICENSE`, а `templates/` держит три файла
     (`size-report.config.json`, `README.md`, `ci.yml`). Проверка живёт в коде (`validateConfig` в
     `src/config.js`), и ключ `$schema` в файле проекта ни на что не влияет.
  2. «миграция при обновлении формата» (§9) — кода миграции нет: читается один файл
     (`CONFIG_NAME = 'size-table.config.json'`), неверное значение — отказ с готовой починкой, а не
     преобразование старого формата.
  3. «при установке модуль сам вписывает в файл инструкций проекта короткий блок» (§13) — в чужие файлы
     проекта инструмент не пишет вообще: поиск по `AGENTS` в `src/` не находит ничего, `installHook`
     пишет только в `.git/hooks` и отказывается трогать чужой хук, список игнорирования не правится, а в
     поставке лежит заметка для человека (`templates/README.md`).

  **Чем проверено.** Состав поставки — `files` в `package.json`; содержимое `templates/` — перечислением
  каталога; проверка настроек — чтением `validateConfig` и `loadConfig` в `src/config.js`; запись в чужие
  файлы — поиском по `AGENTS` в `src/` и чтением `src/hook.js`; семейства токенов — `src/tokens.js`.

  **Следствие.** Читатель проекта модуля считает все три вещи существующими: редактор подсказок не даёт,
  старый файл настроек не преобразуется, а агент в новой сессии узнаёт об инструменте не из своего файла
  инструкций, а из заметки, которую туда должен положить человек.

  **Варианты и цена.** (1) Схема: положить в поставку схему и сослаться на неё из
  `templates/size-report.config.json` — редактор получает подсказки сразу, но появляется вторая сущность,
  которую надо держать в согласии с `validateConfig`. (2) Миграция: распознавать старый формат в
  `loadConfig` и переписывать по `--init` — одно место чтения, но новый код и новые случаи в проверках.
  (3) Блок для агентов: не писать в чужие файлы (как сейчас), а дать готовый текст в заметке шаблонов —
  дешево, но требует честного слова в документации; либо писать по явному ключу настроек, а не при
  установке — тогда запись в чужой файл становится осознанной.

  **Решать пользователю:** что из трёх строить, а что объявить отменённым. До решения код не тронут
  (проход документационный), а сам документ модуля называет реальность и ссылается сюда.


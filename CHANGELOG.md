# CHANGELOG

The release history of `@vernikr/size-report`. Versions are SemVer (`PLAN.md` §8.2); the version of the data
is `schema: 1` — frozen by the 1.0.0 release and changed only together with a MAJOR.

## What “the numbers changed” means

The numbers of this tool are its product rather than debug output: every metric has a source (`raw` — the size of
the git object, `min` — the compressed form, `tok` — tokens) and an honesty — an exact count or an estimate that
says so. That is why a release carries a section “What changes in the numbers”: it answers **whose numbers will
move and why**. A release after which a number moves in silence is a defect of this tool rather than a release.

The measurements in those sections are taken on the package's fixture — `fixtures/synthetic/history.bundle`,
**16 commits and 10 columns**, the state at its tip. A release's table is not a retelling: `test/changelog.test.js`
checks it against a live run of the tool, and it can be repeated by hand — clone the bundle and run
`node bin/size.js --config <settings> --data`, taking `fixtures/synthetic/config.json` as the base, the metrics
`raw`, `min` and `tok`, and the minification way `strip` or `esbuild`.

## 2.4.0 — 2026-09-15

The look of the tree and the order of the columns: what is not in the report comes after the rest with its
checkbox cleared, the columns the last commit touched stand in front, and folding a folder counts no numbers.

- **A file outside the report was a caption without a checkbox, and a folder with nothing to measure had no
  checkbox at all.** One and the same question — “why has this no number” — read differently in two neighbouring
  rows, and beside the columns such rows broke the line. Now everything outside the report has its checkbox **in
  place, cleared and out of reach**: the rows run evenly (the eye compares like with like), and being out of
  reach says that this is not the reader's choice — the reason is in the tooltip, as before. Along with that,
  everything absent from the report (folders and leaves alike) comes **after** what is in it: in a list where
  half the rows cannot be switched, the report is visible at once rather than among strangers.
- **Folding a folder counted numbers it does not change.** A click on the sign rebuilt the panel and the table
  whole — paying for the entire table in order to hide rows. Now the subtree lies in the markup and a class on
  the row hides it, while the click changes only the three things the reader sees — the class, the sign and the
  record in the memory — so the price of a fold no longer grows with the table.
- **Columns touched by the last commit come in front of the rest.** The report is rebuilt after every commit, and
  a reader's first question is what this edit brought. The mark comes from the history (`last` in the `--data`
  contract) rather than from the numbers: an edit that moved no size is an edit too. The commit taken is the one
  that touched at least one column, counting back from the top — commits past the columns (and above all the
  report itself, which the hook commits) are skipped; otherwise the mark would depend on the report's own commit,
  the same run would yield other bytes, and the hook would commit the report a second time over nothing. Inside
  each part the order is the one from the settings.

### What changes in the numbers

**Nothing.** The same engine counts with the same sensors: the release is about what is visible on the page and
in what order rather than about measurement, so the table is the one of 2.3.0 to the last cell.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.3.0 — 2026-09-15

The report describes the whole project: every tracked file becomes a column, and the tree folds.

- **The columns were a sample of the project.** With no settings file the tool took the twelve largest files —
  one per extension — and called the rest exceptions. The report counted its “total volume” over a handful of
  files, and a reader took that for the volume of the project. Now a column is **every tracked git file that can
  be measured**, and `skip` names only what cannot be one: the report itself, dependency locks, maps, built
  output, an unknown format, a file over 512 KB — and a path that is not at HEAD (it lives in the history alone,
  and there is nothing to measure in it).
- **The price is named, and it is structural** (measured then on this repository, 149 commits, 135 columns
  against 12): building the report went 2,4 s → **6,3 s** and the file 122 KB → **417 KB**; `check` — 6,1 s. The
  hook rebuilds the report after every commit, so that is the price of every commit too, and the report grows
  with the project, since every file is a row. Whoever finds it too much sets the columns by a settings file
  (`--init` gives a draft to edit: the former choice is reproduced by a list of twelve files).
- **The tree folds.** Every folder has a sign of its own (▾/▸): it answers how much of the tree is visible, while
  the checkbox answers what is counted, so they are two different targets rather than one. A fold is remembered
  between visits and **does not travel in the link**: a link is sent for the numbers, not for how someone's tree
  is laid out. The fold has a record of its own (the same report passport), and unfolding every folder removes it
  — as returning the checkboxes does.
- **The pasting of the page's program got a guard.** Module syntax is removed line by line, so a multi-line
  `import` left a tail in the page and broke it whole — the check now looks for the module's **name** in the
  pasted program rather than only for the start of a line.

### What changes in the numbers

**A column is every tracked file, so where no settings are given there will be more columns** (12 → 135 in this
repository), and with them grow the “total volume” (it was counted by columns before too) and the time of a run —
named above. The numbers below are measured on the fixture, where the columns are set by a settings file: such a
project is seen by the measurement exactly as 2.2.0 sees it, to the last cell.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.2.0 — 2026-09-15

The page's tree is the project's tree: everything is visible, and the numbers belong to what is measured.

- **Only what had become a column was visible in the tree.** With the settings derived and a dozen columns, the
  tree showed a dozen leaves and was silent about the rest: a reader saw a list of the measured rather than the
  project's tree, and deciding that files had gone missing was the easiest thing. The contract (`--data`) now
  carries a **catalogue** — every path git sees (`ls-files`) — and the tree is built from it.
- **Numbers belong to columns only, and that is visible rather than implied.** A leaf outside the report stands in
  its place but as a caption without a checkbox, and the reason is in the tooltip — of two kinds: `rule` — such a
  file cannot be a column (the report itself, a dependency lock, built output, one too large, or a format without
  text), and `choice` — it could, but was not chosen as a column (the settings choose that). The engine sets the
  mark of the reason by **the same** rules it uses to pick columns; otherwise the hint would say one thing while
  the choice did another. The report itself is named in the tree **always** — both while it is not built and while
  it is out of git: whether it is tracked is a property of the moment, and the report must not depend on it,
  otherwise the first rebuild in a fresh clone would yield other bytes and the hook would commit the report a
  second time over nothing.
- **A folder of mixed composition gets a fraction** (“2/5”: two files of the folder's five are in the report),
  while a folder that is measured whole counts as before (“5”). A folder with nothing measurable gets no
  checkbox — there is nothing to switch on in it — but it stays in place: the tree must not lie about what the
  project has.
- **The price was named, and it is what kept this release from measuring every path.** The set of columns does not
  change here, so a run did not become more expensive; what was measured then on this repository (162 columns ×
  79 rows against 12) is the price of the third metric: **16,1 s** with tokens instead of 2,4 s without. On the
  live history the full set refused then, losing an edit of a path that is not at HEAD — and that refusal turned
  out to be a defect of its own rather than a property of measuring everything (`BLOCKERS.md` §B3, closed
  2026-09-14). The next release made the change anyway (2.3.0) and named its own price there.

### What changes in the numbers

**Nothing.** The same engine counts with the same sensors: the release is about what is visible in the panel's
tree rather than about measurement, so the table is the one of 2.1.0 to the last cell.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.1.0 — 2026-09-15

The look of the page on a desktop: the numbers take the whole remaining height, the panel scrolls on its own.

- **There was emptiness under the table, and the file list set the page's height.** In a wide window both columns
  ran each with its own height (`align-items: start`), so the page's height equaled whatever the panel came to —
  measured before the fix at a window of 1440×900: the panel 883 px, the page 1097 in a 900 window, 195 px of
  emptiness under the table, and the lower files of the tree below the bottom edge (the list was moreover cut by
  its own cap of 62vh). Now the page fits the window whole: the grid's rows are named after their subject, one
  working row stretches, and the table takes the whole remaining height while the panel grows no taller than it
  and scrolls itself. On a wide screen the file list is no longer cut, so every caption of the tree is visible at
  once.
- **A click on a checkbox sent the list back to its beginning.** The panel is drawn anew, and the place one had
  scrolled to went with it, so the lower files of the tree could not be reached at all. The panel's scroll and
  the list's are now part of the view: both are remembered before a rebuild and put back after it (`panel.scrollTop`
  and its twin; confirmed in Chrome at a 1440×500 window).
- **The row of categories sticks** to the top of the panel while the tree is scrolled. So that passing files are
  not read under the sticky row, the panel's top padding moved into its first field: what scrolls is seen in the
  scroll padding too, and the band there holds the row itself rather than the names of files going by.
- **The explanation under the tree is gone**, and the font of the file captions became the one of the table's
  numbers (12,5 px): the explanation pushed the numbers away, while its meaning stands where it explains — the
  colour of a delta names the sign of a number, the way and the precision stand under the metric switches, and
  the mark of a skip is in the cell's tooltip.
- **The boundary of the wide layout is 899 px.** At exactly 900 px both halves of the styling applied to one page,
  and the cap on the table's height survived from the “narrow” half into the “wide” one — the same emptiness under
  it at one and the same window size.

### What changes in the numbers

**Nothing.** The fix is about the page's look and scrolling; the engine is the one of 2.0.2, and the page takes
numbers ready-made from it.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.0.2 — 2026-09-15

The instruction stopped promising an extra manual step and named the difference between platforms.

- **README taught installing the hook by hand.** §6 kept a line of an earlier release — “the hooks are installed
  only by `install-hook`, no ordinary run creates them” — while since 2.0.0 the installation is its own
  (`bin/postinstall.js` and the first run). The text now says what the code does and names the single exception:
  pnpm 10 does not run the scripts of dependencies (“Ignored build scripts”) — there the hook is installed by the
  first run, or the build is allowed by `pnpm.onlyBuiltDependencies` in the consumer's manifest.
- **One manual step that was invisible is named.** The first report is created but not committed (a new file in
  another's history is a person's decision): both §6 and the template `templates/README.md` say so, and from
  there on the report updates itself in commits of its own.

### What changes in the numbers

**Nothing.** The fix is the text of the instruction alone; the engine is the one of 2.0.1.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.0.1 — 2026-09-15

Where the report lands in a fresh project: `docs/size-report.html`, and the directory is created on its own.

- **The report no longer lands in the root.** The first edition of the output chose “beside the docs if the
  directory `docs` exists, otherwise in the root”: in a project that has just installed the package there is no
  directory yet, and the report turned up where nobody looks for it (measured: a fresh clone, an install from the
  registry, `docs/` absent, the file in the root). Now there is one address — `docs/size-report.html`; the
  directory is part of the address, and the one who writes the file creates it. A name from the settings still
  overrides the output.
- A check guards this: a project without settings and without `docs/` gets the report in `docs/`, has none in the
  root, and the control mode is green.

### What changes in the numbers

**Nothing.** The fix is about the file's path rather than about measurement, so the table is the one of 2.0.0.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 2.0.0 — 2026-09-15

Один отчёт вместо двух, и он же появляется сам: форма отчёта сведена к одному
файлу, а обновление — к одному решению (хук ставится сам).

- **Отчёт — один файл: самодостаточная страница `size-report.html`.** Данные,
  оформление и программа лежат в нём же; внешних ссылок нет. Прежние две формы
  (статическая таблица и рядом страница) убраны вместе с их кодом (`src/render.js`,
  `src/artifact.css`): два вывода одной истории расходились бы молча, а выбрать,
  какой верный, было бы нечем. Колонка движка — это файл, значит и отчёт — файл.
- **Запись одна: `--write [файл]`** (прежняя `--page` убрана — это ломающее
  изменение). Значение ключа пишет отчёт по названному пути (каталог создаётся сам)
  и становится его же `output`: отчёт называет себя тем путём, по которому лежит.
- **По умолчанию — `docs/size-report.html`**, если каталог `docs/` в проекте есть,
  иначе в корне. Имя больше не выводится из настроек: файл это и есть отчёт.
- **Хук ставится сам** — после постановки пакета (`bin/postinstall.js`) и при первом
  запуске в проекте. Поэтому `docs/` с отчётом появляется первым же коммитом, без
  ручного шага; ставится там, где это безопасно (обычный `.git/hooks`, нет чужого
  хука, есть чем звать инструмент, не CI), и там же молчит, где нельзя.
- Коммит отчёта виден в хуке как раньше: отдельным коммитом, только этим путём.
  Отчёт остаётся **неподвижной точкой** — список пропущенных коммитов в файл не
  идёт (он меняется от коммита самого отчёта), и хук не коммитит его бесконечно;
  читателю этот список по-прежнему доступен: `--data`, `--json`, `size explain`.

### What changes in the numbers

**Ничего.** Измерение не тронуто: те же датчики, те же способы, те же колонки. Что
меняется у потребителя — **форма файла и его путь**: `size` (проверка) на прежнем
файле будет красным, пока отчёт не пересобран, а скрипты, звавшие `--page`,
получат отказ с названным ключом. Таблица ниже та же, что у 1.3.1, до последней
клетки.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 1.3.1 — 2026-09-15

Правка раскладки страницы: на широком экране панель выбора встаёт слева от таблицы.

- **От 900 px панель — колонка слева от таблицы.** Метрики, дерево файлов и легенда
  видны одновременно с числами: прокрутка нижних строк больше не уводит управление за
  верх экрана, а таблица получает всё оставшееся по горизонтали (1060 px при окне
  1440 против 1372 у прежней раскладки в одну колонку). Узкое окно раскладку снимает:
  там столбцы снова идут друг под другом, как было.
- Раскладка — сетка на `body` (`src/page/app.css`), а не обёртка в разметке: страница
  собирается вклейкой глав, и форма страницы осталась в одном месте. Порог тот же,
  что у адаптаций: между «широко» и «узко» нет промежутка без правил.
- Ни поведение, ни артефакт, ни данные не тронуты — правка только в оформлении
  страницы (`--page`); статический артефакт (`--write`) этот выпуск не касается.

### What changes in the numbers

**Ничего.** Этот выпуск не трогает ни измерение, ни форму отчёта: изменилась
раскладка страницы, а числа считает тот же движок теми же датчиками. Таблица ниже та
же, что у 1.3.0, до последней клетки.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 1.3.0 — 2026-09-15

Выпуск выведенных настроек: чтобы получить отчёт, проект больше не обязан себя
описывать.

- **Файла настроек может не быть.** Их выводит сам инструмент — по проекту: колонками
  крупнейшие файлы, по одному от каждого расширения (иначе отчёт состоял бы из одних
  крупных `.md`, и ни один `.js` не попал бы под настоящее сжатие), журналом — первый
  знакомый (`WORKLOG.md`, `CHANGELOG.md`, …), файлом отчёта — `docs/`, если каталог есть,
  командой починки — объявленный скрипт `sizes`, а без него путь к установленному
  пакету внутри проекта, ссылкой на коммит — адрес `origin` (GitHub или GitLab: у
  остальных хозяев пусто, догадка вела бы не туда), метриками — `raw`, `min`, `tok`.
  Команда починки и ссылка берутся готовыми, а не выдуманными: её цитируют подпись
  отчёта и отказы, и зов скрипта, которого в проекте ещё нет, ответил бы «нет такого
  скрипта» ровно там, где человеку нужна работающая команда.
- **Всё, что колонкой быть не может или в неё не поместилось, названо в `skip`** (сам
  отчёт, замки зависимостей, карты, собранное): поэтому первый же `size check` полон, а не
  красный, — «пути мимо колонок» появляются от новых правок, а не от того, что проект ещё
  не настраивали. Колонка — это файл: список путей колонки движок читает как её
  переименования, поэтому «папка целиком» колонкой не бывает.
- **О выведенных настройках сказано строкой** в stderr, с готовой командой `--init` —
  она их закрепляет, и дальше их правят как обычные настройки. Закрепляется то же,
  чем проект работает без файла (вывод поверх умолчаний), поэтому смена умолчаний в
  новой версии пакета не поедет по уже настроенному проекту молча. Без закрепления
  профиль выводится на каждом запуске: числа не «поехали», но повторить прежний замер
  можно только закрепив его.
- **Отказ остался у названного файла:** `--config <файл>`, которого нет, — код 2 с той же
  починкой `--init <файл>` (опечатку в пути покрывать догадкой нельзя). У умолчательного
  имени отказа нет вовсе; коды выхода ни в одном другом случае не изменились.
- Номер **1.3.0** — по SemVer: появилась возможность, которой не было; схема данных
  (`schema: 1`) та же.

### What changes in the numbers

**У кого настройки есть — ничего.** Этот выпуск не трогает ни форму отчёта, ни счёт:
таблица ниже та же, что у 1.2.0.

**У кого настроек нет** — числа появятся там, где был отказ (код 2): их даст выведенный
профиль. Выведенное и закреплённое (`--init`) друг от друга не отличаются: файл — это тот
же профиль, только записанный. Повторить замер можно только по закреплённому: без файла
профиль выводится заново каждый запуск.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 1.2.0 — 2026-09-15

Выпуск причины, а не измерения: проверка («таблица совпадает с историей?») теперь
называет другой счёт, когда он есть, — и делает это всегда, а не только там, где
всё сошлось. Нашлось это прогулкой по собственной инструкции (`WORKLOG.md` §54),
починено по правилу «нарушение старше приближения» (`REFACTOR.md` R-4.23).

- **`size` и `size check` печатают заметку о датчике всегда.** Раньше заметка
  печаталась только при благополучном вердикте: если отчёт собран с настоящим
  минификатором, а прогон идёт без него (установка без необязательных
  зависимостей, платформа без `esbuild`), числа честно расходились, а причины
  «счёт другой» в выводе не было вовсе — читатель видел расхождение строки
  подписи и ничего о том, откуда оно.
- **Вердикт остаётся первым по важности.** Нарушение старше приближения — тот же
  порядок, что у `size check` и `size doctor`: код **4** утверждал бы, что
  расхождение объясняется датчиком, а этого никто не проверял (расхождение может
  быть и правкой мимо отчёта). Поэтому ответ в этом случае — по-прежнему **код 1**
  плюс заметка с починкой: кода выхода выпуск не меняет ни в одном случае.
- Ни сборка отчёта, ни его форма, ни смысл настроек не тронуты. Остальное в этом
  выпуске — не про поставку: выпуск по тегу из CI (R-4.24) и снятые цели по
  времени у набора проверок (R-5.8) касаются репозитория пакета, а не того, что
  устанавливают.
- Номер **1.2.0** назван владельцем пакета; по строгому SemVer содержимое —
  исправление (PATCH): новых возможностей в поставке нет.

### What changes in the numbers

**Ничего.** Таблица ниже та же, что у 1.1.0 и 1.1.1, до последней клетки: этот
выпуск меняет текст под расхождением, а не числа. Замер на фикстуре — тот же
(16 коммитов, 10 колонок), доказано не словом: артефакт (22 112 Б), страница
(59 376 Б) и оба замороженных эталона не переснимались, а `--json` и артефакт
побайтово равны эталону на фикстуре и на живой истории проекта-потребителя.

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

## 1.1.1 — 2026-09-15

Выпуск имени, а не измерения: пакет переехал в область владельца
(`@vernikr/size-report`) — имя `size-report` в реестре занято чужим пакетом, и
опубликоваться под ним было нельзя (`PLAN.md` §10). Заодно в поставку вошёл файл
лицензии, которого манифест обещал, а в дереве не было.

- **Имя пакета — `@vernikr/size-report`.** `bin` остался `size`, установка —
  `pnpm add -D @vernikr/size-report`, зов — `pnpm exec size`.
- Тот же выпуск закрывает три правки после 1.1.0: совет отказа проверяется
  исполнением, а не на слово (`REFACTOR.md` R-4.22), якорь фикстуры выведен из
  дерева в историю (R-1.5, R-3.4) и числа переименования в `PLAN.md` §10 сверены
  с фактом.
- **Имя инструмента в данных (`--data`) совпадает с именем пакета** — оно же
  входит в паспорт отчёта, от которого зависят ключ памяти страницы и якорь
  ссылки. Поэтому у отчёта, пересобранного этим выпуском, **сохранённый выбор
  читателя в браузере не подхватится один раз**: запись прошлого выпуска лежит
  под другим ключом. Числа и разметка от этого не меняются, а первый читатель и
  так видит умолчание.
- В поставку добавлен `LICENSE` (MIT) — манифест называл лицензию, а файла в
  тарболле не было.

### What changes in the numbers

**Ничего.** Это не обещание, а замер: таблица ниже снята выпуском 1.1.1 и
совпадает с таблицей 1.1.0 до последней клетки — измерение этот выпуск не трогает
вовсе, а правки лежат в имени пакета, текстах отказов и выводе якоря фикстуры.
Доказано не словом: вывод `--json` и артефакт побайтово равны замороженному
эталону на фикстуре и на живой истории проекта-потребителя, а его закоммиченная
таблица пересобирается в те же байты (`sha256 863ce3e9…`).

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

Разрезы те же, что у 1.0.0 и 1.1.0, и читаются так же: `raw` — размер объекта
git; `min` со `strip` — упрощение, под которым снят эталон паритета; `min` со
`esbuild` — то, что даёт настоящий минификатор (`minify.engine`); `tok` — словарь
`o200k_base` с `gpt-tokenizer 4.0.0`. У проекта прежние настройки означают
`strip`, поэтому обновление «само» чисел не меняет. gzip в выпуск по-прежнему не
входит (`PLAN.md` §10, D4).

## 1.1.0 — 2026-09-15

Первый выпуск после 1.0.0, и в нём **ни одной правки измерения** — только то, что
нашлось живыми прогонами после выпуска, все в ответах инструмента человеку.

- `explain` понимает то, чем коммиты зовут на самом деле: `HEAD`, ветку, тег,
  `HEAD~1`, полный и короткий sha. Раньше имя ревизии выглядело как несуществующий
  коммит («в истории нет коммита «HEAD»») — то есть отказ называл не ту причину.
  Коммит вне истории отчёта теперь отдельная причина с названным sha.
- У отказов появился **каталог и сторож** (`tools/refusals.js`): по строке на
  каждый отказ с кодом выхода и обязательными фразами, карты мест отказа держат
  числа, а две проверки делят обе половины обещания — одна вызывает отказ, другая
  требует у каждого места пункт каталога. Новый отказ не может появиться без
  проверки. Заодно исправлены шесть мест, где текст врал или молчал о починке, и
  появилась одна новая причина: **`нет git`** — раньше «git не запустился» и
  «здесь нет репозитория» назывались одним текстом с оговоркой «или», то есть не
  назывались вовсе.
- Проверка настроек отвергает колонку, у которой путь — не непустая строка
  (`"paths": [123]`): раньше такая колонка ни с чем не совпадала, а отчёт отдавал
  нули **за успех**.
- `--init` в каталоге без знакомых расширений больше не печатает «✗» при коде
  выхода 0: знак и код говорили разное.
- **Репозиторий пакета стал публичным**, поэтому установка не требует ни ключа,
  ни токена, ни шага в CI: `github:` pnpm разрешает в архив `codeload.github.com`
  по HTTPS (`WORKLOG.md` §44).

### What changes in the numbers

**Ничего.** Это не обещание, а замер: таблица ниже снята выпуском 1.1.0 и совпадает
с таблицей 1.0.0 до последней клетки — метрики, настройки по умолчанию и датчики те
же, а правки этого выпуска лежат в текстах отказов, разборе аргументов командной
строки и проверке настроек, куда измерение не заходит. Доказано не словом: вывод
`--json` и артефакт побайтово равны замороженному эталону на фикстуре и на живой
истории проекта-потребителя, а его закоммиченная таблица (211 КБ) тем же выпуском
пересобирается в те же байты (`sha256 863ce3e9…`).

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

Разрезы те же, что у 1.0.0, и читаются так же: `raw` — размер объекта git (ни от
чего, кроме него, не зависит); `min` со `strip` — умолчание, под которым снят
эталон паритета; `min` со `esbuild` — то, что даёт настоящий минификатор, если его
включить (`minify.engine`); `tok` — словарь `o200k_base` с `gpt-tokenizer 4.0.0`.
У проекта прежние настройки означают `strip`, поэтому обновление «само» чисел не
меняет; способ `esbuild` остаётся осознанным решением того, кто его включает.
gzip в выпуск по-прежнему не входит (`PLAN.md` §10, D4).

## 1.0.0 — 2026-09-14

Первый выпуск: инструмент вынесен из проекта-потребителя в отдельный пакет
(`PLAN.md` §5, шаги 0–5) — раньше он жил копией внутри чужого репозитория. Выпусков
до него не было: версия в манифесте стояла `0.0.0`, а работа шла внутри этого
репозитория (`WORKLOG.md`, `REFACTOR.md`, `PLAN.md`); номера `0.1.0`–`0.5.0` в
`PLAN.md` §12 — план выпусков, а не их история.

Версия `1.0.0` — не про объём изменений, а про заморозку: `schema: 1` данных этой
версией объявлена стабильной, и сломать её теперь можно только MAJOR-выпуском с
миграцией. Версия инструмента попадает в данные (`tool.version`), версии
минификатора и словаря — в способ получения числа, поэтому «числа этого выпуска» —
это числа с `esbuild 0.28.2` и `gpt-tokenizer 4.0.0` в тех разрезах, где они
задействованы.

### What changes in the numbers

Замер на фикстуре, состояние на HEAD (`now`), метрики `raw`, `min`, `tok`, словарь
`o200k_base`:

| File | raw | min with strip | min with esbuild | tok |
|---|---|---|---|---|
| code.js | 735 | 276 | 185 | 168 |
| modern.js | 246 | 51 | 45 | 44 |
| config.mjs | 172 | 45 | 40 | 40 |
| заметки.md | 306 | 303 | 303 | 53 |
| crlf.txt | 63 | 60 | 60 | 10 |
| package.json | 87 | 69 | 69 | 34 |
| style.css | 156 | 55 | 43 | 38 |
| table.toml | 300 | 299 | 299 | 52 |
| empty.js | 0 | 0 | 0 | 0 |
| WORKLOG.md | 446 | 439 | 439 | 101 |
| **TOTAL** | **2511** | **1597** | **1483** | **540** |

- **У проекта с прежними настройками не поедет ничего.** Существующие конфиги
  `minify.engine` не задают, а умолчание — `strip`: те же комментарии и отступы, те
  же имена, те же байты, что у инструмента до этого выпуска. Это доказано не словом:
  вывод `--json` и собранный артефакт совпадают побайтово с замороженным эталоном —
  на фикстуре и на живой истории проекта-потребителя (`fixtures/synthetic/`,
  `fixtures/parity/`, проверки `test/parity.test.js`, `test/frozen.test.js`).
- **`raw` не зависит ни от чего, кроме объекта git**: это его размер, содержимое
  файла для этой метрики не читается вовсе. Ни настройки, ни способ минификации, ни
  версия инструмента на него не влияют.
- **`min` со `esbuild` меньше**, чем со `strip`, и это единственное, что меняет
  числа, если включить настоящее сжатие: имена сокращены, пробелы убраны. На фикстуре
  итог 1597 → **1483** (−7 %), по файлам — **−33 %** на `code.js` (276 → 185) и
  **−22 %** на `style.css` (55 → 43). Для форматов, которых минификатор не берёт
  (`.md`, `.txt`, `.toml`, `.json`), число то же, что со `strip`: 303, 60, 299, 69.
  Именно поэтому метрика помечена приближением **целиком**: точность колонки
  считается по худшей клетке, а не по большинству (пометка стоит и у отдельной
  клетки — `test/minify.test.js`). Способ `esbuild` ставит `--init` новым проектам;
  перевод существующего проекта на него — осознанное решение, а не побочный эффект
  обновления.
- **`tok` — число новое, сравнивать его не с чем**: метрики не было у прежнего
  инструмента, это не «изменилось», а «появилось». Точный счёт словарём даёт на
  фикстуре **540**; та же фикстура без словаря считается оценкой по длине
  (1 токен ≈ 3 знака) и даёт **583** — число другое, поэтому оно помечено
  приближением, а прогон отдаёт **код 4**, а не зелёный успех
  (`SIZE_REPORT_NO_OPTIONAL` воспроизводит установку без необязательных
  зависимостей).
- **Без `esbuild`** `min` отступает к `strip`: те же 1597, с пометкой приближения и
  кодом 4. Числа от этого не ломаются, но и не выдаются за сжатие.
- **`gzip` в 1.0.0 не поставляется**: метрики нет ни в черновике настроек, ни в
  документации; в реестре она пока принимается, а её удаление — `PLAN.md` §10 (D4),
  изменение поведения, а не перенос.
- **Окружение машины на числа не влияет — и это тоже изменение**, относительно
  инструмента до этого выпуска: он читал пути и переводы строк так, как настроена
  машина, и на установке Git «по умолчанию» либо давал неверные числа, либо падал
  вовсе (`BLOCKERS.md` §B1, §B2, §N10). Теперь вывод одинаков в любой среде, и это
  доказывается прогоном с погашенными настройками машины (`GIT_CONFIG_GLOBAL=/dev/null`).

### Что вошло

- Три метрики: `raw` (размер объекта git), `min` (в двух способах — снятие балласта
  и настоящее сжатие через `esbuild`), `tok` (токены выбранного словаря). Числа
  абсолютные, производные (дельты, суммы, фильтры) считает страница.
- Интерактивный отчёт: дерево файлов, категории, переключение метрик, память выбора
  между открытиями и передача выбора ссылкой; страница — один самодостаточный файл,
  открывается с диска без сети.
- Команды: сборка отчёта, сверка с историей (`size check`), объяснение пропущенной
  строки (`size explain <sha>`), диагностика (`size doctor`), установка и снятие
  хука автообновления отчёта, `--init` с черновиком настроек.
- Шаблоны для подключаемого проекта: черновик настроек и описание проверки для CI.
- Сторожа, которыми проверяется не код, а обещания: паритет с замороженным эталоном,
  живая история, работа из собранного пака, утверждения документации, закрепления
  настроек git на границе вызова.

### Исправлено

- Молчание при опечатках и в несовместимых сочетаниях ключей: неизвестное слово,
  лишнее слово, два режима сразу, ключ без значения и `--json` там, где ответа в
  JSON нет, — теперь отказ с названным виновником и готовой командой, а не код 0 с
  чужой работой.
- Колонка, чей файл жил в истории и был удалён до HEAD, роняла прогон с бессмысленным
  текстом отказа; выбор пути перестал зависеть от настроек переименований
  (`BLOCKERS.md` §B3, §N8).
- Зависимость чисел от окружения машины (`BLOCKERS.md` §B1, §B2, §N10).

### Не входит в 1.0.0

- `docs/METHODS.md`, `docs/DATA-FORMAT.md`, `docs/ARCHITECTURE.md` — документация
  пакета из `PLAN.md` §8.3; сегодня роль каждого числа описана в `README.md`.
- Кэш замеров, разделение быстрого и медленного наборов проверок, профиль на истории
  в пару тысяч коммитов — `PLAN.md` §5, шаг 6.
- Удаление метрики `gzip` из реестра (`PLAN.md` §10, D4) и лицензионный файл
  (открытый вопрос §10).
- Поставка `dist/app.js` (пре-собранная программа отчёта) и публикация в npm:
  установка идёт git-зависимостью из публичного репозитория (публичным он стал
  2026-09-14, `WORKLOG.md` §44), а в npm пакет не опубликован — `PLAN.md` §8.4.
- Минификация разметки (HTML), JSX/TSX и другие семейства токенизаторов, кроме
  `openai`: у них нет своего словаря, а считать чужим — выдавать догадку за число.

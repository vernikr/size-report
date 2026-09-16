# The module's design: volume accounting as a package of its own

> Written when the tool was carved out of the Figma plugin project into a package of its own
> (`@vernikr/size-report`; the working name of this document, **size-report**, is the one that stuck).
> The move is done — what still binds are the architecture (§0, §3) and the invariants (§2), while the
> steps belong to the journal. Three requirements came with the move and are in the module today:
>
> - real minification (names shortened to one or two characters, by esbuild);
> - tokens close to reality, with the model family chosen;
> - an interactive page: metric switches (raw/min/tok), a panel with the file tree and checkboxes,
>   quick buttons by category (docs / chore / assets); what is switched off is out of the sum.

---

## 0. The decision in short

1. **What leaves.** The whole engine — reading the git history, measuring, minifying, counting tokens,
   building the report — becomes **a package of its own** that knows nothing about a concrete project. The
   project keeps the **settings file** — and may keep none at all: with no file the settings are derived
   from the project itself, and `--init` writes the derived ones out.
2. **The architectural shift.** A report used to be static HTML with the table already baked in. The new
   requirements (switches, a file tree, checkboxes) make it **interactive**, so the engine stops drawing the
   table and starts emitting **data**, while the report becomes a small program that draws the table itself,
   in the browser, over the data embedded in it. The same layer is printable (`--data`): that is what an
   agent reads instead of the picture.
3. **Measuring becomes modular.** Raw size, the size without ballast and tokens are interchangeable
   **sensors**, each with its own innards (the minifier esbuild where real compression is wanted; a tokenizer
   per model family). The registry holds four of them — `raw`, `min`, `tok` and `gzip` — the settings choose
   from the registry, and a new sensor is an entry in it rather than an edit to the core. A sensor that has
   lost an optional dependency is reported as degraded (exit code 4) instead of passing an approximation off
   as an exact number.
4. **Files are found, but a person can intervene.** The engine finds the project's files itself and sorts
   them into four categories (`code`, `docs`, `chore`, `assets`); the page offers the tree with checkboxes
   and quick buttons by category. What is switched off is out of the table and out of the sum, and a file
   that cannot be a column is excluded with a stated reason.
5. **The report enters no commit by itself.** It is built locally and opens by double-click without a
   server, and it refreshes after every commit and merge with no loop possible by construction. Whether the
   file is tracked by git is the project's decision: untracked, a rebuild leaves the history alone;
   tracked, the hook commits it as a commit of its own.

---

## 1. The boundary: what stays in the project, what leaves for the module

A hard boundary is drawn between the product (the Figma plugin) and the tool (volume accounting), which used
to be interwoven: the tool lay inside the project as one file and knew its files by name.

| Stays in the project | Leaves for the module |
|---|---|
| The product's files: the plugin's sources, interface markup, manifest, documentation — they are the **input** of the measure | All the measuring code: reading the git history, the metrics, the minifier, the tokenizer |
| The module's **settings file** (which files to watch, which categories, which model family, where to write the report) — optional, since with none the settings are derived from the project | Building the report (the interactive page) |
| A couple of lines in the project's description (the calls) | The module's tests: they live and run in the module's own repository, are not copied into the project and do not travel in the package |
| A line in `.gitignore`, or the report getting tracked | The settings draft, the note for a consumer, the CI description (the three files of `templates/`) |

**The principle:** the mechanics is never copied into the project. The project knows three things about the
module: the dependency in its package list, the optional settings file, and the call.

---

## 2. The invariants that move unchanged

The implementation holds decisions that need no review — they move as the module's contract:

1. **The source of truth is git.** Sizes come from the versions fixed in the history rather than from the
   working directory, so the report does not depend on what an editor has open. A working tree that differs
   from the history is a finding rather than a source of numbers.
2. **Every rebuild goes over the whole history instead of appending.** The report is always assembled anew —
   which makes it self-healing and idempotent.
3. **Reading is batched.** One run on a three-commit history makes ten git calls (`log`, `ls-files`,
   `ls-tree`, two `rev-parse`, three `cat-file`, `hash-object`, `status`) — and the same ten for three files
   as for ninety, measured: the count does not grow with the number of files. The raw size comes from the
   object's header, without reading the content.
4. **The same content is measured once.** The cache is per run and keyed by the blob's sha: identical
   requests and identical blobs are asked for once, and nothing is kept between runs.
5. **A commit's row cannot describe that commit.** A commit that changed only the report gets no row (the row
   would be a self-reference), and neither does a commit that moved no number.
6. **The history's completeness.** On a truncated clone the module must not quietly build a short table: it
   refuses (exit code 3) and names the fix (`git fetch --unshallow`, or `fetch-depth: 0` in CI).

---

## 3. The key shift: data and display are separated

The old generator assembled ready HTML: the table, the sums and the deltas were counted at build time and
froze in the file. The new requirements (metric switches, file checkboxes, a sum recounted on the fly) mean
that **sums and deltas are counted at view time** — which is where the split comes from:

```
        ENGINE (build time)                  REPORT (view time)
  ┌──────────────────────────┐      ┌──────────────────────────┐
  │ the git history          │      │ the interactive page     │
  │   ↓                      │      │ (data + program)         │
  │ files and categories     │      │                          │
  │   ↓                      │      │ · file tree + checkboxes │
  │ measures (raw/min/tok)   │─────▶│ · metric switches        │
  │   ↓                      │      │ · the sum recounted live │
  │ data (JSON)              │      │ · deltas and "now"       │
  └──────────────────────────┘      └──────────────────────────┘
```

- **The engine** emits *absolute* values per file and per point of history: it does not decide what to show
  and does not count a total over a chosen set. The totals named in its own text answer (the state at
  `HEAD`) are a fixed view rather than a sum over a choice.
- **The report** is one self-contained file: inside lie the data (JSON) and a small program that draws the
  table and the tree, and recounts the sums from what the reader switched on.

The gain: any future view setting (new filters, groupings) is an edit to the report's program rather than to
the engine, which stays stable.

---

## 4. The module's structure (files and folders)

One package, no inner packages. What came out is flatter than the first sketch: a folder per layer did not
happen, and the two seams that turned out to be real are stripping and the page's program.

```text
@vernikr/size-report/
├── bin/          size.js — the entry point from a terminal; postinstall.js — installing the hook
├── src/          flat, one subject per file:
│                   cli.js, args.js, modes.js     reading the call, its plan, what each mode does
│                   config.js, project.js         settings: reading and checking / deriving from the project
│                   refusal.js, locales.js        exit codes and causes / the printed words
│                   git.js, history.js, journal.js  reads with pinned settings / walking the history / the journal's sections
│                   metrics.js, strip.js, strip/, minify.js, tokens.js  the sensors and the ways to count
│                   data.js, derived.js           the page's contract / the derived text (totals, the state at HEAD)
│                   artifact.js, css.js, table.css, page/  assembling the one file, styling, the program
│                   check.js, explain.js, doctor.js, init.js, hook.js  the commands
│                   tool.js, size-table.js, optional.js, parse.js, parse-worker.js  the package's identity, the help, the lazy loading, the parser behind the stripping guard
├── templates/    size-report.config.json, README.md, ci.yml — what lands in a consumer project
└── test/         the checks of this repository (they do not travel in the package)
```

The boundary principle: **the core — git and measuring — knows nothing about a concrete project, and it reads
git through one module with its settings pinned** (`src/git.js`); that pinning, rather than an injectable
automation source, is what makes a number the same on any machine. The sketch's other idea — handing the core a
"history source" as a parameter so that it could run on a synthetic one — did not become code: the checks get
their speed from building a real repository in a temporary directory (`tools/synthetic/`, `fixtures/`), and git
is the only source the core has.

---

## 5. Files and categories (discovery and classification)

### 5.1. Discovery

The engine finds the project's files itself: the paths git reports as tracked, minus what cannot be a column.
Nothing is listed by hand. What is left out is excluded by rule and named in the report's catalog with the
reason it stands there: the report itself, dependency locks, built output, an extension the engine does not
know, and a file over the size threshold (512 KB — the guard against generated files). With no settings file
the profile is derived from the project itself, and `--init` pins the derived one.

### 5.2. Classification by category

Every file falls into exactly one category, and the categories are what the quick buttons on the page are made
of. The set of names is fixed to four, what an extension means is a table the settings may overrule:

| Category | Default extensions | What it stands for |
|---|---|---|
| **docs** | `.md`, `.markdown`, `.rst`, `.txt`, `.adoc` | descriptions, plans, journals |
| **chore** | `.json`, `.yaml`, `.yml`, `.toml`, `.ini`, `.cfg`, `.conf`, `.lock`, `.editorconfig` | settings, infrastructure |
| **assets** | `.svg`, images, fonts | static material |
| **code** | everything else | the product's sources |

A column may name its category in the settings, and then the extension table is not consulted at all; otherwise
the extension decides and an extension the table does not know is `code`.

### 5.3. Completeness and a hand on the wheel

- The engine guarantees that **no change goes unnoticed**: a commit that touched a path the engine does not
track and the settings do not declare an exception is a violation (an explicit failure), never a silent skip.
- A person can still **add or drop any file by hand** — in the settings for good, on the page for the length of
  a look.

---

## 6. The canonical data (what exactly the engine hands over)

The engine hands over one structure — the source of truth from which both the report and an agent's output are
built. The keys of the contract (`--data` hands over the contract itself, `--json` the former shape):

| Key | What it holds |
|---|---|
| `schema` | the contract's version |
| `tool` | the package's name and version |
| `report` | the passport: locale, title, heading, the artifact's path, the fix command, the journal, whether the sha is shown |
| `metrics[]` | per metric: `key`, `label`, `note`, `method`, `accuracy` |
| `categories[]` | the categories that are present, with their labels |
| `files[]` | per column: `label`, `path`, the chain of renames `paths`, `category` and how it was decided (`categoryBy`) |
| `catalog[]` | every path outside the report with the reason it is not a column (`why`: a rule, a declared exception, or null for a column) |
| `rows[]` | per commit: `sha`, `when`, `subject`, the journal's `section` or null, the commit's `href`, and `values` — one object per column with the absolute numbers |
| `now`, `last` | the state at `HEAD`, and which cells are the last change of their column |
| `approx` | which cells are approximations: a bit string per metric over the cells of `rows` and of `now` |
| `skipped[]` | the commits that got no row, each with the reason in words |

Notes:

- **Absolute values rather than deltas.** The engine keeps sizes, not differences: a difference is the display's
task, and it depends on which files the reader switched on. There is no compression into "points of change"
either: every row carries a number per column, and the page reads the ones it needs.
- **`method` and `note`** are the promised mark of information: beside every number it is visible *how* it was
obtained — which minifier version, which tokenizer, or the word "approximation".
- **Honesty is per cell, not only per column** (`approx`): the metric's `accuracy` speaks about the **worst in
the column** (one format without a minifier makes the metric approximate as a whole), while `approx` shows
which cells are approximations and which are not — under stripping `package.json` is exact, `code.js` is not.
The marks are set by the engine where the number is counted, by the same rule as the label (`pointExact`), so
the page never derives accuracy from paths and formats of its own: there is no second rule of accuracy in the
package.

An agent reads the same data through the "hand over the data" mode rather than parsing the layout.

---

## 7. The metrics: minification and tokenization

### 7.1. The sensor's interface

A sensor is an entry of the registry declaring:

- what it needs (only the size of a version of the file, or its content);
- how the number is counted;
- the human-readable way it was obtained (`method`, with the tool's version inside where there is one — esbuild,
  the tokenizer), which is what makes the number reproducible;
- how honest the number is (`accuracy`, plus a `note` for the reader).

The first version's set is three of them (`raw`, `min`, `tok`); the registry holds a fourth, `gzip`, which the
settings may switch on — a sensor is an entry rather than an edit to the core.

### 7.2. `raw` — the raw size

The file as it is. Taken from the size of the git object: the content is not read, which makes it the cheapest
metric.

### 7.3. `min` — the size without ballast

The first version's "minified" size is not minification but a cosmetic removal of comments and indentation
(names are not shortened), so the metric is counted in two ways and **says which one it used**:

- **the default is stripping** — comments and indentation go, names stay. For JavaScript the stripping is
  guarded: the result has to parse, or the guard refuses rather than hand over a count of something that is no
  longer the same program.
- **real compression by esbuild** is switched on in the settings per extension: the library is called through
  its JS API (`transformSync`, `minify: true`, UTF-8, no legal comments), which keeps one service process for
  the whole run instead of paying for a start per cell. Its loaders are `js`, `ts` and `css`; there is **no
  markup minifier**, so HTML goes through stripping and is marked as an approximation.
- An unfamiliar format is stripped the same way — **but it has to say so**: the word goes into `method` and
  stands beside the number on the page, which is what keeps a simplification from passing as real compression
  (§6, §7.1).

Consequences:

- esbuild and the tokenizers are **optional** dependencies of the package. The engine stays usable without them:
  the count falls back to stripping and the lost sensor is reported (exit code 4), so an approximation never
  travels as an exact number; `raw` works always.
- Minification is counted **per file** (files are never bundled into one): what is measured is the size of a
  source.
- The minifier's settings (`minify.engine`, `minify.ext`, `minify.guard`) are part of what a number means, and
  the engine's version is named in `method`.

### 7.4. `tok` — tokens with the model family chosen

Tokens are counted **by the source text** — what a model really reads — and not by the minified one. The family
is chosen in the settings (`tokens.family`, `tokens.encoding`); one family is wired today:

| Family | How it is counted | How honest the number is |
|---|---|---|
| **openai** (`gpt-tokenizer`, `o200k_base` / `cl100k_base`) | by the tool's dictionary | exact |
| without the dictionary | an estimate by length (about 3 characters per token, measured on this repository's own texts) | **approximate** (marked), and for Latin script it overstates |
| binary formats (a picture, a font) | counted by bytes, since a tokenizer would split them into anything at all | **approximate** (marked) |

The position is the load-bearing part: **the tool must not pass an approximation off as an exact number.** Every
count carries its level of trust beside the number, just as the way of minification does.

Adding a family is adding an entry to the registry, which is why the settings name a family rather than a flag.
The family is chosen in the settings rather than on the page: tokenization happens **at build time**, so the
report stays self-contained (it opens by double-click, with no network and no heavy program inside). The
alternative — a tokenizer inside the page, counting in the browser — is possible, but would inflate the report
with a dictionary and complicate it; deferred.

---

## 8. Отчёт: интерактивная страница

### 8.1. Устройство файла отчёта

Отчёт — это **один файл**, который открывается двойным щелчком и без сервера.
Внутри три части, собранные воедино:

```html
<!doctype html>
<html>
<head> …стили… </head>
<body>
  <div id="app"></div>                          <!-- сюда рисуется всё -->
  <script type="application/json" id="data">…данные (§6)…</script>  <!-- данные -->
  <script>…программа отчёта…</script>            <!-- поведение -->
</body>
</html>
```

Программа отчёта — это собранный заранее небольшой скрипт (без внешних библиотек,
чтобы работало офлайн), который модуль «вклеивает» в файл вместе с данными.

### 8.2. Элементы управления (что просил пользователь)

1. **Переключатели метрик** — какие числа показывать в таблице: сырой размер,
   токены, минифицированный. Каждая метрика включается/выключается отдельно;
   столбцы таблицы подстраиваются.
2. **Левая панель — дерево файлов.** Отражает реальную структуру папок проекта.
   У каждого файла — чекбокс. Снятый чекбокс убирает файл из таблицы **и из
   расчёта общей суммы**.
3. **Быстрые кнопки-переключатели по категориям** — включить/выключить сразу все
   файлы категории: документация, служебные, ресурсы (и «код/прочее»). Кнопка
   действует на чекбоксы дерева, не на сами данные.
4. ~~**Переключатель семейства моделей** для метрики токенов (среди
   предвычисленных).~~ ❌ **Отменено 2026-09-14** (`PLAN.md` §4.8.4, шаг 4): страница
   получает готовые числа и сама не считает ничего, а словарь другого семейства
   ей нечем применить; предвычислить все семейства — платить временем сборки за
   числа, о которых могут и не спросить. Выбор живёт в настройках запуска
   (`tokens.family`, `tokens.encoding`), а страница его **называет**: способ
   каждой метрики виден под переключателями текстом, рядом с переключателем —
   точное число или приближение.

### 8.3. Как устроен пересчёт

Правило: **«итого» и дельты всегда считаются по текущему выбору** (какие файлы
включены × какие метрики включены):

- значение файла в строке — из «точек изменения» (§6);
- дельта файла в строке — разность его значения в этой строке и в предыдущей;
- общая сумма — сумма по всем *включённым* файлам;
- выключение файла или целой категории немедленно пересчитывает и сумму, и дельты,
  и «текущий размер» в верхней строке.

Всё это происходит мгновенно в браузере (данные уже загружены), без повторного
обращения к git.

### 8.4. Память настроек просмотра

Выбор пользователя (какие метрики и файлы включены) запоминается **в браузере**
(между открытиями). Это «настройки просмотра», а не настройки проекта: они не
влияют на файл настроек и не попадают в git (отчёт и так вне git).

---

## 9. Настройки модуля

Настройки — это единственное, что проект знает о модуле. Они:

- имеют **формальную схему** (редактор и агент получают подсказки и проверку);
- генерируются командой инициализации, а не пишутся вручную;
- поддерживают миграцию при обновлении формата.

Смысловые разделы настроек:

| Раздел | Что задаёт |
|---|---|
| что следить | правила включения/исключения файлов, порог «не учитывать слишком большие» |
| категории | правила классификации файлов по категориям (для быстрых кнопок) |
| метрики | какие датчики считать: сырой размер, минифицированный, токены |
| минификация | выбор минификатора и его точных настроек |
| токены | какое семейство моделей (или несколько) считать |
| отчёт | куда класть файл отчёта, заголовок, язык |
| журнал | (опционально) связь коммитов с разделами журнала проекта |

---

## 10. Производительность и кэш

- **«Сырой» размер** не требует чтения содержимого — дешевле всего.
- **Минификация и токенизация** требуют содержимого и стоят дороже. Результат
  кэшируется по ключу **«содержимое файла + датчик + версия алгоритма»**. Так как
  содержимое в git адресуется своим хешем, одинаковые версии файла не считаются
  повторно (откаты, повторные слияния, файл, не менявшийся в сотне коммитов).
- Версия алгоритма в ключе кэша гарантирует: если мы обновили минификатор или
  токенизатор, старые «закешированные» числа не подмешаются к новым.
- Минификатор вызывается **внутри процесса** (как библиотека), а не внешней
  командой — это снимает накладные расходы на запуск.
- Для крупных историй предусмотрен кэш на диске (в служебной папке, вне git), чтобы
  повторный запуск был быстрым.

---

## 11. Обновление отчёта: автоматически, с защитой от зацикливания

- Отчёт обновляется **автоматически при каждом коммите** (через штатный механизм
  git, запускающий действие после коммита — «хук»), который устанавливается одной
  командой.
- **Зацикливание в норме невозможно** по двум причинам: (1) отчёт исключён из git,
  поэтому его пересборка не порождает нового коммита; (2) хук **никогда сам не
  создаёт коммиты** — он только пересобирает локальный файл отчёта.
- **Элементарная страховка всё равно предусмотрена**: защита от повторного входа
  (если обновление уже идёт, второе не запускается) и от вложенного запуска самого
  себя. Автоматику можно отключить и пересобирать отчёт явной командой.

---

## 12. Команды модуля (поверхность для человека и агента)

```text
size init            найти файлы, создать настройки, исключить отчёт из git,
                     предложить команды запуска; повторный запуск = «уже настроено»

size measure         посчитать данные (выдать как JSON — для агента/CI)

size render          собрать самодостаточный файл отчёта

size check           проверить настройки и окружение: полная ли история,
                     покрыты ли все файлы, установлены ли минификатор/токенизатор

size doctor          диагностика одним JSON-ответом (для агента)

size explain <id>    почему у конкретного коммита нет строки
```

Команда `check` в новой схеме проверяет не «совпадает ли отчёт с историей» (отчёт
больше не хранится в git), а **готовность окружения и корректность настроек** —
это то, что нужно ИИ-агенту, чтобы не «гадать».

---

## 13. Связь с ИИ-агентами

Поскольку проект ведёт ИИ-агент, модуль обязан «разговаривать» с ним машиночитаемо:

- данные — как JSON, агент читает числа, а не вёрстку;
- понятные коды завершения (всё хорошо / плохие настройки / неполная история /
  не установлен минификатор), чтобы агент ветвился по коду, а не по тексту ошибки;
- текст ошибки содержит **готовую команду починки**;
- при установке модуль **сам вписывает в файл инструкций проекта** (для агентов)
  короткий блок «здесь подключён size-report, команда проверки — …, починки — …»,
  чтобы агент в следующей сессии узнал об инструменте из уже читаемого им файла;
- команда `doctor` даёт агенту одним вызовом ответы, которые иначе он искал бы
  полчаса.

---

## 14. Тестирование

Тесты модуля **едут вместе с модулем** (не копируются в проект). Ключевые подходы:

- **Синтетическая история.** В тестах строится маленький временный репозиторий с
  заданной историей (коммиты, переименования, слияния, удаления), и на нём
  проверяется весь движок — быстро и без реального проекта.
- **Эталонные («золотые») результаты.** Для фиксированных входов хранятся эталонные
  числа и даже эталонный файл отчёта; тест ловит любое «незаметное» изменение.
- **Тесты на ловушки:** не-английские имена файлов, переносы строк, двоичные файлы,
  комментарии, похожие на деление, слияния, «обрезанная» история.
- **Тесты минификатора:** что переименование переменных действительно происходит,
  что результат воспроизводим от версии к версии, что для незнакомого формата
  ставится пометка «приближение».
- **Тесты токенизатора:** точное совпадение с эталонными подсчётами для того
  семейства, где точность возможна; явная пометка «приближение» для остальных.

---

## 15. План переноса (по шагам, каждый — самостоятельная ценность)

1. **Вынести движок в пакет как есть** (без новых метрик): git-чтение, «сырой»
   размер, текущее «косметическое» упрощение, сборка статичного отчёта. Проект
   начинает пользоваться пакетом вместо файла внутри себя.
2. **Разделить «данные» и «отображение»:** движок начинает выдавать JSON, отчёт
   становится интерактивной страницей с деревом файлов, чекбоксами, переключателями
   метрик и пересчётом суммы. На этом шаге «минифицированный» — пока упрощение.
3. **Подключить настоящую минификацию** (esbuild) с пометкой способа; старое
   упрощение переводится в запасной режим с пометкой «приближение».
4. **Подключить токенизацию** с выбором семейства моделей и честной пометкой
   точности.
5. **Довести интеграцию:** автоматическое обновление по коммиту, `check`/`doctor`,
   блок для агентов, шаблон CI.

Каждый шаг — отдельный выпуск, ничего не ломающий.

---

## 16. Открытые вопросы (не блокируют, решаются по ходу)

- **Точное имя пакета** и стоит ли публиковать его в публичный реестр или держать
  приватно.
- **Конкретный токенизатор для DeepSeek/Claude** — использовать ли точные словари
  там, где они появятся, или оставить честное приближение.
- **Считать ли токены для всех трёх семейств сразу** по умолчанию или только для
  выбранного (влияет на время сборки).
- **Границы категории «ресурсы»**: что относить к «строковым» ресурсам в проектах,
  где файлы локализации устроены по-разному.
- **Порог «слишком большие файлы не минифицировать»** — значение по умолчанию.

---

## 17. Что сознательно НЕ делаем в первой версии

- Сжатый размер (gzip/brotli) — зарезервировано, но не реализуем (решение
  пользователя «на развитие»).
- Ограничения/блокировки роста (только показываем; уведомления — на будущее).
- Токенизация в самом браузере (считаем на этапе сборки — см. §7.4).
- Централизованное управление многими проектами (первая версия — один проект).
- Поддержка платформ, отличных от основной (закладываем переносимость, но
  реализуем основную платформу).
/* The catalogue of refusals: what the tool says when it declines to work.
 *
 * **Why it is a file of its own.** A refusal is an answer to a person, and the answer must be
 * true: the named cause matches what happened, and the command it offers exists. Prose cannot
 * promise that, and a live run proved it — a false or empty cause four times in a row, every time
 * by accident. Hence one line per refusal, and two checks over two halves of the promise:
 * `test/refusals.test.js` **calls** the refusal and compares it with what was promised, while
 * `test/refusals-catalog.test.js` reads the sources and requires **every refusal site to have an
 * entry** — the maps `SITES` (throws) and `PRINTED` (printed without an exception). A new site
 * without an entry turns the run red: a refusal cannot appear without a check.
 *
 * **What "said what was promised" means.** `must` lists the phrases whose absence means the text
 * started lying or stopped helping: the cause is named but the culprit is not; the fixing command
 * is gone; a hint about the wrong thing arrives instead of a cause. The phrases are compared word
 * for word, so they are the agreement about the text.
 *
 * `truth` is one Russian line per case: what exactly this refusal owes the person. No machine
 * checks it (it is meaning, not a substring) — it exists so that the author of a new refusal cannot
 * write it without thinking.
 *
 * **Three ways to check.**
 *   - `scenario` — the refusal is called by a run and compared with its code and phrases: in a
 *     clone of the fixture, in an empty directory or in a prepared scenario (their list and device
 *     live in `test/refusals.test.js`).
 *   - `coveredBy` — the refusal needs heavy preparation (its own commit in a clone), and another
 *     check already guards it: the catalogue names the file and the phrases that check asserts. So
 *     "who checks this" stays no guess, and a check that disappears is visible — the file, or the
 *     phrase in it, will be gone.
 *   - `uncatchable` — nothing can make the refusal happen in a check. There is exactly one in the
 *     set, and the reason is stated: that is the honest answer to what remains with a person.
 *
 * **What the catalogue does not take.** Wording outside `must` (meaning and tone), the completeness
 * of an explanation, the truth of what a person sees in `--json`, and the "!" mark — that one is a
 * remark rather than a refusal (an estimate instead of an exact count, derived settings, a draft
 * without columns), and the catalogue counts it as no refusal. What the mark does to the run's code
 * is no business of the catalogue either: the sensor note turns it into code 4, the other two leave
 * the verdict as it was. That remains with the person, and `test/refusals.test.js` says so in its
 * own header rather than assuming it.
 */

/* Refusal sites that throw: a cause (`refuseCause`) or a code (`refuse(EXIT.…)`), and how many
 * such sites the sources hold. The number is no decoration: a new site with an already declared
 * cause changes it and turns a check red, so its author will look at the catalogue and write the
 * entry. `src/refusal.js` does not count — it is the mechanism of refusal, not a place where the
 * tool refuses. */
export const SITES = {
  // command-line grammar (src/args.js)
  'unknown flag': 1,
  'repeated flag': 1,
  'flag without a value': 1,
  'two modes at once': 1,
  'incompatible flag': 2,
  'extra word': 3,
  'unknown command': 1,
  'command and mode': 1,
  'no commit': 1,
  'no JSON answer': 1,
  'two answers at once': 1,
  // the settings draft (src/init.js)
  'config already exists': 1,
  // settings and the project (src/config.js)
  'git missing': 1,
  'not a git repository': 1,
  'no settings file': 1,
  'settings not parsed': 1,
  'settings invalid': 1,
  // history (src/explain.js, src/git.js)
  'no such commit': 1,
  'ambiguous commit': 1,
  'commit outside the history': 1,
  'EXIT.SHALLOW': 1,
  // the hook (src/hook.js)
  'foreign hook': 2,
  'foreign core.hooksPath': 1,
  'no way to invoke the tool': 1,
  // measurement (src/strip/guard.js, src/minify.js)
  'file is not JavaScript': 1,
  'minifier did not parse': 1,
  // the tree comparison (src/history.js) — a code, not a cause: this is a divergence, not a
  // wrong call
  'EXIT.VIOLATION': 2
};

/* Refusals that print and return a code instead of throwing: their mechanism is another one (the
 * "✗" mark plus an exit code), so their own map counts them. `src/hook.js` and `src/doctor.js` are
 * here too, though not as refusals to a person: the first writes to the hook's journal, the second
 * prints a mark for its own verdict and for each action finding. They sit in the map so that a new
 * "✗" in those files cannot slip through in silence, not because it is a refusal. */
export const PRINTED = {
  'src/cli.js': 2,
  'src/modes.js': 2,
  'src/check.js': 1,
  'src/doctor.js': 2,
  'src/hook.js': 4
};

/* Placeholders in the output: substitutions in `args` (paths and names the check itself creates).
 * They live here rather than in the check, so that the catalogue reads as an agreement. */
export const PLACEHOLDER = '@';

/* The sign of advice in the output: a marker and everything after it to the end of the line. The
 * markers are the words a refusal says "do this" with: `fix:`, `create it:`, `build it:`, and for a
 * truncated history `locally:` and `in CI:`. Advice is taken out of the output by them, so new
 * advice inside an existing refusal is visible to a check rather than to an eye alone: a case that
 * printed advice owes a declaration.
 *
 * **The Russian markers stay while the modules still print them** (the string work translates a
 * module at a time, `docs/plans/2026-09-16-i18n-english/`): the tolerance is a fact about the tree
 * rather than a debt marker, and the subplan that translates the last module printing advice
 * removes the Russian alternatives. The English ones carry a word boundary: without it the marker
 * `fix` would be found inside `prefix:` and a message with no advice would look as if it had one.
 *
 * The border is said out loud: no marker, no line to check. So advice added without a marker has to
 * be written with one, and the advice of **non**-refusals (a successful `explain`, the `--init`
 * hint, `doctor` findings) never enters the catalogue: their own checks, named in the header of
 * `test/refusals.test.js`, hold them. */
const ADVICE_LINE = /(?:починка|создайте его|соберите её|локально|в CI|\bfix|\bcreate it|\bbuild it|\blocally|\bin CI): (.+)$/;

export function adviceOf(out) {
  return out.split('\n').map((l) => (l.match(ADVICE_LINE) || [])[1])
    .filter((s) => s !== undefined).map((s) => s.trim());
}

/* One line per refusal, ordered by groups as in `CONFIG_CAUSES`.
 *
 * `advice` is the advice of this refusal, and every case has one even when there is none
 * (`advice: []`): a refusal without advice is a promise too, and it is checked.
 *   - `run` — the advice is a command, and it is **run** in the state that printed it: `expect` is
 *     the code it must give, `mustFix` means the refusal has to be gone after it (none of the `must`
 *     phrases in the new output), `inClone` runs it in an own copy of the fixture (the advice writes
 *     into the project), `inEmpty` in an empty repository, `env` gives it its own environment.
 *     `args` is the shape of the call (`cliCommand`), `text` a ready line from the output (that is
 *     how git and a command from the project's settings are called).
 *   - `template` — a shape with a substitution (`<файл>`, `<коммит>` — Russian, as the advice prints
 *     it): there is nothing to run, a person does the substituting, and what is checked is that the
 *     names of commands and flags in the shape exist.
 *   - `manual` — the advice is not a command but an action of a person: `why` says why it cannot be
 *     run. When the advice names a checkable alternative, the field `works` checks it — in the same
 *     words as `run`.
 *   - `coveredBy` — another check runs the advice: the file and the line in it are named. */

export const CASES = [
  { key: 'unknown flag', scenario: 'fixture', args: ['--wite'], code: 2,
    must: ['unknown flag "--wite"', '--help'],
    truth: 'названо то слово, которое человек набрал, а не похожее, и есть команда',
    advice: [{ kind: 'run', args: ['--help'], expect: 0 }] },
  { key: 'repeated flag', scenario: 'fixture', args: ['--config', '@config', '--write', '--write'], code: 2,
    must: ['the flag "--write" is named twice'],
    truth: 'назван именно повторённый ключ',
    advice: [{ kind: 'run', args: ['--help'], expect: 0 }] },
  { key: 'flag without a value', scenario: 'fixture', args: ['--config'], code: 2,
    must: ['the flag "--config" has no value', '--config <file>'],
    truth: 'сказано, что не хватает значения, и как его задать',
    advice: [{ kind: 'template', args: ['--config', '<file>'] }] },
  { key: 'two modes at once', scenario: 'fixture', args: ['--config', '@config', '--write', '--data'], code: 2,
    must: ['two modes at once: "--write" and "--data"', 'fix: '],
    truth: 'названы оба режима, потому что выбор из них — выбор человека',
    advice: [{ kind: 'run', args: ['--config', '@config', '--write'], expect: 0, inClone: true }] },
  { key: 'incompatible flag', scenario: 'fixture', args: ['--config', '@config', '--force'], code: 2,
    must: ['"--force" works only with "--init"', 'fix: '],
    truth: 'сказано, с чем ключ работает, и это верно',
    advice: [{ kind: 'run', args: ['--init', '--force'], expect: 0, inClone: true }] },
  { key: 'incompatible flag', scenario: 'fixture', args: ['--init', '@draft', '--config', '@config'], code: 2,
    must: ['"--init" has a file of its own', '"--config" names the settings of the project'],
    truth: 'объяснена разница между двумя файлами, а не просто «нельзя»',
    advice: [{ kind: 'template', args: ['--init', '<file>'] }] },
  { key: 'extra word', scenario: 'fixture', args: ['--config', '@config', '--write', 'out.html', 'extra'], code: 2,
    must: ['the extra word "extra"', '"--write" takes one value'],
    truth: 'лишним названо слово человека, а не значение режима',
    advice: [{ kind: 'run', args: ['--config', '@config', '--write', 'out.html'], expect: 0, inClone: true }] },
  { key: 'extra word', scenario: 'fixture', args: ['--config', '@config', 'check', 'extra'], code: 2,
    must: ['the command "check" takes no arguments', '"extra" is extra'],
    truth: 'виновато лишнее слово, и оно названо',
    advice: [{ kind: 'run', args: ['--config', '@config', 'check'], expect: 1, inClone: true }] },
  { key: 'extra word', scenario: 'fixture', args: ['--config', '@config', 'explain', 'HEAD', 'HEAD~1'], code: 2,
    must: ['"explain" takes one commit', 'fix: '],
    truth: 'сказано, что коммит один, а не «слишком много слов»',
    advice: [{ kind: 'template', args: ['--config', '@config', 'explain', '<commit>'] }] },
  { key: 'unknown command', scenario: 'fixture', args: ['sizes'], code: 2,
    must: ['unknown command "sizes"', '--help'],
    truth: 'слово названо командой не зря: человек звал именно команду, и ему нужен их список',
    advice: [{ kind: 'run', args: ['--help'], expect: 0 }] },
  { key: 'command and mode', scenario: 'fixture', args: ['--config', '@config', 'check', '--write'], code: 2,
    must: ['the command "check" and the mode "--write"', 'fix: '],
    truth: 'названы оба виновника: человек считает их одним и тем же, а они разное',
    advice: [{ kind: 'run', args: ['--config', '@config', 'check'], expect: 1 }] },
  { key: 'no commit', scenario: 'fixture', args: ['--config', '@config', 'explain'], code: 2,
    must: ['the command "explain" needs a commit', 'a revision name'],
    truth: 'сказано, чем коммит можно назвать, а не только «нужен коммит»',
    advice: [{ kind: 'template', args: ['--config', '@config', 'explain', '<commit>'] }] },
  { key: 'no JSON answer', scenario: 'fixture', args: ['--config', '@config', 'install-hook', '--json'], code: 2,
    must: ['the command "install-hook" has no answer in JSON', 'fix: '],
    truth: 'сказано, что ответа нет именно у этой команды',
    advice: [{ kind: 'run', args: ['--config', '@config', 'install-hook'], expect: 0, inClone: true }] },
  { key: 'two answers at once', scenario: 'fixture', args: ['--config', '@config', '--write', '--json'], code: 2,
    must: ['"--json" and the mode "--write"'],
    truth: 'сказано, что «--json» — форма ответа, а режим — то же самое своими словами',
    advice: [{ kind: 'run', args: ['--config', '@config', '--write'], expect: 0, inClone: true }] },

  { key: 'no settings file', scenario: 'fixture', args: ['--config', '@missing'], code: 2,
    must: ['no settings file', 'create it: ', '--init'],
    truth: 'назван путь, по которому искали, и команда, которая файл создаст',
    advice: [{ kind: 'run', args: ['--init', '@missing'], expect: 0, mustFix: true }] },
  { key: 'settings not parsed', scenario: 'fixture', args: ['--config', '@broken'], code: 2,
    must: ['cannot parse', 'fix: edit'],
    truth: 'причина от синтаксиса JSON, а не «что-то не так с настройками»',
    advice: [
      { kind: 'manual', text: 'edit @broken',
        why: 'правка файла настроек — действие человека: что в нём было задумано, инструмент не знает' },
      // The advice about `--init` in an empty directory is verified where it is given: a draft there
      // comes out without columns and without a refusal (the "!" mark and code 0).
      { kind: 'run', args: ['--init'], expect: 0, inEmpty: true }
    ] },
  { key: 'settings invalid', scenario: 'fixture', args: ['--config', '@empty'], code: 2,
    must: ['no columns are given', 'fix: edit'],
    truth: 'названо, какой именно ключ неверен, а не «настройки плохие»',
    advice: [{ kind: 'manual', text: 'edit @empty',
      why: 'правка настроек — за человеком: какие файлы важны, знает только проект' }] },
  { key: 'settings invalid', scenario: 'fixture', args: ['--config', '@badtype'], code: 2,
    must: ['has to be {label, paths:', 'fix: '],
    truth: 'путь, который не имя файла, — отказ, а не колонка с нулём строк за успех',
    advice: [{ kind: 'manual', text: 'edit @badtype',
      why: 'правка настроек — за человеком: что вместо числа он имел в виду, инструмент не знает' }] },
  { key: 'not a git repository', scenario: 'barren', args: [], code: 2,
    must: ['git sees no repository here', 'the directory I look in is ', 'git init'],
    truth: 'сказано, куда смотрел инструмент и что делать, если истории ещё нет',
    advice: [{ kind: 'run', text: 'git init', expect: 0, mustFix: true }] },
  { key: 'git missing', scenario: 'no-git', args: [], code: 2, env: { PATH: '/nonexistent' },
    must: ['git did not start: it is not in PATH', 'install git'],
    truth: 'два разных тупика — «git не нашёлся» и «репозитория нет» — названы врозь, а не одним текстом с оговоркой «или»',
    advice: [{ kind: 'manual', text: 'install git (https://git-scm.com)',
      why: 'установка программы — действие вне проекта: git в этой среде есть, а убирать его значило бы убирать то, чем живёт сам набор' }] },
  { key: 'config already exists', scenario: 'draft-twice', args: ['--init', '@draft'], code: 2,
    must: ['config already exists', 'overwrite it with a draft: ', '--force'],
    truth: 'сказано и как править, и как перезаписать — потому что решает человек',
    // The advice names the very file under discussion: the draft in @draft already exists, and it is
    // `--force` that overwrites it.
    advice: [{ kind: 'run', args: ['--init', '@draft', '--force'], expect: 0 }] },

  { key: 'no such commit', scenario: 'fixture', args: ['--config', '@config', 'explain', 'maser'], code: 2,
    must: ['не имя ревизии и не начало sha', 'git log'],
    truth: 'отказ говорит про имя, а не про коммит: коммита тут никто не терял',
    advice: [{ kind: 'run', text: 'git log --oneline', expect: 0 }] },
  { key: 'ambiguous commit', scenario: 'fixture', args: ['--config', '@config', 'explain', '9'], code: 2,
    must: ['неоднозначен', 'починка: назовите больше знаков'],
    truth: 'показаны подходящие коммиты: выбрать из них может только человек',
    advice: [{ kind: 'manual', text: 'назовите больше знаков',
      why: 'подставить за человека один из подходящих коммитов значило бы угадать: какой из них он звал, знает только он' }] },
  { key: 'commit outside the history', scenario: 'side-branch', args: ['--config', '@config', 'explain', 'side'], code: 2,
    must: ['нет в истории отчёта', 'починка: '],
    truth: 'сказано, что коммит есть и он в другой ветке, а не «такого коммита нет»',
    advice: [{ kind: 'run', text: 'git log --oneline', expect: 0 },
      { kind: 'run', text: 'git log --all', expect: 0 }] },
  { key: 'EXIT.SHALLOW', scenario: 'shallow', args: ['--config', '@config', '--write'], code: 3,
    must: ['история обрезана (shallow clone)', 'git fetch --unshallow', 'fetch-depth: 0'],
    truth: 'названы обе починки: для себя и для CI',
    advice: [
      { kind: 'run', text: 'git fetch --unshallow', expect: 0, mustFix: true },
      { kind: 'manual', text: 'fetch-depth: 0',
        why: 'правка файла CI — за человеком; сама строка лежит в шаблоне и её стережёт `test/templates.test.js`' }
    ] },

  { key: 'foreign hook', scenario: 'foreign-hook', args: ['--config', '@config', 'install-hook'], code: 2,
    must: ['уже есть и поставлен не этим инструментом', 'перезаписи чужого файла нет намеренно'],
    truth: 'объяснено, почему инструмент не перезаписывает, и что сделать вместо этого',
    advice: [{ kind: 'coveredBy', file: 'test/hook.test.js', text: 'hook-run' }] },
  { key: 'foreign hook', scenario: 'foreign-hook', args: ['--config', '@config', 'uninstall-hook'], code: 2,
    must: ['поставлен не этим инструментом — не трогаю', 'починка: '],
    truth: 'сказано, что снятие тоже не трогает чужое',
    advice: [{ kind: 'manual', text: 'уберите из него строку с «hook-run»',
      why: 'правка чужого хука — за человеком: инструмент его намеренно не трогает, а совет говорит, что оттуда убрать' }] },
  { key: 'foreign core.hooksPath', scenario: 'hooks-path', args: ['--config', '@config', 'install-hook'], code: 2,
    must: ['задан core.hooksPath', 'починка: '],
    truth: 'назван каталог из настроек и причина, по которой в него не лезут',
    advice: [{ kind: 'coveredBy', file: 'test/hook.test.js', text: 'hook-run' }] },
  { key: 'no way to invoke the tool', scenario: 'src-copy', args: ['--config', '@config', 'install-hook'], code: 2,
    must: ['не нашлось чем звать инструмент', 'поставьте пакет зависимостью'],
    truth: 'сказано, что хук ставить нечем (а не «хук будет молчать»: его ещё нет)',
    // The advice names an install inside the project rather than the package name: a call by the
    // name goes to the registry, which serves a revision the project never pinned.
    advice: [{ kind: 'manual', text: 'поставьте пакет зависимостью проекта',
      why: 'установка — сеть и чужой проект: исполняет её человек, а проверено то, что можно — совет называет ссылку из манифеста, а не имя из реестра' }] },

  /* The parse guard and the minifier need a commit of their own in a clone — `test/module.test.js`
   * guards them, carrying the same case to the end. */
  { key: 'file is not JavaScript', coveredBy: 'test/module.test.js',
    must: ['не JavaScript'],
    truth: 'сказано, что дело в исходном тексте, а не в стриптере, и что правится',
    advice: [{ kind: 'coveredBy', file: 'test/module.test.js', text: 'уберите это расширение из minify.guard' }] },
  { key: 'minifier did not parse', coveredBy: 'test/module.test.js',
    must: ['esbuild не разобрал'],
    truth: 'назван и файл, и минификатор, и выход, который этой причине и отвечает: расширение под упрощение, а не смена минификатора (та передала бы файл гарду)',
    advice: [{ kind: 'coveredBy', file: 'test/module.test.js', text: 'задайте этому расширению упрощение в minify.ext' }] },

  /* Comparing with the tree needs a lost edit — `test/disk.test.js` guards it. */
  { key: 'EXIT.VIOLATION', coveredBy: 'test/disk.test.js',
    must: ['перенос состояния между коммитами пропустил правку'],
    truth: 'сказано, что потерялась правка при переносе, и что пересборка тут ни при чём: разбор назван',
    advice: [{ kind: 'coveredBy', file: 'test/disk.test.js', text: 'пересборкой это не лечится' }] },
  { key: 'EXIT.VIOLATION', coveredBy: 'test/disk.test.js',
    must: ['правка есть только на диске'],
    truth: 'сказано, что правка не потерялась, а не закоммичена, и как её вернуть',
    advice: [{ kind: 'coveredBy', file: 'test/disk.test.js', text: 'git checkout -- ' }] },

  /* Refusals that print and return a code (the `PRINTED` map). */
  { id: 'no size table file', scenario: 'fixture', args: ['--config', '@notable'], code: 1,
    must: ['size table: no file docs/nope.html', 'build it: '],
    truth: 'назван файл, который не найден, и команда, которая его соберёт',
    // The advice quotes `fixCommand` from the settings, so the case itself carries a setting naming
    // the real command (@fixNotable): otherwise there would be nothing to check.
    advice: [{ kind: 'run', text: '@fixNotable', expect: 0, mustFix: true, inClone: true }] },
  { id: 'size table diverged from the history', scenario: 'drift', args: ['--config', '@drift'], code: 1,
    must: ['diverged from the git history', 'fix: ', 'in a commit of its own'],
    truth: 'сказано, где именно расходится, и что после сборки нужен отдельный коммит',
    advice: [
      { kind: 'run', text: '@fixDrift', expect: 0, mustFix: true },
      { kind: 'manual', text: 'and commit docs/size-table.html',
        why: 'коммит отчёта — за человеком: инструмент не коммитит за него (кроме хука, а тот ставится отдельной командой)' }
    ] },
  { id: 'покрытие неполно', scenario: 'fixture', args: ['--config', '@few', 'check'], code: 1,
    must: ['покрытие:', 'починка: add these paths as a column or to "skip"'],
    truth: 'названы пути и коммиты, которые их завели, и готовое действие',
    advice: [
      { kind: 'manual', text: 'add these paths as a column or to "skip" of size-table.config.json',
        why: 'правка настроек проекта — за человеком: какие пути важны, знает только проект' },
      { kind: 'run', args: ['--init', 'draft.json'], expect: 0, inClone: true }
    ] },
  { id: 'приближение вместо точного счёта', scenario: 'fixture', args: ['--config', '@sensor', '--write'], code: 4,
    env: { SIZE_REPORT_NO_OPTIONAL: '1' },
    must: ['the metric "min" counts by simplification', 'the metric "tok" counts by an estimate', 'fix: '],
    truth: 'приближение названо приближением и не уезжает как успех',
    // Both pieces of advice are prose: the tool cannot install dependencies for a person. But the
    // alternative each names is a setting, and a run checks it.
    advice: [
      { kind: 'manual', text: 'install the optional dependencies again or set "minify": {"engine": "strip"}',
        why: 'установка зависимостей — сеть и чужой проект: её исполняет человек',
        works: { args: ['--config', '@strip', '--write'], env: { SIZE_REPORT_NO_OPTIONAL: '1' }, expect: 0, inClone: true } },
      { kind: 'manual', text: 'install the optional dependencies again or remove "tok" from metrics',
        why: 'то же действие человека, и та же проверка его половины: без «tok» в метриках жалобы на словарь нет',
        works: { args: ['--config', '@notok', '--write'], env: { SIZE_REPORT_NO_OPTIONAL: '1' }, expect: 0, inClone: true } }
    ] },

  { id: 'internal error', uncatchable: 'чтобы уронить инструмент, нужно испортить его самого;'
    + ' проверка, держащая в наборе заведомо сломанный движок, стерегла бы своё, а не отказ',
  advice: []
  }
];

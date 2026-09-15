import { cliCommand, advicePath, refuseCause } from './refusal.js';

/* Грамматика командной строки: что человек назвал и законно ли это сочетание.
 *
 * Один разбор на входе, до чтения проекта. Он решает всё сразу — какой режим
 * запрошен, совместим ли он с командой и с остальными ключами, все ли ключи
 * получили значение, нет ли лишних слов, — и отвечает либо планом, либо отказом.
 * Поэтому порядок ветвлений в `main` ничего не решает: правило «так нельзя» — это
 * значение, а не место в коде, и наружу оно выходит одним способом — отказом с
 * названным виновником и готовой командой.
 *
 * Ключи трёх родов: режимы (взаимоисключающие — они задают, что делать), ключи со
 * значением (забирают следующий аргумент) и переключатели. Команда — первое слово
 * вне ключей: её чтение не зависит от места в строке, поэтому и `size check
 * --config x`, и `size --config x check` — одно и то же.
 *
 * Файл отдельный от `cli.js`, потому что вопросы у них разные: здесь — «что
 * запрошено и можно ли так», там — «что по запросу делать». Отсюда и цена ошибки
 * в каждом: неверное правило здесь ломает все режимы сразу, поэтому проверки
 * разложены по группам (режим, слово, форма ответа), а каталог отказов считает их
 * места и требует проверки на каждое.
 */

const MODES = ['--init', '--write', '--data', '--page'];
const VALUE_FLAGS = ['--config', '--init', '--page'];
const FLAGS = ['--help', '-h'].concat(MODES, VALUE_FLAGS, ['--json', '--force']);
const COMMANDS = ['check', 'explain', 'doctor', 'install-hook', 'uninstall-hook', 'hook-run'];
const ANSWER_COMMANDS = ['check', 'explain', 'doctor'];
export const HOOK_COMMANDS = ['install-hook', 'uninstall-hook', 'hook-run'];

/* Ключ со значением: забирает следующий аргумент и возвращает, сколько съел. У
 * `--init` и `--page` пустое значение — законное «по умолчанию», а у `--config`
 * это молчаливый пропуск: настройки были бы взяты не те, что назвал человек. */
function takeValue(flag, args, i, values) {
  const next = args[i + 1];
  const none = next === undefined || next[0] === '-';
  if (none && flag === '--config') {
    refuseCause('ключ без значения', 'у ключа «' + flag + '» нет значения: нужен файл настроек'
      + '\n  починка: ' + cliCommand(flag + ' <файл>'));
  }
  values[flag] = none ? null : next;
  return none ? 0 : 1;
}

/* Один проход по строке: слова, режимы и значения ключей. Отказы здесь — только
 * про сам ключ (незнакомый, повторённый, без значения): сочетания разбирает
 * `checkArgs`, потому что они про названное вместе, а не про отдельный аргумент. */
function scan(args) {
  const seen = new Set();
  const modes = [];
  const values = {};
  const words = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a[0] !== '-') { words.push(a); continue; }
    if (FLAGS.indexOf(a) < 0) {
      refuseCause('незнакомый ключ', 'незнакомый ключ «' + a + '»\n  починка: ' + cliCommand('--help'));
    }
    if (seen.has(a)) {
      refuseCause('повтор ключа', 'ключ «' + a + '» назван дважды\n  починка: ' + cliCommand('--help'));
    }
    seen.add(a);
    if (VALUE_FLAGS.indexOf(a) >= 0) i += takeValue(a, args, i, values);
    if (MODES.indexOf(a) >= 0) modes.push(a);
  }
  return { seen: seen, modes: modes, values: values, words: words };
}

/* Совет повторяет настройки, которые человек назвал: без `--config` команда ищет
 * файл под умолчательным именем, в проекте с другим именем не находит его и уводит
 * человека во второй отказ — про файл настроек, которого у него нет. */
function advisor(values) {
  const given = typeof values['--config'] === 'string'
    ? '--config ' + advicePath(values['--config']) + ' ' : '';
  return (rest) => cliCommand(given + rest);
}

/* Режим против ключей: сами режимы взаимоисключающие, а `--force` и `--config`
 * работают не с каждым из них. */
function checkModes(plan) {
  const { modes, seen, mode, advice } = plan;
  if (modes.length > 1) {
    refuseCause('два режима сразу', 'два режима сразу: «' + modes[0] + '» и «' + modes[1] + '» — режим один'
      + '\n  починка: ' + advice(modes[0]));
  }
  if (seen.has('--force') && mode !== '--init') {
    refuseCause('несовместимый ключ', 'ключ «--force» работает только с «--init»'
      + '\n  починка: ' + cliCommand('--init --force'));
  }
  if (seen.has('--config') && mode === '--init') {
    refuseCause('несовместимый ключ', 'у «--init» свой файл, а «--config» называет настройки проекта'
      + '\n  починка: ' + cliCommand('--init <файл>'));
  }
}

/* Слово, которого команда не знает. Отдельным вопросом, потому что виновников
 * тут двое: опечатка в команде — и лишнее значение режима, который своё значение
 * уже забрал (у `--init` и `--page` оно одно). Оба случая обязаны назвать своего
 * виновника: у `--config` остаток — именно команда, и зов её разбирается как
 * команда, а не как лишнее слово. */
function checkUnknownWord(plan) {
  const { verb, values, advice } = plan;
  if (verb === null || COMMANDS.indexOf(verb) >= 0) return;
  const valued = MODES.find((f) => VALUE_FLAGS.indexOf(f) >= 0 && typeof values[f] === 'string');
  if (valued !== undefined) {
    refuseCause('лишнее слово', 'лишнее слово «' + verb + '»: «' + valued + '» принимает одно значение'
      + '\n  починка: ' + advice(valued + ' ' + advicePath(values[valued])));
  }
  refuseCause('неизвестная команда', 'неизвестная команда «' + verb + '»\n  починка: ' + cliCommand('--help'));
}

/* Слово и режим вместе: команда задаёт, что ответить, режим — что записать, и
 * одновременно они не работают. */
function checkWordAgainstMode(plan) {
  const { verb, mode, advice } = plan;
  if (verb === null || mode === null) return;
  refuseCause('команда и режим', 'команда «' + verb + '» и режим «' + mode + '» — разное, вместе они не работают'
    + '\n  починка: ' + advice(verb));
}

/* Сколько слов принято: у `explain` коммит один и он обязателен, у остальных
 * команд аргументов нет вовсе. Коммит либо не назван, либо назван не один раз —
 * тупика два, а починка одна и та же. */
function checkWordCount(plan) {
  const { verb, arg, advice } = plan;
  if (verb === 'explain' && arg.length === 0) {
    refuseCause('нет коммита', 'команде «explain» нужен коммит: имя ревизии (HEAD, ветка, тег),'
      + ' sha или его начало'
      + '\n  починка: ' + advice('explain <коммит>'));
  }
  if (verb === 'explain' && arg.length > 1) {
    refuseCause('лишнее слово', 'команда «explain» принимает один коммит, а не ' + arg.length
      + ': «' + arg.slice(1).join('», «') + '» лишние\n  починка: ' + advice('explain <коммит>'));
  }
  if (verb !== null && verb !== 'explain' && arg.length > 0) {
    refuseCause('лишнее слово', 'команда «' + verb + '» аргументов не принимает: «' + arg[0] + '» лишний'
      + '\n  починка: ' + advice(verb));
  }
}

/* Форма ответа против всего остального. `--json` — не режим, а форма, и правило у
 * него одно: ответ бывает ровно у трёх команд и у запуска без команды (прежняя
 * форма данных — она заморожена эталоном паритета, убрать её нельзя). У команды
 * без ответа просить нечего, а у режима ответ уже один — запись; оба случая —
 * отказ, и каждый называет своего виновника. */
function checkAnswer(plan) {
  const { verb, mode, seen, advice } = plan;
  if (seen.has('--json') && verb !== null && ANSWER_COMMANDS.indexOf(verb) < 0) {
    refuseCause('нет ответа в JSON', 'у команды «' + verb + '» нет ответа в JSON'
      + '\n  починка: ' + advice(verb));
  }
  if (seen.has('--json') && verb === null && mode !== null) {
    refuseCause('два ответа сразу', '«--json» и режим «' + mode + '» — разное: данные или запись, но не оба'
      + '\n  починка: ' + advice(mode));
  }
}

/* Проверки сочетаний — тремя группами и одним планом на всех: план это то, что
 * разбор уже знает (слово, аргумент, режим, названные ключи и совет), а группы
 * отвечают каждая за своё. Возврат — готовый план запуска. */
function checkArgs(scanned) {
  const { words, seen, values, modes } = scanned;
  const plan = {
    verb: words.length > 0 ? words[0] : null,
    arg: words.slice(1),
    modes: modes,
    mode: modes.length > 0 ? modes[0] : null,
    seen: seen,
    values: values,
    advice: advisor(values)
  };
  checkModes(plan);
  checkUnknownWord(plan);
  checkWordAgainstMode(plan);
  checkWordCount(plan);
  checkAnswer(plan);
  return {
    verb: plan.verb,
    mode: plan.mode,
    arg: plan.arg,
    json: seen.has('--json'),
    force: seen.has('--force')
  };
}

export function parseArgs(args) {
  // Справка отвечает всегда и первой: она и есть выход из любой опечатки.
  if (args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) return { help: true };
  const scanned = scan(args);
  return Object.assign({ help: false, values: scanned.values }, checkArgs(scanned));
}

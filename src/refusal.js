import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TOOL_PKG } from './tool.js';

/* Refusal and help: an exit code, a message carrying the command that fixes the problem,
 * and the `--help` text. It stands at the bottom of the chain — it knows neither the
 * settings nor git — which is why any module may call it. */

// ESM has no `__filename`, and `invocation()` needs the engine's own location: the path
// comes from `import.meta.url`.
const __filename = fileURLToPath(import.meta.url);

/* A refusal is an exit code and one line with the command that fixes it: an agent branches
 * on the code (the table is in `USAGE` below), a human reads the text. The stack is never
 * handed out — it holds no hint, only paths of the machine. */
export const EXIT = { OK: 0, VIOLATION: 1, CONFIG: 2, SHALLOW: 3, SENSOR: 4, INTERNAL: 5 };

export class Refusal extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function refuse(code, message) {
  throw new Refusal(code, message);
}

/* The causes of a code-2 refusal in one list, and this is the only place where they are
 * spelled out: the help prints them from it, the code table in `README.md` is checked
 * against it (`test/docs-commands.test.js`), and `refuseCause` lets no refusal through
 * without a named cause. So "the documentation says less than happens" cannot pass here
 * silently. The groups say where a cause comes from: the command line, settings and the
 * project, history, the hook, measurement. */
export const CONFIG_CAUSES = [
  ['командная строка', [
    'незнакомый ключ', 'ключ без значения', 'повтор ключа', 'два режима сразу',
    'лишнее слово', 'команда и режим', 'неизвестная команда', 'несовместимый ключ',
    'нет ответа в JSON', 'два ответа сразу', 'нет коммита'
  ]],
  ['настройки и проект', [
    'нет файла настроек', 'настройки не разобраны', 'настройки неверны',
    'нет git', 'не git-репозиторий', 'конфиг уже есть'
  ]],
  ['история', ['нет такого коммита', 'коммит назван неточно', 'коммит вне истории']],
  ['хук', ['чужой хук', 'чужой core.hooksPath', 'нечем звать инструмент']],
  ['измерение', ['файл не JavaScript', 'минификатор не разобрал']]
];

/* A cause is a declared name, not decoration of the text: an undeclared one never reaches
 * the user, because that is a defect of the tool rather than a dead end for a human. */
export function refuseCause(cause, message) {
  if (!CONFIG_CAUSES.some((g) => g[1].indexOf(cause) >= 0)) {
    throw new Error('причина отказа не объявлена: ' + cause);
  }
  refuse(EXIT.CONFIG, message);
}

/* The help lines about causes come from the same list, so the help cannot drift from the
 * checks. */
const CAUSE_LINES = CONFIG_CAUSES.map((g) => '  ' + g[0] + ': ' + g[1].join(' · '));

/* How the tool is called where it is read. The advice names what lies nearby and never the package
 * name: a path inside the project (`node node_modules/<name>/bin/size.js`) works where the package is
 * installed and, where it is not, refuses on the spot; the name from the registry would instead fetch
 * and run a revision the project never pinned (and the unscoped name there belongs to another package
 * altogether). One form, therefore, and no trip to the network.
 *
 * The fix command quotes the entry point rather than the engine itself: importing the
 * engine runs nothing, so `--init` works through the command only. Inside the package's own
 * repository the path is computed from the engine's location rather than from the current
 * directory — the message has to work from anywhere in the project. */
export function invocation() {
  const local = path.join('node_modules', TOOL_PKG.name, 'bin', 'size.js');
  if (fs.existsSync(path.resolve(process.cwd(), local))) return 'node ' + local;
  const bin = path.resolve(path.dirname(__filename), '..', 'bin', 'size.js');
  const shown = path.relative(process.cwd(), bin);
  return 'node ' + (shown === '' || shown.indexOf('..') === 0 ? bin : shown);
}

export function cliCommand(flag) {
  return invocation() + ' ' + flag;
}

/* A path inside a ready-made command: a space or a quote in it would break copying, so such
 * a path is quoted the way a shell would accept it. */
export function advicePath(p) {
  return /[\s"'$`\\]/.test(p) ? JSON.stringify(p) : p;
}

export const USAGE = [
  '@vernikr/size-report — отчёт об объёме файлов по коммитам: один файл,',
  'самодостаточная страница (данные, оформление и программа лежат в ней же).',
  '',
  'Запуск: ' + invocation() + ' [команда] [режим] [ключи]',
  '',
  'Команды:',
  '  check [--json]    полнота: настройки, история, пути, датчики (код 1 — путь',
  '                    истории не отслеживается и не объявлен исключением)',
  '  explain <коммит>  почему у коммита нет строки (имя ревизии, sha или его начало)',
  '  doctor [--json]   диагностика одним ответом: окружение, зависимости, настройки,',
  '                    покрытие (код 0 — делать нечего, иначе — первый по важности)',
  '  install-hook      поставить хуки post-commit и post-merge (они ставятся сами при',
  '                    первом запуске в проекте): отчёт пересобирается после каждого',
  '                    коммита и слияния, а если он в git — ложится отдельным коммитом',
  '  uninstall-hook    убрать хук и его состояние (проект возвращается к прежнему)',
  '  hook-run          то, что зовёт хук: пересборка и коммит отчёта (вручную не нужно)',
  '',
  'Режимы:',
  '  --init [файл]   закрепить настройки файлом (--force — перезаписать существующий)',
  '  --write [файл]  собрать отчёт в файл из настроек (каталог создаётся сам)',
  '  --data          данные контракта в stdout — для отчёта и для агента',
  '  --json          прежняя форма данных в stdout',
  '  (без режима)    проверить, что отчёт совпадает с историей',
  '',
  'Ключи: --config <файл> — другие настройки; --help — эта справка.',
  '',
  '--json — форма ответа, а не отдельный режим, и правило у него одно: ответ бывает',
  'ровно у четырёх вызовов. Без команды это прежняя форма данных, у check, explain',
  'и doctor — их ответ; у остального ответа нет, и там --json — отказ, а не тишина.',
  '',
  'Запуск один: команда и режим не совмещаются, режим тоже один, и лишнее слово',
  'вместе с незнакомым ключом — отказ с готовой командой, а не обычный прогон.',
  '',
  'Настройки заводить не обязательно: без файла они выводятся из самого проекта',
  '(колонки — по группам путей из дерева и истории, журнал и куда писать — оттуда же),',
  'и об этом сказано в выводе. «--init» закрепляет выведенное файлом — дальше правят его;',
  'файл, названный ключом «--config», обязан быть, иначе — отказ.',
  '',
  'Коды выхода: 0 — всё хорошо, 1 — расхождение с историей или неполнота, 2 — вызов,',
  'настройки или окружение, 3 — неполная история, 4 — нет датчика, 5 — внутренняя',
  'ошибка. У doctor свой порядок: 2, 3, 1, 4 — по важности находки, а не по тому,',
  'что нашлось первым.',
  '',
  'Причины отказа кодом 2 (их же называет таблица кодов в README.md):'
].concat(CAUSE_LINES, ['']).join('\n');

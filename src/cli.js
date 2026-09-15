import path from 'path';
import { EXIT, Refusal, USAGE, cliCommand } from './refusal.js';
import { CONFIG_NAME, gitRoot, loadConfig } from './config.js';
import { HOOK_COMMANDS, parseArgs } from './args.js';
import { initMode } from './init.js';
import { derivedLines } from './project.js';
import { autoInstall } from './hook.js';
import {
  checkMode, coverageMode, dataMode, doctorMode, explainMode, hookMode, jsonMode, writeMode
} from './modes.js';

/* Вход инструмента: разбор строки, чтение проекта и доставка запроса режиму.
 *
 * Здесь не осталось ни грамматики (`src/args.js`), ни самих режимов
 * (`src/modes.js`), ни закрепления настроек (`src/init.js`) — только то, без чего
 * вход не вход: откуда берётся корень проекта, каким ключом назван файл настроек и
 * как отказ превращается в код выхода. Здесь же сказано вслух, когда настроек нет
 * и работа идёт на выведенных из проекта: это общее для всех режимов, а не их дело. Разделение не косметическое: цепочка
 * ветвлений «что запрошено» росла с каждым режимом и держала сложность входа, а
 * правила грамматики и тексты отказов проверяются своим каталогом
 * (`tools/refusals.js`), который считает их места в исходниках.
 */

/* Исполнитель запроса: ключ — то, чем запрос назван (команда или режим), а «просто
 * запуск» — пустая строка. Разбор уже проверил сочетания, поэтому здесь остаётся
 * выбор из готового списка, а не решение: у каждого названного есть свой
 * исполнитель, и вызывается он без пробежек по `if`. */
const RUNNERS = {
  check: (c, x) => coverageMode(x.cfg, x.root, x.configFile, c.json),
  explain: (c, x) => explainMode(x.cfg, x.root, c.arg[0], c.json),
  '--data': (c, x) => dataMode(x.cfg, x.root),
  '--write': (c, x) => writeMode(x.cfg, x.root, c.values['--write']),
  '': (c, x) => (c.json ? jsonMode(x.cfg, x.root) : checkMode(x.cfg, x.root))
};

const asked = (cmd) => (cmd.verb === null ? (cmd.mode === null ? '' : cmd.mode) : cmd.verb);

/* Постановка хука без спроса — здесь, а не в `doctor` и не в `hook-run`: первый
 * только докладывает, а второй зовётся уже из поставленного хука. Ставится один раз
 * в клоне и называется вслух, дальше молчит: отчёт обновляется после каждого
 * коммита без ручного шага (устройство и границы — `src/hook.js`). */
function ensureHook(root, cfg) {
  const files = autoInstall(root, cfg);
  if (files === null) return;
  console.error('· хук поставлен: ' + files.join(', ') + ' — отчёт обновляется после каждого'
    + ' коммита (снять: ' + cliCommand('uninstall-hook') + ')');
}

/* Доставка. Диагностика и хук отвечают до чтения настроек: им нужен не весь
 * проект, а окружение, и отказывать им из-за настроек было бы неверно — про
 * настройки они как раз и докладывают. */
function deliver(cmd, base) {
  if (cmd.verb === 'doctor') return doctorMode(base.root, base.configFile, cmd.json);
  if (HOOK_COMMANDS.indexOf(cmd.verb) >= 0) return hookMode(cmd.verb, base.root, base.configFile);
  const ctx = { root: base.root, configFile: base.configFile, cfg: loadConfig(base.configFile, base.root) };
  // Примечание идёт в stderr: у `--json` и `--data` в stdout лежат данные, и
  // подмешивать в них рассказ о настройках значило бы ломать разбор.
  if (ctx.cfg.derived) derivedLines(ctx.cfg).forEach((line) => console.error(line));
  ensureHook(base.root, ctx.cfg);
  return RUNNERS[asked(cmd)](cmd, ctx);
}

export function main() {
  try {
    const cmd = parseArgs(process.argv.slice(2));
    if (cmd.help) {
      process.stdout.write(USAGE);
      return EXIT.OK;
    }
    const root = gitRoot();
    if (cmd.mode === '--init') return initMode(root, cmd.values['--init'], cmd.force);
    const named = cmd.values['--config'];
    const configFile = named ? path.resolve(named) : path.join(root, CONFIG_NAME);
    return deliver(cmd, { root: root, configFile: configFile });
  } catch (e) {
    if (e instanceof Refusal) {
      console.error('✗ ' + e.message);
      return e.code;
    }
    // Непредвиденное — дефект инструмента, а не тупик пользователя: так это и
    // сказано в тексте (иначе человек ищет ошибку у себя), а стек нужен целиком,
    // иначе такой отказ нечем разбирать.
    console.error('✗ внутренняя ошибка (это дефект инструмента, а не проекта —'
      + ' пришлите, пожалуйста, этот текст целиком):\n' + e.stack);
    return EXIT.INTERNAL;
  }
}

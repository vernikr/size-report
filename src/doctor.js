import { EXIT, Refusal, cliCommand } from './refusal.js';
import { GIT_PINS, git, gitEnv } from './git.js';
import { loadConfig } from './config.js';
import { TOOL_PKG } from './tool.js';
import { coverage, coverageText } from './check.js';
import { hookStatus } from './hook.js';
import { minifier } from './minify.js';
import { tokenizer } from './tokens.js';

/* Диагностика одним ответом (`size doctor`): отвечает ли машина за числа, чем
 * считаются метрики здесь и сейчас, годятся ли настройки, всё ли из истории
 * покрыто. Ничего своего он не считает: покрытие — тот же ответ, что даёт
 * `size check` (`coverage`), окружение — факты этой машины, зависимости — те же
 * загрузчики, которыми пользуются датчики. Второго расчёта в пакете нет.
 *
 * Правило ответа: `ok` значит «делать нечего», а у находки назван уровень.
 * `action` — что-то надо сделать (и, где возможно, названа команда починки);
 * `note` — наблюдение: знать полезно, делать нечего. Код выхода считает один
 * `verdictOf` в конце: шаги чтения только называют вид обстоятельства (`troubles`),
 * а и порядок видов, и код каждого — один список `WEIGHT`. Своего кода у шага нет,
 * поэтому разойтись эти два ответа не могут.
 *
 * Чего ответ не делает: не говорит, «правильно» ли выбраны колонки (это знает
 * проект), и не угадывает там, где данных нет, — отсутствие ответа называется
 * словами (`coverage: null` и находка с причиной).
 */

/* Окружение: что за машина и что она говорит о числах. Без ответа git ответ
 * честно неполон (`git: null`), а не выдуман. */
function environment(root) {
  const env = {
    node: process.version,
    platform: process.platform,
    root: root,
    git: null,
    shallow: null,
    pins: GIT_PINS.slice(),
    locale: gitEnv().LC_ALL
  };
  try {
    env.git = git(root, ['--version']).trim();
    env.shallow = git(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true';
  } catch (_e) {
    // git не ответил — об этом скажет находка, а не выдуманное значение.
  }
  return env;
}

/* Зависимости: чем метрики считаются здесь и сейчас. Спрашиваются те же
 * загрузчики, что и у датчиков (`minifier`, `tokenizer`), поэтому ответ не может
 * разойтись с числом: без минификатора `min` считает упрощением, без словаря
 * `tok` — оценкой.
 *
 * Загружается только то, о чём проект действительно спросил: словарь весит
 * мегабайты, и трогать его ради строки «есть» значило бы заплатить за ответ,
 * которого у чисел не было (то же правило, что у отчёта: `test/tokens.test.js`).
 * Ненужный датчик назван не «неизвестным», а ненужным — на точность он не влияет,
 * и это и есть ответ; «неизвестно» остаётся там, где настройки нечитаемы и
 * спросить не у кого. */
const UNREADABLE = 'неизвестно: настройки нечитаемы';

/* Спрошено — спрашиваем загрузчик; не спрошено — говорим об этом словами и не
 * платим за него. */
function entry(asked, name, metric, load, note) {
  if (asked !== true) return { name: name, metric: metric, present: null, note: note };
  const { tool, version } = load();
  return { name: name, metric: metric, present: tool !== null, version: version };
}

function dependencies(cfg) {
  const asksMinify = cfg === null ? null : cfg.minify.engine === 'esbuild';
  const asksTokens = cfg === null ? null : cfg.metrics.indexOf('tok') >= 0;
  return [
    entry(asksMinify, 'esbuild', 'min', () => minifier(),
      asksMinify === null ? UNREADABLE : 'не спрашивается: «minify» считает снятием балласта'),
    entry(asksTokens, 'gpt-tokenizer', 'tok', () => tokenizer(cfg.tokens),
      asksTokens === null ? UNREADABLE : 'не спрашивается: метрики ' + cfg.metrics.join(' '))
  ];
}

/* Настройки: при нечитаемых ответ честно неполон (покрытие считать нечем), а
 * причина — не отказ, а находка: диагностика затем и нужна, чтобы назвать причину
 * и починку, — их и несёт текст отказа. Вес обстоятельства шаг только **называет**
 * (`troubles`), а важнее оно или нет — не его дело: решает `verdictOf`. */
function readConfig(root, configFile) {
  try {
    const cfg = loadConfig(configFile, root);
    return {
      cfg: cfg,
      report: { file: configFile, ok: true, columns: cfg.columns.length, metrics: cfg.metrics },
      findings: [],
      troubles: []
    };
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    return {
      cfg: null,
      report: { file: configFile, ok: false, problem: e.message },
      findings: [{ level: 'action', what: e.message }],
      troubles: ['config']
    };
  }
}

/* Хук: две находки, у каждой своя починка. Веса у них нет и своего кода выхода тоже —
 * отчёт собирается и без хука, поэтому сломанный хук меняет только вердикт `ok`. */
function hookFindings(hooks) {
  const found = [];
  if (!hooks.installed) return found;
  if (hooks.enabled === false) {
    found.push({
      level: 'action',
      what: 'хук установлен, но автоматика выключена настройкой hooks.enabled: отчёт обновляется руками',
      fix: 'верните «"hooks": {"enabled": true}» в файл настроек или снимите хук: ' + cliCommand('uninstall-hook')
    });
  }
  if (hooks.last !== null && HOOK_BAD.indexOf(hooks.last.result) >= 0) {
    found.push({
      level: 'action',
      what: 'хук: последний запуск не пересобрал отчёт — ' + hooks.last.why,
      fix: 'починьте то, на что жалуется причина, и пересоберите отчёт: ' + cliCommand('--write')
    });
  }
  return found;
}

/* Покрытие — тот же ответ, что даёт `size check`, плюс вид обстоятельства, если оно есть:
 * неполнота пути или приближение датчика (вес у видов разный — `WEIGHT`); неполнота
 * старше, потому что без неё чисел нет вовсе.
 * Что попадает в находки, а что нет: в отчёте целиком стоит блок покрытия (тот же текст,
 * что у `size check`), поэтому неполнота второй раз не пересказывается — она весит. А по
 * датчикам находка есть: `size check` печатает их строкой `!`, здесь они часть ответа. */
function readCoverage(cfg, root, configFile) {
  if (cfg === null) {
    return {
      report: null,
      findings: [{
        level: 'note',
        what: 'покрытие не считалось: настройки нечитаемы — почините их и спросите снова'
      }],
      troubles: []
    };
  }
  try {
    const report = coverage(cfg, root, configFile);
    return {
      report: report,
      findings: report.sensors.map((gap) => ({ level: 'action', what: gap.why, fix: gap.fix })),
      troubles: report.ok ? (report.sensors.length > 0 ? ['sensor'] : []) : ['coverage']
    };
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    /* Внутри покрытия отказывают двое, и род у них разный: обрезанной истории —
     * свой вид (`assertFullHistory`), а неразобранному файлу — настройки: числа
     * нет из-за них, и починка у него настройками же. Вид выбирается по коду
     * отказа — эти два кода и есть весь выбор. */
    return {
      report: null,
      findings: [{ level: 'action', what: e.message }],
      troubles: [e.code === EXIT.SHALLOW ? 'history' : 'config']
    };
  }
}

/* Вес обстоятельств — вот и весь порядок важности, и он один на весь модуль: ключи идут
 * по важности, значения — код каждого вида. Код выхода берётся у самого важного из
 * найденного, а не у того, что нашлось позже: сначала чем считать нечем (настройки,
 * история), потом неполное покрытие, потом оговорка о счёте.
 * Хук в список не входит: отчёт собирается и без него (см. `hookFindings`). */
const WEIGHT = {
  config: EXIT.CONFIG,
  history: EXIT.SHALLOW,
  coverage: EXIT.VIOLATION,
  sensor: EXIT.SENSOR
};

/* Вердикт — одно место, где обстоятельства превращаются в код выхода и в `ok`.
 * «Делать нечего» — это ни одной находки-действия и сосчитанное полное покрытие: без
 * покрытия вердикта нет, потому что считать больше нечего (см. заметку в `readCoverage`). */
function verdictOf(rep, troubles) {
  const found = Object.keys(WEIGHT).filter((kind) => troubles.indexOf(kind) >= 0);
  rep.exit = found.length === 0 ? EXIT.OK : WEIGHT[found[0]];
  rep.ok = rep.coverage !== null && rep.coverage.ok
    && !rep.findings.some((f) => f.level === 'action');
  return rep;
}

export function doctor(root, configFile) {
  const config = readConfig(root, configFile);
  const hooks = hooksReport(root, config.cfg);
  const cov = readCoverage(config.cfg, root, configFile);
  const rep = {
    schema: 1,
    ok: false,
    tool: { name: TOOL_PKG.name, version: TOOL_PKG.version },
    environment: environment(root),
    config: config.report,
    dependencies: dependencies(config.cfg),
    hooks: hooks,
    coverage: cov.report,
    findings: config.findings.concat(hookFindings(hooks), cov.findings),
    exit: EXIT.OK
  };
  return verdictOf(rep, config.troubles.concat(cov.troubles));
}

/* Итог последнего запуска хука словами: по нему человек понимает, что произошло
 * после коммита, не заглядывая в `.git`. */
const HOOK_RESULT = {
  committed: 'отчёт пересобран и закоммичен',
  rebuilt: 'отчёт пересобран без коммита',
  unchanged: 'менять было нечего',
  refused: 'отказ',
  failed: 'ошибка',
  skipped: 'пропущен'
};
// Итоги, которые требуют действий: отказ инструмента и его собственная ошибка.
const HOOK_BAD = ['refused', 'failed'];

/* Состояние хука: установлен ли, включён ли настройкой и чем кончился последний
 * запуск. «Не установлен» — не находка: автоматика ставится явной командой,
 * и её отсутствие — решение проекта, а не забывчивость. */
function hooksReport(root, cfg) {
  const status = hookStatus(root);
  return {
    installed: status.installed,
    files: status.files,
    enabled: cfg === null ? null : cfg.hooks.enabled,
    last: status.last
  };
}

function hookLine(hooks) {
  if (!hooks.installed) return 'не установлен (ставится командой ' + cliCommand('install-hook') + ')';
  const last = hooks.last === null
    ? 'ещё не запускался'
    : 'последний запуск ' + hooks.last.at + ' — ' + (HOOK_RESULT[hooks.last.result] || hooks.last.result)
      + (hooks.last.commit ? ' (' + hooks.last.commit + ')' : '')
      + (hooks.last.why ? ': ' + hooks.last.why.split('\n')[0] : '');
  return hooks.files.join(', ') + (hooks.enabled === false ? ' (выключен настройкой)' : '') + '; ' + last;
}

/* Текст для человека. Покрытие печатает `coverageText` — тот же, что у
 * `size check`: два ответа об одном не должны разойтись формулировками. */
export function doctorText(rep) {
  const env = rep.environment;
  const lines = [];
  lines.push((rep.ok ? '✓ ' : '✗ ') + rep.tool.name + ' ' + rep.tool.version + ': диагностика ' + env.root);
  lines.push('  окружение: Node ' + env.node + ', ' + env.platform + ', '
    + (env.git === null ? 'git недоступен' : env.git)
    + (env.shallow === null ? '' : env.shallow ? ', история обрезана' : ', история полная'));
  // Закрепления — механизм, а не украшение: движок ставит их сам на границе вызова,
  // поэтому настройки машины на числа не влияют (проверка — `test/environment.test.js`).
  lines.push('  git читается с закреплениями: ' + env.pins.join(', ') + '; локаль ' + env.locale
    + ' (настройки машины на числа не влияют)');
  lines.push('  настройки: ' + (rep.config.ok
    ? rep.config.file + ' — ' + rep.config.columns + ' колонок, метрики ' + rep.config.metrics.join(' ')
    : rep.config.file + ' — нечитаемы'));
  lines.push('  зависимости: ' + rep.dependencies.map((d) => d.name
    + (d.present === null ? ' — ' + d.note : d.present ? ' ' + d.version + ' есть' : ' нет')
    + ' (' + d.metric + ')').join(', '));
  lines.push('  хук: ' + hookLine(rep.hooks));
  if (rep.coverage) lines.push(coverageText(rep.coverage));
  rep.findings.forEach((f) => {
    lines.push((f.level === 'action' ? '✗ ' : '· ') + f.what);
    if (f.fix) lines.push('  починка: ' + f.fix);
  });
  return lines.join('\n');
}

import { EXIT, Refusal } from './refusal.js';
import { GIT_PINS, git, gitEnv } from './git.js';
import { loadConfig } from './config.js';
import { TOOL_PKG } from './tool.js';
import { coverage, coverageText } from './check.js';
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
 * `note` — наблюдение: знать полезно, делать нечего. Код выхода — первый по
 * важности, а не «всё хорошо»: 2 — настройки нечитаемы (читать больше нечего),
 * 3 — история обрезана, 1 — покрытие неполно, 4 — число приближённо. Порядок
 * именно такой: сначала то, что мешает считать, потом то, что требует починки,
 * потом честная оговорка о счёте.
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

export function doctor(root, configFile) {
  const rep = {
    schema: 1,
    ok: false,
    tool: { name: TOOL_PKG.name, version: TOOL_PKG.version },
    environment: environment(root),
    config: null,
    dependencies: null,
    coverage: null,
    findings: [],
    exit: EXIT.OK
  };
  let cfg = null;
  try {
    cfg = loadConfig(configFile);
    rep.config = { file: configFile, ok: true, columns: cfg.columns.length, metrics: cfg.metrics };
  } catch (e) {
    // Отказ настроек здесь не отказ, а находка: диагностика затем и нужна, чтобы
    // назвать причину и починку, — их и несёт текст отказа.
    if (!(e instanceof Refusal)) throw e;
    rep.config = { file: configFile, ok: false, problem: e.message };
    rep.findings.push({ level: 'action', what: e.message });
    rep.exit = e.code;
  }
  rep.dependencies = dependencies(cfg);
  if (cfg === null) {
    rep.findings.push({
      level: 'note',
      what: 'покрытие не считалось: настройки нечитаемы — почините их и спросите снова'
    });
  } else {
    try {
      rep.coverage = coverage(cfg, root, configFile);
    } catch (e) {
      if (!(e instanceof Refusal)) throw e;
      rep.findings.push({ level: 'action', what: e.message });
      rep.exit = e.code;
    }
  }

  /* Что попадает в находки, а что нет: в отчёте уже целиком стоит блок покрытия
   * (тот же текст, что у `size check`), поэтому неполнота здесь второй раз не
   * пересказывается — она меняет вердикт и код выхода. Находкой становится то,
   * чего в блоке покрытия нет: нечитаемые настройки, обрезанная история, а по
   * датчикам — их причина и починка (их `size check` печатает отдельной строкой
   * `!`, а здесь они часть того же ответа). Неполнота старше приближения: из
   * двух причин починки код выхода несёт ту, без которой чисел нет вовсе. */
  if (rep.coverage !== null) {
    rep.coverage.sensors.forEach((gap) => {
      rep.findings.push({ level: 'action', what: gap.why, fix: gap.fix });
    });
    if (!rep.coverage.ok) rep.exit = EXIT.VIOLATION;
    else if (rep.coverage.sensors.length > 0) rep.exit = EXIT.SENSOR;
  }

  // «Делать нечего»: настройки читаемы, покрытие сосчитано и полно, датчики на месте.
  rep.ok = rep.config.ok && rep.coverage !== null && rep.coverage.ok
    && rep.coverage.sensors.length === 0;
  return rep;
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
  if (rep.coverage) lines.push(coverageText(rep.coverage));
  rep.findings.forEach((f) => {
    lines.push((f.level === 'action' ? '✗ ' : '· ') + f.what);
    if (f.fix) lines.push('  починка: ' + f.fix);
  });
  return lines.join('\n');
}

#!/usr/bin/env node
/* Одна команда — источник правды: здесь и только здесь перечислено, что значит
 * «проверено». Локально и в CI гоняются одни и те же шаги в одном порядке, и
 * проверки, которой нет в профиле, в CI быть не может — за этим следит
 * `test/gates-verify.test.js` (он читает описания рабочих процессов и сверяет их с
 * этим списком).
 *
 * **Профилей три, и разница между ними — цена шага, а не его важность.**
 *
 *   `fast`  — каждая правка и pre-commit: оформление, датчики, быстрый набор.
 *   `full`  — перед отправкой правки и в CI: то же плюс полный набор, паритет с живым
 *             проектом, воспроизводимость эталонов, работа из собранного пакета.
 *   `slow`  — по расписанию: то же плюс покрытие под c8 и тот же полный набор в среде
 *             без настроек git вовсе. Оба стоят десятки секунд, и без них полный
 *             профиль укладывается в цель по времени (≤ 90 с) — проверки при этом не
 *             выброшены, а названы здесь и гоняются по расписанию.
 *
 * Шаги запускаются до конца, даже если ранний упал: чинить надо всё найденное, а не
 * то, на чём прогон споткнулся первым (у каждого шага свой вердикт на выходе).
 *
 * Запуск: `pnpm run verify:fast`, `pnpm run verify`, `pnpm run verify:slow`.
 * `node tools/gates/run.js --list full` печатает команды профиля (этим пользуются
 * проверка паритета с CI и человек). Коды выхода: 0 — всё зелено, 1 — что-то нет.
 */

import path from 'node:path';
import { bad, ok, parseArgs, run } from './common.js';

/* Шаги: имя — оно же имя скрипта в `package.json`, чтобы человек мог запустить шаг
 * один. `why` — зачем шаг здесь (печатается в сводке). */
/* Шаг «без настроек машины» называется по имени скрипта с оговоркой: это тот же
 * полный набор, но с одним ключом окружения — отдельным скриптом его не завести. */
const STEPS = {
  'lint:strict': 'оформление: те же правила, что видны в диффе (существующий линтер пакета)',
  metrics: 'раздувание: размер и сложность функций, размер модулей, дубли веток, вес тестов, пометки долга',
  dup: 'дубли: новые клоны против базы отпечатков и против дерева `origin/main`',
  deps: 'связи: циклы, сироты, направление слоёв',
  test: 'быстрый набор проверок (то же, что `pnpm test`)',
  'test:all': 'полный набор проверок',
  'test:all:hermetic': 'полный набор в среде, где настроек git машины нет вовсе',
  'parity:live': 'паритет с историей проекта-потребителя на клоне',
  'check:standards': 'эталоны воспроизводятся, рабочее дерево остаётся чистым',
  'pack:check': 'движок работает из собранного тарболла',
  cover: 'покрытие: храповик по файлам (полный набор под c8)'
};

/* Шаг «без настроек машины» — тот же полный набор с одним ключом окружения: отдельным
 * скриптом его не завести (ключ окружения в `package.json` не переносится между
 * оболочками), а в CI он был ровно тем же набором с тем же ключом. Поэтому шаг — пара
 * «скрипт + окружение», и в профиле он идёт рядом с обычным прогоном. */
const HERMETIC = { GIT_CONFIG_GLOBAL: '/dev/null' };
const step = (script, env) => ({ script: script, env: env || null });
const steps = (...items) => items.map((i) => (typeof i === 'string' ? step(i) : i));

/* Полный профиль назван один раз: slow — это он же плюс два дорогих шага, и второй
 * список разошёлся бы с первым так же тихо, как расходятся любые две копии. */
const FULL = steps('lint:strict', 'metrics', 'dup', 'deps', 'test:all',
  'parity:live', 'check:standards', 'pack:check');

const PROFILES = {
  fast: steps('lint:strict', 'metrics', 'dup', 'deps', 'test'),
  full: FULL,
  slow: FULL.concat(steps(step('test:all', HERMETIC), 'cover'))
};

/* Аргументы шага — по имени скрипта: у `parity:live` в CI приложен бандл истории
 * (живой проект приватный, ключа у проверки нет), у остальных ничего. */
const ARGS = { 'parity:live': ['--', '--repo', 'fixtures/live/history.bundle'] };

function labelOf(entry) {
  return entry.script + (entry.env === null ? '' : ':чистое-окружение');
}

const args = parseArgs(process.argv.slice(2), [], ['--list']);
const profile = args.rest[0];

/* Команда шага как её видит человек и как её сверяет проверка паритета с CI:
 * `pnpm run <имя> [аргументы]`, а ключ окружения — префиксом. */
function commandOf(entry) {
  const env = entry.env === null ? ''
    : Object.keys(entry.env).map((k) => k + '=' + entry.env[k]).join(' ') + ' ';
  return env + ['pnpm', 'run', entry.script].concat(ARGS[entry.script] || []).join(' ');
}

if (profile === undefined || PROFILES[profile] === undefined) {
  bad('verify: профиль не назван или незнаком (есть: ' + Object.keys(PROFILES).join(', ') + ')\n'
    + '    например: pnpm run verify:fast');
} else if (args.flags['--list']) {
  /* Машинный вид профиля: строка — команда. Им сверяются локальный прогон и CI. */
  PROFILES[profile].forEach((entry) => { console.log(commandOf(entry)); });
} else {
  const results = [];
  PROFILES[profile].forEach((entry) => {
    const started = Date.now();
    const argv = ['run', entry.script].concat(ARGS[entry.script] || []);
    console.log('▶ ' + labelOf(entry) + ' — ' + STEPS[entry.script]);
    /* Вывод шага не перехватывается: у каждого шага свой отчёт для человека, и
     * склеивать его в чужой сводке незачем. Здесь важен код возврата. */
    const res = run('pnpm', argv, Object.assign({ stdio: 'inherit' },
      entry.env === null ? {} : { env: Object.assign({}, process.env, entry.env) }));
    const seconds = (Date.now() - started) / 1000;
    const code = res.status === null ? 1 : res.status;
    results.push({ name: labelOf(entry), code: code, seconds: seconds });
  });

  const failed = results.filter((r) => r.code !== 0);
  console.log('\nсводка профиля «' + profile + '»:');
  results.forEach((r) => {
    console.log('  ' + (r.code === 0 ? '✓' : '✗') + ' ' + r.name.padEnd(18)
      + r.seconds.toFixed(1).replace('.', ',') + ' с');
  });
  const total = results.reduce((sum, r) => sum + r.seconds, 0);
  console.log('  всего ' + total.toFixed(1).replace('.', ',') + ' с ('
    + path.basename(process.cwd()) + ', шагов ' + results.length + ')');

  if (failed.length > 0) {
    bad('verify: красных шагов ' + failed.length + ' из ' + results.length + ': '
      + failed.map((r) => r.name).join(', '));
    console.error('    чинить найденное, а не датчик: пороги, базы и правила — не в этом коммите');
  } else {
    ok('verify: профиль «' + profile + '» зелёный целиком (' + results.length + ' шагов)');
  }
}

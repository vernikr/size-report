/* Сторож правила «одна команда — источник правды»: профили проверок
 * (`tools/gates/run.js`), рабочие процессы (`.github/workflows/`) и хуки
 * (`.githooks/`) обязаны говорить одно и то же.
 *
 * Класс дефекта, ради которого это заведено: проверка живёт в CI и не живёт в
 * профиле — тогда локально зелено, а в CI красно (или наоборот), и «прогнал
 * проверку» перестаёт что-либо значить. Со вторым набором команд это расходится
 * молча, поэтому расхождение ловит проверка, а не внимательность.
 *
 * Что сверяется: каждый шаг профиля — существующий скрипт манифеста; профили
 * вложены (быстрый ⊂ полный ⊂ slow); каждый `run:` в рабочих процессах — либо
 * установка, либо вызов профиля; хуки зовут профиль, а не свои команды; отчёты
 * датчиков не попадают в историю.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, exec, pkg } from '../tools/gate-probe.js';
import { parseWorkflow } from '../tools/yaml.js';

const PROFILES = ['fast', 'full', 'slow'];

/* Скрипты-профили: `pnpm run verify` — это и есть профиль, а не шаг внутри него. */
const PROFILE_SCRIPTS = ['verify', 'verify:fast', 'verify:slow'];

/* Шаг, который перекрыт другим: быстрый набор — часть полного (это стережёт
 * `tools/suites.js` и `test/suites.test.js`), поэтому быстрый профиль с `test`
 * вложен в полный с `test:all`. */
const SUBSUMED = { test: 'test:all' };
/* Установка и подготовка — не проверка: их место в CI, а не в профиле. Список
 * нарочно узкий (установка менеджера и подготовка ветки), чтобы «подготовка» не стала
 * способом протащить в CI проверку мимо профиля. */
const SETUP = [/^pnpm install /, /^git fetch /, /^npm install -g /];

/* Рабочие процессы с проверками: здесь каждая команда — либо подготовка, либо вызов
 * профиля. Выпуск (`release.yml`) сюда не входит: он не проверяет, а публикует, и от
 * него требуется только то, что зовы проверок в нём названы теми же скриптами. */
const CHECKS = ['.github/workflows/ci.yml', '.github/workflows/verify-slow.yml'];

/* Не проверки, а работа с пакетами: их место в выпуске и установке. */
const NOT_SCRIPT = ['install', 'exec', 'dlx', 'add', 'remove', 'why', 'audit', 'dedupe', 'publish'];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function stepsOf(profile) {
  const res = exec(process.execPath, ['tools/gates/run.js', '--list', profile]);
  assert.equal(res.code, 0, 'профиль «' + profile + '» не печатает список шагов:\n' + res.out);
  return res.out.split('\n').map((l) => l.trim()).filter((l) => l !== '');
}

/* Шаг профиля назван командой `pnpm run <скрипт>`; ключи окружения — префиксом. */
function scriptOf(command) {
  const m = command.match(/(?:^|\s)pnpm run ([a-z:.-]+)/);
  return m === null ? null : m[1];
}

const scripts = pkg().scripts;
const profiles = {};
PROFILES.forEach((p) => { profiles[p] = stepsOf(p); });

test('каждый шаг профиля — существующий скрипт, а профили вложены', () => {
  PROFILES.forEach((p) => {
    assert.ok(profiles[p].length > 0, 'профиль «' + p + '» пуст');
    profiles[p].forEach((command) => {
      const script = scriptOf(command);
      assert.ok(script !== null, 'шаг «' + command + '» в профиле «' + p + '» — не `pnpm run`');
      assert.ok(scripts[script] !== undefined,
        'профиль «' + p + '» зовёт скрипт «' + script + '», которого нет в package.json');
    });
  });

  const names = (p) => profiles[p].map(scriptOf);
  names('fast').forEach((s) => assert.ok(names('full').indexOf(s) >= 0 || names('full').indexOf(SUBSUMED[s]) >= 0,
    'быстрый шаг «' + s + '» не входит в полный профиль: локально и в CI разойдётся'));
  names('full').forEach((s) => assert.ok(names('slow').indexOf(s) >= 0,
    'полный шаг «' + s + '» не входит в slow-профиль'));
  assert.ok(names('slow').length > names('full').length,
    'slow-профиль не отличается от полного: тогда он не нужен');
});

function runsOf(file) {
  const doc = parseWorkflow(read(file));
  const out = [];
  Object.keys(doc.jobs || {}).forEach((job) => {
    (doc.jobs[job].steps || []).forEach((step) => { if (step.run !== undefined) out.push(step.run); });
  });
  return out;
}

function isSetup(command) {
  return SETUP.some((p) => p.test(command));
}

test('в CI нет проверки, которой нет в профиле', () => {
  const runs = [];
  CHECKS.forEach((file) => runsOf(file).forEach((command) => runs.push({ file: file, command: command })));
  assert.ok(runs.length > 0, 'в рабочих процессах не нашлось ни одной команды — разбор сломался');

  const known = [];
  PROFILES.forEach((p) => profiles[p].forEach((c) => known.push(c)));
  runs.forEach((entry) => {
    if (isSetup(entry.command)) return;
    // Вызов профиля — это и есть профиль: `pnpm run verify` в CI назван профилем.
    const script = scriptOf(entry.command);
    const callsProfile = script !== null && PROFILE_SCRIPTS.indexOf(script) >= 0;
    assert.ok(callsProfile || known.indexOf(entry.command) >= 0,
      'в ' + entry.file + ' шаг «' + entry.command + '» не входит ни в один профиль:'
        + ' проверка в CI, которой нет локально');
  });

  // Профили, которые зовёт CI, названы: у каждого — своё имя работы.
  assert.ok(runs.some((r) => r.command === 'pnpm run verify'),
    'в CI нет ни одного зова `pnpm run verify`: обязательный чек не назван');
  assert.ok(runs.some((r) => r.command === 'pnpm run verify:slow'),
    'slow-профиль в CI не зовётся: покрытие не стережёт никто');

  // Обязательный чек назван по имени: работа `verify` — то, что станет required.
  const ci = parseWorkflow(read('.github/workflows/ci.yml'));
  assert.ok(ci.jobs.verify !== undefined, 'в описании CI нет работы «verify»');
});

test('выпуск зовёт проверки теми же скриптами, что профиль', () => {
  const scriptsOfProfile = [];
  PROFILES.forEach((p) => profiles[p].forEach((c) => scriptsOfProfile.push(scriptOf(c))));
  runsOf('.github/workflows/release.yml').forEach((command) => {
    [...command.matchAll(/pnpm (?:run )?([a-z][a-z:.-]*)/g)].forEach((m) => {
      const script = m[1];
      // Не всё, что начинается с `pnpm`, — скрипт: `pnpm install` и встроенные
      // команды менеджера проверками не являются.
      if (NOT_SCRIPT.indexOf(script) >= 0) return;
      assert.ok(scriptsOfProfile.indexOf(script) >= 0 || PROFILE_SCRIPTS.indexOf(script) >= 0,
        'выпуск зовёт «' + script + '» — скрипта нет ни в одном профиле: проверка мимо профиля');
    });
  });
});

test('хуки зовут профиль, а не свои команды', () => {
  const preCommit = read('.githooks/pre-commit');
  const prePush = read('.githooks/pre-push');
  const commitMsg = read('.githooks/commit-msg');
  assert.match(preCommit, /pnpm run verify:fast/, 'pre-commit не зовёт быстрый профиль');
  assert.match(prePush, /pnpm run verify:fast/, 'pre-push не зовёт быстрый профиль');
  assert.match(commitMsg, /tools\/gates\/gatefiles\.js/, 'commit-msg не защищает гейт-файлы');
  // Хук зовёт профиль — значит в хуке нет проверки, которой нет в `verify`.
  [preCommit, prePush].forEach((text) => {
    [...text.matchAll(/pnpm run ([a-z:.-]+)/g)].forEach((m) => {
      assert.ok(scriptOf('pnpm run ' + m[1]) !== null, 'хук зовёт «' + m[1] + '», которого нет');
    });
  });
});

test('машинные отчёты датчиков не попадают в историю', () => {
  const ignore = read('.gitignore');
  assert.match(ignore, /^reports\/$/m, 'каталог `reports/` не в .gitignore: отчёты уедут в историю');
  assert.match(ignore, /^node_modules\/$/m, 'каталог зависимостей не в .gitignore');
  // Отчёты пишутся в один корень (`tools/gates/common.js`, `REPORTS`) — названный
  // каталог обязан совпадать с этим именем.
  assert.match(read('tools/gates/common.js'), /'reports'/,
    'каталог отчётов называется иначе, чем в .gitignore');
});

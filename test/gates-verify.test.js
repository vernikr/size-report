/* The guard of the rule "one command is the source of truth": the check profiles
 * (`tools/gates/run.js`), the workflows (`.github/workflows/`) and the hooks (`.githooks/`) have to say
 * one and the same thing.
 *
 * The defect class it exists for: a check lives in CI and not in the profile — then it is green locally
 * and red in CI (or the other way round), and "I ran the checks" stops meaning anything. With a second
 * list of commands that drifts in silence, so a check catches the drift rather than attentiveness.
 *
 * What is compared: every profile step is an existing manifest script; the profiles are nested (fast ⊂
 * full ⊂ slow); every `run:` of a workflow is either setup or a call of a profile; the hooks call the
 * profile rather than commands of their own; the sensors' reports never reach the history.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, exec, pkg } from '../tools/gate-probe.js';
import { parseWorkflow } from '../tools/yaml.js';

const PROFILES = ['fast', 'full', 'slow'];

/* The profile scripts: `pnpm run verify` is the profile itself rather than a step inside one. */
const PROFILE_SCRIPTS = ['verify', 'verify:fast', 'verify:slow'];

/* A step covered by another: the fast suite is part of the full one (guarded by `tools/suites.js` and
 * `test/suites.test.js`), so the fast profile with `test` nests inside the full one with `test:all`. */
const SUBSUMED = { test: 'test:all' };
/* Setup and preparation are no check: their place is in CI rather than in a profile. The list is
 * deliberately narrow (installing the manager, preparing the branch) so that "setup" does not become a
 * way to smuggle a check into CI past the profile. */
const SETUP = [/^pnpm install /, /^git fetch /, /^npm install -g /];

/* The workflows with checks: here every command is either preparation or a call of a profile. The
 * release (`release.yml`) is not among them: it publishes rather than checks, and all that is required of
 * it is that the checks it calls are named by the same scripts. */
const CHECKS = ['.github/workflows/ci.yml', '.github/workflows/verify-slow.yml'];

/* Not checks but package work: their place is in a release and in an install. */
const NOT_SCRIPT = ['install', 'exec', 'dlx', 'add', 'remove', 'why', 'audit', 'dedupe', 'publish'];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function stepsOf(profile) {
  const res = exec(process.execPath, ['tools/gates/run.js', '--list', profile]);
  assert.equal(res.code, 0, 'профиль «' + profile + '» не печатает список шагов:\n' + res.out);
  return res.out.split('\n').map((l) => l.trim()).filter((l) => l !== '');
}

/* A profile step is named by the command `pnpm run <script>`; environment variables come as a prefix. */
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
    // A call of a profile is the profile: `pnpm run verify` in CI is named by the profile.
    const script = scriptOf(entry.command);
    const callsProfile = script !== null && PROFILE_SCRIPTS.indexOf(script) >= 0;
    assert.ok(callsProfile || known.indexOf(entry.command) >= 0,
      'в ' + entry.file + ' шаг «' + entry.command + '» не входит ни в один профиль:'
        + ' проверка в CI, которой нет локально');
  });

  // The profiles CI calls are named: each has a job name of its own.
  assert.ok(runs.some((r) => r.command === 'pnpm run verify'),
    'в CI нет ни одного зова `pnpm run verify`: обязательный чек не назван');
  assert.ok(runs.some((r) => r.command === 'pnpm run verify:slow'),
    'slow-профиль в CI не зовётся: покрытие не стережёт никто');

  // The required check is named by name: the job `verify` is the one CI requires.
  const ci = parseWorkflow(read('.github/workflows/ci.yml'));
  assert.ok(ci.jobs.verify !== undefined, 'в описании CI нет работы «verify»');
});

test('выпуск зовёт проверки теми же скриптами, что профиль', () => {
  const scriptsOfProfile = [];
  PROFILES.forEach((p) => profiles[p].forEach((c) => scriptsOfProfile.push(scriptOf(c))));
  runsOf('.github/workflows/release.yml').forEach((command) => {
    [...command.matchAll(/pnpm (?:run )?([a-z][a-z:.-]*)/g)].forEach((m) => {
      const script = m[1];
      // Not everything starting with `pnpm` is a script: `pnpm install` and the manager's built-in
      // commands are no checks.
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
  // The hook calls the profile — so it holds no check that `verify` does not.
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
  // Reports are written to one root (`tools/gates/common.js`, `REPORTS`) — the directory named here has
  // to match that name.
  assert.match(read('tools/gates/common.js'), /'reports'/,
    'каталог отчётов называется иначе, чем в .gitignore');
});

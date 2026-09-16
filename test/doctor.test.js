/* Diagnostics in a single answer (`size doctor`): environment, optional dependencies, settings and
 * coverage — one answer, with an exit code an agent branches on and text a person reads.
 *
 * What is checked is not a happy run but every state of the project on its own: no settings (0 — they are
 * derived from the project), unreadable settings (2), full coverage (0), incomplete coverage (1), a
 * truncated history (3), a missing optional dependency (4) and a file the measurement cannot parse (2).
 * The answer has to match the state rather than be green always — hence the exit codes and the causes
 * named are what is under test.
 *
 * The answer is assembled from the same pieces as the other commands, and that is proved by comparison
 * rather than by description: the coverage block of the `doctor` answer has to be deep-equal to the whole
 * answer `size check` gives — a second calculation would drift from the first in silence. It is compared
 * as data rather than as bytes: one answer in two places, not two renderings of it.
 *
 * The cost is the seven states, each a process run and a pass over the history.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NO_OPTIONAL } from '../src/optional.js';
import {
  CONFIG, firstLine, gitIn, gitTry, hasStack, initRepo, readJson, runSize, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('doctor');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const PLAIN = sharedClone('plain', tmp);
const OFF = { [NO_OPTIONAL]: '1' };

// The fixture's path left outside the columns, and the commit that brought it in.
const LOOSE = 'README.md';
const LOOSE_SINCE = '3294a69';

// A copy of the reference settings with an edit: the project's state is set point by point while the
// history stays the same, so numbers and causes are comparable between cases.
function configAs(name, edit) {
  const cfg = JSON.parse(JSON.stringify(readJson(CONFIG)));
  const file = path.join(tmp, name);
  fs.writeFileSync(file, JSON.stringify(edit(cfg), null, 2) + '\n');
  return file;
}

// A fresh project: two commits and no settings at all — what a first run sees.
function freshRepo(name) {
  const dir = initRepo(path.join(tmp, name));
  fs.writeFileSync(path.join(dir, 'src', 'code.js'), '// начало\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'начало']);
  fs.appendFileSync(path.join(dir, 'src', 'code.js'), 'var width = 1;\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'правка']);
  return dir;
}

test('свежий проект без настроек: работает на выведенных, и это названо', () => {
  const dir = freshRepo('fresh');

  const res = runSize(dir, ['doctor']);
  assert.equal(res.code, 0, 'проект без настроек не собрался: ' + firstLine(res.stdout + res.stderr));
  assert.equal(hasStack(res.stdout + res.stderr), false, 'ответ пришёл стеком вместо объяснения');
  assert.match(res.stdout + res.stderr, /settings derived from the project/,
    'ответ умолчал, откуда взялись настройки:\n' + res.stdout + res.stderr);
  assert.match(res.stdout + res.stderr, /--init/, 'нет команды, которой настройки закрепляются');
  assert.match(res.stdout, /покрытие:/, 'покрытие не сосчитано, хотя настройки есть:\n' + res.stdout);

  const rep = JSON.parse(runSize(dir, ['doctor', '--json']).stdout);
  assert.equal(rep.schema, 1, 'у ответа нет схемы — агенту не на что ветвиться');
  assert.equal(rep.exit, 0, 'код выхода в ответе не тот');
  assert.equal(rep.config.ok, true, 'выведенные настройки объявлены нечитаемыми');
  assert.equal(rep.config.derived, true, 'в ответе не сказано, что настройки выведены');
  assert.equal(rep.coverage.ok, true, 'покрытие свежего проекта объявлено неполным');

  /* Fixing them in a file closes the question: afterwards the settings are the project's own, and the
   * answer says so. */
  const init = runSize(dir, ['--init']);
  assert.equal(init.code, 0, '--init не закрепил настройки: ' + firstLine(init.stderr));
  const fixed = JSON.parse(runSize(dir, ['doctor', '--json']).stdout);
  assert.equal(fixed.config.derived, false, 'после --init настройки всё ещё названы выведенными');
  assert.equal(fixed.exit, 0, 'после закрепления проект перестал быть здоровым');

  // The derived profile asks the minifier and the dictionary — so the answer about dependencies is not
  // "unknown": it is the same question as with settings fixed in a file.
  assert.equal(rep.dependencies.every((d) => d.present !== null), true,
    'о зависимостях не спрошено, хотя настройки прочлись: ' + JSON.stringify(rep.dependencies));
});

/* The default has to cover the project: a column is every measurable tracked file, `skip` the rest. A
 * sample instead of the whole project lies about it (names its volume by a handful of files) and leaves a
 * person to sort out the difference. This project holds two `.js` files: a choice of "one column per
 * extension" would leave a single one, so such a choice fails here. */
test('свежий проект без настроек: колонкой идёт каждый отслеживаемый файл', () => {
  const dir = initRepo(path.join(tmp, 'default'));
  const write = (p, text) => fs.writeFileSync(path.join(dir, p), text);
  write('README.md', '# проект\n');
  write('src/one.js', '// один\nvar a = 1;\n');
  write('src/two.js', '// два\nvar b = 2;\n');
  write('LICENSE', 'MIT\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'начало']);
  // A file outside git is no project file: it does not become a column, and it stands in the report's
  // tree only because the tree comes from the project's paths rather than from the disk.
  fs.writeFileSync(path.join(dir, 'untracked.js'), '// не в git\n');

  const draft = path.join(tmp, 'default.json');
  assert.equal(runSize(dir, ['--init', draft]).code, 0, 'черновик настроек не собрался');
  const cfg = readJson(draft);
  assert.deepEqual(cfg.columns.map((c) => c.paths[0]).sort(),
    ['README.md', 'src/one.js', 'src/two.js'], 'в колонки попала не вся выборка проекта');
  assert.deepEqual(cfg.skip.slice().sort(), ['LICENSE', 'docs/size-report.html'],
    'исключения названы не те: колонкой идёт всё, что можно измерить, а не выборка');
  assert.equal(cfg.columns.every((c) => c.paths.length === 1), true,
    'колонка названа группой путей: колонка — это файл');
  assert.equal(runSize(dir, ['check']).code, 0,
    'первый же `check` на выведенных настройках красный — профиль не покрывает проект');
});

/* Unreadable settings: the cause and the fix are the same as for any refusal, but the answer is honestly
 * incomplete — there is nothing to count coverage with and nobody to ask the sensors — and it says so in
 * words rather than in invented values. */
test('нечитаемые настройки: код 2, причина названа, покрытие не выдумано', () => {
  const bad = path.join(tmp, 'broken.json');
  fs.writeFileSync(bad, JSON.stringify({
    columns: [{ label: 'code.js', paths: ['src/code.js'] }], metrics: ['none']
  }, null, 2) + '\n');

  const res = runSize(PLAIN, ['--config', bad, 'doctor']);
  assert.equal(res.code, 2, 'нечитаемые настройки обработаны не как отказ: '
    + firstLine(res.stdout + res.stderr));
  assert.match(res.stdout, /unknown metric/, 'ответ не назвал причину:\n' + res.stdout);
  assert.match(res.stdout, /нечитаемы/, 'ответ умолчал, что настроек нет:\n' + res.stdout);

  const rep = JSON.parse(runSize(PLAIN, ['--config', bad, 'doctor', '--json']).stdout);
  assert.equal(rep.ok, false, 'на нечитаемых настройках ответ объявлен благополучным');
  assert.equal(rep.config.ok, false, 'настройки объявлены читаемыми');
  assert.equal(rep.coverage, null, 'покрытие выдумано при нечитаемых настройках');
  assert.deepEqual(rep.dependencies.map((d) => d.present), [null, null],
    'зависимости названы известными, хотя настройки ещё не прочитаны');
});

test('полное покрытие: ответ говорит «делать нечего» и не выдумывает проблем', () => {
  const file = configAs('full.json', (cfg) => { cfg.skip = [LOOSE]; return cfg; });

  const res = runSize(PLAIN, ['--config', file, 'doctor']);
  assert.equal(res.code, 0, 'здоровый проект не принят (код ' + res.code + '):\n' + res.stdout + res.stderr);
  assert.match(firstLine(res.stdout), /^✓ /, 'ответ не начинается с подтверждения:\n' + res.stdout);

  const rep = JSON.parse(runSize(PLAIN, ['--config', file, 'doctor', '--json']).stdout);
  assert.equal(rep.ok, true, 'на здоровом проекте ответ не «делать нечего»');
  assert.equal(rep.exit, 0);
  assert.equal(rep.coverage.ok, true, 'покрытие здорового проекта объявлено неполным');
  assert.deepEqual(rep.findings, [], 'на здоровом проекте выдумана находка: ' + JSON.stringify(rep.findings));
});

test('неполное покрытие: код 1, путь назван, и это тот же ответ, что у check', () => {
  const res = runSize(PLAIN, ['--config', CONFIG, 'doctor']);
  assert.equal(res.code, 1, 'неполное покрытие не стало нарушением: ' + firstLine(res.stdout));
  assert.ok(res.stdout.indexOf(LOOSE) >= 0, 'не назван непокрытый путь:\n' + res.stdout);
  assert.ok(res.stdout.indexOf(LOOSE_SINCE) >= 0, 'не назван коммит, заведший путь:\n' + res.stdout);

  const rep = JSON.parse(runSize(PLAIN, ['--config', CONFIG, 'doctor', '--json']).stdout);
  assert.equal(rep.ok, false);
  assert.equal(rep.exit, 1);
  assert.deepEqual(rep.coverage.paths.unknown.map((u) => u.path), [LOOSE]);

  /* Assembly rather than a second calculation: the coverage block is exactly the answer `size check`
   * gives. Were they to drift apart, a person would get two different answers to one question. */
  const chk = JSON.parse(runSize(PLAIN, ['--config', CONFIG, 'check', '--json']).stdout);
  assert.deepEqual(rep.coverage, chk, 'doctor считает покрытие иначе, чем check');
});

test('обрезанная история: код 3 и команда докачки, а не «покрытия нет»', () => {
  const dir = path.join(tmp, 'shallow');
  const clone = gitTry(null, ['clone', '-q', '--depth', '1', 'file://' + PLAIN, dir]);
  assert.equal(clone.status, 0, 'не удалось собрать обрезанную выкладку: ' + firstLine(clone.stderr));
  assert.equal(gitIn(dir, ['rev-parse', '--is-shallow-repository']).trim(), 'true',
    'выкладка вышла полной: проверять нечего');

  const res = runSize(dir, ['--config', CONFIG, 'doctor']);
  assert.equal(res.code, 3, 'обрезанная история обработана не как обрезанная: ' + firstLine(res.stdout));
  assert.match(res.stdout, /--unshallow/, 'нет команды докачки:\n' + res.stdout);

  const rep = JSON.parse(runSize(dir, ['--config', CONFIG, 'doctor', '--json']).stdout);
  assert.equal(rep.environment.shallow, true, 'в ответе не сказано, что история обрезана');
  assert.equal(rep.coverage, null, 'по обрезанной истории посчитано покрытие');
});

/* Two things refuse inside coverage, and the difference is visible to a person: a truncated history is
 * repaired by fetching it, while a file the measurement cannot parse is repaired in the settings. So the
 * step names the kind of circumstance by the refusal's code, and this check holds that choice: the advice
 * "fetch the history" would name a cause that is not there. */
test('файл, которого измерение не разбирает: код 2 и правка настроек, а не докачка истории', () => {
  const dir = freshRepo('unparsed');
  fs.writeFileSync(path.join(dir, 'src', 'bad.js'), '@@@ это не JavaScript\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'не JavaScript']);
  const file = configAs('unparsed.json', (cfg) => {
    cfg.columns = [{ label: 'bad.js', paths: ['src/bad.js'] }];
    cfg.skip = ['src/code.js'];
    return cfg;
  });

  const res = runSize(dir, ['--config', file, 'doctor']);
  assert.equal(res.code, 2, 'неразобранный файл обработан как обрезанная история: '
    + firstLine(res.stdout + res.stderr));
  assert.match(res.stdout, /is not JavaScript/, 'ответ не назвал причину:\n' + res.stdout);
  assert.equal(res.stdout.indexOf('--unshallow'), -1,
    'починка отправляет докачивать историю, которой дело не касается:\n' + res.stdout);

  const rep = JSON.parse(runSize(dir, ['--config', file, 'doctor', '--json']).stdout);
  assert.equal(rep.exit, 2, 'код выхода в ответе не тот');
  assert.equal(rep.coverage, null, 'покрытие посчитано, хотя измерение отказало');
  assert.equal(rep.findings.filter((f) => f.level === 'action').length, 1,
    'отказ измерения не назван находкой: ' + JSON.stringify(rep.findings));
});

test('приближение датчика: код 4 с причиной и готовой починкой', () => {
  const file = configAs('esbuild.json', (cfg) => {
    cfg.skip = [LOOSE];
    cfg.minify = { engine: 'esbuild', ext: {}, guard: ['.js', '.mjs', '.cjs'] };
    return cfg;
  });

  const res = runSize(PLAIN, ['--config', file, 'doctor'], OFF);
  assert.equal(res.code, 4, 'приближение ушло как успех: ' + firstLine(res.stdout + res.stderr));
  assert.match(res.stdout, /"engine": "strip"/, 'нет готовой починки:\n' + res.stdout);

  const rep = JSON.parse(runSize(PLAIN, ['--config', file, 'doctor', '--json'], OFF).stdout);
  assert.equal(rep.exit, 4);
  assert.equal(rep.ok, false, 'приближённый счёт объявлен благополучием');
  assert.equal(rep.dependencies.find((d) => d.name === 'esbuild').present, false,
    'недоступный минификатор назван доступным');
});

/* Completeness outranks accuracy of the count: without it there are no numbers at all, while an
 * approximate number is still a number. So with two findings the exit code carries incompleteness, and the
 * approximation names itself in the text. */
test('две находки сразу: код выхода несёт та, без которой чисел нет', () => {
  const file = configAs('both.json', (cfg) => {
    cfg.minify = { engine: 'esbuild', ext: {}, guard: ['.js', '.mjs', '.cjs'] };
    return cfg;
  });

  const rep = JSON.parse(runSize(PLAIN, ['--config', file, 'doctor', '--json'], OFF).stdout);
  assert.equal(rep.coverage.ok, false, 'покрытие фикстуры объявлено полным');
  assert.equal(rep.coverage.sensors.length, 1, 'недоступный минификатор не назван датчиком');
  assert.equal(rep.exit, 1, 'код выхода несёт не самую важную находку');
  assert.equal(rep.findings.filter((f) => f.level === 'action').length, 1,
    'починка датчика не названа вместе с неполнотой: ' + JSON.stringify(rep.findings));
});

/* A sensor the settings are silent about is not "unknown whether present" but unneeded: the dictionary
 * weighs megabytes, and asking for it where no metric asked would mean paying for an answer the numbers
 * never needed (the same rule as in the report — `test/tokens.test.js`). */
test('датчик, о котором настройки молчат, назван ненужным, а не отсутствующим', () => {
  const rep = JSON.parse(runSize(PLAIN, ['--config', CONFIG, 'doctor', '--json']).stdout);
  const tokens = rep.dependencies.find((d) => d.name === 'gpt-tokenizer');
  assert.equal(tokens.present, null, 'словарь спрошен там, где метрика его не просила');
  assert.match(tokens.note, /не спрашивается/, 'молчание о датчике не объяснено: ' + tokens.note);
});

test('doctor аргументов не принимает: лишнее слово — отказ, а не пропуск', () => {
  const res = runSize(PLAIN, ['doctor', 'extra']);
  assert.equal(res.code, 2, 'лишнее слово у doctor не отказ: ' + firstLine(res.stdout + res.stderr));
  assert.equal(hasStack(res.stderr), false, 'отказ напечатал стек');
  assert.match(res.stderr, /"extra" is extra/, 'отказ назвал не причину, а команду:\n' + res.stderr);
  assert.match(res.stderr, /fix/, 'отказ не даёт готовой команды:\n' + res.stderr);
});

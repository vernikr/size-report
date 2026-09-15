/* Диагностика одним ответом (`size doctor`): окружение, необязательные
 * зависимости, настройки и покрытие — в одном ответе, с кодом выхода, по которому
 * ветвится агент, и текстом, который читает человек.
 *
 * Проверяется не «благополучный прогон», а каждое состояние проекта по
 * отдельности: без настроек (код 2), с полным покрытием (0), с неполным (1), с
 * обрезанной историей (3), без необязательной зависимости (4) и с файлом, которого
 * измерение не разбирает (2). Ответ обязан совпадать с состоянием, а не быть всегда
 * зелёным, — поэтому коды выхода и названные причины и есть предмет проверки.
 *
 * Собирается ответ из тех же кусков, что и остальные команды, и это доказывается
 * не описанием, а сверкой: блок покрытия в ответе `doctor` обязан быть байт в байт
 * тем же, что весь ответ `size check`, — второй расчёт разошёлся бы с первым молча.
 *
 * Цена названа в бюджете времени (`REFACTOR.md` §3): случаев шесть, каждый — прогон
 * процесса и проход по истории.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NO_OPTIONAL } from '../src/optional.js';
import {
  CONFIG, firstLine, gitIn, gitTry, hasStack, readJson, runSize, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('doctor');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const PLAIN = sharedClone('plain', tmp);
const OFF = { [NO_OPTIONAL]: '1' };

// Путь фикстуры, оставшийся мимо колонок, и коммит, который его завёл.
const LOOSE = 'README.md';
const LOOSE_SINCE = '3294a69';

// Копия эталонных настроек с правкой: состояние проекта задаётся точечно, а
// история остаётся той же, поэтому числа и причины сравнимы между случаями.
function configAs(name, edit) {
  const cfg = JSON.parse(JSON.stringify(readJson(CONFIG)));
  const file = path.join(tmp, name);
  fs.writeFileSync(file, JSON.stringify(edit(cfg), null, 2) + '\n');
  return file;
}

// Свежий проект: два коммита и ни одной настройки — то, что видит первый запуск.
function freshRepo(name) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  gitIn(dir, ['init', '-q', '-b', 'main']);
  ['user.name', 'user.email', 'commit.gpgsign'].forEach((key, i) => {
    gitIn(dir, ['config', key, ['fixture', 'fixture@local', 'false'][i]]);
  });
  fs.writeFileSync(path.join(dir, 'src', 'code.js'), '// начало\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'начало']);
  fs.appendFileSync(path.join(dir, 'src', 'code.js'), 'var width = 1;\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'правка']);
  return dir;
}

test('свежий проект без настроек: код 2, причина и починка названы', () => {
  const dir = freshRepo('fresh');

  const res = runSize(dir, ['doctor']);
  assert.equal(res.code, 2, 'проект без настроек не отказ: ' + firstLine(res.stdout + res.stderr));
  assert.equal(hasStack(res.stdout + res.stderr), false, 'ответ пришёл стеком вместо объяснения');
  assert.match(res.stdout, /size-table\.config\.json/, 'не назван файл настроек:\n' + res.stdout);
  assert.match(res.stdout, /--init/, 'нет готовой команды починки:\n' + res.stdout);
  assert.match(res.stdout, /покрытие не считалось/, 'ответ умолчал, что покрытия нет:\n' + res.stdout);

  const rep = JSON.parse(runSize(dir, ['doctor', '--json']).stdout);
  assert.equal(rep.schema, 1, 'у ответа нет схемы — агенту не на что ветвиться');
  assert.equal(rep.ok, false, 'на нечитаемых настройках ответ объявлен благополучным');
  assert.equal(rep.exit, 2, 'код выхода в ответе не тот');
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

  /* Сборка, а не второй расчёт: блок покрытия — это ровно ответ `size check`.
   * Разойдись они, человек получил бы два разных ответа на один вопрос. */
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

/* Внутри покрытия отказывают двое, и разница видна человеку: у обрезанной истории
 * починка — докачка, а у файла, которого измерение не разбирает, — правка настроек.
 * Поэтому шаг называет вид обстоятельства по коду отказа, и эта проверка держит сам
 * выбор: совет «докачайте историю» назвал бы причину, которой нет. */
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
  assert.match(res.stdout, /не JavaScript/, 'ответ не назвал причину:\n' + res.stdout);
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

/* Полнота важнее точности счёта: без неё чисел нет вовсе, а приближённое число
 * всё-таки есть. Поэтому при двух находках код выхода несёт неполнота, а
 * приближение называет себя текстом. */
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

/* Датчик, о котором настройки молчат, — не «неизвестно есть или нет», а ненужный:
 * словарь весит мегабайты, и спрашивать его там, где метрика не просила, значило бы
 * платить за ответ, которого у чисел не было (то же правило у отчёта —
 * `test/tokens.test.js`). */
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
  assert.match(res.stderr, /«extra» лишний/, 'отказ назвал не причину, а команду:\n' + res.stderr);
  assert.match(res.stderr, /починка/, 'отказ не даёт готовой команды:\n' + res.stderr);
});

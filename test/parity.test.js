/* Паритет-тест: перенос движка обязан ничего не изменить — ни числа, ни форму
 * отчёта — и доказывается это автоматической сверкой, а не глазами.
 *
 * Что с чем сверяется. Три вещи хранят одну и ту же правду, снятую с текущей
 * реализации (`fixtures/legacy/size-table.cjs`, sha256 которой совпадает с
 * `fixtures/parity/manifest.json`):
 *
 *   1. живой проект — `fixtures/parity/` (числа и хеш артефакта на коммите);
 *   2. синтетическая история — `fixtures/synthetic/` (бандл, конфиг, эталонные
 *      числа и хеш артефакта);
 *   3. замороженная копия реализации — она запускается рядом с движком пакета.
 *
 * Цель — движок пакета (`bin/size.js`). Замороженная копия сверяется затем, чтобы
 * провал нельзя было списать на расхождение самого эталона: если копия совпадает с
 * эталоном, а пакет нет — изменился перенос, и только он.
 *
 * Зависимости от машины. Работает это по-разному у двух целей, и разница
 * осознанная. Замороженная копия — движок **до** починки B1: она читает настройки
 * git из окружения, поэтому её числа сверяются в том окружении, в котором снят
 * эталон (`core.quotePath=false`). Движок пакета закрепляет настройки сам, на
 * границе вызова git, и потому обязан совпасть с эталоном **и** в обычном
 * окружении, **и** в заведомо чужом: с настройками машины по умолчанию, с
 * включённым `core.quotePath`, с раскраской и с другой локалью. Это и есть
 * доказательство герметичности (`BLOCKERS.md` §B1, закрыт).
 *
 * Живой проект сверяется отдельно и медленнее — `pnpm run parity:live`: там
 * клонируется настоящая история на 149 коммитов, и в общий прогон это не место.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTH = path.join(ROOT, 'fixtures', 'synthetic');
const PARITY = path.join(ROOT, 'fixtures', 'parity');
const LEGACY = path.join(ROOT, 'fixtures', 'legacy', 'size-table.cjs');
const BUNDLE = path.join(SYNTH, 'history.bundle');
const CONFIG = path.join(SYNTH, 'config.json');
const PACKAGE_BIN = path.join(ROOT, 'bin', 'size.js');
const MAX_BUF = 256 * 1024 * 1024;

/* Настройки git через окружение (git ≥ 2.31): так тест задаёт машине чужие
 * правила, не трогая ни её конфиг, ни фикстуру. */
function gitConfig(pairs) {
  const env = { GIT_CONFIG_COUNT: String(Object.keys(pairs).length) };
  Object.keys(pairs).forEach((key, i) => {
    env['GIT_CONFIG_KEY_' + i] = key;
    env['GIT_CONFIG_VALUE_' + i] = pairs[key];
  });
  return env;
}

// Окружение, в котором снят эталон: движок до починки B1 без него не воспроизводим.
const CAPTURE_ENV = gitConfig({ 'core.quotePath': 'false' });

/* Цели: движок пакета и замороженная копия, каждая со своим окружением. */
const PACKAGE = { name: 'движок пакета', file: PACKAGE_BIN, env: null };
const FROZEN = { name: 'замороженная копия реализации', file: LEGACY, env: CAPTURE_ENV };

/* Окружения, в которых вывод обязан остаться тем же: каждое по-своему могло бы
 * подмешаться в разбор. */
const HOSTILE_ENVS = [
  { label: 'настройки машины не читаются (GIT_CONFIG_GLOBAL=/dev/null)', env: { GIT_CONFIG_GLOBAL: '/dev/null' } },
  { label: 'core.quotePath=true', env: gitConfig({ 'core.quotePath': 'true' }) },
  {
    label: 'core.quotePath=true, color.ui=always, i18n.logOutputEncoding=ISO-8859-1',
    env: gitConfig({
      'core.quotePath': 'true',
      'color.ui': 'always',
      'i18n.logOutputEncoding': 'ISO-8859-1'
    })
  },
  { label: 'LC_ALL=C, LANG=C', env: { LC_ALL: 'C', LANG: 'C' } }
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-parity-'));
let clones = 0;
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Хеш, записанный в формате `sha256sum`: «<хеш>  <файл>».
function shaFileLine(file) {
  return fs.readFileSync(file, 'utf8').split(/\s+/)[0];
}

function cloneFixture() {
  const dir = path.join(tmp, 'fixture-' + (clones++));
  execFileSync('git', ['clone', '-q', BUNDLE, dir], { encoding: 'utf8', maxBuffer: MAX_BUF });
  return dir;
}

// Запуск инструмента ровно так, как его зовёт пользователь: `node <файл> --config …`.
function runCli(target, dir, args, env) {
  const res = spawnSync(process.execPath, [target.file, '--config', CONFIG].concat(args || []), {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: MAX_BUF,
    env: Object.assign({}, process.env, target.env || {}, env || {})
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function requireTarget(target) {
  assert.ok(fs.existsSync(target.file),
    'нет ' + path.relative(ROOT, target.file) + ' — движок ещё не перенесён в раскладку пакета');
}

/* Расхождение должно объяснять себя: номер первой разошедшейся строки и обе
 * строки целиком — иначе «JSON не совпал» ничего не говорит о причине. */
function firstDiff(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) {
      return 'строка ' + (i + 1) + '\n    в выводе: ' + JSON.stringify((la[i] || '').slice(0, 160))
        + '\n    в эталоне: ' + JSON.stringify((lb[i] || '').slice(0, 160));
    }
  }
  return 'различие в байтах при одинаковых строках (переводы строк или кодировка)';
}

const golden = fs.readFileSync(path.join(SYNTH, 'golden.json'));
const goldenText = golden.toString('utf8');
const goldenJson = JSON.parse(goldenText);
const parityManifest = readJson(path.join(PARITY, 'manifest.json'));

/* ---------- эталон и его источник ---------- */

test('эталон снят с той самой ревизии, которую заморозили рядом', () => {
  assert.equal(sha256(fs.readFileSync(LEGACY)), parityManifest.tool.sha256,
    'замороженная копия разошлась с ревизией, с которой снят эталон паритета');
  const synth = readJson(path.join(SYNTH, 'manifest.json'));
  assert.equal(synth.legacy.sha256, parityManifest.tool.sha256,
    'числа фикстуры сняты другой ревизией инструмента, чем числа живого проекта');
  assert.equal(sha256(golden), synth.legacy.goldenSha256,
    'файл эталонных чисел изменён после снятия');
});

test('фикстура и живой проект сняты одним инструментом', () => {
  assert.equal(readJson(path.join(SYNTH, 'manifest.json')).legacy.file.split('/').pop(),
    parityManifest.tool.file.split('/').pop(),
    'эталоны сняты разными инструментами');
});

/* ---------- паритет на синтетической истории ---------- */

for (const target of [PACKAGE, FROZEN]) {
  test(target.name + ': --json побайтово равен эталону', () => {
    requireTarget(target);
    const res = runCli(target, cloneFixture(), ['--json']);
    assert.equal(res.code, 0, 'инструмент не отдал --json (код ' + res.code + '): ' + res.stderr.trim());
    assert.equal(res.stdout, goldenText,
      'вывод --json разошёлся с эталоном: ' + firstDiff(res.stdout, goldenText));
  });

  test(target.name + ': --write собирает тот же артефакт и проходит контроль', () => {
    requireTarget(target);
    const dir = cloneFixture();
    const wrote = runCli(target, dir, ['--write']);
    assert.equal(wrote.code, 0, 'инструмент не собрал артефакт: ' + wrote.stderr.trim());

    const artifact = fs.readFileSync(path.join(dir, 'docs', 'size-table.html'));
    assert.equal(sha256(artifact), shaFileLine(path.join(SYNTH, 'artifact.sha256')),
      'артефакт разошёлся с эталонным побайтово (эталон ' + goldenJson.rows.length + ' строк × '
        + goldenJson.columns.length + ' колонок)');

    const checked = runCli(target, dir, []);
    assert.equal(checked.code, 0,
      'контрольный режим красный на своём же артефакте: ' + checked.stderr.trim());

    const rows = /: (\d+) строк × (\d+) файлов/.exec(wrote.stdout);
    assert.ok(rows, 'сборка не отчиталась числом строк: ' + wrote.stdout.trim());
    assert.equal(Number(rows[1]), goldenJson.rows.length, 'число строк разошлось с эталоном');
    assert.equal(Number(rows[2]), goldenJson.columns.length, 'число колонок разошлось с эталоном');
  });

  test(target.name + ': числа не зависят от локали', () => {
    requireTarget(target);
    const res = runCli(target, cloneFixture(), ['--json'], { LC_ALL: 'C', LANG: 'C' });
    assert.equal(res.code, 0, 'под LC_ALL=C инструмент упал: ' + res.stderr.trim());
    assert.equal(res.stdout, goldenText,
      'под LC_ALL=C вывод разошёлся с эталоном (пути вне ASCII читаются иначе): '
        + firstDiff(res.stdout, goldenText));
  });
}

/* ---------- герметичность окружения ---------- */

test('окружение теста умеет задавать настройки git (нужен git ≥ 2.31)', () => {
  const res = spawnSync('git', ['config', '--get', 'core.quotePath'], {
    encoding: 'utf8', env: Object.assign({}, process.env, gitConfig({ 'core.quotePath': 'true' }))
  });
  assert.equal((res.stdout || '').trim(), 'true',
    'git не принимает настройки через окружение: чужие правила машины задать нечем, '
      + 'а значит герметичность нечем и проверить');
});

/* Ключ командной строки сильнее и настроек машины, и настроек из окружения — на
 * этом стоит вся починка: закрепление живёт в движке, а не в чужом конфиге. */
test('закрепление движка нельзя перебить из окружения', () => {
  const res = spawnSync('git', ['-c', 'core.quotePath=false', 'config', '--get', 'core.quotePath'], {
    encoding: 'utf8', env: Object.assign({}, process.env, gitConfig({ 'core.quotePath': 'true' }))
  });
  assert.equal((res.stdout || '').trim(), 'false',
    'ключ командной строки больше не сильнее окружения: закрепление в движке ничего не гарантирует');
});

/* Главная проверка починки B1: чужое окружение не меняет ни одного байта вывода. */
test('вывод движка не зависит от настроек git и локали', () => {
  requireTarget(PACKAGE);
  const dir = cloneFixture();
  const base = runCli(PACKAGE, dir, ['--json']);
  assert.equal(base.stdout, goldenText, 'обычное окружение разошлось с эталоном: '
    + firstDiff(base.stdout, goldenText));

  HOSTILE_ENVS.forEach(({ label, env }) => {
    const res = runCli(PACKAGE, dir, ['--json'], env);
    assert.equal(res.code, 0, 'инструмент упал в окружении «' + label + '»: ' + res.stderr.trim());
    assert.equal(res.stdout, base.stdout,
      'окружение «' + label + '» изменило вывод: ' + firstDiff(res.stdout, base.stdout));
  });
});

/* Свидетель починки: то самое окружение, в котором фикстура раньше теряла строку.
 * Настроек машины здесь нет вовсе, то есть git ведёт себя как на большинстве
 * машин с установкой по умолчанию. */
test('в окружении без настроек машины фикстура даёт 14 строк и все колонки', () => {
  requireTarget(PACKAGE);
  const res = runCli(PACKAGE, cloneFixture(), ['--json'], { GIT_CONFIG_GLOBAL: '/dev/null' });
  assert.equal(res.code, 0, 'инструмент упал: ' + res.stderr.trim());
  const data = JSON.parse(res.stdout);

  assert.equal(data.rows.length, goldenJson.rows.length,
    'строк ' + data.rows.length + ' вместо ' + goldenJson.rows.length
      + ': в окружении с настройками git по умолчанию снова теряется коммит');
  assert.equal(data.skipped.length, goldenJson.skipped.length,
    'пропущено ' + data.skipped.length + ' коммитов вместо ' + goldenJson.skipped.length);

  // Колонка с не-английским путём: раньше она пустела целиком.
  const notes = data.columns.findIndex((c) => /[^\u0000-\u007f]/.test(c.label));
  assert.ok(notes >= 0, 'в фикстуре нет колонки с не-ASCII меткой');
  assert.ok(data.rows.some((r) => r.cells[notes] !== null),
    'колонка «' + data.columns[notes].label + '» пуста: файла для инструмента не существует');

  // Коммит, у которого эта колонка была единственным изменением объёма.
  assert.ok(data.rows.some((r) => r.subject === 'fixture: ветка — правка кода и заметок'),
    'коммит, терявший строку из-за колонки с не-ASCII путём, снова её не получил');
});

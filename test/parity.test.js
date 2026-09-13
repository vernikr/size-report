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
 * Цель теста — движок пакета (`bin/size.js`). Замороженная копия сверяется затем,
 * чтобы провал нельзя было списать на расхождение самого эталона: если копия
 * совпадает с эталоном, а пакет нет — изменился перенос, и только он.
 *
 * Зависимости от машины. `git` цитирует пути вне ASCII, когда `core.quotePath`
 * включён (а это его значение по умолчанию), и тогда эталонные числа этой машины
 * не воспроизводятся: колонка с не-английским путём пустеет, а коммит, у которого
 * она была единственным изменением объёма, теряет строку. Без закрепления тест был
 * бы зелёным здесь и красным на другой машине. Поэтому все сверки идут с
 * закреплённым `core.quotePath=false`, а сама зависимость проверяется отдельным
 * свидетелем, который утверждает обе потери (см. «известный пробел» и `BLOCKERS.md`, §B1).
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

/* Цель — движок пакета. Замороженная копия едет рядом: она доказывает, что эталон
 * и его источник согласованы, и что перенос виноват именно там, где провал. */
const TARGETS = [
  { name: 'движок пакета', file: PACKAGE_BIN },
  { name: 'замороженная копия реализации', file: LEGACY }
];

/* Закрепление настройки git через окружение (git ≥ 2.31): тест обязан управлять
 * входом, от которого зависит результат. */
const pinQuotePath = (value) => ({
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'core.quotePath',
  GIT_CONFIG_VALUE_0: value
});

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
    env: Object.assign({}, process.env, pinQuotePath('false'), env || {})
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
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
const goldenJson = JSON.parse(golden.toString('utf8'));
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

for (const target of TARGETS) {
  test(target.name + ': --json побайтово равен эталону', () => {
    assert.ok(fs.existsSync(target.file), 'нет ' + path.relative(ROOT, target.file)
      + ' — движок ещё не перенесён в раскладку пакета');
    const res = runCli(target, cloneFixture(), ['--json']);
    assert.equal(res.code, 0, 'инструмент не отдал --json (код ' + res.code + '): ' + res.stderr.trim());
    assert.equal(res.stdout, golden.toString('utf8'),
      'вывод --json разошёлся с эталоном: ' + firstDiff(res.stdout, golden.toString('utf8')));
  });

  test(target.name + ': --write собирает тот же артефакт и проходит контроль', () => {
    assert.ok(fs.existsSync(target.file), 'нет ' + path.relative(ROOT, target.file));
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
    assert.ok(fs.existsSync(target.file), 'нет ' + path.relative(ROOT, target.file));
    const res = runCli(target, cloneFixture(), ['--json'], { LC_ALL: 'C', LANG: 'C' });
    assert.equal(res.code, 0, 'под LC_ALL=C инструмент упал: ' + res.stderr.trim());
    assert.equal(res.stdout, golden.toString('utf8'),
      'под LC_ALL=C вывод разошёлся с эталоном (пути вне ASCII читаются иначе): '
        + firstDiff(res.stdout, golden.toString('utf8')));
  });
}

/* ---------- известный пробел: core.quotePath ---------- */

test('окружение теста умеет задавать настройки git (нужен git ≥ 2.31)', () => {
  const res = spawnSync('git', ['config', '--get', 'core.quotePath'], {
    encoding: 'utf8', env: Object.assign({}, process.env, pinQuotePath('true'))
  });
  assert.equal((res.stdout || '').trim(), 'true',
    'git не принимает настройку через окружение: зависимость от core.quotePath не проверить, '
      + 'а сверки без закрепления будут зависеть от машины');
});

/* Свидетель известного пробела (BLOCKERS.md §B1). При `core.quotePath=true`
 * (значение по умолчанию) `git log --name-only` отдаёт не-английские пути
 * закавыченными и экранированными, и происходит две вещи:
 *   1. колонка с таким путём не находит файла и пустеет на всей истории;
 *   2. коммит, у которого эта колонка была единственным изменением объёма, теряет
 *      строку целиком.
 * Проверка утверждает ровно это, а не «числа совпали»: пробел должен быть
 * виден до починки — и обязан уронить проверку, когда его закроют (маркер
 * known-gap должен шуметь, а не молчать).
 *
 * Пока движок не перенесён в раскладку пакета, свидетель смотрит на замороженную
 * копию: важно показать, что пробел унаследован от неё, а не принесён переносом. */
test('известный пробел B1: core.quotePath=true теряет колонку и строку', () => {
  const target = fs.existsSync(TARGETS[0].file) ? TARGETS[0] : TARGETS[1];
  const dir = cloneFixture();
  const pinned = runCli(target, dir, ['--json']);
  const quoted = runCli(target, dir, ['--json'], pinQuotePath('true'));
  assert.equal(pinned.stdout, golden.toString('utf8'),
    'закреплённый прогон (' + target.name + ') разошёлся с эталоном');

  if (quoted.stdout === pinned.stdout) {
    assert.fail('пробел B1 закрыт: числа больше не зависят от core.quotePath. '
      + 'Снимите маркер known-gap в test/parity.test.js и запись B1 в BLOCKERS.md');
  }

  const a = JSON.parse(pinned.stdout);
  const b = JSON.parse(quoted.stdout);
  const col = a.columns.findIndex((c) => /[^\u0000-\u007f]/.test(c.label));
  assert.ok(col >= 0, 'в фикстуре нет колонки с не-ASCII меткой — пробел B1 не проверить');

  // 1. Колонка с не-ASCII меткой пустеет: файла для инструмента больше не существует.
  const column = (data) => data.rows.map((r) => r.cells[col]);
  assert.ok(column(b).every((c) => c === null),
    'при core.quotePath=true колонка «' + a.columns[col].label + '» обязана пустеть, а в ней есть числа');
  assert.ok(column(a).some((c) => c !== null), 'в закреплённом прогоне эта колонка обязана быть заполнена');

  // 2. Ровно одна строка теряется — тот коммит, для которого эта колонка была
  // единственным изменением объёма. Он не исчезает молча: он попадает в пропуск.
  const bySha = (data) => new Map(data.rows.map((r) => [r.sha, r]));
  const pinnedRows = bySha(a);
  const quotedRows = bySha(b);
  const vanished = [...pinnedRows.keys()].filter((sha) => !quotedRows.has(sha));
  assert.equal(vanished.length, 1,
    'теряется не одна строка, а ' + vanished.length + ': пробел шире, чем известный');
  assert.ok(b.skipped.some((s) => s.indexOf(vanished[0].slice(0, 7)) === 0),
    'потерянный коммит обязан быть в списке пропущенных с причиной, а не пропасть молча');

  // 3. Всё остальное совпадает: перенос состояния по прочим файлам не затронут.
  const cut = (cells) => cells.map((c, i) => (i === col ? null : c));
  quotedRows.forEach((row, sha) => {
    const p = pinnedRows.get(sha);
    assert.ok(p, 'в закреплённом прогоне нет строки, которая есть при quotePath=true');
    assert.equal(row.subject, p.subject, 'подписи строк разошлись');
    assert.deepEqual(cut(row.cells), cut(p.cells),
      'строка ' + sha.slice(0, 7) + ': разошлось не только колонка с не-ASCII путём');
  });
});

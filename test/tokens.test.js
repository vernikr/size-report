/* Токены — третье измерение отчёта: «вес для языковой модели». Здесь проверяется
 * то, что делает счёт честным, а не только присутствующим: число снято именно тем
 * словарём, который просили в настройках (кодировка — часть счёта, а не подробность),
 * приближённое значение названо приближённым, а формат, для которого токены смысла
 * не имеют, не выдаётся за посчитанный.
 *
 * Числа-якоря: `hello world` = 2 токена — это пример из документации tiktoken, то
 * есть проверка не круговая; остальные сняты словарём на фиксированных строках и
 * стерегут обвязку (какая кодировка, нет ли нормализации текста по пути).
 *
 * Отсутствие словаря проверяется тем же окружением, что и у минификатора
 * (`SIZE_REPORT_NO_OPTIONAL`) — установка без необязательных зависимостей.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CHARS_PER_TOKEN, TOKEN_DEFAULTS, estimate } from '../src/tokens.js';
import { tokenCount } from '../src/tokens.js';
import { EXIT } from '../src/refusal.js';
import {
  CONFIG, PACKAGE, cloneFixture, gitIn, readJson, readRun, refusal, runSize, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('tokens');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const PLAIN = sharedClone('plain', tmp);
const OFF = { SIZE_REPORT_NO_OPTIONAL: '1' };
const O200K = { family: 'openai', encoding: 'o200k_base' };
const CL100K = { family: 'openai', encoding: 'cl100k_base' };

/* Копия эталонных настроек с токенами: история и колонки те же, поэтому числа
 * сравнимы с raw и min той же ревизии. */
function configAs(name, metrics, tokens, extra) {
  const cfg = readJson(CONFIG);
  cfg.metrics = metrics;
  if (tokens) cfg.tokens = tokens;
  if (extra) extra(cfg);
  const file = path.join(tmp, name + '.json');
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  return file;
}

const TOK = configAs('tok', ['raw', 'min', 'tok'], O200K);
const NO_TOK = configAs('no-tok', ['raw', 'min'], null);

// Кодовые точки, а не единицы UTF-16: так же считает и оценка по длине.
function codePoints(text) {
  return [...text].length;
}

test('счёт идёт тем словарём, который просили: кодировка — часть числа', () => {
  // Пример из документации tiktoken: `hello world` — два токена.
  assert.equal(tokenCount('hello world', O200K), 2, 'якорное число словаря не совпало');
  assert.equal(tokenCount('', O200K), 0, 'пустой файл — не ноль токенов');
  assert.equal(tokenCount('hello world', CL100K), 2, 'латиница в cl100k_base считается иначе');

  // Русский текст считается по-разному в разных кодировках — и это не подробность.
  const ru = 'Привет, мир!';
  assert.equal(tokenCount(ru, O200K), 5, 'o200k_base посчитал русскую строку иначе');
  assert.equal(tokenCount(ru, CL100K), 7, 'cl100k_base посчитал русскую строку иначе');
  assert.notEqual(tokenCount(ru, O200K), tokenCount(ru, CL100K),
    'выбор кодировки перестал влиять на число: в способе метрики он указан зря');

  const sample = 'const longName = (a, b) => a + b;\n';
  assert.equal(tokenCount(sample, O200K), tokenCount(sample, O200K),
    'два счёта одного текста разошлись: отчёт перестал быть воспроизводимым');
});

test('в отчёте токены — не байты и не минифицированный размер', () => {
  const res = runSize(PLAIN, ['--config', TOK, '--json']);
  assert.equal(res.code, 0, 'отчёт с токенами не собрался: ' + res.stderr.trim());
  const data = JSON.parse(res.stdout);
  const last = data.rows.length - 1;
  const ratios = [];
  data.columns.forEach((col, ci) => {
    const cell = data.rows[last].cells[ci];
    if (cell === null || cell.raw === 0) return;
    assert.ok(cell.tok > 0, 'у «' + col.label + '» токенов нет вовсе');
    assert.ok(cell.tok < cell.raw,
      'токенов не меньше, чем байт, у «' + col.label + '»: ' + cell.tok + ' против ' + cell.raw);
    assert.notEqual(cell.tok, cell.min,
      'токены совпали с минифицированным размером у «' + col.label + '»: это разные величины');
    ratios.push(cell.raw / cell.tok);
  });
  // Байт на токен — не постоянная: у кода, русского текста и JSON она своя.
  const spread = Math.max.apply(null, ratios) / Math.min.apply(null, ratios);
  assert.ok(spread > 2,
    'байт на токен почти не различается по файлам (' + spread.toFixed(2) + '): '
      + 'значит, «токены» считаются не текстом, а отношением');
});

test('без словаря счёт идёт оценкой по длине — и это названо и посчитано', () => {
  // О метрике не просили — словарь и не нужен: отчёт выходит обычным кодом.
  const quiet = runSize(PLAIN, ['--config', NO_TOK, '--json'], OFF);
  assert.equal(quiet.code, EXIT.OK,
    'без токенов в метриках прогон споткнулся о отсутствующий словарь: ' + quiet.stderr.trim());

  const res = runSize(PLAIN, ['--config', TOK, '--json'], OFF);
  assert.equal(res.code, EXIT.SENSOR,
    'оценка вместо точного счёта не названа кодом 4: код ' + res.code + ', ' + res.stderr.trim());
  assert.match(res.stderr, /метрика «tok» считает оценкой/, 'отступление не объяснено');
  assert.match(res.stderr, /"tok" из metrics/, 'отступление не назвало починку');

  const data = runSize(PLAIN, ['--config', TOK, '--data'], OFF);
  const view = JSON.parse(data.stdout).metrics.find((m) => m.key === 'tok');
  assert.equal(view.accuracy, 'approximate', 'оценка выдана за точный счёт');
  assert.match(view.method, new RegExp('1 токен ≈ ' + CHARS_PER_TOKEN + ' знака'),
    'способ не называет ни оценки, ни её коэффициента: ' + view.method);
  assert.ok(view.method.indexOf('недоступен') >= 0, 'способ не говорит, почему счёт оценкой');
  assert.ok(view.method.indexOf('4.0.0') < 0, 'способ называет версию словаря, которого нет');

  // Оценка — ровно тот коэффициент, который назван в способе, а не «похожее число».
  const text = fs.readFileSync(path.join(PLAIN, 'src', 'code.js'), 'utf8');
  const ci = JSON.parse(data.stdout).files.findIndex((f) => f.label === 'code.js');
  assert.equal(JSON.parse(data.stdout).now[ci].tok, estimate(text),
    'оценка в отчёте не совпала с оценкой по длине');
  assert.equal(estimate(text), Math.ceil(codePoints(text) / CHARS_PER_TOKEN),
    'оценка считается не по кодовым точкам');
});

test('формат, для которого токены бессмысленны, не выдаётся за посчитанный', () => {
  const dir = cloneFixture(path.join(tmp, 'binary'));
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]));
  gitIn(dir, ['add', 'assets/logo.png']);
  gitIn(dir, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local',
    'commit', '-qm', 'картинка в колонке']);
  const file = configAs('binary', ['raw', 'min', 'tok'], O200K, (cfg) => {
    cfg.columns.push({ label: 'logo.png', paths: ['assets/logo.png'] });
  });

  const res = runSize(dir, ['--config', file, '--data']);
  assert.equal(res.code, 0, 'данные с бинарной колонкой не собрались: ' + res.stderr.trim());
  const view = JSON.parse(res.stdout).metrics.find((m) => m.key === 'tok');
  assert.equal(view.accuracy, 'approximate',
    'отчёт с бинарным форматом обещает точный счёт токенов: ' + view.method);
  assert.ok(view.method.indexOf('.png') >= 0,
    'приближение не названо по формату: ' + view.method);
});

test('чужое семейство и чужая кодировка — отказ настроек со списком', () => {
  const badFamily = configAs('bad-family', ['raw', 'tok'], { family: 'gemini', encoding: 'o200k_base' });
  const res = runSize(PLAIN, ['--config', badFamily, '--json']);
  refusal(res, EXIT.CONFIG, 'конфиг с чужим семейством');
  assert.match(res.stderr, /openai/, 'отказ не назвал, из чего выбирать: ' + res.stderr.trim());

  const badEncoding = configAs('bad-encoding', ['raw', 'tok'], { family: 'openai', encoding: 'p50k_base' });
  const res2 = runSize(PLAIN, ['--config', badEncoding, '--json']);
  refusal(res2, EXIT.CONFIG, 'конфиг с чужой кодировкой');
  assert.match(res2.stderr, /o200k_base, cl100k_base/,
    'отказ не назвал кодировок семейства: ' + res2.stderr.trim());
});

test('черновик --init ведёт новый проект на токены, и первый отчёт — точный', () => {
  const dir = path.join(tmp, 'fresh');
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  gitIn(dir, ['init', '-q', '-b', 'main']);
  ['user.name', 'user.email', 'commit.gpgsign'].forEach((key, i) => {
    gitIn(dir, ['config', key, ['fixture', 'fixture@local', 'false'][i]]);
  });
  fs.writeFileSync(path.join(dir, 'src', 'code.js'), '// комментарий\nfunction width(items) { return items.length; }\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'начало']);

  const made = runSize(dir, ['--init']);
  assert.equal(made.code, 0, 'черновик не собрался: ' + made.stderr.trim());
  const file = path.join(dir, 'size-table.config.json');
  const draft = readJson(file);
  assert.equal(draft.metrics.indexOf('tok') >= 0, true, 'черновик не просит токены');
  assert.deepEqual(draft.tokens, TOKEN_DEFAULTS, 'черновик не назвал словарь токенов');

  assert.equal(runSize(dir, ['--write']).code, 0, 'первый отчёт нового проекта не собрался');
  const res = runSize(dir, ['--data']);
  assert.equal(res.code, 0, 'данные нового проекта не собрались: ' + res.stderr.trim());
  const view = JSON.parse(res.stdout).metrics.find((m) => m.key === 'tok');
  assert.equal(view.accuracy, 'exact', 'первый отчёт нового проекта считает токены оценкой');
  assert.match(view.method, /^gpt-tokenizer \d+\.\d+\.\d+, o200k_base \(BPE\)$/,
    'первый отчёт собран не тем словарём, который просил черновик: ' + view.method);
});

test('словарь не трогают те прогоны, которые о токенах не просили', () => {
  const before = readRun(PACKAGE, PLAIN, ['--json']);
  const withTokens = runSize(PLAIN, ['--config', TOK, '--json']);
  assert.equal(before.code, 0, 'прежний отчёт сломался: ' + before.stderr.trim());
  assert.equal(withTokens.code, 0, 'отчёт с токенами сломался: ' + withTokens.stderr.trim());
  const without = JSON.parse(before.stdout);
  const with3 = JSON.parse(withTokens.stdout);
  assert.equal(without.metrics.length, 2, 'в прежний отчёт попала лишняя метрика');
  assert.equal(with3.metrics.length, 3, 'метрика токенов не попала в отчёт');
  assert.equal(without.rows.length, with3.rows.length,
    'набор строк отчёта зависит от того, просили токены или нет');
});

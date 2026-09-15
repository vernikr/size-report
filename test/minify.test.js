/* Настоящее сжатие — второй способ получить метрику `min`. Снятие балласта
 * оставлено нетронутым намеренно: под ним сняты оба замороженных эталона, и
 * проекты со своими настройками не должны получить другие числа молча. Поэтому
 * способ выбирается в настройках (`minify.engine`), и здесь проверяется, что выбор
 * действительно что-то меняет, что приближение названо приближением, а отсутствие
 * необязательной зависимости — не падение.
 *
 * Шов отсутствия минификатора: окружение с `SIZE_REPORT_NO_OPTIONAL` (тем же путём
 * идёт установка без необязательных зависимостей).
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NO_OPTIONAL } from '../src/optional.js';
import { minifyWithEsbuild } from '../src/minify.js';
import { loadConfig } from '../src/config.js';
import { EXIT } from '../src/refusal.js';
import { minifyForm } from '../src/strip.js';
import {
  CONFIG, PACKAGE, SYNTH, cloneFixture, gitIn, readJson, readRun, refusal, runSize,
  sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('minify');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const PLAIN = sharedClone('plain', tmp);
const goldenText = fs.readFileSync(path.join(SYNTH, 'golden.json'), 'utf8');
const OFF = { [NO_OPTIONAL]: '1' };

/* Копия эталонных настроек с другим способом минификации: история и колонки те же,
 * поэтому числа сравнимы клетка за клеткой, а не «примерно похожи». */
function configAs(name, mutate) {
  const cfg = readJson(CONFIG);
  cfg.minify = { engine: 'esbuild' };
  mutate(cfg);
  const file = path.join(tmp, name + '.json');
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  return file;
}

/* Колонки, за которые отвечает минификатор (`.js`, `.mjs`, `.css`), и колонки,
 * которых он не берёт (`.json` минифицируется разбором целиком, остальные —
 * упрощение). По этому делению и проверяется, где число обязано упасть. */
const MINIFIED = ['code.js', 'modern.js', 'config.mjs', 'style.css'];

test('минификатор действительно сокращает: имена и комментарии исчезают, и это воспроизводимо', () => {
  const source = 'function total(items) {\n  // сумма размеров\n'
    + '  const longLocalName = items.reduce((acc, item) => acc + item.size, 0);\n'
    + '  return longLocalName;\n}\n';
  const min = minifyWithEsbuild(source, 'src/a.js', 'abc1234');

  assert.ok(min.indexOf('longLocalName') < 0, 'имя переменной пережило сжатие: ' + min);
  assert.ok(min.indexOf('сумма размеров') < 0, 'комментарий пережил сжатие: ' + min);
  assert.ok(min.length < minifyForm(source, 'src/a.js', { minify: { ext: {} } }).length,
    'сжатие не короче упрощения — значит, это не минификация');
  assert.equal(minifyWithEsbuild(source, 'src/a.js', 'abc1234'), min,
    'два прогона над одним текстом дали разные числа: отчёт перестал быть воспроизводимым');

  const css = minifyWithEsbuild('/* шапка */\n.a { color : red ; }\n', 'src/a.css', 'abc1234');
  assert.equal(css.trim(), '.a{color:red}', 'стили сжимаются не минификатором: ' + css);
});

test('на фикстуре настоящее сжатие меньше упрощения — ровно там, где есть минификатор', () => {
  const file = configAs('esbuild', () => {});
  const strip = readRun(PACKAGE, PLAIN, ['--json']);
  assert.equal(strip.stdout, goldenText, 'прогон по прежнему способу разошёлся с эталоном');
  const es = runSize(PLAIN, ['--config', file, '--json']);
  assert.equal(es.code, 0, 'сжатие минификатором упало: ' + es.stderr.trim());

  const before = JSON.parse(goldenText);
  const after = JSON.parse(es.stdout);
  let smaller = 0;
  let grew = 0;
  after.columns.forEach((col, ci) => {
    const mustShrink = MINIFIED.indexOf(col.label) >= 0;
    let moved = 0;
    after.rows.forEach((row, ri) => {
      const a = row.cells[ci];
      const b = before.rows[ri].cells[ci];
      if (a === null || b === null) return;
      assert.ok(a.raw === b.raw, 'сжатие тронуло raw у «' + col.label + '»');
      if (a.min > b.min) grew++;
      else if (a.min < b.min) { smaller++; moved++; }
    });
    if (mustShrink) {
      assert.ok(moved > 0, 'минификатор не сократил ни одной ревизии «' + col.label + '»');
    } else {
      assert.equal(moved, 0, 'упрощение поехало там, где минификатора нет: «' + col.label + '»');
    }
  });
  assert.equal(grew, 0, 'настоящее сжатие где-то вышло больше упрощения — это не сжатие');
  assert.ok(smaller > 0, 'настоящее сжатие не изменило ни одного числа: способ не включился');

  // Числа названы не «примерно»: у колонки кода падение видно по текущему размеру.
  const last = after.rows.length - 1;
  const code = after.columns.findIndex((c) => c.label === 'code.js');
  assert.ok(after.rows[last].cells[code].min < before.rows[last].cells[code].min,
    'строка «сейчас» у кода не упала: ' + after.rows[last].cells[code].min
      + ' против ' + before.rows[last].cells[code].min);
});

test('подпись метрики называет приближение по формату, а не молчит', () => {
  const all = runSize(PLAIN, ['--config', configAs('esbuild', () => {}), '--data']);
  const min = JSON.parse(all.stdout).metrics.find((m) => m.key === 'min');
  assert.equal(min.accuracy, 'approximate', 'метрика со смешанными форматами обещает точность');
  assert.match(min.method, /^esbuild \d+\.\d+\.\d+ \(minify, rename\)/,
    'способ не называет минификатор и его версию: ' + min.method);
  ['.md', '.toml', '.txt'].forEach((ext) => {
    assert.ok(min.method.indexOf(ext) >= 0,
      'приближение не названо по формату: ' + ext + ' пропущен в «' + min.method + '»');
  });
  assert.ok(min.method.indexOf('.json') < 0, 'точный формат записан в приближение: ' + min.method);

  // Отчёт без форматов, которых минификатор не берёт, обещает точное число.
  const only = configAs('esbuild-exact', (cfg) => {
    cfg.columns = cfg.columns.filter((c) => MINIFIED.indexOf(c.label) >= 0);
  });
  const pure = JSON.parse(runSize(PLAIN, ['--config', only, '--data']).stdout);
  const pureMin = pure.metrics.find((m) => m.key === 'min');
  assert.equal(pureMin.accuracy, 'exact',
    'отчёт целиком из минифицируемых форматов объявлен приближённым: ' + pureMin.method);
  assert.ok(pureMin.method.indexOf('приближение') < 0,
    'в способе осталось предупреждение о приближении: ' + pureMin.method);

  /* То же правило с другой стороны: точность берётся у клеток, а не у названия
   * способа. Отчёт из одного JSON точен и под снятием балласта — разбор теряет
   * только незначащие пробелы, короче его не сделать, — поэтому и подпись
   * обязана сказать «точное», а не обещать приближение за название способа. */
  const onlyJson = configAs('strip-json', (cfg) => {
    cfg.minify = { engine: 'strip' };
    cfg.columns = cfg.columns.filter((c) => c.label === 'package.json');
  });
  const jsoned = JSON.parse(runSize(PLAIN, ['--config', onlyJson, '--data']).stdout);
  const jsonMin = jsoned.metrics.find((m) => m.key === 'min');
  assert.equal(jsonMin.accuracy, 'exact',
    'точный формат под снятием балласта объявлен приближённым: подпись смотрит на название способа, а не на клетки');
  assert.equal(jsoned.approx.min, undefined, 'точная колонка получила пометки приближения');
});

/* Точность доезжает и до самой клетки, а не только до подписи метрики: там, где
 * минификатор файл взял, число точное, а там, где формат ему незнаком, — нет.
 * Ряд пометок берётся из контракта (`--data`), а не из внутренностей движка,
 * и сверяется с теми же колонками, по которым проверено падение чисел. */
test('с настоящим сжатием точность объявлена по клетке', () => {
  const all = runSize(PLAIN, ['--config', configAs('esbuild-cells', () => {}), '--data']);
  assert.equal(all.code, 0, 'прогон со сжатием упал: ' + all.stderr.trim());
  const data = JSON.parse(all.stdout);
  const min = (data.approx || {}).min;
  assert.ok(min, 'приближённые клетки не объявлены, хотя часть форматов минификатор не берёт');
  assert.equal(data.approx.raw, undefined, 'размер объекта git помечен приближением');
  const where = (label) => data.files.findIndex((f) => f.label === label);
  const cell = (r, i) => min.rows.charAt(r * data.files.length + i);

  MINIFIED.forEach((label) => {
    const i = where(label);
    assert.equal(min.now.charAt(i), '0', 'клетка «' + label + '» названа приближённой без причины');
    data.rows.forEach((row, r) => {
      if (row.values[i] === null) return;
      assert.equal(cell(r, i), '0',
        'строка ' + (r + 1) + '/«' + label + '»: число минификатора помечено приближённым');
    });
  });

  ['заметки.md', 'table.toml', 'crlf.txt'].forEach((label) => {
    const i = where(label);
    assert.equal(min.now.charAt(i), '1',
      'число «' + label + '» снято без минификатора, а объявлено точным');
  });
});

test('без необязательной зависимости метрика отступает к упрощению — без падения', () => {
  const file = configAs('esbuild', () => {});
  const json = runSize(PLAIN, ['--config', file, '--json'], OFF);
  assert.equal(json.code, EXIT.SENSOR,
    'отступление не названо кодом 4: код ' + json.code + ', ' + json.stderr.trim());
  assert.equal(json.stdout, goldenText,
    'без минификатора числа не равны прежнему способу: ' + json.stderr.trim());
  assert.match(json.stderr, /минификатор недоступен/, 'отступление не объяснено');
  assert.match(json.stderr, /minify.*engine.*strip/, 'отступление не назвало починку');

  const dir = cloneFixture(path.join(tmp, 'write-off'));
  assert.equal(runSize(dir, ['--config', file, '--write'], OFF).code, EXIT.SENSOR,
    'сборка отчёта без минификатора не назвала отступление');
  assert.ok(fs.existsSync(path.join(dir, 'docs', 'size-table.html')),
    'отчёт без минификатора не собран: отступление не должно быть отказом');
  assert.equal(runSize(dir, ['--config', file], OFF).code, EXIT.SENSOR,
    'контрольный режим без минификатора не назвал отступление');

  const data = runSize(PLAIN, ['--config', file, '--data'], OFF);
  const min = JSON.parse(data.stdout).metrics.find((m) => m.key === 'min');
  assert.equal(min.accuracy, 'approximate', 'отступление выдано за точное число');
  assert.ok(min.method.indexOf('esbuild недоступен') >= 0,
    'способ не говорит, почему счёт идёт упрощением: ' + min.method);
  assert.ok(min.method.indexOf('0.28.2') < 0, 'способ называет версию минификатора, которого нет');
});

test('расхождение и отступление вместе: названы оба, а вердикт — за расхождением', () => {
  /* Отчёт собран с настоящим минификатором, а проверка идёт без него: числа честно
   * расходятся, и настоящая причина — другой счёт, а не правка мимо отчёта. Вердикт
   * всё равно остаётся за расхождением (код 1), а факт другого счёта называется
   * заметкой: код 4 утверждал бы, что разница объясняется датчиком, а этого никто не
   * проверял — расхождение может быть и настоящей правкой на диске. Порядок тот же,
   * что у `doctor` и у покрытия: нарушение старше приближения. */
  const file = configAs('esbuild-report', () => {});
  const dir = cloneFixture(path.join(tmp, 'report-with-esbuild'));
  assert.equal(runSize(dir, ['--config', file, '--write']).code, EXIT.OK,
    'отчёт с минификатором не собрался — сверять будет нечего');

  const check = runSize(dir, ['--config', file], OFF);
  assert.equal(check.code, EXIT.VIOLATION,
    'вердикт отдан приближению: код ' + check.code + ', ' + check.stderr.trim());
  assert.match(check.stderr, /расходится с историей/,
    'расхождение не названо: ' + check.stderr.trim());
  assert.match(check.stderr, /минификатор недоступен/,
    'другой счёт не назван, и расхождение осталось без причины: ' + check.stderr.trim());

  const cover = runSize(dir, ['--config', file, 'check'], OFF);
  assert.equal(cover.code, EXIT.VIOLATION,
    'покрытие не назвало нарушение: код ' + cover.code + ', ' + cover.stderr.trim());
  assert.match(cover.stderr, /минификатор недоступен/,
    'покрытие промолчало о другом счёте, хотя назвало нарушение: ' + cover.stderr.trim());
});

test('файл, который минификатор не разобрал, — отказ с настоящей причиной', () => {
  /* Совет этого отказа — только перевод расширения под упрощение, и это проверено
   * прогоном: смена движка на `strip` этот файл не спасает, а передаёт гарду
   * `minify.guard` (у `.js` — его разговор), поэтому обещать её здесь значило бы
   * обещать выход, которого нет. Прогон обеих половин — в `test/module.test.js`. */
  assert.throws(() => minifyWithEsbuild('<div>нет</div>\n', 'src/lie.js', 'abc1234'),
    (e) => e.code === EXIT.CONFIG && e.message.indexOf('src/lie.js') >= 0
      && e.message.indexOf('ERROR:') >= 0
      && e.message.indexOf('{".js": "strip-lines"}') >= 0
      && e.message.indexOf('"engine": "strip"') < 0,
    'отказ не назвал ни файла, ни причины, ни выхода из тупика');

  /* Тот же отказ, но через движок: расширение соврало о содержимом в истории.
   * Проверка идёт на `.ts`: упрощение такой файл просто построчно подрезает (и
   * молчало бы), а минификатор обязан отказаться, потому что не разобрал его. */
  const dir = cloneFixture(path.join(tmp, 'lie'));
  fs.writeFileSync(path.join(dir, 'src', 'lie.ts'), '<div>нет</div>\n');
  gitIn(dir, ['add', 'src/lie.ts']);
  gitIn(dir, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local', 'commit', '-qm', 'не TypeScript в .ts']);
  const file = configAs('lie', (cfg) => { cfg.columns.push({ label: 'lie.ts', paths: ['src/lie.ts'] }); });
  const res = runSize(dir, ['--config', file, '--write']);
  refusal(res, EXIT.CONFIG, 'расширение соврало о содержимом');
  assert.match(res.stderr, /src\/lie\.ts/, 'отказ не назвал файл: ' + res.stderr.trim());
});

test('черновик --init ведёт новый проект на настоящее сжатие', () => {
  const dir = path.join(tmp, 'fresh');
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  gitIn(dir, ['init', '-q', '-b', 'main']);
  ['user.name', 'user.email', 'commit.gpgsign'].forEach((key, i) => {
    gitIn(dir, ['config', key, ['fixture', 'fixture@local', 'false'][i]]);
  });
  fs.writeFileSync(path.join(dir, 'src', 'code.js'),
    'function width(items) {\n  // сумма ширин\n  const totalWidth = items.reduce((sum, item) => sum + item.width, 0);\n  return totalWidth;\n}\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'начало']);

  const made = runSize(dir, ['--init']);
  assert.equal(made.code, 0, 'черновик не собрался: ' + made.stderr.trim());
  const file = path.join(dir, 'size-table.config.json');
  assert.equal((readJson(file).minify || {}).engine, 'esbuild', 'черновик не ведёт на настоящее сжатие');
  loadConfig(file); // проверка настроек обязана принимать то, что выдаёт подсказка

  const data = JSON.parse(runSize(dir, ['--data']).stdout);
  const min = data.metrics.find((m) => m.key === 'min');
  assert.match(min.method, /^esbuild \d+\.\d+\.\d+ \(minify, rename\)$/,
    'первый отчёт нового проекта собран не минификатором: ' + min.method);
  assert.equal(min.accuracy, 'exact', 'у нового проекта число объявлено приближённым');
});

test('неизвестный способ минификации — отказ настроек с готовой починкой', () => {
  const file = path.join(tmp, 'bad-engine.json');
  const cfg = readJson(CONFIG);
  cfg.minify = { engine: 'babel' };
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  const res = runSize(PLAIN, ['--config', file, '--json']);
  refusal(res, EXIT.CONFIG, 'конфиг с чужим способом минификации');
  assert.match(res.stderr, /strip, esbuild/, 'отказ не назвал, из чего выбирать: ' + res.stderr.trim());
});

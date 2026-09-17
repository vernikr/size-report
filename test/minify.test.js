/* Real compression is the second way to obtain the `min` metric. Ballast removal is left untouched on
 * purpose: both frozen fixtures were taken under it, and projects with settings of their own must not
 * silently get other numbers. So the way is chosen in the settings (`minify.engine`), and what is checked
 * here is that the choice really changes something, that the formats it does not take are named in the
 * method, and that a missing optional dependency is not a crash.
 *
 * The seam of a missing minifier: the environment with `SIZE_REPORT_NO_OPTIONAL` (the way an install
 * without the optional dependencies goes too).
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
  CONFIG, PACKAGE, SYNTH, cloneFixture, draftedRepo, gitIn, readJson, readRun, refusal, runSize,
  sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('minify');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const PLAIN = sharedClone('plain', tmp);
const goldenText = fs.readFileSync(path.join(SYNTH, 'golden.json'), 'utf8');
const OFF = { [NO_OPTIONAL]: '1' };

/* A copy of the reference settings with another minification way: the history and the columns stay the
 * same, so the numbers are comparable cell by cell rather than "roughly alike". */
function configAs(name, mutate) {
  const cfg = readJson(CONFIG);
  cfg.minify = { engine: 'esbuild' };
  mutate(cfg);
  const file = path.join(tmp, name + '.json');
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  return file;
}

/* The columns the minifier answers for — the `.js`, `.mjs` and `.css` ones of this fixture (the whole
 * table is `MINIFY_LOADERS` in the engine) — and the columns it does not take (`.json` is compacted by
 * re-serialising, the rest is a simplification). This split decides where a number has to shrink. */
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

  // The numbers are not "roughly": for the code column the drop shows in the current size.
  const last = after.rows.length - 1;
  const code = after.columns.findIndex((c) => c.label === 'code.js');
  assert.ok(after.rows[last].cells[code].min < before.rows[last].cells[code].min,
    'строка «сейчас» у кода не упала: ' + after.rows[last].cells[code].min
      + ' против ' + before.rows[last].cells[code].min);
});

test('подпись метрики называет форматы, которые минификатор не берёт, а не молчит', () => {
  const all = runSize(PLAIN, ['--config', configAs('esbuild', () => {}), '--data']);
  const min = JSON.parse(all.stdout).metrics.find((m) => m.key === 'min');
  assert.match(min.method, /^esbuild \d+\.\d+\.\d+ \(minify, rename\)/,
    'способ не называет минификатор и его версию: ' + min.method);
  ['.md', '.toml', '.txt'].forEach((ext) => {
    assert.ok(min.method.indexOf(ext) >= 0,
      'приближение не названо по формату: ' + ext + ' пропущен в «' + min.method + '»');
  });
  assert.ok(min.method.indexOf('.json') < 0, 'формат, который минификатор берёт, записан в другой счёт: ' + min.method);
  assert.equal(/приближ|точн/.test(min.method), false,
    'способ оценивает свои числа, а не описывает счёт: ' + min.method);

  // A report without the formats the minifier does not take says nothing about other formats.
  const only = configAs('esbuild-exact', (cfg) => {
    cfg.columns = cfg.columns.filter((c) => MINIFIED.indexOf(c.label) >= 0);
  });
  const pure = JSON.parse(runSize(PLAIN, ['--config', only, '--data']).stdout);
  const pureMin = pure.metrics.find((m) => m.key === 'min');
  assert.ok(pureMin.method.indexOf('остальные форматы') < 0,
    'отчёт целиком из минифицируемых форматов говорит о форматах, которых в нём нет: ' + pureMin.method);

  /* The list comes from the columns rather than from the name of the method: a report made of one JSON
   * file under ballast removal has no other format in it either — re-serialising loses only insignificant
   * whitespace and nobody can make it shorter. */
  const onlyJson = configAs('strip-json', (cfg) => {
    cfg.minify = { engine: 'strip' };
    cfg.columns = cfg.columns.filter((c) => c.label === 'package.json');
  });
  const jsoned = JSON.parse(runSize(PLAIN, ['--config', onlyJson, '--data']).stdout);
  const jsonMin = jsoned.metrics.find((m) => m.key === 'min');
  assert.equal(/приближ|точно/.test(jsonMin.method), false,
    'способ оценивает числа вместо того, чтобы описать счёт: ' + jsonMin.method);
  assert.equal(Object.prototype.hasOwnProperty.call(jsoned, 'approx'), false,
    'данные всё ещё несут пометки по клеткам');
});

/* The split of the column into "taken by the minifier" and "counted another way" is what tells a reader
 * where the numbers come from, and it lives in the method rather than on the cells: the formats the
 * minifier takes are not named and the ones it does not take are. The list comes from the contract
 * (`--data`) and is compared with the very columns the drop in numbers was checked on. */
test('с настоящим сжатием способ называет другие форматы, а пометок по клетке нет', () => {
  const all = runSize(PLAIN, ['--config', configAs('esbuild-cells', () => {}), '--data']);
  assert.equal(all.code, 0, 'прогон со сжатием упал: ' + all.stderr.trim());
  const data = JSON.parse(all.stdout);
  assert.equal(Object.prototype.hasOwnProperty.call(data, 'approx'), false,
    'часть форматов минификатор не берёт, а клетки всё ещё помечены точностью');
  const min = data.metrics.find((m) => m.key === 'min');

  MINIFIED.forEach((label) => {
    const ext = label.slice(label.lastIndexOf('.'));
    assert.equal(min.method.indexOf(ext), -1,
      'формат «' + label + '» назван другим счётом, хотя его берёт минификатор: ' + min.method);
  });

  ['заметки.md', 'table.toml', 'crlf.txt'].forEach((label) => {
    const ext = label.slice(label.lastIndexOf('.'));
    assert.ok(min.method.indexOf(ext) >= 0,
      'другой счёт «' + label + '» не назван в способе: ' + min.method);
  });
});

test('без необязательной зависимости метрика отступает к упрощению — без падения', () => {
  const file = configAs('esbuild', () => {});
  const json = runSize(PLAIN, ['--config', file, '--json'], OFF);
  assert.equal(json.code, EXIT.SENSOR,
    'отступление не названо кодом 4: код ' + json.code + ', ' + json.stderr.trim());
  assert.equal(json.stdout, goldenText,
    'без минификатора числа не равны прежнему способу: ' + json.stderr.trim());
  assert.match(json.stderr, /the minifier is unavailable/, 'отступление не объяснено');
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
  assert.equal(/приближ|точно/.test(min.method), false,
    'способ оценивает отступление вместо того, чтобы его назвать: ' + min.method);
  assert.ok(min.method.indexOf('esbuild недоступен') >= 0,
    'способ не говорит, почему счёт идёт упрощением: ' + min.method);
  assert.ok(min.method.indexOf('0.28.2') < 0, 'способ называет версию минификатора, которого нет');
});

test('расхождение и отступление вместе: названы оба, а вердикт — за расхождением', () => {
  /* The report was assembled with the real minifier while the check runs without it: the numbers
   * honestly differ, and the real cause is the other count rather than an edit outside the report. The
   * verdict still goes to the discrepancy (code 1), while the fact of the other count is named as a note:
   * code 4 would assert that the difference is explained by the sensor, and nobody checked that — the
   * discrepancy may be a genuine edit on disk. The order is the same as in `doctor` and in coverage: a
   * violation outranks an approximation. */
  const file = configAs('esbuild-report', () => {});
  const dir = cloneFixture(path.join(tmp, 'report-with-esbuild'));
  assert.equal(runSize(dir, ['--config', file, '--write']).code, EXIT.OK,
    'отчёт с минификатором не собрался — сверять будет нечего');

  const check = runSize(dir, ['--config', file], OFF);
  assert.equal(check.code, EXIT.VIOLATION,
    'вердикт отдан приближению: код ' + check.code + ', ' + check.stderr.trim());
  assert.match(check.stderr, /diverged from the git history/,
    'расхождение не названо: ' + check.stderr.trim());
  assert.match(check.stderr, /the minifier is unavailable/,
    'другой счёт не назван, и расхождение осталось без причины: ' + check.stderr.trim());

  const cover = runSize(dir, ['--config', file, 'check'], OFF);
  assert.equal(cover.code, EXIT.VIOLATION,
    'покрытие не назвало нарушение: код ' + cover.code + ', ' + cover.stderr.trim());
  assert.match(cover.stderr, /the minifier is unavailable/,
    'покрытие промолчало о другом счёте, хотя назвало нарушение: ' + cover.stderr.trim());
});

test('файл, который минификатор не разобрал, — отказ с настоящей причиной', () => {
  /* The advice of this refusal is only moving the extension under simplification, and that is proved by a
   * run: switching the engine to `strip` does not save this file, it hands it to the `minify.guard` check
   * (which has its say for `.js`), so promising it here would promise an exit that does not exist. Both
   * halves are run in `test/module.test.js`. */
  assert.throws(() => minifyWithEsbuild('<div>нет</div>\n', 'src/lie.js', 'abc1234'),
    (e) => e.code === EXIT.CONFIG && e.message.indexOf('src/lie.js') >= 0
      && e.message.indexOf('ERROR:') >= 0
      && e.message.indexOf('{".js": "strip-lines"}') >= 0
      && e.message.indexOf('"engine": "strip"') < 0,
    'отказ не назвал ни файла, ни причины, ни выхода из тупика');

  /* The same refusal, but through the engine: the extension lied about the content in the history. The
   * check runs on `.ts`: a simplification merely trims such a file line by line (and would stay silent),
   * while the minifier has to refuse, because it did not parse it. */
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
  const { dir, file } = draftedRepo(path.join(tmp, 'fresh'),
    'function width(items) {\n  // сумма ширин\n  const totalWidth = items.reduce((sum, item) => sum + item.width, 0);\n  return totalWidth;\n}\n');
  assert.equal((readJson(file).minify || {}).engine, 'esbuild', 'черновик не ведёт на настоящее сжатие');
  loadConfig(file); // the settings check has to accept what the hint gives out

  const data = JSON.parse(runSize(dir, ['--data']).stdout);
  const min = data.metrics.find((m) => m.key === 'min');
  assert.match(min.method, /^esbuild \d+\.\d+\.\d+ \(minify, rename\)$/,
    'первый отчёт нового проекта собран не минификатором: ' + min.method);
  assert.equal(Object.prototype.hasOwnProperty.call(min, 'accuracy'), false,
    'описание метрики всё ещё несёт оценку точности');
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

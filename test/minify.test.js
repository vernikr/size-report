/* Real compression is the second way to obtain the `min` metric. Ballast removal is left untouched on
 * purpose: both frozen fixtures were taken under it, and projects with settings of their own must not
 * silently get other numbers. So the way is chosen in the settings (`minify.engine`), and what is checked
 * here is that the choice really changes something, that an approximation is named as one, and that a
 * missing optional dependency is not a crash.
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

test('the minifier really shrinks: names and comments disappear, and that is reproducible', () => {
  const source = 'function total(items) {\n  // сумма размеров\n'
    + '  const longLocalName = items.reduce((acc, item) => acc + item.size, 0);\n'
    + '  return longLocalName;\n}\n';
  const min = minifyWithEsbuild(source, 'src/a.js', 'abc1234');

  assert.ok(min.indexOf('longLocalName') < 0, 'the variable name survived minification: ' + min);
  assert.ok(min.indexOf('сумма размеров') < 0, 'the comment survived minification: ' + min);
  assert.ok(min.length < minifyForm(source, 'src/a.js', { minify: { ext: {} } }).length,
    'minified is not shorter than stripped — so this is not minification');
  assert.equal(minifyWithEsbuild(source, 'src/a.js', 'abc1234'), min,
    'two runs over one text gave different numbers: the report is no longer reproducible');

  const css = minifyWithEsbuild('/* шапка */\n.a { color : red ; }\n', 'src/a.css', 'abc1234');
  assert.equal(css.trim(), '.a{color:red}', 'the styles are not minified by the minifier: ' + css);
});

test('on the fixture real minification is less than stripping — exactly where a minifier is there', () => {
  const file = configAs('esbuild', () => {});
  const strip = readRun(PACKAGE, PLAIN, ['--json']);
  assert.equal(strip.stdout, goldenText, 'the run by the former way diverged from the reference');
  const es = runSize(PLAIN, ['--config', file, '--json']);
  assert.equal(es.code, 0, 'minification fell over: ' + es.stderr.trim());

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
      assert.ok(a.raw === b.raw, 'minification touched raw in «' + col.label + '»');
      if (a.min > b.min) grew++;
      else if (a.min < b.min) { smaller++; moved++; }
    });
    if (mustShrink) {
      assert.ok(moved > 0, 'the minifier did not shrink a single revision of «' + col.label + '»');
    } else {
      assert.equal(moved, 0, 'stripping moved where there is no minifier: «' + col.label + '»');
    }
  });
  assert.equal(grew, 0, 'real minification came out larger than stripping somewhere — that is not minification');
  assert.ok(smaller > 0, 'real minification changed no number at all: the way did not switch on');

  // The numbers are not "roughly": for the code column the drop shows in the current size.
  const last = after.rows.length - 1;
  const code = after.columns.findIndex((c) => c.label === 'code.js');
  assert.ok(after.rows[last].cells[code].min < before.rows[last].cells[code].min,
    'the "now" row of the code did not fall: ' + after.rows[last].cells[code].min
      + ' against ' + before.rows[last].cells[code].min);
});

test('the metric caption names the formats the minifier does not take rather than staying silent', () => {
  const all = runSize(PLAIN, ['--config', configAs('esbuild', () => {}), '--data']);
  const min = JSON.parse(all.stdout).metrics.find((m) => m.key === 'min');
  assert.equal(Object.prototype.hasOwnProperty.call(min, 'accuracy'), false,
    'the metric still carries an accuracy mark');
  assert.match(min.method, /^esbuild \d+\.\d+\.\d+ \(minify, rename\)/,
    'the way names neither the minifier nor its version: ' + min.method);
  ['.md', '.toml', '.txt'].forEach((ext) => {
    assert.ok(min.method.indexOf(ext) >= 0,
      'the other count is not named by format: ' + ext + ' is missing from «' + min.method + '»');
  });
  assert.ok(min.method.indexOf('.json') < 0,
    'a format the minifier takes is written into the other count: ' + min.method);
  assert.equal(/approximat|exact/i.test(min.method), false,
    'the way judges its own numbers instead of describing the count: ' + min.method);

  // A report without the formats the minifier does not take promises an exact number.
  const only = configAs('esbuild-exact', (cfg) => {
    cfg.columns = cfg.columns.filter((c) => MINIFIED.indexOf(c.label) >= 0);
  });
  const pure = JSON.parse(runSize(PLAIN, ['--config', only, '--data']).stdout);
  const pureMin = pure.metrics.find((m) => m.key === 'min');
  assert.equal(Object.prototype.hasOwnProperty.call(pureMin, 'accuracy'), false,
    'the metric still carries an accuracy mark: ' + pureMin.method);
  assert.equal(/approximat/i.test(pureMin.method), false,
    'the way still carries a warning about approximation: ' + pureMin.method);

  /* The same rule from the other side: the count comes from the columns rather than from the name of the
   * way. A report made of one JSON file is counted whole under ballast removal too — re-serialising loses
   * only insignificant whitespace and nobody can make it shorter — so nothing about it may be called
   * approximate because of what the method is called. */
  const onlyJson = configAs('strip-json', (cfg) => {
    cfg.minify = { engine: 'strip' };
    cfg.columns = cfg.columns.filter((c) => c.label === 'package.json');
  });
  const jsoned = JSON.parse(runSize(PLAIN, ['--config', onlyJson, '--data']).stdout);
  const jsonMin = jsoned.metrics.find((m) => m.key === 'min');
  assert.equal(Object.prototype.hasOwnProperty.call(jsonMin, 'accuracy'), false,
    'the metric still carries an accuracy mark: the caption looks at the name of the way rather than at the cells');
  assert.equal(Object.prototype.hasOwnProperty.call(jsoned, 'approx'), false,
    'the contract still carries marks of approximation');
});

/* Accuracy reaches the cell itself rather than stopping at the metric label: where the minifier took the
 * file the number is exact, and where the format is foreign to it, it is not. The row of marks comes from
 * the contract (`--data`) rather than from the engine's internals, and is compared with the very columns
 * the drop in numbers was checked on. */
test('with real minification the other formats are named and no cell is marked', () => {
  const all = runSize(PLAIN, ['--config', configAs('esbuild-cells', () => {}), '--data']);
  assert.equal(all.code, 0, 'the run with minification fell over: ' + all.stderr.trim());
  const data = JSON.parse(all.stdout);
  assert.equal(Object.prototype.hasOwnProperty.call(data, 'approx'), false,
    'the contract still carries marks of approximation, though the minifier does not take some formats');
  const min = data.metrics.find((m) => m.key === 'min');

  MINIFIED.forEach((label) => {
    const ext = label.slice(label.lastIndexOf('.'));
    assert.equal(min.method.indexOf(ext), -1,
      'the format «' + label + '» is named as counted another way, though the minifier takes it: ' + min.method);
  });

  ['заметки.md', 'table.toml', 'crlf.txt'].forEach((label) => {
    const ext = label.slice(label.lastIndexOf('.'));
    assert.ok(min.method.indexOf(ext) >= 0,
      'the other count of «' + label + '» is not named in the way: ' + min.method);
  });
});

test('with no optional dependency the metric retreats to stripping — without falling over', () => {
  const file = configAs('esbuild', () => {});
  const json = runSize(PLAIN, ['--config', file, '--json'], OFF);
  assert.equal(json.code, EXIT.SENSOR,
    'the retreat is not named by code 4: code ' + json.code + ', ' + json.stderr.trim());
  assert.equal(json.stdout, goldenText,
    'with no minifier the numbers do not equal the former way: ' + json.stderr.trim());
  assert.match(json.stderr, /the minifier is unavailable/, 'the retreat is not explained');
  assert.match(json.stderr, /minify.*engine.*strip/, 'the retreat did not name a repair');

  const dir = cloneFixture(path.join(tmp, 'write-off'));
  assert.equal(runSize(dir, ['--config', file, '--write'], OFF).code, EXIT.SENSOR,
    'building the report with no minifier did not name the retreat');
  assert.ok(fs.existsSync(path.join(dir, 'docs', 'size-table.html')),
    'the report with no minifier is not built: a retreat must not be a refusal');
  assert.equal(runSize(dir, ['--config', file], OFF).code, EXIT.SENSOR,
    'the checking mode with no minifier did not name the retreat');

  const data = runSize(PLAIN, ['--config', file, '--data'], OFF);
  const min = JSON.parse(data.stdout).metrics.find((m) => m.key === 'min');
  assert.equal(Object.prototype.hasOwnProperty.call(min, 'accuracy'), false,
    'the retreat is passed off as a mark of accuracy');
  assert.ok(min.method.indexOf('esbuild недоступен') >= 0,
    'the way does not say why the count goes by stripping: ' + min.method);
  assert.ok(min.method.indexOf('0.28.2') < 0, 'the way names the version of a minifier that is not there');
});

test('a divergence and a retreat together: both are named, and the verdict belongs to the divergence', () => {
  /* The report was assembled with the real minifier while the check runs without it: the numbers
   * honestly differ, and the real cause is the other count rather than an edit outside the report. The
   * verdict still goes to the discrepancy (code 1), while the fact of the other count is named as a note:
   * code 4 would assert that the difference is explained by the sensor, and nobody checked that — the
   * discrepancy may be a genuine edit on disk. The order is the same as in `doctor` and in coverage: a
   * violation outranks a count taken another way. */
  const file = configAs('esbuild-report', () => {});
  const dir = cloneFixture(path.join(tmp, 'report-with-esbuild'));
  assert.equal(runSize(dir, ['--config', file, '--write']).code, EXIT.OK,
    'the report with the minifier was not built — there would be nothing to compare');

  const check = runSize(dir, ['--config', file], OFF);
  assert.equal(check.code, EXIT.VIOLATION,
    'the verdict is given to the other count: code ' + check.code + ', ' + check.stderr.trim());
  assert.match(check.stderr, /diverged from the git history/,
    'the divergence is not named: ' + check.stderr.trim());
  assert.match(check.stderr, /the minifier is unavailable/,
    'the other count is not named, and the divergence is left without a reason: ' + check.stderr.trim());

  const cover = runSize(dir, ['--config', file, 'check'], OFF);
  assert.equal(cover.code, EXIT.VIOLATION,
    'coverage did not name the violation: code ' + cover.code + ', ' + cover.stderr.trim());
  assert.match(cover.stderr, /the minifier is unavailable/,
    'coverage was silent about the other count, though it named the violation: ' + cover.stderr.trim());
});

test('a file the minifier did not parse is a refusal with a real cause', () => {
  /* The advice of this refusal is only moving the extension under simplification, and that is proved by a
   * run: switching the engine to `strip` does not save this file, it hands it to the `minify.guard` check
   * (which has its say for `.js`), so promising it here would promise an exit that does not exist. Both
   * halves are run in `test/module.test.js`. */
  assert.throws(() => minifyWithEsbuild('<div>нет</div>\n', 'src/lie.js', 'abc1234'),
    (e) => e.code === EXIT.CONFIG && e.message.indexOf('src/lie.js') >= 0
      && e.message.indexOf('ERROR:') >= 0
      && e.message.indexOf('{".js": "strip-lines"}') >= 0
      && e.message.indexOf('"engine": "strip"') < 0,
    'the refusal named neither the file, nor the cause, nor a way out of the dead end');

  /* The same refusal, but through the engine: the extension lied about the content in the history. The
   * check runs on `.ts`: a simplification merely trims such a file line by line (and would stay silent),
   * while the minifier has to refuse, because it did not parse it. */
  const dir = cloneFixture(path.join(tmp, 'lie'));
  fs.writeFileSync(path.join(dir, 'src', 'lie.ts'), '<div>нет</div>\n');
  gitIn(dir, ['add', 'src/lie.ts']);
  gitIn(dir, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local', 'commit', '-qm', 'не TypeScript в .ts']);
  const file = configAs('lie', (cfg) => { cfg.columns.push({ label: 'lie.ts', paths: ['src/lie.ts'] }); });
  const res = runSize(dir, ['--config', file, '--write']);
  refusal(res, EXIT.CONFIG, 'the extension lied about its contents');
  assert.match(res.stderr, /src\/lie\.ts/, 'the refusal did not name the file: ' + res.stderr.trim());
});

test('the --init draft leads a new project to real minification', () => {
  const { dir, file } = draftedRepo(path.join(tmp, 'fresh'),
    'function width(items) {\n  // сумма ширин\n  const totalWidth = items.reduce((sum, item) => sum + item.width, 0);\n  return totalWidth;\n}\n');
  assert.equal((readJson(file).minify || {}).engine, 'esbuild', 'the draft does not lead to real minification');
  loadConfig(file); // the settings check has to accept what the hint gives out

  const data = JSON.parse(runSize(dir, ['--data']).stdout);
  const min = data.metrics.find((m) => m.key === 'min');
  assert.match(min.method, /^esbuild \d+\.\d+\.\d+ \(minify, rename\)$/,
    'the first report of a new project is not built by the minifier: ' + min.method);
  assert.equal(Object.prototype.hasOwnProperty.call(min, 'accuracy'), false,
    'the metric still carries an accuracy mark');
});

test('an unknown way of minification is a settings refusal with a ready repair', () => {
  const file = path.join(tmp, 'bad-engine.json');
  const cfg = readJson(CONFIG);
  cfg.minify = { engine: 'babel' };
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  const res = runSize(PLAIN, ['--config', file, '--json']);
  refusal(res, EXIT.CONFIG, 'a config with an unknown way of minification');
  assert.match(res.stderr, /strip, esbuild/, 'the refusal did not name what to choose from: ' + res.stderr.trim());
});

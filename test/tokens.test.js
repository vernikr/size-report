/* Tokens — the third measurement of the report: "weight for a language model". What is checked is what
 * makes the count honest rather than merely present: the number is taken with the very dictionary the
 * settings asked for (the encoding is part of the count rather than a detail), an approximate value is
 * named approximate, and a format for which tokens are meaningless is not passed off as counted.
 *
 * The anchors are numbers written by hand for fixed texts rather than derived from the code under check, so
 * the check is not circular (any other implementation of the same encoding can be held against them); the
 * rest were taken with the dictionary on fixed strings and guard the wiring — which encoding, whether the
 * text is normalised on the way.
 *
 * A missing dictionary is checked in the same environment as the minifier (`SIZE_REPORT_NO_OPTIONAL`) — an
 * install without the optional dependencies.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CHARS_PER_TOKEN, TOKEN_DEFAULTS, estimate } from '../src/tokens.js';
import { tokenCount } from '../src/tokens.js';
import { EXIT } from '../src/refusal.js';
import {
  CONFIG, PACKAGE, cloneFixture, draftedRepo, gitIn, readJson, readRun, refusal, runSize, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('tokens');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const PLAIN = sharedClone('plain', tmp);
const OFF = { SIZE_REPORT_NO_OPTIONAL: '1' };
const O200K = { family: 'openai', encoding: 'o200k_base' };
const CL100K = { family: 'openai', encoding: 'cl100k_base' };

/* A copy of the reference settings with tokens: the history and the columns stay the same, so the numbers
 * are comparable with `raw` and `min` of the same revision. */
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

// Code points rather than UTF-16 units: the estimate by length counts the same way.
function codePoints(text) {
  return [...text].length;
}

test('the count goes by the dictionary that was asked for: the encoding is part of the number', () => {
  // A hand-written anchor: for this phrase the count is fixed by the text, not derived from this code.
  assert.equal(tokenCount('hello world', O200K), 2, 'the anchor number of the dictionary did not match');
  assert.equal(tokenCount('', O200K), 0, 'an empty file is not zero tokens');
  assert.equal(tokenCount('hello world', CL100K), 2, 'latin text in cl100k_base is counted differently');

  // Russian text counts differently under different encodings — and that is no detail.
  const ru = 'Привет, мир!';
  assert.equal(tokenCount(ru, O200K), 5, 'o200k_base counted the Russian string differently');
  assert.equal(tokenCount(ru, CL100K), 7, 'cl100k_base counted the Russian string differently');
  assert.notEqual(tokenCount(ru, O200K), tokenCount(ru, CL100K),
    'the choice of encoding stopped telling on the number: the metric names it to no purpose');

  const sample = 'const longName = (a, b) => a + b;\n';
  assert.equal(tokenCount(sample, O200K), tokenCount(sample, O200K),
    'two counts of one text diverged: the report is no longer reproducible');
});

test('in the report tokens are neither bytes nor the minified size', () => {
  const res = runSize(PLAIN, ['--config', TOK, '--json']);
  assert.equal(res.code, 0, 'the report with tokens was not built: ' + res.stderr.trim());
  const data = JSON.parse(res.stdout);
  const last = data.rows.length - 1;
  const ratios = [];
  data.columns.forEach((col, ci) => {
    const cell = data.rows[last].cells[ci];
    if (cell === null || cell.raw === 0) return;
    assert.ok(cell.tok > 0, '«' + col.label + '» holds no tokens at all');
    assert.ok(cell.tok < cell.raw,
      '«' + col.label + '» holds at least as many tokens as bytes: ' + cell.tok + ' against ' + cell.raw);
    assert.notEqual(cell.tok, cell.min,
      'the tokens of «' + col.label + '» equal the minified size: these are different quantities');
    ratios.push(cell.raw / cell.tok);
  });
  // Bytes per token is no constant: code, Russian text and JSON each have their own.
  const spread = Math.max.apply(null, ratios) / Math.min.apply(null, ratios);
  assert.ok(spread > 2,
    'bytes per token hardly differ across files (' + spread.toFixed(2) + '): '
      + 'so the «tokens» are counted from a ratio rather than from text');
});

test('with no dictionary the count goes by a length estimate — and that is named and counted', () => {
  // No metric asked for it — so the dictionary is not needed either: the report comes out with an ordinary
  // code.
  const quiet = runSize(PLAIN, ['--config', NO_TOK, '--json'], OFF);
  assert.equal(quiet.code, EXIT.OK,
    'with no tokens among the metrics the run stumbled over the missing dictionary: ' + quiet.stderr.trim());

  const res = runSize(PLAIN, ['--config', TOK, '--json'], OFF);
  assert.equal(res.code, EXIT.SENSOR,
    'an estimate instead of an exact count is not named by code 4: code ' + res.code + ', ' + res.stderr.trim());
  assert.match(res.stderr, /the metric "tok" counts by an estimate/, 'the retreat is not explained');
  assert.match(res.stderr, /"tok" from metrics/, 'the retreat did not name a repair');

  const data = runSize(PLAIN, ['--config', TOK, '--data'], OFF);
  const view = JSON.parse(data.stdout).metrics.find((m) => m.key === 'tok');
  assert.equal(view.accuracy, 'approximate', 'the estimate is passed off as an exact count');
  assert.match(view.method, new RegExp('1 токен ≈ ' + CHARS_PER_TOKEN + ' знака'),
    'the way names neither the estimate nor its coefficient: ' + view.method);
  assert.ok(view.method.indexOf('недоступен') >= 0, 'способ не говорит, почему счёт оценкой');
  assert.ok(view.method.indexOf('4.0.0') < 0, 'the way names the version of a dictionary that is not there');

  // The estimate is exactly the coefficient the method names, not "a similar number".
  const text = fs.readFileSync(path.join(PLAIN, 'src', 'code.js'), 'utf8');
  const ci = JSON.parse(data.stdout).files.findIndex((f) => f.label === 'code.js');
  assert.equal(JSON.parse(data.stdout).now[ci].tok, estimate(text),
    'the estimate in the report did not match the length estimate');
  assert.equal(estimate(text), Math.ceil(codePoints(text) / CHARS_PER_TOKEN),
    'the estimate is not counted by code points');
});

test('a format for which tokens are meaningless is not passed off as counted', () => {
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
  assert.equal(res.code, 0, 'the data with a binary column was not built: ' + res.stderr.trim());
  const view = JSON.parse(res.stdout).metrics.find((m) => m.key === 'tok');
  assert.equal(view.accuracy, 'approximate',
    'a report with a binary format promises an exact token count: ' + view.method);
  assert.ok(view.method.indexOf('.png') >= 0,
    'the approximation is not named by format: ' + view.method);
});

test('an unknown family and an unknown encoding are a settings refusal with a list', () => {
  const badFamily = configAs('bad-family', ['raw', 'tok'], { family: 'gemini', encoding: 'o200k_base' });
  const res = runSize(PLAIN, ['--config', badFamily, '--json']);
  refusal(res, EXIT.CONFIG, 'a config with an unknown family');
  assert.match(res.stderr, /openai/, 'the refusal did not name what to choose from: ' + res.stderr.trim());

  const badEncoding = configAs('bad-encoding', ['raw', 'tok'], { family: 'openai', encoding: 'p50k_base' });
  const res2 = runSize(PLAIN, ['--config', badEncoding, '--json']);
  refusal(res2, EXIT.CONFIG, 'a config with an unknown encoding');
  assert.match(res2.stderr, /o200k_base, cl100k_base/,
    'the refusal did not name the encodings of the family: ' + res2.stderr.trim());
});

test('the --init draft leads a new project to tokens, and the first report is exact', () => {
  const { dir, file } = draftedRepo(path.join(tmp, 'fresh'),
    '// комментарий\nfunction width(items) { return items.length; }\n');
  const draft = readJson(file);
  assert.equal(draft.metrics.indexOf('tok') >= 0, true, 'the draft does not ask for tokens');
  assert.deepEqual(draft.tokens, TOKEN_DEFAULTS, 'the draft did not name the token dictionary');

  assert.equal(runSize(dir, ['--write']).code, 0, 'the first report of a new project was not built');
  const res = runSize(dir, ['--data']);
  assert.equal(res.code, 0, 'the data of a new project was not built: ' + res.stderr.trim());
  const view = JSON.parse(res.stdout).metrics.find((m) => m.key === 'tok');
  assert.equal(view.accuracy, 'exact', 'the first report of a new project counts the tokens by an estimate');
  assert.match(view.method, /^gpt-tokenizer \d+\.\d+\.\d+, o200k_base \(BPE\)$/,
    'the first report is built with a dictionary other than the one the draft asked for: ' + view.method);
});

test('the runs that did not ask for tokens leave the dictionary alone', () => {
  const before = readRun(PACKAGE, PLAIN, ['--json']);
  const withTokens = runSize(PLAIN, ['--config', TOK, '--json']);
  assert.equal(before.code, 0, 'the former report broke: ' + before.stderr.trim());
  assert.equal(withTokens.code, 0, 'the report with tokens broke: ' + withTokens.stderr.trim());
  const without = JSON.parse(before.stdout);
  const with3 = JSON.parse(withTokens.stdout);
  assert.equal(without.metrics.length, 2, 'a superfluous metric got into the former report');
  assert.equal(with3.metrics.length, 3, 'the token metric did not get into the report');
  assert.equal(without.rows.length, with3.rows.length,
    'the set of report rows depends on whether tokens were asked for');
});

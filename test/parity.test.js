/* The port's parity: the engine's package yields exactly the bytes the fixture's golden was taken
 * from — numbers (`--json`) and the artifact. Telling "the engine broke" from "the golden moved" is
 * the frozen copy's business, a subject of its own (`frozen.test.js`).
 *
 * Read-only runs share one clone of the fixture and are cached (`readRun`): the same command in the
 * same environment must not be run twice for two checks. Runs that write (`--write` and the control
 * mode on their own report) take a clone of their own — they leave a file behind, and a shared clone
 * would no longer be the one the numbers were taken on.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG, PACKAGE, SYNTH, cloneFixture, firstDiff, readRun, requireTarget, runFixtureWith,
  sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('parity');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const goldenText = fs.readFileSync(path.join(SYNTH, 'golden.json'), 'utf8');
const goldenJson = JSON.parse(goldenText);

/* The clone for read-only runs: `--json` and the locale check write nothing. */
const PLAIN = sharedClone('plain', tmp);

test('движок пакета: --json побайтово равен эталону', () => {
  requireTarget(PACKAGE);
  const res = readRun(PACKAGE, PLAIN, ['--json']);
  assert.equal(res.code, 0, 'инструмент не отдал --json (код ' + res.code + '): ' + res.stderr.trim());
  assert.equal(res.stdout, goldenText,
    'вывод --json разошёлся с эталоном: ' + firstDiff(res.stdout, goldenText));
});

test('движок пакета: --write собирает отчёт и проходит свой контроль', () => {
  requireTarget(PACKAGE);
  const dir = cloneFixture(path.join(tmp, 'write'));
  const wrote = runFixtureWith(PACKAGE, dir, ['--write']);
  assert.equal(wrote.code, 0, 'инструмент не собрал отчёт: ' + wrote.stderr.trim());

  /* The report has to be self-contained: data, styles and program inside it, no external reference.
   * There is deliberately no byte comparison with the frozen copy's artifact: that copy wrote a static
   * table, so there is no form to compare — the numbers were compared above. */
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const report = fs.readFileSync(path.join(dir, cfg.output), 'utf8');
  ['src="', '<link '].forEach((mark) => assert.equal(report.indexOf(mark), -1,
    'в отчёте есть внешняя ссылка (' + mark + '): открыть его без сети было бы нечем'));
  assert.ok(report.indexOf('id="data"') > 0, 'в отчёте нет данных контракта');
  assert.ok(report.indexOf('<style>') > 0, 'в отчёте нет оформления');

  const checked = runFixtureWith(PACKAGE, dir, []);
  assert.equal(checked.code, 0,
    'контрольный режим красный на своём же артефакте: ' + checked.stderr.trim());

  const rows = /: (\d+) rows × (\d+) files/.exec(wrote.stdout);
  assert.notEqual(rows, null, 'сборка не отчиталась числом строк: ' + wrote.stdout.trim());
  assert.equal(Number(rows[1]), goldenJson.rows.length, 'число строк разошлось с эталоном');
  assert.equal(Number(rows[2]), goldenJson.columns.length, 'число колонок разошлось с эталоном');
});

test('движок пакета: числа не зависят от локали', () => {
  requireTarget(PACKAGE);
  const res = readRun(PACKAGE, PLAIN, ['--json'], { LC_ALL: 'C', LANG: 'C' });
  assert.equal(res.code, 0, 'под LC_ALL=C инструмент упал: ' + res.stderr.trim());
  assert.equal(res.stdout, goldenText,
    'под LC_ALL=C вывод разошёлся с эталоном (пути вне ASCII читаются иначе): '
      + firstDiff(res.stdout, goldenText));
});

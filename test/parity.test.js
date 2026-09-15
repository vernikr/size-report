/* Паритет переноса: движок пакета даёт ровно те байты, с которых снят эталон —
 * числа (`--json`) и артефакт. Замороженная копия, отличающая «сломался движок»
 * от «поехал эталон», живёт в соседнем наборе (`frozen.test.js`): это другой
 * предмет, и внутри файла проверки идут последовательно, а работа здесь —
 * запуск процессов, поэтому раскладка по файлам отдаёт проверкам ядра.
 *
 * Прогоны на чтение идут на общем клоне фикстуры и кэшируются (`readRun`): одна
 * и та же команда в одном окружении не должна запускаться дважды ради двух
 * проверок. Собирающие прогоны (`--write` и контроль на своём отчёте) берут
 * свой клон — они пишут файл, и общий клон был бы уже не тем, на котором стоят
 * числа.
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

/* Клон для прогонов на чтение: `--json` и проверка локали ничего не пишут. */
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

  /* Собранный отчёт обязан быть самодостаточным: данные, оформление и программа —
   * в нём самом, и ни одной внешней ссылки. Побайтовой сверки с замороженной
   * копией здесь нет намеренно: та копия писала статическую таблицу, и сверять
   * форму не с чем — числа уже сверены выше (`--json` побайтово равен эталону). */
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const report = fs.readFileSync(path.join(dir, cfg.output), 'utf8');
  ['src="', '<link '].forEach((mark) => assert.equal(report.indexOf(mark), -1,
    'в отчёте есть внешняя ссылка (' + mark + '): открыть его без сети было бы нечем'));
  assert.ok(report.indexOf('id="data"') > 0, 'в отчёте нет данных контракта');
  assert.ok(report.indexOf('<style>') > 0, 'в отчёте нет оформления');

  const checked = runFixtureWith(PACKAGE, dir, []);
  assert.equal(checked.code, 0,
    'контрольный режим красный на своём же артефакте: ' + checked.stderr.trim());

  const rows = /: (\d+) строк × (\d+) файлов/.exec(wrote.stdout);
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

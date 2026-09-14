/* Герметичность окружения: вывод не зависит ни от настроек git на машине, ни от
 * локали. Выкладка с CRLF — соседний набор (`crlf.test.js`): это про то, как git
 * положил файлы на диск, а не про то, какие правила он читает.
 *
 * Числа сверяются прямо с замороженным эталоном, а не с «базовым» прогоном
 * рядом: эталон и есть доказательство, а лишний прогон только повторял бы уже
 * сделанное. Само отсутствие зависимости проверяется сравнением в чужих
 * окружениях — здесь их пять, и каждое по-своему могло бы подмешаться в разбор.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  PACKAGE, SYNTH, firstDiff, gitConfig, readRun, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('environment');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const goldenText = fs.readFileSync(path.join(SYNTH, 'golden.json'), 'utf8');
const goldenJson = JSON.parse(goldenText);
const PLAIN = sharedClone('plain', tmp);

/* Окружения, в которых вывод обязан остаться тем же. Первое — заодно свидетель
 * починки B1: настроек машины нет вовсе, то есть git ведёт себя как на
 * большинстве машин с установкой по умолчанию. */
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
  HOSTILE_ENVS.forEach(({ label, env }) => {
    const res = readRun(PACKAGE, PLAIN, ['--json'], env);
    assert.equal(res.code, 0, 'инструмент упал в окружении «' + label + '»: ' + res.stderr.trim());
    assert.equal(res.stdout, goldenText,
      'окружение «' + label + '» изменило вывод: ' + firstDiff(res.stdout, goldenText));
  });
});

/* Свидетель починки: то самое окружение, в котором фикстура раньше теряла строку. */
test('в окружении без настроек машины фикстура даёт 14 строк и все колонки', () => {
  const res = readRun(PACKAGE, PLAIN, ['--json'], { GIT_CONFIG_GLOBAL: '/dev/null' });
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


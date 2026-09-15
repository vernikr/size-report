/* Tightness of the environment: the output depends neither on the machine's git settings nor on the
 * locale. A CRLF working tree is a neighbouring suite (`crlf.test.js`): that is about how git laid the
 * files out, not about which rules it reads.
 *
 * The numbers are compared with the frozen standard rather than with a "baseline" run beside it: the
 * standard is the proof, and an extra run would only repeat what was already done. The absence of
 * dependence is what the comparison in hostile environments shows — each of them could mix into the
 * parse in its own way.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PACKAGE, SYNTH, firstDiff, gitBare, gitConfig, readRun, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('environment');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const goldenText = fs.readFileSync(path.join(SYNTH, 'golden.json'), 'utf8');
const goldenJson = JSON.parse(goldenText);
const PLAIN = sharedClone('plain', tmp);

/* Environments in which the output has to stay the same. The first is also the witness of the fix for
 * B1: with no machine settings at all, git behaves as on a machine where nothing was configured. */
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

/* The two checks below ask git one and the same question, so they ask it in one place: what an
 * environment trick does to the answer is their whole subject, and two copies of the asking would
 * drift apart. The read is deliberately unpinned — the environment is under check, not the reading of
 * a repository. */
function quotePath(args, env) {
  const res = gitBare(args.concat(['config', '--get', 'core.quotePath']),
    { env: Object.assign({}, process.env, env) });
  return (res.stdout || '').trim();
}

test('окружение теста умеет задавать настройки git (нужен git ≥ 2.31)', () => {
  assert.equal(quotePath([], gitConfig({ 'core.quotePath': 'true' })), 'true',
    'git не принимает настройки через окружение: чужие правила машины задать нечем, '
      + 'а значит герметичность нечем и проверить');
});

/* A command-line key outranks both the machine's settings and the environment's — which is what the fix
 * rests on: the pin lives in the engine, not in someone else's config. */
test('закрепление движка нельзя перебить из окружения', () => {
  const poisoned = gitConfig({ 'core.quotePath': 'true' });
  assert.equal(quotePath(['-c', 'core.quotePath=false'], poisoned), 'false',
    'ключ командной строки больше не сильнее окружения: закрепление в движке ничего не гарантирует');
});

/* The main check of the fix for B1: a hostile environment changes not a single byte of the output. */
test('вывод движка не зависит от настроек git и локали', () => {
  HOSTILE_ENVS.forEach(({ label, env }) => {
    const res = readRun(PACKAGE, PLAIN, ['--json'], env);
    assert.equal(res.code, 0, 'инструмент упал в окружении «' + label + '»: ' + res.stderr.trim());
    assert.equal(res.stdout, goldenText,
      'окружение «' + label + '» изменило вывод: ' + firstDiff(res.stdout, goldenText));
  });
});

/* The witness of the fix: the very environment in which the fixture used to lose a row. */
test('в окружении без настроек машины фикстура даёт 14 строк и все колонки', () => {
  const res = readRun(PACKAGE, PLAIN, ['--json'], { GIT_CONFIG_GLOBAL: '/dev/null' });
  assert.equal(res.code, 0, 'инструмент упал: ' + res.stderr.trim());
  const data = JSON.parse(res.stdout);

  assert.equal(data.rows.length, goldenJson.rows.length,
    'строк ' + data.rows.length + ' вместо ' + goldenJson.rows.length
      + ': в окружении с настройками git по умолчанию снова теряется коммит');
  assert.equal(data.skipped.length, goldenJson.skipped.length,
    'пропущено ' + data.skipped.length + ' коммитов вместо ' + goldenJson.skipped.length);

  // The column holding a non-English path: the one that used to come out empty altogether.
  const notes = data.columns.findIndex((c) => /[^\u0000-\u007f]/.test(c.label));
  assert.ok(notes >= 0, 'в фикстуре нет колонки с не-ASCII меткой');
  assert.ok(data.rows.some((r) => r.cells[notes] !== null),
    'колонка «' + data.columns[notes].label + '» пуста: файла для инструмента не существует');

  // The commit whose only change of volume was that column.
  assert.ok(data.rows.some((r) => r.subject === 'fixture: ветка — правка кода и заметок'),
    'коммит, терявший строку из-за колонки с не-ASCII путём, снова её не получил');
});


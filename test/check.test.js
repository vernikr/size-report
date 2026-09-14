/* Полнота покрытия (`size check`) и объяснение пропущенной строки (`size explain`).
 *
 * Обе команды отвечают на вопросы, которые до сих пор приходилось разбирать
 * руками: «изменение прошло мимо отчёта?» и «почему у этого коммита нет строки?».
 * Поэтому проверяются они не формой ответа, а случаями из фикстуры — настоящими
 * коммитами: «только отчёт», «замена символа без изменения объёма», «только
 * журнал», слияние, — и тем, чего инструмент не имеет права утверждать: путь,
 * объявленный колонкой или исключением, не должен считаться непокрытым, а
 * починка настроек не должна двигать числа отчёта.
 *
 * Клон фикстуры — общий на набор и только на чтение: обе команды ничего не пишут.
 * Прогонов здесь много (по одному на случай — каждый запуск процесса и несколько
 * вызовов git), поэтому файл держится одним из самых дорогих в наборе: цена
 * названа в бюджете времени (`REFACTOR.md` §3), а не спрятана.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG, hasStack, readJson, runFixture, runSize, sharedClone, tempDir } from '../tools/harness.js';

const tmp = tempDir('check');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const dir = sharedClone('plain', tmp);

// Путь, которого нет ни в колонках фикстуры, ни в её исключениях: его и заводит
// полнота. Коммит, заведший его, — первый в истории (`3294a69`).
const LOOSE = 'README.md';
const LOOSE_SINCE = '3294a69';
// Коммиты фикстуры, выпавшие без строки (эталон `--json` говорит то же).
const ONLY_REPORT = 'cd78fd9';
const NO_VOLUME = '9fee206';

function configWith(name, edit) {
  const cfg = JSON.parse(JSON.stringify(readJson(CONFIG)));
  const file = path.join(tmp, name);
  fs.writeFileSync(file, JSON.stringify(edit(cfg), null, 2) + '\n');
  return file;
}

function firstLine(text) {
  return text.trim().split('\n')[0];
}

test('полнота: непокрытый путь назван вместе с коммитом и починкой', () => {
  const res = runFixture(dir, ['check']);
  assert.equal(res.code, 1, 'путь мимо колонок не стал нарушением:\n' + res.stdout + res.stderr);
  assert.equal(hasStack(res.stdout + res.stderr), false, 'ответ пришёл стеком вместо объяснения');
  assert.ok(res.stdout.indexOf(LOOSE) >= 0, 'непокрытый путь не назван:\n' + res.stdout);
  assert.ok(res.stdout.indexOf(LOOSE_SINCE) >= 0, 'не назван коммит, заведший путь:\n' + res.stdout);
  assert.match(res.stdout, /починка: .*--init/, 'нет готовой команды починки:\n' + res.stdout);
});

test('полнота: сказано, какая часть истории покрыта и кто выпал', () => {
  const res = runFixture(dir, ['check', '--json']);
  assert.equal(res.code, 1);
  const rep = JSON.parse(res.stdout);
  assert.equal(rep.schema, 1, 'у ответа нет схемы — агенту не на что ветвиться');
  assert.equal(rep.ok, false);
  assert.deepEqual(rep.paths.unknown.map((u) => u.path), [LOOSE], 'названы не те пути');
  assert.equal(rep.paths.unknown[0].since.slice(0, 7), LOOSE_SINCE, 'улика указывает не на тот коммит');
  assert.equal(rep.history.commits, 16, 'история посчитана не та');
  assert.equal(rep.history.rows, 14, 'строк в отчёте не 14');
  assert.deepEqual(rep.history.byReason, { merge: 0, report: 1, flat: 1 },
    'выпавшие коммиты разложены не по тем причинам');
  assert.deepEqual(rep.history.dropped.map((d) => d.reason).sort(), ['flat', 'report']);

  const text = runFixture(dir, ['check']).stdout;
  assert.ok(text.indexOf(ONLY_REPORT) >= 0 && text.indexOf(NO_VOLUME) >= 0,
    'в тексте не названы коммиты, выпавшие без строки:\n' + text);
  assert.match(text, /только таблица 1/, 'в тексте нет сводки по причинам:\n' + text);
});

test('полнота: путь, ставший колонкой или исключением, закрывает нарушение', () => {
  const asSkip = configWith('skip.json', (cfg) => { cfg.skip = [LOOSE]; return cfg; });
  const asColumn = configWith('column.json', (cfg) => {
    cfg.columns.push({ label: LOOSE, paths: [LOOSE] });
    return cfg;
  });
  [[asSkip, 'исключением'], [asColumn, 'колонкой']].forEach(([file, how]) => {
    const res = runSize(dir, ['--config', file, 'check', '--json']);
    assert.equal(res.code, 0, 'путь, объявленный ' + how + ', не закрыл полноту:\n'
      + res.stdout + res.stderr);
    const rep = JSON.parse(res.stdout);
    assert.equal(rep.ok, true, 'полнота объявлена неполной, хотя пути разобраны');
    assert.deepEqual(rep.paths.unknown, [],
      'ложные непокрытые пути: ' + JSON.stringify(rep.paths.unknown));
    assert.equal(rep.history.rows, 14, 'починка настроек сдвинула числа отчёта: строк стало '
      + rep.history.rows);
  });

  const text = runSize(dir, ['--config', asSkip, 'check']);
  assert.match(firstLine(text.stdout), /тронутые пути отслеживаются или исключены/,
    'на полном покрытии инструмент не сказал этого прямо:\n' + text.stdout);
});

test('объяснение: числа не сдвинулись — назван файл колонки и сказано, что делать нечего', () => {
  const res = runFixture(dir, ['explain', NO_VOLUME]);
  assert.equal(res.code, 0, 'объяснение вернуло код отказа:\n' + res.stdout + res.stderr);
  assert.match(res.stdout, /числа не сдвинулись/, 'причина названа не та:\n' + res.stdout);
  assert.ok(res.stdout.indexOf('src/code.js') >= 0, 'не назван файл колонки, который тронул коммит');
  assert.match(res.stdout, /починка: не требуется/, 'предложена починка там, где починять нечего');
});

test('объяснение: коммит только отчёта — причина и что это не дефект', () => {
  const res = runFixture(dir, ['explain', ONLY_REPORT]);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /тронут только сам отчёт/, 'причина названа не та:\n' + res.stdout);
  assert.ok(res.stdout.indexOf('docs/size-table.html') >= 0, 'не назван файл отчёта');
});

test('объяснение: строка есть — сказано, которая', () => {
  const res = runFixture(dir, ['explain', '25e3f39', '--json']);
  assert.equal(res.code, 0);
  const rep = JSON.parse(res.stdout);
  assert.equal(rep.reason, null, 'у коммита со строкой названа причина пропуска');
  assert.equal(rep.row, 2, 'строка коммита названа не та: ' + rep.row);
  assert.equal(rep.rows, 14);
  assert.deepEqual(rep.touched.columns.sort(), ['WORKLOG.md', 'src/code.js'],
    'не названы файлы колонок, которые тронул коммит');
  assert.deepEqual(rep.touched.untracked, [], 'выдуман непокрытый путь: ' + JSON.stringify(rep.touched));
});

/* Разница, которой нет в строке отчёта: «мимо колонок» — это не то же самое, что
 * «числа не сдвинулись». Коммит только журнала её и показывает: журнал колонкой
 * не отслеживается, объём от него не меняется, и человеку важно знать, почему
 * именно строки нет. */
test('объяснение: коммит мимо колонок отличается от «числа не сдвинулись»', () => {
  const file = configWith('few.json', (cfg) => {
    cfg.columns = [{ label: 'code.js', paths: ['src/code.js'] }];
    return cfg;
  });
  const res = runSize(dir, ['--config', file, 'explain', '9dfe679', '--json']);
  assert.equal(res.code, 0);
  const rep = JSON.parse(res.stdout);
  assert.equal(rep.reason, 'outside', 'коммит мимо колонок назван причиной не того вида: ' + rep.reason);
  assert.deepEqual(rep.touched.untracked, ['WORKLOG.md'], 'не назван путь, оставшийся мимо колонок');
  assert.deepEqual(rep.touched.columns, [], 'названы колонки, которых коммит не касался');
  assert.match(rep.fix, /колонкой или в «skip»/, 'починка не говорит, что делать с таким путём');
});

test('объяснение: слияние объясняется настройкой, которая его скрыла', () => {
  const file = configWith('nomerge.json', (cfg) => { cfg.rows.merges = false; return cfg; });
  const res = runSize(dir, ['--config', file, 'explain', '9326134']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /слияние/, 'причина названа не та:\n' + res.stdout);
  assert.match(res.stdout, /rows\.merges/, 'не сказано, какой настройкой строка скрыта');
  assert.match(res.stdout, /"merges": true/, 'нет готового значения для починки');
});

test('отказы команд: неизвестное слово, неизвестный коммит, неоднозначный префикс', () => {
  const unknown = runFixture(dir, ['sizes']);
  assert.equal(unknown.code, 2, 'неизвестная команда не отказ:\n' + unknown.stdout + unknown.stderr);
  assert.match(unknown.stderr, /--help/, 'отказ не ведёт к справке');

  const absent = runFixture(dir, ['explain', 'zzzzzzz']);
  assert.equal(absent.code, 2);
  assert.equal(hasStack(absent.stderr), false, 'отказ напечатал стек');
  assert.match(absent.stderr, /git log/, 'отказ не даёт готовой команды');

  // Короткий префикс подходит нескольким коммитам фикстуры — здесь выбор за человеком.
  const many = runFixture(dir, ['explain', '9']);
  assert.equal(many.code, 2);
  assert.match(many.stderr, /неоднозначен/, 'неоднозначный префикс разрешён молча:\n' + many.stderr);
  assert.match(many.stderr, /9dfe679/, 'в отказе нет подходящих коммитов');
});

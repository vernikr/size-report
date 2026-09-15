/* Coverage (`size check`) and the explanation of a skipped row (`size explain`).
 *
 * Both commands answer questions that otherwise take manual sorting out: "did the change pass the report
 * by?" and "why has this commit no row?". So they are checked by cases taken from the fixture — real
 * commits: "report only", "a character replaced without a change in volume", "journal only", a merge —
 * and by what the tool has no right to assert: a path declared a column or an exception must not count as
 * uncovered, and a settings fix must not shift the report's numbers.
 *
 * The shared clone is read-only for the suite: both commands write nothing, and the cases that do write take
 * a clone of their own. There are many runs here — one per case, each a process run and several git calls —
 * and that is the whole cost of the file.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG, cloneFixture, gitIn, hasStack, readJson, runFixture, runSize, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('check');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const dir = sharedClone('plain', tmp);

// A path that is neither a column of the fixture nor in its exceptions: coverage is what brings it up.
// The commit that brought it is the first of the history (`3294a69`).
const LOOSE = 'README.md';
const LOOSE_SINCE = '3294a69';
// Commits of the fixture that were dropped without a row (the `--json` reference says the same).
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

/* A difference that is not in the report's row: "outside the columns" is not the same thing as "the
 * numbers did not move". A commit touching the journal alone shows it: the journal is not tracked as a
 * column, its volume does not shift, and a person needs to know why exactly there is no row. */
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

/* One judgement about "outside the columns" and one phrase for it in two answers: `check` asks about the
 * whole history, `explain` about one commit, while the fix text is shared (`src/config.js`) and names the
 * paths. Two phrases for one situation would be a defect: the viewer gets two different commands, and one
 * of them may go out without the names. */
test('мимо колонок: полнота и объяснение говорят одну фразу с именами путей', () => {
  const file = configWith('outside.json', (cfg) => {
    cfg.columns = [{ label: 'code.js', paths: ['src/code.js'] }];
    return cfg;
  });
  const STEM = 'допишите эти пути колонкой или в «skip» файла size-table.config.json: ';
  const rep = JSON.parse(runSize(dir, ['--config', file, 'explain', '9dfe679', '--json']).stdout);
  assert.equal(rep.fix.slice(0, STEM.length), STEM,
    'объяснение говорит о таком пути своими словами:\n' + rep.fix);
  assert.ok(rep.fix.indexOf(rep.touched.untracked[0]) > 0,
    'починка объяснения не назвала путь:\n' + rep.fix);

  const text = runSize(dir, ['--config', file, 'check']).stdout;
  const head = '  починка: ';
  const line = text.split('\n').filter((l) => l.indexOf(head) === 0).pop();
  assert.notEqual(line, undefined, 'полнота не сказала, что делать:\n' + text);
  assert.equal(line.slice(head.length, head.length + STEM.length), STEM,
    'полнота говорит о таком пути своими словами:\n' + line);
  assert.ok(line.indexOf(rep.touched.untracked[0]) > head.length,
    'починка полноты не назвала путь:\n' + line);
});

/* A commit with no files (`git commit --allow-empty`) is the same case from the other end: nothing was left
 * outside the columns, and a repair command without names would be a lie about what to fix. So there is no
 * fix at all here rather than a text with an empty list. */
test('объяснение: коммит без файлов — починки нет, а не команда без имён', () => {
  const side = cloneFixture(path.join(tmp, 'empty'));
  gitIn(side, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local',
    'commit', '-q', '--allow-empty', '-m', 'пустой коммит']);
  const sha = gitIn(side, ['rev-parse', 'HEAD']).trim();
  const res = runFixture(side, ['explain', sha, '--json']);
  assert.equal(res.code, 0, 'объяснение пустого коммита — не ответ:\n' + res.stdout + res.stderr);
  const rep = JSON.parse(res.stdout);
  assert.equal(rep.reason, 'outside', 'причина пропуска названа не та: ' + rep.reason);
  assert.deepEqual(rep.touched.untracked, [], 'у пустого коммита названы тронутые пути');
  assert.equal(rep.fix, null, 'предложена починка без имён: ' + JSON.stringify(rep.fix));

  const text = runFixture(side, ['explain', sha]).stdout;
  assert.equal(/починка:/.test(text), false, 'в тексте команда починки без имён:\n' + text);
});

test('объяснение: слияние объясняется настройкой, которая его скрыла', () => {
  const file = configWith('nomerge.json', (cfg) => { cfg.rows.merges = false; return cfg; });
  const res = runSize(dir, ['--config', file, 'explain', '9326134']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /слияние/, 'причина названа не та:\n' + res.stdout);
  assert.match(res.stdout, /rows\.merges/, 'не сказано, какой настройкой строка скрыта');
  assert.match(res.stdout, /"merges": true/, 'нет готового значения для починки');
});

/* A commit is called the way git calls it: `HEAD`, a branch, `HEAD~1`. The defect class: a name the tool
 * does not understand must not be answered as "no such commit" — that would be a lie about what the person
 * was looking for. */
test('объяснение: коммит называется именем ревизии, и ответ тот же, что по sha', () => {
  [['HEAD', 'HEAD'], ['HEAD~1', 'HEAD~1'], ['main', 'HEAD']].forEach(([name, rev]) => {
    const sha = gitIn(dir, ['rev-parse', rev]).trim();
    const byName = runFixture(dir, ['explain', name, '--json']);
    const bySha = runFixture(dir, ['explain', sha, '--json']);
    assert.equal(byName.code, 0, 'имя ревизии «' + name + '» не объяснилось (код '
      + byName.code + '):\n' + byName.stdout + byName.stderr);
    assert.deepEqual(JSON.parse(byName.stdout), JSON.parse(bySha.stdout),
      'ответ по имени «' + name + '» разошёлся с ответом по sha ' + sha.slice(0, 7));
  });
});

/* Two different causes that are easy to merge into one: there is no such name at all, and the name exists
 * while the commit is not in the report's history (another branch). The second is not "no such commit":
 * the commit exists, and that is exactly what a person needs to hear, together with its sha. */
test('объяснение: несуществующее имя и коммит вне истории отчёта — разные причины', () => {
  const typo = runFixture(dir, ['explain', 'maser']);
  assert.equal(typo.code, 2, 'выдуманное имя не отказ:\n' + typo.stdout + typo.stderr);
  assert.equal(hasStack(typo.stderr), false, 'отказ напечатал стек');
  assert.match(typo.stderr, /не имя ревизии и не начало sha/,
    'отказ не назвал настоящую причину:\n' + typo.stderr);
  assert.match(typo.stderr, /git log/, 'отказ не даёт готовой команды');

  // A branch aside from the current history: the commit exists, but the report builds no row for it.
  const side = cloneFixture(path.join(tmp, 'side'));
  gitIn(side, ['checkout', '-q', '-b', 'side']);
  gitIn(side, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local',
    'commit', '-q', '--allow-empty', '-m', 'ветка мимо отчёта']);
  const sha = gitIn(side, ['rev-parse', 'side']).trim();
  gitIn(side, ['checkout', '-q', 'main']);

  const away = runFixture(side, ['explain', 'side']);
  assert.equal(away.code, 2, 'коммит вне истории отчёта не отказ:\n' + away.stdout + away.stderr);
  assert.match(away.stderr, /нет в истории отчёта/, 'причина названа не та:\n' + away.stderr);
  assert.ok(away.stderr.indexOf(sha.slice(0, 7)) >= 0,
    'отказ не назвал sha коммита, о котором спросили:\n' + away.stderr);
  assert.ok(!/нет такого коммита/.test(away.stderr),
    'коммит, который есть, назван несуществующим:\n' + away.stderr);
});

test('отказы команд: неизвестное слово, неизвестный коммит, неоднозначный префикс', () => {
  const unknown = runFixture(dir, ['sizes']);
  assert.equal(unknown.code, 2, 'неизвестная команда не отказ:\n' + unknown.stdout + unknown.stderr);
  assert.match(unknown.stderr, /--help/, 'отказ не ведёт к справке');

  const absent = runFixture(dir, ['explain', 'zzzzzzz']);
  assert.equal(absent.code, 2);
  assert.equal(hasStack(absent.stderr), false, 'отказ напечатал стек');
  assert.match(absent.stderr, /не имя ревизии и не начало sha/,
    'отказ не назвал настоящую причину:\n' + absent.stderr);
  assert.match(absent.stderr, /git log/, 'отказ не даёт готовой команды');

  // A short prefix matches several commits of the fixture — here the choice is a person's.
  const many = runFixture(dir, ['explain', '9']);
  assert.equal(many.code, 2);
  assert.match(many.stderr, /неоднозначен/, 'неоднозначный префикс разрешён молча:\n' + many.stderr);
  assert.match(many.stderr, /9dfe679/, 'в отказе нет подходящих коммитов');
});

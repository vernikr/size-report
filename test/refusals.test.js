/* Отказы инструмента: каждый говорит правду и помогает выйти из тупика.
 *
 * Предмет проверки — каталог `tools/refusals.js`: в нём по строке на каждый отказ,
 * с фразами, которых в выводе не хватает, если текст стал врать или перестал
 * помогать. Здесь эти строки исполняются: отказ вызывается прогоном, сверяется код
 * выхода и фразы. Вторую половину обещания — что у каждого места отказа в исходниках
 * есть свой пункт каталога, то есть отказ не может появиться молча, — держит
 * `test/refusals-catalog.test.js`: он читает исходники и ничего не запускает.
 *
 * Зачем это отдельной проверкой. Ложную причину в тексте отказа находил живой
 * прогон, и находил четыре раза подряд: закавыченный путь (B1), сравнение байтов
 * вместо содержимого (B3), молчаливое лишнее слово (R-4.13) и `explain HEAD`, где
 * коммит назвали несуществующим. Каждый раз это была случайность. Класс закрывается
 * не пятым исправлением, а тем, что новый отказ не может появиться без строки в
 * каталоге: карты `SITES` (броски исключения) и `PRINTED` (отказы со знаком «✗» и
 * кодом) держат числа мест, и любое новое место видно как расхождение.
 *
 * Чего проверка не берёт, и это сказано, а не спрятано: формулировки вне `must`
 * (смысл, тон, порядок строк), полноту объяснения и то, что видит человек в
 * `--json`. Смысл каждого отказа записан в каталоге полем `truth` — оно не
 * проверяется машиной намеренно: подстрока не отличит верное объяснение от
 * правдоподобного, а притворяться, что отличит, хуже, чем сказать вслух.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CONFIG_CAUSES } from '../src/refusal.js';
import { CASES, PLACEHOLDER, adviceOf } from '../tools/refusals.js';
import { usageCommands, usageFlags } from '../tools/docs-facts.js';
import {
  CONFIG, PACKAGE, PACKAGE_BIN, ROOT, cloneFixture, gitIn, hasStack, readJson, runTool,
  sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('refusals');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* Клон фикстуры — общий на набор и только на чтение: отказы командной строки
 * наступают до того, как инструмент что-либо запишет. */
const FIXTURE = sharedClone('plain', tmp);

// Настройки, которых требует тот или иной отказ. Пишутся заранее: отказ обязан
// наступить на них, а не на отсутствии файла.
const base = readJson(CONFIG);
function writeConfig(name, edit) {
  const file = path.join(tmp, name + '.json');
  fs.writeFileSync(file, typeof edit === 'string' ? edit : JSON.stringify(edit, null, 2) + '\n');
  return file;
}
/* Команды, которые тест называет сам: они цитируются из настроек проекта
 * (`fixCommand`), и каталог ссылается на них подстановкой. Так адрес команды
 * остаётся там, где её собирают, а каталог — договором о том, что она делает. */
const FIXES = {
  [PLACEHOLDER + 'fixNotable']: 'node ' + PACKAGE_BIN + ' --config ' + path.join(tmp, 'notable.json') + ' --write',
  [PLACEHOLDER + 'fixDrift']: 'node ' + PACKAGE_BIN + ' --config ' + path.join(tmp, 'drift.json') + ' --write'
};

const PLACES = {};
[
  [PLACEHOLDER + 'config', CONFIG],
  [PLACEHOLDER + 'missing', path.join(tmp, 'missing.json')],
  [PLACEHOLDER + 'draft', path.join(tmp, 'draft.json')],
  [PLACEHOLDER + 'broken', writeConfig('broken', '{ "columns": [ oops')],
  [PLACEHOLDER + 'empty', writeConfig('empty', { columns: [] })],
  // Путь колонки числом: колонка, которая ни с чем не совпадёт, — это отказ, а не
  // отчёт с нулём строк за успех.
  [PLACEHOLDER + 'badtype', writeConfig('badtype', { columns: [{ label: 'a', paths: [123] }], metrics: ['raw'] })],
  [PLACEHOLDER + 'few', writeConfig('few', {
    columns: [{ label: 'code.js', paths: ['src/code.js'] }], metrics: ['raw'], output: 'docs/size-table.html'
  })],
  // У этих двух настроек `fixCommand` называет настоящую команду: отказ цитирует
  // его как совет, и проверять чужую строку значило бы проверять фикстуру.
  [PLACEHOLDER + 'notable', writeConfig('notable', {
    columns: [{ label: 'code.js', paths: ['src/code.js'] }], metrics: ['raw'],
    output: 'docs/nope.html', fixCommand: FIXES[PLACEHOLDER + 'fixNotable']
  })],
  [PLACEHOLDER + 'drift', writeConfig('drift', Object.assign({}, base, {
    output: 'docs/size-table.html', fixCommand: FIXES[PLACEHOLDER + 'fixDrift']
  }))],
  [PLACEHOLDER + 'sensor', writeConfig('sensor', {
    columns: base.columns, metrics: ['raw', 'min', 'tok'], output: 'docs/nope.html',
    minify: { engine: 'esbuild' }, tokens: { family: 'openai', encoding: 'o200k_base' }
  })],
  // Две половины совета про приближение: без словаря — но с настоящим сжатием, и без
  // токенов — но с настоящим сжатием: так видно, что убирает именно названное.
  [PLACEHOLDER + 'strip', writeConfig('strip', {
    columns: base.columns, metrics: ['raw', 'min'], output: 'docs/nope.html', minify: { engine: 'strip' }
  })],
  [PLACEHOLDER + 'notok', writeConfig('notok', {
    columns: base.columns, metrics: ['raw', 'min'], output: 'docs/nope.html', minify: { engine: 'strip' }
  })]
].forEach((pair) => { PLACES[pair[0]] = pair[1]; });

function args(caseArgs) {
  return caseArgs.map((a) => (PLACES[a] === undefined ? a : PLACES[a]));
}

// Подстановки каталога: `@config` — путь из теста, `@fixDrift` — команда из настроек.
function fill(text) {
  return text.replace(/@[A-Za-z]+/g, (m) => (PLACES[m] !== undefined ? PLACES[m] : (FIXES[m] !== undefined ? FIXES[m] : m)));
}

/* Сценарии: то, что не выражается одними аргументами, — свой клон, чужой хук,
 * обрезанная история. Строятся по требованию: платит за них только тот случай,
 * которому они нужны. */
const built = {};
function once(name, build) {
  if (built[name] === undefined) built[name] = build();
  return built[name];
}

function hookClone(kind) {
  return once(kind, () => {
    const dir = cloneFixture(path.join(tmp, kind));
    if (kind === 'foreign-hook') {
      fs.writeFileSync(path.join(dir, '.git', 'hooks', 'post-commit'), '#!/bin/sh\necho чужой\n');
    } else {
      gitIn(dir, ['config', 'core.hooksPath', path.join(tmp, 'other-hooks')]);
    }
    return { dir: dir };
  });
}

/* Копия движка без `bin/` рядом: так выглядит установка, в которой хук звать
 * нечем. Точка входа — снаружи копии, иначе она бы нашлась сама. */
function toolWithoutBin() {
  return once('src-copy', () => {
    const home = path.join(tmp, 'tool');
    fs.mkdirSync(home, { recursive: true });
    fs.cpSync(path.join(ROOT, 'src'), path.join(home, 'src'), { recursive: true });
    const entry = path.join(tmp, 'entry.mjs');
    fs.writeFileSync(entry, 'import { main } from ' + JSON.stringify(path.join(home, 'src', 'size-table.js'))
      + ';\nprocess.exitCode = main();\n');
    return { dir: FIXTURE, target: { name: 'движок без bin', file: entry, env: null } };
  });
}

const SCENARIOS = {
  'fixture': () => ({ dir: FIXTURE }),
  'barren': () => once('barren', () => {
    const dir = path.join(tmp, 'barren');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'заметка.txt'), 'не репозиторий\n');
    return { dir: dir };
  }),
  // Каталог тот же, но git в PATH нет: окружение и есть предмет случая.
  'no-git': () => SCENARIOS.barren(),
  // Первый зов создаёт файл, второй — отказ; проверяется второй.
  'draft-twice': (caseArgs) => ({ dir: FIXTURE, pre: [args(caseArgs)] }),
  'foreign-hook': () => hookClone('foreign-hook'),
  'hooks-path': () => hookClone('hooks-path'),
  'src-copy': () => toolWithoutBin(),
  'side-branch': () => once('side-branch', () => {
    const dir = cloneFixture(path.join(tmp, 'side-branch'));
    gitIn(dir, ['checkout', '-q', '-b', 'side']);
    gitIn(dir, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local',
      'commit', '-q', '--allow-empty', '-m', 'ветка мимо отчёта']);
    gitIn(dir, ['checkout', '-q', 'main']);
    return { dir: dir };
  }),
  'shallow': () => once('shallow', () => {
    const dir = path.join(tmp, 'shallow');
    gitIn(null, ['clone', '-q', '--depth', '1', '--no-hardlinks', 'file://' + FIXTURE, dir]);
    return { dir: dir };
  }),
  'drift': (caseArgs) => once('drift', () => {
    const dir = cloneFixture(path.join(tmp, 'drift'));
    const tool = { name: 'движок пакета', file: path.join(ROOT, 'bin', 'size.js'), env: null };
    runTool(tool, dir, ['--config', args(caseArgs)[1], '--write']);
    const table = path.join(dir, 'docs', 'size-table.html');
    fs.appendFileSync(table, '<!-- правка только на диске -->\n');
    return { dir: dir };
  })
};

function run(c) {
  const scenario = SCENARIOS[c.scenario](c.args);
  const tool = scenario.target === undefined ? PACKAGE : scenario.target;
  const toolArgs = args(c.args);
  (scenario.pre === undefined ? [] : scenario.pre).forEach((pre) => runTool(tool, scenario.dir, pre, c.env));
  return runTool(tool, scenario.dir, toolArgs, c.env);
}

/* Куда идёт выполнение совета: своя копия фикстуры — если совет пишет в проект,
 * пустой репозиторий — если совет про черновик настроек («в пустом каталоге»
 * сказано в самом совете), иначе — то же место, откуда пришёл отказ. */
function adviceDir(a, fallback) {
  if (a.inClone === true) {
    return once('advice-clone', () => cloneFixture(path.join(tmp, 'advice-clone')));
  }
  if (a.inEmpty === true) {
    return once('advice-empty', () => {
      const dir = path.join(tmp, 'advice-empty');
      fs.mkdirSync(dir, { recursive: true });
      gitIn(dir, ['init', '-q']);
      return dir;
    });
  }
  return fallback;
}

/* Готовая к выполнению команда совета. Форма та же, что печатает инструмент: зов —
 * абсолютный путь к точке входа, потому что из каталога проекта относительный путь
 * в репозиторий пакета не ведёт. */
function adviceCommand(a) {
  return a.args === undefined
    ? fill(a.text)
    : 'node ' + PACKAGE_BIN + ' ' + fill(a.args.join(' '));
}

function runAdvice(cmd, dir, env) {
  const res = spawnSync('bash', ['-c', cmd], {
    cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: Object.assign({}, process.env, env || {})
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/* Каждый прогон совета: код, который он обещает. */
function checkRun(a, where, dir) {
  const cmd = adviceCommand(a);
  const res = runAdvice(cmd, dir, a.env);
  assert.equal(res.code, a.expect, '«' + where + '»: совет «' + cmd + '» отдал код ' + res.code
    + ' вместо ' + a.expect + ' — ' + (res.stdout + res.stderr).trim().split('\n')[0]);
  assert.equal(hasStack(res.stdout + res.stderr), false,
    '«' + where + '»: совет «' + cmd + '» упал стеком вместо работы');
  return res;
}

/* Совет починяет состояние — и это видно по отказу, а не по слову: тот же зов,
 * который до совета отказывал, после него обязан сказать что-то другое. */
function checkFix(c, where, dir) {
  const again = runTool(PACKAGE, dir, args(c.args), c.env);
  const out = again.stdout + again.stderr;
  const still = c.must.filter((phrase) => out.indexOf(phrase) >= 0);
  assert.deepEqual(still, [], '«' + where + '»: совет не починил состояние — тот же зов снова сказал '
    + still.join(', ') + ':\n' + out);
}

/* Проверка совета: объявленный сверяется с тем, что напечатано, и делается с ним
 * то, что объявлено (`run`, `template`, `manual`). `coveredBy` здесь не проверяется —
 * это делает файл, который каталог назвал вместе с исполняемой строкой. */
function verifyAdvice(c, where, out, fallback) {
  const lines = adviceOf(out);
  assert.ok(Array.isArray(c.advice),
    '«' + where + '»: у случая нет строки про совет — каждый отказ обязан назвать, что он советует');
  if (lines.length === 0) {
    assert.deepEqual(c.advice, [], '«' + where + '»: отказ ничего не советует, а каталог объявил совет');
    return;
  }
  lines.forEach((line) => {
    const named = c.advice.filter((a) => line.indexOf(fill(a.args === undefined ? a.text : a.args.join(' '))) >= 0);
    assert.ok(named.length > 0, '«' + where + '»: отказ напечатал совет, которого нет в каталоге: ' + line);
  });
  c.advice.forEach((a) => {
    const shown = a.args === undefined ? fill(a.text) : 'node ' + PACKAGE_BIN + ' ' + fill(a.args.join(' '));
    assert.ok(out.indexOf(shown) >= 0, '«' + where + '»: каталог обещает совет, которого в выводе нет: ' + shown);
    const dir = adviceDir(a, fallback);
    if (a.kind === 'run') {
      checkRun(a, where, dir);
      if (a.mustFix === true) checkFix(c, where, dir);
      return;
    }
    if (a.kind === 'manual') {
      assert.ok(a.why.length > 40, '«' + where + '»: совет без команды («' + shown
        + '») не объяснил, почему его нечем выполнить');
      if (a.works !== undefined) {
        const works = Object.assign({ kind: 'run', text: shown }, a.works);
        checkRun(works, where, adviceDir(works, dir));
      }
      return;
    }
    if (a.kind === 'template') {
      const words = fill(a.args.join(' ')).split(/\s+/);
      words.forEach((w) => {
        if (w[0] === '-') {
          assert.ok(usageFlags.indexOf(w) >= 0, '«' + where + '»: совет-шаблон зовёт ключ, которого нет в справке: ' + w);
        } else if (/^[a-z][a-z-]*$/.test(w)) {
          assert.ok(usageCommands.indexOf(w) >= 0, '«' + where + '»: совет-шаблон зовёт команду, которой нет: ' + w);
        }
      });
      return;
    }
    assert.equal(a.kind, 'coveredBy', '«' + where + '»: неизвестный вид совета: ' + a.kind);
  });
}

/* Сценарий случая строится один раз и переиспользуется: `verify` берёт из него место
 * для запуска совета, а `run` — уже готовый вывод самого отказа. */
function scenarioOf(c) {
  return SCENARIOS[c.scenario](c.args);
}

function verify(c, group) {
  // Стерегомые другой проверкой и непроверяемые прогоном здесь не запускаются:
  // первые сверяются ниже по файлу, второй назван словами в каталоге.
  if (c.coveredBy !== undefined || c.uncatchable !== undefined) return;
  const res = run(c);
  const out = res.stdout + res.stderr;
  const where = group + ' / ' + (c.id === undefined ? c.key : c.id);
  assert.equal(res.code, c.code, '«' + where + '»: ожидался код ' + c.code + ', получен ' + res.code
    + ' — ' + out.trim().split('\n')[0]);
  assert.equal(hasStack(out), false, '«' + where + '»: отказ напечатал стек вместо объяснения:\n' + out);
  c.must.forEach((phrase) => {
    assert.ok(out.indexOf(phrase) >= 0, '«' + where + '»: в отказе нет «' + phrase + '»:\n' + out);
  });
  verifyAdvice(c, where, out, scenarioOf(c).dir);
}

/* Группа — та же, что у `CONFIG_CAUSES`, чтобы список причин не заводился второй
 * раз; сломанный отказ видно по имени группы и по названной причине в тексте. */
function groupOf(c) {
  // Коды из таблицы (сверка с деревом, обрезанная история) живут не среди причин
  // кодом 2: у них свой разговор с человеком, поэтому и своя группа.
  if (c.id !== undefined || c.key.indexOf('EXIT.') === 0) return 'коды выхода';
  const g = CONFIG_CAUSES.find((gr) => gr[1].indexOf(c.key) >= 0);
  assert.ok(g !== undefined, 'в каталоге отказ с причиной, которой нет в CONFIG_CAUSES: ' + c.key);
  return g[0];
}

/* Одна проверка на весь каталог, внутри — по группам причин: объявление в цикле
 * сделало бы число проверок выводом из данных, а оно читается по файлам
 * (`test/docs-numbers.test.js`, там же и запрет на объявление не в начале строки). */
test('отказы: каждый вызван и сказал обещанное', () => {
  const groups = [];
  CASES.forEach((c) => {
    const name = groupOf(c);
    let bucket = groups.find((g) => g.name === name);
    if (bucket === undefined) { bucket = { name: name, cases: [] }; groups.push(bucket); }
    bucket.cases.push(c);
  });
  groups.forEach((g) => {
    g.cases.forEach((c) => verify(c, g.name));
  });
});

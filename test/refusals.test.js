/* The tool's refusals: each tells the truth and helps out of the dead end.
 *
 * The subject is the catalogue `tools/refusals.js`: one line per refusal, carrying the phrases whose
 * absence in the output means the text has started lying or stopped helping. Here those lines are
 * executed: a refusal is brought about by a run, and its exit code and phrases are compared. The
 * other half of the promise — that every refusal site in the sources has a line of its own, so a
 * refusal cannot appear in silence — is held by `test/refusals-catalog.test.js`, which reads the
 * sources and runs nothing.
 *
 * Why this is a check of its own. A false reason in a refusal's text was found by a live run four
 * times in a row (a quoted path, bytes compared instead of content, a silently swallowed extra word,
 * `explain HEAD` calling the commit nonexistent), and each time by accident. The class is closed not
 * by a fifth fix but by the catalogue: the maps `SITES` (thrown) and `PRINTED` (marked "✗" with a
 * code) hold the counts of the sites, and any new site shows up as a discrepancy.
 *
 * What the check does not take, said out loud rather than hidden: wording outside `must` (sense,
 * tone, the order of lines), the completeness of an explanation, and what a person sees in `--json`.
 * Each refusal's sense is recorded in the catalogue's `truth` field, which is deliberately not
 * checked by a machine: a substring cannot tell a true explanation from a plausible one, and
 * pretending otherwise would be worse than saying so.
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

/* The fixture clone is shared by the suite and read-only: command-line refusals happen before the
 * tool writes anything. */
const FIXTURE = sharedClone('plain', tmp);

// The settings a refusal requires. Written beforehand: the refusal has to be caused by them rather
// than by a missing file.
const base = readJson(CONFIG);
function writeConfig(name, edit) {
  const file = path.join(tmp, name + '.json');
  fs.writeFileSync(file, typeof edit === 'string' ? edit : JSON.stringify(edit, null, 2) + '\n');
  return file;
}
/* The commands the test names itself: they are quoted from the project's settings (`fixCommand`),
 * and the catalogue refers to them by substitution. So the command's address stays where it is
 * assembled, and the catalogue stays an agreement about what it does. */
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
  // A column's path given as a number: a column matching nothing is a refusal rather than a report
  // with zero rows for a success.
  [PLACEHOLDER + 'badtype', writeConfig('badtype', { columns: [{ label: 'a', paths: [123] }], metrics: ['raw'] })],
  [PLACEHOLDER + 'few', writeConfig('few', {
    columns: [{ label: 'code.js', paths: ['src/code.js'] }], metrics: ['raw'], output: 'docs/size-table.html'
  })],
  // In these two settings `fixCommand` names a real command: the refusal quotes it as its advice,
  // and checking someone else's line would mean checking the fixture.
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
  // The two halves of the advice about approximation: with no dictionary but real minification, and
  // with no tokens but real minification — so that what removes what is visible.
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

// The catalogue's substitutions: `@config` is a path from the test, `@fixDrift` a command from the
// settings.
function fill(text) {
  return text.replace(/@[A-Za-z]+/g, (m) => (PLACES[m] !== undefined ? PLACES[m] : (FIXES[m] !== undefined ? FIXES[m] : m)));
}

/* Scenarios: what arguments alone cannot express — a clone of its own, a foreign hook, a shallow
 * history. Built on demand: only the cases that need them pay for them. */
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

/* A copy of the engine with no `bin/` beside it: how an installation looks when there is nothing to
 * call the hook with. The entry point stays outside the copy, or it would find itself. */
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
  // The same directory, but no git in PATH: the environment is what the case is about.
  'no-git': () => SCENARIOS.barren(),
  // The first call creates the file, the second is a refusal; the second one is checked.
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

/* Where the advice is carried out: a clone of its own if the advice writes into the project, an
 * empty repository if the advice is about a settings draft (the advice itself says "in an empty
 * directory"), and otherwise the very place the refusal came from. */
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

/* The advice as a command ready to be run. The shape is the one the tool prints: the call is an
 * absolute path to the entry point, because a relative path from the project's directory does not
 * lead into the package's repository. */
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

/* Every run of an advice: the code it promises. */
function checkRun(a, where, dir) {
  const cmd = adviceCommand(a);
  const res = runAdvice(cmd, dir, a.env);
  assert.equal(res.code, a.expect, '«' + where + '»: совет «' + cmd + '» отдал код ' + res.code
    + ' вместо ' + a.expect + ' — ' + (res.stdout + res.stderr).trim().split('\n')[0]);
  assert.equal(hasStack(res.stdout + res.stderr), false,
    '«' + where + '»: совет «' + cmd + '» упал стеком вместо работы');
  return res;
}

/* An advice repairs the state, and that shows in the refusal rather than in a word: the very call
 * that refused before the advice has to say something else after it. */
function checkFix(c, where, dir) {
  const again = runTool(PACKAGE, dir, args(c.args), c.env);
  const out = again.stdout + again.stderr;
  const still = c.must.filter((phrase) => out.indexOf(phrase) >= 0);
  assert.deepEqual(still, [], '«' + where + '»: совет не починил состояние — тот же зов снова сказал '
    + still.join(', ') + ':\n' + out);
}

/* Checking an advice: what is declared is compared with what is printed, and with it is done what
 * is declared (`run`, `template`, `manual`). `coveredBy` is not checked here — that is done by the
 * file the catalogue named together with the line to be executed. */
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

/* A case's scenario is built once and reused: `verify` takes from it the place to run the advice
 * in, and `run` takes the refusal's output as it is. */
function scenarioOf(c) {
  return SCENARIOS[c.scenario](c.args);
}

function verify(c, group) {
  // The ones another check holds and the ones no run can bring about are not run here: the first
  // are compared further down the file, the latter is named in words in the catalogue.
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

/* The group is the one `CONFIG_CAUSES` has, so that the list of causes is not started a second
 * time; a broken refusal shows in the group's name and in the cause named in the text. */
function groupOf(c) {
  // The codes of the table (the comparison with the tree, a shallow history) do not live among the
  // causes with code 2: they have a conversation of their own with a person, hence a group of their
  // own.
  if (c.id !== undefined || c.key.indexOf('EXIT.') === 0) return 'коды выхода';
  const g = CONFIG_CAUSES.find((gr) => gr[1].indexOf(c.key) >= 0);
  assert.ok(g !== undefined, 'в каталоге отказ с причиной, которой нет в CONFIG_CAUSES: ' + c.key);
  return g[0];
}

/* One check for the whole catalogue, inside it by groups of causes: declaring in a loop would make
 * the number of checks a conclusion from the data, while it is read off the files
 * (`test/docs-numbers.test.js`, which also forbids a declaration that is not at the start of a
 * line). */
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

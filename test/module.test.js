/* A project whose `.js` extension holds a module — the common case for anyone writing for a bundler:
 * `import`/`export` right in `.js`, with `type: module` in the manifest or without it. Such a project
 * has to get a report on the same terms as any other: settings straight from `--init`, no edits by
 * hand, exit code 0.
 *
 * The other half of the suite is the stripper's guard: it is the only thing that catches the stripper
 * when it really breaks a file, so it is broken here on purpose — in a copy of the engine rather than
 * in the live `src/strip.js` (the suites run file by file in parallel, and such a mutation would be a
 * mutation at the neighbour's expense) — and the run has to fail with honest text.
 * The guard accepts a result that parses at least one way — as a script or as a module — and that is
 * exactly why the second proof is required: without it, "repairing" could come down to switching the
 * check off.
 *
 * And the third, from the same place: the tool's advice (the hint, the help, the default repair
 * command) has to work in both states of the project — where the package lies next to it and where it
 * does not. So it names a path inside the project rather than the package name: `npx <name>` in a
 * project without the installed package goes to the registry and pulls the package over the network,
 * while the advice has to refuse on the spot.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, firstLine, gitIn, hasStack, runSize, runTool, tempDir } from '../tools/harness.js';
import { PKG } from '../tools/docs-facts.js';

/* Where the install puts the package: `node_modules/<name>`, and for a scope one level deeper
 * (`node_modules/@scope/name`). The path is assembled from the name in the manifest rather than as a
 * literal: otherwise renaming the package would hollow out these checks. */
const INSTALL_DIR = path.join('node_modules', ...PKG.split('/'));
const INSTALL_BIN = path.join(INSTALL_DIR, 'bin', 'size.js').split(path.sep).join('/');
const INSTALL_RE = INSTALL_BIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BY_NAME_RE = new RegExp('(^|\\s)(?:npx|npm exec|yarn)\\s+'
  + PKG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

const tmp = tempDir('module');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* A module with a trap for the stripper inside: `//` in a URL is no comment — and that is the very
 * line the stripper breaks on once it stops understanding quotes. */
const GREET = [
  '// Приветствие: модуль в расширении .js — так пишет проект с бандлером.',
  'export function greet(name) {',
  "  return 'Привет, ' + name + '!';",
  '}',
  '',
  "export const docs = 'https://example.com/docs//index.html';",
  ''
].join('\n');

function makeRepo(name, pkg, extra) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'src', 'greet.js'), GREET);
  fs.writeFileSync(path.join(dir, 'README.md'), '# ' + name + '\n');
  Object.keys(extra || {}).forEach((f) => fs.writeFileSync(path.join(dir, f), extra[f]));
  gitIn(dir, ['init', '-q']);
  gitIn(dir, ['config', 'user.email', 'test@example.com']);
  gitIn(dir, ['config', 'user.name', 'Тест']);
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'первый коммит']);
  return dir;
}

/* A copy of the engine for the checks that break it. Mutating the live tree mutates the neighbour's:
 * the suites run file by file in parallel, and a broken `strip.js` used to land in somebody else's
 * run (the page failed to assemble with the live stripper broken). So a copy is broken instead: `bin`,
 * `src` and the manifest in a directory of its own. */
function engineCopy(name) {
  const dir = path.join(tmp, name);
  ['bin', 'src'].forEach((part) => fs.cpSync(path.join(ROOT, part), path.join(dir, part), { recursive: true }));
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'));
  return { dir: dir, target: { name: 'движок из копии', file: path.join(dir, 'bin', 'size.js'), env: null } };
}

/* A draft without the optional dependencies: the way of removing ballast is named explicitly, and the
 * token dictionary is not requested. The draft leads a new project to the minifier and the tokenizer,
 * while the pre-project checks (the stripper's guard, markup in `.js`) guard ballast removal —
 * otherwise they would check something other than what they name — and the copy of the engine runs
 * without `node_modules`, where both dependencies lie. */
function plainDraft(dir) {
  const file = path.join(dir, 'size-table.config.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.minify = Object.assign({}, cfg.minify, { engine: 'strip' });
  cfg.metrics = cfg.metrics.filter((key) => key !== 'tok');
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
}

// The settings edit the refusal advises: the extension moves under stripping.
function withMinifyExt(dir, ext, how) {
  const file = path.join(dir, 'size-table.config.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.minify = Object.assign({}, cfg.minify, { ext: Object.assign({}, cfg.minify.ext, { [ext]: how }) });
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
}

/* Both variants are the same module in `.js`: the manifest only tells Node how to read `.js`, and the
 * generator has to measure the file either way. There are two checks, and each is declared on a line
 * of its own rather than in a loop: the number of checks in a suite is read per file — the
 * documentation is checked against it (`test/docs-numbers.test.js`) — and declaring in a loop would
 * make the count a derivation from the code rather than a fact of the file. */
function moduleInJs(name, withType) {
  const pkg = { name: name, version: '1.0.0', private: true };
  if (withType) pkg.type = 'module';
  const dir = makeRepo(name, pkg);

  const init = runSize(dir, ['--init']);
  assert.equal(init.code, 0, 'черновик настроек не создался: ' + firstLine(init.stderr));
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'size-table.config.json'), 'utf8'));
  assert.equal(cfg.minify && cfg.minify.engine, 'esbuild',
    'черновик не ведёт новый проект на настоящее сжатие: ' + JSON.stringify(cfg.minify));
  assert.equal(cfg.metrics.indexOf('min') >= 0, true, 'черновик потерял метрику min');

  const res = runSize(dir, ['--write']);
  assert.equal(res.code, 0, 'проект с модулем в .js не собрался ('
    + name + '): ' + firstLine(res.stderr || res.stdout));
  assert.equal(/stripper/.test(res.stderr), false,
    'отчёт собрался, но гард на чём-то споткнулся:\n' + res.stderr);
  assert.ok(fs.existsSync(path.join(dir, cfg.output)), 'таблица не написалась: ' + cfg.output);

  // The amount of removed ballast is counted too: without min the run would fail, but what is checked
  // is not "it did not fail" but that the data holds every declared metric.
  const data = JSON.parse(runSize(dir, ['--data']).stdout);
  assert.ok(data.now.some((v) => v !== null && v.min !== undefined),
    'в данных нет ни одного числа по метрике min');
}

test('модуль в .js измеряется без правок настроек: type-module', () => {
  moduleInJs('type-module', true);
});

test('модуль в .js измеряется без правок настроек: no-type', () => {
  moduleInJs('no-type', false);
});

/* The guard has to stay a guard: the stripper is broken the way it really breaks (it stops
 * understanding single-quoted strings), and the run has to fail with honest text rather than silently
 * produce a wrong number. */
test('гард жив: сломанный стриппер не проходит молча', () => {
  const dir = makeRepo('broken-stripper', { name: 'broken-stripper', version: '1.0.0', private: true });
  const init = runSize(dir, ['--init']);
  assert.equal(init.code, 0, 'черновик настроек не создался: ' + firstLine(init.stderr));
  plainDraft(dir);
  const engine = engineCopy('broken-engine');
  const ok = runTool(engine.target, dir, ['--write']);
  assert.equal(ok.code, 0, 'до мутации проект не собрался: ' + firstLine(ok.stderr));

  /* The mutation is in the ballast-removal string branch (`src/strip/js.js`): it loses the
   * single-quote case, and in the fixture such a line carries `//` inside — the broken stripper eats
   * the rest of the line and the code stops parsing. */
  const file = path.join(engine.dir, 'src', 'strip', 'js.js');
  const original = fs.readFileSync(file, 'utf8');
  const from = "  if (quote !== '\"' && quote !== \"'\" && quote !== '`') return false;";
  const to = "  if (quote !== '\"' && quote !== '`') return false;";
  assert.ok(original.indexOf(from) >= 0, 'мутация не применилась: ветка строк в стриппере переписана');
  try {
    fs.writeFileSync(file, original.replace(from, to));
    const res = runTool(engine.target, dir, ['--write']);
    assert.notEqual(res.code, 0, 'сломанный стриппер прошёл молча — гард не стережёт');
    assert.match(res.stderr, /the stripper broke/, 'текст отказа не называет причину:\n' + res.stderr);
    assert.match(res.stderr, /greet\.js/, 'текст отказа не называет файл:\n' + res.stderr);
  } finally {
    fs.writeFileSync(file, original);
  }
  assert.equal(fs.readFileSync(file, 'utf8'), original, 'мутация не откатилась');

  const again = runTool(engine.target, dir, ['--write']);
  assert.equal(again.code, 0, 'после отката мутации проект не собирается: ' + firstLine(again.stderr));
});

/* When the file itself does not parse, nobody is to blame: this column holds no JavaScript (markup
 * right in `.js`). That is a settings edit rather than a defect of the tool, so a refusal with a ready
 * command goes out, not a stack. The refusal comes from the way the file was counted: the minifier
 * names itself and offers a way out through stripping, while the ballast-removal guard names
 * `minify.guard` and the extension. */
test('не JavaScript в графе — отказ с командой починки, а не стек', () => {
  const dir = makeRepo('jsx-in-js', { name: 'jsx-in-js', version: '1.0.0', private: true }, {
    'src/view.js': [
      '// Разметка прямо в .js — так пишут проекты без TypeScript.',
      'export function View(props) {',
      '  return <div className="card">{props.title}</div>;',
      '}',
      ''
    ].join('\n')
  });
  const init = runSize(dir, ['--init']);
  assert.equal(init.code, 0, 'черновик настроек не создался: ' + firstLine(init.stderr));

  const res = runSize(dir, ['--write']);
  assert.equal(res.code, 2, 'это графа настроек, а не дефект инструмента: '
    + firstLine(res.stderr || res.stdout));
  assert.equal(/stripper/.test(res.stderr), false,
    'отказ обвиняет стриппер в том, чего тот не делал:\n' + res.stderr);
  assert.match(res.stderr, /esbuild did not parse src\/view\.js/,
    'отказ не называет ни файла, ни того, кто его не разобрал:\n' + res.stderr);
  assert.match(res.stderr, /minify\.ext/, 'отказ не называет, что править:\n' + res.stderr);
  assert.equal(hasStack(res.stderr), false, 'отказ напечатал стек:\n' + res.stderr);

  /* The refusal's advice is a settings edit, and it is checked by a run rather than by the word: the
   * same edit in a copy of the project gives a build. A copy rather than the project itself: below, a
   * second cause is taken from the same state, and the edit would wipe it. */
  assert.ok(res.stderr.indexOf('give this extension a simplification in minify.ext') >= 0,
    'отказ не называет выход, который работает:\n' + res.stderr);
  const fixed = path.join(tmp, 'jsx-fixed');
  fs.cpSync(dir, fixed, { recursive: true });
  withMinifyExt(fixed, '.js', 'strip-lines');
  const built = runSize(fixed, ['--write']);
  assert.equal(built.code, 0, 'совет не починил прогон: ' + firstLine(built.stderr || built.stdout));

  // The same project, but through the former way: the cause is named by the ballast-removal guard.
  plainDraft(dir);
  const guarded = runSize(dir, ['--write']);
  assert.equal(guarded.code, 2, 'способ из настроек не назвал настоящую причину: '
    + firstLine(guarded.stderr || guarded.stdout));
  assert.match(guarded.stderr, /is not JavaScript/, 'отказ не называет настоящую причину:\n' + guarded.stderr);
  assert.match(guarded.stderr, /minify\.guard/, 'отказ не называет, что править:\n' + guarded.stderr);
  assert.equal(hasStack(guarded.stderr), false, 'отказ напечатал стек:\n' + guarded.stderr);

  // And the same advice of the second refusal — by a run too: `minify.ext` works here as well.
  assert.ok(guarded.stderr.indexOf('remove this extension from minify.guard') >= 0,
    'отказ не называет выход, который работает:\n' + guarded.stderr);
  const fixedGuard = path.join(tmp, 'jsx-fixed-guard');
  fs.cpSync(dir, fixedGuard, { recursive: true });
  withMinifyExt(fixedGuard, '.js', 'strip-lines');
  const builtGuard = runSize(fixedGuard, ['--write']);
  assert.equal(builtGuard.code, 0, 'совет не починил прогон: ' + firstLine(builtGuard.stderr || builtGuard.stdout));
});

/* A project with the package put in place of the install: exactly what the consuming project sees is
 * checked (the engine is taken from the repository the way a package manager would put it). Every
 * check has a project of its own: below the advice is executed and edits the settings, and a second
 * check needs one of its own. */
function installEngine(name) {
  const dir = path.join(tmp, name);
  const pkg = path.join(dir, INSTALL_DIR);
  for (const part of ['bin', 'src']) {
    fs.cpSync(path.join(ROOT, part), path.join(pkg, part), { recursive: true });
  }
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(pkg, 'package.json'));
  fs.writeFileSync(path.join(dir, 'lib.js'), 'export const a = 1;\nexport const b = 2;\n');
  gitIn(dir, ['init', '-q']);
  gitIn(dir, ['config', 'user.email', 'test@example.com']);
  gitIn(dir, ['config', 'user.name', 'Тест']);
  gitIn(dir, ['add', 'lib.js']);
  gitIn(dir, ['commit', '-qm', 'начало']);
  return { dir: dir, engine: { name: 'движок из node_modules', file: path.join(pkg, 'bin', 'size.js'), env: null } };
}

/* The advice — a path inside the project rather than a name from the registry. */
test('совет называет путь внутри проекта, а не имя из реестра', () => {
  const { dir, engine } = installEngine('installed');
  const res = runTool(engine, dir, []);
  assert.notEqual(res.code, 0, 'без настроек инструмент не отказал');

  const hint = (res.stderr.match(/pin them with a file of their own[^:]*: (.+)$/m) || [])[1];
  assert.notEqual(hint, undefined, 'подсказка не называет команду починки:\n' + res.stderr);
  assert.match(hint, new RegExp('^node ' + INSTALL_RE + ' --init$'),
    'совет ведёт не путём внутри проекта: ' + hint);
  assert.equal(BY_NAME_RE.test(res.stderr),
    false, 'совет называет имя пакета: в проекте без него этот зов уйдёт в реестр:\n' + res.stderr);

  /* The default repair command has the same shape: the report's caption quotes it, so the text travels
   * to a reader who may have no package. No settings — the default is taken, and `--json` shows it as
   * it is. */
  const cfgless = path.join(tmp, 'installed-default');
  fs.cpSync(dir, cfgless, { recursive: true });
  fs.writeFileSync(path.join(cfgless, 'size-table.config.json'),
    JSON.stringify({ output: 'size-table.html', columns: [{ label: 'lib.js', paths: ['lib.js'] }] }, null, 2) + '\n');
  const data = runTool({ name: engine.name, file: path.join(cfgless, INSTALL_BIN), env: null }, cfgless, ['--data']);
  assert.equal(data.code, 0, 'контракт не отдался: ' + firstLine(data.stderr));
  const fix = JSON.parse(data.stdout).report.fixCommand;
  assert.match(fix, new RegExp('^node ' + INSTALL_RE + ' --write$'),
    'умолчание команды починки — не путь внутри проекта: ' + fix);
});

/* The other half of the same promise: the advice is runnable where the package lies next to it and
 * refuses on the spot where there is none — and the help names the same path. */
test('совет выполним рядом с пакетом и отказывает на месте без него', () => {
  const { dir, engine } = installEngine('installed-run');
  const res = runTool(engine, dir, []);
  const hint = (res.stderr.match(/pin them with a file of their own[^:]*: (.+)$/m) || [])[1];
  assert.notEqual(hint, undefined, 'подсказка не называет команду починки:\n' + res.stderr);

  // The advice is runnable: the same line in the same project does what it promises.
  const ran = spawnSync('bash', ['-c', hint], { cwd: dir, encoding: 'utf8' });
  assert.equal(ran.status, 0, 'совет не выполнился там, где пакет рядом: ' + firstLine(ran.stderr || ''));
  assert.ok(fs.existsSync(path.join(dir, 'size-table.config.json')), 'совет ничего не создал');

  /* And it refuses on the spot in a project without the package: the network is not needed for this
   * call at all, so the registry can be pointed into nowhere — if the call goes there, it shows. */
  const elsewhere = path.join(tmp, 'installed-elsewhere');
  fs.mkdirSync(elsewhere, { recursive: true });
  const lost = spawnSync('bash', ['-c', hint], {
    cwd: elsewhere,
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      npm_config_registry: 'http://127.0.0.1:9/',
      npm_config_offline: 'true'
    })
  });
  assert.notEqual(lost.status, 0, 'зов сработал там, где пакета нет:\n' + lost.stdout);
  assert.match(lost.stderr || '', new RegExp(INSTALL_RE),
    'отказ не называет, чего не хватает:\n' + lost.stderr);
  assert.equal(/registry|ERR_PNPM|npm error/.test(lost.stderr || ''), false,
    'зов ушёл в реестр, а не отказал на месте:\n' + lost.stderr);

  const help = runTool(engine, dir, ['--help']);
  assert.equal(help.code, 0, 'справка не ответила: ' + firstLine(help.stderr));
  assert.match(help.stdout, new RegExp('Usage: node ' + INSTALL_RE),
    'справка не называет путь: ' + help.stdout.split('\n')[2]);
});

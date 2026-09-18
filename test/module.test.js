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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, commitAll, firstLine, gitIn, hasStack, runSize, runTool, tempDir } from '../tools/harness.js';
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
  commitAll(dir, 'Тест', 'test@example.com', 'первый коммит');
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
  return { dir: dir, target: { name: 'the engine from a copy', file: path.join(dir, 'bin', 'size.js'), env: null } };
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
  assert.equal(init.code, 0, 'the settings draft was not created: ' + firstLine(init.stderr));
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'size-table.config.json'), 'utf8'));
  assert.equal(cfg.minify && cfg.minify.engine, 'esbuild',
    'the draft does not lead a new project to real minification: ' + JSON.stringify(cfg.minify));
  assert.equal(cfg.metrics.indexOf('min') >= 0, true, 'the draft lost the metric min');

  const res = runSize(dir, ['--write']);
  assert.equal(res.code, 0, 'a project with a module in .js was not built ('
    + name + '): ' + firstLine(res.stderr || res.stdout));
  assert.equal(/stripper/.test(res.stderr), false,
    'the report was built, but the guard stumbled on something:\n' + res.stderr);
  assert.ok(fs.existsSync(path.join(dir, cfg.output)), 'the table was not written: ' + cfg.output);

  // The amount of removed ballast is counted too: without min the run would fail, but what is checked
  // is not "it did not fail" but that the data holds every declared metric.
  const data = JSON.parse(runSize(dir, ['--data']).stdout);
  assert.ok(data.now.some((v) => v !== null && v.min !== undefined),
    'the data hold no number for the metric min');
}

test('a module in .js is measured without edits to the settings: type-module', () => {
  moduleInJs('type-module', true);
});

test('a module in .js is measured without edits to the settings: no-type', () => {
  moduleInJs('no-type', false);
});

/* The guard has to stay a guard: the stripper is broken the way it really breaks (it stops
 * understanding single-quoted strings), and the run has to fail with honest text rather than silently
 * produce a wrong number. */
test('the guard is alive: a broken stripper does not go through in silence', () => {
  const dir = makeRepo('broken-stripper', { name: 'broken-stripper', version: '1.0.0', private: true });
  const init = runSize(dir, ['--init']);
  assert.equal(init.code, 0, 'the settings draft was not created: ' + firstLine(init.stderr));
  plainDraft(dir);
  const engine = engineCopy('broken-engine');
  const ok = runTool(engine.target, dir, ['--write']);
  assert.equal(ok.code, 0, 'before the mutation the project was not built: ' + firstLine(ok.stderr));

  /* The mutation is in the ballast-removal string branch (`src/strip/js.js`): it loses the
   * single-quote case, and in the fixture such a line carries `//` inside — the broken stripper eats
   * the rest of the line and the code stops parsing. */
  const file = path.join(engine.dir, 'src', 'strip', 'js.js');
  const original = fs.readFileSync(file, 'utf8');
  const from = "  if (quote !== '\"' && quote !== \"'\" && quote !== '`') return false;";
  const to = "  if (quote !== '\"' && quote !== '`') return false;";
  assert.ok(original.indexOf(from) >= 0, 'the mutation did not apply: the string branch in the stripper was rewritten');
  try {
    fs.writeFileSync(file, original.replace(from, to));
    const res = runTool(engine.target, dir, ['--write']);
    assert.notEqual(res.code, 0, 'a broken stripper went through in silence — the guard does not guard');
    assert.match(res.stderr, /the stripper broke/, 'the refusal text does not name the cause:\n' + res.stderr);
    assert.match(res.stderr, /greet\.js/, 'the refusal text does not name the file:\n' + res.stderr);
  } finally {
    fs.writeFileSync(file, original);
  }
  assert.equal(fs.readFileSync(file, 'utf8'), original, 'the mutation was not rolled back');

  const again = runTool(engine.target, dir, ['--write']);
  assert.equal(again.code, 0, 'after the mutation was rolled back the project does not build: ' + firstLine(again.stderr));
});

/* When the file itself does not parse, nobody is to blame: this column holds no JavaScript (markup
 * right in `.js`). That is a settings edit rather than a defect of the tool, so a refusal with a ready
 * command goes out, not a stack. The refusal comes from the way the file was counted: the minifier
 * names itself and offers a way out through stripping, while the ballast-removal guard names
 * `minify.guard` and the extension. */
test('not JavaScript in the graph — a refusal with a repair command rather than a stack', () => {
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
  assert.equal(init.code, 0, 'the settings draft was not created: ' + firstLine(init.stderr));

  const res = runSize(dir, ['--write']);
  assert.equal(res.code, 2, 'this is the settings graph rather than a defect of the tool: '
    + firstLine(res.stderr || res.stdout));
  assert.equal(/stripper/.test(res.stderr), false,
    'the refusal blames the stripper for what it did not do:\n' + res.stderr);
  assert.match(res.stderr, /esbuild did not parse src\/view\.js/,
    'the refusal names neither the file nor whoever failed to parse it:\n' + res.stderr);
  assert.match(res.stderr, /minify\.ext/, 'the refusal does not say what to fix:\n' + res.stderr);
  assert.equal(hasStack(res.stderr), false, 'the refusal printed a stack:\n' + res.stderr);

  /* The refusal's advice is a settings edit, and it is checked by a run rather than by the word: the
   * same edit in a copy of the project gives a build. A copy rather than the project itself: below, a
   * second cause is taken from the same state, and the edit would wipe it. */
  assert.ok(res.stderr.indexOf('give this extension a simplification in minify.ext') >= 0,
    'the refusal does not name an exit that works:\n' + res.stderr);
  const fixed = path.join(tmp, 'jsx-fixed');
  fs.cpSync(dir, fixed, { recursive: true });
  withMinifyExt(fixed, '.js', 'strip-lines');
  const built = runSize(fixed, ['--write']);
  assert.equal(built.code, 0, 'the advice did not repair the run: ' + firstLine(built.stderr || built.stdout));

  // The same project, but through the former way: the cause is named by the ballast-removal guard.
  plainDraft(dir);
  const guarded = runSize(dir, ['--write']);
  assert.equal(guarded.code, 2, 'the method from the settings did not name the real cause: '
    + firstLine(guarded.stderr || guarded.stdout));
  assert.match(guarded.stderr, /is not JavaScript/, 'the refusal does not name the real cause:\n' + guarded.stderr);
  assert.match(guarded.stderr, /minify\.guard/, 'the refusal does not say what to fix:\n' + guarded.stderr);
  assert.equal(hasStack(guarded.stderr), false, 'the refusal printed a stack:\n' + guarded.stderr);

  // And the same advice of the second refusal — by a run too: `minify.ext` works here as well.
  assert.ok(guarded.stderr.indexOf('remove this extension from minify.guard') >= 0,
    'the refusal does not name an exit that works:\n' + guarded.stderr);
  const fixedGuard = path.join(tmp, 'jsx-fixed-guard');
  fs.cpSync(dir, fixedGuard, { recursive: true });
  withMinifyExt(fixedGuard, '.js', 'strip-lines');
  const builtGuard = runSize(fixedGuard, ['--write']);
  assert.equal(builtGuard.code, 0, 'the advice did not repair the run: ' + firstLine(builtGuard.stderr || builtGuard.stdout));
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
  return { dir: dir, engine: { name: 'the engine from node_modules', file: path.join(pkg, 'bin', 'size.js'), env: null } };
}

/* The advice — a path inside the project rather than a name from the registry. */
test('the advice names a path inside the project rather than a name from the registry', () => {
  const { dir, engine } = installEngine('installed');
  const res = runTool(engine, dir, []);
  assert.notEqual(res.code, 0, 'without the settings the tool did not refuse');

  const hint = (res.stderr.match(/pin them with a file of their own[^:]*: (.+)$/m) || [])[1];
  assert.notEqual(hint, undefined, 'the hint does not name the repair command:\n' + res.stderr);
  assert.match(hint, new RegExp('^node ' + INSTALL_RE + ' --init$'),
    'the advice does not lead by a path inside the project: ' + hint);
  assert.equal(BY_NAME_RE.test(res.stderr),
    false, 'the advice names the package: in a project without it this call would go to the registry:\n' + res.stderr);

  /* The default repair command has the same shape: the report's caption quotes it, so the text travels
   * to a reader who may have no package. No settings — the default is taken, and `--json` shows it as
   * it is. */
  const cfgless = path.join(tmp, 'installed-default');
  fs.cpSync(dir, cfgless, { recursive: true });
  fs.writeFileSync(path.join(cfgless, 'size-table.config.json'),
    JSON.stringify({ output: 'size-table.html', columns: [{ label: 'lib.js', paths: ['lib.js'] }] }, null, 2) + '\n');
  const data = runTool({ name: engine.name, file: path.join(cfgless, INSTALL_BIN), env: null }, cfgless, ['--data']);
  assert.equal(data.code, 0, 'the contract was not handed out: ' + firstLine(data.stderr));
  const fix = JSON.parse(data.stdout).report.fixCommand;
  assert.match(fix, new RegExp('^node ' + INSTALL_RE + ' --write$'),
    'the default repair command is not a path inside the project: ' + fix);
});

/* The other half of the same promise: the advice is runnable where the package lies next to it and
 * refuses on the spot where there is none — and the help names the same path. */
test('the advice is runnable beside the package and refuses on the spot without it', () => {
  const { dir, engine } = installEngine('installed-run');
  const res = runTool(engine, dir, []);
  const hint = (res.stderr.match(/pin them with a file of their own[^:]*: (.+)$/m) || [])[1];
  assert.notEqual(hint, undefined, 'the hint does not name the repair command:\n' + res.stderr);

  // The advice is runnable: the same line in the same project does what it promises.
  const ran = spawnSync('bash', ['-c', hint], { cwd: dir, encoding: 'utf8' });
  assert.equal(ran.status, 0, 'the advice did not run where the package lies beside it: ' + firstLine(ran.stderr || ''));
  assert.ok(fs.existsSync(path.join(dir, 'size-table.config.json')), 'the advice created nothing');

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
  assert.notEqual(lost.status, 0, 'the call worked where there is no package:\n' + lost.stdout);
  assert.match(lost.stderr || '', new RegExp(INSTALL_RE),
    'the refusal does not name what is missing:\n' + lost.stderr);
  assert.equal(/registry|ERR_PNPM|npm error/.test(lost.stderr || ''), false,
    'the call went to the registry instead of refusing on the spot:\n' + lost.stderr);

  const help = runTool(engine, dir, ['--help']);
  assert.equal(help.code, 0, 'the help did not answer: ' + firstLine(help.stderr));
  assert.match(help.stdout, new RegExp('Usage: node ' + INSTALL_RE),
    'the help does not name the path: ' + help.stdout.split('\n')[2]);
});

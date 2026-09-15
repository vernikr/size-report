/* Проект, где в расширении `.js` лежит модуль — обычное дело у всех, кто пишет
 * под бандлер: `import`/`export` прямо в `.js`, с `type: module` в манифесте или
 * без него. Такой проект обязан получать отчёт теми же правами, что и любой
 * другой: настройки прямо из `--init`, ни одной правки руками, код выхода 0.
 *
 * Другая половина набора — сам гард стриппера: он единственное, что ловит
 * стриппер, когда тот действительно ломает файл, поэтому здесь же он ломается
 * намеренно — в копии движка, а не в живом `src/strip.js` (наборы идут по файлам
 * параллельно, и такая мутация была бы мутацией у соседа), — и прогон обязан
 * упасть честным текстом.
 * Гард принимает результат, разбирающийся хотя бы одним способом — скриптом или
 * модулем, — и именно поэтому второе доказательство обязательно: без него
 * «починка» могла бы свестись к отключению проверки.
 *
 * И третье, из того же места: совет инструмента (подсказка, справка, умолчание
 * команды починки) обязан работать в обоих состояниях проекта — там, где пакет
 * лежит рядом, и там, где его нет. Поэтому он называет путь внутри проекта, а не
 * имя пакета: `npx <имя>` в проекте без установленного пакета идёт в реестр и
 * тянет пакет по сети, а совет обязан отказывать на месте.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, firstLine, gitIn, hasStack, runSize, runTool, tempDir } from '../tools/harness.js';
import { PKG } from '../tools/docs-facts.js';

/* Куда установка кладёт пакет: `node_modules/<имя>`, а у области — ещё одним
 * уровнем (`node_modules/@scope/name`). Путь собирается из имени в манифесте, а не
 * литералом: иначе переименование пакета сделало бы эти проверки пустыми. */
const INSTALL_DIR = path.join('node_modules', ...PKG.split('/'));
const INSTALL_BIN = path.join(INSTALL_DIR, 'bin', 'size.js').split(path.sep).join('/');
const INSTALL_RE = INSTALL_BIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BY_NAME_RE = new RegExp('(^|\\s)(?:npx|npm exec|yarn)\\s+'
  + PKG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

const tmp = tempDir('module');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/* Модуль с ловушкой для стриппера внутри: `//` в адресе — не комментарий. Именно
 * на такой строке стриппер и ломается, если перестаёт понимать кавычки. */
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

/* Копия движка для проверок, которые его ломают. Мутация живого дерева — мутация
 * у соседа: наборы идут по файлам параллельно, и сломанный `strip.js` попадал в
 * чужие прогоны (страница не собиралась при живом сломанном стриппере). Поэтому
 * ломается копия: `bin`, `src` и манифест в своём каталоге. */
function engineCopy(name) {
  const dir = path.join(tmp, name);
  ['bin', 'src'].forEach((part) => fs.cpSync(path.join(ROOT, part), path.join(dir, part), { recursive: true }));
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'));
  return { dir: dir, target: { name: 'движок из копии', file: path.join(dir, 'bin', 'size.js'), env: null } };
}

/* Черновик без необязательных зависимостей: способ снятия балласта назван явно, а
 * словарь токенов не запрошен. Черновик ведёт новый проект на минификатор и
 * токенизатор, но предпроектные проверки (гард стриппера, разметка в `.js`)
 * стерегут снятие балласта — иначе они проверяли бы не то, что называют, — а
 * движок из копии идёт без `node_modules`, где обе зависимости и лежат. */
function plainDraft(dir) {
  const file = path.join(dir, 'size-table.config.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.minify = Object.assign({}, cfg.minify, { engine: 'strip' });
  cfg.metrics = cfg.metrics.filter((key) => key !== 'tok');
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
}

// Правка настроек, которую советует отказ: расширение переходит под упрощение.
function withMinifyExt(dir, ext, how) {
  const file = path.join(dir, 'size-table.config.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.minify = Object.assign({}, cfg.minify, { ext: Object.assign({}, cfg.minify.ext, { [ext]: how }) });
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
}

/* Оба варианта — один и тот же модуль в `.js`: манифест лишь сообщает Node, как
 * читать `.js`, а генератор должен измерять файл в обоих случаях. Проверок две, и
 * объявлены они каждая своей строкой, а не циклом: число проверок в наборе
 * читается по файлам — по нему сверяется документация (`test/docs-numbers.test.js`),
 * а объявление в цикле делает счёт выводом из кода, а не фактом файла. */
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
  assert.equal(/стриппер/.test(res.stderr), false,
    'отчёт собрался, но гард на чём-то споткнулся:\n' + res.stderr);
  assert.ok(fs.existsSync(path.join(dir, cfg.output)), 'таблица не написалась: ' + cfg.output);

  // Число снятого балласта тоже посчитано: без min прогон бы упал, но проверяем
  // не «не упало», а что в данных есть все объявленные метрики.
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

/* Гард обязан остаться гардом: ломаем стриппер так, как он ломается на самом деле
 * (перестаёт понимать строки в одинарных кавычках), и прогон должен упасть с
 * честным текстом, а не молча выдать неправильное число. */
test('гард жив: сломанный стриппер не проходит молча', () => {
  const dir = makeRepo('broken-stripper', { name: 'broken-stripper', version: '1.0.0', private: true });
  const init = runSize(dir, ['--init']);
  assert.equal(init.code, 0, 'черновик настроек не создался: ' + firstLine(init.stderr));
  plainDraft(dir);
  const engine = engineCopy('broken-engine');
  const ok = runTool(engine.target, dir, ['--write']);
  assert.equal(ok.code, 0, 'до мутации проект не собрался: ' + firstLine(ok.stderr));

  /* Мутация — в ветке строк снятия балласта (`src/strip/js.js`): она теряет
   * случай одинарной кавычки, а в фикстуре такая строка несёт `//` внутри —
   * сломанный стриппер съедает остаток строки, и код перестаёт разбираться. */
  const file = path.join(engine.dir, 'src', 'strip', 'js.js');
  const original = fs.readFileSync(file, 'utf8');
  const from = "  if (quote !== '\"' && quote !== \"'\" && quote !== '`') return false;";
  const to = "  if (quote !== '\"' && quote !== '`') return false;";
  assert.ok(original.indexOf(from) >= 0, 'мутация не применилась: ветка строк в стриппере переписана');
  try {
    fs.writeFileSync(file, original.replace(from, to));
    const res = runTool(engine.target, dir, ['--write']);
    assert.notEqual(res.code, 0, 'сломанный стриппер прошёл молча — гард не стережёт');
    assert.match(res.stderr, /стриппер испортил/, 'текст отказа не называет причину:\n' + res.stderr);
    assert.match(res.stderr, /greet\.js/, 'текст отказа не называет файл:\n' + res.stderr);
  } finally {
    fs.writeFileSync(file, original);
  }
  assert.equal(fs.readFileSync(file, 'utf8'), original, 'мутация не откатилась');

  const again = runTool(engine.target, dir, ['--write']);
  assert.equal(again.code, 0, 'после отката мутации проект не собирается: ' + firstLine(again.stderr));
});

/* Когда не разбирается сам файл, никто ни при чём: в этой графе не JavaScript
 * (разметка прямо в `.js`). Это правка настроек, а не дефект инструмента, поэтому
 * наружу идёт отказ с готовой командой, а не стек. Отказ берётся с того способа,
 * которым файл считали: минификатор называет себя и даёт выход на упрощение, а
 * гард снятия балласта — `minify.guard` и расширение. */
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
  assert.equal(/стриппер/.test(res.stderr), false,
    'отказ обвиняет стриппер в том, чего тот не делал:\n' + res.stderr);
  assert.match(res.stderr, /esbuild не разобрал src\/view\.js/,
    'отказ не называет ни файла, ни того, кто его не разобрал:\n' + res.stderr);
  assert.match(res.stderr, /minify\.ext/, 'отказ не называет, что править:\n' + res.stderr);
  assert.equal(hasStack(res.stderr), false, 'отказ напечатал стек:\n' + res.stderr);

  /* Совет отказа — правка настроек, и проверяется она прогоном, а не словом: та же
   * правка в копии проекта даёт сборку. Копия, а не сам проект: ниже из того же
   * состояния берётся вторая причина, и правка её бы стёрла. */
  assert.ok(res.stderr.indexOf('задайте этому расширению упрощение в minify.ext') >= 0,
    'отказ не называет выход, который работает:\n' + res.stderr);
  const fixed = path.join(tmp, 'jsx-fixed');
  fs.cpSync(dir, fixed, { recursive: true });
  withMinifyExt(fixed, '.js', 'strip-lines');
  const built = runSize(fixed, ['--write']);
  assert.equal(built.code, 0, 'совет не починил прогон: ' + firstLine(built.stderr || built.stdout));

  // Тем же проектом, но прежним способом: причину называет гард снятия балласта.
  plainDraft(dir);
  const guarded = runSize(dir, ['--write']);
  assert.equal(guarded.code, 2, 'способ из настроек не назвал настоящую причину: '
    + firstLine(guarded.stderr || guarded.stdout));
  assert.match(guarded.stderr, /не JavaScript/, 'отказ не называет настоящую причину:\n' + guarded.stderr);
  assert.match(guarded.stderr, /minify\.guard/, 'отказ не называет, что править:\n' + guarded.stderr);
  assert.equal(hasStack(guarded.stderr), false, 'отказ напечатал стек:\n' + guarded.stderr);

  // И тот же совет второго отказа — тоже прогоном: `minify.ext` работает и здесь.
  assert.ok(guarded.stderr.indexOf('уберите это расширение из minify.guard') >= 0,
    'отказ не называет выход, который работает:\n' + guarded.stderr);
  const fixedGuard = path.join(tmp, 'jsx-fixed-guard');
  fs.cpSync(dir, fixedGuard, { recursive: true });
  withMinifyExt(fixedGuard, '.js', 'strip-lines');
  const builtGuard = runSize(fixedGuard, ['--write']);
  assert.equal(builtGuard.code, 0, 'совет не починил прогон: ' + firstLine(builtGuard.stderr || builtGuard.stdout));
});

/* Проект с пакетом, положенным на место установки: проверяется ровно то, что видит
 * проект-потребитель (движок берётся из репозитория, как его положил бы пакетный
 * менеджер). Проект у каждой проверки свой: ниже совет исполняется и правит
 * настройки, и второй проверке нужен свой такой же. */
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

/* Совет — путь внутри проекта, а не имя из реестра. */
test('совет называет путь внутри проекта, а не имя из реестра', () => {
  const { dir, engine } = installEngine('installed');
  const res = runTool(engine, dir, []);
  assert.notEqual(res.code, 0, 'без настроек инструмент не отказал');

  const hint = (res.stderr.match(/создайте его: (.+)$/m) || [])[1];
  assert.notEqual(hint, undefined, 'подсказка не называет команду починки:\n' + res.stderr);
  assert.match(hint, new RegExp('^node ' + INSTALL_RE + ' --init$'),
    'совет ведёт не путём внутри проекта: ' + hint);
  assert.equal(BY_NAME_RE.test(res.stderr),
    false, 'совет называет имя пакета: в проекте без него этот зов уйдёт в реестр:\n' + res.stderr);

  /* Умолчание команды починки — та же форма: его цитирует подпись отчёта, то есть
   * текст уезжает к читателю, у которого пакета может и не быть. Настроек нет —
   * берётся умолчание, а `--json` показывает его как есть. */
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

/* Вторая половина того же обещания: совет выполним там, где пакет лежит рядом, и
 * отказывает на месте там, где его нет, — а справка называет тот же путь. */
test('совет выполним рядом с пакетом и отказывает на месте без него', () => {
  const { dir, engine } = installEngine('installed-run');
  const res = runTool(engine, dir, []);
  const hint = (res.stderr.match(/создайте его: (.+)$/m) || [])[1];
  assert.notEqual(hint, undefined, 'подсказка не называет команду починки:\n' + res.stderr);

  // Совет выполним: та же строка в том же проекте делает обещанное.
  const ran = spawnSync('bash', ['-c', hint], { cwd: dir, encoding: 'utf8' });
  assert.equal(ran.status, 0, 'совет не выполнился там, где пакет рядом: ' + firstLine(ran.stderr || ''));
  assert.ok(fs.existsSync(path.join(dir, 'size-table.config.json')), 'совет ничего не создал');

  /* И отказывает на месте в проекте без пакета: сеть для этого зова не нужна вовсе,
   * поэтому реестр можно направить в никуда — если зов туда пойдёт, это видно. */
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
  assert.match(help.stdout, new RegExp('Запуск: node ' + INSTALL_RE),
    'справка не называет путь: ' + help.stdout.split('\n')[2]);
});

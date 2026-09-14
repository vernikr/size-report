/* Проект, где в расширении `.js` лежит модуль — обычное дело у всех, кто пишет
 * под бандлер: `import`/`export` прямо в `.js`, с `type: module` в манифесте или
 * без него. Такой проект обязан получать отчёт теми же правами, что и любой
 * другой: настройки прямо из `--init`, ни одной правки руками, код выхода 0.
 *
 * Другая половина набора — сам гард стриппера: он единственное, что ловит
 * стриппер, когда тот действительно ломает файл, поэтому здесь же он ломается
 * намеренно (мутация в `src/strip.js`), и прогон обязан упасть честным текстом.
 * Гард принимает результат, разбирающийся хотя бы одним способом — скриптом или
 * модулем, — и именно поэтому второе доказательство обязательно: без него
 * «починка» могла бы свестись к отключению проверки.
 *
 * И третье, из того же места: подсказка в проекте-потребителе (движок лежит в
 * `node_modules`) обязана называть команду, которую можно скопировать, а не путь
 * к файлу в чужом `node_modules`.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, firstLine, hasStack, runSize, runTool, tempDir } from '../tools/harness.js';

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
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Тест']);
  execFileSync('git', ['-C', dir, 'add', '-A']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'первый коммит']);
  return dir;
}

/* Оба варианта — один и тот же модуль в `.js`: манифест лишь сообщает Node, как
 * читать `.js`, а генератор должен измерять файл в обоих случаях. */
for (const withType of [true, false]) {
  const name = withType ? 'type-module' : 'no-type';
  test('модуль в .js измеряется без правок настроек: ' + name, () => {
    const pkg = { name: name, version: '1.0.0', private: true };
    if (withType) pkg.type = 'module';
    const dir = makeRepo(name, pkg);

    const init = runSize(dir, ['--init']);
    assert.equal(init.code, 0, 'черновик настроек не создался: ' + firstLine(init.stderr));
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'size-table.config.json'), 'utf8'));
    assert.equal(cfg.minify, undefined, 'черновик принёс настройку minify — в проекте её не должно быть');
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
  });
}

/* Гард обязан остаться гардом: ломаем стриппер так, как он ломается на самом деле
 * (перестаёт понимать строки в одинарных кавычках), и прогон должен упасть с
 * честным текстом, а не молча выдать неправильное число. */
test('гард жив: сломанный стриппер не проходит молча', () => {
  const dir = makeRepo('broken-stripper', { name: 'broken-stripper', version: '1.0.0', private: true });
  const init = runSize(dir, ['--init']);
  assert.equal(init.code, 0, 'черновик настроек не создался: ' + firstLine(init.stderr));
  const ok = runSize(dir, ['--write']);
  assert.equal(ok.code, 0, 'до мутации проект не собрался: ' + firstLine(ok.stderr));

  const file = path.join(ROOT, 'src', 'strip.js');
  const original = fs.readFileSync(file, 'utf8');
  const from = "    if (ch === '\"' || ch === \"'\" || ch === '`') {\n      const end = endOfString(src, i, ch);";
  const to = "    if (ch === '\"' || ch === '`') {\n      const end = endOfString(src, i, ch);";
  assert.ok(original.indexOf(from) >= 0, 'мутация не применилась: ветка строк в стриппере переписана');
  try {
    fs.writeFileSync(file, original.replace(from, to));
    const res = runSize(dir, ['--write']);
    assert.notEqual(res.code, 0, 'сломанный стриппер прошёл молча — гард не стережёт');
    assert.match(res.stderr, /стриппер испортил/, 'текст отказа не называет причину:\n' + res.stderr);
    assert.match(res.stderr, /greet\.js/, 'текст отказа не называет файл:\n' + res.stderr);
  } finally {
    fs.writeFileSync(file, original);
  }
  assert.equal(fs.readFileSync(file, 'utf8'), original, 'мутация не откатилась');

  const again = runSize(dir, ['--write']);
  assert.equal(again.code, 0, 'после отката мутации проект не собирается: ' + firstLine(again.stderr));
});

/* Когда не разбирается даже исходный текст, стриппер ни при чём: в этой графе не
 * JavaScript (разметка прямо в `.js`). Это правка настроек, а не дефект
 * инструмента, поэтому наружу идёт отказ с готовой командой, а не стек с
 * обвинением стриппера. */
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
  assert.match(res.stderr, /не JavaScript/, 'отказ не называет настоящую причину:\n' + res.stderr);
  assert.match(res.stderr, /minify\.guard/, 'отказ не называет, что править:\n' + res.stderr);
  assert.equal(hasStack(res.stderr), false, 'отказ напечатал стек:\n' + res.stderr);
});

/* У проекта-потребителя движок лежит в `node_modules`, и подсказка обязана
 * называть команду, а не путь к файлу: `npx <имя пакета>` работает и в npm, и в
 * pnpm, и в yarn, потому что запускает уже установленный пакет. Проверяется тем
 * же движком, но положенным на место установки. */
test('подсказка в чужом node_modules — это команда, а не путь к файлу', () => {
  const dir = path.join(tmp, 'installed');
  const pkg = path.join(dir, 'node_modules', 'size-report');
  for (const part of ['bin', 'src']) {
    fs.cpSync(path.join(ROOT, part), path.join(pkg, part), { recursive: true });
  }
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(pkg, 'package.json'));
  execFileSync('git', ['init', '-q'], { cwd: dir });

  const installed = { name: 'движок из node_modules', file: path.join(pkg, 'bin', 'size.js'), env: null };
  const res = runTool(installed, dir, []);
  assert.notEqual(res.code, 0, 'без настроек инструмент не отказал');
  assert.match(res.stderr, /npx size-report --init/, 'подсказка не называет команду:\n' + res.stderr);
  assert.equal(/node_modules/.test(res.stderr), false,
    'подсказка цитирует путь в чужом node_modules:\n' + res.stderr);

  const res2 = runTool(installed, dir, ['--help']);
  assert.equal(res2.code, 0, 'справка не ответила: ' + firstLine(res2.stderr));
  assert.equal(/node_modules/.test(res2.stdout), false,
    'справка запускает читателя в node_modules:\n' + res2.stdout.split('\n')[2]);
});

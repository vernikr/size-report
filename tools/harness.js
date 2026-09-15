/* Общая часть проверок: пути, свежие клоны фикстуры, запуск инструмента так, как
 * его зовёт пользователь, и мелочи сверки (хеши, разбор JSON, первое расхождение).
 * Это не набор проверок, а помощник для них.
 *
 * Лежит в `tools/`, а не в `test/`: раннер Node считает набором любой `.js` в
 * каталоге `test/` (и любой `test-*.js` где угодно), исполнил бы помощник как
 * пустой набор и уронил бы счётчики. Здесь он просто модуль, который наборы
 * импортируют.
 *
 * Два правила, ради которых харнесс и держит клоны и кэш:
 *
 *   1. Клон фикстуры — один на среду (`sharedClone`), а не по клону на проверку:
 *      клон стоит времени, но дороже его сам прогон инструмента.
 *   2. Одна и та же команда в одном и том же окружении не запускается дважды
 *      ради двух разных проверок (`readRun`). Кэшируются только прогоны на
 *      чтение: `--write` и контрольный режим зависят от состояния дерева, и
 *      кэш для них был бы ложью.
 *
 * Проверки, которые правят файлы, берут свой клон (`cloneFixture`) и в общие
 * не ходят: соседняя проверка из того же файла получила бы чужую правку.
 *
 * Третье правило — про git: проверки и инструменты зовут его через `gitIn`
 * (или `gitTry`, где нужен код возврата), а настройки берутся из того же списка,
 * что закрепляет движок (`src/git.js`). Читать git в обход этого списка нечем,
 * и это стережёт `test/git-pins.test.js`, а не комментарий здесь.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitArgv, gitEnv } from '../src/git.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SYNTH = path.join(ROOT, 'fixtures', 'synthetic');
export const PARITY = path.join(ROOT, 'fixtures', 'parity');
export const BUNDLE = path.join(SYNTH, 'history.bundle');
export const CONFIG = path.join(SYNTH, 'config.json');
export const PACKAGE_BIN = path.join(ROOT, 'bin', 'size.js');
export const MAX_BUF = 256 * 1024 * 1024;

/* Инструмент под проверкой: движок пакета и замороженная копия, с которой снят
 * эталон. У копии своё окружение — то, в котором снимали эталон (до починки B1
 * иначе не воспроизводится). */
export const PACKAGE = { name: 'движок пакета', file: PACKAGE_BIN, env: null };

/* Замороженная копия реализации, с которой сняты оба эталона, в дереве не лежит
 * (`REFACTOR.md` R-1.5): это редко нужное прошлое, а не рабочая копия пакета, и место
 * такого прошлого — история, откуда байты и берутся по требованию. Путь — тот, под
 * которым копия лежала: он записан в происхождении обоих эталонов и остаётся их
 * записью, а не сегодняшним деревом. */
export const LEGACY_PATH = 'fixtures/legacy/size-table.cjs';

let legacyFile = null;

/* Байты копии берутся из того коммита, который её **добавил** (последнего, если
 * её заводили не однажды): так материал не привязан к записанному руками sha и
 * переживает любые переезды истории. Скачанное сверяется с хешем, который записало
 * происхождение эталона: иначе «та самая копия» молча перестала бы ею быть. */
export function legacyTool() {
  if (legacyFile !== null) return legacyFile;
  const added = gitIn(ROOT, ['log', '--diff-filter=A', '--format=%H', '--', LEGACY_PATH])
    .split('\n').filter((line) => line !== '')[0];
  if (added === undefined) {
    throw new Error('в истории нет ' + LEGACY_PATH + ': копию, с которой снят эталон, взять неоткуда');
  }
  const bytes = execFileSync('git', gitArgv(['-C', ROOT, 'show', added + ':' + LEGACY_PATH]),
    { maxBuffer: MAX_BUF, env: gitEnv() });
  const want = JSON.parse(fs.readFileSync(path.join(PARITY, 'manifest.json'), 'utf8')).tool.sha256;
  assert.equal(sha256(bytes), want, 'копия из истории (' + added.slice(0, 7) + ') разошлась с тем,'
    + ' какой её записало происхождение эталона: сверять было бы нечего');
  legacyFile = path.join(tempDir('legacy'), 'size-table.cjs');
  fs.writeFileSync(legacyFile, bytes);
  return legacyFile;
}

export function frozenTarget() {
  return {
    name: 'замороженная копия реализации',
    file: legacyTool(),
    env: gitConfig({ 'core.quotePath': 'false' })
  };
}

export function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-' + name + '-'));
}

/* Настройки git через окружение (git ≥ 2.31): так проверка задаёт машине чужие
 * правила, не трогая ни её конфиг, ни фикстуру. */
export function gitConfig(pairs) {
  const env = { GIT_CONFIG_COUNT: String(Object.keys(pairs).length) };
  Object.keys(pairs).forEach((key, i) => {
    env['GIT_CONFIG_KEY_' + i] = key;
    env['GIT_CONFIG_VALUE_' + i] = pairs[key];
  });
  return env;
}

/* Клон фикстуры без общих жёстких ссылок: он же рабочее дерево для проверок,
 * которые правят файлы. */
export function cloneFixture(into) {
  gitIn(null, ['clone', '-q', '--no-hardlinks', BUNDLE, into]);
  return into;
}

/* Клон, выложенный с нормализацией переводов строк: так выглядит рабочее дерево
 * при `core.autocrlf=true` — значении по умолчанию в установке Git для Windows.
 * На диске CRLF, в git LF, и git считает дерево чистым. */
export function cloneCrlf(into) {
  gitIn(null, ['-c', 'core.autocrlf=true', 'clone', '-q', '--no-hardlinks', BUNDLE, into]);
  gitIn(into, ['config', 'core.autocrlf', 'true']);
  return into;
}

/* Общий клон на среду для прогонов на чтение. Создаётся при первом обращении:
 * наборы, которым среда не нужна, за неё и не платят. */
const shared = new Map();
export function sharedClone(kind, tempRoot) {
  if (!shared.has(kind)) {
    const dir = path.join(tempRoot, 'shared-' + kind);
    shared.set(kind, kind === 'crlf' ? cloneCrlf(dir) : cloneFixture(dir));
  }
  return shared.get(kind);
}

/* Единственный вход к git для проверок и инструментов: закрепления и локаль —
 * общие с движком (`src/git.js`), чтобы список настроек был один на пакет.
 * `dir === null` — команда не про каталог (клон, разбор бандла). */
export function gitIn(dir, args) {
  return execFileSync('git', gitArgv((dir === null ? [] : ['-C', dir]).concat(args)),
    { encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv() });
}

// То же, но с кодом возврата: там, где отказ — ожидаемый ответ (слияние, clone).
export function gitTry(dir, args) {
  const res = spawnSync('git', gitArgv((dir === null ? [] : ['-C', dir]).concat(args)),
    { encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv() });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/* Заведомо незакреплённый вызов — и он один на весь репозиторий: проверке, которая
 * измеряет само окружение (принимает ли git настройки из окружения и сильнее ли
 * ключ командной строки), закрепления мешают ровно так же, как помогали бы везде
 * ещё. Поэтому имя говорит, что делает, а не «так случайно вышло». */
export function gitBare(args, opts) {
  return spawnSync('git', args, Object.assign({ encoding: 'utf8', maxBuffer: MAX_BUF }, opts || {}));
}

/* Инструмента может не быть на месте (сборка не собрана, замороженная копия не
 * снята) — тогда проверки должны сказать это словом, а не «код null». */
export function requireTarget(target) {
  assert.ok(fs.existsSync(target.file),
    'нет ' + path.relative(ROOT, target.file) + ' — проверять нечего');
}

/* Отказ обязан объясняться: код выхода по таблице, сообщение без стека и с текстом. */
export function refusal(res, code, what) {
  assert.equal(res.code, code, what + ': ожидался код ' + code + ', получен ' + res.code
    + ' — ' + firstLine(res.stderr));
  assert.equal(hasStack(res.stderr + res.stdout), false,
    what + ': отказ напечатал стек вместо сообщения:\n' + res.stderr);
  assert.notEqual(res.stderr.trim(), '', what + ': отказ ничего не объяснил');
}

/* Запуск команды как её видит пользователь: `node <файл> …`.
 * `env` досыпается к окружению процесса — так проверяются чужие настройки git. */
export function runTool(target, dir, args, env) {
  const res = spawnSync(process.execPath, [target.file].concat(args),
    {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: MAX_BUF,
      env: Object.assign({}, process.env, target.env || {}, env || {})
    });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// Прогон движка пакета, к которому не нужно ни замороженной копии, ни эталона.
export function runSize(dir, args, env) {
  return runTool({ name: 'движок пакета', file: PACKAGE_BIN, env: null }, dir, args, env);
}

// Тот же запуск, но с эталонными настройками фикстуры — их читает большинство проверок.
export function runFixture(dir, args, env) {
  return runSize(dir, ['--config', CONFIG].concat(args), env);
}

// Запуск с настройками фикстуры для любого из инструментов под проверкой.
export function runFixtureWith(target, dir, args, env) {
  return runTool(target, dir, ['--config', CONFIG].concat(args), env);
}

/* Сбор вывода не дожидаясь конца: нужен там, где прогоны идут вперемешку и ждать
 * их по очереди нельзя (`tools/parity-live.js`). Куски копятся буферами, а не
 * приклеиваются к строке: кусок приходит с потока там, где его вернуло ядро, и
 * многобайтовый символ может попасть на границу между кусками. Строка из куска
 * расшифровала бы обе половины поодиночке и дала два символа-заменителя вместо
 * буквы — сверка падала бы на случайном месте, а не на расхождении (проверка —
 * `test/runner.test.js`, случай — `WORKLOG.md` §21). */
export function collectOutput(child) {
  return new Promise((resolve) => {
    const out = [];
    const err = [];
    let size = 0;
    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size < MAX_BUF) out.push(chunk);
      else child.kill();
    });
    child.stderr.on('data', (chunk) => { err.push(chunk); });
    child.on('close', (code) => resolve({
      code: code,
      stdout: Buffer.concat(out).toString('utf8'),
      stderr: Buffer.concat(err).toString('utf8')
    }));
  });
}

/* Кэш прогонов на чтение: ключ — инструмент, каталог, ключи и окружение. Только
 * для команд, которые ничего не пишут и не зависят от того, что уже написано. */
const cache = new Map();
export function readRun(target, dir, args, env) {
  const key = [target.file, dir, args.join(' '), JSON.stringify(env || {})].join('\u0000');
  if (!cache.has(key)) cache.set(key, runFixtureWith(target, dir, args, env));
  return cache.get(key);
}

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Хеш, записанный в формате `sha256sum`: «<хеш>  <файл>».
export function shaFileLine(file) {
  return fs.readFileSync(file, 'utf8').split(/\s+/)[0];
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function firstLine(text) {
  return text.trim().split('\n')[0];
}

/* Расхождение должно объяснять себя: номер первой разошедшейся строки и обе
 * строки целиком — иначе «JSON не совпал» ничего не говорит о причине. */
export function firstDiff(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) {
      return 'строка ' + (i + 1) + '\n    в выводе: ' + JSON.stringify((la[i] || '').slice(0, 160))
        + '\n    в эталоне: ' + JSON.stringify((lb[i] || '').slice(0, 160));
    }
  }
  return 'различие в байтах при одинаковых строках (переводы строк или кодировка)';
}

/* Стек наружу не отдаётся: в нём нет подсказки починки, зато есть пути машины.
 * Кадры V8 начинаются с отступа и `at `. */
export function hasStack(text) {
  return /^\s+at /.test(text);
}

// Команда починки из сообщения: `node <путь> --init`.
export function commandIn(text) {
  const m = /node\s+(\S+)\s+(--\S+)/.exec(text);
  return m === null ? null : { file: m[1], flag: m[2] };
}

import { execFileSync, spawnSync } from 'child_process';
import { EXIT, refuse } from './refusal.js';

/* Единственная граница вызова git: закрепления настроек, блобы пачкой, история и
 * сверка с диском. Всё, что инструмент знает о содержимом репозитория, приходит
 * отсюда, — поэтому и закрепления задаются здесь, а не в каждом вызове. */

export const MAX_BUF = 256 * 1024 * 1024;
const FIELD = '\u0001'; // разделитель полей в формате git log

/* Всё, что движок читает у git, читается с явно заданными настройками: их
 * значения по умолчанию берутся из настроек машины и меняют то, что попадает в
 * разбор. Без `core.quotePath=false` не-английские пути приходят закавыченными и
 * экранированными (`"docs/\320\267..."`): колонка с таким путём не находит файла,
 * а коммит, у которого она была единственным изменением объёма, теряет строку.
 * Остальные закрепления закрывают тот же класс — раскраска и блок подписи
 * подмешались бы в разбираемый поток, а перекодировка подписей — в подписи строк
 * отчёта. Закрепление задаётся здесь, а не в каждом вызове: иначе его забудет
 * следующий вызов.
 *
 * Локаль закрепляется заодно: разбор не должен зависеть от того, какие переводы
 * стоят на машине. Цена — сообщения самого git в неожиданных отказах идут
 * по-английски; сообщения инструмента остаются русскими. */
export const GIT_PINS = [
  'core.quotePath=false',
  'color.ui=never',
  'log.showSignature=false',
  'i18n.logOutputEncoding=UTF-8'
];

export function gitArgv(args) {
  const out = ['--no-pager'];
  GIT_PINS.forEach((pin) => { out.push('-c', pin); });
  return out.concat(args);
}

export function gitEnv() {
  return Object.assign({}, process.env, { LC_ALL: 'C', LANG: 'C' });
}

export function git(root, args) {
  return execFileSync('git', gitArgv(args), {
    cwd: root, encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv()
  });
}

/* То же чтение, но с кодом возврата: там, где ненулевой код — ожидаемый ответ, а не
 * отказ (`git diff --quiet` отвечает 1 на расхождение). Исключение здесь означало бы
 * отказ инструмента там, где задан простой вопрос. `env` досыпается к окружению
 * границы — им хук собирает коммит отчёта в отдельном индексе, не трогая
 * настоящий (см. `src/hook.js`). */
export function gitTry(root, args, env) {
  const res = spawnSync('git', gitArgv(args), {
    cwd: root, encoding: 'utf8', maxBuffer: MAX_BUF,
    env: Object.assign(gitEnv(), env || {})
  });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/* Чтение блобов пачкой. `git cat-file --batch-check` отвечает про список пар
 * `ревизия:путь` (sha объекта и размер), `--batch` отдаёт содержимое. Один-два
 * процесса на всю историю вместо спавна `git show` на каждый файл — на тысячах
 * коммитов это разница между минутами и секундой. Побочно размер объекта
 * оказывается дешевле его чтения: метрике `raw` содержимое не нужно вовсе.
 *
 * Ответы позиционные (строка на запрос), поэтому запросы и ответы сопоставляются
 * по порядку — `ревизия:путь` git в ответе не повторяет. */
const BLOB_CHUNK = 1000; // спек на пачку: ограничивает и stdin, и память

function catFileCheck(root, specs) {
  const out = execFileSync('git', gitArgv(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)']), {
    cwd: root, encoding: 'utf8', input: specs.join('\n') + '\n', maxBuffer: MAX_BUF, env: gitEnv()
  });
  return out.split('\n');
}

function catFileBatch(root, shas) {
  const buf = execFileSync('git', gitArgv(['cat-file', '--batch']), {
    cwd: root, input: shas.join('\n') + '\n', maxBuffer: MAX_BUF, env: gitEnv()
  });
  const out = new Map();
  let i = 0;
  while (i < buf.length) {
    const nl = buf.indexOf(10, i);
    if (nl < 0) break;
    const f = buf.toString('utf8', i, nl).split(' ');
    i = nl + 1;
    if (f.length < 3) continue; // «<спека> missing»
    const size = Number(f[2]);
    out.set(f[0], { size: size, text: buf.toString('utf8', i, i + size) });
    i += size + 1; // перевод строки после содержимого
  }
  return out;
}

/* Блобы для списка пар «ревизия:путь». `needText` — читать ли содержимое: метрике
 * `raw` хватает размера объекта, и тогда `--batch` не вызывается вовсе.
 * Одинаковые спеки и одинаковые блобы запрашиваются один раз (кэш по sha). */
export function readBlobs(root, specs, needText) {
  const uniq = [...new Set(specs)];
  const out = new Map();
  const texts = new Map(); // sha блоба → содержимое
  for (let start = 0; start < uniq.length; start += BLOB_CHUNK) {
    const part = uniq.slice(start, start + BLOB_CHUNK);
    const lines = catFileCheck(root, part);
    const want = [];
    part.forEach((spec, i) => {
      const line = lines[i] === undefined ? '' : lines[i];
      if (line === '' || line.slice(-8) === ' missing') return;
      const f = line.split(' ');
      if (f.length < 3 || f[1] !== 'blob') return;
      out.set(spec, { sha: f[0], size: Number(f[2]), text: null });
      if (texts.has(f[0])) return;
      want.push(f[0]);
    });
    if (!needText || want.length === 0) continue;
    catFileBatch(root, [...new Set(want)]).forEach((b, sha) => { texts.set(sha, b.text); });
  }
  if (needText) out.forEach((b) => { if (texts.has(b.sha)) b.text = texts.get(b.sha); });
  return out;
}

/* Дерево HEAD: sha блобов всех файлов коммита. Это правда о содержимом HEAD,
 * добытая не тем же способом, что состояние движка (то читает блобы пачкой),
 * поэтому расхождение с ней и означает потерянную при переносе правку. Один вызов
 * на прогон; разбор идёт по NUL (`-z`), иначе пути с пробелами пришлось бы
 * раскодировать. */
export function headTree(root) {
  const out = new Map();
  const tree = execFileSync('git', gitArgv(['ls-tree', '-r', '-z', 'HEAD']), {
    cwd: root, encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv()
  });
  tree.split('\u0000').forEach((rec) => {
    const tab = rec.indexOf('\t');
    if (tab < 0) return;
    out.set(rec.slice(tab + 1), rec.slice(0, tab).split(' ')[2]);
  });
  return out;
}

/* Файлы на диске — такими, какими их видит git: `hash-object` пропускает каждый
 * файл через те же переводы строк и фильтры, что и `git add` (`.gitattributes`,
 * `core.autocrlf`). Поэтому «файл на диске соответствует коммиту» — это сравнение
 * хешей, а не размеров: размер зависит от выкладки (при `core.autocrlf=true` на
 * диске CRLF, в git LF). Пути приходят списком, ответы позиционные — как у
 * `cat-file`. */
export function diskHashes(root, paths) {
  const out = new Map();
  const lines = execFileSync('git', gitArgv(['hash-object', '--stdin-paths']), {
    cwd: root, encoding: 'utf8', input: paths.join('\n') + '\n', maxBuffer: MAX_BUF, env: gitEnv()
  }).split('\n');
  paths.forEach((p, i) => { out.set(p, lines[i] === undefined ? '' : lines[i].trim()); });
  return out;
}

/* Обратный перевод: то, что git выложил бы на диск для блоба этой ревизии и пути
 * (`--filters` применяет фильтры выкладки). Нужен там, где переводы строк git не
 * возвращает обратно: файл, в котором CRLF лежат в самом коммите, при
 * `core.autocrlf=true` выкладывается как есть, а «очистка» вернула бы LF, — сам
 * git про такие файлы предупреждает, а на диск кладёт именно это. */
export function diskForm(root, rev, p) {
  return execFileSync('git', gitArgv(['cat-file', '--filters', rev + ':' + p]), {
    cwd: root, maxBuffer: MAX_BUF, env: gitEnv()
  });
}

// Содержимое файла в ревизии или null, если файла там нет.
export function blobAt(root, rev, p) {
  const blobs = readBlobs(root, [rev + ':' + p], true);
  const blob = blobs.get(rev + ':' + p);
  return blob === undefined ? null : blob.text;
}

/* История одним вызовом: заголовок коммита и список изменённых им путей.
 * `%ad` — дата автора в его собственной зоне (не в зоне машины), иначе таблица
 * собиралась бы в CI по UTC и расходилась бы с локальной сборкой.
 * `--diff-merges=first-parent` — иначе у merge-коммита списка путей нет вовсе
 * (git не показывает дифф слияния, пока не попросишь): правки разрешения
 * конфликта выпали бы и из строки, и из переноса состояния, а состояние на HEAD
 * разошлось бы с содержимым файла в дереве. С первым родителем у слияния видно
 * ровно то, что оно привнесло поверх своей ветки. */
export function readHistory(root) {
  const log = git(root, [
    'log', '--reverse', '--name-only', '--diff-merges=first-parent', '--date=format:%Y-%m-%d %H:%M',
    '--pretty=format:commit' + FIELD + '%H' + FIELD + '%ad' + FIELD + '%P' + FIELD + '%s'
  ]);
  const commits = [];
  let cur = null;
  log.split('\n').forEach((line) => {
    if (line.indexOf('commit' + FIELD) === 0) {
      const f = line.split(FIELD);
      cur = { sha: f[1], when: f[2], parents: f[3] ? f[3].split(' ') : [], subject: f[4], files: [] };
      commits.push(cur);
      return;
    }
    if (line !== '' && cur) cur.files.push(line);
  });
  return commits;
}

export function assertFullHistory(root) {
  if (git(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    refuse(EXIT.SHALLOW, 'история обрезана (shallow clone): таблица строится по всей истории коммитов.\n'
      + '  локально: git fetch --unshallow\n'
      + '  в CI: actions/checkout с fetch-depth: 0');
  }
}

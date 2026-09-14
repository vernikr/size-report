import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EXIT, Refusal, cliCommand, refuse } from './refusal.js';
import { git, gitTry } from './git.js';
import { loadConfig } from './config.js';
import { TOOL_PKG } from './tool.js';
import { rebuild } from './artifact.js';

/* Хуки `post-commit` и `post-merge`: после каждого коммита и слияния отчёт
 * пересобирается сам, а если он лежит в git — ложится отдельным коммитом.
 * Требования §7.1–§7.3 (автообновление, защита от зацикливания, отключаемость) и
 * шаг 5 плана.
 *
 * Что он делает и почему именно так:
 *
 * - **Ставится только явной командой** (`install-hook`) и снимается
 *   (`uninstall-hook`): установка — это правка чужого `.git`, и делать её вслепую
 *   нельзя. До установки проект не меняется ничем, после снятия — возвращается к
 *   прежнему поведению.
 * - **Сам коммитов не создаёт** — за одним исключением: отчёт, лежащий в git,
 *   коммитится отдельно от кода. Раньше это делал человек (отсюда ловушка «правка
 *   кода и таблицы в одном коммите»), и хук для того и нужен, чтобы ручного шага не
 *   было. Правило одно на два состояния проекта: отчёт в git — отдельный коммит;
 *   отчёт вне git — только пересборка (ровно то, что описано в требованиях §7.2:
 *   пересборка коммита не порождает).
 * - **Коммитит только путь отчёта**: дерево берётся от HEAD, и в нём подменяется
 *   ровно путь отчёта, поэтому в коммит физически не может попасть ничего другого —
 *   ни индекс, ни чужая незакоммиченная работа («не может потерять работу»).
 * - **Слияние — такой же случай, как обычный коммит**, но с одной поправкой к тому,
 *   что зовёт git: `post-commit` при `git merge` не выполняется (git создаёт коммит
 *   слияния сам), поэтому ставится ещё и `post-merge`. Строка слияния ложится в
 *   отчёт по общему правилу (`rows.merges`), а поведение при вызове второго файла
 *   то же, что при повторном запуске: пересобирать нечего — коммита нет.
 * - **Зацикливание невозможно по двум причинам.** Коммит отчёта собирается
 *   плумбингом (`commit-tree`), а он хуков не зовёт вовсе, — вложенного запуска не
 *   бывает по устройству, а не по флагу в окружении. И сам отчёт — путь, который
 *   строки не получает (инвариант «строка про коммит не может лежать внутри самого
 *   коммита»), поэтому та же пересборка даёт те же байты и второго коммита не будет.
 *   Плюс замок, чтобы два хука не пошли одновременно.
 * - **Отказ инструмента не роняет коммит.** Коммит уже сделан, и блокировать в нём
 *   нечего (требование §8: инструмент только показывает). Причина печатается одной
 *   строкой и запоминается — её видно в `size doctor` (`src/doctor.js`).
 * - **В окружениях, где обновлять отчёт не нужно** (интеграция, чужая машина,
 *   зависимостей нет) хук молчит: сам файл хука в git не едет — он лежит в `.git`,
 *   то есть у каждого клона свой, — а внутри есть проверки «есть ли чем звать
 *   инструмент».
 *
 * Место состояния — git-каталог (`<git-dir>/size-report/`), а не рабочее дерево:
 * иначе замок и запись о запуске торчали бы в `git status` как неотслеживаемые
 * файлы. Состояние локально для клона, как и сам хук. */

// Второй выключатель: окружение, где автообновление не нужно вовсе (CI, чужая
// машина), — и явный рубильник для тех, кто не хочет править настройки.
const NO_HOOK = 'SIZE_REPORT_NO_HOOK';
/* Два файла, а не один: на обычный коммит git зовёт `post-commit`, а на слияние —
 * только `post-merge` (`post-commit` при `git merge` не выполняется вовсе). Вход
 * у обоих один, поэтому лишнего запуска не бывает: тот, что сработал вторым,
 * видит, что менять нечего, и молчит. */
const HOOKS = ['post-commit', 'post-merge'];
// Метка «этот файл наш»: по ней хук отличается от чужого, который перезаписывать
// нельзя, и по ней же снятие понимает, что удалять.
const MARK = '# size-report: hook';
const STATE = 'hook.json';
const LOCK = 'hook.lock';

function gitDir(root) {
  return git(root, ['rev-parse', '--absolute-git-dir']).trim();
}

function stateDir(root) {
  return path.join(gitDir(root), 'size-report');
}

/* Куда git читает хуки. `core.hooksPath` перебивает `.git/hooks`, и это чужая
 * настройка: такой каталог часто лежит в другом репозитории и версионируется, а
 * вставлять строку в чужой скрипт — править чужой файл. Поэтому с чужим путём
 * установка отказывает и называет готовую строку. */
function hooksDir(root) {
  const custom = gitTry(root, ['config', '--get', 'core.hooksPath']);
  if (custom.status === 0 && custom.stdout.trim() !== '') {
    return { dir: path.resolve(root, custom.stdout.trim()), custom: true };
  }
  return { dir: path.join(gitDir(root), 'hooks'), custom: false };
}

function hookFile(root, name) {
  return path.join(hooksDir(root).dir, name);
}

/* Движок, которым хук зовёт инструмент, — тот, что нашла бы сама установка. Путь
 * записывается в скрипт на время установки: у монорепозитория `node_modules` может
 * лежать выше корня проекта, и общий относительный путь там не работает. Путь
 * цитируется: в нём может стоять пробел, а хук — это sh, а не список аргументов. */
function hookEntry(root) {
  const candidates = [
    path.join(root, 'node_modules', TOOL_PKG.name, 'bin', 'size.js'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'size.js')
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found === undefined) return null;
  const rel = path.relative(root, found);
  const shown = rel !== '' && rel.indexOf('..') !== 0 ? './' + rel : found;
  return { path: shown, quoted: shQuote(shown) };
}

function shQuote(text) {
  return '"' + text.replace(/(["\\$`])/g, '\\$1') + '"';
}

// Готовая строка для чужого хука: её копируют как есть, поэтому она без метки.
function runLine(entry) {
  return 'node ' + entry.path + ' hook-run';
}

/* Тело хука. Проверки перед запуском — это ответ «что он НЕ делает там, где
 * обновлять нечего»: без `node` (GUI-клиент git с урезанным PATH) и без движка
 * (зависимости не поставлены, клон без установки) хук выходит молча — шум после
 * каждого коммита был бы хуже отсутствия автоматики. */
function script(entry) {
  return '#!/bin/sh\n'
    + MARK + ': обновление отчёта после коммита.\n'
    + '# Ставится и снимается командами `size install-hook` / `size uninstall-hook`;\n'
    + '# правки в этом файле не сохранятся — команда перезаписывает его целиком.\n'
    + '# Коммитов хук сам не делает: пересборка и коммит отчёта — в `size hook-run`.\n'
    + 'command -v node >/dev/null 2>&1 || exit 0\n'
    + '[ -f ' + entry.quoted + ' ] || exit 0\n'
    + 'exec node ' + entry.quoted + ' hook-run\n';
}

/* Состояние хука для `size doctor`: установлен ли и чем кончился последний
 * запуск. Ничего не считает и ни к чему не обязывает. */
export function hookStatus(root) {
  const files = HOOKS.map((name) => hookFile(root, name));
  return {
    files: files.map((f) => path.relative(root, f)),
    installed: files.some((f) => fs.existsSync(f)),
    last: hookState(root)
  };
}

function isOurs(file) {
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').indexOf(MARK) >= 0;
}

/* Запись о последнем запуске. Отсутствие файла — «хук ещё не запускался», а не
 * ошибка: до первого коммита её и не должно быть. */
function hookState(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(stateDir(root), STATE), 'utf8'));
  } catch (_e) {
    return null;
  }
}

export function installHook(root, cfg) {
  const entry = hookEntry(root);
  if (entry === null) {
    refuse(EXIT.CONFIG, 'не нашлось чем звать инструмент: хук будет молчать.\n'
      + '  починка: поставьте пакет зависимостью проекта (например: pnpm add -D ' + TOOL_PKG.name + ')'
      + ' и повторите установку');
  }
  const hooks = hooksDir(root);
  if (hooks.custom) {
    refuse(EXIT.CONFIG, 'в проекте задан core.hooksPath (' + hooks.dir + '): этот каталог может лежать'
      + ' в другом репозитории, и править его инструмент не станет.\n'
      + '  починка: впишите в свой хук строку «' + runLine(entry) + '»');
  }
  const files = HOOKS.map((name) => path.join(hooks.dir, name));
  const rels = files.map((f) => path.relative(root, f));
  files.forEach((file, i) => {
    if (fs.existsSync(file) && !isOurs(file)) {
      refuse(EXIT.CONFIG, 'хук ' + rels[i] + ' уже есть и поставлен не этим инструментом (в нём нет метки).\n'
        + '  починка: позовите инструмент из своего хука строкой «' + runLine(entry) + '»'
        + ' — перезаписи чужого файла нет намеренно');
    }
  });
  if (files.every(isOurs)) {
    return { code: EXIT.OK, lines: [
      '· хук уже установлен: ' + rels.join(', '),
      '  автоматика работает после каждого коммита и слияния',
      '  снять: ' + cliCommand('uninstall-hook')
    ] };
  }
  fs.mkdirSync(hooks.dir, { recursive: true });
  files.forEach((file) => {
    fs.writeFileSync(file, script(entry));
    fs.chmodSync(file, 0o755);
  });

  const lines = [
    '✓ хук: ' + rels.join(', '),
    '  после каждого коммита и слияния пересобирает ' + cfg.output
      + ' и, если этот файл в git, кладёт его отдельным коммитом',
    '  сам он коммитит только отчёт: индекс и ваша незакоммиченная работа не тронуты',
    '  выключить, не снимая: «"hooks": {"enabled": false}» в файле настроек',
    '  снять: ' + cliCommand('uninstall-hook')
  ];
  if (cfg.hooks.enabled === false) {
    lines.push('! сейчас автоматика выключена настройкой hooks.enabled — хук будет молчать');
  }
  return { code: EXIT.OK, lines: lines };
}

/* Снятие: убирается только то, что поставили мы. Файл не «похож на наш», а помечен
 * меткой, иначе чужой хук был бы стёрт молча. */
export function uninstallHook(root) {
  const files = HOOKS.map((name) => hookFile(root, name));
  const rels = files.map((f) => path.relative(root, f));
  const present = files.filter((f) => fs.existsSync(f));
  if (present.length === 0) {
    return { code: EXIT.OK, lines: ['· хук не установлен: ' + rels.join(', ')] };
  }
  present.forEach((file) => {
    if (!isOurs(file)) {
      refuse(EXIT.CONFIG, 'хук ' + path.relative(root, file) + ' поставлен не этим инструментом — не трогаю.\n'
        + '  починка: уберите из него строку с «hook-run», если она там есть');
    }
  });
  present.forEach((file) => fs.rmSync(file));
  fs.rmSync(stateDir(root), { recursive: true, force: true });
  return { code: EXIT.OK, lines: ['✓ хук снят: ' + rels.join(', ') + ' (проект ведёт себя как до установки)'] };
}

/* Замок: два хука одновременно (например, коммит из двух терминалов) не должны
 * пересобирать один файл. Замок с живым владельцем — «уже идёт»; замок, оставшийся
 * от убитого процесса, забирается: иначе однажды прерванный прогон запретил бы хук
 * навсегда. */
function acquire(root) {
  const file = path.join(stateDir(root), LOCK);
  fs.mkdirSync(stateDir(root), { recursive: true });
  const take = () => {
    fs.writeFileSync(file, String(process.pid) + '\n', { flag: 'wx' });
    return { ok: true, file: file, release: () => fs.rmSync(file, { force: true }) };
  };
  try {
    return take();
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  let owner = null;
  try {
    owner = Number(fs.readFileSync(file, 'utf8').trim());
  } catch (_e) {
    owner = null;
  }
  if (owner !== null && owner > 0 && alive(owner)) return { ok: false, file: file };
  fs.rmSync(file, { force: true });
  return take();
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (_e) {
    return false;
  }
}

/* Запись о запуске для `size doctor`. Её провал (нет прав, нет каталога) не должен
 * становиться шумом после коммита: это не то, ради чего хук запускают. */
function record(root, fields, note) {
  const state = Object.assign({ schema: 1, at: new Date().toISOString() }, fields);
  try {
    fs.mkdirSync(stateDir(root), { recursive: true });
    fs.writeFileSync(path.join(stateDir(root), STATE), JSON.stringify(state, null, 2) + '\n');
  } catch (_e) {
    // см. выше: запись — не цель прогона
  }
  return { code: EXIT.OK, note: note === undefined ? '' : note };
}

/* Коммит отчёта собирается плумбингом, а не `git commit --only`: `--only` отказывает
 * на слиянии («cannot do a partial commit during a merge» — MERGE_HEAD жив, пока хук
 * `post-merge` работает), а развилка «обычный случай так, слияние иначе» оставила бы
 * один из двух путей почти без хода. Дерево берётся от HEAD, и в нём подменяется
 * ровно путь отчёта, поэтому в коммит не может попасть ни индекс, ни чужая правка,
 * а `commit-tree` хуков не зовёт — вложенного запуска не бывает по устройству.
 * Подпись коммита не спрашивается: настройка машины не должна останавливать коммит.
 * Дешёвый индекс здесь — временный: настоящий трогается один раз, и только в записи
 * об отчёте, иначе после коммита дерево было бы грязным. */
function commitReport(root, rel, file, message, branch, head) {
  const fail = (why) => ({ ok: false, why: why });
  const blob = gitTry(root, ['hash-object', '-w', '--', file]);
  if (blob.status !== 0) return fail('git hash-object: ' + blob.stderr.trim());
  const listed = gitTry(root, ['ls-files', '-s', '--', rel]);
  const mode = listed.stdout.trim().split(' ')[0] || '100644';
  const indexFile = path.join(stateDir(root), 'commit-index');
  const env = { GIT_INDEX_FILE: indexFile };
  const entry = [mode, blob.stdout.trim(), rel].join(',');
  fs.rmSync(indexFile, { force: true });
  try {
    const read = gitTry(root, ['read-tree', head], env);
    if (read.status !== 0) return fail('git read-tree: ' + read.stderr.trim());
    const put = gitTry(root, ['update-index', '--add', '--cacheinfo', entry], env);
    if (put.status !== 0) return fail('git update-index: ' + put.stderr.trim());
    const tree = gitTry(root, ['write-tree'], env);
    if (tree.status !== 0) return fail('git write-tree: ' + tree.stderr.trim());
    const made = gitTry(root, ['commit-tree', tree.stdout.trim(), '-p', head, '-m', message]);
    if (made.status !== 0) return fail('git commit-tree: ' + made.stderr.trim());
    const moved = gitTry(root, ['update-ref', '-m', message, branch, made.stdout.trim(), head]);
    if (moved.status !== 0) return fail('git update-ref: ' + moved.stderr.trim());
    const synced = gitTry(root, ['update-index', '--add', '--cacheinfo', entry]);
    if (synced.status !== 0) return fail('git update-index: ' + synced.stderr.trim());
    return { ok: true, sha: made.stdout.trim().slice(0, 7) };
  } finally {
    fs.rmSync(indexFile, { force: true });
  }
}

export function hookRun(root, configFile) {
  if (process.env.CI || process.env[NO_HOOK]) {
    return record(root, {
      result: 'skipped',
      why: 'окружение без автообновления (' + (process.env.CI ? 'CI' : NO_HOOK) + ')'
    });
  }
  const head = gitTry(root, ['rev-parse', 'HEAD']);
  const sha = head.status === 0 ? head.stdout.trim() : null;
  const lock = acquire(root);
  if (!lock.ok) {
    return record(root, {
      result: 'skipped',
      head: sha,
      why: 'обновление уже идёт (замок ' + path.relative(root, lock.file) + ')'
    });
  }
  try {
    return runLocked(root, configFile, sha);
  } finally {
    lock.release();
  }
}

function runLocked(root, configFile, sha) {
  let cfg;
  try {
    cfg = loadConfig(configFile);
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    return record(root, { result: 'skipped', head: sha, why: 'настройки нечитаемы: ' + e.message });
  }
  if (cfg.hooks.enabled === false) {
    return record(root, { result: 'skipped', head: sha, report: cfg.output, why: 'выключено настройкой hooks.enabled' });
  }
  /* Отделённый HEAD — это rebase, cherry-pick и bisect: коммитить в такое состояние
   * нельзя (запись окажется ни на одной ветке), а пересобирать отчёт по промежуточному
   * состоянию некому. Слиянию это не мешает: `post-merge` приходит уже после того,
   * как коммит слияния создан. */
  const branch = gitTry(root, ['symbolic-ref', '-q', 'HEAD']).stdout.trim();
  if (branch === '') {
    return record(root, { result: 'skipped', head: sha, report: cfg.output, why: 'HEAD отделён (rebase, cherry-pick, bisect)' });
  }

  let out;
  try {
    out = rebuild(cfg, root);
  } catch (e) {
    /* Отказ инструмента (нет истории, не разобрался файл, нет настроек) — это не
     * отказ хука: коммит уже сделан, и валить его нечем и незачем. Причина едет
     * в `size doctor`, а человеку хватает одной строки. Неожиданная ошибка — дефект
     * инструмента, и стек печатается: иначе его нечем разбирать. */
    if (e instanceof Refusal) {
      return record(root, { result: 'refused', head: sha, report: cfg.output, why: e.message }, '✗ size-report: ' + e.message.split('\n')[0]);
    }
    return record(root, { result: 'failed', head: sha, report: cfg.output, why: String(e.message) },
      '✗ size-report: внутренняя ошибка: ' + e.stack);
  }

  const rel = path.relative(root, out.file);
  if (gitTry(root, ['ls-files', '--error-unmatch', '--', rel]).status !== 0) {
    return record(root, {
      result: 'rebuilt',
      head: sha,
      report: cfg.output,
      why: 'отчёт не отслеживается git: пересобран, коммита нет'
    });
  }
  const diff = gitTry(root, ['diff', '--quiet', 'HEAD', '--', rel]);
  if (diff.status === 0) {
    return record(root, { result: 'unchanged', head: sha, report: cfg.output });
  }
  if (diff.status !== 1) {
    return record(root, { result: 'failed', head: sha, report: cfg.output, why: 'git diff: ' + diff.stderr.trim() },
      '✗ size-report: git diff -- ' + rel + ': ' + diff.stderr.trim());
  }

  const message = 'chore(report): отчёт пересобран после ' + sha.slice(0, 7);
  const commit = commitReport(root, rel, out.file, message, branch, sha);
  if (!commit.ok) {
    return record(root, { result: 'refused', head: sha, report: cfg.output, why: commit.why },
      '✗ size-report: коммит отчёта не прошёл: ' + commit.why);
  }
  const made = commit.sha;
  return record(root, { result: 'committed', head: sha, report: cfg.output, commit: made },
    '✓ size-report: ' + cfg.output + ' пересобран и закоммичен (' + made + ')');
}

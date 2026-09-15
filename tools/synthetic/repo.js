import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { MAX_BUF } from '../harness.js';
import { gitArgv, gitEnv } from '../../src/git.js';

/* Детерминированный репозиторий фикстуры: время, автор и обвязка git.
 *
 * **Время и личность зафиксированы** — иначе sha коммитов не воспроизводимы, а они
 * и есть личность фикстуры: на них держатся и эталонные числа, и проверки переноса.
 * Отсчёт времени идёт от номера коммита (`tick`), поэтому порядок вызовов `commit`
 * — это и порядок дат: перестановка шагов истории поехала бы числами.
 *
 * **Настройки git закреплены как у движка и у проверок**: фикстура собирается тем же
 * git, и её байты не должны зависеть от машины, на которой её собрали. Отсюда же
 * `core.autocrlf=false` при сборке: переводы строк в фикстуре — часть содержимого, а
 * не авто-правка рабочего дерева.
 */

const BASE_MS = Date.UTC(2026, 0, 1, 7, 0, 0); // 2026-01-01 10:00:00 +03:00
const HOUR = 3600 * 1000;
let tick = 0;

export function stamp() {
  const d = new Date(BASE_MS + (tick++) * HOUR + 3 * HOUR); // та же зона, что в подписи
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + 'T'
    + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + '+03:00';
}

export const AUTHOR = {
  GIT_AUTHOR_NAME: 'size-report fixture',
  GIT_AUTHOR_EMAIL: 'fixture@size-report.invalid',
  GIT_COMMITTER_NAME: 'size-report fixture',
  GIT_COMMITTER_EMAIL: 'fixture@size-report.invalid'
};

export function git(dir, args, env) {
  return execFileSync('git', gitArgv(args), {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: MAX_BUF,
    env: Object.assign({}, gitEnv(), AUTHOR, env || {})
  });
}

/* Настройки сборки: подписи не ставятся (они зависят от машины), переводы строк не
 * правятся (они часть содержимого). Список — часть личности фикстуры, а не мелочь. */
export function initRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.name', AUTHOR.GIT_AUTHOR_NAME]);
  git(dir, ['config', 'user.email', AUTHOR.GIT_AUTHOR_EMAIL]);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'tag.gpgsign', 'false']);
  git(dir, ['config', 'core.autocrlf', 'false']);
  git(dir, ['config', 'core.safecrlf', 'false']);
}

export function commit(dir, subject) {
  git(dir, ['add', '-A']);
  const when = stamp();
  git(dir, ['commit', '-q', '--no-verify', '-m', subject],
    { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when });
}

/* Слияние доводится до открытой правки (`--no-commit`), и это проверка самой
 * фикстуры: если git слил сам, ловушка «слияние с правкой разрешения конфликта»
 * перестала существовать, а история при этом осталась бы сходящейся. */
export function mergeConflicted(dir, branch) {
  const res = spawnSync('git', gitArgv(['merge', '--no-commit', '--no-ff', branch]), {
    cwd: dir, encoding: 'utf8', env: Object.assign({}, gitEnv(), AUTHOR)
  });
  if (res.status === 0) throw new Error('слияние в фикстуре прошло без конфликта');
}

export function write(dir, rel, text) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, 'utf8');
}

export function remove(dir, rel) {
  fs.rmSync(path.join(dir, rel));
}

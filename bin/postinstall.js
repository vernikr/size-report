#!/usr/bin/env node
/* Постановка хука после установки пакета: чтобы отчёт обновлялся с первого же
 * коммита, не требуя ни запуска инструмента, ни файла настроек.
 *
 * Здесь только поиск проекта-потребителя: сам хук ставит `autoInstall`
 * (`src/hook.js`) — то же место, что и при первом запуске, иначе «поставлено при
 * установке» и «поставлено при запуске» могли бы разойтись содержимым файла.
 *
 * Код выхода всегда 0: установка зависимостей не должна падать из-за того, что
 * услугу не удалось оказать (нет git, нет прав, чужой хук, CI). Причина не
 * печатается: у фоновой работы нет читателя, а точная причина есть у команды
 * `install-hook`.
 *
 * Отдельная тонкость: платформы, где скрипты зависимостей по умолчанию не
 * исполняются (pnpm 10, yarn berry), зовут этот файл не всегда — тогда хук
 * ставится при первом запуске инструмента в проекте. Оба пути ведут в одно место. */

import fs from 'fs';
import path from 'path';
import { autoInstall } from '../src/hook.js';

/* Каталог проекта-потребителя ищется в порядке убывания точности: `INIT_CWD`
 * (его ставят npm и pnpm, запуская скрипт пакета), `npm_config_local_prefix`,
 * затем подъём от текущего каталога вверх до ближайшего `.git`. Подъём нужен,
 * потому что сам скрипт исполняется из `node_modules`, где репозитория нет. */
function projectRoot() {
  const candidates = [process.env.INIT_CWD, process.env.npm_config_local_prefix, process.cwd()];
  for (const start of candidates) {
    const found = gitRootOf(start);
    if (found !== null) return found;
  }
  return null;
}

function gitRootOf(start) {
  if (typeof start !== 'string' || start === '') return null;
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

const root = projectRoot();
const files = root === null ? null : autoInstall(root, null);
if (files !== null && process.env.SIZE_REPORT_QUIET !== '1') {
  console.error('· size-report: хук поставлен (' + files.join(', ') + ') — отчёт обновляется после'
    + ' каждого коммита; снять: size uninstall-hook');
}

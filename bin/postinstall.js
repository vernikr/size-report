#!/usr/bin/env node
/* Hook installation after the package is installed: the report is rebuilt from the very
 * first commit, with neither the tool run nor a settings file.
 *
 * Only the consumer project is located here: the hook itself is installed by
 * `autoInstall` (`src/hook.js`) — the same place as on the first run, so that "installed
 * by the installer" and "installed by the first run" cannot diverge in the file content.
 *
 * The exit code is always 0: installing dependencies must not fail because a service
 * could not be rendered (no git, no permissions, a foreign hook, CI), and the reason is
 * not printed — background work has no reader, while `install-hook` has the exact one.
 *
 * One subtlety: platforms that skip dependency scripts by default (pnpm 10, yarn berry)
 * do not always call this file; there the hook is installed by the first run of the tool
 * in the project. Both paths lead to the same place. */

import fs from 'fs';
import path from 'path';
import { autoInstall } from '../src/hook.js';

/* The consumer project directory, most precise candidate first: `INIT_CWD` (set by npm
 * and pnpm when they run a package script), `npm_config_local_prefix`, and finally a walk
 * up from the current directory to the nearest `.git` — the script itself runs from
 * `node_modules`, where there is no repository. */
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

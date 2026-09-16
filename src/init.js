import fs from 'fs';
import path from 'path';
import { CONFIG_NAME, derivedProfile, validateConfig } from './config.js';
import { advicePath, cliCommand, refuseCause } from './refusal.js';
import { writeFileEnsured } from './artifact.js';
import { packageManager } from './project.js';

/* Pinning the settings to a file (`--init`): what the project derived about itself
 * (`src/project.js`) is written where the next run will meet it.
 *
 * A module of its own, separate from deriving the profile: that one looks at the project for the first
 * time and guesses about almost everything, while this one does a single thing — puts the result into
 * a file and says what it wrote. It has one strict requirement of itself: **what was pinned has to
 * pass the very check the first run will apply**, or the advice leads a person into a new dead end.
 */

/* What to say after writing: what was written, what will replace the approximations, and what to do
 * next. The lines are assembled into a list rather than printed as they come, so that "what was said"
 * can be read as a whole. */
function draftLines(root, target, cfg) {
  const hasPkg = fs.existsSync(path.join(root, 'package.json'));
  const manager = packageManager(root);
  return [
    '✓ настройки выведены из проекта и закреплены: ' + path.relative(root, target),
    '  колонок: ' + cfg.columns.length + ' (' + cfg.columns.map((c) => c.label).slice(0, 6).join(', ')
      + (cfg.columns.length > 6 ? ', …' : '') + ')',
    '  исключено путей: ' + cfg.skip.length + ' (сам отчёт, замки зависимостей, карты, собранное)',
    '  метрика min: настоящее сжатие (esbuild); без него — честное упрощение и код 4',
    '  метрика tok: словарь o200k_base (gpt-tokenizer); без него — оценка по длине и код 4',
    '  журнал: ' + (cfg.journal === null ? 'не найден — ссылки строк будут без разделов' : cfg.journal.path),
    '  дальше: правьте колонки и метрики — какие файлы важны, знает только проект',
    '          ' + (hasPkg
      ? 'добавьте в package.json "sizes": "size --write" — тогда отчёт будет звать '
        + manager + ' run sizes (проверка — без --write)'
      : 'запуск: ' + cfg.fixCommand + ' (проверка — без --write)'),
    '          ' + (hasPkg ? 'добавьте ' + manager + ' run test:sizes в CI' : 'добавьте проверку в CI')
      + '; проверка — команда пакета, своих файлов в проект она не приносит'
  ];
}

/* An empty profile is a note rather than a refusal: the work was done, and nobody will pick the columns
 * for the person. Hence "!", not the cross: a mark and an exit code must not say different things (the
 * refusal catalogue counts a cross as a refusal and a note as not one). */
function noteNoColumns(root, target, cfg) {
  if (cfg.columns.length > 0) return;
  console.error('! в проекте не нашлось путей, которые можно взять колонками'
    + ' (история пуста или в ней нет знакомых расширений): черновик записан без колонок'
    + '\n  впишите их руками в ' + path.relative(root, target)
    + ' — без колонок проверка настроек скажет «не задано ни одной колонки»');
}

export function initMode(root, file, force) {
  const target = file ? path.resolve(root, file) : path.join(root, CONFIG_NAME);
  if (fs.existsSync(target) && !force) {
    // The advice names the very file in question: `--init --force` without a file would overwrite the
    // default name with a draft rather than the file the person named.
    const name = file === undefined || file === null ? CONFIG_NAME : advicePath(file);
    refuseCause('config already exists', 'конфиг уже есть: ' + target
      + '\n  починка: правьте его или перезапишите черновиком: ' + cliCommand('--init ' + name + ' --force'));
  }
  // What is pinned is the very thing the project runs on without a file (the project's derivation on
  // top of the defaults), and it has to pass the same check the run will apply: the path in a refusal
  // text is the file it landed in. "Derived" and that path are not written to the file: they are
  // properties of where the settings came from rather than of the settings.
  const cfg = derivedProfile(root);
  if (cfg.columns.length > 0) validateConfig(Object.assign({}, cfg, { path: target }));
  const written = Object.assign({}, cfg);
  delete written.path;
  delete written.derived;
  writeFileEnsured(target, JSON.stringify(written, null, 2) + '\n');
  noteNoColumns(root, target, cfg);
  draftLines(root, target, cfg).forEach((line) => console.log(line));
  return 0;
}

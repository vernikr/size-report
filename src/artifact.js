import fs from 'fs';
import path from 'path';
import { build } from './history.js';
import { render } from './render.js';

/* Артефакт на диске: единственное место, где отчёт превращается в файл. Им
 * пользуются оба потребителя — режим `--write` и хук после коммита (`src/hook.js`),
 * поэтому «что записано в файл» не может разойтись между ними: в коммит хук кладёт
 * ровно те байты, которые показывает `--write`.
 *
 * Каталог создаётся здесь же: `--write .size-report/report.html` в свежем проекте —
 * обычный запуск, а не ошибка пользователя. */

/* Запись файла с созданием каталога: `--write .size-report/report.html` в свежем
 * проекте — обычный запуск, а не ошибка пользователя. Тем же путём пишутся
 * страница (`--page`) и черновик настроек (`--init`), поэтому он один на пакет. */
export function writeFileEnsured(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

export function rebuild(cfg, root) {
  const { rows, dropped, state } = build(cfg, root);
  const html = render(rows, cfg);
  const file = path.join(root, cfg.output);
  writeFileEnsured(file, html);
  return { rows: rows, dropped: dropped, state: state, html: html, file: file };
}

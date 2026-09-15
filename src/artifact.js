import fs from 'fs';
import path from 'path';
import { reportData } from './data.js';
import { pageHtml } from './page/build.js';

/* Отчёт — один файл: самодостаточная страница. Она и есть артефакт, потому что
 * несёт всё сама (данные, оформление, программу), а второй формы того же отчёта не
 * существует: два вывода одной истории разошлись бы молча, и выбрать, какой из них
 * верный, было бы нечем.
 *
 * Через это место проходят оба потребителя — режим записи (`--write`) и хук после
 * коммита (`src/hook.js`), поэтому «что записано в файл» не может разойтись между
 * ними: в коммит хук кладёт ровно те байты, которые показывает `--write`.
 *
 * Каталог создаётся здесь же: `--write docs/size-report.html` в свежем проекте —
 * обычный запуск, а не ошибка пользователя. Тем же путём пишется черновик настроек
 * (`--init`), поэтому он один на пакет. */

/* Запись файла с созданием каталога: путь может не существовать ни одной своей
 * частью — это не ошибка того, кто его назвал. */
export function writeFileEnsured(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/* Собранные байты отчёта без записи: они же нужны проверке (`таблица совпадает с
 * историей`), и собирать их вторым способом значило бы сверять не то, что пишется. */
export function artifact(cfg, root) {
  const data = reportData(cfg, root);
  return { data: data, html: pageHtml(data, cfg), file: path.join(root, cfg.output) };
}

export function rebuild(cfg, root) {
  const out = artifact(cfg, root);
  writeFileEnsured(out.file, out.html);
  return out;
}

import path from 'path';
import vm from 'vm';
import { refuseCause } from '../refusal.js';
import { moduleError } from '../parse.js';

/* Гард стриппера: он не имеет права выбросить что-то кроме комментариев и
 * отступов, поэтому результат обязан компилироваться. Проверяем только те
 * расширения, где содержимое — валидный JavaScript (список в конфиге,
 * `minify.guard`): TypeScript или JSX хостом не проверяются, и делать вид, что
 * проверили, было бы хуже, чем не проверять.
 *
 * Модуль или скрипт решает текст, а не расширение: проект с бандлером пишет
 * `import`/`export` прямо в `.js` (и с `type: module` в манифесте, и без него), а
 * `vm.Script` разбирает такой файл как скрипт и падает на самом `export`. Гард
 * обязан понимать оба формата, поэтому пробует тот, на который файл похож, и
 * принимает результат, если он разбирается хотя бы одним из двух способов.
 * От этого он не слабеет: настоящая поломка не разберётся ни скриптом, ни
 * модулем, и тогда наружу идёт причина того разбора, которым файл был.
 *
 * Модуль разбирает отдельный рабочий поток (`parse.js`): без него разбор модуля
 * стоил бы запуска Node на каждую клетку. Иначе конфиг вида `eslint.config.mjs`
 * остался бы без гарда, а без гарда его правка могла бы испортить «объём» молча.
 *
 * Когда не разбирается даже исходный текст, стриппер тут ни при чём: в этой
 * графе измеряется не JavaScript (TypeScript, JSX), и это отказ с командой
 * починки — правкой настроек. */

const MODULE_MARK = /^[ \t]*(?:import|export)\b/m;
const MODULE_EXT = ['.mjs'];

export function assertCompilable(min, rev, p, src) {
  // Скрипт пробуется первым не ради формы, а ради цены: этот разбор идёт
  // в процессе, а модуль — в рабочем потоке.
  const asScript = scriptError(min, p);
  if (asScript === null) return;
  const asModule = moduleError(min);
  if (asModule === null) return;
  const shape = MODULE_EXT.indexOf(path.extname(p).toLowerCase()) >= 0 || MODULE_MARK.test(min);
  if (src !== undefined && scriptError(src, p) !== null && moduleError(src) !== null) {
    refuseCause('файл не JavaScript', 'файл ' + p + ' — не JavaScript: его исходный текст не'
      + ' разбирается ни как скрипт, ни как модуль, так что дело не в стриптере, а '
      + path.extname(p) + ' стоит в minify.guard: ' + (shape ? asModule : asScript) + '\n'
      + '  починка: уберите это расширение из minify.guard или задайте для него '
      + 'minify.ext — например { "' + path.extname(p).toLowerCase() + '": "strip-lines" }');
  }
  // Причина — того разбора, которым файл был: обвинять в чужой форме незачем.
  throw new Error('стриппер испортил ' + p + ' на ' + rev.slice(0, 7) + ': '
    + (shape ? asModule : asScript));
}

// Разбор как скрипт — в процессе: дешевле и без временных файлов.
function scriptError(text, p) {
  try {
    new vm.Script(text, { filename: p });
    return null;
  } catch (e) {
    return e.message;
  }
}

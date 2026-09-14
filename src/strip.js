import path from 'path';
import vm from 'vm';
import { refuseCause } from './refusal.js';
import { moduleError } from './parse.js';

/* Снятие балласта: стрипперы комментариев и отступов для каждой формы текста и
 * правило, какая форма к какому файлу применяется. Только преобразование
 * текста — ни истории, ни настроек этот модуль не знает. */

export function byteLen(text) {
  return Buffer.byteLength(text, 'utf8');
}

/* Снятие комментариев и отступов — метрика «объём без балласта», а не
 * минификация: пробелы внутри строк и порядок токенов не трогаются (это позволит
 * сравнивать числа между языками и не зависит от чужого инструмента, которого в
 * проекте нет). Строки и шаблоны проходят насквозь, блочный комментарий
 * заменяется пробелом, чтобы `a` и `b` из `a` + блочный комментарий + `b` не
 * склеились в одно имя, перевод строки после `//` сохраняется — он разделяет
 * токены. */
export function stripJs(src) {
  let out = '';
  let i = 0;
  let last = '';   // последний значимый символ вывода: по нему решается, оператор «/» или регексп
  let word = '';   // хвост последнего слова: после `return` идёт выражение, а не деление
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    // Комментарные пары проверяются до регекси: ни `/`, ни `*` не могут быть
    // первым символом литерала регекспа, а вот `/*` в начале файла — обычное дело.
    if (ch === '/' && next === '/') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      out += ' ';
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (ch === '/' && regexAllowed(last, word)) {
      const end = endOfRegex(src, i);
      out += src.slice(i, end);
      i = end;
      last = '/';
      word = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = endOfString(src, i, ch);
      out += src.slice(i, end);
      i = end;
      last = ch;
      word = '';
      continue;
    }
    out += ch;
    if (ch.trim() !== '') {
      last = ch;
      word = /[\w$]/.test(ch) ? word + ch : '';
    }
    i++;
  }
  return out;
}

/* Регексп начинается там, где ожидается операнд: после оператора, открывающей
 * скобки или ключевого слова. Признак грубый, но его хватает: без него
 * `replace(/\//g, …)` читалось бы как начало строчного комментария и резало
 * строку (проверено гардом компиляции). */
const REGEX_KEYWORDS = ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else', 'yield', 'await'];

function regexAllowed(last, word) {
  if (last === '') return true;
  if (REGEX_KEYWORDS.indexOf(word) !== -1) return true;
  return '([{,;:=!&|?+-*%~^<>'.indexOf(last) !== -1;
}

function endOfRegex(src, start) {
  let i = start + 1;
  let inClass = false;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '\n') return start + 1; // наткнулись на строку — значит, это был не регексп
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) return i + 1;
    i++;
  }
  return start + 1;
}

function endOfString(src, start, quote) {
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === quote) return i + 1;
    // В шаблоне `${…}` живёт выражение, а в нём — свои строки.
    if (quote === '`' && ch === '$' && src[i + 1] === '{') { i = endOfTemplateExpr(src, i + 2); continue; }
    i++;
  }
  return src.length;
}

function endOfTemplateExpr(src, start) {
  let depth = 1;
  let i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') { depth--; i++; if (depth === 0) return i; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { i = endOfString(src, i, ch); continue; }
    i++;
  }
  return src.length;
}

export function stripCss(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/* HTML: комментарии разметки (включая маркеры вклеек `<!--icon …-->` и
 * `<!--/icon-->`), комментарии внутри <script> как JS и внутри <style> как CSS. */
export function stripHtml(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_m, open, body, close) => open + stripJs(body) + close)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open, body, close) => open + stripCss(body) + close);
}

export function stripLines(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => l !== '').join('\n');
}

export function compactJson(text) {
  try { return JSON.stringify(JSON.parse(text)); } catch (_e) { return stripLines(text); }
}

/* Стратегия по расширению. Незнакомое расширение получает снятие отступов и
 * пустых строк — безопасный минимум: снимать комментарии «на глаз» в синтаксисе,
 * которого генератор не знает (например, `#` в YAML или отступы в Python),
 * значило бы мерить уже другой файл. */
const MINIFY_BY_EXT = {
  '.js': 'strip-js', '.mjs': 'strip-js', '.cjs': 'strip-js',
  '.html': 'strip-html', '.htm': 'strip-html',
  '.css': 'strip-css', '.scss': 'strip-css', '.less': 'strip-css',
  '.json': 'json', '.json5': 'json'
};
export const STRATEGIES = ['strip-js', 'strip-html', 'strip-css', 'json', 'strip-lines', 'none'];

/* Стратегии, которые и есть минификация: JSON теряет только незначащие пробелы
 * (числа приводятся к кратчайшей записи), и короче его не сделает никто. Остальные
 * — упрощение: они снимают балласт, но не переименовывают и не перестраивают код,
 * и обещать за них точное число нельзя. Список ведёт тот модуль, который владеет
 * стратегиями; метрика по нему решает, точное у неё число или приближённое. */
export const EXACT_STRATEGIES = ['json'];

export function strategyFor(file, cfg) {
  const ext = path.extname(file).toLowerCase();
  return (cfg.minify.ext && cfg.minify.ext[ext]) || MINIFY_BY_EXT[ext] || 'strip-lines';
}

export function minifyForm(text, file, cfg) {
  const how = strategyFor(file, cfg);
  if (how === 'none') return text;
  if (how === 'strip-js') return stripLines(stripJs(text));
  if (how === 'strip-html') return stripLines(stripHtml(text));
  if (how === 'strip-css') return stripLines(stripCss(text));
  if (how === 'json') return compactJson(text);
  if (how === 'strip-lines') return stripLines(text);
  throw new Error('неизвестная стратегия минификации «' + how + '» (есть: ' + STRATEGIES.join(', ') + ')');
}

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


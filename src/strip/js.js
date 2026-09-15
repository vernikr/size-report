/* Снятие комментариев и отступов — метрика «объём без балласта», а не
 * минификация: пробелы внутри строк и порядок токенов не трогаются (это позволит
 * сравнивать числа между языками и не зависит от чужого инструмента, которого в
 * проекте нет). Строки и шаблоны проходят насквозь, блочный комментарий
 * заменяется пробелом, чтобы `a` и `b` из `a` + блочный комментарий + `b` не
 * склеились в одно имя, перевод строки после `//` сохраняется — он разделяет
 * токены.
 *
 * Проход разложен по случаям: комментарий, регексп, строка и обычный символ.
 * Случай говорит, сколько он съел (`false` — не его), и все они делят одно
 * состояние прохода; состояния «по копии на случай» здесь не заводится, потому
 * что решение о регекспе зависит от всего, что уже выведено.
 */

/* Состояние прохода: текст, место в нём и то, чем отличают регексп от деления, —
 * последний значимый символ вывода и хвост последнего слова (после `return` идёт
 * выражение, а не деление). */
function scanOf(src) {
  return { src: src, out: '', i: 0, last: '', word: '' };
}

export function stripJs(src) {
  const s = scanOf(src);
  while (s.i < src.length) {
    /* Комментарные пары проверяются до регекси: ни `/`, ни `*` не могут быть
     * первым символом литерала регекспа, а вот `/*` в начале файла — обычное дело. */
    if (skipLineComment(s) || skipBlockComment(s) || takeRegex(s) || takeString(s)) continue;
    putChar(s);
  }
  return s.out;
}

// Строчный комментарий: `//` съедается до перевода строки, сам перевод остаётся.
function skipLineComment(s) {
  if (s.src[s.i] !== '/' || s.src[s.i + 1] !== '/') return false;
  const nl = s.src.indexOf('\n', s.i);
  s.i = nl === -1 ? s.src.length : nl;
  return true;
}

// Блочный комментарий — на пробел: он разделяет имена, но не занимает объём.
function skipBlockComment(s) {
  if (s.src[s.i] !== '/' || s.src[s.i + 1] !== '*') return false;
  const end = s.src.indexOf('*/', s.i + 2);
  s.out += ' ';
  s.i = end === -1 ? s.src.length : end + 2;
  return true;
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

function takeRegex(s) {
  if (s.src[s.i] !== '/' || !regexAllowed(s.last, s.word)) return false;
  const end = endOfRegex(s.src, s.i);
  s.out += s.src.slice(s.i, end);
  s.i = end;
  s.last = '/';
  s.word = '';
  return true;
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

// Строка или шаблон — целиком, вместе со своим содержимым.
function takeString(s) {
  const quote = s.src[s.i];
  if (quote !== '"' && quote !== "'" && quote !== '`') return false;
  const end = endOfString(s.src, s.i, quote);
  s.out += s.src.slice(s.i, end);
  s.i = end;
  s.last = quote;
  s.word = '';
  return true;
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

/* Обычный символ: он попадает в вывод, а состояние прохода запоминает по нему,
 * где может стоять регексп. */
function putChar(s) {
  const ch = s.src[s.i];
  s.out += ch;
  if (ch.trim() !== '') {
    s.last = ch;
    s.word = /[\w$]/.test(ch) ? s.word + ch : '';
  }
  s.i++;
}

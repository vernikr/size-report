/* Comments and indentation stripped — "volume without ballast" rather than minification:
 * spaces inside strings and the order of tokens stay untouched, which keeps numbers
 * comparable across languages and keeps this path free of any foreign tool (the real
 * minifier is an optional dependency, and this is what remains without it). Strings and
 * templates pass through whole, a block comment becomes a space — so that `a` and `b` around
 * one do not merge into a single name — and the newline after `//` survives, because it
 * separates tokens.
 *
 * The pass is split by case: comment, regex, string, ordinary character. A case reports how
 * much it consumed (`false` — not its turn), and all of them share one pass state; a state
 * per case is not kept because the decision about a regex depends on everything printed so
 * far.
 */

/* Pass state: the text, the position in it, and what tells a regex from a division — the last
 * significant character printed and the tail of the last word (`return` is followed by an
 * expression rather than by a division). */
function scanOf(src) {
  return { src: src, out: '', i: 0, last: '', word: '' };
}

export function stripJs(src) {
  const s = scanOf(src);
  while (s.i < src.length) {
    /* Comment pairs are checked before regexes: neither `/` nor `*` can start a regex
     * literal, while `/*` is an ordinary thing to meet. */
    if (skipLineComment(s) || skipBlockComment(s) || takeRegex(s) || takeString(s)) continue;
    putChar(s);
  }
  return s.out;
}

// A line comment: `//` is eaten up to the newline, the newline itself stays.
function skipLineComment(s) {
  if (s.src[s.i] !== '/' || s.src[s.i + 1] !== '/') return false;
  const nl = s.src.indexOf('\n', s.i);
  s.i = nl === -1 ? s.src.length : nl;
  return true;
}

// A block comment becomes a space: it separates names without taking up volume.
function skipBlockComment(s) {
  if (s.src[s.i] !== '/' || s.src[s.i + 1] !== '*') return false;
  const end = s.src.indexOf('*/', s.i + 2);
  s.out += ' ';
  s.i = end === -1 ? s.src.length : end + 2;
  return true;
}

/* A regex starts where an operand is expected: after an operator, an opening bracket or a
 * keyword. The sign is crude, and it can afford to be: a regex this pass mistakes for code,
 * or code it mistakes for a comment, does not compile — and that is exactly what the guard
 * checks (`strip/guard.js`). */
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
    if (ch === '\n') return start + 1; // a newline means this was not a regex after all
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) return i + 1;
    i++;
  }
  return start + 1;
}

// A string or a template passes through whole, its content included.
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
    // A template holds an expression in `${…}`, and that expression has strings of its own.
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

/* An ordinary character: it goes into the output, and the pass state remembers by it where a
 * regex may stand. */
function putChar(s) {
  const ch = s.src[s.i];
  s.out += ch;
  if (ch.trim() !== '') {
    s.last = ch;
    s.word = /[\w$]/.test(ch) ? s.word + ch : '';
  }
  s.i++;
}

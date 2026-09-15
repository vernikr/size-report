import { stripJs } from './js.js';

/* Text forms with a stripping rule of their own: markup, styles, the lines of a file and
 * JSON. One rule for all of them would either strip nothing at all or corrupt a syntax it was
 * never taught. */

export function stripCss(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/* HTML: markup comments, and the comments inside <script> as JS and inside <style> as CSS —
 * each part stripped by the rule of its own form rather than by the markup one. */
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

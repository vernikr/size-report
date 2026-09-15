import { stripJs } from './js.js';

/* Формы текста, у которых снятие балласта своё: разметка, стили, строки файла и
 * JSON. Разные формы — разные правила, и одно правило на все было бы либо
 * трусостью (не снимать ничего), либо порчей чужого синтаксиса. */

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

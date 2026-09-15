import path from 'path';
import { stripJs } from './strip/js.js';
import { compactJson, stripCss, stripHtml, stripLines } from './strip/forms.js';

/* Stripping ballast: which form of text applies to which file. Only text transformation —
 * the module knows no history and reads no settings, only the strategy it is handed. What
 * binds the forms to a file lives here: the extension, the strategy, and which strategies
 * count as exact.
 *
 * The forms are re-exported from here, so that the package entry point has one address for
 * them and a move inside the parsing stays invisible to whoever relied on them. */

export { stripJs, stripCss, stripHtml, stripLines, compactJson };
export { assertCompilable } from './strip/guard.js';

export function byteLen(text) {
  return Buffer.byteLength(text, 'utf8');
}

/* The strategy for an extension. An unknown extension gets indentation and blank lines
 * removed — the safe minimum: stripping comments by eye in a syntax the generator was never
 * taught (`#` in YAML, indentation in Python) would measure a different file than the one on
 * disk. */
const MINIFY_BY_EXT = {
  '.js': 'strip-js', '.mjs': 'strip-js', '.cjs': 'strip-js',
  '.html': 'strip-html', '.htm': 'strip-html',
  '.css': 'strip-css', '.scss': 'strip-css', '.less': 'strip-css',
  '.json': 'json', '.json5': 'json'
};
export const STRATEGIES = ['strip-js', 'strip-html', 'strip-css', 'json', 'strip-lines', 'none'];

/* The strategies that are minification itself: JSON loses only insignificant whitespace
 * (numbers take their shortest form) and nobody can make it shorter. The rest are a
 * simplification — they drop ballast but neither rename nor restructure code, so no exact
 * number can be promised for them. The list is owned here, next to the strategies, and the
 * metric reads it to decide whether its number is exact or approximate. */
export const EXACT_STRATEGIES = ['json'];

export function strategyFor(file, cfg) {
  const ext = path.extname(file).toLowerCase();
  return (cfg.minify.ext && cfg.minify.ext[ext]) || MINIFY_BY_EXT[ext] || 'strip-lines';
}

/* What a strategy does belongs to the strategy rather than to this list: the dispatcher only
 * picks whom to call, and repeats the strategy names because the parsing lives elsewhere. */
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

import path from 'path';
import { stripJs } from './strip/js.js';
import { compactJson, stripCss, stripHtml, stripLines } from './strip/forms.js';

/* Снятие балласта: правило, какая форма текста к какому файлу применяется.
 * Только преобразование текста — ни истории, ни настроек этот модуль не знает.
 *
 * Разбор форм лежит рядом и по предметам: проход по JS (`strip/js.js`), формы
 * разметки, стилей, строк и JSON (`strip/forms.js`) и гард компиляции
 * (`strip/guard.js`). Здесь остаётся то, что связывает их с файлом: расширение,
 * стратегия и что считать точным числом.
 *
 * Имена форм наружу отдаются отсюда же: точка входа пакета берёт их по одному
 * адресу, и переезд разбора не должен быть виден тому, кто на них опирался. */

export { stripJs, stripCss, stripHtml, stripLines, compactJson };
export { assertCompilable } from './strip/guard.js';

export function byteLen(text) {
  return Buffer.byteLength(text, 'utf8');
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

/* Что делает стратегия — разбор формы принадлежит ей, а не списку здесь:
 * диспетчер только выбирает, кого позвать, и повторяет словарь стратегий. */
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

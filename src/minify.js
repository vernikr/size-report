import path from 'path';
import { loadOptional } from './optional.js';
import { refuseCause } from './refusal.js';

/* Настоящий минификатор — необязательная зависимость (её устройство — в
 * `src/optional.js`), а здесь только то, что знает сам минификатор: какие форматы
 * он берёт и как считается отказ.
 *
 * Отказ минификатора (файл не разобрался) исключением быть обязан: расширение
 * соврало о содержимом, и упрощение вместо сжатия подменило бы число молча. */

/* Расширения, за которые отвечает минификатор. Таблица — единственный источник
 * правды и для замера, и для подписи метрики («остальные форматы — приближение»),
 * поэтому разойтись им нечем. JSX и TSX сюда не входят: выход зависит от настройки
 * `jsx` проекта (`React.createElement` против `react/jsx-runtime`), и мерить чужое
 * решение о рантайме — не наше дело; такие файлы честно считаются упрощением. */
export const MINIFY_LOADERS = {
  '.js': 'js', '.mjs': 'js', '.cjs': 'js',
  '.ts': 'ts', '.mts': 'ts', '.cts': 'ts',
  '.css': 'css'
};

let probed = null;

/* Ответ разбора — один на процесс: пробовать загрузку на каждом файле значило бы
 * платить за неё тысячи раз, а от файла решение не зависит. */
export function minifier() {
  if (probed === null) probed = loadOptional('esbuild');
  return probed;
}

/* Сжатие одного текста. Настройки выхода закреплены, а не взяты по умолчанию:
 * `charset: utf8` — потому что измеряется файл проекта в UTF-8 (умолчание
 * экранировало бы не-ASCII и число вышло бы больше настоящего), `legalComments:
 * none` — потому что комментарии снимают и все прочие стратегии, и число должно
 * означать одну вещь, а не две. `sourcefile` нужен ради причины в отказе. */
export function minifyWithEsbuild(text, file, rev) {
  const { tool, why } = minifier();
  if (tool === null) throw new Error('минификатор недоступен: ' + why);
  const ext = path.extname(file).toLowerCase();
  try {
    return tool.transformSync(text, {
      loader: MINIFY_LOADERS[ext],
      minify: true,
      charset: 'utf8',
      legalComments: 'none',
      sourcefile: file
    }).code;
  } catch (e) {
    // Совет называет один выход — тот, который этой причине и отвечает: смена
    // минификатора на `strip` уберёт причину, но передаст тот же файл гарду
    // `minify.guard`, у которого разговор тот же («это не JavaScript»).
    refuseCause('минификатор не разобрал', 'esbuild не разобрал ' + file + ' на '
      + rev.slice(0, 7) + ': ' + cause(e.message)
      + '\n  починка: расширение соврало о содержимом или минификатор старше синтаксиса;'
      + ' задайте этому расширению упрощение в minify.ext (например {"' + ext + '": "strip-lines"})');
  }
}

/* Причина у esbuild многострочная, и первая строка — «Transform failed with N
 * errors:»; сама причина стоит там, где начинается ошибка. Без неё отказ говорил
 * бы, что что-то не так, но не что именно. */
function cause(text) {
  const lines = String(text).split('\n');
  const at = lines.findIndex((line) => line.indexOf('ERROR:') >= 0);
  return (at >= 0 ? lines[at] : lines[0]).trim();
}

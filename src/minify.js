import path from 'path';
import { createRequire } from 'module';
import { EXIT, refuse } from './refusal.js';

/* Настоящий минификатор — и по цене, и по смыслу необязательная зависимость:
 * замер обязан работать у того, кто поставил пакет без необязательных
 * зависимостей, а обещать при этом настоящее сжатие нельзя. Отсюда три решения:
 * загрузка ленивая (минификатор занимает память только у того, кому он нужен),
 * синхронная (`createRequire`: замер — синхронный проход, и `import()` сделал бы
 * асинхронной всю цепочку ради одного датчика) и без исключения на отсутствие —
 * недоступность возвращается ответом, а не падением.
 *
 * Отказ самого минификатора (файл не разобрался) исключением быть обязан:
 * расширение соврало о содержимом, и упрощение вместо сжатия подменило бы число
 * молча. */

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

/* Шов отсутствия: им проверяется, что инструмент работает без необязательной
 * зависимости. Тем же путём идут установка без необязательных зависимостей и
 * платформа, для которой минификатора нет вовсе. */
export const NO_OPTIONAL = 'SIZE_REPORT_NO_OPTIONAL';

let probed = null;

/* Ответ разбора — один на процесс: пробовать загрузку на каждом файле значило бы
 * платить за неё тысячи раз, а от файла решение не зависит. */
export function minifier() {
  if (probed === null) probed = load();
  return probed;
}

function load() {
  if (process.env[NO_OPTIONAL]) {
    return { tool: null, version: null, why: 'необязательные зависимости выключены (' + NO_OPTIONAL + ')' };
  }
  try {
    const tool = createRequire(import.meta.url)('esbuild');
    return { tool: tool, version: tool.version, why: null };
  } catch (e) {
    return { tool: null, version: null, why: e.message };
  }
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
    refuse(EXIT.CONFIG, 'esbuild не разобрал ' + file + ' на ' + rev.slice(0, 7) + ': ' + cause(e.message)
      + '\n  починка: расширение соврало о содержимом или минификатор старше синтаксиса;'
      + ' задайте этому расширению упрощение в minify.ext (например {"' + ext + '": "strip-lines"})'
      + ' или считайте метрику прежним способом: "minify": {"engine": "strip"}');
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

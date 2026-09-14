import zlib from 'zlib';
import path from 'path';
import { EXACT_STRATEGIES, assertCompilable, byteLen, minifyForm, strategyFor } from './strip.js';
import { MINIFY_LOADERS, minifier, minifyWithEsbuild } from './minify.js';
import { CHARS_PER_TOKEN, binaryFormats, tokenCount, tokenizer } from './tokens.js';

/* Реестр метрик: что измеряется, нужен ли метрике текст и насколько честна цифра.
 * Отдельно от способов снятия балласта: метрика — это обещание про число, а не
 * способ его получить.
 *
 * Описание метрики для читателя берётся не из полей реестра, а из `metricView`:
 * у одной и той же метрики оно зависит от настроек (`min` — это настоящее сжатие
 * или упрощение, `tok` — точный словарь или оценка), и разойтись двум ответам на
 * один вопрос негде. */

/* Способы получить метрику `min`: снятие балласта и настоящее сжатие. Механизм у
 * них разный, и обещание тоже, поэтому у каждого свой способ, своя честность и своё
 * примечание — и никто из них не выдаётся за другого. */
export const MINIFY_ENGINES = ['strip', 'esbuild'];

const STYLES = {
  strip: {
    note: { ru: 'та же форма без комментариев и отступов', en: 'the same form without comments and indentation' },
    method: {
      ru: 'снятие комментариев и отступов (не минификация: имена не сокращаются)',
      en: 'comments and indentation stripped (not minification: names are not shortened)'
    }
  },
  esbuild: {
    note: {
      ru: 'настоящая минификация: имена сокращены, пробелы убраны',
      en: 'real minification: names shortened, whitespace removed'
    },
    method: { ru: 'esbuild {version} (minify, rename)', en: 'esbuild {version} (minify, rename)' },
    fallback: {
      ru: '; остальные форматы ({exts}) — упрощение без комментариев и отступов, то есть приближение',
      en: '; other formats ({exts}) lose comments and indentation — an approximation'
    },
    unavailable: {
      ru: ' (минификатор esbuild недоступен — счёт упрощением, то есть приближением)',
      en: ' (the esbuild minifier is unavailable — comments and indentation are stripped: an approximation)'
    }
  },
  tok: {
    note: {
      ru: 'вес для языковой модели: на сколько единиц текста (токенов) он разбирается',
      en: 'weight for a language model: how many text units (tokens) it splits into'
    },
    method: { ru: '{tool} {version}, {encoding} (BPE)', en: '{tool} {version}, {encoding} (BPE)' },
    binary: {
      ru: '; для бинарных форматов ({exts}) это счёт байтов, а не текста — приближение',
      en: '; binary formats ({exts}) are counted by bytes rather than text — an approximation'
    },
    estimate: {
      ru: 'оценка по длине: 1 токен ≈ {chars} знака ({encoding} недоступен) — приближение',
      en: 'length-based estimate: 1 token ≈ {chars} characters ({encoding} is unavailable) — an approximation'
    }
  }
};

/* Метрика объявляет, нужен ли ей текст блоба: `needsText: false` вместе с
 * `fromSize: true` означает «хватит размера объекта», и тогда содержимое не
 * читается вовсе (`git cat-file --batch` не вызывается). */
export const METRICS = {
  raw: {
    label: 'raw',
    needsText: false,
    fromSize: true,
    note: { ru: 'файл как он есть', en: 'the file as it is' },
    method: {
      ru: 'размер объекта git',
      en: 'the size of the git object'
    },
    accuracy: 'exact',
    measure: (text) => byteLen(text)
  },
  min: {
    label: 'min',
    needsText: true,
    view: minView,
    measure: (text, file, cfg, rev) => {
      if (esbuildLoader(file, cfg) !== null) return byteLen(minifyWithEsbuild(text, file, rev));
      const min = minifyForm(text, file, cfg);
      const ext = path.extname(file).toLowerCase();
      /* Гард стриппера стережёт упрощение, а не минификатор: минификатор разбирает
       * файл сам и о своей неудаче говорит отказом (`src/minify.js`), а этот гард
       * отвечает на вопрос, не выбросило ли наше снятие балласта чего-нибудь, кроме
       * комментариев и отступов. */
      if (strategyFor(file, cfg) === 'strip-js' && cfg.minify.guard.indexOf(ext) >= 0) {
        assertCompilable(min, rev, file, text);
      }
      return byteLen(min);
    }
  },
  tok: {
    label: 'tok',
    needsText: true,
    view: tokView,
    measure: (text, _file, cfg) => tokenCount(text, cfg.tokens)
  },
  gzip: {
    label: 'gzip',
    needsText: true,
    note: { ru: 'сжатый поток (zlib, уровень 9)', en: 'compressed stream (zlib, level 9)' },
    method: { ru: 'zlib, уровень 9', en: 'zlib, level 9' },
    accuracy: 'exact',
    measure: (text) => zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 }).length
  }
};

/* Описание метрики для читателя: `note` — что означает число, `method` — чем оно
 * получено, `accuracy` — точное оно или приближённое. */
export function metricView(name, cfg) {
  const metric = METRICS[name];
  if (metric.view !== undefined) return metric.view(cfg);
  return {
    label: metric.label,
    note: metric.note[cfg.locale],
    method: metric.method[cfg.locale],
    accuracy: metric.accuracy
  };
}

/* Подпись метрики `min`. Соглашение о честности: `accuracy` говорит про худшее в
 * колонке, а способ называет, где именно приближение, — поэтому один формат без
 * минификатора делает метрику приближённой целиком, а не прячется за «exact»
 * соседнего файла. */
function minView(cfg) {
  const loc = cfg.locale;
  if (minEngine(cfg) === 'esbuild') {
    const stripped = strippedFormats(cfg);
    let method = STYLES.esbuild.method[loc].replace('{version}', minifier().version);
    if (stripped.length > 0) method += STYLES.esbuild.fallback[loc].replace('{exts}', stripped.join(' '));
    return {
      label: METRICS.min.label,
      note: STYLES.esbuild.note[loc],
      method: method,
      accuracy: stripped.length === 0 ? 'exact' : 'approximate'
    };
  }
  const degraded = cfg.minify.engine === 'esbuild';
  return {
    label: METRICS.min.label,
    note: STYLES.strip.note[loc],
    method: STYLES.strip.method[loc] + (degraded ? STYLES.esbuild.unavailable[loc] : ''),
    accuracy: 'approximate'
  };
}

/* Подпись метрики `tok`. Соглашение о честности то же, что у `min`: способ говорит,
 * каким словарём снято число (семейство и кодировка — часть счёта, а не подробность),
 * а `accuracy` — точное оно или приближённое. Приближённым оно становится в двух
 * случаях, и оба названы словами: форматы, для которых токены не считаются (у них
 * число идёт по байтам), и отсутствие словаря (тогда счёт идёт оценкой по длине). */
function tokView(cfg) {
  const loc = cfg.locale;
  const settings = cfg.tokens;
  const { tool, version } = tokenizer(settings);
  if (tool === null) {
    return {
      label: METRICS.tok.label,
      note: STYLES.tok.note[loc],
      method: STYLES.tok.estimate[loc]
        .replace('{chars}', CHARS_PER_TOKEN).replace('{encoding}', settings.encoding),
      accuracy: 'approximate'
    };
  }
  const binary = binaryFormats(cfg);
  let method = STYLES.tok.method[loc]
    .replace('{tool}', 'gpt-tokenizer').replace('{version}', version).replace('{encoding}', settings.encoding);
  if (binary.length > 0) method += STYLES.tok.binary[loc].replace('{exts}', binary.join(' '));
  return {
    label: METRICS.tok.label,
    note: STYLES.tok.note[loc],
    method: method,
    accuracy: binary.length === 0 ? 'exact' : 'approximate'
  };
}

/* Форматы этого отчёта, которые будут измерены упрощением. Список выводится из
 * настроек и таблицы минификатора, а не пишется руками: подпись не может
 * разойтись с тем, что происходит. */
function strippedFormats(cfg) {
  const exts = [];
  cfg.columns.forEach((col) => {
    col.paths.forEach((p) => {
      if (minifiedForm(p, cfg)) return;
      const ext = path.extname(p).toLowerCase();
      if (exts.indexOf(ext) < 0) exts.push(ext);
    });
  });
  return exts.sort();
}

/* Упрощение бывает и точной минификацией: JSON теряет только незначащие пробелы
 * (список точных стратегий ведёт `strip.js`, потому что стратегии живут там). */
function minifiedForm(file, cfg) {
  return esbuildLoader(file, cfg) !== null || EXACT_STRATEGIES.indexOf(strategyFor(file, cfg)) >= 0;
}

/* Идёт ли файл в минификатор: сжатие запрошено, доступно и не отменено явным
 * выбором проекта — `minify.ext` старше движка и служит выходом, если расширение
 * соврало о содержимом. Ответ один на два вопроса: как считать и что обещать. */
function esbuildLoader(file, cfg) {
  if (minEngine(cfg) !== 'esbuild') return null;
  const ext = path.extname(file).toLowerCase();
  if (cfg.minify.ext[ext] !== undefined) return null;
  return MINIFY_LOADERS[ext] === undefined ? null : MINIFY_LOADERS[ext];
}

/* Действующий способ: запрошенный может быть недоступен — тогда метрика отступает
 * к другому счёту, а отступление объявляется наружу (`sensorGaps`), иначе
 * приближение ушло бы как точное число. */
export function minEngine(cfg) {
  if (cfg.minify.engine !== 'esbuild') return 'strip';
  return minifier().tool === null ? 'strip' : 'esbuild';
}

/* Чего не хватает для того, что просили: причина и починка для человека, по одной
 * на датчик. Причина загрузчика уходит только сюда — в подписи метрики она была бы
 * машинной строкой (путём чужого `node_modules`), от которой вывод перестал бы
 * быть одинаковым на разных машинах, а в подписи отчёта — понятным. */
export function sensorGaps(cfg) {
  const gaps = [];
  const minify = minifier();
  if (cfg.minify.engine === 'esbuild' && minify.tool === null) {
    gaps.push({
      why: 'метрика «min» считает упрощением: минификатор недоступен — ' + minify.why,
      fix: 'поставьте необязательные зависимости заново или задайте "minify": {"engine": "strip"}'
    });
  }
  if (cfg.metrics.indexOf('tok') >= 0) {
    const tokens = tokenizer(cfg.tokens);
    if (tokens.tool === null) {
      gaps.push({
        why: 'метрика «tok» считает оценкой по длине: словаря нет — ' + tokens.why,
        fix: 'поставьте необязательные зависимости заново или уберите "tok" из metrics'
      });
    }
  }
  return gaps;
}

/* Одно место, где решается, читать метрику из размера объекта или из текста:
 * метрика без текста на недогруженном блобе — ошибка, а не молчаливый ноль. */
export function measureBlob(name, blob, file, cfg, rev) {
  const metric = METRICS[name];
  if (metric.fromSize) return blob.size;
  if (blob.text === null) {
    throw new Error('метрике «' + name + '» нужно содержимое ' + file + ' на ' + rev.slice(0, 7) + ', а оно не прочитано');
  }
  return metric.measure(blob.text, file, cfg, rev);
}

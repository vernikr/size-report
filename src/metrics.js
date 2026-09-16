import zlib from 'zlib';
import path from 'path';
import { EXACT_STRATEGIES, assertCompilable, byteLen, minifyForm, strategyFor } from './strip.js';
import { MINIFY_LOADERS, minifier, minifyWithEsbuild } from './minify.js';
import { CHARS_PER_TOKEN, isBinary, tokenCount, tokenizer } from './tokens.js';

/* The registry of metrics: what is measured, whether a metric needs the text, and how honest
 * its number is. Separate from the ways of stripping ballast: a metric is a promise about a
 * number rather than a way to obtain one.
 *
 * The description a reader sees comes from `metricView` rather than from the registry fields:
 * for one and the same metric it depends on the settings (`min` is either real compression or
 * a simplification, `tok` either an exact dictionary or an estimate), and two answers to one
 * question have nowhere to drift apart. */

/* The ways to obtain the `min` metric: stripping ballast and real compression. Their mechanism
 * differs, and so does their promise, so each has its own method, its own honesty and its own
 * note — and neither is passed off as the other. */
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
      /* The stripper's guard watches the simplification rather than the minifier: the minifier
       * parses the file itself and reports its failure as a refusal (`src/minify.js`), while
       * this guard answers whether our stripping threw away anything but comments and
       * indentation. */
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

/* The description of a metric for a reader: `note` is what the number means, `method` how it
 * was obtained, `accuracy` whether it is exact or approximate. */
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

/* The label of the `min` metric. The honesty convention: `accuracy` speaks about the worst in
 * the column, while the method says where exactly the approximation is — so one format without
 * a minifier makes the whole metric approximate instead of hiding behind the "exact" of a
 * neighbouring file. The worst is taken by the same rule as the cell marks (`pointExact`)
 * rather than by the name of the method: a report with no approximate format at all is exact
 * even with the ballast stripped. */
function minView(cfg) {
  const loc = cfg.locale;
  const rough = approximateFormats('min', cfg);
  if (minEngine(cfg) === 'esbuild') {
    let method = STYLES.esbuild.method[loc].replace('{version}', minifier().version);
    if (rough.length > 0) method += STYLES.esbuild.fallback[loc].replace('{exts}', rough.join(' '));
    return {
      label: METRICS.min.label,
      note: STYLES.esbuild.note[loc],
      method: method,
      accuracy: rough.length === 0 ? 'exact' : 'approximate'
    };
  }
  const degraded = cfg.minify.engine === 'esbuild';
  return {
    label: METRICS.min.label,
    note: STYLES.strip.note[loc],
    method: STYLES.strip.method[loc] + (degraded ? STYLES.esbuild.unavailable[loc] : ''),
    accuracy: rough.length === 0 ? 'exact' : 'approximate'
  };
}

/* The label of the `tok` metric. The honesty convention is the same as for `min`: the method
 * says which dictionary produced the number (family and encoding are part of the count rather
 * than a detail), and `accuracy` says whether it is exact or approximate. It turns approximate
 * in two cases, both spelled out: formats for which tokens are not counted (their number runs
 * by bytes) and a missing dictionary (then the count is an estimate by length). */
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
  const binary = approximateFormats('tok', cfg);
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

/* Whether a particular cell holds an exact number — one rule for both the metric label and the
 * cell mark. That is why the label cannot drift from the cells, and why the list of
 * approximate formats is computed here, by the same rule.
 *
 * `min` is exact where the file really is minified: by the minifier, or by parsing a format
 * that cannot get any shorter (JSON loses only insignificant whitespace — the list of exact
 * strategies is owned by `strip.js`, where the strategies live). `tok` is exact where a
 * dictionary exists and the format is text: the "tokens" of a picture or a font are its bytes.
 * `raw` and `gzip` are always exact: they are unambiguous quantities. */
export function pointExact(name, file, cfg) {
  if (name === 'min') return minifiedForm(file, cfg);
  if (name === 'tok') return tokenizer(cfg.tokens).tool !== null && !isBinary(file);
  return true;
}

/* The formats of this report that will be measured approximately. The list is derived from the
 * settings and the rule of exactness rather than written by hand. */
function approximateFormats(name, cfg) {
  const exts = [];
  cfg.columns.forEach((col) => {
    col.paths.forEach((p) => {
      if (pointExact(name, p, cfg)) return;
      const ext = path.extname(p).toLowerCase();
      if (exts.indexOf(ext) < 0) exts.push(ext);
    });
  });
  return exts.sort();
}

function minifiedForm(file, cfg) {
  return esbuildLoader(file, cfg) !== null || EXACT_STRATEGIES.indexOf(strategyFor(file, cfg)) >= 0;
}

/* Whether the file goes to the minifier: compression is requested, available and not overridden
 * by an explicit choice of the project — `minify.ext` outranks the engine and serves as the way
 * out when an extension lied about its content. One answer serves two questions: how to count
 * and what to promise. */
function esbuildLoader(file, cfg) {
  if (minEngine(cfg) !== 'esbuild') return null;
  const ext = path.extname(file).toLowerCase();
  if (cfg.minify.ext[ext] !== undefined) return null;
  return MINIFY_LOADERS[ext] === undefined ? null : MINIFY_LOADERS[ext];
}

/* The engine actually in force: the requested one may be unavailable, in which case the metric
 * falls back to another count — and the fallback is announced (`sensorGaps`), or an
 * approximation would travel as an exact number. */
export function minEngine(cfg) {
  if (cfg.minify.engine !== 'esbuild') return 'strip';
  return minifier().tool === null ? 'strip' : 'esbuild';
}

/* What is missing for what was asked: a cause and a fix for a human, one per sensor. The
 * loader's cause goes here and nowhere else — inside the metric label it would be a machine
 * string (a path into someone else's `node_modules`) that would make the output differ between
 * machines, while the label in the report has to stay readable. */
export function sensorGaps(cfg) {
  const gaps = [];
  const minify = minifier();
  if (cfg.minify.engine === 'esbuild' && minify.tool === null) {
    gaps.push({
      why: 'the metric "min" counts by simplification: the minifier is unavailable — ' + minify.why,
      fix: 'install the optional dependencies again or set "minify": {"engine": "strip"}'
    });
  }
  if (cfg.metrics.indexOf('tok') >= 0) {
    const tokens = tokenizer(cfg.tokens);
    if (tokens.tool === null) {
      gaps.push({
        why: 'the metric "tok" counts by an estimate of length: there is no dictionary — ' + tokens.why,
        fix: 'install the optional dependencies again or remove "tok" from metrics'
      });
    }
  }
  return gaps;
}

/* The one place that decides whether a metric is read from the object size or from the text:
 * a text-based metric on an unloaded blob is an error rather than a silent zero. */
export function measureBlob(name, blob, file, cfg, rev) {
  const metric = METRICS[name];
  if (metric.fromSize) return blob.size;
  if (blob.text === null) {
    throw new Error('метрике «' + name + '» нужно содержимое ' + file + ' на ' + rev.slice(0, 7) + ', а оно не прочитано');
  }
  return metric.measure(blob.text, file, cfg, rev);
}

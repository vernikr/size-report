import zlib from 'zlib';
import path from 'path';
import { assertCompilable, byteLen, minifyForm, strategyFor } from './strip.js';

/* Реестр метрик: что измеряется, нужен ли метрике текст и насколько честна цифра.
 * Отдельно от способов снятия балласта: метрика — это обещание про число, а не
 * способ его получить. */

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
    note: { ru: 'та же форма без комментариев и отступов', en: 'the same form without comments and indentation' },
    // Не минификация: имена не сокращаются, и число означает «объём без балласта»,
    // а не то, что получит сборщик. Поэтому метрика честно помечена приближением.
    method: {
      ru: 'снятие комментариев и отступов (не минификация: имена не сокращаются)',
      en: 'comments and indentation stripped (not minification: names are not shortened)'
    },
    accuracy: 'approximate',
    measure: (text, file, cfg, rev) => {
      const min = minifyForm(text, file, cfg);
      const ext = path.extname(file).toLowerCase();
      if (strategyFor(file, cfg) === 'strip-js' && cfg.minify.guard.indexOf(ext) >= 0) assertCompilable(min, rev, file);
      return byteLen(min);
    }
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

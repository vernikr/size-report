import path from 'path';
import { loadOptional } from './optional.js';

/* Токенизатор — та же дисциплина, что у минификатора: необязательная зависимость с
 * ленивой загрузкой (устройство — в `src/optional.js`). Отличие одно: токенизатор
 * берёт любой текст, отказать ему не в чем, поэтому отсутствие зависимости — не
 * отказ, а другой счёт: оценка по длине, помеченная приближением в подписи метрики.
 *
 * Семейство — про модели, кодировка — про число: один и тот же файл считается
 * по-разному в `cl100k_base` и `o200k_base`, поэтому кодировка выбирается рядом с
 * семейством, а не подразумевается. Семейство тут одно, и это не недоделка: у
 * остальных нет словаря, который можно было бы назвать их собственным, — считать
 * чужим словарём и называть это семейством значило бы обещать то, чего нет. */

export const TOKEN_FAMILIES = {
  openai: { tool: 'gpt-tokenizer', encodings: ['o200k_base', 'cl100k_base'] }
};

export const TOKEN_DEFAULTS = { family: 'openai', encoding: 'o200k_base' };

/* Оценка без словаря. Коэффициент снят на текстах этого репозитория (русские
 * документы и код): `README.md` — 3,1 знака на токен, `WORKLOG.md` — около 3,0.
 * Для латиницы та же оценка завышает счёт (там примерно 4 знака на токен), поэтому
 * она и помечена приближением. */
export const CHARS_PER_TOKEN = 3;

/* Форматы, для которых счёт токенов смысла не имеет: картинка, шрифт или архив —
 * это байты, и токенизатор разберёт их как что угодно, а число выйдет случайным.
 * Список нужен, чтобы метрика сказала это словами, а не выдала такой счёт за
 * посчитанный. SVG в него не входит намеренно: это текст, и его токены осмысленны. */
export const BINARY_EXTS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.gz', '.tar', '.mp4', '.mp3', '.mov'
];

/* Словарь загружается один раз на кодировку: за ним стоят мегабайты таблиц, и
 * платить за них на каждом файле было бы нечем оправдать. */
const probed = new Map();

export function tokenizer(settings) {
  const encoding = (settings || TOKEN_DEFAULTS).encoding;
  if (probed.has(encoding)) return probed.get(encoding);
  const tool = loadOptional(TOKEN_FAMILIES[familyOf(settings)].tool + '/encoding/' + encoding);
  probed.set(encoding, tool);
  return tool;
}

function familyOf(settings) {
  const asked = (settings || TOKEN_DEFAULTS).family;
  return TOKEN_FAMILIES[asked] === undefined ? TOKEN_DEFAULTS.family : asked;
}

/* Счёт одного текста: словарём, если он есть, иначе оценкой. Оба ответа — число
 * условных единиц текста, и различает их не значение, а подпись метрики
 * (`accuracy`), поэтому выдача одного за другое невозможно. */
export function tokenCount(text, settings) {
  const { tool } = tokenizer(settings);
  if (tool === null) return estimate(text);
  return tool.encode(text).length;
}

/* Оценка по длине — единственное, что можно сказать без словаря. Знаки считаются
 * кодовыми точками: для не-ASCII это ближе к числу токенов, чем единицы UTF-16. */
export function estimate(text) {
  let chars = 0;
  for (const _ch of text) chars++;
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/* Форматы отчёта, для которых счёт идёт по байтам, а не по тексту: их и называет
 * подпись метрики. Считается по настройкам, как и список приближённых форматов у
 * минификатора, — чтобы подпись не могла разойтись с тем, что происходит. */
export function binaryFormats(cfg) {
  const exts = [];
  cfg.columns.forEach((col) => {
    col.paths.forEach((p) => {
      const ext = path.extname(p).toLowerCase();
      if (BINARY_EXTS.indexOf(ext) >= 0 && exts.indexOf(ext) < 0) exts.push(ext);
    });
  });
  return exts.sort();
}

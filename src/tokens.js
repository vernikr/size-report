import path from 'path';
import { loadOptional } from './optional.js';

/* The tokenizer follows the same discipline as the minifier: an optional dependency, loaded
 * lazily (how that works: `src/optional.js`). One difference: the tokenizer takes any text and
 * has nothing to refuse, so a missing dependency is not a refusal but a different count — an
 * estimate by length, named as such in the metric label.
 *
 * The family is about models, the encoding about the number: the same file counts differently
 * under `cl100k_base` and `o200k_base`, which is why the encoding is chosen next to the family
 * instead of being implied. There is one family here, and that is not an omission: the others
 * have no dictionary that could be called their own, and counting with someone else's while
 * calling it a family would promise what does not exist. */

export const TOKEN_FAMILIES = {
  openai: { tool: 'gpt-tokenizer', encodings: ['o200k_base', 'cl100k_base'] }
};

export const TOKEN_DEFAULTS = { family: 'openai', encoding: 'o200k_base' };

/* The estimate without a dictionary. The coefficient was taken from this repository's own
 * texts (Russian documents and code): `README.md` gave 3.1 characters per token, the archived
 * journal `worklog/archive/WORKLOG.md` about 3.0. For Latin script the same estimate overstates
 * the count (about 4 characters per token there), which is why the method says so in words. */
export const CHARS_PER_TOKEN = 3;

/* Formats for which counting tokens makes no sense: a picture, a font or an archive is bytes,
 * and the tokenizer would split them into anything at all, giving a random number. The list
 * exists so that the metric says this in words instead of passing such a count off as counted.
 * SVG is deliberately not here: it is text, and its tokens are meaningful. */
export const BINARY_EXTS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.gz', '.tar', '.mp4', '.mp3', '.mov'
];

/* A dictionary is loaded once per encoding: megabytes of tables stand behind it, and paying
 * for them on every file would have no justification. */
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

/* Counting one text: with the dictionary if there is one, by estimate otherwise. Both answers
 * are a number of text units, and what tells them apart is the metric label (`method`) rather
 * than the value, which is why one cannot be passed off as the other. */
export function tokenCount(text, settings) {
  const { tool } = tokenizer(settings);
  if (tool === null) return estimate(text);
  return tool.encode(text).length;
}

/* An estimate by length is all that can be said without a dictionary. Characters are counted
 * as code points: for non-ASCII that is closer to the number of tokens than UTF-16 units. */
export function estimate(text) {
  let chars = 0;
  for (const _ch of text) chars++;
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/* Whether the file is binary, since counting tokens means nothing for it. The list of formats
 * is owned here, so the metric label asks about a file here instead of keeping a list of its
 * own. */
export function isBinary(file) {
  return BINARY_EXTS.indexOf(path.extname(file).toLowerCase()) >= 0;
}

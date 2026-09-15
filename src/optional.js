import { createRequire } from 'module';

/* Optional dependencies: the minifier and the tokenizer. Missing ones are not a refusal but a
 * different count (a simplification instead of compression, an estimate instead of an exact
 * count), so their loading is shared and shaped the same way: lazy, synchronous
 * (`createRequire` — measuring is one synchronous pass, and `import()` would make the whole
 * chain asynchronous for the sake of a single sensor) and without an exception escaping —
 * unavailability comes back as an answer.
 *
 * The seam of their absence is the `SIZE_REPORT_NO_OPTIONAL` environment variable: the same
 * path serves an install without optional dependencies and a platform the package is not built
 * for. It is also how the tests check that the tool works without them. */

export const NO_OPTIONAL = 'SIZE_REPORT_NO_OPTIONAL';

/* The version is read from the package itself: the number depends on the dictionary and on the
 * algorithm, so it belongs in the method the value came from rather than staying inside
 * `node_modules`. */
export function loadOptional(spec) {
  if (process.env[NO_OPTIONAL]) {
    return { tool: null, version: null, why: 'необязательные зависимости выключены (' + NO_OPTIONAL + ')' };
  }
  const require = createRequire(import.meta.url);
  try {
    const tool = require(spec);
    const pkg = spec.split('/')[0];
    let version = null;
    try { version = require(pkg + '/package.json').version; } catch (_e) { version = null; }
    return { tool: tool, version: version, why: null };
  } catch (e) {
    return { tool: null, version: null, why: e.message };
  }
}

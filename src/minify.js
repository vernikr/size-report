import path from 'path';
import { loadOptional } from './optional.js';
import { refuseCause } from './refusal.js';

/* The real minifier is an optional dependency (how that works: `src/optional.js`); what lives
 * here is what only the minifier knows — which formats it takes and how a refusal is counted.
 *
 * A minifier refusal (the file did not parse) has to be an exception: the extension lied about
 * the content, and falling back to a simplification would silently substitute another
 * number. */

/* The extensions the minifier answers for. This table is the single source of truth both for
 * the measurement and for the metric label ("the other formats are an approximation"), so the
 * two cannot drift apart. JSX and TSX are not here: the output depends on the project's `jsx`
 * setting (`React.createElement` versus `react/jsx-runtime`), and measuring someone else's
 * decision about a runtime is not this tool's business — such files are honestly counted as a
 * simplification. */
export const MINIFY_LOADERS = {
  '.js': 'js', '.mjs': 'js', '.cjs': 'js',
  '.ts': 'ts', '.mts': 'ts', '.cts': 'ts',
  '.css': 'css'
};

let probed = null;

/* The probe answer is kept for the process: probing on every file would mean paying for it
 * thousands of times, while the answer does not depend on the file. */
export function minifier() {
  if (probed === null) probed = loadOptional('esbuild');
  return probed;
}

/* Compressing one text. The output settings are pinned rather than left at their defaults:
 * `charset: utf8` because what is measured is a UTF-8 file of the project (the default would
 * escape non-ASCII and the number would come out larger than the real one), `legalComments:
 * none` because every other strategy drops comments too and the number has to mean one thing
 * rather than two, and `sourcefile` for the reason inside a refusal. */
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
    // The advice names the one way out that answers this very cause: switching the minifier to
    // `strip` removes the cause but hands the same file to the `minify.guard` check, whose
    // verdict would be the same ("this is not JavaScript").
    refuseCause('minifier did not parse', 'esbuild did not parse ' + file + ' at '
      + rev.slice(0, 7) + ': ' + cause(e.message)
      + '\n  fix: the extension lied about its content or the minifier is older than the syntax;'
      + ' give this extension a simplification in minify.ext (for example {"' + ext + '": "strip-lines"})');
  }
}

/* The reason from esbuild spans several lines and its first line is "Transform failed with N
 * errors:"; the cause itself stands where the error starts. Without it a refusal would say
 * that something is wrong without saying what. */
function cause(text) {
  const lines = String(text).split('\n');
  const at = lines.findIndex((line) => line.indexOf('ERROR:') >= 0);
  return (at >= 0 ? lines[at] : lines[0]).trim();
}

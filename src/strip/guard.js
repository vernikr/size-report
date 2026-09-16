import path from 'path';
import vm from 'vm';
import { refuseCause } from '../refusal.js';
import { moduleError } from '../parse.js';

/* The stripper's guard: it may throw away nothing but comments and indentation, so its result
 * has to compile. Only the extensions whose content is valid JavaScript are checked (the list
 * is `minify.guard` in the settings): TypeScript or JSX are not checked by the host, and
 * pretending they were would be worse than not checking at all.
 *
 * The text, not the extension, decides between a module and a script: a project with a
 * bundler writes `import`/`export` straight into `.js` (with `type: module` in its manifest
 * and without it), while `vm.Script` parses such a file as a script and fails on the very
 * `export`. So the guard tries the shape the file looks like and accepts the result when
 * either of the two parses it. That does not weaken it: a real breakage parses neither way,
 * and then the reason reported is the one from the shape the file had.
 *
 * A module is parsed by a separate worker (`parse.js`), or the guard would cost a Node run per
 * cell: without it a config like `eslint.config.mjs` would stay unguarded, and an edit of it
 * could silently spoil the "volume" number.
 *
 * When even the original text does not parse, the stripper is not to blame: the cell holds
 * something other than JavaScript (TypeScript, JSX), and that is a refusal with a fix —
 * changing the settings. */

const MODULE_MARK = /^[ \t]*(?:import|export)\b/m;
const MODULE_EXT = ['.mjs'];

export function assertCompilable(min, rev, p, src) {
  // The script is tried first for its price rather than its shape: it parses in this
  // process, while a module goes to the worker.
  const asScript = scriptError(min, p);
  if (asScript === null) return;
  const asModule = moduleError(min);
  if (asModule === null) return;
  const shape = MODULE_EXT.indexOf(path.extname(p).toLowerCase()) >= 0 || MODULE_MARK.test(min);
  if (src !== undefined && scriptError(src, p) !== null && moduleError(src) !== null) {
    refuseCause('file is not JavaScript', 'the file ' + p + ' is not JavaScript: its source text parses'
      + ' neither as a script nor as a module, so the stripper is not to blame, while '
      + path.extname(p) + ' stands in minify.guard: ' + (shape ? asModule : asScript) + '\n'
      + '  fix: remove this extension from minify.guard or give it '
      + 'minify.ext — for example { "' + path.extname(p).toLowerCase() + '": "strip-lines" }');
  }
  // The reason comes from the parse the file actually was: blaming the other shape would
  // explain nothing.
  throw new Error('стриппер испортил ' + p + ' на ' + rev.slice(0, 7) + ': '
    + (shape ? asModule : asScript));
}

// Parsing as a script happens in this process: cheaper, and without temporary files.
function scriptError(text, p) {
  try {
    new vm.Script(text, { filename: p });
    return null;
  } catch (e) {
    return e.message;
  }
}

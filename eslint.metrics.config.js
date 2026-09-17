/* The bloat sensors: size and complexity, duplicated branches, the weight of the checks, debt markers.
 * Apart from `eslint.config.js`: that one is formatting (how a line looks), this one is sizes and
 * structure. The thresholds come from a measurement of the tree rather than from a guess — the table is in
 * the journal of that work (`worklog/archive/WORKLOG.md` §58.3, with the counts behind every figure).
 * Every figure there describes that day's tree, so it is re-taken (`pnpm run baseline:metrics`) rather than
 * quoted again here.
 *
 * The ratchet is `.eslint-suppressions.json`, and the leading dot is deliberate: a flagless ESLint run
 * reads its default suppressions location (the undotted name) next to its own config, and stale entries
 * there fail that run (measured on 9.39.5, exit code 2). What lies above a threshold today sits in the
 * file and is worked off gradually (`pnpm run metrics` stays green), while something new reddens at once.
 *
 * Run: `pnpm run metrics` (the gate); updating the ratchet is `pnpm run baseline:metrics` (a human action,
 * and the file is a gate file: without the `Gate-Change:` trailer the change cannot pass).
 *
 * Only real code is scanned — `src`, `bin`, `tools`, `test` (the paths are set by `tools/gates/run.js`).
 * The root configs are not collected by the sensors: the marker words and the thresholds themselves live in
 * this file, and it would be their first offender.
 *
 * Rejected while the sensors were set up (so that none of it is switched on again "to be stricter"):
 * `sonarjs/no-duplicate-string` — on the Russian refusal texts a repetition is part of the text rather than
 * a duplicate; `knip` (dead code), `ast-grep`, `size-limit`, the secrets scanners, an absolute coverage
 * threshold and mutation testing — the journal above gives the reason for each (§58.8).
 */

import sonarjs from 'eslint-plugin-sonarjs';

/* The debt terms live here rather than in a scanned file: otherwise the rule would find itself. The list
 * is the one `no-warning-comments` has by default, plus the Russian marker "отложено". */
const DEBT_TERMS = ['todo', 'fixme', 'xxx', 'hack', 'отложено'];

/* A walk over the tree with no listeners: needed inside one rule (a check's body) rather than at a file's
 * nodes. `parent` is skipped: it is only ever walked upwards. */
function walk(node, visit) {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  if (typeof node.type === 'string') visit(node);
  Object.keys(node).forEach((key) => { if (key !== 'parent') walk(node[key], visit); });
}

function isNamed(node, name) {
  return node !== null && node !== undefined && node.type === 'Identifier' && node.name === name;
}

/* A suite's check: `test(name, { … })` — the options object is the second argument — and the check
 * functions of `node:test` share the same names, so only `test(...)` is parsed; `describe` is not used in
 * this suite and is named by that silence rather than by a rule (a rule over something that does not exist
 * is decoration). */
function isTestCall(node) {
  return node.callee.type === 'Identifier' && node.callee.name === 'test'
    && node.arguments.length > 0;
}

function assertCalls(body) {
  let found = 0;
  walk(body, (node) => {
    if (node.type !== 'CallExpression') return;
    const callee = node.callee;
    if (isNamed(callee, 'assert')) found++;
    if (callee.type === 'MemberExpression' && isNamed(callee.object, 'assert')) found++;
  });
  return found;
}

/* A value without a comparison: `assert.ok(x)`, `assert(x)`, `assert.ok(true)` — such an assertion passes
 * on anything truthy and never says what was expected. */
function isWeakAssert(node) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  const bare = isNamed(callee, 'assert');
  const ok = callee.type === 'MemberExpression' && isNamed(callee.object, 'assert')
    && isNamed(callee.property, 'ok');
  if (!bare && !ok) return false;
  const first = node.arguments[0];
  if (first === undefined) return true;
  return first.type === 'Identifier' || (first.type === 'Literal' && typeof first.value === 'boolean');
}

/* A file's own helpers with an assertion inside: a check calling such a helper does assert in substance.
 * Without this the rule would hit sound checks (in this suite they call `refusal`,
 * `assertCatchesDiskEdit`, `moduleInJs`, `verify`), and false findings are exactly why gates get switched
 * off. A helper from another file (`tools/harness.js`) is invisible here: the rule sees one file. */
function assertingNames(program) {
  const named = [];
  const own = (node, name) => { if (assertCalls(node.body) > 0) named.push(name); };
  walk(program, (node) => {
    if (node.type === 'FunctionDeclaration' && node.id !== null) own(node, node.id.name);
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier'
        && node.init !== null && (node.init.type === 'ArrowFunctionExpression'
          || node.init.type === 'FunctionExpression')) own(node.init, node.id.name);
  });
  return named;
}

function callsAny(body, names) {
  let found = 0;
  walk(body, (node) => {
    if (node.type === 'CallExpression' && isNamed(node.callee, 'assert') === false
        && node.callee.type === 'Identifier' && names.indexOf(node.callee.name) >= 0) found++;
  });
  return found;
}

const local = {
  rules: {
    'assert-in-test': {
      meta: { type: 'problem', schema: [], messages: { none: 'a check with no assertion: the test asserts nothing' } },
      create(ctx) {
        let helpers = [];
        return {
          Program(node) { helpers = assertingNames(node); },
          CallExpression(node) {
            if (!isTestCall(node)) return;
            const fn = node.arguments.filter((a) => a.type === 'FunctionExpression'
              || a.type === 'ArrowFunctionExpression').pop();
            if (fn === undefined) return;
            if (assertCalls(fn.body) === 0 && callsAny(fn.body, helpers) === 0) {
              ctx.report({ node, messageId: 'none' });
            }
          }
        };
      }
    },
    'weak-assert': {
      meta: { type: 'problem', schema: [], messages: { weak: 'an assertion with no comparison: it passes on any correct value' } },
      create(ctx) {
        return {
          CallExpression(node) { if (isWeakAssert(node)) ctx.report({ node, messageId: 'weak' }); }
        };
      }
    },
    'no-skipped-test': {
      meta: { type: 'problem', schema: [], messages: { skipped: 'a check is switched off ("{{what}}"): the suite counts it as passed' } },
      create(ctx) {
        const ways = ['only', 'skip', 'todo', 'failing'];
        return {
          CallExpression(node) {
            const callee = node.callee;
            const on = (name) => callee.type === 'MemberExpression' && isNamed(callee.object, 'test')
              && isNamed(callee.property, name);
            const used = ways.find(on);
            if (used !== undefined) {
              ctx.report({ node, messageId: 'skipped', data: { what: 'test.' + used } });
              return;
            }
            if (!isTestCall(node)) return;
            node.arguments.forEach((arg) => {
              if (arg.type !== 'ObjectExpression') return;
              arg.properties.forEach((p) => {
                const key = p.key && p.key.name;
                if (ways.indexOf(key) >= 0 && p.value !== undefined && p.value.value === true) {
                  ctx.report({ node, messageId: 'skipped', data: { what: key + ': true' } });
                }
              });
            });
          }
        };
      }
    },
    'no-debt-marker': {
      meta: {
        type: 'problem',
        schema: [],
        messages: { marker: 'a debt marker ("{{term}}"): with no ratchet debt piles up in silence' }
      },
      create(ctx) {
        /* Comments are read through `sourceCode`, not through `Line`/`Block` listeners: a walk over the
         * nodes does not visit them — the first edition of this rule was silent for exactly that reason
         * (the rule was there, the finding was not), and the probe caught it at once. */
        return {
          'Program:exit'() {
            ctx.sourceCode.getAllComments().forEach((comment) => {
              const text = comment.value.toLowerCase();
              DEBT_TERMS.forEach((term) => {
                if (text.indexOf(term) >= 0) {
                  ctx.report({ node: comment, messageId: 'marker', data: { term: term } });
                }
              });
            });
          }
        };
      }
    }
  }
};

/* `reports/` is deliberately NOT ignored here, although the linter (`eslint.config.js`) and `.gitignore`
 * name it — and that is a condition of one probe rather than a disagreement. The probe of this sensor writes
 * a file with a deliberate violation into `reports/probe/`: a leftover of an interrupted run must be
 * invisible both to `git status` and to `lint:strict`. The sensor has to see the file, though: it is called
 * by an explicit path (`--paths`), and an ignore silences an explicit path too — with `reports/` here the
 * probe would go red on the ignore itself ("File ignored because of a matching ignore pattern") instead of
 * on the violation. The default walk (`src`, `bin`, `tools`, `test`) never gets there. */
export default [
  { ignores: ['node_modules/', 'fixtures/', '.freebuff/'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly', console: 'readonly', URL: 'readonly', Buffer: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', structuredClone: 'readonly',
        document: 'readonly', window: 'readonly'
      }
    },
    plugins: { sonarjs, local },
    linterOptions: { reportUnusedDisableDirectives: 'error', noInlineConfig: true },
    rules: {
      // Size and shape. Every threshold sits in the tail of the measured distribution rather than in its
      // middle: function length is cut at 60, above which the p98 tail of that measurement lay (its p50 7 /
      // p99 73 / max 118 belong to the table in `worklog/archive/WORKLOG.md` §58.3 and describe that day's
      // tree, not this one).
      complexity: ['error', 12],
      'max-lines-per-function': ['error', { max: 60 }],
      'max-statements': ['error', 30],
      'max-params': ['error', 5],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 5],
      'max-lines': ['error', { max: 450 }],
      'max-classes-per-file': ['error', 1],
      // Duplicated branches and copies of functions: token clones are `dup`'s business, this is what tokens
      // do not show (two identical branches are three lines).
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/cognitive-complexity': ['error', 15],
      // Debt: a marker in a comment with no ratchet behind it; suppressing a rule is itself a finding
      // (`noInlineConfig` below), or the gate could be silenced by one line.
      'local/no-debt-marker': 'error'
    }
  },
  {
    // The checks: a check has to assert something, a weak assertion is counted, and a switched-off check
    // must not be called (it is taken for passed).
    files: ['test/**/*.js'],
    rules: {
      'local/assert-in-test': 'error',
      'local/weak-assert': 'error',
      'local/no-skipped-test': 'error'
    }
  }
];

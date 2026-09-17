/* The package's linter. The rules are taken from the consumer project (`safe-resets/eslint.config.mjs`)
 * so that the module does not fight it over formatting, plus one mechanical rule against two statements
 * glued into one line: such a line has already slipped through while code was being moved — `} else {`
 * ended up on one line with the statement after it, and `indent` did not see it, because the line's
 * indentation stayed right.
 *
 * One-statement lines are ordinary here (`if (...) return;`, a `forEach` body of two statements), so there
 * is nothing to forbid several statements per line with: `max-statements-per-line` cuts the accepted style
 * and does not catch the gluing anyway — the statement on that line was a single one. The glue gives
 * itself away by a leftover extra space, and `no-multi-spaces` is what hits it.
 *
 * The configuration is flat (ESLint 9), and the file name is `.js`, not `.mjs`: the package is declared a
 * module (`"type": "module"`), so `.js` already is one here.
 *
 * What is linted: real code — `bin/`, `src/`, `tools/`, `test/` — the scripted measurements in `probes/`,
 * and the configuration files in the root. `fixtures/` and `reports/` are excluded: data lives in the first
 * (history bundles, the taken standards with their manifests) and machine-readable sensor output in the
 * second, and the package's rules do not apply to either.
 *
 * Run: `pnpm run lint` (advice, does not block) and `pnpm run lint:strict` (fails). The tree is expected
 * to yield zero findings: no baseline, no "switched it on and let it drown".
 */
export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        structuredClone: 'readonly'
      }
    },
    rules: {
      // A silent refusal cause is lost; write `catch (_e)` when the silence is deliberate.
      'no-unused-vars': ['warn', {
        args: 'none',
        varsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-undef': 'warn',
      'block-scoped-var': 'warn',
      // `==` is allowed against `null` only.
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      // Indentation is 2 spaces; the only rule counted as an error, and the one `pnpm exec eslint --fix`
      // repairs.
      indent: ['error', 2, { SwitchCase: 1 }],
      // Against that very gluing: it gives itself away by broken spacing between statements
      // (`} else {      const …`). Aligning an end-of-line comment with its neighbours is no break in the
      // code, so it is exempt.
      'no-multi-spaces': ['error', { ignoreEOLComments: true }]
    }
  },
  {
    // The page's program is the only thing running in a browser, and it is embedded into the assembled
    // page as **one script**: the chapters (`src/page/*.js`) share one scope, and only this way is that
    // visible to the linter.
    //
    // Hence two sets of names here: the browser itself and the little the chapters share. The shared names
    // are not a loophole but a record of fact: a click in the panel calls the three switches of the
    // assembly chapter, and the three circumstances of the first draw are brought up by the state chapter
    // and set by the assembly one. An import on these names would make a cycle (`deps`) that the assembled
    // page does not have: there it is one script, not references between modules.
    files: ['src/page/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        appSwitch: 'readonly',
        appSwitchGroup: 'readonly',
        appSwitchMetric: 'readonly',
        appStartup: 'writable',
        appForeign: 'writable',
        appTransient: 'writable'
      }
    }
  },
  {
    // `reports/` holds the sensors' machine reports (`tools/gates/`): they are in `.gitignore`, and the
    // linter has nothing to do there.
    ignores: ['node_modules/', '.freebuff/', 'fixtures/', 'reports/']
  }
];

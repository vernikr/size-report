import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { MAX_BUF, gitArgv, gitEnv } from './git.js';
import { advicePath, cliCommand, invocation, refuseCause } from './refusal.js';
import { LOCALES } from './locales.js';
import { METRICS, MINIFY_ENGINES } from './metrics.js';
import { TOKEN_DEFAULTS, TOKEN_FAMILIES } from './tokens.js';
import { CATEGORY_ORDER } from './data.js';
import { projectConfig } from './project.js';

/* The settings of a consumer project: defaults, reading and checking. Settings describe a project
 * rather than the mechanics, which is why the check lives right here, and no mode runs without it. */

export const CONFIG_NAME = 'size-table.config.json';

export const DEFAULT_CONFIG = {
  output: 'size-report.html',
  locale: 'en',
  title: '',          // by default: the heading from the locale
  heading: '',
  // The fix is a call that stays inside the project: the package name would send the reader to the registry,
  // which serves a revision the project never pinned.
  fixCommand: invocation() + ' --write',
  metrics: ['raw', 'min'],
  columns: [],
  // `engine` says what counts the `min` metric: stripping ballast (the default, and the one the
  // frozen fixtures were taken under) or real compression by the minifier.
  minify: { engine: 'strip', ext: {}, guard: ['.js', '.mjs', '.cjs'] },
  // Tokens: which dictionary counts them. The family is about models, the encoding about the number.
  tokens: Object.assign({}, TOKEN_DEFAULTS),
  // Hook automation: the hook rebuilds the report after every commit and installs itself — after the
  // package is installed (`bin/postinstall.js`) and on the first run in a project (`src/hook.js`);
  // this key is its switch (no `.size-report/…` state is needed: removing the hook returns the
  // project to its previous behaviour).
  hooks: { enabled: true },
  journal: null,
  links: { commitUrl: '' },
  // A merge is an ordinary commit: it carries the edits that resolved a conflict, and without a row
  // they would never reach the sum of deltas above the current size.
  rows: { merges: true, sha: true },
  skip: []
};

export function argValue(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const v = args[i + 1];
  return v === undefined || v.indexOf('--') === 0 ? '' : v;
}

export function gitRoot() {
  try {
    return execFileSync('git', gitArgv(['rev-parse', '--show-toplevel']), {
      encoding: 'utf8', maxBuffer: MAX_BUF, env: gitEnv()
    }).trim();
  } catch (e) {
    // Two dead ends with different fixes — "git did not start" and "there is no repository here" —
    // are told apart by what git itself said rather than by a guess: ENOENT means the program was not
    // found. One text for both ("not a git repository, or git is unavailable") named neither of them.
    if (e.code === 'ENOENT') {
      refuseCause('git missing', 'git did not start: it is not in PATH (the table is built from its'
        + ' history, and the directory I look in is ' + process.cwd() + ').\n'
        + '  fix: install git (https://git-scm.com) and run the command again');
    }
    refuseCause('not a git repository', 'git sees no repository here: the table is built from its'
      + ' history (the directory I look in is ' + process.cwd() + ').\n'
      + '  see: whether the command was run from the directory of the project\n'
      + '  fix: if there is no history yet, create it: git init');
  }
}

/* No settings file — the project derives them (`src/project.js`) and work starts at once: there is no
 * reason to create a file for a first run, and `--init` pins the derived ones to a file when someone
 * wants to edit them. This happens for the default name only: a file named by `--config` is already a
 * request for that very file, so its absence stays a refusal (otherwise a typo in the path would
 * silently yield someone else's settings). `path` is given in words rather than as a path: there is no
 * file, and "edit <path>" would lead the reader to something the project does not have. */
function derivedConfig(root) {
  const cfg = derivedProfile(root);
  cfg.path = 'derived from the project';
  cfg.derived = true;
  validateConfig(cfg);
  return cfg;
}

/* Derived from the project plus the defaults — what a project runs on without a file, and what
 * `--init` pins. One place for two roles (or "the file" and "work without a file" would drift by a
 * column or a number), while the deriving itself (`src/project.js`) knows nothing of the defaults: it
 * says only what it sees in the project. */
export function derivedProfile(root) {
  return withDefaults(projectConfig(root));
}

/* Settings on top of the defaults — one place for two sources (a file and the project): nested keys
 * are filled in by key, because `minify: {engine: …}` does not mean "`minify` has no other fields",
 * and reading it that way would lose the stripping's list of extensions. */
function withDefaults(raw) {
  const cfg = Object.assign({}, DEFAULT_CONFIG, raw);
  ['minify', 'tokens', 'hooks', 'links', 'rows'].forEach((key) => {
    cfg[key] = Object.assign({}, DEFAULT_CONFIG[key], raw[key]);
  });
  return cfg;
}

/* Settings are read as they are and filled in with the defaults: in a project that has just attached
 * the generator the config may be three lines long. */
export function loadConfig(file, root) {
  if (!fs.existsSync(file)) {
    // The advice names the very file in question: `--init` without a file would write a draft under the
    // default name in the project root — fixing something other than what was asked. The name is left
    // out exactly when it is the default one anyway.
    const dflt = root !== undefined && path.resolve(root, CONFIG_NAME) === path.resolve(file);
    if (dflt) return derivedConfig(root);
    refuseCause('no settings file', 'no settings file ' + file
      + '\n  create it: ' + cliCommand('--init ' + advicePath(file))
      + '\n  see: without "--config" no settings are needed — they are derived from the project');
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    refuseCause('settings not parsed', 'cannot parse ' + file + ': ' + e.message
      + '\n  fix: edit ' + file + '; a sample of settings comes from ' + cliCommand('--init') + ' in an empty directory');
  }
  const cfg = withDefaults(raw);
  cfg.path = file;
  validateConfig(cfg);
  return cfg;
}

/* Columns: a label and paths have to be names rather than anything at all — a path given as a number
 * or an object silently matches nothing, and the column reports zero rows as success. The refusal has
 * to happen here instead of turning into an empty report. */
function checkColumns(cfg, fail) {
  if (!cfg.columns || cfg.columns.length === 0) fail('no columns are given (columns)');
  const labels = new Set();
  cfg.columns.forEach((c, i) => {
    const pathsAreNames = c && Array.isArray(c.paths)
      && c.paths.length > 0 && c.paths.every((p) => typeof p === 'string' && p !== '');
    if (!c || typeof c.label !== 'string' || c.label === '' || !pathsAreNames) {
      fail('column #' + (i + 1) + ' has to be {label, paths: [...]} of non-empty strings: '
        + JSON.stringify(c).slice(0, 90) + '\n  see: a draft with ready columns comes from '
        + cliCommand('--init <file>'));
    }
    if (labels.has(c.label)) fail('the column label "' + c.label + '" repeats');
    if (c.category !== undefined && CATEGORY_ORDER.indexOf(c.category) < 0) {
      fail('the category "' + c.category + '" of the column "' + c.label + '" is unknown: '
        + CATEGORY_ORDER.join(', '));
    }
    labels.add(c.label);
  });
}

function checkMetrics(cfg, fail) {
  if (!Array.isArray(cfg.metrics) || cfg.metrics.length === 0) fail('no metrics are given (metrics)');
  cfg.metrics.forEach((m) => {
    if (!METRICS[m]) fail('unknown metric "' + m + '" (there are: ' + Object.keys(METRICS).join(', ') + ')');
  });
}

function checkMinify(cfg, fail) {
  if (MINIFY_ENGINES.indexOf(cfg.minify.engine) < 0) {
    fail('unknown minification engine "' + cfg.minify.engine + '" (there are: ' + MINIFY_ENGINES.join(', ') + ')');
  }
}

function checkTokens(cfg, fail) {
  const family = TOKEN_FAMILIES[cfg.tokens.family];
  if (family === undefined) {
    fail('unknown tokenizer family "' + cfg.tokens.family + '" (there are: '
      + Object.keys(TOKEN_FAMILIES).join(', ') + ')');
  }
  if (family.encodings.indexOf(cfg.tokens.encoding) < 0) {
    fail('unknown tokenizer encoding "' + cfg.tokens.encoding + '" of the family '
      + cfg.tokens.family + ' (there are: ' + family.encodings.join(', ') + ')');
  }
}

/* The report file cannot be a column of itself: the size of the artifact depends on the number of
 * rows, that is, on itself. */
function checkOutput(cfg, fail) {
  cfg.columns.forEach((c) => {
    if (c.paths.indexOf(cfg.output) >= 0) fail('the size table file (' + cfg.output + ') cannot be a column');
  });
  if (!cfg.output) fail('output is not set');
}

function checkJournal(cfg, fail) {
  if (!cfg.journal) return;
  if (!cfg.journal.path) fail('journal.path is not set');
  if (!cfg.journal.pattern) fail('journal.pattern is not set');
  try { new RegExp(cfg.journal.pattern); } catch (e) { fail('journal.pattern does not compile: ' + e.message); }
}

/* What the settings say about a path: `columns` — a column tracks it, `excluded` — it is declared an
 * exception (`skip` and the report file itself), `outside` — neither. One judgement for two answers:
 * `check` asks it about the whole history, `explain` about a single commit. Membership is counted over
 * all paths of a column rather than by its label: a column may have several paths (a rename), and any
 * of them is that column. */
export function pathRoles(cfg) {
  const tracked = new Set();
  cfg.columns.forEach((col) => col.paths.forEach((p) => tracked.add(p)));
  const excluded = new Set([cfg.output].concat(cfg.skip || []));
  return (file) => {
    if (tracked.has(file)) return 'columns';
    return excluded.has(file) ? 'excluded' : 'outside';
  };
}

/* The fix for "outside the columns" — one text for two answers, and it names the paths: a command
 * without names is no command. The text is assembled from the names rather than appending them per
 * branch, which is why nothing has to be guarded here: a commit with no files at all gets no fix — the
 * list being empty, nobody calls it (`fixFor` in `src/explain.js`). */
export function outsideFix(paths) {
  return 'add these paths as a column or to "skip" of ' + CONFIG_NAME + ': ' + paths.join(', ');
}

export function validateConfig(cfg) {
  const fail = (msg) => refuseCause('settings invalid',
    'config ' + cfg.path + ': ' + msg + '\n  fix: edit ' + cfg.path);
  checkColumns(cfg, fail);
  checkMetrics(cfg, fail);
  checkMinify(cfg, fail);
  checkTokens(cfg, fail);
  if (!LOCALES[cfg.locale]) fail('unknown locale "' + cfg.locale + '" (there are: ' + Object.keys(LOCALES).join(', ') + ')');
  // The hook switch is a yes/no rather than a truthy/falsy one: the tool has to tell `false` from a
  // stray string, or switched-off automation would stay switched on.
  if (typeof cfg.hooks.enabled !== 'boolean') {
    fail('hooks.enabled is not a yes/no: ' + JSON.stringify(cfg.hooks.enabled));
  }
  checkOutput(cfg, fail);
  checkJournal(cfg, fail);
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TOOL_PKG } from './tool.js';

/* Refusal and help: an exit code, a message carrying the command that fixes the problem,
 * and the `--help` text. It stands at the bottom of the chain — it knows neither the
 * settings nor git — which is why any module may call it. */

// ESM has no `__filename`, and `invocation()` needs the engine's own location: the path
// comes from `import.meta.url`.
const __filename = fileURLToPath(import.meta.url);

/* A refusal is an exit code and one line with the command that fixes it: an agent branches
 * on the code (the table is in `USAGE` below), a human reads the text. The stack is never
 * handed out — it holds no hint, only paths of the machine. */
export const EXIT = { OK: 0, VIOLATION: 1, CONFIG: 2, SHALLOW: 3, SENSOR: 4, INTERNAL: 5 };

export class Refusal extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function refuse(code, message) {
  throw new Refusal(code, message);
}

/* The causes of a code-2 refusal in one list, and this is the only place where they are
 * spelled out: the help prints them from it, the code table in `README.md` is checked
 * against it (`test/docs-commands.test.js`), and `refuseCause` lets no refusal through
 * without a named cause. So "the documentation says less than happens" cannot pass here
 * silently. The groups say where a cause comes from: the command line, settings and the
 * project, history, the hook, measurement. */
export const CONFIG_CAUSES = [
  ['command line', [
    'unknown flag', 'flag without a value', 'repeated flag', 'two modes at once',
    'extra word', 'command and mode', 'unknown command', 'incompatible flag',
    'no JSON answer', 'two answers at once', 'no commit'
  ]],
  ['settings and the project', [
    'no settings file', 'settings not parsed', 'settings invalid',
    'git missing', 'not a git repository', 'config already exists'
  ]],
  ['history', ['no such commit', 'ambiguous commit', 'commit outside the history']],
  ['hook', ['foreign hook', 'foreign core.hooksPath', 'no way to invoke the tool']],
  ['measurement', ['file is not JavaScript', 'minifier did not parse']]
];

/* A cause is a declared name, not decoration of the text: an undeclared one never reaches
 * the user, because that is a defect of the tool rather than a dead end for a human. */
export function refuseCause(cause, message) {
  if (!CONFIG_CAUSES.some((g) => g[1].indexOf(cause) >= 0)) {
    throw new Error('refusal cause is not declared: ' + cause);
  }
  refuse(EXIT.CONFIG, message);
}

/* The help lines about causes come from the same list, so the help cannot drift from the
 * checks. */
const CAUSE_LINES = CONFIG_CAUSES.map((g) => '  ' + g[0] + ': ' + g[1].join(' · '));

/* How the tool is called where it is read. The advice names what lies nearby and never the package
 * name: a path inside the project (`node node_modules/<name>/bin/size.js`) works where the package is
 * installed and, where it is not, refuses on the spot; the name from the registry would instead fetch
 * and run a revision the project never pinned (and the unscoped name there belongs to another package
 * altogether). One form, therefore, and no trip to the network.
 *
 * The fix command quotes the entry point rather than the engine itself: importing the
 * engine runs nothing, so `--init` works through the command only. Inside the package's own
 * repository the path is computed from the engine's location rather than from the current
 * directory — the message has to work from anywhere in the project. */
export function invocation() {
  const local = path.join('node_modules', TOOL_PKG.name, 'bin', 'size.js');
  if (fs.existsSync(path.resolve(process.cwd(), local))) return 'node ' + local;
  const bin = path.resolve(path.dirname(__filename), '..', 'bin', 'size.js');
  const shown = path.relative(process.cwd(), bin);
  return 'node ' + (shown === '' || shown.indexOf('..') === 0 ? bin : shown);
}

export function cliCommand(flag) {
  return invocation() + ' ' + flag;
}

/* A path inside a ready-made command: a space or a quote in it would break copying, so such
 * a path is quoted the way a shell would accept it. */
export function advicePath(p) {
  return /[\s"'$`\\]/.test(p) ? JSON.stringify(p) : p;
}

export const USAGE = [
  '@vernikr/size-report — a report on how the size of files grows commit by commit: one file,',
  'a self-contained page (the data, the styling and the program live inside it).',
  '',
  'Usage: ' + invocation() + ' [command] [mode] [flags]',
  '',
  'Commands:',
  '  check [--json]    completeness: settings, history, paths, sensors (code 1 — a path',
  '                    of the history is not tracked and is not declared an exception)',
  '  explain <commit>  why a commit got no row (a revision name, a sha or its beginning)',
  '  doctor [--json]   diagnostics in one answer: environment, dependencies, settings,',
  '                    coverage (code 0 — nothing to do, otherwise — the first by weight)',
  '  install-hook      install the post-commit and post-merge hooks (they install themselves',
  '                    on the first run in a project): the report is rebuilt after every',
  '                    commit and merge and, if it is in git, lands as a commit of its own',
  '  uninstall-hook    remove the hook and its state (the project goes back to what it was)',
  '  hook-run          what the hook calls: rebuild the report and commit it (never by hand)',
  '',
  'Modes:',
  '  --init [file]   pin the settings in a file (--force — overwrite an existing one)',
  '  --write [file]  build the report into a file from the settings (the directory is made)',
  '  --data          the contract data on stdout — for the report and for an agent',
  '  --json          the former shape of the data on stdout',
  '  (no mode)       check that the report matches the history',
  '',
  'Flags: --config <file> — other settings; --help — this help.',
  '',
  '--json is a shape of the answer rather than a mode of its own, and it has one rule: exactly',
  'four calls answer. Without a command it is the former shape of the data, with check, explain',
  'and doctor — theirs; the rest have no answer, and there --json is a refusal rather than silence.',
  '',
  'One run at a time: a command and a mode do not combine, a mode is alone too, and an extra word',
  'or an unknown flag is a refusal with a ready-made command rather than an ordinary run.',
  '',
  'Settings are not obligatory: without a file they are derived from the project itself',
  '(columns — from the path groups of the tree and the history, the journal and where to write —',
  'from there too), and the output says so. `--init` pins what was derived in a file — after that',
  'the file is edited; a file named by `--config` has to exist, and otherwise it is a refusal.',
  '',
  'Exit codes: 0 — all is well, 1 — a mismatch with the history or an incompleteness, 2 — the',
  'call, the settings or the environment, 3 — an incomplete history, 4 — no sensor, 5 — an',
  'internal error. doctor has an order of its own: 2, 3, 1, 4 — by the weight of a finding',
  'rather than by what came first.',
  '',
  'Causes of a code-2 refusal (the code table in README.md names them too):'
].concat(CAUSE_LINES, ['']).join('\n');

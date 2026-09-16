import { cliCommand, advicePath, refuseCause } from './refusal.js';

/* Command-line grammar: what the user named, and whether that combination is legal.
 *
 * One parse, at the entry, before the project is read. It settles everything at once —
 * which mode was asked for, whether it fits the command and the other flags, whether every
 * flag got a value, whether there are extra words — and answers with either a plan or a
 * refusal. That is why the order of branches in `main` decides nothing: "you cannot do
 * that" is a value, not a place in the code, and it surfaces in one way only — as a refusal
 * naming the culprit and the command that fixes it.
 *
 * Flags come in three kinds: modes (mutually exclusive — they say what to do), value flags
 * (they take the next argument) and switches. A command is the first word outside the
 * flags, so its position in the line does not matter: `size check --config x` and
 * `size --config x check` are the same.
 *
 * The file is separate from `cli.js` because the questions differ: here "what was asked and
 * may it be so", there "what to do about it". Hence the price of a wrong rule here — it
 * breaks every mode at once — and hence the checks split by subject, with the refusal
 * catalogue (`tools/refusals.js`) counting their sites in the sources and demanding a test
 * for each.
 */

const MODES = ['--init', '--write', '--data'];
const VALUE_FLAGS = ['--config', '--init', '--write'];
const FLAGS = ['--help', '-h'].concat(MODES, VALUE_FLAGS, ['--json', '--force']);
const COMMANDS = ['check', 'explain', 'doctor', 'install-hook', 'uninstall-hook', 'hook-run'];
const ANSWER_COMMANDS = ['check', 'explain', 'doctor'];
export const HOOK_COMMANDS = ['install-hook', 'uninstall-hook', 'hook-run'];

/* A value flag takes the next argument and reports how many it consumed. An empty value is
 * a legitimate "default" for `--init` and `--write`, but for `--config` it would be a
 * silent skip: the settings read would not be the ones the user named. */
function takeValue(flag, args, i, values) {
  const next = args[i + 1];
  const none = next === undefined || next[0] === '-';
  if (none && flag === '--config') {
    refuseCause('flag without a value', 'the flag "' + flag + '" has no value: a settings file is needed'
      + '\n  fix: ' + cliCommand(flag + ' <file>'));
  }
  values[flag] = none ? null : next;
  return none ? 0 : 1;
}

/* One pass over the line: words, modes, flag values. Refusals here are about a single flag
 * only (unknown, repeated, missing a value); combinations belong to `checkArgs`, because
 * they are about what was named together rather than about one argument. */
function scan(args) {
  const seen = new Set();
  const modes = [];
  const values = {};
  const words = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a[0] !== '-') { words.push(a); continue; }
    if (FLAGS.indexOf(a) < 0) {
      refuseCause('unknown flag', 'unknown flag "' + a + '"\n  fix: ' + cliCommand('--help'));
    }
    if (seen.has(a)) {
      refuseCause('repeated flag', 'the flag "' + a + '" is named twice\n  fix: ' + cliCommand('--help'));
    }
    seen.add(a);
    if (VALUE_FLAGS.indexOf(a) >= 0) i += takeValue(a, args, i, values);
    if (MODES.indexOf(a) >= 0) modes.push(a);
  }
  return { seen: seen, modes: modes, values: values, words: words };
}

/* The advice repeats the settings the user named: without it a command looks for the
 * default file name, does not find it in a project that named the file otherwise, and sends
 * the user into a second refusal — about a settings file they do not have. */
function advisor(values) {
  const given = typeof values['--config'] === 'string'
    ? '--config ' + advicePath(values['--config']) + ' ' : '';
  return (rest) => cliCommand(given + rest);
}

/* A mode against the flags: the modes exclude each other, and `--force` and `--config` do
 * not go with every one of them. */
function checkModes(plan) {
  const { modes, seen, mode, advice } = plan;
  if (modes.length > 1) {
    refuseCause('two modes at once', 'two modes at once: "' + modes[0] + '" and "' + modes[1]
      + '" — it is one mode' + '\n  fix: ' + advice(modes[0]));
  }
  if (seen.has('--force') && mode !== '--init') {
    refuseCause('incompatible flag', 'the flag "--force" works only with "--init"'
      + '\n  fix: ' + cliCommand('--init --force'));
  }
  if (seen.has('--config') && mode === '--init') {
    refuseCause('incompatible flag', '"--init" has a file of its own, while "--config" names the'
      + ' settings of the project' + '\n  fix: ' + cliCommand('--init <file>'));
  }
}

/* A word the command does not know. Its own question, because there are two possible
 * culprits: a typo in the command, or an extra value for a mode that already took one
 * (`--init` and `--write` take a single value). Either way the culprit has to be named: a
 * leftover after `--config` is the command itself, and its call is parsed as a command
 * rather than as an extra word. */
function checkUnknownWord(plan) {
  const { verb, values, advice } = plan;
  if (verb === null || COMMANDS.indexOf(verb) >= 0) return;
  const valued = MODES.find((f) => VALUE_FLAGS.indexOf(f) >= 0 && typeof values[f] === 'string');
  if (valued !== undefined) {
    refuseCause('extra word', 'the extra word "' + verb + '": "' + valued + '" takes one value'
      + '\n  fix: ' + advice(valued + ' ' + advicePath(values[valued])));
  }
  refuseCause('unknown command', 'unknown command "' + verb + '"\n  fix: ' + cliCommand('--help'));
}

/* A word and a mode together: the command says what to answer, the mode what to write, and
 * the two do not work at once. */
function checkWordAgainstMode(plan) {
  const { verb, mode, advice } = plan;
  if (verb === null || mode === null) return;
  refuseCause('command and mode', 'the command "' + verb + '" and the mode "' + mode
    + '" are different things and do not work together' + '\n  fix: ' + advice(verb));
}

/* How many words are accepted: `explain` takes exactly one commit and requires it, the
 * other commands take no argument at all. A missing commit and several commits are two
 * dead ends with one and the same fix. */
function checkWordCount(plan) {
  const { verb, arg, advice } = plan;
  if (verb === 'explain' && arg.length === 0) {
    refuseCause('no commit', 'the command "explain" needs a commit: a revision name (HEAD, a branch,'
      + ' a tag), a sha or its beginning'
      + '\n  fix: ' + advice('explain <commit>'));
  }
  if (verb === 'explain' && arg.length > 1) {
    refuseCause('extra word', 'the command "explain" takes one commit, not ' + arg.length
      + ': "' + arg.slice(1).join('", "') + '" are extra\n  fix: ' + advice('explain <commit>'));
  }
  if (verb !== null && verb !== 'explain' && arg.length > 0) {
    refuseCause('extra word', 'the command "' + verb + '" takes no arguments: "' + arg[0] + '" is extra'
      + '\n  fix: ' + advice(verb));
  }
}

/* The shape of the answer against everything else. `--json` is a shape, not a mode, and it
 * has one rule: exactly three commands and a bare run have an answer — the bare run is the
 * older data form, frozen by the parity fixture and therefore not removable. A command
 * without an answer has nothing to ask for, and a mode already has one answer, the write;
 * both are refusals, and each names its culprit. */
function checkAnswer(plan) {
  const { verb, mode, seen, advice } = plan;
  if (seen.has('--json') && verb !== null && ANSWER_COMMANDS.indexOf(verb) < 0) {
    refuseCause('no JSON answer', 'the command "' + verb + '" has no answer in JSON'
      + '\n  fix: ' + advice(verb));
  }
  if (seen.has('--json') && verb === null && mode !== null) {
    refuseCause('two answers at once', '"--json" and the mode "' + mode + '" are different: the data or'
      + ' the write, not both' + '\n  fix: ' + advice(mode));
  }
}

/* Combination checks, in groups over one plan: the plan holds what the parse already knows
 * (the word, the argument, the mode, the named flags and the advice), each group answers for
 * its own subject, and what comes back is a ready plan to run. */
function checkArgs(scanned) {
  const { words, seen, values, modes } = scanned;
  const plan = {
    verb: words.length > 0 ? words[0] : null,
    arg: words.slice(1),
    modes: modes,
    mode: modes.length > 0 ? modes[0] : null,
    seen: seen,
    values: values,
    advice: advisor(values)
  };
  checkModes(plan);
  checkUnknownWord(plan);
  checkWordAgainstMode(plan);
  checkWordCount(plan);
  checkAnswer(plan);
  return {
    verb: plan.verb,
    mode: plan.mode,
    arg: plan.arg,
    json: seen.has('--json'),
    force: seen.has('--force')
  };
}

export function parseArgs(args) {
  // Help always answers, and answers first: it is the way out of any typo.
  if (args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) return { help: true };
  const scanned = scan(args);
  return Object.assign({ help: false, values: scanned.values }, checkArgs(scanned));
}

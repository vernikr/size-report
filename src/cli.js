import path from 'path';
import { EXIT, Refusal, USAGE, cliCommand } from './refusal.js';
import { CONFIG_NAME, gitRoot, loadConfig } from './config.js';
import { HOOK_COMMANDS, parseArgs } from './args.js';
import { initMode } from './init.js';
import { derivedLines } from './project.js';
import { autoInstall } from './hook.js';
import {
  checkMode, coverageMode, dataMode, doctorMode, explainMode, hookMode, jsonMode, writeMode
} from './modes.js';

/* The tool's entry point: parse the line, read the project, hand the request to a mode.
 *
 * Neither the grammar (`src/args.js`) nor the modes (`src/modes.js`) nor pinning the
 * settings (`src/init.js`) is left here — only what makes this an entry point at all:
 * where the project root comes from, how the settings file is named, and how a refusal
 * turns into an exit code. Saying out loud that there is no settings file and the settings
 * were derived from the project belongs here as well: that holds for every mode, not for
 * one of them.
 */

/* Request runners: the key is what the request is called (a command or a mode), and "a
 * bare run" is the empty string. The parser has already checked the combinations, so this
 * is a lookup with a runner for every name, not a decision. */
const RUNNERS = {
  check: (c, x) => coverageMode(x.cfg, x.root, x.configFile, c.json),
  explain: (c, x) => explainMode(x.cfg, x.root, c.arg[0], c.json),
  '--data': (c, x) => dataMode(x.cfg, x.root),
  '--write': (c, x) => writeMode(x.cfg, x.root, c.values['--write']),
  '': (c, x) => (c.json ? jsonMode(x.cfg, x.root) : checkMode(x.cfg, x.root))
};

const asked = (cmd) => (cmd.verb === null ? (cmd.mode === null ? '' : cmd.mode) : cmd.verb);

/* Installing the hook without being asked belongs here, not in `doctor` (which only
 * reports) and not in `hook-run` (which is called from an already installed hook). It
 * installs once per clone, says so, and is silent afterwards: the report is rebuilt after
 * every commit with no manual step (design and limits: `src/hook.js`). */
function ensureHook(root, cfg) {
  const files = autoInstall(root, cfg);
  if (files === null) return;
  console.error('· hook installed: ' + files.join(', ') + ' — the report is rebuilt after every'
    + ' commit (remove it: ' + cliCommand('uninstall-hook') + ')');
}

/* Delivery. Diagnostics and the hook answer before the settings are read: they need the
 * environment rather than the whole project, and refusing them over settings would be
 * wrong — the settings are exactly what they report about. */
function deliver(cmd, base) {
  if (cmd.verb === 'doctor') return doctorMode(base.root, base.configFile, cmd.json);
  if (HOOK_COMMANDS.indexOf(cmd.verb) >= 0) return hookMode(cmd.verb, base.root, base.configFile);
  const ctx = { root: base.root, configFile: base.configFile, cfg: loadConfig(base.configFile, base.root) };
  // The note goes to stderr: `--json` and `--data` own stdout, and mixing a story about
  // the settings into data would break parsing.
  if (ctx.cfg.derived) derivedLines(ctx.cfg).forEach((line) => console.error(line));
  ensureHook(base.root, ctx.cfg);
  return RUNNERS[asked(cmd)](cmd, ctx);
}

export function main() {
  try {
    const cmd = parseArgs(process.argv.slice(2));
    if (cmd.help) {
      process.stdout.write(USAGE);
      return EXIT.OK;
    }
    const root = gitRoot();
    if (cmd.mode === '--init') return initMode(root, cmd.values['--init'], cmd.force);
    const named = cmd.values['--config'];
    const configFile = named ? path.resolve(named) : path.join(root, CONFIG_NAME);
    return deliver(cmd, { root: root, configFile: configFile });
  } catch (e) {
    if (e instanceof Refusal) {
      console.error('✗ ' + e.message);
      return e.code;
    }
    // Unexpected failures are a defect of the tool, not a dead end for the user, and the
    // text says so — otherwise the user looks for the mistake on their side. The stack is
    // printed whole: nothing else can diagnose such a refusal.
    console.error('✗ internal error (this is a defect of the tool, not of the project —'
      + ' please send this text whole):\n' + e.stack);
    return EXIT.INTERNAL;
  }
}

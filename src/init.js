import fs from 'fs';
import path from 'path';
import { CONFIG_NAME, derivedProfile, validateConfig } from './config.js';
import { advicePath, cliCommand, refuseCause } from './refusal.js';
import { writeFileEnsured } from './artifact.js';
import { packageManager } from './project.js';

/* Pinning the settings to a file (`--init`): what the project derived about itself
 * (`src/project.js`) is written where the next run will meet it.
 *
 * A module of its own, separate from deriving the profile: that one looks at the project for the first
 * time and guesses about almost everything, while this one does a single thing — puts the result into
 * a file and says what it wrote. It has one strict requirement of itself: **what was pinned has to
 * pass the very check the first run will apply**, or the advice leads a person into a new dead end.
 */

/* What to say after writing: what was written, what counts the same numbers when the optional
 * dependency is missing, and what to do
 * next. The lines are assembled into a list rather than printed as they come, so that "what was said"
 * can be read as a whole. */
function draftLines(root, target, cfg) {
  const hasPkg = fs.existsSync(path.join(root, 'package.json'));
  const manager = packageManager(root);
  return [
    '✓ settings derived from the project and pinned: ' + path.relative(root, target),
    '  columns: ' + cfg.columns.length + ' (' + cfg.columns.map((c) => c.label).slice(0, 6).join(', ')
      + (cfg.columns.length > 6 ? ', …' : '') + ')',
    '  paths skipped: ' + cfg.skip.length + ' (the report itself, dependency locks, maps, build output)',
    '  metric min: real compression (esbuild); without it — an honest simplification and code 4',
    '  metric tok: the o200k_base dictionary (gpt-tokenizer); without it — an estimate by length and code 4',
    '  journal: ' + (cfg.journal === null ? 'not found — row links will carry no sections' : cfg.journal.path),
    '  next: edit the columns and the metrics — which files matter is known by the project alone',
    '          ' + (hasPkg
      ? 'add "sizes": "size --write" to package.json — then the report will be built by '
        + manager + ' run sizes (the check — without --write)'
      : 'run: ' + cfg.fixCommand + ' (the check — without --write)'),
    '          ' + (hasPkg ? 'add ' + manager + ' run test:sizes to CI' : 'add the check to CI')
      + '; the check is the package\'s command, it brings no files of its own into the project'
  ];
}

/* An empty profile is a note rather than a refusal: the work was done, and nobody will pick the columns
 * for the person. Hence "!", not the cross: a mark and an exit code must not say different things (the
 * refusal catalogue counts a cross as a refusal and a note as not one). */
function noteNoColumns(root, target, cfg) {
  if (cfg.columns.length > 0) return;
  console.error('! no paths in the project could be taken as columns'
    + ' (the history is empty or holds no familiar extensions): the draft is written without columns'
    + '\n  write them by hand into ' + path.relative(root, target)
    + ' — without columns the settings check will say "no columns are given (columns)"');
}

export function initMode(root, file, force) {
  const target = file ? path.resolve(root, file) : path.join(root, CONFIG_NAME);
  if (fs.existsSync(target) && !force) {
    // The advice names the very file in question: `--init --force` without a file would overwrite the
    // default name with a draft rather than the file the person named.
    const name = file === undefined || file === null ? CONFIG_NAME : advicePath(file);
    refuseCause('config already exists', 'config already exists: ' + target
      + '\n  fix: edit it or overwrite it with a draft: ' + cliCommand('--init ' + name + ' --force'));
  }
  // What is pinned is the very thing the project runs on without a file (the project's derivation on
  // top of the defaults), and it has to pass the same check the run will apply: the path in a refusal
  // text is the file it landed in. "Derived" and that path are not written to the file: they are
  // properties of where the settings came from rather than of the settings.
  const cfg = derivedProfile(root);
  if (cfg.columns.length > 0) validateConfig(Object.assign({}, cfg, { path: target }));
  const written = Object.assign({}, cfg);
  delete written.path;
  delete written.derived;
  writeFileEnsured(target, JSON.stringify(written, null, 2) + '\n');
  noteNoColumns(root, target, cfg);
  draftLines(root, target, cfg).forEach((line) => console.log(line));
  return 0;
}

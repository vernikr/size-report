import fs from 'fs';
import path from 'path';
import { reportData } from './data.js';
import { pageHtml } from './page/build.js';

/* The report is one file: a self-sufficient page. It is the artifact because it carries everything itself
 * (data, styling, program), and a second form of the same report does not exist: two outputs of one history
 * would drift apart silently, with nothing to tell which of them is right.
 *
 * Both consumers pass through here — the writing mode (`--write`) and the hook after a commit
 * (`src/hook.js`), so "what went into the file" cannot drift between them: the hook commits exactly the bytes
 * `--write` shows.
 *
 * The directory is created here as well: `--write docs/size-report.html` in a fresh project is an ordinary run
 * rather than a user's mistake. The settings draft (`--init`) is written the same way, which is why there is one
 * such place in the package. */

/* Writing a file while creating the directory: not a single part of the path may exist, and that is not a
 * mistake of whoever named it. */
export function writeFileEnsured(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/* The report's bytes built without writing: the check needs them too (it compares the file on disk with exactly
 * these bytes and reports it as diverging from the history), and building them a second way would compare
 * something other than what gets written. */
export function artifact(cfg, root) {
  const data = reportData(cfg, root);
  return { data: data, html: pageHtml(data, cfg), file: path.join(root, cfg.output) };
}

export function rebuild(cfg, root) {
  const out = artifact(cfg, root);
  writeFileEnsured(out.file, out.html);
  return out;
}

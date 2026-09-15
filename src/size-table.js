/* Size of files by commit — the portable generator.
 *
 * A row is a commit, a column is a file, a cell is the change against the previous commit
 * for one metric; absolute sizes appear once, in the top "now" row, or a large number
 * would repeat in every row and the columns would run off the screen.
 *
 * The source of truth is git itself: sizes come from the blobs of the commits, not from
 * the working tree, so the table does not depend on what is open in an editor, and it is
 * rebuilt from the whole history rather than appended to — an incremental file would have
 * to be repaired after any change to an old number.
 *
 * **Project matters in the config, mechanics in the package.** The engine knows neither
 * the file names of the project nor the name of its journal nor the language of the
 * labels: columns, metrics, journal, locale and output path all live in
 * `size-table.config.json` next to the repository root (`--config` names another path).
 * That is why the package can be attached to a new project as a dependency, and why
 * `size --init` can draft a config there (which extensions the project has, where its
 * journal is, where to write), to be edited by eye afterwards.
 *
 * A commit gets a row when it moved at least one number, merges included: a merge is
 * diffed against its first parent, so its edits show both in the row and in the carried
 * state. No row goes to a commit that touched only the report itself (or anything else
 * listed in `skip`) — a row about a commit cannot live inside that commit, whose sha is
 * unknown while it is being built, and that is why a rebuilt report is a commit of its
 * own — nor to a commit whose cells all came out zero (a merge resolved into exactly what
 * the branch already gave): a row without a single number reads as a breakdown. Hence the
 * requirement on the config: the columns must cover everything a commit can change,
 * because a commit outside the columns would give such a row, while an empty cell already
 * means "the file is not in that revision yet". With `rows.sha: false` the same invariant
 * serves the other strategy — rebuild and amend into the same commit — because without
 * the sha the artifact becomes a fixed point.
 *
 * One report: a single self-contained page holding the data, the styling and the program.
 * A second form of the same report does not exist on purpose — two outputs of one history
 * would diverge silently, with nothing to tell which one is right.
 *
 * The full history is required: on a shallow clone it refuses instead of silently writing
 * a short table (`fetch-depth: 0` in CI). Modes and exit codes: `size --help`.
 */

/* The entry point of the package, and nothing else: no computation here, only re-exports.
 * The mechanics are laid out along the seams visible in the imports. The public API is a
 * frozen list — `test/api.test.js` does not let it shrink. */
export { main } from './cli.js';
export { initMode } from './init.js';
export { sniffColumns } from './project.js';
export { check, dataMode, writeMode } from './modes.js';
export { reportData, categoryOf, CATEGORY_EXTS, CATEGORY_ORDER } from './data.js';
export { measureHistory } from './history.js';
export { pageHtml, pageScript, pageSource, stripModules, esc } from './page/build.js';
export { measureBlob, METRICS } from './metrics.js';
export { minifyForm, strategyFor, stripCss, stripHtml, stripJs, stripLines, compactJson,
  STRATEGIES } from './strip.js';
export { parseSections, touchedSection, anchor, sectionLink, rowHref } from './journal.js';
export { argValue, gitRoot, loadConfig, validateConfig, CONFIG_NAME, DEFAULT_CONFIG } from './config.js';
export { assertFullHistory, blobAt, readBlobs, readHistory } from './git.js';
export { LOCALES } from './locales.js';
export { EXIT, Refusal, refuse, cliCommand, USAGE } from './refusal.js';
export { cellParts, commitParts, deltaOf, group, nowModel, rowModel, totalsOf, valueParts } from './derived.js';

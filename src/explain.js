import { assertFullHistory, readHistory, resolveCommit } from './git.js';
import { measureHistory } from './history.js';
import { cliCommand, refuseCause } from './refusal.js';
import { outsideFix, pathRoles } from './config.js';

/* Why a commit has no row — the answer to one question about one commit.
 *
 * The answer is built on the same run as the report itself: the reason comes from the engine rather than
 * being derived here anew, or two answers about one commit would drift apart. But the engine has one reason
 * for two cases ("no change in volume" covers both "the numbers did not move" and "not a single column
 * file"), because the report does not need that difference; here it is the whole question, so the reason is
 * joined by evidence — which files the commit touched and which of them are columns, what is excluded, and
 * what is not tracked at all. The evidence comes from the same facts (the commit's list of changed paths),
 * so it cannot be invented: what the history does not hold, the answer is silent about. */

const REASON_TEXT = {
  merge: 'the commit is a merge, and the rows of merges are hidden by the setting "rows.merges: false"',
  report: 'only the report itself was touched (and what "skip" lists)',
  outside: 'no file of the commit is tracked by a column',
  flat: 'the numbers did not move: column files were touched, and the volume did not change'
};

/* A commit by name. git resolves a revision name, and only when there is no such name do we look up a sha
 * prefix in the list of commits: that way an ambiguous prefix keeps a human refusal listing the candidates,
 * while a name follows git's rules rather than ours. */
function lookup(root, commits, target) {
  const resolved = resolveCommit(root, String(target));
  const needle = String(target).toLowerCase();
  const found = resolved === null
    ? commits.filter((c) => c.sha.toLowerCase().indexOf(needle) === 0)
    : commits.filter((c) => c.sha === resolved);
  // The name resolved and the commit is missing from the report: that is not "no such commit" — the commit
  // exists, and exactly that has to be said, or the person goes looking for a problem in the history.
  if (resolved !== null && found.length === 0) {
    refuseCause('commit outside the history', '"' + target + '" is the commit ' + resolved.slice(0, 7)
      + ', but it is not in the history of the report: rows are built over the commits of the current branch'
      + '\n  fix: look at the history of the report: git log --oneline'
      + ' (the whole history of the repository is shown by git log --all)');
  }
  if (found.length === 0) {
    refuseCause('no such commit', '"' + target + '" is not a revision name and not the start of a sha'
      + '\n  fix: look at the history: git log --oneline');
  }
  if (found.length > 1) {
    refuseCause('ambiguous commit', 'the prefix "' + target + '" is ambiguous: ' + found.length + ' commits fit'
      + '\n  ' + found.slice(0, 5).map((c) => c.sha.slice(0, 7) + ' ' + c.subject).join('\n  ')
      + '\n  fix: name more characters');
  }
  return found[0];
}

/* The evidence: what the commit touched — columns, excluded, past the columns. The judgement about a path's
 * role is one and lives with the settings (`pathRoles`); here it is only sorted into buckets by that
 * answer. */
function touchedOf(cfg, files) {
  const role = pathRoles(cfg);
  const touched = { columns: [], excluded: [], untracked: [] };
  const into = { columns: touched.columns, excluded: touched.excluded, outside: touched.untracked };
  files.forEach((f) => {
    const bucket = into[role(f)];
    if (bucket.indexOf(f) < 0) bucket.push(f);
  });
  return touched;
}

const FIX = {
  merge: 'turn on the rows of merges: "rows": { "merges": true }',
  report: 'not needed: a row about the commit cannot lie inside that very commit — update the report separately',
  flat: 'not needed: the volume did not change — a row without a single number would read as a breakage'
};

/* The fix by reason. For "past the columns" it is one text for two answers (`outsideFix`) and names the
 * paths. For a commit with no files (`--allow-empty`) there is nothing to name — so there is no fix at all
 * rather than a command without names, and this branch is what holds that case. */
function fixFor(reason, touched) {
  if (reason === 'outside') {
    return touched.untracked.length === 0 ? null : outsideFix(touched.untracked);
  }
  return FIX[reason];
}

export function explainCommit(cfg, root, target) {
  assertFullHistory(root);
  const commits = readHistory(root);
  const c = lookup(root, commits, target);
  const measured = measureHistory(cfg, root, commits);
  const row = measured.rows.findIndex((r) => r.sha === c.sha);
  const dropped = measured.dropped.find((d) => d.sha === c.sha);
  const touched = touchedOf(cfg, c.files);

  /* The difference the report's row does not carry: "no change in volume" means something else for a commit
   * past the columns than for one that touched a column. */
  let reason = row >= 0 ? null : dropped.reason;
  if (reason === 'flat' && touched.columns.length === 0) reason = 'outside';
  const fix = fixFor(reason, touched);

  return {
    schema: 1,
    sha: c.sha,
    subject: c.subject,
    when: c.when,
    row: row < 0 ? null : row + 1,
    rows: measured.rows.length,
    reason: reason,
    touched: touched,
    fix: fix === undefined ? null : fix
  };
}

/* A refusal here reaches a person as text and an agent as a field: "there is a row" and "there is no row"
 * are equally successful answers, hence exit code 0 for both. */
export function explainText(rep) {
  const lines = [];
  const where = '  commit ' + rep.sha.slice(0, 7) + ' "' + rep.subject.slice(0, 60) + '"';
  if (rep.row !== null) {
    lines.push('✓ the row is there: ' + rep.row + ' of ' + rep.rows + ' — the volume changed');
  } else {
    lines.push('— no row needed: ' + REASON_TEXT[rep.reason]);
  }
  lines.push(where);
  if (rep.touched.columns.length > 0) lines.push('  columns touched: ' + rep.touched.columns.join(', '));
  if (rep.touched.excluded.length > 0) lines.push('  excluded by the settings: ' + rep.touched.excluded.join(', '));
  if (rep.touched.untracked.length > 0) {
    lines.push('  past the columns and the exceptions: ' + rep.touched.untracked.join(', ')
      + ' — the coverage check answers for this: ' + cliCommand('check'));
  }
  if (rep.fix !== null) lines.push('  fix: ' + rep.fix);
  return lines.join('\n');
}

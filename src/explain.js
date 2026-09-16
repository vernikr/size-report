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
  merge: 'коммит — слияние, а строки слияний скрыты настройкой «rows.merges: false»',
  report: 'тронут только сам отчёт (и то, что перечислено в «skip»)',
  outside: 'ни один файл коммита не отслеживается колонкой',
  flat: 'числа не сдвинулись: файлы колонок тронуты, а объём не изменился'
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
    refuseCause('commit outside the history', '«' + target + '» — это коммит ' + resolved.slice(0, 7)
      + ', но его нет в истории отчёта: строки строятся по коммитам текущей ветки'
      + '\n  починка: посмотрите историю отчёта: git log --oneline'
      + ' (всю историю репозитория показывает git log --all)');
  }
  if (found.length === 0) {
    refuseCause('no such commit', '«' + target + '» — не имя ревизии и не начало sha'
      + '\n  починка: посмотрите историю: git log --oneline');
  }
  if (found.length > 1) {
    refuseCause('ambiguous commit', 'префикс «' + target + '» неоднозначен: подходят '
      + found.length + ' коммитов'
      + '\n  ' + found.slice(0, 5).map((c) => c.sha.slice(0, 7) + ' ' + c.subject).join('\n  ')
      + '\n  починка: назовите больше знаков');
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
  merge: 'включите строки слияний: "rows": { "merges": true }',
  report: 'не требуется: строка про коммит не может лежать внутри самого коммита — обновляйте отчёт отдельным коммитом',
  flat: 'не требуется: числа не изменились — строка без единого числа читалась бы как поломка'
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
  const where = '  коммит ' + rep.sha.slice(0, 7) + ' «' + rep.subject.slice(0, 60) + '»';
  if (rep.row !== null) {
    lines.push('✓ строка есть: ' + rep.row + '-я из ' + rep.rows + ' — объём изменился');
  } else {
    lines.push('— строка не нужна: ' + REASON_TEXT[rep.reason]);
  }
  lines.push(where);
  if (rep.touched.columns.length > 0) lines.push('  тронуты колонки: ' + rep.touched.columns.join(', '));
  if (rep.touched.excluded.length > 0) lines.push('  исключено настройками: ' + rep.touched.excluded.join(', '));
  if (rep.touched.untracked.length > 0) {
    lines.push('  мимо колонок и исключений: ' + rep.touched.untracked.join(', ')
      + ' — за это отвечает проверка полноты: ' + cliCommand('check'));
  }
  if (rep.fix !== null) lines.push('  починка: ' + rep.fix);
  return lines.join('\n');
}

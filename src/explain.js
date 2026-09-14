import { assertFullHistory, readHistory, resolveCommit } from './git.js';
import { measureHistory } from './history.js';
import { cliCommand, refuseCause } from './refusal.js';
import { CONFIG_NAME } from './config.js';

/* Почему у коммита нет строки — ответ на конкретный вопрос про конкретный коммит.
 *
 * Ответ строится на том же проходе, что и сам отчёт: причина берётся у движка, а
 * не выводится здесь заново, — иначе два ответа о том же коммите разошлись бы. Но
 * причина у движка одна на два случая («без изменения объёма» — это и «числа не
 * сдвинулись», и «ни одного файла колонок»), потому что отчёту эта разница не
 * нужна; здесь она и есть суть вопроса, поэтому к причине добавляются улики —
 * какие файлы коммит тронул и что из них колонки, что исключено, а что не
 * отслеживается вовсе. Улики читаются из тех же фактов (список изменённых путей
 * коммита), так что выдумать их нельзя: чего нет в истории — о том молчание. */

const REASON_TEXT = {
  merge: 'коммит — слияние, а строки слияний скрыты настройкой «rows.merges: false»',
  report: 'тронут только сам отчёт (и то, что перечислено в «skip»)',
  outside: 'ни один файл коммита не отслеживается колонкой',
  flat: 'числа не сдвинулись: файлы колонок тронуты, а объём не изменился'
};

export function explainCommit(cfg, root, target) {
  assertFullHistory(root);
  const commits = readHistory(root);
  /* Имя ревизии разрешает git, и только если имени нет — ищем начало sha по
   * списку коммитов: так у неоднозначного префикса остаётся человеческий отказ
   * со списком подходящих, а у имени — правила git, а не наши. */
  const resolved = resolveCommit(root, String(target));
  const needle = String(target).toLowerCase();
  const found = resolved === null
    ? commits.filter((c) => c.sha.toLowerCase().indexOf(needle) === 0)
    : commits.filter((c) => c.sha === resolved);
  // Имя разрешилось, а коммита в отчёте нет: это не «нет коммита» — коммит есть,
  // и сказать надо именно это, иначе человек пойдёт искать проблему в истории.
  if (resolved !== null && found.length === 0) {
    refuseCause('коммит вне истории', '«' + target + '» — это коммит ' + resolved.slice(0, 7)
      + ', но его нет в истории отчёта: строки строятся по коммитам текущей ветки'
      + '\n  починка: посмотрите историю отчёта: git log --oneline'
      + ' (всю историю репозитория показывает git log --all)');
  }
  if (found.length === 0) {
    refuseCause('нет такого коммита', '«' + target + '» — не имя ревизии и не начало sha'
      + '\n  починка: посмотрите историю: git log --oneline');
  }
  if (found.length > 1) {
    refuseCause('коммит назван неточно', 'префикс «' + target + '» неоднозначен: подходят '
      + found.length + ' коммитов'
      + '\n  ' + found.slice(0, 5).map((c) => c.sha.slice(0, 7) + ' ' + c.subject).join('\n  ')
      + '\n  починка: назовите больше знаков');
  }
  const c = found[0];
  const measured = measureHistory(cfg, root, commits);
  const row = measured.rows.findIndex((r) => r.sha === c.sha);
  const dropped = measured.dropped.find((d) => d.sha === c.sha);

  const tracked = new Set();
  cfg.columns.forEach((col) => col.paths.forEach((p) => tracked.add(p)));
  const excluded = new Set([cfg.output].concat(cfg.skip || []));
  const touched = { columns: [], excluded: [], untracked: [] };
  c.files.forEach((f) => {
    if (tracked.has(f)) { if (touched.columns.indexOf(f) < 0) touched.columns.push(f); return; }
    if (excluded.has(f)) { if (touched.excluded.indexOf(f) < 0) touched.excluded.push(f); return; }
    if (touched.untracked.indexOf(f) < 0) touched.untracked.push(f);
  });

  /* Разница, которой нет в строке отчёта: «без изменения объёма» у коммита мимо
   * колонок означает не то же самое, что у коммита, тронувшего колонку. */
  let reason = row >= 0 ? null : dropped.reason;
  if (reason === 'flat' && touched.columns.length === 0) reason = 'outside';

  const fix = {
    merge: 'включите строки слияний: "rows": { "merges": true }',
    report: 'не требуется: строка про коммит не может лежать внутри самого коммита — обновляйте отчёт отдельным коммитом',
    outside: 'допишите ' + (touched.untracked.length > 0 ? 'эти пути' : 'тронутые файлы')
      + ' колонкой или в «skip» файла ' + CONFIG_NAME,
    flat: 'не требуется: числа не изменились — строка без единого числа читалась бы как поломка'
  }[reason];

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

/* Отказ для объяснения даётся человеку текстом, а агенту — полем: «есть строка» и
 * «нет строки» одинаково успешные ответы, поэтому код выхода 0 у обоих. */
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

import { assertFullHistory, readHistory } from './git.js';
import { measureHistory } from './history.js';
import { sensorGaps } from './metrics.js';
import { CONFIG_NAME } from './config.js';
import { cliCommand } from './refusal.js';

/* Полнота покрытия — ответ на вопрос «всё ли в истории попало в отчёт». Правило
 * из требований (§4.2) одно: каждый путь, тронутый историей, обязан быть либо
 * колонкой, либо объявленным исключением (`skip` и сам файл отчёта), а путь,
 * который не то и не другое, — это нарушение: изменение прошло мимо отчёта.
 *
 * Поэтому полнота считается по фактам истории (объединение изменённых путей всех
 * коммитов), а не по списку файлов в дереве: файл, появившийся и удалённый до
 * HEAD, в дереве не виден, а история его помнит — и его правки не посчитаны
 * ничем. Отсюда же и то, чего инструмент не утверждает: он не говорит, «правильные»
 * ли колонки выбрал проект, — он говорит только, что мимо них ничего не прошло и
 * что именно не поместилось.
 *
 * Сводка по строкам идёт тем же проходом, что и отчёты (`measureHistory`), — по
 * тем же причинам, что и везде: второго расчёта в пакете нет. Отсюда цена: ответ
 * стоит одного прохода по истории, как и любой отчёт. */

// Сколько путей и коммитов показывать человеку в тексте: остальное — числом.
const SHOW = 8;

/* Список коммитов одной причины — строками не длиннее экрана: у большой истории
 * одних пропущенных коммитов набирается полсотни, и одна строка на всех не
 * читается вовсе. Все они остаются в ответе (и целиком — в `--json`), но перенос
 * делает его читаемым. */
function wrapped(head, items) {
  const lines = [];
  let line = head;
  items.forEach((item, i) => {
    const piece = (i === 0 ? '' : ' ') + item + (i === items.length - 1 ? '' : ',');
    if (line.length + piece.length > 100) { lines.push(line); line = '      ' + piece.trim(); return; }
    line += piece;
  });
  lines.push(line);
  return lines;
}

const REASON_WORD = { merge: 'слияние', report: 'только таблица', flat: 'без изменения объёма' };

function short(sha) {
  return sha.slice(0, 7);
}

/* Пути, тронутые историей, разложенные на три части: отслеживаемые колонками,
 * исключённые объявлением и незнакомые. Знакомство с путём проверяется по
 * колонкам целиком, а не по одной метке: у колонки путей может быть несколько
 * (переименование), и любой из них её и есть. */
function pathCoverage(cfg, commits) {
  const tracked = new Set();
  cfg.columns.forEach((col) => col.paths.forEach((p) => tracked.add(p)));
  const excluded = new Set([cfg.output].concat(cfg.skip || []));
  const seen = { covered: new Set(), excluded: new Set() };
  const unknown = new Map();
  commits.forEach((c) => {
    c.files.forEach((f) => {
      if (tracked.has(f)) { seen.covered.add(f); return; }
      if (excluded.has(f)) { seen.excluded.add(f); return; }
      /* Коммит, заведший путь, — первый по истории (порядок чтения — от старых к
       * новым), и показывается он человеку как улика: по нему видно, чья это была
       * правка. */
      if (!unknown.has(f)) unknown.set(f, { path: f, since: c.sha, subject: c.subject });
    });
  });
  return {
    covered: [...seen.covered].sort(),
    excluded: [...seen.excluded].sort(),
    unknown: [...unknown.values()]
  };
}

/* Полный ответ: настройки, история, пути, датчики — и вердикт. `ok` — это только
 * «мимо отчёта не прошло»: датчик, считающий приближённо, вердикта не меняет (это
 * отдельный код выхода, как и у остальных режимов). */
export function coverage(cfg, root, configFile) {
  assertFullHistory(root);
  const commits = readHistory(root);
  const measured = measureHistory(cfg, root, commits);
  const paths = pathCoverage(cfg, commits);
  const byReason = { merge: 0, report: 0, flat: 0 };
  measured.dropped.forEach((d) => { byReason[d.reason] += 1; });
  return {
    schema: 1,
    ok: paths.unknown.length === 0,
    config: {
      file: configFile,
      columns: cfg.columns.length,
      metrics: cfg.metrics,
      excluded: [...new Set([cfg.output].concat(cfg.skip || []))].sort()
    },
    history: {
      commits: commits.length,
      rows: measured.rows.length,
      dropped: measured.dropped.map((d) => ({ sha: d.sha, reason: d.reason })),
      byReason: byReason
    },
    paths: {
      covered: paths.covered.length,
      excluded: paths.excluded.length,
      unknown: paths.unknown
    },
    sensors: sensorGaps(cfg)
  };
}

/* Текст для человека: короткое «да» или список того, что не поместилось, — с
 * путём, коммитом, который его завёл, и готовой командой. Печатает `cli`, а не
 * этот модуль: у модуля нет и не должно быть вывода. */
export function coverageText(rep) {
  const lines = [];
  const unknown = rep.paths.unknown;
  const counts = '  история: ' + rep.history.commits + ' коммитов, ' + rep.history.rows + ' строк, без строки '
    + rep.history.dropped.length;
  if (!rep.ok) {
    lines.push('✗ покрытие: ' + unknown.length + (unknown.length === 1 ? ' путь' : ' путей')
      + ' истории не отслеживается и не исключён');
    unknown.slice(0, SHOW).forEach((u) => {
      lines.push('    ' + u.path + ' — с ' + short(u.since) + ' «' + u.subject.slice(0, 60) + '»');
    });
    if (unknown.length > SHOW) lines.push('    … ещё ' + (unknown.length - SHOW));
    lines.push('  починка: допишите эти пути колонкой или в «skip» файла ' + CONFIG_NAME
      + '; черновик колонок по расширениям даёт ' + cliCommand('--init draft.json'));
  } else {
    lines.push('✓ покрытие: ' + rep.history.commits + ' коммитов истории, ' + rep.history.rows
      + ' строк, тронутые пути отслеживаются или исключены');
  }
  lines.push(counts + ' (' + Object.keys(rep.history.byReason)
    .filter((k) => rep.history.byReason[k] > 0)
    .map((k) => REASON_WORD[k] + ' ' + rep.history.byReason[k]).join(', ') + ')');
  if (rep.history.dropped.length > 0) {
    ['merge', 'report', 'flat'].forEach((key) => {
      const shas = rep.history.dropped.filter((d) => d.reason === key).map((d) => short(d.sha));
      if (shas.length > 0) lines.push(...wrapped('    ' + REASON_WORD[key] + ' (' + shas.length + '): ', shas));
    });
  }
  lines.push('  пути: ' + rep.paths.covered + ' отслеживаются, ' + rep.paths.excluded + ' исключены'
    + (rep.ok ? '' : ', ' + unknown.length + ' незнакомы'));
  return lines.join('\n');
}

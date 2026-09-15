import fs from 'fs';
import path from 'path';
import { EXIT } from './refusal.js';
import { loadConfig } from './config.js';
import { byteLen } from './strip.js';
import { build, skipLine } from './history.js';
import { reportData, rowShape } from './data.js';
import { coverage, coverageText } from './check.js';
import { explainCommit, explainText } from './explain.js';
import { doctor, doctorText } from './doctor.js';
import { hookRun, installHook, uninstallHook } from './hook.js';
import { artifact, rebuild } from './artifact.js';
import { sensorGaps } from './metrics.js';
import { totalsOf } from './derived.js';

/* Режимы: что инструмент делает по запросу. Разбор аргументов — в `src/args.js`, а
 * сюда приходит готовый план: какой режим, какой ключ, что печатать. Здесь же их
 * общие мелочи (знак «!» о другом счёте, вердикт, размер словами) — один владелец
 * на все режимы, потому что один и тот же счёт и один и тот же знак не должны
 * разойтись между `--write`, `--data`, `--page` и `size check`.
 *
 * Что где: сборка и сверка отчёта (`--write`, проверка), данные контракта
 * (`--data`), полнота покрытия (`size check`), диагностика (`doctor`), хук и
 * объяснение пропущенной строки. Файл знает про все остальные модули сразу — это
 * его работа: связать их в одну команду.
 */

function kmb(bytes) {
  return Math.round(bytes / 1024) + ' КБ';
}

/* Деградация — не ошибка, а факт отчёта: числа получены другим счётом (упрощение
 * вместо сжатия, оценка вместо точного счёта), потому что необязательной
 * зависимости нет. Факт печатается один раз на датчик и становится кодом 4 — иначе
 * приближение уезжало бы в CI как успех. */
function note(gaps) {
  gaps.forEach((gap) => console.error('! ' + gap.why + '\n  починка: ' + gap.fix));
  return gaps.length === 0 ? EXIT.OK : EXIT.SENSOR;
}

function sensorNote(cfg) {
  return note(sensorGaps(cfg));
}

/* Вердикт режима вместе с заметками о датчиках: заметка печатается всегда — молчание
 * о другом счёте читается как точное число, и расхождение остаётся без причины, — а
 * код остаётся первым по важности. Нарушение старше приближения (тот же порядок, что
 * у `size check` и у `doctor`): код 4 говорит «числа честные, но другим счётом», а
 * когда таблица расходится, этого никто не проверял — расхождение может быть и
 * настоящей правкой мимо отчёта. */
function verdict(code, gaps) {
  const sensors = note(gaps);
  return code === EXIT.OK ? sensors : code;
}

export function check(cfg, want, root) {
  const out = path.join(root, cfg.output);
  if (!fs.existsSync(out)) {
    console.error('✗ таблица размеров: нет файла ' + cfg.output + ' — соберите её: ' + cfg.fixCommand);
    return 1;
  }
  const have = fs.readFileSync(out, 'utf8');
  if (have === want) return 0;

  const a = have.split('\n');
  const b = want.split('\n');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  console.error('✗ таблица размеров: ' + cfg.output + ' расходится с историей git (строка ' + (i + 1) + '):');
  console.error('    в файле:    ' + (a[i] === undefined ? '<строк нет>' : a[i].trim().slice(0, 160)));
  console.error('    по истории: ' + (b[i] === undefined ? '<строк нет>' : b[i].trim().slice(0, 160)));
  const missing = [...want.matchAll(/id="c-([^"]+)"/g)].map((m) => m[1])
    .filter((id) => have.indexOf('id="c-' + id + '"') === -1);
  if (missing.length > 0) {
    console.error('  строк нет в файле: ' + missing.length + ' (' + missing.slice(0, 5).join(', ')
      + (missing.length > 5 ? ', …' : '') + ')');
  }
  console.error('  починка: ' + cfg.fixCommand + ' — и закоммитить ' + cfg.output + ' отдельным коммитом.');
  return 1;
}

/* Путь, названный ключом (`--write <файл>`), — это настройка `output` этого
 * запуска: отчёт обязан называть себя тем путём, по которому лежит, иначе подпись в
 * нём указывала бы на чужое место. */
function withOutput(cfg, root, file) {
  if (typeof file !== 'string') return cfg;
  return Object.assign({}, cfg, { output: path.relative(root, path.resolve(file)) });
}

export function writeMode(cfg, root, file) {
  const out = rebuild(withOutput(cfg, root, file), root);
  const { rows, files, now, skipped } = out.data;
  console.log('✓ ' + path.relative(root, out.file) + ': ' + rows.length + ' строк × ' + files.length + ' файлов, '
    + kmb(byteLen(out.html)) + ' (пропущено без строки: ' + skipped.length + ' — '
    + skipped.join(', ') + ')');
  console.log('  состояние на HEAD: ' + files.map((f, i) => f.label + ' '
    + (now[i] === null ? '—' : cfg.metrics.map((m) => now[i][m]).join('/'))).join(', '));
  return sensorNote(cfg);
}

export function checkMode(cfg, root) {
  const out = artifact(cfg, root);
  const code = check(cfg, out.html, root);
  if (code === 0) {
    console.log('✓ отчёт: ' + out.data.rows.length + ' коммитов × ' + out.data.files.length + ' файлов '
      + 'совпадает с историей (' + cfg.output + ', ' + kmb(byteLen(out.html)) + ')');
  }
  return verdict(code, sensorGaps(cfg));
}

/* Ответ команды: `--json` — машинная форма того же ответа, а не второй ответ.
 * Одна на три команды, чтобы «кто печатает и в каком виде» не разошёлся между
 * ними: разойтись он может только здесь, а байты ответа — то, чем пользуется
 * агент. Текст берётся функцией: в машинной форме он не нужен вовсе. */
function answer(rep, asJson, text) {
  if (asJson) process.stdout.write(JSON.stringify(rep, null, 2) + '\n');
  else console.log(text(rep));
  return rep;
}

/* Полнота покрытия (`size check`): настройки, история, пути, датчики. Не путать с
 * `checkMode` выше — тот про таблицу и историю («файл совпадает с тем, что
 * сосчитано»), а этот про то, что сосчитано **всё**: ни один путь истории не
 * прошёл мимо колонок. Разные вопросы, поэтому и разные команды: держать отчёт в
 * git не обязательно, а вот полноту терять нельзя — она той же проверкой и
 * заменяется. */
export function coverageMode(cfg, root, configFile, asJson) {
  const rep = answer(coverage(cfg, root, configFile), asJson, coverageText);
  return verdict(rep.ok ? EXIT.OK : EXIT.VIOLATION, rep.sensors);
}

/* Диагностика одним ответом (`size doctor`): окружение, зависимости, настройки и
 * покрытие — сборкой из тех же кусков, что и остальные режимы. Код выхода — не
 * «что-то не так», а первый по важности (настройки → история → покрытие →
 * приближение): по нему агент ветвится, а текст читает человек. */
export function doctorMode(root, configFile, asJson) {
  return answer(doctor(root, configFile), asJson, doctorText).exit;
}

/* Хук: установка, снятие и то, что он зовёт сам. Ставится и снимается только
 * явной командой; `hook-run` зовётся хуком и всегда отвечает кодом 0 — коммит уже
 * сделан, и валить его нечем (устройство и причины — `src/hook.js`). Строка о
 * сделанном идёт в stderr: она часть вывода git, а не данных инструмента. */
export function hookMode(verb, root, configFile) {
  if (verb === 'hook-run') {
    const rep = hookRun(root, configFile);
    if (rep.note !== '') console.error(rep.note);
    return rep.code;
  }
  const rep = verb === 'install-hook' ? installHook(root, loadConfig(configFile, root)) : uninstallHook(root);
  rep.lines.forEach((line) => console.log(line));
  return rep.code;
}

/* Объяснение пропущенной строки (`size explain <коммит>`): ответ есть у любого
 * коммита, поэтому код выхода 0 и у «строка есть», и у «строки нет»; 2 — только
 * когда названного коммита в истории нет или префикс подходит нескольким. */
export function explainMode(cfg, root, target, asJson) {
  answer(explainCommit(cfg, root, target), asJson, explainText);
  return EXIT.OK;
}

/* Данные контракта в stdout — для страницы и для агента: та же правда, что в
 * артефакте, но без вёрстки и без производных величин. Прежняя форма `--json`
 * остаётся нетронутой: она заморожена эталоном паритета (fixtures/parity). */
export function dataMode(cfg, root) {
  process.stdout.write(JSON.stringify(reportData(cfg, root), null, 2) + '\n');
  return sensorNote(cfg);
}

export function jsonMode(cfg, root) {
  const { rows, dropped } = build(cfg, root);
  process.stdout.write(JSON.stringify({
    columns: cfg.columns.map((c) => ({ label: c.label, paths: c.paths })),
    metrics: cfg.metrics,
    rows: rows.map((r) => Object.assign(rowShape(r),
      { cells: r.cells, totals: totalsOf(r.cells, cfg.metrics) })),
    skipped: dropped.map(skipLine)
  }, null, 2) + '\n');
  return sensorNote(cfg);
}

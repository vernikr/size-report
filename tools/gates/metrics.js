#!/usr/bin/env node
/* Датчик раздувания: размер и сложность функций, размер модулей, дубли веток,
 * вес тестов, пометки долга. Правила и пороги — в `eslint.metrics.config.js`,
 * здесь только запуск и храповик.
 *
 * **Храповик — встроенное подавление ESLint** (`.eslint-suppressions.json`): то, что
 * выше порога сегодня, лежит в базе и работы не блокирует; то, что появится
 * завтра, названо поимённо и валит гейт. Подавление считается по файлу и правилу,
 * а не по номеру строки, поэтому сдвиг строк не превращает базу в мусор.
 * База обновляется только человеком (`pnpm run baseline:metrics`) и только с
 * трейлером `Gate-Change:` — иначе это был бы способ пройти гейт, не поправив код.
 * Устаревшая запись (нарушение починили, а строка в базе осталась) гейт не валит:
 * чистка базы — дело человека, а не препятствие тому, кто чинит код.
 *
 * Запуск: `pnpm run metrics` (гейт), `pnpm run verify:fast` (он же в быстром профиле).
 * Коды выхода: 0 — новых нарушений нет, 1 — есть (или прогон не состоялся).
 */

import fs from 'node:fs';
import path from 'node:path';
import { REPORTS, ROOT, bad, indent, ok, parseArgs, pathsOf, readJson, rel, run } from './common.js';

/* База — по своему имени, а не по умолчанию ESLint (`eslint-suppressions.json`):
 * иначе её подхватывает и строгий линтер оформления (`eslint .`), у которого этих
 * правил нет, и падает на «подавления, которые больше не встречаются». */
const BASELINE = '.eslint-suppressions.json';
const args = parseArgs(process.argv.slice(2), ['--paths', '--baseline'], []);
const baselineName = args.flags['--baseline'] || BASELINE;
const paths = pathsOf(args);
const report = path.join(REPORTS, 'metrics.json');
fs.mkdirSync(REPORTS, { recursive: true });

const res = run('pnpm', ['exec', 'eslint', '--config', 'eslint.metrics.config.js',
  '--suppressions-location', baselineName, '--pass-on-unpruned-suppressions',
  '--format', 'json', '--output-file', rel(report)].concat(paths));
if (res.error || !fs.existsSync(report)) {
  bad('metrics: линтер не отработал (' + (res.error ? res.error.message : 'нет отчёта')
    + ')\n' + indent((res.stderr || '').trim()));
  process.exit();
}

/* Отчёт сортируется по файлу, строке и правилу: два прогона на одном дереве дают
 * один и тот же файл, а значит его видно в диффе. */
const found = [];
readJson(report).forEach((file) => {
  file.messages.forEach((m) => {
    found.push({ file: rel(file.filePath), line: m.line, column: m.column, rule: m.ruleId, message: m.message });
  });
});
found.sort((a, b) => (a.file + ':' + a.line + ':' + a.rule).localeCompare(b.file + ':' + b.line + ':' + b.rule));

/* Размер базы — часть вердикта: по ней видно, растёт храповик или чинится. */
const suppressions = fs.existsSync(path.join(ROOT, baselineName)) ? readJson(path.join(ROOT, baselineName)) : {};
let inBaseline = 0;
let baselineFiles = 0;
Object.keys(suppressions).sort().forEach((file) => {
  baselineFiles++;
  Object.keys(suppressions[file]).forEach((rule) => { inBaseline += suppressions[file][rule].count || 0; });
});

if (found.length > 0) {
  bad('metrics: новых нарушений ' + found.length + ' (в базе ' + inBaseline
    + ' на ' + baselineFiles + ' файлах)');
  found.slice(0, 30).forEach((f) => {
    console.error('    ' + f.file + ':' + f.line + '  ' + f.rule + '  ' + f.message);
  });
  if (found.length > 30) console.error('    … всего новых нарушений: ' + found.length);
  console.error('    чинить код, а не датчик; порог или базу меняет человек');
} else {
  ok('metrics: новых нарушений нет (в базе ' + inBaseline + ' на ' + baselineFiles + ' файлах)');
}

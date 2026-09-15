#!/usr/bin/env node
/* Датчик связей: циклы, сироты, направление слоёв. Правила — в
 * `.dependency-cruiser.cjs`, здесь запуск, печать и машинный отчёт.
 *
 * Храповик у этого датчика встроенный — `--ignore-known` и файл
 * `.dependency-cruiser-known-violations.json`. Сейчас он не нужен и намеренно не
 * заведён: дерево чистое, находка новая по определению. Появится терпимая находка —
 * её кладут в файл известных нарушений и это отдельное человеческое действие
 * (файл стережёт `gatefiles`, без трейлера `Gate-Change:` его не пронести).
 *
 * Запуск: `pnpm run deps`. Коды выхода: 0 — находок нет, 1 — есть или прогон не
 * состоялся.
 */

import fs from 'node:fs';
import { bad, indent, ok, parseArgs, pathsOf, readJson, rel, run, writeReport } from './common.js';

const args = parseArgs(process.argv.slice(2), ['--paths', '--known'], []);
const paths = pathsOf(args);
const report = 'reports/deps.json';

const argv = ['exec', 'depcruise'].concat(paths)
  .concat(['--config', '.dependency-cruiser.cjs', '--output-type', 'json', '--output-to', report])
  .concat(args.flags['--known'] ? ['--ignore-known', args.flags['--known']] : []);
const res = run('pnpm', argv);
if (res.error || !fs.existsSync(report)) {
  bad('deps: разбор связей не состоялся (' + (res.error ? res.error.message : 'нет отчёта')
    + ')\n' + indent((res.stderr || '').trim()));
  process.exit();
}

/* Отчёт сортируется: правило, откуда, куда — чтобы диффился и читался одним
 * взглядом. `severity` из отчёта и есть вердикт: `error` валит, `warn` называется. */
const found = readJson(report).summary.violations.map((v) => ({
  rule: v.rule.name,
  severity: v.rule.severity,
  from: rel(v.from),
  to: v.to === undefined ? '' : (v.to.startsWith('node_modules') ? v.to : rel(v.to)),
  comment: v.rule.comment || ''
}));
found.sort((a, b) => (a.rule + a.from + a.to).localeCompare(b.rule + b.from + b.to));
const modules = readJson(report).modules.length;
const deps = readJson(report).modules.reduce((sum, m) => sum + m.dependencies.length, 0);
writeReport('deps.json', { schema: 1, modules: modules, dependencies: deps, violations: found });

const errors = found.filter((v) => v.severity === 'error');
if (errors.length > 0) {
  bad('deps: находок ' + errors.length + ' (' + modules + ' модулей, ' + deps + ' связей)');
  errors.forEach((v) => {
    console.error('    ' + v.rule + ': ' + v.from + (v.to === '' ? '' : ' → ' + v.to));
  });
  console.error('    чинить связи, а не правило');
} else {
  ok('deps: находок нет (' + modules + ' модулей, ' + deps + ' связей)');
}
found.filter((v) => v.severity !== 'error').forEach((v) => {
  console.log('  — к сведению: ' + v.rule + ': ' + v.from + ' → ' + v.to);
});

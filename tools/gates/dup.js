#!/usr/bin/env node
/* Датчик дублей: копипаста (Type-1/2) и близнецы по токенам (Type-3, `similarity`).
 * Настройки — в `.jscpd.json`, здесь храповик и машинный отчёт.
 *
 * **Отпечаток — свой, по содержимому, а не родной у jscpd, и это измеренный факт.**
 * Родная база jscpd (`--baseline`) привязана к пути выкладки: та же ревизия,
 * распакованная в другой каталог, даёт «15 новых клонов» на чистом дереве (проверено
 * дважды — на копии дерева и на выкладке из `git archive`). Значит на CI она красная
 * всегда, а в храповике нет смысла. Поэтому клон отпечатывается хешем своего же
 * текста (фрагмент + строки + токены): переезд файла, строки или всего репозитория
 * отпечаток не сдвигает, а новый дубль появляется сразу.
 *
 * **Храповик** — база отпечатков (`dup-baseline.json`): клоны, живущие сегодня, в базе
 * и гейт не валят; новый назван поимённо и валит. База обновляется только человеком
 * (`pnpm run baseline:dup`) и стережётся `gatefiles`: без трейлера `Gate-Change:` её
 * не пронести.
 *
 * **Два взгляда, и второй важнее первого.** Первый — против файла базы (локально он и
 * есть храповик). Второй — против дерева `origin/main`, распакованного во временный
 * каталог: база строится заново, поэтому правка базы в самой ветке новый клон не
 * спрячет. Второй взгляд пропускается только там, где `origin/main` нет вовсе, и об
 * этом печатается строка — молчаливого «зелено» тут быть не должно.
 *
 * **Предел, названный пробой.** Копия участка в новый файл ловится, если участок
 * разбирается: целая функция (29 строк `readBlobs` из `git.js`) — 1 клон, она же,
 * обрезанная на середине (17 строк), — 0. Причина в самом jscpd: пары функций
 * сравниваются по дереву разбора, и файл, который не разбирается, из сравнения
 * выпадает. В коммит попадает разбирающийся код, поэтому для гейта это не дыра; а
 * проба датчика обязана брать целый файл, иначе она доказывает не то.
 *
 * Запуск: `pnpm run dup` (гейт), `pnpm run dup:ci` (только взгляд на ветку),
 * `pnpm run baseline:dup` (обновление базы). Коды выхода: 0 — новых нет, 1 — есть или
 * прогон не состоялся.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { REPORTS, ROOT, bad, git, indent, ok, parseArgs, pathsOf, readJson, rel, run, writeReport } from './common.js';

const BASELINE = 'dup-baseline.json';
const args = parseArgs(process.argv.slice(2), ['--paths', '--baseline', '--ref'], ['--update', '--no-ref']);
const paths = pathsOf(args);
const baselineName = args.flags['--baseline'] || BASELINE;
const baselineFile = path.isAbsolute(baselineName) ? baselineName : path.join(ROOT, baselineName);

/* Отпечаток клона: содержимое, а не место. Хеш — от текста фрагмента, числа строк и
 * токенов: у двух одинаковых клонов он один, у похожих — разный. */
function fingerprint(clone) {
  const text = clone.fragment + '\n' + clone.lines + ':' + clone.tokens;
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

/* Один прогон по каталогу: jscpd отдаёт полный список клонов (базы у него больше
 * нет), отчёт читается из своего каталога, чтобы чужой файл числа не подменил. */
function scan(label, root, dirs) {
  const out = path.join(REPORTS, 'dup', label);
  fs.rmSync(out, { recursive: true, force: true });
  const list = dirs.map((d) => (path.isAbsolute(d) ? d : path.join(root, d)))
    .filter((d) => fs.existsSync(d));
  const res = run('pnpm', ['exec', 'jscpd', '--config', '.jscpd.json', '--output', rel(out)].concat(list));
  const reportFile = path.join(out, 'jscpd-report.json');
  if (!fs.existsSync(reportFile)) {
    return { failed: true, why: (res.stderr || res.stdout || 'нет отчёта').trim(), total: 0, clones: [], counts: {}, sample: {} };
  }
  const report = readJson(reportFile);
  const counts = {};
  const sample = {};
  report.duplicates.slice().forEach((d) => {
    const fp = fingerprint(d);
    counts[fp] = (counts[fp] || 0) + 1;
    if (sample[fp] === undefined) {
      sample[fp] = {
        first: shown(d.firstFile.name, root) + ':' + d.firstFile.start,
        second: shown(d.secondFile.name, root) + ':' + d.secondFile.start,
        lines: d.lines, tokens: d.tokens
      };
    }
  });
  return {
    failed: false, total: report.duplicates.length, counts: counts, sample: sample,
    lines: report.statistics.total.duplicatedLines
  };
}

/* Имя файла в отчёте — без пути сканирования: у взгляда на ветку это временный
 * каталог, и называть его человеку незачем. */
function shown(name, root) {
  const abs = path.resolve(root, name);
  return rel(abs);
}

/* Новые отпечатки: те, которых в базе нет или которых стало больше. Считается по
 * счётчикам, а не по вхождению: три одинаковых клона вместо одного — это два новых. */
function newer(baselineCounts, counts) {
  const list = [];
  Object.keys(counts).sort().forEach((fp) => {
    const extra = counts[fp] - (baselineCounts[fp] || 0);
    if (extra > 0) list.push({ fp: fp, extra: extra });
  });
  return list;
}

/* Взгляд на ветку: дерево рефа распаковывается во временный каталог (`git archive`),
 * сканируется тем же конфигом, и в отчёте остаются только его клоны. */
function refTree(ref, work) {
  const dir = path.join(work, 'ref');
  fs.mkdirSync(dir, { recursive: true });
  const archive = git(['archive', ref], { encoding: 'buffer' });
  if (archive.status !== 0) return null;
  const tar = run('tar', ['-x', '-C', dir], { input: archive.stdout });
  if (tar.status !== 0) return null;
  return dir;
}

const current = scan('current', ROOT, paths);
if (current.failed) {
  bad('dup: прогон не состоялся\n' + indent(current.why));
  process.exit();
}

if (args.flags['--update']) {
  fs.writeFileSync(baselineFile, JSON.stringify({
    schema: 1,
    config: '.jscpd.json',
    note: 'База дублей: отпечатки по содержимому клона (фрагмент + строки + токены),'
      + ' поэтому переезд файлов и выкладки её не сдвигает. Обновляется человеком.',
    fingerprints: current.counts
  }, null, 2) + '\n');
  ok('dup: база обновлена — ' + Object.keys(current.counts).length + ' отпечатков в '
    + baselineName + ' (клонов ' + current.total + ', строк ' + (current.lines || 0) + ')');
  console.log('  обновление базы — человеческое действие: приложите причину трейлером Gate-Change:');
  process.exit();
}

if (!fs.existsSync(baselineFile)) {
  bad('dup: базы нет (' + baselineName + ') — соберите её: pnpm run baseline:dup');
  process.exit();
}
const baseline = readJson(baselineFile).fingerprints || {};

const runs = [{
  against: 'файл базы',
  total: current.total,
  new: newer(baseline, current.counts).map((n) => Object.assign({ against: 'файл базы' }, sample(current, n)))
}];

/* Взгляд на ветку целиком: распаковка, прогон по дереву и вердикт. Отдельной
 * функцией, а не ветвью внутри ветви — гнездо из четырёх уровней этот же датчик и
 * ловит (`max-depth`). */
function refLook(wantRef) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-dup-'));
  try {
    const dir = refTree(wantRef, work);
    if (dir === null) return 'dup: дерево ' + wantRef + ' не распаковалось — сравнение с базой ветки не выполнено';
    const ref = scan('ref', dir, paths);
    if (ref.failed) {
      bad('dup: прогон по дереву ' + wantRef + ' не состоялся\n' + indent(ref.why));
      return null;
    }
    const against = 'против ' + wantRef;
    runs.push({
      against: against,
      total: ref.total,
      new: newer(ref.counts, current.counts).map((n) => Object.assign({ against: against }, sample(current, n)))
    });
    return null;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const wantRef = args.flags['--ref'] || (args.flags['--no-ref'] ? null : 'origin/main');
let refNote = null;
if (wantRef !== null) {
  const has = git(['rev-parse', '--verify', '--quiet', wantRef + '^{commit}']);
  refNote = has.status === 0 ? refLook(wantRef)
    : 'dup: ' + wantRef + ' нет — сравнение с базой ветки не выполнено';
}

writeReport('dup.json', {
  schema: 1,
  config: '.jscpd.json',
  baseline: { file: baselineName, fingerprints: Object.keys(baseline).length },
  current: { clones: current.total, duplicatedLines: current.lines || 0 },
  runs: runs.map((r) => ({ against: r.against, total: r.total, new: r.new.length, clones: r.new }))
});

function sample(scanResult, entry) {
  return Object.assign({ fingerprint: entry.fp, extra: entry.extra }, scanResult.sample[entry.fp] || {});
}

const newClones = runs.reduce((sum, r) => sum + r.new.length, 0);
if (newClones > 0) {
  bad('dup: новых клонов ' + newClones + ' (в базе ' + Object.keys(baseline).length + ' отпечатков,'
    + ' в дереве ' + current.total + ')');
  runs.forEach((r) => r.new.slice(0, 10).forEach((c) => {
    console.error('    ' + (c.lines || '?') + ' строк, ' + (c.tokens || '?') + ' токенов: '
      + (c.first || '?') + ' ↔ ' + (c.second || '?') + '  [' + c.against + ']');
  }));
  console.error('    чинить код (вынести общее), а не базу');
} else {
  ok('dup: новых клонов нет (клонов ' + current.total + ', строк ' + (current.lines || 0)
    + ', в базе ' + Object.keys(baseline).length + ' отпечатков; взглядов ' + runs.length
    + ': ' + runs.map((r) => r.against).join(', ') + ')');
}
if (refNote !== null) console.log('  — ' + refNote);

#!/usr/bin/env node
/* Оба эталона воспроизводятся: пересъём идёт во временный каталог и сверяется с
 * закоммиченным, поэтому рабочее дерево остаётся чистым.
 *
 * Зачем отдельно от `pnpm test`. Набор проверяет, что движок пакета даёт те же
 * числа, что эталон, — то есть читает эталон. Здесь проверяется обратное
 * направление: что сам эталон снимается заново теми же инструментами. Правка
 * эталона руками, сломанное снятие и зависимость снятия от настроек машины
 * видны только так, и первый из этих случаев набор не ловит вовсе.
 *
 * Живая история берётся из бандла (`fixtures/live/history.bundle`): проект
 * потребителя приватный, ключа у этой проверки нет, а бандл несёт ровно ту
 * ревизию, что записана в эталоне.
 *
 * Побайтово сверяется только то, что пишем мы сами. Бандл пишет git, и упаковка
 * зависит от его версии, поэтому у бандла сверяется содержимое — ветки, верхушка
 * и число коммитов, то есть то, что делает бандл заменой проекта. Манифест по
 * той же причине сверяется по полям: в нём записан хеш бандла. Построчное
 * сравнение байтов было бы зелёным на одной версии git и красным на другой — это
 * и случилось в CI.
 *
 * Запуск: `node tools/check-standards.js` или `pnpm run check:standards`.
 * Коды выхода: 0 — совпало, 1 — расхождение.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MAX_BUF, PARITY, ROOT, SYNTH, firstDiff, tempDir } from './harness.js';

const LIVE = path.join(ROOT, 'fixtures', 'live', 'history.bundle');
const BUNDLE = 'history.bundle';

/* Файлы, которые пишем мы: они обязаны совпасть байт в байт. */
const FIXTURE_FILES = ['README.md', 'artifact.sha256', 'config.json', 'golden.json'];

/* У описания паритета путь, откуда эталон снят, а у пересъёма из бандла путь
 * свой — расхождение там законно, поэтому само описание не сверяется. */
const PARITY_FILES = ['data.json', 'config.json', 'artifact.sha256'];

let bad = 0;

function fail(text) {
  bad++;
  console.log(text);
}

function indent(text, limit) {
  const lines = String(text).trim().split('\n');
  const head = lines.slice(0, limit).map((line) => '      ' + line);
  if (lines.length > limit) head.push('      … всего строк: ' + lines.length);
  return head.join('\n');
}

/* Отказ инструмента печатается целиком, а не первой строкой: первая строка
 * бывает замечанием самого git (`hint: Using 'master' …`), и настоящая причина
 * оставалась бы невидимой. */
function snapshot(what, args) {
  try {
    execFileSync(process.execPath, args,
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: MAX_BUF });
    return true;
  } catch (e) {
    fail('  ✗ ' + what + ':\n' + indent((e && e.stderr) || e.message, 12));
    return false;
  }
}

/* Расхождение называет строку: «JSON не совпал» ничего не говорит о причине. */
function differ(name, made, committed) {
  const a = fs.readFileSync(path.join(made, name));
  const b = fs.readFileSync(path.join(committed, name));
  return (a.indexOf(0) < 0 && b.indexOf(0) < 0)
    ? firstDiff(a.toString('utf8'), b.toString('utf8'))
    : 'байты: ' + a.length + ' Б против ' + b.length + ' Б';
}

function compareFiles(names, made, committed) {
  let same = 0;
  names.forEach((name) => {
    const a = fs.readFileSync(path.join(made, name));
    if (a.equals(fs.readFileSync(path.join(committed, name)))) same++;
    else fail('  ✗ ' + name + ': пересъём не совпал с закоммиченным\n'
      + indent(differ(name, made, committed), 4));
  });
  return same;
}

/* Манифест — запись, а не эталон: хеш бандла в нём от версии git и зависит.
 * Сверяются поля, кроме записи о самом бандле. */
function compareManifest(made, committed) {
  const a = JSON.parse(fs.readFileSync(path.join(made, 'manifest.json'), 'utf8'));
  const b = JSON.parse(fs.readFileSync(path.join(committed, 'manifest.json'), 'utf8'));
  [a, b].forEach((m) => { if (m.files) delete m.files[BUNDLE]; });
  const keys = Object.keys(b).concat(Object.keys(a).filter((k) => !(k in b)));
  const diff = keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  diff.forEach((k) => fail('  ✗ manifest.json: поле ' + k + ' разошлось\n'
    + indent(firstDiff(JSON.stringify(a[k], null, 2), JSON.stringify(b[k], null, 2)), 4)));
  return diff.length === 0;
}

/* Содержимое бандла: упаковка у разных версий git разная, а история — нет.
 * Оглавление читается из самого файла, а не из клона: клон ветку по HEAD
 * угадывает, и на разных версиях git угадывает по-разному — проверка, построенная
 * на догадке, была бы зелёной на одной машине и красной на другой. Клон здесь —
 * доказательство, что упаковка читается, и только: число коммитов считается по
 * всему достижимому, а не по выложенной ветке. */
function bundleFacts(file) {
  const listed = execFileSync('git', ['bundle', 'list-heads', file],
    { encoding: 'utf8', maxBuffer: MAX_BUF }).trim().split('\n');
  const heads = {};
  listed.filter((line) => line !== '').forEach((line) => {
    const at = line.indexOf(' ');
    heads[line.slice(at + 1)] = line.slice(0, at);
  });
  const dir = tempDir('bundle');
  try {
    execFileSync('git', ['clone', '-q', '--no-hardlinks', file, dir],
      { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: MAX_BUF });
    heads['*'] = execFileSync('git', ['-C', dir, 'rev-list', '--count', '--all'],
      { encoding: 'utf8', maxBuffer: MAX_BUF }).trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return heads;
}

function describeRefs(heads) {
  return Object.keys(heads).sort().map((ref) => (ref === '*' ? '' : ref + ' → ')
    + heads[ref].slice(0, 7)).filter((line) => line !== '').join(', ')
    + ', коммитов ' + heads['*'];
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-standards-'));
try {
  const synthetic = path.join(tmp, 'synthetic');
  if (snapshot('фикстура не снялась', ['tools/make-fixture.js', '--out', synthetic])) {
    const same = compareFiles(FIXTURE_FILES, synthetic, SYNTH);
    const manifestOk = compareManifest(synthetic, SYNTH);
    const made = bundleFacts(path.join(synthetic, BUNDLE));
    const kept = bundleFacts(path.join(SYNTH, BUNDLE));
    const bundleOk = JSON.stringify(made) === JSON.stringify(kept);
    if (!bundleOk) {
      fail('  ✗ ' + BUNDLE + ': пересъём несёт другую историю\n'
        + indent('снято сейчас: ' + describeRefs(made) + '\nзакоммичено: ' + describeRefs(kept), 4));
    }
    if (same === FIXTURE_FILES.length && manifestOk && bundleOk) {
      console.log('  ✓ фикстура: ' + same + ' из ' + FIXTURE_FILES.length
        + ' файлов побайтово, манифест по полям, бандл несёт ' + made['*'] + ' коммитов');
    }
  }

  const parity = path.join(tmp, 'parity');
  if (snapshot('эталон паритета не снялся', ['tools/parity-freeze.js', LIVE, '--out', parity])) {
    console.log('  ✓ паритет: снят из истории потребителя, '
      + compareFiles(PARITY_FILES, parity, PARITY) + ' из ' + PARITY_FILES.length
      + ' файлов совпали побайтово');
  }

  /* Бандл — замена проекта, и заменой он быть обязан без оговорок: у него
   * объявлены и `HEAD`, и ветка `main`, обе на ревизии эталона. Без `HEAD` клон
   * сам решает, какую ветку выложить, и разные версии git решают по-разному. */
  const frozen = JSON.parse(fs.readFileSync(path.join(PARITY, 'manifest.json'), 'utf8'));
  const live = bundleFacts(LIVE);
  if (live.HEAD !== frozen.project.head || live['refs/heads/main'] !== frozen.project.head
      || live['*'] !== String(frozen.project.commits)) {
    fail('  ✗ ' + BUNDLE + ' истории потребителя больше не заменяет проект:\n'
      + indent('сейчас: ' + describeRefs(live) + '\nожидалось: HEAD и refs/heads/main на '
        + frozen.project.head + ', коммитов ' + frozen.project.commits, 4));
  } else {
    console.log('  ✓ бандл истории: HEAD и ветка main на '
      + frozen.project.head.slice(0, 7) + ', ' + live['*'] + ' коммитов');
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (bad === 0) console.log('✓ эталоны воспроизводятся, рабочее дерево не тронуто');
else console.error('✗ расхождений: ' + bad);
process.exitCode = bad === 0 ? 0 : 1;

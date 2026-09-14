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
 * Запуск: `node tools/check-standards.js` или `pnpm run check:standards`.
 * Коды выхода: 0 — совпало побайтово, 1 — расхождение.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MAX_BUF, PARITY, ROOT, SYNTH } from './harness.js';

const LIVE = path.join(ROOT, 'fixtures', 'live', 'history.bundle');

/* Побайтово сверяются сами эталонные файлы. Описание рядом с ними
 * (`manifest.json`, `README.md`) называет путь, откуда эталон снят, и у пересъёма
 * из бандла путь свой — расхождение там законно. */
const PARITY_FILES = ['data.json', 'config.json', 'artifact.sha256'];

let bad = 0;

/* Снятие в отдельном процессе: у инструментов свои коды выхода и свои сообщения,
 * и повторить их руками можно ровно той же командой, что здесь. */
function snapshot(what, args) {
  try {
    execFileSync(process.execPath, args, {
      cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: MAX_BUF
    });
    return true;
  } catch (e) {
    bad++;
    console.log('  ✗ ' + what + ': ' + String((e && e.stderr) || e.message).trim().split('\n')[0]);
    return false;
  }
}

function matched(names, made, committed) {
  const ok = names.filter((name) => fs.readFileSync(path.join(made, name))
    .equals(fs.readFileSync(path.join(committed, name))));
  names.filter((name) => ok.indexOf(name) < 0).forEach((name) => {
    bad++;
    console.log('  ✗ ' + name + ': пересъём не совпал с закоммиченным');
  });
  return ok.length;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-standards-'));
try {
  const synthetic = path.join(tmp, 'synthetic');
  if (snapshot('фикстура не снялась', ['tools/make-fixture.js', '--out', synthetic])) {
    const names = fs.readdirSync(SYNTH).sort();
    console.log('  ✓ фикстура: ' + matched(names, synthetic, SYNTH) + ' из ' + names.length
      + ' файлов совпали побайтово');
  }

  const parity = path.join(tmp, 'parity');
  if (snapshot('эталон паритета не снялся', ['tools/parity-freeze.js', LIVE, '--out', parity])) {
    console.log('  ✓ паритет: снят из истории потребителя, ' + matched(PARITY_FILES, parity, PARITY)
      + ' из ' + PARITY_FILES.length + ' файлов совпали побайтово');
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (bad === 0) console.log('✓ эталоны воспроизводятся побайтово, рабочее дерево не тронуто');
else console.error('✗ расхождений: ' + bad);
process.exitCode = bad === 0 ? 0 : 1;

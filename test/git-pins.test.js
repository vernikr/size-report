/* Сторож границы вызова git: у настроек, которые меняют читаемое, одно место — и
 * оно одно на движок и проверки. Класс дефекта тот же, что у B1, только найден он
 * не в движке, а в обвязке: `git log --name-only` на машине с настройками по
 * умолчанию отдаёт не-английские пути закавыченными, и проверка, читающая git «как
 * есть», зелена здесь и красна там — ложная сеть, хуже отсутствующей.
 *
 * Проверок две, и они закрывают разные половины: первая читает исходники и требует,
 * чтобы прямых вызовов git без общего списка закреплений не было (это и есть ответ
 * на «новое место не может появиться незакреплённым»), вторая показывает, что
 * закрепление работает, — свидетелем, а не надеждой на настройки машины, на которой
 * прогон случился.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, gitBare, gitConfig, gitIn, tempDir } from '../tools/harness.js';

const tmp = tempDir('git-pins');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// Каталоги с настоящим кодом: движок, точка входа, инструменты и проверки.
const CODE = ['src', 'bin', 'tools', 'test'];

/* Два файла, в которых незакреплённый вызов — решение, а не недосмотр: сама граница
 * (`tools/harness.js`, где живёт `gitBare`) и проверка, измеряющая унаследованные
 * настройки (`test/environment.test.js`): ей закрепления мешают так же, как помогали
 * бы везде ещё. Список ведёт человек — новый файл сюда попадает осознанно. */
const BARE_ALLOWED = ['tools/harness.js', 'test/environment.test.js'];

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : jsFiles(full);
    return /\.js$/.test(entry.name) ? [full] : [];
  });
}

test('прямой вызов git идёт только через общий список закреплений', () => {
  // Зов процесса: имя помощника и первым аргументом git — и отдельным словом, и
  // целой строкой команды (`'git clone …'`).
  const CALL = /\b(?:execFileSync|execFile|spawnSync|spawn|execSync|exec)\s*\(\s*(['"])(git[^'"\n]*)\1([^\n]*)/g;
  const bad = [];
  CODE.forEach((part) => {
    jsFiles(path.join(ROOT, part)).forEach((file) => {
      const rel = path.relative(ROOT, file);
      if (BARE_ALLOWED.indexOf(rel) >= 0) return;
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        [...line.matchAll(CALL)].forEach((m) => {
          if (/gitArgv\(|gitBare\(/.test(m[3])) return;
          bad.push(rel + ':' + (i + 1) + ' — «' + m[2].slice(0, 40)
            + '» без общего списка закреплений: настройки унаследуются от машины');
        });
      });
    });
  });
  assert.deepEqual(bad, [],
    'git зовётся в обход общего списка закреплений:\n  ' + bad.join('\n  '));
});

/* Свидетель: у незакреплённого чтения путь закавычивается, у общего — нет. Так
 * проверка доказывает своё и в среде без настроек машины, и в обычной. */
test('общее чтение git не зависит от того, какие настройки унаследованы', () => {
  const dir = path.join(tmp, 'repo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'заметки.md'), '# заметки\n');
  gitIn(dir, ['init', '-q']);
  gitIn(dir, ['config', 'user.email', 'test@example.com']);
  gitIn(dir, ['config', 'user.name', 'Тест']);
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-qm', 'заметки']);

  const read = ['log', '--name-only', '--pretty=format:'];
  const pinned = gitIn(dir, read);
  assert.ok(pinned.indexOf('заметки.md') >= 0,
    'общее чтение закавычило не-английский путь: ' + JSON.stringify(pinned.trim()));

  // То же чтение без закреплений — при настройках по умолчанию путь экранирован.
  const bare = gitBare(read, {
    cwd: dir,
    env: Object.assign({}, process.env, gitConfig({ 'core.quotePath': 'true' }))
  });
  assert.equal(bare.status, 0, 'свидетель не отработал: ' + (bare.stderr || '').trim());
  assert.ok(bare.stdout.indexOf('заметки.md') < 0,
    'незакреплённое чтение вернуло путь как есть: закрепление не доказывает ничего');
});

/* Проба защиты гейт-файлов (`tools/gates/gatefiles.js`): правка порогов, баз и
 * обвязки проверок без трейлера `Gate-Change:` обязана красить проверку — и в хуке
 * (по индексу), и в CI (по каждому коммиту диапазона).
 *
 * Проба идёт на **своём временном репозитории** с копией скриптов датчиков и той
 * части продукта, на которую они опираются (`src/git.js` — граница вызова git с
 * закреплёнными настройками): в рабочем дереве проба оставляла бы коммиты, а гейт,
 * который коммитит за проверяемого, — плохая идея. Скрипт видит репозиторий по своему
 * расположению, поэтому копия воспроизводит раскладку.
 *
 * Проверяются обе половины обещания: **без трейлера — красный**, **с трейлером —
 * зелёный**, и то, что правка обычного файла трейлера не требует (иначе гейт требовал
 * бы обоснования на каждую правку).
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, exec, git, tempDir, write } from '../tools/gate-probe.js';

const tmp = tempDir('gatefiles');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const repo = path.join(tmp, 'repo');
const GATE = path.join(repo, 'tools/gates');

function gitIn(argv) {
  const res = git(argv, { cwd: repo });
  assert.equal(res.code, 0, 'git ' + argv.join(' ') + ' не отработал:\n' + res.out);
  return res.out;
}

/* Сообщение — файлом (`git commit -F`): трейлер живёт в теле сообщения, а `-m` в
 * одну строку его бы и не проверил. */
function commit(message) {
  const file = path.join(tmp, 'message.txt');
  write(file, message + '\n');
  return git(['commit', '-F', file], { cwd: repo });
}

function gate(argv) {
  return exec(process.execPath, [path.join(GATE, 'gatefiles.js')].concat(argv), { cwd: repo });
}

/* Раскладка временного репозитория: копия обвязки датчика (и той части продукта, на
 * которую она опирается), обычный файл и два гейт-файла. Возвращает первый коммит —
 * он и служит базой для проверки диапазона. */
function prepare() {
  fs.mkdirSync(GATE, { recursive: true });
  ['common.js', 'gatefiles.js'].forEach((f) => {
    fs.copyFileSync(path.join(ROOT, 'tools/gates', f), path.join(GATE, f));
  });
  fs.cpSync(path.join(ROOT, 'src'), path.join(repo, 'src'), { recursive: true });
  write(path.join(repo, 'src/ok.js'), 'export const ok = 1;\n');
  write(path.join(repo, 'package.json'), '{\n  "name": "probe"\n}\n');
  write(path.join(repo, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  gitIn(['init', '-q']);
  gitIn(['config', 'user.name', 'проба']);
  gitIn(['config', 'user.email', 'probe@example.invalid']);
  gitIn(['add', 'src/ok.js']);
  const first = commit('feat: обычный файл без трейлера');
  assert.equal(first.code, 0, 'обычный коммит не прошёл:\n' + first.out);
  return gitIn(['rev-parse', 'HEAD']).trim();
}

test('гейт-файл без трейлера красный, с трейлером — зелёный', () => {
  const base = prepare();

  // Правка гейт-файла в индексе — вердикт хука.
  gitIn(['add', 'package.json']);
  const staged = path.join(tmp, 'staged-msg.txt');
  write(staged, 'chore: правка порога\n');
  const hook = gate(['--commit-msg', staged]);
  assert.equal(hook.code, 1, 'правка гейт-файла прошла хук без трейлера:\n' + hook.out);
  // Красный обязан быть вердиктом, а не отказом самого скрипта (сломанный импорт —
  // тоже ненулевой код, и без этой сверки проба «проходила» бы на нём).
  assert.match(hook.out, /правка гейта без трейлера/, 'красный не назвал причину:\n' + hook.out);
  assert.match(hook.out, /package\.json/, 'хук не назвал гейт-файл:\n' + hook.out);

  write(staged, 'chore: правка порога\n\nGate-Change: порог поднят по замеру, причина такая\n');
  const hookOk = gate(['--commit-msg', staged]);
  assert.equal(hookOk.code, 0, 'трейлер не был принят:\n' + hookOk.out);

  // Коммит без трейлера в диапазоне — вердикт CI.
  const bad = commit('chore: правка порога без трейлера');
  assert.equal(bad.code, 0, 'git не смог закоммитить:\n' + bad.out);
  const range = gate(['--range', base]);
  assert.equal(range.code, 1, 'коммит с правкой гейт-файла прошёл диапазон без трейлера:\n' + range.out);

  // Тот же коммит с трейлером — зелёный: аменд, и диапазон снова чист.
  const amend = git(['commit', '--amend', '-m',
    'chore: правка порога\n\nGate-Change: порог поднят по замеру, причина такая'], { cwd: repo });
  assert.equal(amend.code, 0, 'аменд не прошёл:\n' + amend.out);
  const rangeOk = gate(['--range', base]);
  assert.equal(rangeOk.code, 0, 'трейлер в коммите не принят диапазоном:\n' + rangeOk.out);
  assert.match(rangeOk.out, /Gate-Change/, 'вердикт не назвал трейлер:\n' + rangeOk.out);
});

test('обычная правка трейлера не требует', () => {
  write(path.join(repo, 'src/ok.js'), 'export const ok = 2;\n');
  gitIn(['add', 'src/ok.js']);
  const staged = path.join(tmp, 'plain-msg.txt');
  write(staged, 'feat: правка обычного файла\n');
  const res = gate(['--commit-msg', staged]);
  assert.equal(res.code, 0, 'правка обычного файла потребовала трейлер:\n' + res.out);
  assert.match(res.out, /коммит можно ставить/, 'вердикт не сказал, что коммит ставится:\n' + res.out);
});

test('короткая пометка вместо причины не принимается', () => {
  gitIn(['add', 'pnpm-lock.yaml']);
  const staged = path.join(tmp, 'short-msg.txt');
  write(staged, 'chore: правка базы\n\nGate-Change: ok\n');
  const res = gate(['--commit-msg', staged]);
  assert.equal(res.code, 1, 'пометка без причины принята за обоснование:\n' + res.out);
  assert.match(res.out, /правка гейта без трейлера/, 'красный не назвал причину:\n' + res.out);
});

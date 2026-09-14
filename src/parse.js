import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { Worker, MessageChannel, receiveMessageOnPort } from 'worker_threads';
import { fileURLToPath } from 'url';

/* Разбор модуля: один рабочий поток на прогон вместо запуска Node на каждую
 * клетку.
 *
 * Зачем. Гард компиляции обязан понимать модуль (`import`/`export` в `.js` —
 * обычное дело у проекта с бандлером, см. `strip.js`), а единственный разбор
 * модуля без исполнения — `vm.SourceTextModule` — живёт только под флагом
 * `--experimental-vm-modules`, которого у процесса нет. Раньше это решалось
 * запуском `node --check` на каждую клетку: 97 мс на запуск и минуты на истории,
 * где модуль меняется каждым коммитом.
 *
 * Как. Поток поднимается при первом модуле и живёт до конца прогона, поэтому
 * скриптовые проекты за него не платят вовсе. Обмен синхронный — измерение
 * истории синхронное: запрос уходит `postMessage`, готовность ответа отмечается
 * в `SharedArrayBuffer`, а ответ забирается `receiveMessageOnPort` (тот же приём,
 * что в примере Node для синхронного канала в поток). Поток `unref`-нут: команда
 * заканчивается вместе со своей работой, а не вместе с потоком.
 *
 * Чем платит. Старт потока — разовая цена (~55 мс на машине замера), и разбор
 * опирается на экспериментальный API: флаг `--experimental-vm-modules` передаётся
 * самому потоку, поэтому команда пользователя не меняется. Текст передаётся в
 * поток копией — на файлах в десятки мегабайт это десятки миллисекунд, всё ещё
 * дешевле запуска процесса.
 *
 * Куда отступает. К запуску `node --check` — медленнее, но не мягче: когда файла
 * потока нет (неполная упаковка), когда поток не ответил за отведённое время
 * (умер) и когда в потоке не оказалось `vm.SourceTextModule` (Node без модулей
 * vm). Отступление молчаливое: сломавшийся быстрый путь стоит секунд, а не
 * правильности, и его место стережёт проверка способа разбора (`parseMode`).
 */

const WORKER_FILE = fileURLToPath(new URL('./parse-worker.js', import.meta.url));
const FLAGS = ['--experimental-vm-modules', '--no-warnings'];
const WAIT_MS = 2000;

let parser = null;      // живой поток { worker, port, sig } или null
let hopeless = false;   // поток не поднялся: второй раз не пробуем
let seq = 0;
let mode = null;        // 'thread' | 'node' — чем разобран последний модуль

/* Причина, по которой текст не разбирается как модуль, или null, если
 * разбирается. «Не удалось проверить» наружу не выходит никогда: разбор без
 * потока уходит в `node --check`, а он отвечает тем же — причиной или её
 * отсутствием. */
export function moduleError(text) {
  const fromThread = inThread(text);
  if (fromThread !== undefined) {
    mode = 'thread';
    return fromThread;
  }
  mode = 'node';
  return onNodeCheck(text);
}

/* Способ разбора последнего модуля. Нужен, чтобы быстрый путь не деградировал
 * молча: проверка утверждает, что на проекте с модулями он действительно поток,
 * а не прежний запуск. */
export function parseMode() {
  return mode;
}

function inThread(text) {
  const live = start();
  if (!live) return undefined;
  const id = ++seq;
  // Сначала ноль в том же слове, которым поток отмечает готовность: ответ,
  // пришедший раньше ожидания, иначе было бы видно как «ещё не начинали».
  Atomics.store(live.sig, 0, 0);
  live.port.postMessage({ id: id, text: text });
  if (Atomics.wait(live.sig, 0, 0, WAIT_MS) === 'timed-out') return bury();
  for (;;) {
    const got = receiveMessageOnPort(live.port);
    if (!got) return bury();
    if (got.message.id !== id) continue;   // прежний ответ (поток отвечал не нам)
    if (got.message.available === false) return bury();
    return got.message.error === null ? null : String(got.message.error);
  }
}

function start() {
  if (parser || hopeless) return parser;
  if (!fs.existsSync(WORKER_FILE)) {
    hopeless = true;
    return null;
  }
  const sig = new Int32Array(new SharedArrayBuffer(4));
  const { port1, port2 } = new MessageChannel();
  try {
    const worker = new Worker(WORKER_FILE, {
      execArgv: FLAGS, workerData: { port: port2, sig: sig }, transferList: [port2]
    });
    // Без обработчика ошибка потока стала бы исключением процесса, а её место —
    // в отступлении к запуску.
    worker.on('error', bury);
    worker.on('exit', bury);
    worker.unref();
    parser = { worker: worker, port: port1, sig: sig };
  } catch (_e) {
    hopeless = true;
  }
  return parser;
}

// Поток больше не годится: дальше разбираем запуском, и вернуться уже некуда.
function bury() {
  const dead = parser;
  parser = null;
  hopeless = true;
  if (dead) dead.worker.terminate();
  return undefined;
}

/* Отступление: `node --check` по временному файлу. Расширение `.mjs` здесь не
 * косметика — у временного файла нет манифеста, и только расширение говорит
 * Node, что текст надо читать как модуль. Причина берётся из `stderr`: там
 * сначала эхо строки с ошибкой, потом сам `SyntaxError` и стек. */
function onNodeCheck(text) {
  const tmp = path.join(os.tmpdir(), 'size-table-guard-' + process.pid + '-mod.mjs');
  try {
    fs.writeFileSync(tmp, text);
    execFileSync(process.execPath, ['--check', tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (e) {
    const lines = String((e && e.stderr) || (e && e.message) || e).split('\n')
      .map((l) => l.trim()).filter((l) => l !== '');
    return lines.find((l) => /^\w*Error\b/.test(l)) || lines[0] || 'модуль не разбирается';
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

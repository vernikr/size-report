import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { Worker, MessageChannel, receiveMessageOnPort } from 'worker_threads';
import { fileURLToPath } from 'url';

/* Parsing a module: one worker per run instead of launching Node per cell.
 *
 * Why. The compile guard has to understand a module (`import`/`export` inside `.js` is
 * ordinary in a project with a bundler — see `strip.js`), while the only parse of a module
 * without executing it, `vm.SourceTextModule`, exists only under `--experimental-vm-modules`,
 * which this process is not started with. It used to be solved by `node --check` per cell:
 * 97 ms per launch and minutes across a history where a module changes at every commit.
 *
 * How. The worker starts at the first module and lives until the end of the run, so a
 * script-only project never pays for it. The exchange is synchronous, as history measurement
 * is: the request goes out through `postMessage`, readiness is marked in a `SharedArrayBuffer`,
 * and the answer is taken with `receiveMessageOnPort` — the same trick as in Node's example of
 * a synchronous channel to a worker. The worker is `unref`-ed: the command ends with its
 * work, not with the thread.
 *
 * What it costs. Starting the worker is a one-off (~55 ms on the machine the measurement was
 * taken on), and the parsing relies on an experimental API: the flag is passed to the worker
 * itself, so the user's command does not change. The text is copied into the worker — tens of
 * milliseconds for files of tens of megabytes, still cheaper than launching a process.
 *
 * Where it falls back. To `node --check` — slower, not weaker: when the worker file is missing
 * (an incomplete package), when the worker did not answer in time (it died), and when it turns
 * out to have no `vm.SourceTextModule` (a Node without the vm module). The fallback is silent:
 * a broken fast path costs seconds rather than correctness, and its place is watched by the
 * parse-mode check (`parseMode`).
 */

const WORKER_FILE = fileURLToPath(new URL('./parse-worker.js', import.meta.url));
const FLAGS = ['--experimental-vm-modules', '--no-warnings'];
const WAIT_MS = 2000;

let parser = null;      // the live thread { worker, port, sig } or null
let hopeless = false;   // the thread did not come up: no second try
let seq = 0;
let mode = null;        // 'thread' | 'node' — how the last module was parsed

/* The reason the text does not parse as a module, or null if it does. "Could not check"
 * never leaves this function: without a worker the parse goes to `node --check`, which
 * answers the same way — with a reason or with its absence. */
export function moduleError(text) {
  const fromThread = inThread(text);
  if (fromThread !== undefined) {
    mode = 'thread';
    return fromThread;
  }
  mode = 'node';
  return onNodeCheck(text);
}

/* How the last module was parsed. Kept so that the fast path cannot degrade silently: a
 * check asserts that on a project with modules it really is the worker and not the old
 * launch. */
export function parseMode() {
  return mode;
}

function inThread(text) {
  const live = start();
  if (!live) return undefined;
  const id = ++seq;
  // Zero goes into the same word the worker marks readiness with: an answer arriving before
  // the wait would otherwise look like "not started yet".
  Atomics.store(live.sig, 0, 0);
  live.port.postMessage({ id: id, text: text });
  if (Atomics.wait(live.sig, 0, 0, WAIT_MS) === 'timed-out') return bury();
  for (;;) {
    const got = receiveMessageOnPort(live.port);
    if (!got) return bury();
    if (got.message.id !== id) continue;   // a stale answer (it replied to another request)
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
    // Without a handler a worker error would become an exception of the process, while its
    // place is in the fallback to a launch.
    worker.on('error', bury);
    worker.on('exit', bury);
    worker.unref();
    parser = { worker: worker, port: port1, sig: sig };
  } catch (_e) {
    hopeless = true;
  }
  return parser;
}

// The worker is no longer usable: parsing goes through a launch from here on, with no way
// back.
function bury() {
  const dead = parser;
  parser = null;
  hopeless = true;
  if (dead) dead.worker.terminate();
  return undefined;
}

/* The fallback: `node --check` on a temporary file. The `.mjs` extension is not cosmetic —
 * a temporary file has no manifest, and only the extension tells Node to read the text as a
 * module. The reason comes from `stderr`, which holds the echoed offending line first, then
 * the `SyntaxError` itself and the stack. */
function onNodeCheck(text) {
  const tmp = path.join(os.tmpdir(), 'size-table-guard-' + process.pid + '-mod.mjs');
  try {
    fs.writeFileSync(tmp, text);
    execFileSync(process.execPath, ['--check', tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (e) {
    const lines = String((e && e.stderr) || (e && e.message) || e).split('\n')
      .map((l) => l.trim()).filter((l) => l !== '');
    // The fallback reason travels into a printed refusal, so it is Russian like the rest of the output.
    return lines.find((l) => /^\w*Error\b/.test(l)) || lines[0] || 'модуль не разбирается';
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

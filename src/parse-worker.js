import vm from 'vm';
import { workerData } from 'worker_threads';

/* The parsing worker: it compiles the text and answers with a reason (or with the absence of
 * one). Nothing is executed — `SourceTextModule` only parses the text, so neither `import`
 * nor the code of the module runs: the file of the project stays foreign code that nobody
 * launches.
 *
 * The flags arrive from the main thread (`--experimental-vm-modules`, without which
 * `vm.SourceTextModule` does not exist, and `--no-warnings` lest the experimental warning end
 * up in the command's output). The module may be absent: then the answer carries
 * `available: false`, and the main thread falls back to launching `node --check`.
 *
 * Readiness is marked in shared memory: the main thread waits for it synchronously
 * (`Atomics.wait`), because measuring the history is synchronous.
 */
const { port, sig } = workerData;
const available = typeof vm.SourceTextModule === 'function';

port.on('message', (req) => {
  port.postMessage({ id: req.id, available: available, error: parse(req.text) });
  Atomics.store(sig, 0, 1);
  Atomics.notify(sig, 0);
});

function parse(text) {
  if (!available) return null;
  try {
    new vm.SourceTextModule(text, { identifier: 'module' });
    return null;
  } catch (e) {
    return e.name + ': ' + e.message;
  }
}

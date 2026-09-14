import vm from 'vm';
import { workerData } from 'worker_threads';

/* Рабочий поток разбора: компилирует текст и отвечает причиной (или её
 * отсутствием). Исполнения нет — `SourceTextModule` только разбирает текст,
 * поэтому ни `import`, ни код модуля не выполняются: файл проекта остаётся
 * чужим кодом, который никто не запускает.
 *
 * Флаги приходят от главного потока (`--experimental-vm-modules` — без него
 * `vm.SourceTextModule` не существует, `--no-warnings` — иначе предупреждение об
 * эксперименте ушло бы в вывод команды). Модуля может не быть: тогда ответ несёт
 * `available: false`, и главный поток возвращается к запуску `node --check`.
 *
 * Готовность ответа отмечается в общей памяти: главный поток ждёт её синхронно
 * (`Atomics.wait`), потому что измерение истории синхронное.
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

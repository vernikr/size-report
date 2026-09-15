import fs from 'fs';

/* Метаданные самого пакета: имя и версия читаются из его же манифеста, чтобы не
 * держать вторую копию. Отдельный модуль потому, что эти данные описывают
 * упаковку, а не проект-потребитель, и нужны контракту данных. */

/* Имя и версия пакета — из его же манифеста, чтобы не держать вторую копию; без
 * файла (чужaя сборка) остаётся заглушка: версия нужна только в данных, и
 * отсутствие манифеста не повод не собирать таблицу. */
export let TOOL_PKG = { name: 'size-report', version: '0.0.0' };
try {
  TOOL_PKG = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
} catch (_e) {}

/* Как пакет ставится в проект — та же git-ссылка на выпуск, которой учит `README.md`:
 * имени пакета в реестре здесь быть не может, оно занято чужим пакетом, и `add -D
 * <имя>` поставил бы его. Адрес и версия берутся из манифеста, поэтому совет об
 * установке не может разойтись с выпуском, а без адреса (`null`) звать нечего. */
export function installSpec() {
  const repo = TOOL_PKG.repository === undefined ? ''
    : (typeof TOOL_PKG.repository === 'string' ? TOOL_PKG.repository : TOOL_PKG.repository.url || '');
  const m = repo.match(/github\.com[:/]+([^/\s]+\/[^/\s]+?)(?:\.git)?$/);
  return m === null ? null : 'github:' + m[1] + '#v' + TOOL_PKG.version;
}

import { createRequire } from 'module';

/* Необязательные зависимости: минификатор и токенизатор. Их отсутствие — не отказ,
 * а другой счёт (упрощение вместо сжатия, оценка вместо точного счёта), поэтому
 * загрузка у них общая и с одним устройством: ленивая, синхронная (`createRequire`
 * — замер синхронный проход, и `import()` сделал бы асинхронной всю цепочку ради
 * одного датчика) и без исключения наружу — недоступность возвращается ответом.
 *
 * Шов отсутствия — окружение `SIZE_REPORT_NO_OPTIONAL`: тем же путём идёт установка
 * без необязательных зависимостей и платформа, для которой пакета нет. Им же
 * проверяется, что инструмент работает и без них. */

export const NO_OPTIONAL = 'SIZE_REPORT_NO_OPTIONAL';

/* Версия берётся у самого пакета: число зависит от словаря и от алгоритма, поэтому
 * она попадает в способ, которым получено значение, а не остаётся в `node_modules`. */
export function loadOptional(spec) {
  if (process.env[NO_OPTIONAL]) {
    return { tool: null, version: null, why: 'необязательные зависимости выключены (' + NO_OPTIONAL + ')' };
  }
  const require = createRequire(import.meta.url);
  try {
    const tool = require(spec);
    const pkg = spec.split('/')[0];
    let version = null;
    try { version = require(pkg + '/package.json').version; } catch (_e) { version = null; }
    return { tool: tool, version: version, why: null };
  } catch (e) {
    return { tool: null, version: null, why: e.message };
  }
}

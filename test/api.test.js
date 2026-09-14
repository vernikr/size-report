/* Публичный API пакета: то, чем пользуются точка входа (`bin/size.js`) и тесты.
 * Список заморожен: разбиение движка по модулям не имеет права ни потерять имя,
 * ни добавить лишнее — добавленное имя означает, что наружу просочилась
 * внутренность модуля, а потерянное ломает того, кто на него опирался. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/size-table.js';

// По алфавиту — чтобы сверка не зависела от порядка реэкспортов.
const API = [
  'CATEGORY_EXTS', 'CATEGORY_ORDER', 'CONFIG_NAME', 'DEFAULT_CONFIG', 'EXIT', 'LOCALES',
  'METRICS', 'Refusal', 'STRATEGIES', 'USAGE', 'anchor', 'argValue', 'assertFullHistory',
  'blobAt', 'categoryOf', 'cellHtml', 'cellParts', 'check', 'cliCommand', 'commitParts',
  'compactJson', 'dataMode', 'deltaOf', 'gitRoot', 'group', 'initMode', 'loadConfig',
  'main', 'measureBlob', 'measureHistory', 'minifyForm', 'noteText', 'nowModel', 'pageHtml',
  'pageMode', 'pageScript', 'pageSource', 'parseSections', 'readBlobs', 'readHistory',
  'refuse', 'render', 'reportData', 'rowHref', 'rowModel', 'sectionLink', 'sniffColumns',
  'strategyFor', 'stripCss', 'stripHtml', 'stripJs', 'stripLines', 'stripModules',
  'touchedSection', 'totalsOf', 'validateConfig', 'valueHtml', 'valueParts'
];

test('публичный API не изменился', () => {
  const now = Object.keys(api).sort();
  const lost = API.filter((name) => now.indexOf(name) < 0);
  const extra = now.filter((name) => API.indexOf(name) < 0);
  assert.deepEqual(lost, [], 'из публичного API пропали имена: ' + lost.join(', '));
  assert.deepEqual(extra, [], 'в публичный API попало лишнее: ' + extra.join(', '));
  assert.equal(now.length, API.length, 'публичный API поехал: ' + now.length + ' имён вместо ' + API.length);
});

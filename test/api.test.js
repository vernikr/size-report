/* The package's public API: what the entry point (`bin/size.js`) and the checks use. The list is
 * frozen: splitting the engine into modules may neither lose a name nor add one — an added name means
 * some module's insides leaked out, a lost one breaks whoever leant on it. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/size-table.js';

// In alphabetical order, so that the comparison does not depend on the order of the re-exports.
const API = [
  'CATEGORY_EXTS', 'CATEGORY_ORDER', 'CONFIG_NAME', 'DEFAULT_CONFIG', 'EXIT', 'LOCALES',
  'METRICS', 'Refusal', 'STRATEGIES', 'USAGE', 'anchor', 'argValue', 'assertFullHistory',
  'blobAt', 'categoryOf', 'cellParts', 'check', 'cliCommand', 'commitParts',
  'compactJson', 'dataMode', 'deltaOf', 'esc', 'gitRoot', 'group', 'initMode', 'loadConfig',
  'main', 'measureBlob', 'measureHistory', 'minifyForm', 'nowModel', 'pageHtml',
  'pageScript', 'pageSource', 'parseSections', 'readBlobs', 'readHistory',
  'refuse', 'reportData', 'rowHref', 'rowModel', 'sectionLink', 'sniffColumns',
  'strategyFor', 'stripCss', 'stripHtml', 'stripJs', 'stripLines', 'stripModules',
  'touchedSection', 'totalsOf', 'validateConfig', 'valueParts', 'writeMode'
];

test('the public API did not change', () => {
  const now = Object.keys(api).sort();
  const lost = API.filter((name) => now.indexOf(name) < 0);
  const extra = now.filter((name) => API.indexOf(name) < 0);
  assert.deepEqual(lost, [], 'names disappeared from the public API: ' + lost.join(', '));
  assert.deepEqual(extra, [], 'something extra got into the public API: ' + extra.join(', '));
  assert.equal(now.length, API.length, 'the public API moved: ' + now.length + ' names instead of ' + API.length);
});

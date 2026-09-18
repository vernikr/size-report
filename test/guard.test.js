/* Parsing a module is a price, not a matter of strictness. The compilation guard has to understand a module
 * (`import`/`export` in `.js` is ordinary for a project with a bundler), but a Node run per cell costs tens
 * of milliseconds — minutes over a history where the module changes with every commit. So one worker thread
 * parses the module per run (`src/parse.js`), and the run remains the fallback.
 *
 * What is checked here is what makes the speed-up lawful: parsing goes through the thread rather than
 * quietly falling back; both paths give the same verdict on the same texts; the fallback works without the
 * worker file — with the same verdict rather than in silence; and hundreds of parses in one run are cheaper
 * than a single Node run.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { moduleError, parseMode } from '../src/parse.js';
import { ROOT, tempDir } from '../tools/harness.js';

const tmp = tempDir('guard');

/* Samples — one per fork of the parsing: a module, a script, a module with a top-level `await`, an empty
 * module, a broken module, a broken statement, an unclosed template and markup right in `.js` (which the
 * guard has to tell from its own breakage). */
const SAMPLES = [
  'export const a = 1;\n',
  'const a = 1;\n',
  'export const b = await Promise.resolve(1);\n',
  'export {};\n',
  'export function f() { return 1; }\n',
  'export const a = <div/>;\n',
  'export const a = 1;\nconst b = ;\n',
  'export const a = `текст;\n'
];

/* A copy of one `parse.js` without the worker file — how an incomplete package looks: `parse-worker.js`
 * never arrived. The parsing has to stay as it was: the same verdict rather than silence or a stack. */
function withoutThread() {
  const dir = path.join(tmp, 'no-worker');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'src', 'parse.js'), path.join(dir, 'parse.js'));
  return import(path.join(dir, 'parse.js'));
}

test('a module is parsed in a worker thread rather than by a run', () => {
  assert.equal(moduleError(SAMPLES[0]), null, 'the module did not parse');
  assert.match(moduleError(SAMPLES[5]), /^SyntaxError/, 'a broken module went through in silence');
  assert.equal(parseMode(), 'thread', 'parsing fell back to a Node run — there is no speed-up');
});

test('both paths of parsing give the same verdict', async () => {
  const fallback = await withoutThread();
  SAMPLES.forEach((text) => {
    assert.equal(moduleError(text), fallback.moduleError(text),
      'parsing by thread and by run diverged on ' + JSON.stringify(text));
  });
  assert.equal(parseMode(), 'thread', 'the fast path stopped being a thread');
  assert.equal(fallback.parseMode(), 'node', 'the fallback did not work: the thread did the parsing');
});

test('hundreds of parses are cheaper than one Node run', () => {
  const started = performance.now();
  for (let i = 0; i < 300; i++) moduleError('export const a = ' + i + ';\n');
  const spent = performance.now() - started;
  assert.equal(parseMode(), 'thread');
  // The fallback costs a Node run per parse, so the same 300 texts the old way would take tens of seconds.
  // The threshold is deliberately coarse: the check guards the order of the price, not the machine's
  // ticking.
  assert.ok(spent < 1000,
    '300 parses took ' + spent.toFixed(0) + ' ms — that looks like a run per text');
});

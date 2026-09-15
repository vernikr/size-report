/* Four promises of the documentation: **it calls only what the tool knows** (commands and flags from
 * the help rather than from a second list), **it names the refusal causes that exist**, **it refers to
 * sections that exist** and **it calls the tool in a way that works without the package installed**.
 *
 * Causes with code 2 are held by a registry: `CONFIG_CAUSES` in `src/refusal.js` is the one place where
 * they are listed in words, the help prints them from it, and the code table of `README.md` has to name
 * the same list — or the document would again say less than happens.
 *
 * What is not checked by machine here, said out loud rather than hidden: wording and meaning, promises
 * about the future (the "not yet" sections do not pass the check — they name the absent, and demanding
 * that it exist would forbid planning), and the count of causes matching the number of refusals in the
 * engine by message text — that one holds through the registry: a cause without a record in it never
 * reaches a user, because `refuseCause` will not let it through.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, gitIn } from '../tools/harness.js';
import { CONFIG_CAUSES, USAGE, refuseCause } from '../src/refusal.js';
import { TOOL_PKG } from '../src/tool.js';

/* Instructions are what a reader launches the tool by: the package's README and the note in the
 * templates. Calls are checked there alone: the other documents name the target surface, the history or
 * the past, where former calls are in place. */
const INSTRUCTIONS = ['README.md', 'templates/README.md'];
import {
  DOCS, NOT_TODAY, PKG, TARGETS, callWords, facts, invocations, read, sectionsOf,
  usageCommands, usageFlags
} from '../tools/docs-facts.js';

/* Causes from the help: the engine prints them from the same registry, so the lines are parsed rather
 * than compared by eye. */
function usageCauses() {
  const block = USAGE.split('Причины отказа кодом 2')[1] || '';
  return block.split('\n').filter((l) => l.indexOf(': ') > 0).map((l) => {
    const m = l.trim().match(/^(.+?): (.+)$/);
    return [m[1], m[2].split(' · ')];
  });
}

/* Causes from the code table of `README.md`: the row `| 2 | … |`, holding groups shaped
 * `**name** (cause, cause)`. */
function readmeCauses() {
  const rows = read('README.md').split('\n').filter((l) => /^\|\s*2\s*\|/.test(l));
  assert.ok(rows.length > 0, 'в таблице кодов README нет строки про код 2 — сверить нечего');
  const cell = rows[0].split('|')[2];
  const found = [...cell.matchAll(/\*\*(.+?)\*\* \(([^)]+)\)/g)];
  return found.map((m) => [m[1], m[2].split(', ')]);
}

/* Refusals declared by the engine itself: `refuseCause('cause', …)`. The list of sites is kept by a
 * check rather than by a comment: a bare `refuse(EXIT.CONFIG` in the engine is a cause nobody named.
 * The first argument has to be a literal — the check has nothing to parse a ternary with, and a cause
 * hidden behind an expression would not read at a glance. */
function emittedCauses() {
  // The home of the mechanism itself is left out of the count: in `refusal.js` a refusal is only put
  // together, while those who name the cause are the ones who hand it out.
  const out = new Set();
  const files = gitIn(ROOT, ['ls-files', 'src']).split('\n')
    .filter((f) => /\.js$/.test(f) && f !== 'src/refusal.js');
  files.forEach((f) => {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    [...text.matchAll(/refuseCause\(([^\n]*)/g)].forEach((m) => {
      const literal = m[1].match(/^'([^']+)'/);
      assert.ok(literal !== null, 'в ' + f + ' причина отказа не названа литералом: ' + m[0].trim());
      out.add(literal[1]);
    });
  });
  return out;
}

const escapedName = PKG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('документация зовёт только существующие команды и ключи', () => {
  // What is checked is the instructions — the package's README and the note in the templates: they are
  // read by someone about to run something. Other documents name the target surface, commands the CLI
  // does not have yet — that is a plan, and demanding today's CLI of it would forbid planning.
  const bad = [];
  INSTRUCTIONS.forEach((doc) => {
    invocations(facts(doc, NOT_TODAY[doc])).forEach((call) => {
      if (!new RegExp('^(?:size|pnpm exec size|npm exec size|node node_modules/'
        + escapedName + '/bin/size\\.js|node bin/size\\.js|npx ' + escapedName + ')(\\s|$)').test(call)) return;
      const words = callWords(call);
      if (words.length === 0) return;
      const known = usageCommands.indexOf(words[0]) >= 0;
      if (!known && words[0][0] !== '-') {
        // The first word can only be a command or a mode flag; anything else is a call to a command
        // that does not exist (but only if it is a word rather than, say, the `…` or `<sha>` of a
        // template).
        if (/^[a-z][a-z-]*$/.test(words[0])) {
          bad.push(doc + ': команда «' + words[0] + '» (в «' + call + '»)');
        }
        return;
      }
      (known ? words.slice(1) : words).forEach((w) => {
        if (w[0] !== '-' || usageFlags.indexOf(w) >= 0) return;
        bad.push(doc + ': ключ ' + w + ' в «' + call + '»');
      });
    });
  });
  assert.deepEqual(bad, [], 'документация зовёт то, чего инструмент не знает:\n  ' + bad.join('\n  '));
});

test('документация зовёт инструмент так, что зов работает и без установленного пакета', () => {
  /* The promised call has two states and the advice has to work in both: with the package installed it
   * does what was promised, without it, it refuses on the spot. A call by the package name manages
   * neither: without the package nearby it goes to the registry and runs the revision served there,
   * which is not the one the project pinned. Hence the instructions name a path inside the project, and
   * the call carries no package name. */
  const escaped = TOOL_PKG.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byName = new RegExp('^(?:npx|npm exec|yarn) ' + escaped + '(\\s|$)');
  const bad = [];
  INSTRUCTIONS.forEach((doc) => {
    invocations(facts(doc, NOT_TODAY[doc])).forEach((call) => {
      if (byName.test(call)) bad.push(doc + ': «' + call + '»');
    });
  });
  assert.deepEqual(bad, [], 'зов идёт по имени пакета, а не путём внутри проекта:\n  ' + bad.join('\n  '));
});

test('причины отказа совпадают у движка, справки и таблицы кодов README', () => {
  assert.deepEqual(usageCauses(), CONFIG_CAUSES,
    'справка называет не те причины, что объявлены в CONFIG_CAUSES');
  assert.deepEqual(readmeCauses(), CONFIG_CAUSES,
    'таблица кодов README называет не те причины, что объявлены в CONFIG_CAUSES');

  // The other side: a cause declared and printed while nobody hands it out is a promise of a refusal
  // that never happens and a place in the documentation a reader looks for in vain.
  const emitted = emittedCauses();
  const declared = new Set(CONFIG_CAUSES.map((g) => g[1]).flat());
  const silent = [...declared].filter((c) => !emitted.has(c));
  assert.deepEqual(silent, [], 'причины объявлены, но никем не выдаются: ' + silent.join(', '));
  const undeclared = [...emitted].filter((c) => !declared.has(c));
  assert.deepEqual(undeclared, [], 'отказы называют причины, которых нет в списке: ' + undeclared.join(', '));

  // A bare refusal with code 2 bypassing the cause is the same thing, only quieter: the cause would
  // appear in the behaviour and not in the documentation.
  const bare = gitIn(ROOT, ['grep', '-l', '-F', 'refuse(EXIT.CONFIG', '--', 'src'])
    .split('\n').filter((f) => f !== '' && f !== 'src/refusal.js');
  assert.deepEqual(bare, [], 'отказ кодом 2 в обход причины (refuseCause) в: ' + bare.join(', '));

  // The mechanism is live rather than decorative: a cause that is not in the registry never reaches a
  // user.
  assert.throws(() => refuseCause('выдуманная причина', 'текст'),
    /причина отказа не объявлена/, 'refuseCause пропустил неназванную причину');
});

test('ссылки на разделы ведут в существующие разделы', () => {
  const sections = {};
  TARGETS.forEach((f) => { sections[path.basename(f)] = sectionsOf(read(f)); });

  const bad = [];
  DOCS.forEach((doc) => {
    read(doc).split('\n').forEach((line) => {
      [...line.matchAll(/§\s*(\d+(?:\.\d+)*|[BN]\d+)/g)].forEach((m) => {
        const key = m[1];
        const before = line.slice(0, m.index);
        // The nearest document name: right after the reference ("§4.3 `module-design.md`") or before it
        // ("`PLAN.md` §5"). With no name it is a reference to a section of the requirements — that is
        // how they are referred to ("requirement §4.2").
        const after = line.slice(m.index + m[0].length).match(/^\s*`?([\w.-]+\.md)`?/);
        const named = (after && sections[after[1]] !== undefined && after[1])
          || [...before.matchAll(/`?([\w.-]+\.md)`?/g)].reverse().map((n) => n[1])
            .find((n) => sections[n] !== undefined)
          || (/(?:требовани|требований)/.test(line) ? 'requirements.md' : null);
        // A reference with no document name is a § of the journal or of a plan, and there is nothing to
        // resolve it against: anyone is free to plan and number as they like. Silence is more honest
        // than a guess here.
        if (named === null || sections[named] === undefined) return;
        if (!sections[named].has(key)) bad.push(doc + ': §' + key + ' → ' + named);
      });
    });
  });
  assert.deepEqual(bad, [], 'ссылки ведут в несуществующие разделы:\n  ' + bad.join('\n  '));
});

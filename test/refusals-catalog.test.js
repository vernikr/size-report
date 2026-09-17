/* The catalogue of refusals: every refusal site has a line of its own, and every line has a guard.
 * No runs happen here at all: the declarations themselves are checked, which makes the file cheap
 * and puts it in the fast run. Live execution of refusals is in `test/refusals.test.js` (a run per
 * case, and that is expensive).
 *
 * What is guarded. The maps `SITES` (refusals thrown as exceptions) and `PRINTED` (refusals marked
 * "✗" and carried by a code) hold the counts of the sites in the sources: a new site changes a count,
 * and without a line in the catalogue the run is red. Hence the main promise: **a refusal cannot
 * appear without a check** — a false reason in a text used to be found by an accidental live run,
 * four times in a row.
 *
 * The second: refusals the catalogue hands to another check (`coveredBy`) are named not as "checked
 * somewhere" but by the file and the phrases that file asserts. A check that disappeared or a phrase
 * that was rewritten shows here as a discrepancy.
 *
 * What the check does not take is said in the catalogue's header: wording outside the phrases, the
 * sense, and `--json`. One exception is named explicitly and as a closed list: a refusal no run can
 * bring about has to explain why (there is exactly one today).
 *
 * The three runs are split by subject: counting the sites in the sources, the presence of a case for
 * a site, the execution of an advice. Each reads the tree itself, so the order between them does not
 * matter, while a red run names its own subject rather than "the catalogue in general".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CASES, PRINTED, SITES } from '../tools/refusals.js';
import { ROOT, gitIn } from '../tools/harness.js';

test('refusals another check guards are named, and that check really asserts them', () => {
  const covered = CASES.filter((c) => c.coveredBy !== undefined);
  assert.ok(covered.length > 0, 'the catalogue holds no refusal pointing at another check');
  covered.forEach((c) => {
    const file = path.join(ROOT, c.coveredBy);
    assert.ok(fs.existsSync(file), 'the check the catalogue hands a refusal to was not found: ' + c.coveredBy);
    const text = fs.readFileSync(file, 'utf8');
    c.must.forEach((phrase) => {
      assert.ok(text.indexOf(phrase) >= 0, 'the file ' + c.coveredBy + ' carries no claim «' + phrase
        + '» for the refusal «' + c.key + '» — so the refusal is left without a guard');
    });
  });
});

/* The refusal sites in the sources: a cause from the registry and a code from the table are two ways
 * to refuse, and both are counted. `src/refusal.js` is not counted: it is the mechanism of refusal
 * rather than a place where the tool refuses. The walk goes over the git tree, so a site in a
 * subdirectory (`src/strip/guard.js`, `src/page/*`) is found as well, and a missed site is exactly
 * what the check must not miss. The list comes from git, as in the neighbouring check of causes
 * (`docs-commands`): a second list would diverge from the first in silence. */
function refusalSites() {
  const found = new Map();
  const bump = (key) => found.set(key, (found.get(key) || 0) + 1);
  const files = gitIn(ROOT, ['ls-files', 'src']).split('\n')
    .filter((f) => f.endsWith('.js') && f !== 'src/refusal.js');
  const printed = {};
  files.forEach((f) => {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    [...text.matchAll(/refuseCause\('([^']+)'/g)].forEach((m) => bump(m[1]));
    [...text.matchAll(/refuse\(EXIT\.([A-Z]+)/g)].forEach((m) => bump('EXIT.' + m[1]));
    const marks = [...text.matchAll(/'✗ /g)].length;
    if (marks > 0) printed[f] = marks;
  });
  return { found: found, printed: printed };
}

test('every refusal site in the sources has a line in the catalogue', () => {
  const { found, printed } = refusalSites();
  const declared = new Map(Object.entries(SITES));
  const missing = [...found.keys()].filter((k) => !declared.has(k));
  assert.deepEqual(missing, [], 'the sources hold a refusal site with no line in the catalogue (tools/refusals.js): '
    + missing.join(', '));
  const phantom = [...declared.keys()].filter((k) => !found.has(k));
  assert.deepEqual(phantom, [], 'the catalogue declares a refusal the sources do not hold: ' + phantom.join(', '));
  const diff = [...declared.keys()].filter((k) => found.get(k) !== declared.get(k))
    .map((k) => k + ' (' + declared.get(k) + ' in the catalogue, ' + found.get(k) + ' in the sources)');
  assert.deepEqual(diff, [], 'the number of refusal sites diverged from the catalogue: ' + diff.join('; ')
    + ' — a new site has to bring its own line and its own check');

  // Refusals marked "✗" with a code: their mechanism is another one (a mark and a code rather than an
  // exception), and the same counting holds them. The map holds non-refusals too (`src/hook.js`
  // writes to the hook's log, `src/doctor.js` marks the report) so that a new "✗" in those files does
  // not slip through in silence.
  assert.deepEqual(printed, PRINTED, 'the number of refusals marked «✗» diverged from the map PRINTED'
    + ' (tools/refusals.js) — a new site has to bring its own line');
});

test('every refusal site has a case in the catalogue', () => {
  const declared = new Map(Object.entries(SITES));
  // A site with no line in the catalogue, no reference to another check and no named reason why no
  // run can catch it is guarded by nobody. Counting the sites does not catch this: the site and the
  // map's line agree while the site has no check.
  const named = new Set(CASES.map((c) => (c.id === undefined ? c.key : c.id)));
  const noCase = [...declared.keys()].filter((k) => !named.has(k));
  assert.deepEqual(noCase, [], 'the refusal site has neither a case in the catalogue nor a named'
    + ' reason why no run can catch it: ' + noCase.join(', '));

  /* An advice is the second half of a refusal: naming the cause is not enough, an exit has to be
   * given. Every case says what it advises (`advice`), and for the cases another check guards
   * entirely this is the only place where it is visible what the advice is checked with: a file and
   * a line in it. Live execution of the declared advices is in `test/refusals.test.js`. */
  const silent = CASES.filter((c) => !Array.isArray(c.advice));
  assert.deepEqual(silent.map((c) => (c.id === undefined ? c.key : c.id)), [],
    'the case does not say what the refusal advises (advice: [] if there is none)');
  CASES.filter((c) => c.uncatchable !== undefined).forEach((c) => {
    assert.deepEqual(c.advice, [], '«' + c.id + '»: a refusal no run can bring about'
      + ' cannot advise anything — nobody reads its output');
  });

  // The closed list of what no run can check: the reason is said in words.
  const loose = CASES.filter((c) => c.uncatchable !== undefined);
  assert.deepEqual(loose.map((c) => c.id), ['internal error'],
    'the list of uncheckable refusals changed — that is a decision rather than a detail, and it has to be named');
  loose.forEach((c) => {
    assert.ok(c.uncatchable.length > 40, 'the uncheckable refusal «' + c.id + '» did not explain why no run can catch it');
  });
});

test('the check a refusal is handed to really runs the advice it gets', () => {
  const unfixed = [];
  CASES.forEach((c) => c.advice.forEach((a) => {
    if (a.kind !== 'coveredBy') return;
    const file = path.join(ROOT, a.file);
    if (!fs.existsSync(file)) {
      unfixed.push((c.id === undefined ? c.key : c.id) + ': no such file ' + a.file);
      return;
    }
    if (fs.readFileSync(file, 'utf8').indexOf(a.text) < 0) {
      unfixed.push((c.id === undefined ? c.key : c.id) + ': the file ' + a.file + ' carries no line «' + a.text + '»');
    }
  }));
  assert.deepEqual(unfixed, [], 'an advice was handed to another check, and that check does not run it:\n  ' + unfixed.join('\n  '));
});

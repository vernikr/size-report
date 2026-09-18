/* Coverage (`size check`) and the explanation of a skipped row (`size explain`).
 *
 * Both commands answer questions that otherwise take manual sorting out: "did the change pass the report
 * by?" and "why has this commit no row?". So they are checked by cases taken from the fixture — real
 * commits: "report only", "a character replaced without a change in volume", "journal only", a merge —
 * and by what the tool has no right to assert: a path declared a column or an exception must not count as
 * uncovered, and a settings fix must not shift the report's numbers.
 *
 * The shared clone is read-only for the suite: both commands write nothing, and the cases that do write take
 * a clone of their own. There are many runs here — one per case, each a process run and several git calls —
 * and that is the whole cost of the file.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  cloneFixture, configWith, firstLine, gitIn, hasStack, runFixture, runSize, sharedClone, tempDir
} from '../tools/harness.js';

const tmp = tempDir('check');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const dir = sharedClone('plain', tmp);

// A path that is neither a column of the fixture nor in its exceptions: coverage is what brings it up.
// The commit that brought it is the first of the history (`3294a69`).
const LOOSE = 'README.md';
const LOOSE_SINCE = '3294a69';
// Commits of the fixture that were dropped without a row (the `--json` reference says the same).
const ONLY_REPORT = 'cd78fd9';
const NO_VOLUME = '9fee206';

test('completeness: an uncovered path is named together with the commit and a repair', () => {
  const res = runFixture(dir, ['check']);
  assert.equal(res.code, 1, 'a path outside the columns did not become a violation:\n' + res.stdout + res.stderr);
  assert.equal(hasStack(res.stdout + res.stderr), false, 'the answer came with a stack instead of an explanation');
  assert.ok(res.stdout.indexOf(LOOSE) >= 0, 'the uncovered path is not named:\n' + res.stdout);
  assert.ok(res.stdout.indexOf(LOOSE_SINCE) >= 0, 'the commit that brought the path in is not named:\n' + res.stdout);
  assert.match(res.stdout, /fix: .*--init/, 'there is no ready repair command:\n' + res.stdout);
});

test('completeness: it says which part of the history is covered and who dropped out', () => {
  const res = runFixture(dir, ['check', '--json']);
  assert.equal(res.code, 1);
  const rep = JSON.parse(res.stdout);
  assert.equal(rep.schema, 1, 'the answer has no schema — an agent has nothing to branch on');
  assert.equal(rep.ok, false);
  assert.deepEqual(rep.paths.unknown.map((u) => u.path), [LOOSE], 'the wrong paths are named');
  assert.equal(rep.paths.unknown[0].since.slice(0, 7), LOOSE_SINCE, 'the evidence points at the wrong commit');
  assert.equal(rep.history.commits, 16, 'the wrong history is counted');
  assert.equal(rep.history.rows, 14, 'the report does not hold 14 rows');
  assert.deepEqual(rep.history.byReason, { merge: 0, report: 1, flat: 1 },
    'the commits that dropped out are sorted by the wrong causes');
  assert.deepEqual(rep.history.dropped.map((d) => d.reason).sort(), ['flat', 'report']);

  const text = runFixture(dir, ['check']).stdout;
  assert.ok(text.indexOf(ONLY_REPORT) >= 0 && text.indexOf(NO_VOLUME) >= 0,
    'the text does not name the commits that dropped out without a row:\n' + text);
  assert.match(text, /report only 1/, 'the text carries no summary by causes:\n' + text);
});

test('completeness: a path that became a column or an exclusion closes the violation', () => {
  const asSkip = configWith(tmp, 'skip.json', (cfg) => { cfg.skip = [LOOSE]; });
  const asColumn = configWith(tmp, 'column.json', (cfg) => {
    cfg.columns.push({ label: LOOSE, paths: [LOOSE] });
  });
  [[asSkip, 'as a skip'], [asColumn, 'as a column']].forEach(([file, how]) => {
    const res = runSize(dir, ['--config', file, 'check', '--json']);
    assert.equal(res.code, 0, 'the path declared ' + how + ' did not close completeness:\n'
      + res.stdout + res.stderr);
    const rep = JSON.parse(res.stdout);
    assert.equal(rep.ok, true, 'completeness is declared incomplete, though the paths are dealt with');
    assert.deepEqual(rep.paths.unknown, [],
      'false uncovered paths: ' + JSON.stringify(rep.paths.unknown));
    assert.equal(rep.history.rows, 14, 'the settings repair moved the numbers of the report: there are now '
      + rep.history.rows);
  });

  const text = runSize(dir, ['--config', asSkip, 'check']);
  assert.match(firstLine(text.stdout), /every touched path is tracked or excluded/,
    'with full coverage the tool did not say so outright:\n' + text.stdout);
});

test('explanation: the numbers did not move — the file of the column is named and there is nothing to do', () => {
  const res = runFixture(dir, ['explain', NO_VOLUME]);
  assert.equal(res.code, 0, 'the explanation returned a refusal code:\n' + res.stdout + res.stderr);
  assert.match(res.stdout, /the numbers did not move/, 'the cause named is the wrong one:\n' + res.stdout);
  assert.ok(res.stdout.indexOf('src/code.js') >= 0, 'the file of the column the commit touched is not named');
  assert.match(res.stdout, /fix: not needed/, 'a repair is offered where there is nothing to repair');
});

test('explanation: a commit of the report alone — the cause, and that it is not a defect', () => {
  const res = runFixture(dir, ['explain', ONLY_REPORT]);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /only the report itself was touched/, 'the cause named is the wrong one:\n' + res.stdout);
  assert.ok(res.stdout.indexOf('docs/size-table.html') >= 0, 'the report file is not named');
});

test('explanation: there is a row — and which one is said', () => {
  const res = runFixture(dir, ['explain', '25e3f39', '--json']);
  assert.equal(res.code, 0);
  const rep = JSON.parse(res.stdout);
  assert.equal(rep.reason, null, 'a commit with a row is given a reason for being skipped');
  assert.equal(rep.row, 2, 'the row of the commit is the wrong one: ' + rep.row);
  assert.equal(rep.rows, 14);
  assert.deepEqual(rep.touched.columns.sort(), ['WORKLOG.md', 'src/code.js'],
    'the files of the columns the commit touched are not named');
  assert.deepEqual(rep.touched.untracked, [], 'an uncovered path is invented: ' + JSON.stringify(rep.touched));
});

/* A difference that is not in the report's row: "outside the columns" is not the same thing as "the
 * numbers did not move". A commit touching the journal alone shows it: the journal is not tracked as a
 * column, its volume does not shift, and a person needs to know why exactly there is no row. */
test('explanation: a commit outside the columns differs from "the numbers did not move"', () => {
  const file = configWith(tmp, 'few.json', (cfg) => {
    cfg.columns = [{ label: 'code.js', paths: ['src/code.js'] }];
  });
  const res = runSize(dir, ['--config', file, 'explain', '9dfe679', '--json']);
  assert.equal(res.code, 0);
  const rep = JSON.parse(res.stdout);
  assert.equal(rep.reason, 'outside', 'a commit outside the columns is given a cause of the wrong kind: ' + rep.reason);
  assert.deepEqual(rep.touched.untracked, ['WORKLOG.md'], 'the path left outside the columns is not named');
  assert.deepEqual(rep.touched.columns, [], 'columns the commit did not touch are named');
  assert.match(rep.fix, /as a column or to "skip"/, 'the repair does not say what to do with such a path');
});

/* One judgement about "outside the columns" and one phrase for it in two answers: `check` asks about the
 * whole history, `explain` about one commit, while the fix text is shared (`src/config.js`) and names the
 * paths. Two phrases for one situation would be a defect: the viewer gets two different commands, and one
 * of them may go out without the names. */
test('outside the columns: completeness and the explanation say one phrase with the names of the paths', () => {
  const file = configWith(tmp, 'outside.json', (cfg) => {
    cfg.columns = [{ label: 'code.js', paths: ['src/code.js'] }];
  });
  const STEM = 'add these paths as a column or to "skip" of size-table.config.json: ';
  const rep = JSON.parse(runSize(dir, ['--config', file, 'explain', '9dfe679', '--json']).stdout);
  assert.equal(rep.fix.slice(0, STEM.length), STEM,
    'the explanation speaks about such a path in its own words:\n' + rep.fix);
  assert.ok(rep.fix.indexOf(rep.touched.untracked[0]) > 0,
    'the repair of the explanation did not name the path:\n' + rep.fix);

  const text = runSize(dir, ['--config', file, 'check']).stdout;
  const head = '  fix: ';
  const line = text.split('\n').filter((l) => l.indexOf(head) === 0).pop();
  assert.notEqual(line, undefined, 'completeness did not say what to do:\n' + text);
  assert.equal(line.slice(head.length, head.length + STEM.length), STEM,
    'completeness speaks about such a path in its own words:\n' + line);
  assert.ok(line.indexOf(rep.touched.untracked[0]) > head.length,
    'the repair of completeness did not name the path:\n' + line);
});

/* A commit with no files (`git commit --allow-empty`) is the same case from the other end: nothing was left
 * outside the columns, and a repair command without names would be a lie about what to fix. So there is no
 * fix at all here rather than a text with an empty list. */
test('explanation: a commit with no files — no repair rather than a command without names', () => {
  const side = cloneFixture(path.join(tmp, 'empty'));
  gitIn(side, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local',
    'commit', '-q', '--allow-empty', '-m', 'пустой коммит']);
  const sha = gitIn(side, ['rev-parse', 'HEAD']).trim();
  const res = runFixture(side, ['explain', sha, '--json']);
  assert.equal(res.code, 0, 'the explanation of an empty commit is not an answer:\n' + res.stdout + res.stderr);
  const rep = JSON.parse(res.stdout);
  assert.equal(rep.reason, 'outside', 'the reason for the skip is the wrong one: ' + rep.reason);
  assert.deepEqual(rep.touched.untracked, [], 'an empty commit is given touched paths');
  assert.equal(rep.fix, null, 'a repair without names is offered: ' + JSON.stringify(rep.fix));

  const text = runFixture(side, ['explain', sha]).stdout;
  assert.equal(/fix:/.test(text), false, 'the text carries a repair command without names:\n' + text);
});

test('explanation: a merge is explained by the setting that hid it', () => {
  const file = configWith(tmp, 'nomerge.json', (cfg) => { cfg.rows.merges = false; });
  const res = runSize(dir, ['--config', file, 'explain', '9326134']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /the commit is a merge/, 'the cause named is the wrong one:\n' + res.stdout);
  assert.match(res.stdout, /rows\.merges/, 'it is not said which setting hides the row');
  assert.match(res.stdout, /"merges": true/, 'there is no ready value for the repair');
});

/* A commit is called the way git calls it: `HEAD`, a branch, `HEAD~1`. The defect class: a name the tool
 * does not understand must not be answered as "no such commit" — that would be a lie about what the person
 * was looking for. */
test('explanation: a commit is named by a revision name, and the answer is the same as by sha', () => {
  [['HEAD', 'HEAD'], ['HEAD~1', 'HEAD~1'], ['main', 'HEAD']].forEach(([name, rev]) => {
    const sha = gitIn(dir, ['rev-parse', rev]).trim();
    const byName = runFixture(dir, ['explain', name, '--json']);
    const bySha = runFixture(dir, ['explain', sha, '--json']);
    assert.equal(byName.code, 0, 'the revision name «' + name + '» was not explained (code '
      + byName.code + '):\n' + byName.stdout + byName.stderr);
    assert.deepEqual(JSON.parse(byName.stdout), JSON.parse(bySha.stdout),
      'the answer by the name «' + name + '» diverged from the answer by the sha ' + sha.slice(0, 7));
  });
});

/* Two different causes that are easy to merge into one: there is no such name at all, and the name exists
 * while the commit is not in the report's history (another branch). The second is not "no such commit":
 * the commit exists, and that is exactly what a person needs to hear, together with its sha. */
test('explanation: a name that does not exist and a commit outside the history are different causes', () => {
  const typo = runFixture(dir, ['explain', 'maser']);
  assert.equal(typo.code, 2, 'an invented name is not a refusal:\n' + typo.stdout + typo.stderr);
  assert.equal(hasStack(typo.stderr), false, 'the refusal printed a stack');
  assert.match(typo.stderr, /is not a revision name and not the start of a sha/,
    'the refusal did not name the real cause:\n' + typo.stderr);
  assert.match(typo.stderr, /git log/, 'the refusal gives no ready command');

  // A branch aside from the current history: the commit exists, but the report builds no row for it.
  const side = cloneFixture(path.join(tmp, 'side'));
  gitIn(side, ['checkout', '-q', '-b', 'side']);
  gitIn(side, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local',
    'commit', '-q', '--allow-empty', '-m', 'ветка мимо отчёта']);
  const sha = gitIn(side, ['rev-parse', 'side']).trim();
  gitIn(side, ['checkout', '-q', 'main']);

  const away = runFixture(side, ['explain', 'side']);
  assert.equal(away.code, 2, 'a commit outside the history of the report is not a refusal:\n' + away.stdout + away.stderr);
  assert.match(away.stderr, /not in the history of the report/, 'the cause named is the wrong one:\n' + away.stderr);
  assert.ok(away.stderr.indexOf(sha.slice(0, 7)) >= 0,
    'the refusal did not name the sha of the commit asked about:\n' + away.stderr);
  assert.ok(!/is not a revision name and not the start of a sha/.test(away.stderr),
    'a commit that exists is called non-existent:\n' + away.stderr);
});

test('command refusals: an unknown word, an unknown commit, an ambiguous prefix', () => {
  const unknown = runFixture(dir, ['sizes']);
  assert.equal(unknown.code, 2, 'an unknown command is not a refusal:\n' + unknown.stdout + unknown.stderr);
  assert.match(unknown.stderr, /--help/, 'the refusal does not lead to the help');

  const absent = runFixture(dir, ['explain', 'zzzzzzz']);
  assert.equal(absent.code, 2);
  assert.equal(hasStack(absent.stderr), false, 'the refusal printed a stack');
  assert.match(absent.stderr, /is not a revision name and not the start of a sha/,
    'the refusal did not name the real cause:\n' + absent.stderr);
  assert.match(absent.stderr, /git log/, 'the refusal gives no ready command');

  // A short prefix matches several commits of the fixture — here the choice is a person's.
  const many = runFixture(dir, ['explain', '9']);
  assert.equal(many.code, 2);
  assert.match(many.stderr, /is ambiguous/, 'an ambiguous prefix is resolved in silence:\n' + many.stderr);
  assert.match(many.stderr, /9dfe679/, 'the refusal carries no matching commits');
});

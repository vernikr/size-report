/* Templates for a project that wires the tool in: a settings draft and a CI check description.
 *
 * They travel in the delivery as a promise — "take it and put it down, no edits needed" — and they are
 * carried out by a foreign project rather than by this repository. So the promise is checked here, or a
 * template would rot in silence: the draft has to pass the settings check (the very one its first run
 * meets) and assemble a real report, while the check description has to parse and call only the commands
 * and flags the tool really has.
 *
 * The check takes the files from the repository rather than from the tarball: whether a template reaches
 * the delivery is the business of `tools/pack-check.js`, where it is compared byte for byte.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONFIG, USAGE, loadConfig } from '../src/size-table.js';
import { ROOT, cloneFixture, readJson, runSize, tempDir } from '../tools/harness.js';
import { PKG } from '../tools/docs-facts.js';
import { parseWorkflow } from '../tools/yaml.js';

/* The package name comes from the manifest: a template has to name the same name as the tool's advice
 * (`node_modules/<name>/bin/size.js`), and renaming the package has to break these checks rather than
 * hollow them out. */
const PKG_RE = PKG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const INSTALL_RE = new RegExp('^node node_modules/' + PKG_RE + '/bin/size\\.js\\s');
const BY_NAME_RE = new RegExp('(^|\\s)(?:npx|npm exec|yarn)\\s+' + PKG_RE + '(\\s|$)');

const tmp = tempDir('templates');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const TEMPLATES = path.join(ROOT, 'templates');
const DRAFT = path.join(TEMPLATES, 'size-report.config.json');
const WORKFLOW = path.join(TEMPLATES, 'ci.yml');
const NOTE = path.join(TEMPLATES, 'README.md');

/* The flags the tool knows: the help is the only place where they are declared for a person, so a flag of
 * a template that is not there is either a command from the future or a typo, and both are better caught
 * here. */
function knownFlags() {
  return [...USAGE.matchAll(/--[a-z][a-z-]*/g)].map((m) => m[0]);
}

// The tool's flags named in a command: `…/bin/size.js --write` → ['--write'].
function flagsOf(command) {
  return [...command.matchAll(/--[a-z][a-z-]*/g)].map((m) => m[0]);
}

test('черновик настроек проходит проверку инструмента', () => {
  const draft = readJson(DRAFT);
  const known = Object.keys(DEFAULT_CONFIG);
  Object.keys(draft).forEach((key) => {
    assert.ok(known.indexOf(key) >= 0, 'в черновике ключ, которого инструмент не знает: ' + key);
  });

  /* The settings check — the very one the draft meets on its first run: `loadConfig` reads the file, adds
   * the defaults and checks what came out. */
  const cfg = loadConfig(DRAFT);
  assert.ok(cfg.columns.length > 0, 'в черновике нет ни одной колонки');
  assert.equal(cfg.output.indexOf('..'), -1, 'файл таблицы выведен за пределы проекта');

  /* The commands a draft names have to exist: `fixCommand` is quoted by the report's caption and by
   * refusals, and a command from the future would lead a reader into a dead end. */
  const known2 = knownFlags();
  flagsOf(cfg.fixCommand).forEach((flag) => {
    assert.ok(known2.indexOf(flag) >= 0, 'черновик зовёт ключ, которого нет в справке: ' + flag);
  });

  /* The shape of the call itself: a path inside the project rather than a name from the registry. A name
   * in the command (`npx <name>`) goes to the registry in a project without the installed package and
   * pulls it over the network — the advice meant to rescue a person would depend on the registry. */
  assert.match(cfg.fixCommand, INSTALL_RE,
    'черновик советует не путь внутри проекта: ' + cfg.fixCommand);
  assert.equal(BY_NAME_RE.test(cfg.fixCommand), false,
    'черновик советует зов по имени пакета: ' + cfg.fixCommand);

  /* The note about the templates is what a project goes by: a file it is silent about (or one that is
   * absent) is a description that has drifted from the delivery. */
  const note = fs.readFileSync(NOTE, 'utf8');
  ['size-report.config.json', 'ci.yml'].forEach((file) => {
    assert.ok(fs.existsSync(path.join(TEMPLATES, file)), 'в шаблонах нет ' + file);
    assert.ok(note.indexOf(file) >= 0, 'записка о шаблонах не называет ' + file);
  });
  assert.ok(note.indexOf('AGENTS.md') >= 0,
    'записка молчит о том, чего в шаблонах нет намеренно: это читатель ищет там первым делом');
});

test('описание проверки в CI разбирается и запускает то, что заявлено', () => {
  const src = fs.readFileSync(WORKFLOW, 'utf8');
  const wf = parseWorkflow(src);
  assert.equal(wf.name, 'size-report', 'у проверки нет имени');
  assert.deepEqual(wf.on, ['push', 'pull_request'], 'проверка идёт не на пуш и не на запрос правки');

  const jobs = Object.keys(wf.jobs);
  assert.equal(jobs.length, 1, 'в описании больше одного job — читать и запускать это дороже');
  const job = wf.jobs[jobs[0]];
  assert.ok(job['runs-on'], 'у job нет runs-on');
  assert.ok(Array.isArray(job.steps) && job.steps.length > 0, 'в job нет шагов');

  /* The whole history: without `fetch-depth: 0` the tool refuses with code 3 — the check would fail on
   * itself rather than on a discrepancy in the numbers. */
  const checkout = job.steps.find((s) => typeof s.uses === 'string' && s.uses.indexOf('actions/checkout') === 0);
  assert.notEqual(checkout, undefined, 'в описании нет шага checkout');
  assert.equal(checkout.with['fetch-depth'], 0,
    'история клонируется обрезанной: таблица строится по коммитам и обрежется вместе с ней');

  const runs = job.steps.filter((s) => typeof s.run === 'string');
  const tool = runs.filter((s) => new RegExp('(^|\\s)(pnpm exec size|node node_modules/'
    + PKG_RE + '/bin/size\\.js)(\\s|$)').test(s.run));
  assert.ok(tool.length >= 2, 'проверка не зовёт команду инструмента хотя бы дважды');

  /* The package is installed before the check, yet a call by package name still does not do: the same
   * line in a project without it goes to the registry. */
  const byName = runs.filter((s) => BY_NAME_RE.test(s.run));
  assert.deepEqual(byName.map((s) => s.run), [],
    'шаг проверки зовёт инструмент по имени пакета, а не локальным бинарём');

  /* Two environments are one and the same call: a snapshot without the machine's git settings and an
   * ordinary one, then a comparison. */
  const nulled = tool.filter((s) => s.env && s.env.GIT_CONFIG_GLOBAL === '/dev/null');
  assert.equal(nulled.length, 1, 'в описании не ровно одна среда без настроек git');
  assert.ok(runs.some((s) => /^diff\s/.test(s.run)),
    'снимки не сверяются: числа двух сред разошлись бы молча');
  const snapshots = tool.filter((s) => s.run.indexOf('>') >= 0).map((s) => s.run.replace(/\s*>\s*\S+$/, ''));
  assert.equal(snapshots.length, 2, 'в описании не два снимка чисел');
  assert.equal(snapshots[0], snapshots[1],
    'две среды снимают числа разными командами, а должны одной и той же');
  assert.equal(snapshots[0].indexOf('--data') >= 0, true,
    'снимок снимается не командой данных: сравнивать было бы нечего');

  /* The template requires no secrets: a project's key lives in secrets and is added as a commented
   * example, which is why the text is read without comments. */
  const live = src.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.equal(/secrets\.[A-Za-z_]/.test(live), false,
    'описание требует секрет: шаблон не должен заводить их за проект');

  /* The tool's flags come from the help rather than from the template author's head. */
  const known = knownFlags();
  tool.forEach((step) => {
    flagsOf(step.run).forEach((flag) => {
      assert.ok(known.indexOf(flag) >= 0,
        'описание зовёт ключ, которого нет в справке: ' + flag + ' (шаг «' + step.name + '»)');
    });
  });
});

/* The draft is checked on more than paper: a report is really assembled with it. The history is the
 * fixture and the template's columns (`README.md`, `package.json`) are in it, so this is a first run in a
 * new project rather than a check of a file's shape. */
test('черновик собирает настоящий отчёт', () => {
  const dir = cloneFixture(path.join(tmp, 'draft'));
  const res = runSize(dir, ['--config', DRAFT, '--data']);
  assert.equal(res.code, 0, 'черновик не собрал отчёт (код ' + res.code + '): ' + res.stderr.trim());
  const data = JSON.parse(res.stdout);
  assert.equal(data.files.length, 2, 'колонок в отчёте не две — черновик разошёлся сам с собой');
  assert.ok(data.rows.length > 0, 'в отчёте нет ни одной строки коммита');
  assert.deepEqual(data.metrics.map((m) => m.key), ['raw', 'min', 'tok'],
    'черновик объявил не те метрики, что должен');
  data.now.forEach((cells, i) => {
    assert.ok(cells.raw > 0, 'колонка «' + data.files[i].label + '» пуста: черновик не измеряет то, что называет');
  });
});

/* A release is a promise too, and one of those that age in silence: the workflow description lies in the
 * repository while someone else's machine (a GitHub runner) runs it. So what is checked is what a machine
 * can check: the release starts from a tag rather than a button; publishing needs neither a secret nor a
 * code from an authenticator (or "you have all the rights" turns into "you have a token"); the version
 * comes from the manifest and is held against the tag; a prerelease does not go to `latest`; the same
 * full suite as in CI runs before publishing; and the hint about the one-time setting on npmjs.com names
 * **this very file** — otherwise it would send the owner to configure what does not exist.
 *
 * **The check parses the description rather than searching it for substrings,** and that is no strictness
 * for its own sake: a substring search cannot tell a valid description from an unparseable one. That is
 * how the first draft of this file went — `? … : …` inside an unquoted publish command broke the YAML
 * outright (the runner failed in zero seconds with "workflow file issue") while the substring was found
 * and the check was green. One parser serves both guards — this one and the template's for a foreign
 * project (`tools/yaml.js`) — because two parsers would drift apart just as quietly.
 *
 * What is absent here and why: GitHub Actions itself does not run from a check — only a tag push starts
 * it. So a green suite means "the description parses and says what is true" rather than "the release went
 * through"; the truth about that comes from a `workflow_dispatch` run (draft mode) and the first real tag.
 *
 * The limit of the draft run is named separately rather than hidden: `npm publish --dry-run` exchanges no
 * attestation and passes with no credentials at all, so whether the publisher is configured on npmjs.com
 * is what it does **not** check. The first tag does.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../tools/harness.js';
import { parseWorkflow } from '../tools/yaml.js';

const FILE = '.github/workflows/release.yml';
const WORKFLOW = path.join(ROOT, FILE);
const TEXT = fs.existsSync(WORKFLOW) ? fs.readFileSync(WORKFLOW, 'utf8') : '';

/* Steps without comments: the promise "no secrets required" is about what the job does rather than about
 * what is written next to it. Otherwise a comment explaining this rule would break it itself — the check
 * would catch its own explanation. */
const STEPS = TEXT.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

/* Parsing the description is part of the check: an unparseable file cannot count as a valid one. A parse
 * error names a line rather than "somewhere in the file". */
function workflow() {
  assert.ok(TEXT !== '', 'there is no release workflow: there is nothing to release with — that is ' + FILE);
  return parseWorkflow(TEXT);
}

function step(doc, name) {
  const found = doc.jobs.release.steps.filter((s) => s.name === name);
  assert.equal(found.length, 1, 'the release workflow holds no single step «' + name + '»');
  return found[0];
}

test('the release workflow parses, and a release starts from a tag rather than a button', () => {
  const doc = workflow();
  assert.deepEqual(doc.on.push.tags, ['v*'],
    'the release is not tied to a `v*` tag: it could be published from any branch');
  assert.ok(doc.on.workflow_dispatch, 'the release has no manual run: there is no way to call a dry run');

  // The version is held against the tag and taken from the manifest: two numbers read separately rather
  // than one derived from the other.
  const version = step(doc, 'Версия манифеста — в окружение');
  assert.match(String(version.run), /require\('\.\/package\.json'\)\.version/,
    'the version does not come from the manifest — there is no way to keep it in a second list');
  assert.match(String(version.run), /GITHUB_ENV/, 'the version does not reach the next step');
  const tag = step(doc, 'Тег называет ту же версию, что манифест');
  assert.equal(tag.if, "github.event_name == 'push'",
    'the tag comparison step runs on a manual start as well: there is no tag there and nothing to compare');
  assert.match(String(tag.run), /\$GITHUB_REF_NAME/,
    'the step does not compare the tag with the manifest version: the registry would get a number the history does not hold');
  assert.match(String(tag.run), /\$WANT/, 'the step does not name the manifest version');
});

test('publishing needs neither a secret nor a code, and a prerelease does not go out as `latest`', () => {
  const doc = workflow();
  assert.equal(/secrets\./.test(STEPS), false,
    'the release steps carry secrets.: the promise «nothing has to be set up in the repository settings» has become a lie');
  assert.equal(/NODE_AUTH_TOKEN/.test(STEPS), false,
    'the release waits for a token in the environment: that is the very secret it promised not to need');
  assert.equal(/--otp/.test(STEPS), false,
    'the release asks for a one-time code: there is nowhere to get one for an account with a security key');
  assert.equal(doc.permissions['id-token'], 'write',
    'there is no `id-token: write`: trusted publishing has nothing to present itself with, and the publish fails');
  assert.equal(doc.permissions.contents, 'read',
    'the job permissions are not limited to reading contents — the release needs nothing more');
  assert.equal(step(doc, 'npm поновее (для trusted publishing)').run, 'npm install -g npm@latest',
    'npm is not raised: trusted publishing needs 11.5.1, while Node 22 brings 10');

  /* `registry-url` is no decoration of the step: with it setup-node writes the line
   * `_authToken=${NODE_AUTH_TOKEN}` into `.npmrc`, npm takes the credentials for given and never goes for
   * the OIDC attestation, and publishing fails with 404 even with the publisher properly configured. The
   * registry is the default one anyway, while an explicitly set address lives in the manifest's
   * `publishConfig`. */
  const setup = doc.jobs.release.steps.find((s) => String(s.uses || '').startsWith('actions/setup-node'));
  assert.notEqual(setup, undefined,
    'the release workflow carries no setup-node step: Node comes from nowhere in particular');
  assert.equal((setup.with || {})['registry-url'], undefined,
    'setup-node gets `registry-url`: the substituted `_authToken` line in `.npmrc`'
      + ' cancels the OIDC identity, and the publish fails 404');

  const publish = step(doc, 'Публикация');
  assert.match(String(publish.if), /dry_run == false/,
    'the real publish is not separated from the dry one — a dry run would go to the registry');
  assert.match(String(publish.run), /contains\(github\.ref_name, '-'\)/,
    'the release tag does not tell a prerelease apart: a draft would go out as `latest`');
  assert.match(String(publish.run), /'next'/, 'a prerelease has no `next` tag of its own');
  assert.match(String(publish.run), /'latest'/, 'an ordinary release has no `latest` tag');

  /* The draft run assembles the package and walks the publishing path without sending anything. Its
   * version is a draft increment: on an honest number the registry refuses to publish an already
   * published version, and a run that has to answer "the setting is right" would be red for a foreign
   * reason — as the first run did with 1.1.1. The version edit lives in the runner's working directory
   * alone. */
  const dry = step(doc, 'Черновой прогон — в реестр ничего не ушло');
  assert.match(String(dry.run), /npm publish --dry-run/,
    'the dry run does not show what would go out: it is silent about the contents of the package');
  assert.match(String(dry.run), /npm version prerelease --preid=draft --no-git-tag-version/,
    'the dry run goes on the version from the manifest: on a number already released the registry'
      + ' refuses, and the red result would be for nothing');
  const input = doc.on.workflow_dispatch.inputs.dry_run;
  assert.equal(String(input.default), 'true',
    'the dry mode is not on by default: the "run" button would publish the package');
});

test('the release runs the same set as CI, and the hint names the same file', () => {
  const doc = workflow();
  const checks = step(doc, 'Проверки перед выпуском');
  assert.match(String(checks.run), /pnpm run lint:strict/,
    'the strict linter does not run before the release');
  assert.match(String(checks.run), /pnpm test:all/,
    'a set other than the full one runs before the release: CI publishes rather than edits');
  assert.match(String(step(doc, 'Работа из собранного пакета').run), /pack:check/,
    'the release does not check the work from the assembled package — while that is what goes out');
  assert.ok(TEXT.indexOf(path.basename(FILE)) >= 0,
    'the hint does not name the workflow file: the one-time setting on npmjs.com'
      + ' would point at another file, and a release by tag would not find its publisher');
});

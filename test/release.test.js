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
  assert.ok(TEXT !== '', 'описания выпуска нет: выпускать нечем — это ' + FILE);
  return parseWorkflow(TEXT);
}

function step(doc, name) {
  const found = doc.jobs.release.steps.filter((s) => s.name === name);
  assert.equal(found.length, 1, 'в описании выпуска нет ровно одного шага «' + name + '»');
  return found[0];
}

test('описание выпуска разбирается, и выпуск начинается тегом, а не кнопкой', () => {
  const doc = workflow();
  assert.deepEqual(doc.on.push.tags, ['v*'],
    'выпуск не привязан к тегу `v*`: выкладывать можно было бы с любой ветки');
  assert.ok(doc.on.workflow_dispatch, 'у выпуска нет ручного запуска: черновой прогон нечем позвать');

  // The version is held against the tag and taken from the manifest: two numbers read separately rather
  // than one derived from the other.
  const version = step(doc, 'Версия манифеста — в окружение');
  assert.match(String(version.run), /require\('\.\/package\.json'\)\.version/,
    'версия не берётся из манифеста — вторым списком её держать нечем');
  assert.match(String(version.run), /GITHUB_ENV/, 'версия не доходит до следующего шага');
  const tag = step(doc, 'Тег называет ту же версию, что манифест');
  assert.equal(tag.if, "github.event_name == 'push'",
    'шаг сверки тега идёт и на ручном запуске: там тега нет и сверять нечего');
  assert.match(String(tag.run), /\$GITHUB_REF_NAME/,
    'шаг не сверяет тег с версией манифеста: реестр получил бы номер, которого нет в истории');
  assert.match(String(tag.run), /\$WANT/, 'шаг не называет версию манифеста');
});

test('публикация не требует ни секрета, ни кода, и prerelease не уезжает в `latest`', () => {
  const doc = workflow();
  assert.equal(/secrets\./.test(STEPS), false,
    'в шагах выпуска есть secrets.: обещание «в настройках репозитория заводить нечего» стало ложью');
  assert.equal(/NODE_AUTH_TOKEN/.test(STEPS), false,
    'выпуск ждёт токен в окружении: это и есть секрет, которого обещано не требовать');
  assert.equal(/--otp/.test(STEPS), false,
    'выпуск просит одноразовый код: у аккаунта с security key его взять негде');
  assert.equal(doc.permissions['id-token'], 'write',
    'нет `id-token: write`: trusted publishing нечем себя предъявить, и публикация упадёт');
  assert.equal(doc.permissions.contents, 'read',
    'права job’а не ограничены чтением содержимого — выпуску больше и не нужно');
  assert.equal(step(doc, 'npm поновее (для trusted publishing)').run, 'npm install -g npm@latest',
    'npm не поднят: trusted publishing требует 11.5.1, а с Node 22 приходит 10');

  /* `registry-url` is no decoration of the step: with it setup-node writes the line
   * `_authToken=${NODE_AUTH_TOKEN}` into `.npmrc`, npm takes the credentials for given and never goes for
   * the OIDC attestation, and publishing fails with 404 even with the publisher properly configured. The
   * registry is the default one anyway, while an explicitly set address lives in the manifest's
   * `publishConfig`. */
  const setup = doc.jobs.release.steps.find((s) => String(s.uses || '').startsWith('actions/setup-node'));
  assert.notEqual(setup, undefined,
    'в описании выпуска нет шага setup-node: Node берётся неизвестно откуда');
  assert.equal((setup.with || {})['registry-url'], undefined,
    'setup-node получает `registry-url`: подставная строка `_authToken` в `.npmrc`'
      + ' отменяет удостоверение OIDC, и публикация падает 404');

  const publish = step(doc, 'Публикация');
  assert.match(String(publish.if), /dry_run == false/,
    'настоящая публикация не отделена от черновой — черновой прогон уехал бы в реестр');
  assert.match(String(publish.run), /contains\(github\.ref_name, '-'\)/,
    'метка выпуска не различает prerelease: черновик уехал бы в `latest`');
  assert.match(String(publish.run), /'next'/, 'у prerelease нет своей метки `next`');
  assert.match(String(publish.run), /'latest'/, 'у обычного выпуска нет метки `latest`');

  /* The draft run assembles the package and walks the publishing path without sending anything. Its
   * version is a draft increment: on an honest number the registry refuses to publish an already
   * published version, and a run that has to answer "the setting is right" would be red for a foreign
   * reason — as the first run did with 1.1.1. The version edit lives in the runner's working directory
   * alone. */
  const dry = step(doc, 'Черновой прогон — в реестр ничего не ушло');
  assert.match(String(dry.run), /npm publish --dry-run/,
    'черновой прогон не показывает, что бы уехало: он молчит о содержимом пакета');
  assert.match(String(dry.run), /npm version prerelease --preid=draft --no-git-tag-version/,
    'черновой прогон идёт на версии из манифеста: на уже выпущенном номере реестр'
      + ' откажет, и красный результат будет ни при чём');
  const input = doc.on.workflow_dispatch.inputs.dry_run;
  assert.equal(String(input.default), 'true',
    'черновой режим не включён по умолчанию: кнопка «запустить» выпустила бы пакет');
});

test('выпуск прогоняет тот же набор, что CI, и подсказка называет этот же файл', () => {
  const doc = workflow();
  const checks = step(doc, 'Проверки перед выпуском');
  assert.match(String(checks.run), /pnpm run lint:strict/,
    'перед выпуском не идёт строгий линтер');
  assert.match(String(checks.run), /pnpm test:all/,
    'перед выпуском идёт не полный набор: CI выкладывает, а не правит');
  assert.match(String(step(doc, 'Работа из собранного пакета').run), /pack:check/,
    'выпуск не проверяет работу из собранного пакета — а уезжает именно он');
  assert.ok(TEXT.indexOf(path.basename(FILE)) >= 0,
    'подсказка не называет файл рабочего процесса: одноразовая настройка на npmjs.com'
      + ' указывала бы на другой файл, и выпуск по тегу не нашёл бы издателя');
});

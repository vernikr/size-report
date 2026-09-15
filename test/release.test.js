/* Выпуск — тоже обещание, и оно из тех, что стареют молча: описание рабочего
 * процесса лежит в репозитории, а исполняет его чужая машина (раннер GitHub).
 * Поэтому проверяется то, что проверяемо машинно: выпуск начинается тегом, а не
 * кнопкой; публикация не требует ни секрета, ни кода из аутентификатора (иначе
 * «у тебя все права» превращается в «у тебя есть токен»); версия берётся из
 * манифеста и сверяется с тегом; prerelease не уезжает в `latest`; перед
 * публикацией идёт тот же полный набор, что и в CI; а подсказка про одну
 * одноразовую настройку на npmjs.com называет **этот самый файл** — иначе она
 * отправила бы владельца настраивать то, чего нет.
 *
 * **Проверка разбирает описание, а не ищет в нём подстроки,** и это не строгость
 * ради строгости: поиск подстроки не отличает верное описание от неразбираемого.
 * Так и вышло с первой редакцией этого файла — `? … : …` внутри незакавыченной
 * команды публикации ломало YAML целиком (раннер падал через ноль секунд
 * «workflow file issue»), а подстрока находилась, и проверка была зелёной.
 * Разборщик один на оба сторожа — здесь и у шаблона для чужого проекта
 * (`tools/yaml.js`), потому что два разборщика разошлись бы так же тихо.
 *
 * Чего здесь нет и почему: сам GitHub Actions не запускается из проверки —
 * запустить его можно только пушем тега. Поэтому зелёный набор значит «описание
 * разбирается и говорит верное», а не «выпуск прошёл»; правду об этом даёт
 * прогон `workflow_dispatch` (черновой режим) и первый настоящий тег.
 *
 * Отдельно назван предел чернового прогона, а не спрятан: `npm publish --dry-run`
 * не обменивается удостоверением и проходит вообще без учётных данных, поэтому
 * настроен ли издатель на npmjs.com — он **не** проверяет. Это делает первый тег.
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

/* Шаги без комментариев: обещание «секретов не требуем» относится к тому, что
 * job делает, а не к тому, что о нём написано. Иначе комментарий, объясняющий это
 * правило, сам его и нарушал бы — проверка ловила бы собственное объяснение. */
const STEPS = TEXT.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

/* Разбор описания — часть проверки: неразбираемый файл не может считаться верным.
 * Ошибка разбора называет строку, а не «где-то в файле». */
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

  // Версия сверяется с тегом и берётся из манифеста: два числа, прочитанные
  // отдельно, а не выведенные одно из другого.
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

  /* `registry-url` — не украшение шага: с ним setup-node пишет в `.npmrc` строку
   * `_authToken=${NODE_AUTH_TOKEN}`, npm считает учётные данные заданными и за
   * удостоверением OIDC не идёт, а публикация падает 404 при верно заведённом
   * издателе. Реестр и так по умолчанию registry.npmjs.org, а выставленный явно
   * адрес живёт в `publishConfig` манифеста. */
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

  /* Черновой прогон собирает пакет и проходит путь публикации, ничего не отправляя.
   * Версия в нём — черновая надстройка: на честном номере реестр отказывает в
   * публикации уже выпущенной версии, и прогон, который должен отвечать «настройка
   * верна», был бы красным по чужой причине (так и вышло на первом же прогоне с
   * 1.1.1). Правка версии живёт только в рабочем каталоге раннера. */
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

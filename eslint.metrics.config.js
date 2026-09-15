/* Датчики раздувания кода: размер и сложность, дубли веток, вес тестов, долги в
 * пометках. Отдельно от `eslint.config.js`: там оформление (какая строка как
 * выглядит), здесь — размеры и структура. Пороги взяты из замера текущего дерева
 * (`WORKLOG.md` §14, таблица замеров), а не из головы: всё, что выше порога, лежит
 * в `eslint-suppressions.json` и разбирается постепенно, новое — краснеет сразу.
 *
 * Запуск: `pnpm run metrics` (гейт), обновление храповика — `pnpm run baseline:metrics`
 * (человеческое действие, помечается трейлером `Gate-Change:`).
 *
 * Сканируется только настоящий код — `src`, `bin`, `tools`, `test` (пути задаёт
 * `tools/gates/run.js`). Конфиги в корне датчиками не собираются: в этом файле
 * живут сами слова пометок и пороги, и он сам был бы первым нарушителем.
 *
 * Отвергнуто при настройке (чтобы не включили снова «чтобы было строже»):
 * `sonarjs/no-duplicate-string` — 200+ замечаний на русских сообщениях об отказе,
 * где повтор — часть текста, а не дубль; `sonarjs/no-duplicate-string` и
 * `sonarjs/no-nested-template-literals` шумят на шаблонах разметки.
 */

import sonarjs from 'eslint-plugin-sonarjs';

/* Термины долгов — здесь, а не в сканируемом файле: иначе правило нашло бы
 * само себя. Список — тот же, что у `no-warning-comments` по умолчанию, плюс
 * русская пометка «отложено». */
const DEBT_TERMS = ['todo', 'fixme', 'xxx', 'hack', 'отложено'];

/* Обход дерева без слушателей: нужен внутри одного правила (тело проверки), а не
 * на узлах файла. `parent` пропускается — по нему ходят только наверх. */
function walk(node, visit) {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  if (typeof node.type === 'string') visit(node);
  Object.keys(node).forEach((key) => { if (key !== 'parent') walk(node[key], visit); });
}

function isNamed(node, name) {
  return node !== null && node !== undefined && node.type === 'Identifier' && node.name === name;
}

/* Проверка набора: `test(имя, { … })` — умолчание в первом аргументе — и функции
 * проверок из `node:test` живут на одних именах, поэтому разбирается только
 * `test(...)`; `describe` в этом наборе не используется и назван молчанием, а не
 * правилом (правило на несуществующем — украшение). */
function isTestCall(node) {
  return node.callee.type === 'Identifier' && node.callee.name === 'test'
    && node.arguments.length > 0;
}

function assertCalls(body) {
  let found = 0;
  walk(body, (node) => {
    if (node.type !== 'CallExpression') return;
    const callee = node.callee;
    if (isNamed(callee, 'assert')) found++;
    if (callee.type === 'MemberExpression' && isNamed(callee.object, 'assert')) found++;
  });
  return found;
}

/* Значение без сравнения: `assert.ok(x)`, `assert(x)`, `assert.ok(true)` —
 * утверждение проходит на всём, что не falsy, и не говорит, что именно ждали. */
function isWeakAssert(node) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  const bare = isNamed(callee, 'assert');
  const ok = callee.type === 'MemberExpression' && isNamed(callee.object, 'assert')
    && isNamed(callee.property, 'ok');
  if (!bare && !ok) return false;
  const first = node.arguments[0];
  if (first === undefined) return true;
  return first.type === 'Identifier' || (first.type === 'Literal' && typeof first.value === 'boolean');
}

/* Помощники файла, внутри которых есть утверждение: проверка, зовущая такого
 * помощника, утверждает по существу. Без этого правило било бы по исправным тестам
 * (в наборе таких пять — они зовут `refusal`, `assertCatchesDiskEdit`, `moduleInJs`,
 * `verify`), а ложные срабатывания и есть та причина, по которой гейты отключают.
 * Чужой помощник (`tools/harness.js`) так не виден — он остаётся в базе и назван
 * там же, где храповик. */
function assertingNames(program) {
  const named = [];
  const own = (node, name) => { if (assertCalls(node.body) > 0) named.push(name); };
  walk(program, (node) => {
    if (node.type === 'FunctionDeclaration' && node.id !== null) own(node, node.id.name);
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier'
        && node.init !== null && (node.init.type === 'ArrowFunctionExpression'
          || node.init.type === 'FunctionExpression')) own(node.init, node.id.name);
  });
  return named;
}

function callsAny(body, names) {
  let found = 0;
  walk(body, (node) => {
    if (node.type === 'CallExpression' && isNamed(node.callee, 'assert') === false
        && node.callee.type === 'Identifier' && names.indexOf(node.callee.name) >= 0) found++;
  });
  return found;
}

const local = {
  rules: {
    'assert-in-test': {
      meta: { type: 'problem', schema: [], messages: { none: 'проверка без утверждения: тест не проверяет ничего' } },
      create(ctx) {
        let helpers = [];
        return {
          Program(node) { helpers = assertingNames(node); },
          CallExpression(node) {
            if (!isTestCall(node)) return;
            const fn = node.arguments.filter((a) => a.type === 'FunctionExpression'
              || a.type === 'ArrowFunctionExpression').pop();
            if (fn === undefined) return;
            if (assertCalls(fn.body) === 0 && callsAny(fn.body, helpers) === 0) {
              ctx.report({ node, messageId: 'none' });
            }
          }
        };
      }
    },
    'weak-assert': {
      meta: { type: 'problem', schema: [], messages: { weak: 'утверждение без сравнения: проходит на любом верном значении' } },
      create(ctx) {
        return {
          CallExpression(node) { if (isWeakAssert(node)) ctx.report({ node, messageId: 'weak' }); }
        };
      }
    },
    'no-skipped-test': {
      meta: { type: 'problem', schema: [], messages: { skipped: 'проверка выключена («{{what}}»): набор считает её пройденной' } },
      create(ctx) {
        const ways = ['only', 'skip', 'todo', 'failing'];
        return {
          CallExpression(node) {
            const callee = node.callee;
            const on = (name) => callee.type === 'MemberExpression' && isNamed(callee.object, 'test')
              && isNamed(callee.property, name);
            const used = ways.find(on);
            if (used !== undefined) {
              ctx.report({ node, messageId: 'skipped', data: { what: 'test.' + used } });
              return;
            }
            if (!isTestCall(node)) return;
            node.arguments.forEach((arg) => {
              if (arg.type !== 'ObjectExpression') return;
              arg.properties.forEach((p) => {
                const key = p.key && p.key.name;
                if (ways.indexOf(key) >= 0 && p.value !== undefined && p.value.value === true) {
                  ctx.report({ node, messageId: 'skipped', data: { what: key + ': true' } });
                }
              });
            });
          }
        };
      }
    },
    'no-debt-marker': {
      meta: {
        type: 'problem',
        schema: [],
        messages: { marker: 'пометка долга «{{term}}»: без ратчета долг копится молча' }
      },
      create(ctx) {
        /* Комментарии читаются обходом `sourceCode`, а не слушателями `Line`/`Block`:
         * обход узлов их не посещает — на этом первая редакция правила и молчала
         * (правило было, нарушения не было). Проба поймала это сразу. */
        return {
          'Program:exit'() {
            ctx.sourceCode.getAllComments().forEach((comment) => {
              const text = comment.value.toLowerCase();
              DEBT_TERMS.forEach((term) => {
                if (text.indexOf(term) >= 0) {
                  ctx.report({ node: comment, messageId: 'marker', data: { term: term } });
                }
              });
            });
          }
        };
      }
    }
  }
};

/* `reports/` здесь НЕ в игноре, хотя у линтера (`eslint.config.js`) и в `.gitignore`
 * он назван, — и это условие одной пробы, а не расхождение. Проба датчика пишет файл
 * с нарочным нарушением в `reports/probe/`: остаток от оборванного прогона не должны
 * видеть ни `git status`, ни `lint:strict`. Датчику же файл нужен видимым: он зовётся
 * явным путём (`--paths`), а игнор глушит и явный путь — с `reports/` здесь проба
 * краснела бы на самом игноре («File ignored because of a matching ignore pattern»),
 * а не на нарушении. Обход по умолчанию (`src`, `bin`, `tools`, `test`) сюда не заходит. */
export default [
  { ignores: ['node_modules/', 'fixtures/', '.freebuff/'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly', console: 'readonly', URL: 'readonly', Buffer: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', structuredClone: 'readonly',
        document: 'readonly', window: 'readonly'
      }
    },
    plugins: { sonarjs, local },
    linterOptions: { reportUnusedDisableDirectives: 'error', noInlineConfig: true },
    rules: {
      // Размер и форма. Порог — из распределения замеров: например, длина функции
      // (p50 7, p90 27, p99 73, max 118) режется по 60 — выше него лежит 14
      // функций, то есть хвост за p98, а не середина.
      complexity: ['error', 12],
      'max-lines-per-function': ['error', { max: 60 }],
      'max-statements': ['error', 30],
      'max-params': ['error', 5],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 5],
      'max-lines': ['error', { max: 450 }],
      'max-classes-per-file': ['error', 1],
      // Дубли-ветки и копии функций: клоны по токенам ищет `dup`, здесь — то, что
      // по токенам не видно (две одинаковые ветки — это три строки).
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/cognitive-complexity': ['error', 15],
      // Долги: пометка в комментарии без ратчета; само подавление правила —
      // тоже нарушение (`noInlineConfig` ниже), иначе гейт гасится одной строкой.
      'local/no-debt-marker': 'error'
    }
  },
  {
    // Тесты: проверка обязана что-то утверждать, слабое утверждение — на счету,
    // выключенную проверку звать нельзя (её считают пройденной).
    files: ['test/**/*.js'],
    rules: {
      'local/assert-in-test': 'error',
      'local/weak-assert': 'error',
      'local/no-skipped-test': 'error'
    }
  }
];

/* Четыре обещания документации: **документ зовёт только то, что инструмент умеет**
 * (команды и ключи — из справки, а не из второго списка), **называет те причины
 * отказа, которые бывают**, **ссылается на существующие разделы** и **зовёт
 * инструмент так, что зов работает и без установленного пакета**.
 *
 * Причины кодом 2 держатся реестром: `CONFIG_CAUSES` в `src/refusal.js` — одно
 * место, где они перечислены словами, справка печатает их из него, а таблица
 * кодов `README.md` обязана назвать тот же список. Иначе документ снова скажет
 * меньше, чем бывает, — тем и кончились четыре прошлых прохода.
 *
 * Что здесь машинно не проверяется, и это сказано, а не спрятано: формулировки и
 * смысл, обещания о будущем (разделы «чего ещё нет» проверку не проходят — там
 * названо отсутствующее, и требовать его существования значило бы запретить
 * планировать) и совпадение счёта причин с числом отказов в движке по тексту
 * сообщения — оно держится реестром: причина без записи в нём не доедет до
 * пользователя, потому что `refuseCause` её не пропустит.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, gitIn } from '../tools/harness.js';
import { CONFIG_CAUSES, USAGE, refuseCause } from '../src/refusal.js';
import { TOOL_PKG } from '../src/tool.js';

/* Инструкции — то, по чему читатель запускает инструмент: README пакета и записка
 * в шаблонах. `PLAN.md` и `REFACTOR.md` называют целевую поверхность и историю,
 * а `WORKLOG.md` и `CHANGELOG.md` — прошедшее время: прежние зовы там уместны. */
const INSTRUCTIONS = ['README.md', 'templates/README.md'];
import {
  DOCS, NOT_TODAY, PKG, TARGETS, callWords, facts, invocations, read, sectionsOf,
  usageCommands, usageFlags
} from '../tools/docs-facts.js';

/* Причины из справки: движок печатает их из того же реестра, поэтому строки
 * разбираются, а не сверяются глазами. */
function usageCauses() {
  const block = USAGE.split('Причины отказа кодом 2')[1] || '';
  return block.split('\n').filter((l) => l.indexOf(': ') > 0).map((l) => {
    const m = l.trim().match(/^(.+?): (.+)$/);
    return [m[1], m[2].split(' · ')];
  });
}

/* Причины из таблицы кодов README.md: строка `| 2 | … |`, в ней группы вида
 * `**имя** (причина, причина)`. */
function readmeCauses() {
  const rows = read('README.md').split('\n').filter((l) => /^\|\s*2\s*\|/.test(l));
  assert.ok(rows.length > 0, 'в таблице кодов README нет строки про код 2 — сверить нечего');
  const cell = rows[0].split('|')[2];
  const found = [...cell.matchAll(/\*\*(.+?)\*\* \(([^)]+)\)/g)];
  return found.map((m) => [m[1], m[2].split(', ')]);
}

/* Отказы, объявленные самим движком: `refuseCause('причина', …)`. Список мест ведёт
 * не комментарий, а проверка: голый `refuse(EXIT.CONFIG` в движке — это причина,
 * которую никто не назвал. Первый аргумент обязан быть литералом — разбирать
 * тернарники проверке нечем, а название причины скрытое за выражением и человек
 * прочтёт не сразу. */
function emittedCauses() {
  // Дом самого механизма из счёта выпадает: в `refusal.js` отказ только собирается,
  // а выдают его те, кто причину называет.
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
  // Проверяются инструкции — README пакета и записка в шаблонах: их читает тот,
  // кто собирается что-то запустить. `PLAN.md` и `REFACTOR.md` называют целевую
  // поверхность (`size init`, `size measure`, `--out`) — это план, и требовать от
  // них сегодняшнего CLI значило бы запретить планировать.
  const bad = [];
  INSTRUCTIONS.forEach((doc) => {
    invocations(facts(doc, NOT_TODAY[doc])).forEach((call) => {
      if (!new RegExp('^(?:size|pnpm exec size|npm exec size|node node_modules/'
        + escapedName + '/bin/size\\.js|node bin/size\\.js|npx ' + escapedName + ')(\\s|$)').test(call)) return;
      const words = callWords(call);
      if (words.length === 0) return;
      const known = usageCommands.indexOf(words[0]) >= 0;
      if (!known && words[0][0] !== '-') {
        // Первое слово может быть только командой или ключом режима; всё
        // остальное — зов несуществующей команды (но только если это слово, а
        // не, скажем, `…` или `<sha>` из шаблона).
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

  // Обратная сторона: причина, объявленная и напечатанная, но никем не выдаваемая,
  // — это обещание отказа, которого не бывает, и место в документации, которое
  // читатель ищет напрасно.
  const emitted = emittedCauses();
  const declared = new Set(CONFIG_CAUSES.map((g) => g[1]).flat());
  const silent = [...declared].filter((c) => !emitted.has(c));
  assert.deepEqual(silent, [], 'причины объявлены, но никем не выдаются: ' + silent.join(', '));
  const undeclared = [...emitted].filter((c) => !declared.has(c));
  assert.deepEqual(undeclared, [], 'отказы называют причины, которых нет в списке: ' + undeclared.join(', '));

  // Голый отказ кодом 2 в обход причины — то же самое, только тише: причина
  // появится в поведении и не появится в документации.
  const bare = gitIn(ROOT, ['grep', '-l', '-F', 'refuse(EXIT.CONFIG', '--', 'src'])
    .split('\n').filter((f) => f !== '' && f !== 'src/refusal.js');
  assert.deepEqual(bare, [], 'отказ кодом 2 в обход причины (refuseCause) в: ' + bare.join(', '));

  // Механизм живой, а не декоративный: причина, которой нет в реестре, до
  // пользователя не доедет.
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
        // Ближайшее имя документа: сразу за ссылкой («§4.3 `module-design.md`»)
        // или перед ней («`PLAN.md` §5»). Без имени ссылка на раздел требований —
        // так на них и ссылаются («требование §4.2»).
        const after = line.slice(m.index + m[0].length).match(/^\s*`?([\w.-]+\.md)`?/);
        const named = (after && sections[after[1]] !== undefined && after[1])
          || [...before.matchAll(/`?([\w.-]+\.md)`?/g)].reverse().map((n) => n[1])
            .find((n) => sections[n] !== undefined)
          || (/(?:требовани|требований)/.test(line) ? 'requirements.md' : null);
        // Ссылка без имени документа — это § журнала или плана, и разрешать её
        // нечем: планировать и нумеровать всякий волен по-своему. Молчание тут
        // честнее догадки.
        if (named === null || sections[named] === undefined) return;
        if (!sections[named].has(key)) bad.push(doc + ': §' + key + ' → ' + named);
      });
    });
  });
  assert.deepEqual(bad, [], 'ссылки ведут в несуществующие разделы:\n  ' + bad.join('\n  '));
});

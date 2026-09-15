import fs from 'fs';
import path from 'path';
import { CONFIG_NAME, derivedProfile, validateConfig } from './config.js';
import { advicePath, cliCommand, refuseCause } from './refusal.js';
import { writeFileEnsured } from './artifact.js';
import { packageManager } from './project.js';

/* Закрепление настроек файлом (`--init`): то, что проект вывел о себе сам
 * (`src/project.js`), записывается туда, где его встретит следующий запуск.
 *
 * Отдельным модулем от вывода профиля: тот смотрит на проект впервые и почти всё о
 * нём угадывает, а этот делает одну вещь — кладёт результат файлом и говорит, что
 * записал. Требование к себе одно и оно жёсткое: **закреплённое обязано проходить
 * ту же проверку, которой его встретит первый запуск** — иначе подсказка приводит
 * человека в новый тупик (BLOCKERS §N2, REFACTOR R-0.4).
 */

/* Что сказать после записи: тем же порядком, что и раньше, — что записано, чем
 * заменятся приближения и что делать дальше. Строки собираются списком, а не
 * печатаются по ходу: тогда «что сказано» читается целиком. */
function draftLines(root, target, cfg) {
  const hasPkg = fs.existsSync(path.join(root, 'package.json'));
  const manager = packageManager(root);
  return [
    '✓ настройки выведены из проекта и закреплены: ' + path.relative(root, target),
    '  колонок: ' + cfg.columns.length + ' (' + cfg.columns.map((c) => c.label).slice(0, 6).join(', ')
      + (cfg.columns.length > 6 ? ', …' : '') + ')',
    '  исключено путей: ' + cfg.skip.length + ' (сам отчёт, замки зависимостей, карты, собранное)',
    '  метрика min: настоящее сжатие (esbuild); без него — честное упрощение и код 4',
    '  метрика tok: словарь o200k_base (gpt-tokenizer); без него — оценка по длине и код 4',
    '  журнал: ' + (cfg.journal === null ? 'не найден — ссылки строк будут без разделов' : cfg.journal.path),
    '  дальше: правьте колонки и метрики — какие файлы важны, знает только проект',
    '          ' + (hasPkg
      ? 'добавьте в package.json "sizes": "size --write" — тогда отчёт будет звать '
        + manager + ' run sizes (проверка — без --write)'
      : 'запуск: ' + cfg.fixCommand + ' (проверка — без --write)'),
    '          ' + (hasPkg ? 'добавьте ' + manager + ' run test:sizes в CI' : 'добавьте проверку в CI')
      + '; проверка — команда пакета, своих файлов в проект она не приносит'
  ];
}

/* Пустой профиль — не отказ, а примечание: работа сделана, а колонки за человека не
 * выберет никто. Поэтому «!», а не «✗»: знак и код выхода не имеют права говорить
 * разное (каталог отказов считает такие знаки отдельно). */
function noteNoColumns(root, target, cfg) {
  if (cfg.columns.length > 0) return;
  console.error('! в проекте не нашлось путей, которые можно взять колонками'
    + ' (история пуста или в ней нет знакомых расширений): черновик записан без колонок'
    + '\n  впишите их руками в ' + path.relative(root, target)
    + ' — без колонок проверка настроек скажет «не задано ни одной колонки»');
}

export function initMode(root, file, force) {
  const target = file ? path.resolve(root, file) : path.join(root, CONFIG_NAME);
  if (fs.existsSync(target) && !force) {
    // Совет называет тот же файл, о котором шла речь: `--init --force` без файла
    // перезаписал бы черновиком умолчательное имя, а не тот файл, что человек звал.
    const name = file === undefined || file === null ? CONFIG_NAME : advicePath(file);
    refuseCause('конфиг уже есть', 'конфиг уже есть: ' + target
      + '\n  починка: правьте его или перезапишите черновиком: ' + cliCommand('--init ' + name + ' --force'));
  }
  // Закреплённое — то же, чем проект работает без файла (вывод из проекта поверх
  // умолчаний), и оно же обязано проходить ту же проверку, которой его встретит
  // запуск: путь в тексте отказа — тот файл, куда оно легло. «Выведено» и «путь
  // отказа» в файл не пишутся: это свойства не настроек, а того, откуда они взялись.
  const cfg = derivedProfile(root);
  if (cfg.columns.length > 0) validateConfig(Object.assign({}, cfg, { path: target }));
  const written = Object.assign({}, cfg);
  delete written.path;
  delete written.derived;
  writeFileEnsured(target, JSON.stringify(written, null, 2) + '\n');
  noteNoColumns(root, target, cfg);
  draftLines(root, target, cfg).forEach((line) => console.log(line));
  return 0;
}

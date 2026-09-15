/* Содержимое фикстуры: что лежит в файлах синтетической истории.
 *
 * Ловушки закодированы **текстом файлов**, а не флагами: движок обязан спотыкаться
 * на них сам. Поэтому почти каждая следующая версия файла — предыдущая с одной
 * правкой (`CODE_2` из `CODE_1`), и у правки названо, какую ловушку она держит.
 *
 * Путь артефакта — здесь же: он и колонка в настройках, и файл в истории, и
 * расходиться этим двум нельзя.
 */

export const ARTIFACT = 'docs/size-table.html';

export const README = [
  '# Фикстура',
  '',
  'Репозиторий для проверок: маленький, но с ловушками (список — в README рядом).',
  'Читается по буквам: «—» — файла нет, 0 Б — файл есть и пуст.',
  ''
].join('\n');

export const CODE_1 = [
  '/* Заголовок файла: комментарий, который метрика min обязана снять */',
  "'use strict';",
  '// строчный комментарий',
  "var url = 'http://example.invalid/a//b';      // «//» внутри строки — не комментарий",
  'var re = /\\/+/g;                              // регексп с экранированным слэшем',
  'var tpl = `x${1 + 2}z`;                       // шаблон с выражением',
  'var half = 10 / 2 / 5;                        // деление, а не регексп',
  'function label(name) {',
  "  return '<' + name + '>';",
  '}',
  'module.exports = { label: label };',
  ''
].join('\n');

export const CODE_2 = CODE_1.replace('function label(name) {', 'var extra = 1;\nfunction label(name) {');
export const CODE_3 = CODE_2.replace('var extra = 1;', 'var extra = 1;\nvar mixed = 2;');
export const CODE_4 = CODE_3.replace('var mixed = 2;', 'var mixed = 2;\nvar markup = \'<a href="x">y & z</a>\';');
// Замена символа на символ: объём не меняется ни в одной метрике — строки быть не
// должно (иначе строка без единого числа читалась бы как поломка).
export const CODE_5 = CODE_4.replace('var extra = 1;', 'var extra = 2;');
// Ветки правят одну и ту же строку, поэтому слияние разрешается вручную. Размер
// у каждой версии свой: иначе коммит не сдвинул бы ни одного числа и строки бы не
// получил — а нам нужна именно строка слияния.
export const CODE_BRANCH = CODE_5.replace('var half = 10 / 2 / 5;', 'var half = 20 / 2 / 5;');
export const CODE_MAIN = CODE_5.replace('var half = 10 / 2 / 5;', 'var half = 10 / 2 / 50;');
export const CODE_MERGED = CODE_5.replace('var half = 10 / 2 / 5;', 'var half = 20 / 2 / 50 + 1;');

export const LEGACY_JS = [
  '// остаток от переезда: файл, который потом переименуют',
  'var DEPRECATED = true;',
  'module.exports = DEPRECATED;',
  ''
].join('\n');

export const LEGACY_JS_2 = LEGACY_JS.replace('var DEPRECATED = true;', 'var DEPRECATED = true; // и правят до переименования');
export const MODERN_JS = LEGACY_JS_2.replace('// остаток от переезда: файл, который потом переименуют',
  '// переехал: старое имя больше не существует, а колонка находит файл по алиасу');

export const CONFIG_MJS_1 = [
  '// служебный модуль: `export` в vm.Script не компилируется, его проверяет Node',
  'export default {',
  "  name: 'fixture',",
  '  level: 1',
  '};',
  ''
].join('\n');

export const CONFIG_MJS_2 = CONFIG_MJS_1.replace('level: 1', 'level: 2');

export const NOTES_1 = [
  '# Заметки',
  '',
  'Файл с не-английским именем: путь приходит из git, и его цитирование зависит',
  'от локали (`core.quotePath`), поэтому колонка обязана его находить.',
  ''
].join('\n');

export const NOTES_2 = NOTES_1 + '\n- вторая правка заметок\n';

export const HTML_1 = [
  '<!doctype html>',
  '<html lang="ru"><head><meta charset="utf-8"><title>Фикстура</title></head>',
  '<body><p>Артефакт фикстуры: его обновляют отдельным коммитом.</p></body></html>',
  ''
].join('\n');

export const HTML_2 = HTML_1.replace('отдельным коммитом', 'отдельным коммитом (и это ловушка)');

export const PACKAGE_JSON = JSON.stringify({
  name: 'fixture',
  version: '1.0.0',
  private: true,
  type: 'commonjs'
}, null, 2) + '\n';

export const STYLE_CSS = [
  '/* Фикстура: стили — метрика min снимает комментарии CSS */',
  '.note { color: #333; }',
  '.note > .inner { padding: 2px; }',
  ''
].join('\n');

export const TABLE_TOML = [
  '# Незнакомый формат: метрика min снимает только отступы и пустые строки —',
  '# комментарии в синтаксисе, которого инструмент не знает, трогать нельзя.',
  '[table]',
  'name = "fixture"',
  'rows = 3',
  ''
].join('\n');

export const WORKLOG_1 = [
  '# Журнал фикстуры',
  '',
  '## 1. 2026-01-01 — первый раздел',
  '',
  '1.1. Первый раздел заведён первым коммитом.',
  ''
].join('\n');

export const WORKLOG_2 = WORKLOG_1 + [
  '',
  '## 2. 2026-01-01 — второй раздел',
  '',
  '2.1. Второй раздел заведён правкой кода.',
  ''
].join('\n');

export const WORKLOG_3 = WORKLOG_2 + [
  '',
  '## 3. 2026-01-01 — третий раздел',
  '',
  '3.1. Третий раздел заведён коммитом, который тронул только журнал.',
  ''
].join('\n');

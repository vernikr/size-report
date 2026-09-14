/* Производные величины отчёта: из абсолютных значений получаются итоги, дельты,
 * содержимое клетки и подпись коммита.
 *
 * Единственное место, где это считается. Оба вывода пользуются этим файлом:
 * статический артефакт импортирует его как обычный модуль, а страница получает
 * его текст вклеенным в свой единственный файл (внешних ссылок страница иметь не
 * может). Поэтому у этого файла два требования, и оба обязательны:
 *
 *   1. Ни импортов, ни состояния модуля — иначе текст нельзя вклеить;
 *   2. Один `import` на строку и экспорт объявлением (`export function`), а не
 *      списком имён: модульный синтаксис при вклейке снимается построчно, и
 *      непонятая строка не должна молча попасть в страницу (`pageScript`).
 *
 * Расхождение двух отчётов возможно только здесь, поэтому и стеречь его надо
 * здесь: `test/contract.test.js` сверяет числа страницы с числами артефакта и
 * следит, чтобы у страницы не появилось своего расчёта. */

// Разряды тонкими пробелами: toLocaleString зависит от ICU сборки Node, а строка
// таблицы обязана совпадать побайтово на любой машине.
export function group(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
}

/* Итог: сумма по включённым файлам. Выключенный файл не участвует ни в таблице,
 * ни в сумме, — иначе «итого» отвечало бы не про то, что видно. */
export function totalsOf(values, metrics, on) {
  const out = {};
  metrics.forEach((m) => { out[m] = 0; });
  values.forEach((v, i) => {
    if (v === null || (on !== undefined && !on[i])) return;
    metrics.forEach((m) => { out[m] += v[m]; });
  });
  return out;
}

/* Дельта к предыдущему коммиту. Появление файла — рост на весь его объём: иначе
 * сумма дельт по колонке не сходилась бы с текущим размером. */
export function deltaOf(now, before) {
  return before === null || before === undefined ? now : now - before;
}

/* Содержимое клетки строки-коммита: что в ней написано и каким цветом. Разметку
 * из этого делает каждый вывод сам (строка HTML или узел DOM), а правила одни.
 * Пустая клетка — «не менялось», `—` — файла в ревизии нет.
 * `minus` — знак минуса: у артефакта он заморожен эталоном побайтово, страница
 * ставит типографский. */
export function cellParts(value, delta, minus) {
  if (value === null) return { text: '—', dir: null, miss: true };
  if (!delta) return { text: '', dir: null, miss: false };
  return {
    text: (delta > 0 ? '+' : minus) + group(Math.abs(delta)),
    dir: delta > 0 ? 'up' : 'down',
    miss: false
  };
}

// Клетка верхней строки: абсолютный размер, без дельты.
export function valueParts(value) {
  return value === null ? { text: '—', miss: true } : { text: group(value), miss: false };
}

/* Строка-коммит: блок «общий объём» и по блоку на включённый файл, в каждом —
 * клетка на метрику. Отбор включённых файлов происходит здесь, поэтому и таблица,
 * и суммы считаются от одного выбора. */
export function rowModel(values, prev, metrics, on) {
  const total = totalsOf(values, metrics, on);
  const prevTotal = prev === null ? null : totalsOf(prev, metrics, on);
  const out = {
    total: metrics.map((m) => ({
      value: total[m],
      delta: deltaOf(total[m], prevTotal === null ? null : prevTotal[m])
    })),
    files: []
  };
  values.forEach((v, i) => {
    if (on !== undefined && !on[i]) return;
    const before = prev === null || prev[i] === null ? null : prev[i];
    out.files.push(metrics.map((m) => {
      const value = v === null ? null : v[m];
      const was = value === null || before === null ? null : before[m];
      return { value: value, delta: value === null ? null : deltaOf(value, was) };
    }));
  });
  return out;
}

/* Верхняя строка — абсолютные размеры на HEAD: абсолютное число стоит в таблице
 * один раз, и именно с ним сходятся все дельты под ним. */
export function nowModel(values, metrics, on) {
  const total = totalsOf(values, metrics, on);
  const files = [];
  values.forEach((v, i) => {
    if (on !== undefined && !on[i]) return;
    files.push(metrics.map((m) => (v === null ? null : v[m])));
  });
  return { total: metrics.map((m) => total[m]), files: files };
}

/* Подпись коммита в терминах данных: что показать, чем подписать и куда вести.
 * Ссылку считает `rowHref` движка — то же место, откуда её берёт контракт для
 * страницы, поэтому оба вывода ведут туда же. Подпись всплывающей строки тоже
 * здесь: два вывода не должны подписывать один коммит по-разному. */
export function commitParts(row, showSha, href) {
  const short = showSha ? row.sha.slice(0, 7) : '';
  return {
    when: row.when,
    subject: row.subject,
    short: short,
    title: short === '' ? row.subject : row.subject + ' · ' + short,
    href: href || null,
    mark: row.section === null
      ? { text: '—', title: null }
      : { text: '§' + row.section.id + (row.section.added ? '' : '*'), title: row.section.head }
  };
}

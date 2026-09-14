/* Журнал и ссылки: к какому разделу относится коммит и куда ведёт его описание.
 * Работает на тексте, а не на git: разделы ищутся в уже прочитанном файле. */

/* Журнал (WORKLOG/CHANGELOG/…): раздел, к которому относится коммит. Формат
 * заголовков задаётся регуляркой в конфиге; именованные группы `id` (короткий
 * номер для `§N`) и `title` необязательны — без них номер берётся первым словом. */
export function parseSections(text, pattern) {
  const re = new RegExp(pattern);
  const list = [];
  let cur = null;
  text.split('\n').forEach((line) => {
    const m = re.exec(line);
    if (m) {
      const g = m.groups || {};
      const head = line.replace(/^#+\s*/, '').trim();
      const id = g.id === undefined ? head.split(/\s+/)[0] : g.id;
      cur = { id: id, head: head, body: '' };
      list.push(cur);
      return;
    }
    if (cur) cur.body += line + '\n';
  });
  return list;
}

/* Раздел, к которому относится коммит: сначала вновь заведённый, иначе —
 * последний из отредактированных (журналы ведутся по возрастанию, так что правка
 * почти всегда касается хвоста). */
export function touchedSection(prevText, nowText, pattern) {
  const prev = new Map(parseSections(prevText, pattern).map((s) => [s.head, s.body]));
  const now = parseSections(nowText, pattern);
  const added = now.filter((s) => !prev.has(s.head));
  if (added.length > 0) {
    const s = added[added.length - 1];
    return { id: s.id, head: s.head, added: true };
  }
  const edited = now.filter((s) => prev.get(s.head) !== s.body);
  if (edited.length > 0) {
    const s = edited[edited.length - 1];
    return { id: s.id, head: s.head, added: false };
  }
  return null;
}

/* Якорь — как у GitHub (github-slugger): пунктуация снимается целиком, каждый
 * пробел становится дефисом. Отсюда «13 — эфф» → «13--эфф» (два дефиса: тире
 * выброшено, пробелы остались каждый своим). Дефис, подчёркивание и буквы
 * (включая кириллицу) сохраняются, остальные пробельные символы — нет. */
export function anchor(head) {
  return head.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');
}

export function sectionLink(section, cfg) {
  if (!section || !cfg.journal) return null;
  const what = cfg.journal.anchor === 'title' ? section.id : section.head;
  return cfg.journal.url + '#' + anchor(what);
}

/* Ссылка строки: на раздел журнала, если раздел есть, иначе на сам коммит (шаблон
 * из настроек). Одно место для артефакта и для данных страницы: адрес раздела —
 * правило GitHub, и второе его воплощение разъехалось бы с первым. */
export function rowHref(section, sha, cfg) {
  if (section) return sectionLink(section, cfg);
  if (!cfg.links.commitUrl) return null;
  return cfg.links.commitUrl.replace(/\{sha\}/g, sha).replace(/\{short\}/g, sha.slice(0, 7));
}

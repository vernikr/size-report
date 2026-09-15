/* The journal and links: which section a commit belongs to and where its description leads.
 * It works on text rather than on git: sections are searched for in an already read file. */

/* A journal (WORKLOG/CHANGELOG/…): the section a commit belongs to. The heading format comes
 * from a regular expression in the settings; the named groups `id` (the short number used by
 * `§N`) and `title` are optional — without them the number is the first word. */
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

/* The section a commit belongs to: a newly opened one first, otherwise the last of the edited
 * ones in document order. Taking the last assumes a journal written in ascending order, as this
 * tool's own defaults expect; the "newly added" case holds for any order, while in a journal
 * written newest-first (CHANGELOG.md is one) the fallback would name the oldest edited section
 * rather than the newest. */
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

/* The anchor as GitHub makes it (github-slugger): punctuation is dropped entirely and every
 * space becomes a hyphen. Hence "13 — eff" → "13--eff" (two hyphens: the dash is gone while both
 * spaces stay). Hyphens, underscores and letters (Cyrillic included) survive; other whitespace
 * does not. */
export function anchor(head) {
  return head.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');
}

export function sectionLink(section, cfg) {
  if (!section || !cfg.journal) return null;
  const what = cfg.journal.anchor === 'title' ? section.id : section.head;
  return cfg.journal.url + '#' + anchor(what);
}

/* The link of a row: to a journal section when there is one, otherwise to the commit itself (the
 * template comes from the settings). One place for the artifact and for the data of the page: a
 * section address follows GitHub's rule, and a second copy of it would drift from the first. */
export function rowHref(section, sha, cfg) {
  if (section) return sectionLink(section, cfg);
  if (!cfg.links.commitUrl) return null;
  return cfg.links.commitUrl.replace(/\{sha\}/g, sha).replace(/\{short\}/g, sha.slice(0, 7));
}

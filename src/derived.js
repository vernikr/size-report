/* The report's derived quantities: totals, deltas, the content of a cell and a commit's caption come out of
 * the absolute values.
 *
 * The only place where they are counted. Both outputs use this file: the page gets its text pasted into its
 * single file (which may hold no external reference), while the terminal answers import it as an ordinary
 * module. Hence two requirements of this file, both binding:
 *
 *   1. No imports and no module state — or the text cannot be pasted in;
 *   2. One `import` per line and exports as declarations (`export function`) rather than a list of names:
 *      module syntax is removed line by line when pasting, and an unparsed line must not slip into the page
 *      silently (`stripModules` / `pageScript`).
 *
 * The two outputs can drift apart only here, so here is where it has to be guarded:
 * `test/contract-derived.test.js` compares the page's numbers with the artifact's, while `test/page-view.test.js`
 * watches that the page grows no calculation of its own. */

// Thousands split by thin spaces: toLocaleString depends on the Node build's ICU, while the report has to be
// byte-identical on any machine.
export function group(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
}

/* The total: the sum over the switched-on files. A switched-off file joins neither the table nor the sum —
 * otherwise "total" would answer about something other than what is visible. */
export function totalsOf(values, metrics, on) {
  const out = {};
  metrics.forEach((m) => { out[m] = 0; });
  values.forEach((v, i) => {
    if (v === null || (on !== undefined && !on[i])) return;
    metrics.forEach((m) => { out[m] += v[m]; });
  });
  return out;
}

/* The delta to the previous commit. A file's appearance is a growth by its whole volume: otherwise the sum
 * of a column's deltas would not add up to the current size. */
export function deltaOf(now, before) {
  return before === null || before === undefined ? now : now - before;
}

/* The content of a cell of a commit row: what it says and in which colour. Each output turns this into markup
 * itself (an HTML string or a DOM node), while the rules are one. An empty cell means "no change", `—` that
 * the file is absent in the revision.
 * `minus` is passed in rather than chosen here: the page draws the typographic one, and the signature is part
 * of the package's frozen API (`test/api.test.js` holds the list of names). */
export function cellParts(value, delta, minus) {
  if (value === null) return { text: '—', dir: null, miss: true };
  if (!delta) return { text: '', dir: null, miss: false };
  return {
    text: (delta > 0 ? '+' : minus) + group(Math.abs(delta)),
    dir: delta > 0 ? 'up' : 'down',
    miss: false
  };
}

// A cell of the top row: the absolute size, with no delta.
export function valueParts(value) {
  return value === null ? { text: '—', miss: true } : { text: group(value), miss: false };
}

/* A commit row: a "total volume" block and one block per switched-on file, each with a cell per metric. The
 * choosing of the switched-on files happens here, so both the table and the totals come out of one choice. */
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

/* The top row is the absolute sizes at HEAD: an absolute number stands in the table once, and it is the one
 * every delta below it adds up to. */
export function nowModel(values, metrics, on) {
  const total = totalsOf(values, metrics, on);
  const files = [];
  values.forEach((v, i) => {
    if (on !== undefined && !on[i]) return;
    files.push(metrics.map((m) => (v === null ? null : v[m])));
  });
  return { total: metrics.map((m) => total[m]), files: files };
}

/* A commit's caption in terms of data: what to show, how to caption it and where to lead. The link is counted
 * by the engine's `rowHref` — the same place the page's contract takes it from, so both outputs lead there. The
 * caption of the tooltip is here too: two outputs must not caption one commit differently. */
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

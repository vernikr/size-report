/* A parser of the YAML subset that workflow descriptions need: maps by indentation, list items
 * (`- `), scalar values and a flow list (`[a, b]`). Leaving the subset is an explicit error rather
 * than a silently skipped line: a description that stopped parsing has to fail a check instead of
 * passing it.
 *
 * Block scalars (`run: |`) are outside the subset, and that has an error of its own: a multi-line
 * command has to be assembled into one line rather than producing a strange "neither a key nor a
 * list item" in the middle of someone's command later.
 *
 * The parser is one for every guard that reads a workflow description — the check template for a
 * consumer project, the repository's own CI parity, the release from CI: two parsers would diverge
 * as quietly as any two copies of a check do. Why parse at all when there is text: a substring
 * search cannot tell a correct description from one that **does not parse at all** (which is what
 * happened to the release: `? … : …` inside an unquoted value breaks the YAML syntax, while the
 * substring is right there).
 *
 * The parse goes in steps (`map` / `list` / `node`), and the line with a pointer at it live in one
 * state (`p`): inner functions would have to be built anew for every level, and the recursion of
 * levels is the essence of the parse.
 */

/* The description's lines without comments and blanks, with their indentation and their number in
 * the source text. Tabs and trailing spaces are outside the subset: an indentation-based parse on
 * an ambiguous indent would give different people different trees. */
function linesOf(src) {
  const lines = [];
  src.split('\n').forEach((raw, i) => {
    const text = raw.replace(/(^|\s)#.*$/, '').trimEnd();
    if (text.trim() === '') return;
    lines.push({ indent: text.length - text.trimStart().length, text: text.trim(), line: i + 1 });
  });
  for (const l of lines) {
    if (/\s$/.test(l.text) || l.text.indexOf('\t') >= 0) {
      throw new Error('line ' + l.line + ': the indent or the trailing spaces are outside the subset');
    }
  }
  return lines;
}

/* A flow list's item may be quoted (`tags: ['v*']`) — in YAML itself the quotes are no part of the
 * value, and the value is read without them. */
function flowItem(text) {
  if (text.length > 1 && (text[0] === "'" || text[0] === '"') && text[text.length - 1] === text[0]) {
    return text.slice(1, -1);
  }
  return text;
}

function scalar(text, line) {
  if (text === '|' || text === '>') {
    throw new Error('line ' + line + ': the block scalar (`' + text + '`) is outside the subset —'
      + ' assemble the step value into one line');
  }
  /* A rule of YAML itself, and in this file it is no decoration: `? … : …` in a command as an
   * unquoted value parses as the end of the value, which means the description does not parse at
   * all — and a substring search does not see that. */
  const quoted = text[0] === '"' || text[0] === "'" || text[0] === '[';
  if (!quoted && text.indexOf(': ') >= 0) {
    throw new Error('line ' + line + ': a colon with a space in an unquoted value —'
      + ' YAML reads it as the end of the value; quote the value or rewrite the command');
  }
  if (text[0] === '[') {
    if (text[text.length - 1] !== ']') throw new Error('the flow list is not closed: ' + text);
    return text.slice(1, -1).split(',').map((s) => flowItem(s.trim()));
  }
  if (/^\d+$/.test(text)) return Number(text);
  return text;
}

/* A key and a value out of a `key: value` line; `null` means the line is no mapping (the error
 * message depends on the place and thus lives with whoever asked). */
function split(text) {
  const cut = text.indexOf(':');
  if (cut < 0) return null;
  return { key: text.slice(0, cut).trim(), value: text.slice(cut + 1).trim() };
}

/* A key's value: empty means a nested node deeper by indentation, and null when there is none. */
function valueAt(p, kv, line, indent) {
  if (kv.value !== '') return scalar(kv.value, line);
  if (p.at < p.lines.length && p.lines[p.at].indent > indent) return node(p, p.lines[p.at].indent);
  return null;
}

function map(p, indent) {
  const out = {};
  while (p.at < p.lines.length && p.lines[p.at].indent === indent && p.lines[p.at].text[0] !== '-') {
    const head = p.lines[p.at];
    const kv = split(head.text);
    if (kv === null) throw new Error('line ' + head.line + ': neither a key nor a list item');
    p.at++;
    out[kv.key] = valueAt(p, kv, head.line, indent);
  }
  return out;
}

function list(p, indent) {
  const out = [];
  while (p.at < p.lines.length && p.lines[p.at].indent === indent && p.lines[p.at].text[0] === '-') {
    const head = p.lines[p.at];
    const rest = head.text.slice(1).trim();
    p.at++;
    if (rest === '') {
      out.push(node(p, head.indent + 2));
      continue;
    }
    /* A mapping item is written by its first line (`- name: …`) and its remaining keys stand two
     * spaces deeper. */
    const kv = split(rest);
    if (kv === null) throw new Error('line ' + head.line + ': the list item is not a mapping');
    const item = {};
    item[kv.key] = valueAt(p, kv, head.line, head.indent);
    const more = p.at < p.lines.length && p.lines[p.at].indent > head.indent && p.lines[p.at].text[0] !== '-'
      ? map(p, head.indent + 2) : {};
    out.push(Object.assign(item, more));
  }
  return out;
}

function node(p, indent) {
  const first = p.lines[p.at];
  if (first === undefined || first.indent < indent) return null;
  if (first.text[0] === '-') return list(p, first.indent);
  if (first.indent > indent) throw new Error('line ' + first.line + ': the indent is deeper than expected');
  return map(p, first.indent);
}

export function parseWorkflow(src) {
  const lines = linesOf(src);
  const p = { lines: lines, at: 0 };
  const doc = map(p, lines[0].indent);
  if (p.at !== lines.length) throw new Error('the parse ended at line ' + lines[p.at].line);
  return doc;
}

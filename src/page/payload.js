/* The page's block: how the file carries it (gzipped and base64 encoded, `appUnpack`) and how the block in
 * sparse form is turned back into the model the page already spoke.
 *
 * The packing is a **transport rather than the shape**: what comes out of the unpacker is the very block the
 * page received before this chapter knew about gzip, with no field added or removed, and `--data`/`--json`
 * answer with the dense contract as they always did. It buys the artifact's weight (the block is the whole file)
 * and pays for it in two ways, both on purpose: the block can no longer be read by eye or by `diff`, and
 * unpacking is **asynchronous** — the platform's own `DecompressionStream` is the only unpacker here, no library
 * travels in the page and nothing is fetched, so the first drawing waits for a promise where it used to happen
 * during the parse.
 *
 * Why the block is sparse. Of 56 019 cells of this repository's report the non-empty ones hold 1 183 distinct
 * triples, and about a thousand cells differ from the row above: nine tenths of the block is yesterday's
 * numbers written again. So the block keeps, for every file, the rows in which it appeared (absolute numbers),
 * moved (deltas against its own previous record) or disappeared, and this chapter puts the snapshots back
 * together. The whole history walk is O(number of changes) rather than O(rows × files).
 *
 * The model after `appDecode` is exactly `--data` but for one field: the history's mark `last` (the columns the
 * newest commit touched) is not carried, because the page orders its columns by the numbers rather than by the
 * commit's list of paths (`src/page/table.js`). The calculation (`rowModel`, `totalsOf`, `cellParts`,
 * `valueParts`), the table and the panel know nothing about the sparse form, so there is no second way to
 * count a row. A value that did not move is **one object shared by the rows that hold it** — the heap keeps
 * the distinct numbers rather than a copy per commit — and because every consumer reads `v[metric]` and
 * compares nothing by identity, sharing changes no answer.
 *
 * Two rules of the chapters bind here as well: no `import` lines and no module state (the text is pasted into
 * one file), and nothing but declarations (the round-trip check evaluates this file on its own).
 *
 * The dictionary (`strs`) is walked by the encoder in a stated order — files in the column order, rows in the
 * history order, and only the order of the first appearance decides an index. The artifact is rebuilt after
 * every commit and has to come out byte-identical on any machine, so the order of the walk is part of the
 * format rather than a detail of the encoder.
 */

/* The block as the file carries it: the tag's `data-pack` says which packing it is, so the page asks rather than
 * guesses, and a packing it does not know is an error rather than a half-read block. A tag without the marker
 * carries the block itself — the same page works for a build that packs nothing.
 *
 * `DecompressionStream` answers with streams rather than with bytes, hence the reader loop: the promise this
 * function is *is* the price of the weight (see the file's note). `atob` gives one character per byte, and every
 * character above 127 has to be taken back as a byte (`charCodeAt`) rather than as text; `TextDecoder` turns the
 * inflated bytes into the JSON text, which is UTF-8 with the report's own words in it. */
export async function appUnpack(el) {
  const pack = el.getAttribute('data-pack');
  const text = el.textContent;
  if (pack === null) return text;
  if (pack !== 'base64+gzip') throw new Error('the page’s data is packed as “' + pack + '”, which this page cannot read');
  const stream = new DecompressionStream('gzip');
  const sink = stream.writable.getWriter();
  /* The writing is not waited for before the reading: a stream that is filled before it is drained would stall on
   * its own backpressure. A failure of the write surfaces in the reading loop, which is what this promise returns. */
  const feeding = sink.write(appBytes(text)).then(() => sink.close()).catch(() => null);
  const source = stream.readable.getReader();
  const parts = [];
  for (;;) {
    const step = await source.read();
    if (step.done) break;
    parts.push(step.value);
  }
  await feeding;
  return new TextDecoder().decode(appJoined(parts));
}

// base64 read as bytes: the browser's `atob` hands out one character per byte, whatever the byte.
function appBytes(text) {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/* The chunks of an inflated stream as one array: a chunk boundary falls wherever the platform put it. The length is
 * summed by hand rather than by `reduce` — the page's shell computes no totals of its own, and this chapter is part
 * of the shell the checks read (`test/page-view.test.js`). */
function appJoined(parts) {
  let size = 0;
  parts.forEach((part) => { size += part.length; });
  const all = new Uint8Array(size);
  let at = 0;
  parts.forEach((part) => { all.set(part, at); at += part.length; });
  return all;
}

// The dictionary's entry: a text the block does not carry stays absent rather than becoming an empty string.
function appText(p, i) {
  return i === null ? null : p.strs[i];
}

// A value as the page reads it: the metrics by their keys, in the order the block lists them.
function appValue(keys, nums) {
  const out = {};
  keys.forEach((key, mi) => { out[key] = nums[mi]; });
  return out;
}

/* One record of a file's history applied to what the file was: the numbers are absolute when the file was
 * absent and deltas against its own previous record otherwise. A record with nothing but a row means the file
 * is gone from that revision, which is the same `null` the dense contract carries. What comes out is the
 * object every later row shares until the file moves again. */
function appStep(keys, was, rec) {
  if (rec.length === 1) return null;
  const nums = rec.slice(1);
  if (was === null) return appValue(keys, nums);
  return appValue(keys, nums.map((d, mi) => was[keys[mi]] + d));
}

/* The history unrolled, once, into a snapshot per commit — the shape the contract hands out. The records of
 * every file are consumed in the order of the rows, and each row takes what the files were at it: a file whose
 * record has not come around is the very object it was in the row above.
 *
 * The tail of the walk is "now": the report's last row is its last commit that moved a number, the commits
 * after it moved none, and what the files were at the end is the state at HEAD — which is what the dense
 * `now` is. */
function appUnroll(p, keys) {
  const at = p.files.map(() => 0);
  const live = p.files.map(() => null);
  const rows = [];
  for (let r = 0; r < p.rows.length; r++) {
    const row = [];
    p.files.forEach((_f, i) => {
      const rec = p.hist[i][at[i]];
      if (rec !== undefined && rec[0] === r) {
        live[i] = appStep(keys, live[i], rec);
        at[i]++;
      }
      row.push(live[i]);
    });
    rows.push(row);
  }
  return { rows: rows, now: live.slice() };
}

/* A commit row: the caption and where it leads. The address is the block's one prefix plus what the row kept
 * of its own link with the sha, and `added` travels as a mark rather than as a word. The name is not `appRow`:
 * the chapters are pasted into **one scope**, where the table's own `appRow` would quietly win and this one
 * would never be called (`test/page-view.test.js` holds the names apart for that very reason). */
function appRowOf(p, r, values) {
  const section = r[3] === null ? null : { id: appText(p, r[3]), head: appText(p, r[4]), added: r[5] === 1 };
  return {
    sha: appText(p, r[0]),
    when: appText(p, r[1]),
    subject: appText(p, r[2]),
    section: section,
    href: r[6] === null ? null : p.hrefPrefix + appText(p, r[6]),
    values: values
  };
}

/* The whole block, unrolled into the dense contract the page reads: the block is a shape of that contract rather than a
 * subset of it, so `schema` and `tool` come over with the rest although the page reads neither — the form mark and the
 * author belong to the answer an agent is given, and one shape is cheaper to keep than two. */
export function appDecode(p) {
  const keys = p.metrics.map((m) => appText(p, m[0]));
  const hist = appUnroll(p, keys);
  return {
    schema: p.schema,
    tool: p.tool,
    report: p.report,
    metrics: p.metrics.map((m) => ({ key: appText(p, m[0]), label: appText(p, m[1]),
      note: appText(p, m[2]), method: appText(p, m[3]) })),
    categories: p.cats.map((c) => ({ key: appText(p, c[0]), label: appText(p, c[1]) })),
    files: p.files.map((f) => ({ label: appText(p, f[0]), path: appText(p, f[1]),
      paths: f[2].map((i) => p.strs[i]), category: appText(p, f[3]), categoryBy: appText(p, f[4]) })),
    catalog: p.catalog.map((e) => ({ path: appText(p, e[0]), why: appText(p, e[1]) })),
    rows: p.rows.map((r, ri) => appRowOf(p, r, hist.rows[ri])),
    now: hist.now
  };
}

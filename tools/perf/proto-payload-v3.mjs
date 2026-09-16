// Prototype: compact page payload (v3) — transposed sparse per-file history.
// Verifies: lossless round-trip vs schema 1, resulting byte sizes (plain + gzip), decode time.
// The model also serves the "hide instead of rebuild" click path:
// per-file snapshot history is exactly what incremental totals read.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const fileBytes = fs.readFileSync(path.join(ROOT, 'docs', 'size-report.html'));
const text = fileBytes.toString('utf8');
const m = text.match(/<script type="application\/json" id="data">(.*?)<\/script>/s);
const curBytes = Buffer.byteLength(m[1], 'utf8');
const data = JSON.parse(m[1].replace('\\u003c', '<'));
const R = data.rows.length, F = data.files.length;
const NOAPPROX = process.argv.includes('--no-approx');

// ---------- encode (schema 1 -> v3) ----------
function encode() {
  const strs = [];
  const si = new Map();
  const S = (s) => {
    if (s === null || s === undefined) return -1;
    if (!si.has(s)) { si.set(s, strs.length); strs.push(s); }
    return si.get(s);
  };

  const allHref = data.rows.every((r) => typeof r.href === 'string');
  const hrefRow = data.rows.find((r) => r.href);
  const v3 = {
    v: 3,
    tool: [data.tool.name, data.tool.version],
    report: [data.report.locale, data.report.title, data.report.heading, data.report.artifact,
      data.report.fixCommand, data.report.journal, data.report.showSha ? 1 : 0],
    hrefPrefix: allHref && hrefRow ? hrefRow.href.slice(0, hrefRow.href.length - 40) : null,
    metrics: data.metrics.map((x) => (NOAPPROX ? [x.key, S(x.label), S(x.note)] : [x.key, S(x.label), S(x.note), S(x.method), S(x.accuracy)])),
    cats: data.categories.map((c) => [c.key, S(c.label)]),
    files: [],
    rows: [],
    catalog: [],
    last: data.last.map((b, i) => (b ? i : -1)).filter((i) => i >= 0)
  };

  const approxRows = NOAPPROX ? null : (data.approx.min ? data.approx.min.rows : null);
  const approxNow = NOAPPROX ? null : (data.approx.min ? data.approx.min.now : null);

  data.files.forEach((f, i) => {
    const hist = [];
    let prev = null;
    let prevMark = null;
    for (let r = 0; r < R; r++) {
      const v = data.rows[r].values[i];
      const mark = approxRows === null ? null : approxRows[r * F + i] === '1';
      const vKey = v === null ? '∅' : v.raw + ',' + v.min + ',' + v.tok;
      const prevKey = prev === null ? '∅' : prev.raw + ',' + prev.min + ',' + prev.tok;
      if (vKey !== prevKey || mark !== prevMark) {
        if (v === null) hist.push([r, 0]); // deletion
        else {
          const e = [r];
          if (prev === null) e.push(v.raw, v.min, v.tok); // appearance: absolute
          else e.push(v.raw - prev.raw, v.min - prev.min, v.tok - prev.tok);
          if (mark === true) e.push(1);
          hist.push(e);
        }
        prev = v;
        prevMark = mark;
      }
    }
    if (!hist.some((e) => e.length > 2)) throw new Error('file never appeared: ' + f.label);
    v3.files.push([S(f.label), f.path === null ? -1 : S(f.path),
      f.paths.map(S), S(f.category), f.categoryBy === 'config' ? 1 : 0, hist]);
  });

  if (approxNow) {
    v3.approxNow = [];
    for (let i = 0; i < F; i++) if (approxNow[i] === '1') v3.approxNow.push(i);
  }

  data.rows.forEach((row) => {
    const e = [S(row.sha), S(row.when), S(row.subject)];
    if (row.section) e.push([S(row.section.id), S(row.section.head), row.section.added ? 1 : 0]);
    if (!allHref && row.href) e.push(S(row.href));
    v3.rows.push(e);
  });

  const pathToFile = new Map();
  data.files.forEach((f, i) => {
    if (f.path !== null) pathToFile.set(f.path, i);
    f.paths.forEach((p) => pathToFile.set(p, i));
  });
  data.catalog.forEach((entry) => {
    const fi = pathToFile.get(entry.path);
    const c = fi === undefined ? [-1, S(entry.path)] : [fi, -1];
    if (entry.why) c.push(S(entry.why));
    v3.catalog.push(c);
  });

  v3.strs = strs;
  return v3;
}

// ---------- decode (v3 -> schema 1) : what state.js would run ----------
function decode(v3) {
  const str = (i) => (i < 0 ? null : v3.strs[i]);
  const out = {
    schema: 1,
    tool: { name: v3.tool[0], version: v3.tool[1] },
    report: {
      locale: v3.report[0], title: v3.report[1], heading: v3.report[2], artifact: v3.report[3],
      fixCommand: v3.report[4], journal: v3.report[5], showSha: v3.report[6] === 1
    },
    metrics: v3.metrics.map((e) => ({ key: e[0], label: str(e[1]), note: str(e[2]), method: str(e[3]), accuracy: str(e[4]) })),
    categories: v3.cats.map((e) => ({ key: e[0], label: str(e[1]) })),
    files: v3.files.map((e) => ({
      label: str(e[0]), path: str(e[1]), paths: e[2].map(str), category: str(e[3]),
      categoryBy: e[4] === 1 ? 'config' : 'auto'
    })),
    rows: v3.rows.map((e) => {
      const sha = str(e[0]);
      const row = {
        sha: sha,
        when: str(e[1]),
        subject: str(e[2]),
        section: e[3] ? { id: str(e[3][0]), head: str(e[3][1]), added: e[3][2] === 1 } : null,
        href: v3.hrefPrefix !== null ? v3.hrefPrefix + sha : str(e[4]),
        values: new Array(F)
      };
      return row;
    }),
    last: new Array(F).fill(false)
  };
  v3.last.forEach((i) => { out.last[i] = true; });
  // after `out` exists: resolve catalog paths that are file columns
  out.catalog = v3.catalog.map((e) => {
    const fi = e[0];
    const c = { path: fi >= 0 ? (out.files[fi].path || out.files[fi].paths[0]) : str(e[1]), why: null };
    if (e.length > 2) c.why = str(e[2]);
    return c;
  });

  const rowsArr = out.rows;
  const hasMin = !NOAPPROX && ('approxNow' in v3 || v3.metrics.some((x) => x[0] === 'min'));
  const approxRows = hasMin ? new Array(R * F).fill('0') : null;
  const approxNow = hasMin ? new Array(F).fill('0') : null;

  v3.files.forEach((e, i) => {
    let cur = null;
    let mark = false;
    let histPtr = 0;
    const hist = e[5];
    for (let r = 0; r < R; r++) {
      if (histPtr < hist.length && hist[histPtr][0] === r) {
        const h = hist[histPtr++];
        if (h.length === 2) { cur = null; mark = false; }
        else if (cur === null) { cur = { raw: h[1], min: h[2], tok: h[3] }; mark = h.length > 4; }
        else { cur = { raw: cur.raw + h[1], min: cur.min + h[2], tok: cur.tok + h[3] }; mark = h.length > 4; }
      }
      rowsArr[r].values[i] = cur === null ? null : cur;
      if (approxRows) approxRows[r * F + i] = mark ? '1' : '0';
    }
  });

  // now: the HEAD sizes are exactly the last row's values (null where the file is gone at HEAD)
  out.now = rowsArr[R - 1].values;

  // approx: rows bits come from the per-file history, the now bits from the index list
  if (approxRows) {
    if (v3.approxNow) {
      approxNow.fill('0');
      v3.approxNow.forEach((i) => { approxNow[i] = '1'; });
    }
    out.approx = { min: { rows: approxRows.join(''), now: approxNow.join('') } };
  }
  return out;
}

// ---------- run ----------
const v3 = encode();
const plain = JSON.stringify(v3);
const gz = zlib.gzipSync(plain, { level: 9 });
const curGz = zlib.gzipSync(m[1], { level: 9 });

let t1 = performance.now();
const back = decode(JSON.parse(plain));
const tDecode = performance.now() - t1;

// losslessness: rebuild everything and compare
assert.deepStrictEqual(back.tool, data.tool, 'tool');
assert.deepStrictEqual(back.report, data.report, 'report');
if (NOAPPROX) {
  const m1 = back.metrics.map((x) => ({ key: x.key, label: x.label, note: x.note }));
  const m2 = data.metrics.map((x) => ({ key: x.key, label: x.label, note: x.note }));
  assert.deepStrictEqual(m1, m2, 'metrics (no-approx)');
} else {
  assert.deepStrictEqual(back.metrics, data.metrics, 'metrics');
}
assert.deepStrictEqual(back.categories, data.categories, 'categories');
assert.deepStrictEqual(back.files, data.files, 'files');
assert.deepStrictEqual(back.rows.map((r) => ({ ...r, values: undefined })),
  data.rows.map((r) => ({ ...r, values: undefined })), 'rows meta');
for (let r = 0; r < R; r++) assert.deepStrictEqual(back.rows[r].values, data.rows[r].values, 'values row ' + r);
assert.deepStrictEqual(back.now, data.now, 'now');
assert.deepStrictEqual(back.last, data.last, 'last');
assert.deepStrictEqual(back.catalog, data.catalog, 'catalog');
if (data.approx && !NOAPPROX) assert.deepStrictEqual(back.approx, data.approx, 'approx');
console.log('round-trip: LOSSLESS ✓ (all fields deep-equal to schema 1)' + (NOAPPROX ? ' [no-approx]' : ''));

// what the original file spends today, per section (bytes)
const section = (a, b) => {
  const ia = text.indexOf(a);
  const ib = text.indexOf(b, ia);
  return Buffer.byteLength(text.slice(ia + a.length, ib), 'utf8');
};
const scriptBytes = section('<script>', '</script>');
const cssBytes = section('<style>', '</style>');
const uiBytes = section('<script type="application/json" id="ui">', '</script>');
const chrome = fileBytes.length - curBytes - scriptBytes - cssBytes - uiBytes;

const b64 = (buf) => Buffer.byteLength(buf.toString('base64'));
console.log(`\n--- sizes ---`);
console.log(`file today:                 ${(fileBytes.length / 1024).toFixed(0)} KB`);
console.log(`  data ${(curBytes / 1024).toFixed(0)} KB | script ${(scriptBytes / 1024).toFixed(1)} KB | css ${(cssBytes / 1024).toFixed(1)} KB | ui ${(uiBytes / 1024).toFixed(1)} KB | shell ${(chrome / 1024).toFixed(1)} KB`);
console.log(`data today, gzip lvl9:      ${(curGz.length / 1024).toFixed(0)} KB (base64: ${(b64(curGz) / 1024).toFixed(1)} KB)`);
console.log(`v3 plain:                   ${(plain.length / 1024).toFixed(1)} KB text (${(Buffer.byteLength(plain, 'utf8') / 1024).toFixed(1)} KB bytes)`);
console.log(`v3 gzip lvl9:               ${(gz.length / 1024).toFixed(1)} KB (base64: ${(b64(gz) / 1024).toFixed(1)} KB)`);
console.log(`\n--- page totals ---`);
console.log(`today:                                ${(fileBytes.length / 1024).toFixed(0)} KB`);
console.log(`current data gzipped (no v3):         ${((chrome + scriptBytes + cssBytes + uiBytes + b64(curGz)) / 1024).toFixed(0)} KB`);
console.log(`v3 plain JSON embedded:               ${((chrome + scriptBytes + cssBytes + uiBytes + Buffer.byteLength(plain, 'utf8')) / 1024).toFixed(0)} KB`);
console.log(`v3 gzip base64 embedded:              ${((chrome + scriptBytes + cssBytes + uiBytes + b64(gz)) / 1024).toFixed(0)} KB`);
console.log(`\n--- decode cost (JSON.parse + dense rebuild) ---`);
console.log(`${tDecode.toFixed(1)} ms for ${R} rows x ${F} files (today: JSON.parse of data = ~10 ms)`);
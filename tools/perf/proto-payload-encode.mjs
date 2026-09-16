// Кодировщик payload v3 — вынесен из прототипа uploads/page-size-1.txt без изменений логики,
// чтобы лестницу веса (tools/perf/size-ladder.mjs) можно было считать из тех же чисел,
// на которых проверялась беспотерьность (round-trip в том же прототипе).
// ---------- encode (schema 1 -> v3) ----------
export function encodeV3(data, NOAPPROX) {
  const R = data.rows.length;
  const F = data.files.length;
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


/* The probe of step 11 (`border-collapse: separate`), run in live Chrome over `file://` and spoken to over the DevTools
 * protocol directly (Node's own `WebSocket`; nothing of the package is used).
 *
 * Three things are asked, and none can be answered by a jsdom:
 *
 *   1. **What the border model costs at layout** — the table is laid out cold, five times per model, alternating, in
 *      *one* tab over *one* data set (`RELAYOUT`: the whole grid is invalidated and forced each run, with the two
 *      declarations switched by hand). This is the measurement the claim rests on: the collapse model builds a border
 *      map of the whole grid as part of laying it out, and a cross-tab load timing cannot separate that from the
 *      machine's own drift.
 *   2. **What a load costs** — the timings the page itself holds (the forced first layout of the finished table,
 *      `domContentLoaded`, `load`), repeated over interleaved runs in fresh tabs, with one warm-up run per build.
 *   3. **What the grid looks like**, which is a painted thing: screenshots of the same regions in the same window (the
 *      table's corner with the header and the first rows, the bottom with the sticky header over it, and the corner
 *      again with the first metric switched off), read back **in the same browser** — a data URL, an `ImageBitmap`, a
 *      canvas — so the recipe needs nothing but Chrome: no imaging library, no second runtime. The pictures are asked
 *      what a rectangle cannot say: where the lines are, how thick they are, and where the two builds differ.
 *
 * Two conditions learned the hard way: the runs of the two builds are **interleaved** (the machine's load drifts over a
 * minute and un-interleaved runs would line that drift up with the build), and the colour scheme is **forced light**,
 * because the page paints its canvas with the system colour `Canvas` — in a dark-scheme browser the background came out
 * at 18/255, in which a 25 %-grey line is not a thing pixels can be compared with. The reader's choice lives in
 * `localStorage` of the `file://` origin, which every tab shares, so each run loads once, empties it, and only then
 * loads the page it measures.
 *
 *   node probes/archive/step-11-borders.mjs before=/tmp/before-11.html after=/tmp/after-11.html
 *
 * Chrome is expected at the debug port (`--remote-debugging-port=9222`).
 */

import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.CDP_PORT || 9222);
const debug = (route) => 'http://127.0.0.1:' + PORT + route;
const WINDOW = { width: 1280, height: 800, scale: 1 };
const ROUNDS = Number(process.env.ROUNDS || 3);
const REGIONS = ['corner', 'bottom', 'metric-off'];

const targets = process.argv.slice(2).map((a) => {
  const [label, file] = a.split('=');
  return { label: label, url: 'file://' + path.resolve(file) };
});

/* The first layout of the finished table, forced in the microtask that follows the drawing. */
const WRAP = `(() => {
  Object.defineProperty(window, 'appDrawn', {
    configurable: true,
    set(value) {
      this.__drawn = value;
      value.then(() => {
        const t0 = performance.now();
        document.body.offsetHeight;
        window.__firstLayout = performance.now() - t0;
      });
    },
    get() { return this.__drawn; }
  });
})()`;

/* The two border models against each other on one and the same table: the grid is taken out of the flow and put back, so
 * every run pays for a cold layout of all 183 048 nodes, once with each model. `border-spacing` is written as well,
 * because the collapse model ignores it and the separate one would otherwise inherit whatever the styling says. */
const RELAYOUT = `(() => {
  const grid = document.getElementById('grid');
  const shell = document.getElementById('shell');
  const was = shell.scrollTop;
  shell.scrollTop = 0;
  const cold = (mode) => {
    grid.style.borderCollapse = mode;
    grid.style.borderSpacing = '0px';
    grid.style.display = 'none';
    grid.offsetHeight;
    grid.style.display = '';
    const t0 = performance.now();
    grid.getBoundingClientRect().width;
    return Number((performance.now() - t0).toFixed(1));
  };
  const runs = (mode) => { const out = []; for (let i = 0; i < 5; i++) out.push(cold(mode)); return out; };
  const separate = runs('separate');
  const collapse = runs('collapse');
  const width = { separate: Math.round(grid.getBoundingClientRect().width), height: 0 };
  grid.style.borderCollapse = '';
  grid.style.borderSpacing = '';
  grid.getBoundingClientRect();
  width.height = Math.round(grid.getBoundingClientRect().height * 100) / 100;
  shell.scrollTop = was;
  return { separate: separate, collapse: collapse, backToShipped: Math.round(grid.getBoundingClientRect().width),
    widthWithSeparate: width.separate, heightAfter: width.height };
})()`;

async function attach() {
  const res = await fetch(debug('/json/new?' + encodeURIComponent('about:blank')), { method: 'PUT' });
  const target = await res.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((open) => socket.addEventListener('open', open));
  let id = 0;
  const waiting = new Map();
  const events = [];
  socket.addEventListener('message', (raw) => {
    const msg = JSON.parse(raw.data);
    if (msg.id !== undefined && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); return; }
    events.push(msg.method);
  });
  const send = (method, params) => new Promise((done, fail) => {
    const mine = ++id;
    waiting.set(mine, (m) => (m.error ? fail(new Error(method + ': ' + m.error.message)) : done(m.result)));
    socket.send(JSON.stringify({ id: mine, method: method, params: params || {} }));
  });
  const waitFor = async (method) => {
    for (let i = 0; i < 600; i++) {
      if (events.indexOf(method) >= 0) { events.length = 0; return; }
      await new Promise((t) => setTimeout(t, 50));
    }
    throw new Error('Chrome never said ' + method);
  };
  const evaluate = async (expression) => {
    const out = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true });
    if (out.exceptionDetails) throw new Error(JSON.stringify(out.exceptionDetails.exception));
    return out.result.value;
  };
  const open = async (url) => {
    await send('Page.navigate', { url: url });
    await waitFor('Page.loadEventFired');
    await evaluate('window.appDrawn');
    await evaluate(frames);
  };
  return { id: target.id, socket: socket, send: send, waitFor: waitFor, evaluate: evaluate, open: open };
}

const frames = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r(1)))))';

const TIMINGS = `(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  return { firstLayout: Math.round(window.__firstLayout * 10) / 10,
    dom: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) };
})()`;

/* The geometry a rectangle can speak about, and the sticky rows measured against one another. */
const SHAPE = `(() => {
  const grid = document.getElementById('grid');
  const shell = document.getElementById('shell');
  const rows = [...grid.querySelectorAll('tbody tr')];
  const head = [...grid.querySelectorAll('thead tr')];
  const round = (n) => Math.round(n * 100) / 100;
  let hash = 5381;
  rows.forEach((tr) => [...tr.children].forEach((c) => {
    for (let i = 0; i < c.textContent.length; i++) hash = ((hash * 33) ^ c.textContent.charCodeAt(i)) >>> 0;
  }));
  const was = shell.scrollTop;
  shell.scrollTop = 400;
  shell.offsetHeight;
  const sticky = {
    firstHead: round(head[0].getBoundingClientRect().top) + '–' + round(head[0].getBoundingClientRect().bottom),
    secondHeadTop: round(head[1].getBoundingClientRect().top),
    commitLeft: round(grid.querySelector('tbody .c-commit').getBoundingClientRect().left)
  };
  shell.scrollTop = was;
  shell.offsetHeight;
  const style = getComputedStyle(rows[1].querySelector('td'));
  return {
    model: getComputedStyle(grid).borderCollapse + ' / spacing ' + getComputedStyle(grid).borderSpacing,
    scheme: getComputedStyle(document.body).backgroundColor,
    table: { width: Math.round(grid.getBoundingClientRect().width), height: round(grid.getBoundingClientRect().height) },
    shell: { top: round(shell.getBoundingClientRect().top), left: round(shell.getBoundingClientRect().left),
      height: shell.clientHeight, scrollHeight: shell.scrollHeight },
    rowHeights: [...new Set(rows.map((tr) => round(tr.getBoundingClientRect().height)))].sort(),
    headHeights: [...new Set(head.map((tr) => round(tr.getBoundingClientRect().height)))].sort(),
    cellBorder: 'bottom ' + style.borderBottomWidth + ', left ' + style.borderLeftWidth,
    groupBorder: getComputedStyle(grid.querySelector('tbody .g')).borderLeftWidth,
    headerGap: round(head[1].getBoundingClientRect().top - head[0].getBoundingClientRect().bottom),
    sticky: sticky,
    textFingerprint: hash
  };
})()`;

/* The group's line: where it stands, which metric's track carries it, and how wide the table is, with the first metric on
 * and with it off — the acceptance's "the border still falls on the first *visible* metric". */
const GROUPEDGE = `(() => {
  const grid = document.getElementById('grid');
  const read = () => {
    const cells = [...grid.querySelectorAll('tbody tr:nth-child(2) .g')];
    const shown = cells.filter((el) => el.getBoundingClientRect().width !== 0);
    const line = shown.filter((el) => getComputedStyle(el).borderLeftWidth === '1px');
    return {
      shown: shown.length,
      firstShown: shown.length === 0 ? null : {
        track: [...shown[0].classList].find((c) => /^m\\d+$/.test(c)) || 'none',
        left: Math.round(shown[0].getBoundingClientRect().left),
        border: getComputedStyle(shown[0]).borderLeftWidth
      },
      lines: line.length,
      firstLine: line.length === 0 ? null : Math.round(line[0].getBoundingClientRect().left),
      tableWidth: Math.round(grid.getBoundingClientRect().width)
    };
  };
  const on = read();
  const box = [...document.querySelectorAll('#panel input')].find((b) => b.closest('.box.metric') !== null && b.checked);
  box.checked = false;
  box.dispatchEvent(new Event('change'));
  const off = read();
  box.checked = true;
  box.dispatchEvent(new Event('change'));
  return { on: on, off: off };
})()`;

/* The pixels, read in the browser the pictures came from. A line is a row (or a column) of the picture whose pixels are
 * mostly in a light-grey band — the borders are `rgba(127, 127, 127, .25–.35)` over a white canvas, ~210–225 of 255,
 * which no run of text reaches across the whole width. The samples are taken **from the lines the run scan found**, not
 * from hard-coded coordinates, so the same script works on another window or another build. */
const PIXELS = (labels) => `(async () => {
  const WANTED = ${JSON.stringify(labels)};
  const BAND = [195, 246];
  const read = async (url) => {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const grey = new Uint8Array(bitmap.width * bitmap.height);
    for (let i = 0; i < grey.length; i++) grey[i] = data[i * 4];
    return { w: bitmap.width, h: bitmap.height, grey: grey };
  };
  const runs = (flags) => {
    const out = [];
    for (let i = 0; i < flags.length; i++) {
      if (!flags[i]) continue;
      if (out.length !== 0 && i === out[out.length - 1][1] + 1) out[out.length - 1][1] = i;
      else out.push([i, i]);
    }
    return out.map((pair) => [pair[0], pair[1], pair[1] - pair[0] + 1]);
  };
  const inBand = (value) => value >= BAND[0] && value <= BAND[1];
  const lines = (image, axis) => {
    const flags = [];
    if (axis === 'y') {
      for (let y = 0; y < image.h; y++) {
        let n = 0;
        for (let x = 0; x < image.w; x++) if (inBand(image.grey[y * image.w + x])) n++;
        flags.push(n > image.w * 0.5);
      }
    } else {
      for (let x = 0; x < image.w; x++) {
        let n = 0;
        for (let y = 0; y < image.h; y++) if (inBand(image.grey[y * image.w + x])) n++;
        flags.push(n > image.h * 0.5);
      }
    }
    return runs(flags);
  };
  const across = (image, x, y) => Array.from({ length: 9 }, (_v, i) => image.grey[y * image.w + x - 4 + i]);
  const down = (image, x, y) => Array.from({ length: 9 }, (_v, i) => image.grey[(y - 4 + i) * image.w + x]);
  /* The samples are placed where the difference lives: across the **last** vertical line (the group's edge, whose
   * column carries a fractional width — the clip's own edge and the commit column's border are whole pixels in both
   * models and would sample the same way in either), and down the second horizontal line at a column free of vertical
   * lines. */
  const report = (image) => {
    const horizontal = lines(image, 'y');
    const vertical = lines(image, 'x');
    const line = horizontal.length === 0 ? null : horizontal[Math.floor(horizontal.length / 2)][0];
    const middle = Math.floor(image.w / 2);
    const free = vertical.some((run) => Math.abs(run[0] - middle) < 4) ? middle + 6 : middle;
    const row = line === null ? Math.floor(image.h / 2) : line + 6;
    /* How thick the lines are, counted rather than judged: a doubled line is a run of three or more, and the separate
     * model can only spread a border that already sits on a fraction of a pixel. */
    const thickness = (runs) => {
      const out = {};
      runs.forEach((run) => { out[run[2]] = (out[run[2]] || 0) + 1; });
      return out;
    };
    return {
      horizontal: horizontal, vertical: vertical,
      horizontalThickness: thickness(horizontal), verticalThickness: thickness(vertical),
      acrossVertical: vertical.length === 0 ? null : across(image, vertical[vertical.length - 1][0], row),
      downHorizontal: line === null ? null : down(image, free, line)
    };
  };
  const difference = (one, two) => {
    if (one.w !== two.w || one.h !== two.h) return { sizes: [[one.w, one.h], [two.w, two.h]] };
    const rows = new Map();
    const columns = new Map();
    let changed = 0;
    let worst = 0;
    for (let y = 0; y < one.h; y++) {
      for (let x = 0; x < one.w; x++) {
        const delta = Math.abs(one.grey[y * one.w + x] - two.grey[y * one.w + x]);
        if (delta > 8) {
          changed++;
          rows.set(y, (rows.get(y) || 0) + 1);
          columns.set(x, (columns.get(x) || 0) + 1);
        }
        if (delta > worst) worst = delta;
      }
    }
    const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { changed: changed, share: Math.round(changed / (one.w * one.h) * 10000) / 100, worst: worst,
      rowsTouched: rows.size, worstRows: top(rows), columnsTouched: columns.size, worstColumns: top(columns) };
  };
  const loaded = {};
  for (const label of WANTED) loaded[label] = await Promise.all(window.__shots[label].map(read));
  const out = { size: [loaded[WANTED[0]][0].w, loaded[WANTED[0]][0].h], reports: {}, difference: {} };
  WANTED.forEach((label) => {
    out.reports[label] = { corner: report(loaded[label][0]), bottom: report(loaded[label][1]),
      'metric-off': report(loaded[label][2]) };
  });
  if (WANTED.length === 2) {
    out.difference.corner = difference(loaded[WANTED[0]][0], loaded[WANTED[1]][0]);
    out.difference.bottom = difference(loaded[WANTED[0]][1], loaded[WANTED[1]][1]);
    out.difference['metric-off'] = difference(loaded[WANTED[0]][2], loaded[WANTED[1]][2]);
  }
  return out;
})()`;

const shot = async (page, clip, file) => {
  const out = await page.send('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 1 }, clip) });
  fs.writeFileSync(file, Buffer.from(out.data, 'base64'));
  return fs.statSync(file).size;
};

const setup = async (page) => {
  await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride',
    { width: WINDOW.width, height: WINDOW.height, deviceScaleFactor: WINDOW.scale, mobile: false });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: WRAP });
};

const runs = {};
const shots = {};
targets.forEach((target) => { runs[target.label] = []; shots[target.label] = {}; });

/* One run per build before anything is counted: the first tab opened after the browser has been idle pays for the
 * profile's warm-up, and that cost would otherwise land on whichever build happens to be measured first. */
for (const target of targets) {
  const page = await attach();
  await setup(page);
  await page.open(target.url);
  await page.evaluate('localStorage.clear()');
  await page.open(target.url);
  page.socket.close();
  await fetch(debug('/json/close/' + page.id));
}

for (let round = 0; round < ROUNDS; round++) {
  for (const target of targets) {
    const page = await attach();
    await setup(page);
    await page.open(target.url);
    await page.evaluate('localStorage.clear()');
    await page.open(target.url);

    const timing = await page.evaluate(TIMINGS);
    const shape = await page.evaluate(SHAPE);
    const grouped = await page.evaluate(GROUPEDGE);
    runs[target.label].push(Object.assign({ round: round + 1 }, timing));
    if (round === 0) {
      await page.evaluate(frames);
      const shell = await page.evaluate(`(() => {
        const r = document.getElementById('shell').getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top) };
      })()`);
      const clip = { x: shell.x, y: shell.y, width: 460, height: 260 };
      shots[target.label].corner = '/tmp/probe-11-' + target.label + '-top.png';
      shots[target.label].bottom = '/tmp/probe-11-' + target.label + '-bottom.png';
      shots[target.label]['metric-off'] = '/tmp/probe-11-' + target.label + '-metric-off.png';
      const sizes = { corner: await shot(page, clip, shots[target.label].corner) };
      await page.evaluate('document.getElementById("shell").scrollTop = document.getElementById("shell").scrollHeight');
      await page.evaluate(frames);
      sizes.bottom = await shot(page, clip, shots[target.label].bottom);
      await page.evaluate(`(() => {
        document.getElementById("shell").scrollTop = 0;
        const box = [...document.querySelectorAll('#panel input')].find((b) => b.closest('.box.metric') !== null && b.checked);
        box.checked = false;
        box.dispatchEvent(new Event('change'));
      })()`);
      await page.evaluate(frames);
      sizes['metric-off'] = await shot(page, clip, shots[target.label]['metric-off']);
      const ab = await page.evaluate(RELAYOUT);
      console.log('\n== ' + target.label + '  ' + target.url);
      console.log('   border model ' + shape.model + ', body background ' + shape.scheme + ', cell borders '
        + shape.cellBorder + ', group ' + shape.groupBorder + ', table ' + JSON.stringify(shape.table));
      console.log('   row heights ' + JSON.stringify(shape.rowHeights) + ', header ' + JSON.stringify(shape.headHeights)
        + ', gap between the two sticky header rows ' + shape.headerGap + ' px');
      console.log('   sticky: first header ' + shape.sticky.firstHead + ', second header top '
        + shape.sticky.secondHeadTop + ', commit column left ' + shape.sticky.commitLeft);
      console.log('   text fingerprint ' + shape.textFingerprint);
      console.log('   group line with the first metric on ' + JSON.stringify(grouped.on));
      console.log('   group line with the first metric off ' + JSON.stringify(grouped.off));
      console.log('   relayout A/B on this very table: separate ' + JSON.stringify(ab.separate) + ' ms, collapse '
        + JSON.stringify(ab.collapse) + ' ms (the table back to the shipped model: ' + ab.backToShipped
        + ' px wide, ' + ab.heightAfter + ' px tall)');
      console.log('   shots: corner ' + sizes.corner + ' B, bottom ' + sizes.bottom + ' B, metric off '
        + sizes['metric-off'] + ' B');
      await page.evaluate('localStorage.clear()');
    }
    page.socket.close();
    await fetch(debug('/json/close/' + page.id));
  }
}

console.log('\n== timings, ms (' + ROUNDS + ' interleaved rounds, a fresh tab each, one warm-up run per build)');
for (const label of Object.keys(runs)) {
  const first = runs[label].map((r) => r.firstLayout).slice().sort((a, b) => a - b);
  const dom = runs[label].map((r) => r.dom).slice().sort((a, b) => a - b);
  console.log('   ' + label + ': first layout ' + JSON.stringify(runs[label].map((r) => r.firstLayout))
    + ' (lowest ' + first[0] + ', median ' + first[Math.floor(first.length / 2)] + '), dom '
    + JSON.stringify(runs[label].map((r) => r.dom)) + ' (lowest ' + dom[0] + '), load '
    + JSON.stringify(runs[label].map((r) => r.load)));
}

/* The pixels: both builds' screenshots are handed back to a browser tab of their own and read there. */
if (targets.length === 2 && ROUNDS > 0) {
  const page = await attach();
  await page.send('Page.enable');
  for (const target of targets) {
    const urls = REGIONS.map((region) => shots[target.label][region])
      .map((file) => 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'));
    await page.evaluate('window.__shots = window.__shots || {}; window.__shots['
      + JSON.stringify(target.label) + '] = ' + JSON.stringify(urls) + ';');
  }
  const pixels = await page.evaluate(PIXELS(targets.map((t) => t.label)));
  console.log('\n== pixels, ' + pixels.size[0] + '×' + pixels.size[1] + ' per region, read in the browser that drew them');
  REGIONS.forEach((region) => {
    targets.forEach((target) => {
      const one = pixels.reports[target.label][region];
      console.log('   ' + target.label + ' ' + region + ': horizontal lines ' + JSON.stringify(one.horizontal)
        + ' (thickness × count ' + JSON.stringify(one.horizontalThickness) + ')');
      console.log('      vertical lines ' + JSON.stringify(one.vertical) + ' (thickness × count '
        + JSON.stringify(one.verticalThickness) + ')');
      console.log('      across the group’s line ' + JSON.stringify(one.acrossVertical)
        + ', down a row line ' + JSON.stringify(one.downHorizontal));
    });
    console.log('   difference ' + region + ': ' + JSON.stringify(pixels.difference[region]));
  });
  page.socket.close();
  await fetch(debug('/json/close/' + page.id));
}

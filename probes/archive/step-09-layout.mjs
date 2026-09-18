/* A probe of step 09 (`table-layout: fixed`), run in live Chrome over `file://` and spoken to over the DevTools
 * protocol directly (Node's own `WebSocket`; nothing of the package is used).
 *
 * It is not part of the suite: it needs a browser and a person watching, and it answers what no jsdom can — where the
 * columns get their width, whether a number is clipped, whether the header and the commit column still stick, and what
 * the layout of this very table costs under one algorithm and the other.
 *
 *   node probes/archive/step-09-layout.mjs before=/tmp/before-09.html after=/tmp/after-09.html
 *
 * Chrome is expected at the debug port (`--remote-debugging-port=9222`). Every artifact is measured in a page of its
 * own: the first layout is timed right after the page's build, the CDP counters of one load are read (they are deltas
 * since the previous call, so each line belongs to one load), then the DOM is measured, and finally the two algorithms
 * are measured against each other on the one and the same table.
 */

import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.CDP_PORT || 9222);
const debug = (route) => 'http://127.0.0.1:' + PORT + route;

const targets = process.argv.slice(2).map((a) => {
  const [label, file] = a.split('=');
  return { label: label, url: 'file://' + path.resolve(file) };
});

/* The first layout of the table, timed where it happens: the page draws the table without asking the browser anything
 * (`appDrawn` is a promise the checks and this probe wait for), and the read of `document.body.offsetHeight` in the
 * very microtask that follows the drawing is the first forced layout — one pass over the finished table. */
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
    if (msg.id !== undefined && waiting.has(msg.id)) {
      waiting.get(msg.id)(msg);
      waiting.delete(msg.id);
      return;
    }
    events.push(msg.method);
  });
  const send = (method, params) => new Promise((done, fail) => {
    const mine = ++id;
    waiting.set(mine, (msg) => (msg.error ? fail(new Error(method + ': ' + msg.error.message)) : done(msg.result)));
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
    const out = await send('Runtime.evaluate',
      { expression: expression, returnByValue: true, awaitPromise: true });
    if (out.exceptionDetails) throw new Error(JSON.stringify(out.exceptionDetails.exception));
    return out.result.value;
  };
  return { id: target.id, socket: socket, send: send, waitFor: waitFor, evaluate: evaluate };
}

const counters = async (page) => {
  const list = await page.send('Performance.getMetrics');
  const out = {};
  list.metrics.forEach((m) => { out[m.name] = m.value; });
  return out;
};

const line = (c) => 'LayoutCount ' + c.LayoutCount + ' in ' + c.LayoutDuration.toFixed(3) + ' s, RecalcStyleCount '
  + c.RecalcStyleCount + ' in ' + c.RecalcStyleDuration.toFixed(3) + ' s, TaskDuration '
  + c.TaskDuration.toFixed(3) + ' s, Nodes ' + Math.round(c.Nodes) + ', heap '
  + Math.round(c.JSHeapUsedSize / 1048576) + ' MB';

/* One load: the page, the unpacked block and the drawn table. */
async function load(page, url) {
  await page.send('Page.navigate', { url: url });
  await page.waitFor('Page.loadEventFired');
  await page.evaluate('window.appDrawn');
  return page.evaluate('document.querySelectorAll("#grid tbody tr").length');
}

/* What the reader sees: the table's shape, a fingerprint of every text in it, and the pieces step 09 promises — the
 * widths, the clipping, the sticking header and commit column, the delta colours. */
const LOOK = `(() => {
  const grid = document.getElementById('grid');
  const shell = document.getElementById('shell');
  const rows = [...grid.querySelectorAll('tbody tr')];
  const cols = [...grid.querySelectorAll('colgroup col')];
  const px = (el) => Math.round(el.getBoundingClientRect().width);

  let hash = 5381;
  const feed = (text) => { for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0; };
  let cells = 0;
  rows.forEach((tr) => [...tr.children].forEach((cell) => { feed(cell.textContent); cells++; }));
  [...grid.querySelectorAll('thead th')].forEach((cell) => feed(cell.textContent));
  feed(document.getElementById('panel').textContent);
  feed(document.getElementById('note').textContent);

  // Every cell's text as it is laid out, against the content box of its column.
  const range = document.createRange();
  const width = (node) => { range.selectNodeContents(node); return range.getBoundingClientRect().width; };
  const room = [];
  rows[0].querySelectorAll('td').forEach((td) => {
    const style = getComputedStyle(td);
    room.push(td.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
  });
  let measured = 0;
  const widest = room.map(() => 0);
  rows.forEach((tr) => {
    [...tr.querySelectorAll('td')].forEach((td, at) => {
      const text = width(td);
      measured++;
      if (text > widest[at]) widest[at] = text;
    });
  });
  const overflow = [];
  widest.forEach((text, at) => {
    if (text > room[at] + 0.5) overflow.push({ column: at, room: Math.round(room[at]), text: Math.round(text) });
  });

  const head = [...grid.querySelectorAll('thead tr')].map((tr) => tr.getBoundingClientRect());
  const groups = [...grid.querySelectorAll('thead .gh')];
  const subj = grid.querySelector('tbody .subj');
  const color = (cls) => {
    const span = grid.querySelector('.' + cls);
    return span === null ? null : getComputedStyle(span).color;
  };

  // The sticky header and commit column: the shell is scrolled both ways, and both have to hold their edges.
  const was = { x: shell.scrollLeft, y: shell.scrollTop };
  shell.scrollTop = 400;
  shell.scrollLeft = 600;
  const shellBox = shell.getBoundingClientRect();
  const sticky = {
    headTop: Math.round(grid.querySelector('thead tr:last-child th').getBoundingClientRect().top - shellBox.top),
    commitLeft: Math.round(grid.querySelector('tbody .c-commit').getBoundingClientRect().left - shellBox.left),
    cornerTop: Math.round(grid.querySelector('thead .c-commit').getBoundingClientRect().top - shellBox.top)
  };
  shell.scrollTop = was.y;
  shell.scrollLeft = was.x;

  // Hiding a metric has to take its columns with it: the table's width shrinks by them rather than keeping a band.
  const all = grid.getBoundingClientRect().width;
  grid.classList.add('m-off-0');
  const off = grid.getBoundingClientRect().width;
  grid.classList.remove('m-off-0');

  return {
    rows: rows.length,
    cells: cells,
    columns: cols.length,
    fingerprint: hash,
    table: { width: Math.round(all), height: Math.round(grid.getBoundingClientRect().height) },
    column: cols.length === 0 ? null : {
      layout: getComputedStyle(grid).tableLayout,
      declared: getComputedStyle(grid).width,
      commit: px(cols[0]),
      metrics: [1, 2, 3].map((i) => px(cols[i])),
      sum: Math.round(cols.reduce((s, c) => s + px(c), 0)),
      cells: [...rows[0].querySelectorAll('td')].slice(0, 3).map(px)
    },
    commit: {
      clip: px(grid.querySelector('tbody .clip')),
      text: Math.round(width(subj)),
      ellipsis: subj.scrollWidth > subj.clientWidth + 1
    },
    header: {
      rows: head.map((r) => Math.round(r.height)),
      crowded: groups.filter((g) => g.scrollWidth > g.clientWidth + 1).length,
      taller: groups.filter((g) => g.getBoundingClientRect().height > head[0].height + 1).length
    },
    clip: { measured: measured, overflowing: overflow.length, worst: overflow.slice(0, 3) },
    sticky: sticky,
    colors: { up: color('up'), down: color('down') },
    metricOff: Math.round(all - off)
  };
})()`;

/* The two algorithms against each other on one and the same table: `auto` is measured with the `<colgroup>` taken out,
 * or the columns' widths would tell the automatic algorithm what to do — that is, it would not be the table this step
 * replaces. Each run is cold, and every one of the five is reported: the first pays for the invalidation, and the rest
 * show the spread of a busy machine. */
const AB = `(() => {
  const grid = document.getElementById('grid');
  const group = grid.querySelector('colgroup');
  const cold = (mode) => {
    grid.style.tableLayout = mode;
    const t0 = performance.now();
    grid.getBoundingClientRect().width;
    return Number((performance.now() - t0).toFixed(2));
  };
  const runs = (mode) => { const out = []; for (let i = 0; i < 5; i++) out.push(cold(mode)); return out; };
  const fixed = runs('fixed');
  if (group !== null) group.remove();
  const auto = runs('auto');
  if (group !== null) grid.insertBefore(group, grid.firstChild);
  grid.style.tableLayout = '';
  return { fixed: fixed, auto: auto, shipped: getComputedStyle(grid).tableLayout };
})()`;

/* What a click costs: the page's own work is synchronous, and the layout that follows is the reader's wait. The
 * switches are the ones the panel draws, driven the way the page drives them (a `change` on the checkbox), and the
 * read of `document.body.offsetHeight` forces the layout the click made dirty. */
const CLICK = `(() => {
  const grid = document.getElementById('grid');
  const boxes = [...document.querySelectorAll('#panel input')];
  const metric = boxes.find((b) => b.closest('.box.metric') !== null);
  const file = boxes.find((b) => b.closest('.box') !== null && b.title && b.title.indexOf('src/') === 0
    && b.closest('.box.dir') === null && b.closest('.box.all') === null);
  const press = (box, on) => {
    box.checked = on;
    box.dispatchEvent(new Event('change'));
    const t0 = performance.now();
    document.body.offsetHeight;
    return Number((performance.now() - t0).toFixed(1));
  };
  const pair = (box) => [press(box, false), press(box, true), press(box, false)];
  const metricMs = pair(metric);
  const fileMs = pair(file);
  return { metric: metricMs, file: fileMs, layout: getComputedStyle(grid).tableLayout };
})()`;

for (const target of targets) {
  const page = await attach();
  await page.send('Page.enable');
  await page.send('Performance.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: WRAP });
  /* The reader's choice lives in the storage of the origin, and every `file://` page shares it: an artifact measured
   * after another one would come out with that one's switches. A load first (the storage of a fresh page does not
   * exist to be cleared), then the storage is emptied — and emptied again after the clicks. */
  await load(page, target.url);
  await page.evaluate('localStorage.clear()');
  const rows = await load(page, target.url);
  const first = await counters(page);
  const second = await load(page, target.url);
  const again = await counters(page);
  const look = await page.evaluate(LOOK);
  const click = await page.evaluate(CLICK);
  await page.evaluate('localStorage.clear()');
  const ab = await page.evaluate(AB);
  const shot = await page.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join('/tmp', 'probe-09-' + target.label + '.png');
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('\n== ' + target.label + '  ' + target.url + '  (rows ' + rows + ')');
  console.log('   first layout of the finished table, forced where it happens: '
    + (await page.evaluate('Math.round(window.__firstLayout * 100) / 100')) + ' ms');
  console.log('   load 1: ' + line(first));
  console.log('   load 2: ' + line(again));
  console.log('   dom: ' + look.rows + ' rows, ' + look.cells + ' cells, ' + look.columns
    + ' columns, fingerprint ' + look.fingerprint);
  console.log('   table ' + JSON.stringify(look.table) + ' commit ' + JSON.stringify(look.commit));
  console.log('   columns ' + JSON.stringify(look.column));
  console.log('   header ' + JSON.stringify(look.header) + ' clip ' + JSON.stringify(look.clip));
  console.log('   sticky ' + JSON.stringify(look.sticky) + ' colors ' + JSON.stringify(look.colors)
    + ' metricOff ' + look.metricOff);
  console.log('   click to a forced layout: metric off/on/off ' + JSON.stringify(click.metric)
    + ' ms, file off/on/off ' + JSON.stringify(click.file) + ' ms');
  console.log('   algorithm A/B, one table, cold: fixed ' + JSON.stringify(ab.fixed) + ' ms, auto '
    + JSON.stringify(ab.auto) + ' ms, shipped ' + ab.shipped);
  console.log('   shot ' + file);
  page.socket.close();
  await fetch(debug('/json/close/' + page.id));
}

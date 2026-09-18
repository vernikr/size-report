/* The probe of the window's sideways step (`src/page/table.js`), run in live Chrome over `file://` and spoken to over
 * the DevTools protocol directly (Node's own `WebSocket`; nothing of the package is used).
 *
 * **What it answers.** The window of the report is moved by the reader's scroll, and a step sideways is the one that
 * used to be paid for by the whole window: the rows, the header and every cell of them were built again, because a
 * column that is not there cannot be shown. The rows now live through it and only the columns that entered are made
 * (`appStrip`), so what is measured is the two figures a step costs — the page's own handling of the event, and the
 * layout the browser has to redo before the frame — together with the browser's own accounting of a whole sweep and
 * what stands in the grid at each step.
 *
 *   open -na "Google Chrome" --args --remote-debugging-port=9222
 *   node probes/archive/step-12-window.mjs before=/tmp/before-12.html after=/tmp/after-12.html
 *
 * Chrome is expected at the debug port (`--remote-debugging-port=9222`). Read one page at a time: the rounds are
 * separate tabs and a slow machine would otherwise be read as a slow build. The pair is made the way `probes/README.md`
 * says — the shipped side is the committed page (`cp docs/size-report.html /tmp/before-12.html`), the other is the same
 * page built from the working tree to a path outside the repository (`node bin/size.js --write /tmp/after-12.html`).
 */

import path from 'node:path';

const PORT = Number(process.env.CDP_PORT || 9222);
const debug = (route) => 'http://127.0.0.1:' + PORT + route;

const targets = process.argv.slice(2).map((a) => {
  const [label, file] = a.split('=');
  return { label: label, url: 'file://' + path.resolve(file) };
});

/* The column of the report's grid, in pixels: the same figure the page places its cells by (`APP_COL`), and its
 * styling's `--col`. Written here rather than read from the page, because a probe that asked the page where its
 * columns are would measure a step the page defined rather than the reader's. */
const COL = 70;

/* The sweep: `steps` steps of one column, from a place in the middle of the grid. Every step is measured twice — the
 * page's own handling of the event (`sync`, what the reader waits for before the frame can be drawn) and the layout the
 * browser then has to redo (`layout`, forced here rather than waited for, so a step is a number rather than a frame
 * rate). What stands in the grid is taken at every step: a window that was built again and one that was moved hold the
 * same number of nodes, so the count alone says nothing, but a count that *changed* would say the window grew. */
const swipe = (steps) => `(() => {
  const shell = document.getElementById('shell');
  const grid = document.getElementById('grid');
  const one = (dir) => {
    shell.scrollLeft += dir * ${COL};
    const t0 = performance.now();
    shell.dispatchEvent(new Event('scroll'));
    const t1 = performance.now();
    const nodes = grid.querySelectorAll('*').length;
    const cells = grid.querySelector('.row .cells').children.length;
    void document.documentElement.offsetHeight;
    const t2 = performance.now();
    return { sync: t1 - t0, layout: t2 - t1, nodes: nodes, cells: cells };
  };
  shell.scrollLeft = 4 * ${COL};
  shell.dispatchEvent(new Event('scroll'));
  const out = [];
  for (let i = 0; i < ${steps}; i++) out.push(one(1));
  const pick = (key) => out.map((r) => r[key]).sort((a, b) => a - b);
  const stat = (key) => {
    const sorted = pick(key);
    return { median: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1] };
  };
  return {
    steps: out.length,
    from: 4 * ${COL},
    to: shell.scrollLeft,
    scrollable: grid.offsetWidth - shell.clientWidth,
    sync: stat('sync'),
    layout: stat('layout'),
    nodes: out[0].nodes,
    cells: pick('cells').slice(0, 2),
    first: out.slice(0, 3).map((r) => Math.round(r.sync * 1000) / 1000 + '/' + Math.round(r.layout * 1000) / 1000)
  };
})()`;

// The page's report at HEAD, and what the reader sees of it: one figure for both sides of a pair.
const shape = `(() => {
  const grid = document.getElementById('grid');
  return { nodes: grid.querySelectorAll('*').length, cells: grid.querySelectorAll('.cells > span').length,
    rows: grid.querySelectorAll('.row').length, wide: grid.offsetWidth, high: grid.offsetHeight };
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
  return { target: target, send: send, waitFor: waitFor, evaluate: evaluate };
}

/* The browser's own accounting of the sweep: what went into layout and into tasks at all. */
const KEEP = ['LayoutCount', 'LayoutDuration', 'RecalcStyleCount', 'RecalcStyleDuration', 'TaskDuration'];
async function counters(page) {
  const list = await page.send('Performance.getMetrics');
  const out = {};
  list.metrics.forEach((m) => { out[m.name] = m.value; });
  return out;
}
const delta = (a, b) => KEEP.map((k) => k.replace(/Count|Duration/, '') + ' '
  + (b[k] - a[k]).toFixed(k.indexOf('Count') > 0 ? 0 : 3)).join(', ');

async function measure(target) {
  const page = await attach();
  await page.send('Page.enable');
  await page.send('Performance.enable');
  await page.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: target.url });
  await page.waitFor('Page.loadEventFired');
  await page.evaluate('window.appDrawn');
  const before = await counters(page);
  const out = await page.evaluate(swipe(40));
  const after = await counters(page);
  const seen = await page.evaluate(shape);
  await page.send('Target.closeTarget', { targetId: page.target.id });
  return { swipe: out, shape: seen, counters: delta(before, after) };
}

for (const target of targets) {
  const out = await measure(target);
  const ms = (v) => Math.round(v * 1000) / 1000;
  console.log('— ' + target.label);
  console.log('  ' + out.swipe.steps + ' steps of one column, from ' + out.swipe.from + ' to ' + out.swipe.to
    + ' px of ' + out.swipe.scrollable + ' scrollable, the window holding '
    + out.swipe.cells.join('/') + ' cells');
  console.log('  one step: the page ' + ms(out.swipe.sync.median) + ' ms (worst ' + ms(out.swipe.sync.max)
    + '), the layout after it ' + ms(out.swipe.layout.median) + ' ms (worst ' + ms(out.swipe.layout.max) + ')');
  console.log('  the first three steps, page/layout ms: ' + out.swipe.first.join(', '));
  console.log('  the browser over the sweep: ' + out.counters);
  console.log('  the grid: ' + out.shape.nodes + ' nodes, ' + out.shape.cells + ' cells of numbers, '
    + out.shape.rows + ' rows, ' + out.shape.wide + ' × ' + out.shape.high + ' px');
}

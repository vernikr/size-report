/* The probe of the background work (the queue and the bar of `src/page/work.js`), run in live Chrome over `file://` and
 * spoken to over the DevTools protocol directly (Node's own `WebSocket`; nothing of the package is used).
 *
 * Two questions, and the page of this repository answers both:
 *
 *   1. **What does the browser charge for a column-visibility change at all?** A file's column is hidden by a class on
 *      each of its nodes, and a change like that makes the table lay itself out again: the price is measured on its own
 *      — a class toggled on 1, 750, 6 000 and 20 000 cells, then a forced layout — because a slice size is chosen
 *      against it, and a guess there is a slice size nobody can argue about.
 *   2. **What does a reader's click cost, once as shipped and once in slices?** The same category button is pressed on
 *      the shipped page and on the new one: the synchronous part of the click, every long task the browser reports, the
 *      slices the bar went through, and the whole wall time. The shipped page is one task (the freeze this step exists
 *      for); the new page is a row of them with the page answering between.
 *
 * The numbers belong to the page they were taken on: this repository's own report — 249 rows, 317 columns, 3 metrics,
 * 238 500 cells. They are a measurement of *this* table rather than a property of the tool.
 *
 *   open -na "Google Chrome" --args --remote-debugging-port=9222
 *   node probes/archive/step-12-columns.mjs before=/tmp/page-2.6.0.html after=/tmp/page-2.7.0.html
 *
 * Chrome is expected at the debug port (`--remote-debugging-port=9222`). Read one page at a time: each round presses a
 * real button and the machine's drifting load must not line up with the build being measured.
 */

import path from 'node:path';

const PORT = Number(process.env.CDP_PORT || 9222);
const debug = (route) => 'http://127.0.0.1:' + PORT + route;

const targets = process.argv.slice(2).map((a) => {
  const [label, file] = a.split('=');
  return { label: label, url: 'file://' + path.resolve(file) };
});

/* The price of a column: classes toggled on N cells spread over the whole table, then a forced layout. The cells are
 * taken with a co-prime step so that a slice is a band over every row rather than one row's cells. */
const COLUMN_PRICE = `(() => {
  const cells = [...document.querySelectorAll('#grid td')];
  const out = [];
  for (const n of [1, 750, 6000, 20000]) {
    const picked = [];
    for (let i = 0; i < n; i++) picked.push(cells[(i * 11) % cells.length]);
    const t0 = performance.now();
    picked.forEach((c) => c.classList.add('off'));
    const t1 = performance.now();
    void document.documentElement.offsetHeight;
    const t2 = performance.now();
    picked.forEach((c) => c.classList.remove('off'));
    void document.documentElement.offsetHeight;
    out.push({ n: n, toggle: Math.round((t1 - t0) * 10) / 10, layout: Math.round((t2 - t1) * 10) / 10 });
  }
  return out;
})()`;

/* One click, watched to the end. `PerformanceObserver` gives the long tasks — what the reader feels — and a mutation
 * observer on the bar gives the slices, if the page has a bar at all. A page without one is given `settle` ms: its work
 * is a single task, and the paint that follows is the tail of the same freeze. */
const click = (settle) => `(() => new Promise((resolve) => {
  const button = [...document.querySelectorAll('#panel .row .box.all')]
    .find((b) => b.textContent === 'Code').querySelector('input');
  const bar = document.getElementById('bar');
  const tasks = [];
  const slices = [];
  const obs = new PerformanceObserver((list) => {
    list.getEntries().forEach((e) => tasks.push(Math.round(e.duration)));
  });
  obs.observe({ entryTypes: ['longtask'] });
  let watcher = null;
  if (bar !== null) {
    watcher = new MutationObserver(() => slices.push(Math.round(performance.now() - t0)));
    watcher.observe(bar, { attributes: true });
  }
  button.checked = false;
  const t0 = performance.now();
  button.dispatchEvent(new Event('change'));
  const sync = Math.round((performance.now() - t0) * 10) / 10;
  const finish = () => {
    obs.disconnect();
    if (watcher !== null) watcher.disconnect();
    resolve({ sync: sync, slices: slices.length, tasks: tasks.length,
      longest: tasks.length === 0 ? 0 : Math.max.apply(null, tasks),
      blocked: tasks.reduce((a, b) => a + b, 0),
      elapsed: Math.round(performance.now() - t0),
      gaps: slices.slice(1).map((ms, i) => ms - slices[i]).slice(0, 6),
      off: document.querySelectorAll('#grid td.off').length });
  };
  if (bar === null) { setTimeout(finish, ${settle}); return; }
  const poll = () => {
    if (!bar.hidden) { setTimeout(poll, 20); return; }
    setTimeout(finish, 400);
  };
  setTimeout(poll, 20);
}))()`;

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
  return { target: target, socket: socket, send: send, waitFor: waitFor, evaluate: evaluate };
}

/* The browser's own accounting of the work: how much time went into layout and into tasks at all. */
const KEEP = ['LayoutCount', 'LayoutDuration', 'RecalcStyleCount', 'RecalcStyleDuration', 'TaskDuration'];
async function counters(page) {
  const list = await page.send('Performance.getMetrics');
  const out = {};
  list.metrics.forEach((m) => { out[m.name] = m.value; });
  return out;
}
const delta = (a, b) => KEEP.map((k) => k.replace(/Count|Duration/, '') + ' '
  + (b[k] - a[k]).toFixed(k.indexOf('Count') > 0 ? 0 : 3)).join(', ');

const frames = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r(1)))))';

async function measure(target) {
  const page = await attach();
  await page.send('Page.enable');
  await page.send('Performance.enable');
  await page.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: target.url });
  await page.waitFor('Page.loadEventFired');
  await page.evaluate('window.appDrawn');
  await page.evaluate(frames);

  const barQuiet = await page.evaluate('(() => { const b = document.getElementById("bar"); return b === null ? null : b.hidden; })()');
  const price = await page.evaluate(COLUMN_PRICE);
  const before = await counters(page);
  const clickResult = await page.evaluate(click(6000));
  const after = await counters(page);
  await page.send('Target.closeTarget', { targetId: page.target.id });

  return { price: price, barQuiet: barQuiet, click: clickResult, counters: delta(before, after) };
}

for (const target of targets) {
  const out = await measure(target);
  console.log('— ' + target.label + ' (' + out.click.elapsed + ' ms in all)');
  console.log('  a click on the Code category: sync ' + out.click.sync + ' ms, long tasks '
    + out.click.tasks + ' (' + out.click.blocked + ' ms blocked, longest ' + out.click.longest + ' ms)');
  console.log('  the bar: ' + (out.barQuiet === null ? 'none on this page' : 'quiet at the start: ' + out.barQuiet)
    + ', slices ' + out.click.slices + ', gaps ms ' + JSON.stringify(out.click.gaps));
  console.log('  columns left switched off: ' + out.click.off + '; the browser: ' + out.counters);
  console.log('  the price of a column: ' + out.price.map((p) => p.n + ' cells → toggle '
    + p.toggle + ' ms, layout ' + p.layout + ' ms').join('; '));
}

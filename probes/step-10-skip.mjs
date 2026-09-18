/* The probe of step 10 (`content-visibility: auto` on the rows), run in live Chrome over `file://` and spoken to over
 * the DevTools protocol directly (Node's own `WebSocket`; nothing of the package is used).
 *
 * It measures the artifact **with and without the declaration on one and the same page** — the declaration is injected
 * as a `<style>` after the first pass, so the bytes, the data and the program are identical and only the styling
 * differs. That is the A/B this step needs, and it is also what answers the plan's open question: whether the property
 * is honoured on a `<tr>` at all.
 *
 * The witness is the platform's own — `contentvisibilityautostatechange`, whose `skipped` flag is the browser saying "I
 * am not laying this out". Rects are measured too, and deliberately: they were the first answer this probe gave, and
 * they said 217 of 217 rows were laid out, which would have looked like an argument *for* shipping the declaration.
 * Against the div control (`probes/step-10-tables.mjs`) the rects are the false witness and the event is the true one.
 *
 *   node probes/step-10-skip.mjs file=docs/size-report.html
 *   node probes/step-10-tables.mjs       # where the property works at all, in this same Chrome
 *
 * Chrome is expected at the debug port (`--remote-debugging-port=9222`).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.CDP_PORT || 9222);
const debug = (route) => 'http://127.0.0.1:' + PORT + route;

const targets = process.argv.slice(2).map((a) => {
  const [label, file] = a.split('=');
  return { label: label, url: 'file://' + path.resolve(file) };
});

const LISTEN = `(() => {
  window.__cv = { fired: 0, skipped: 0, painted: 0 };
  document.addEventListener('contentvisibilityautostatechange', (event) => {
    window.__cv.fired++;
    if (event.skipped) { window.__cv.skipped++; event.target.dataset.cvSkipped = '1'; }
    else { window.__cv.painted++; delete event.target.dataset.cvSkipped; }
  }, true);
})()`;

const DECLARE = `(() => {
  const style = document.createElement('style');
  style.id = 'probe-step-10';
  style.textContent = '#grid tbody tr:not(.now) { content-visibility: auto; contain-intrinsic-height: auto 24.5px; }';
  document.head.appendChild(style);
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
const KEEP = ['LayoutCount', 'LayoutDuration', 'RecalcStyleCount', 'RecalcStyleDuration', 'TaskDuration'];
const layout = (a, b) => KEEP.map((k) => k.replace('Count', '').replace('Duration', '') + ' '
  + (b[k] - a[k]).toFixed(k.indexOf('Count') > 0 ? 0 : 3)).join(', ');

const frames = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r(1)))))';

async function load(page, url) {
  await page.send('Page.navigate', { url: url });
  await page.waitFor('Page.loadEventFired');
  await page.evaluate('window.appDrawn');
  await page.evaluate(frames);
}

/* Both witnesses, side by side: what the rows say about themselves, and what their rects say. */
const STATE = `(() => {
  const rows = [...document.querySelectorAll('#grid tbody tr')];
  return {
    rows: rows.length,
    declared: rows.filter((tr) => getComputedStyle(tr).contentVisibility === 'auto').length,
    events: window.__cv,
    skippedByEvent: rows.filter((tr) => tr.dataset.cvSkipped === '1').length,
    laidOutByRect: rows.filter((tr) => tr.querySelector('td').getBoundingClientRect().width !== 0).length
  };
})()`;

/* The geometry: the table's own size, the scrollbar's, the rows' heights, a fingerprint of every text in the table — and
 * then the same with the shell let out to its full height, so the whole table is on screen at once and a skipped band
 * would have nowhere to hide. */
const GEOMETRY = `(() => {
  const grid = document.getElementById('grid');
  const shell = document.getElementById('shell');
  const rows = [...grid.querySelectorAll('tbody tr')];
  const head = [...grid.querySelectorAll('thead tr')];
  const round = (n) => Math.round(n * 100) / 100;
  const heights = (list) => [...new Set(list.map((el) => round(el.getBoundingClientRect().height)))].sort();
  let hash = 5381;
  rows.forEach((tr) => [...tr.children].forEach((c) => {
    for (let i = 0; i < c.textContent.length; i++) hash = ((hash * 33) ^ c.textContent.charCodeAt(i)) >>> 0;
  }));
  const clipped = { height: shell.clientHeight, scrollHeight: shell.scrollHeight };
  const was = shell.style.height;
  shell.style.height = (shell.scrollHeight + 4) + 'px';
  shell.offsetHeight;
  const open = { height: shell.clientHeight, rowsOnScreen: rows.filter((tr) => {
    const r = tr.getBoundingClientRect();
    return r.top >= -1 && r.bottom <= document.documentElement.clientHeight + 1;
  }).length, gridHeight: round(grid.getBoundingClientRect().height) };
  shell.style.height = was;
  shell.offsetHeight;
  return { table: { width: Math.round(grid.getBoundingClientRect().width), height: round(grid.getBoundingClientRect().height) },
    scrollbar: clipped, rowHeights: heights(rows), headHeights: heights(head), textFingerprint: hash,
    idsInTable: grid.querySelectorAll('[id]').length, shellLetOut: open };
})()`;

/* A scroll through the whole table with a frame after every step: layout and paint happen in frames, so without them the
 * counters have nothing to count. */
const SCROLL = `(async () => {
  const shell = document.getElementById('shell');
  const steps = 30;
  const span = shell.scrollHeight - shell.clientHeight;
  shell.scrollTop = 0;
  await new Promise((r) => requestAnimationFrame(r));
  const ms = [];
  for (let i = 1; i <= steps; i++) {
    const t0 = performance.now();
    shell.scrollTop = Math.round(span * i / steps);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    ms.push(Number((performance.now() - t0).toFixed(1)));
  }
  const reached = shell.scrollTop;
  const atBottom = shell.scrollHeight;
  shell.scrollTop = 0;
  await new Promise((r) => requestAnimationFrame(r));
  return { steps: steps, worst: Math.max.apply(null, ms), total: Number(ms.reduce((a, b) => a + b, 0).toFixed(1)),
    reached: reached, scrollHeightAtBottom: atBottom, scrollHeightAtTop: shell.scrollHeight };
})()`;

/* The last row after scrolling to it: painted, on screen, saying its number — and the sticky pieces of step 09. */
const LASTROW = `(() => {
  const shell = document.getElementById('shell');
  const rows = [...document.querySelectorAll('#grid tbody tr')];
  const last = rows[rows.length - 1];
  shell.scrollTop = shell.scrollHeight;
  shell.offsetHeight;
  const rect = last.querySelector('td').getBoundingClientRect();
  const shellBox = shell.getBoundingClientRect();
  const at = (el) => Math.round(el.getBoundingClientRect().top - shellBox.top);
  return {
    painted: rect.width > 0 && rect.height > 0,
    box: { w: Math.round(rect.width * 100) / 100, h: Math.round(rect.height * 100) / 100 },
    onScreen: rect.top >= shellBox.top - 1 && rect.bottom <= shellBox.bottom + 1,
    text: last.querySelector('td').textContent.trim(),
    sticky: { head: at(document.querySelector('#grid thead tr:last-child th')),
      commit: Math.round(last.querySelector('.c-commit').getBoundingClientRect().left - shellBox.left),
      corner: at(document.querySelector('#grid thead .c-commit')) }
  };
})()`;

for (const target of targets) {
  const page = await attach();
  await page.send('Page.enable');
  await page.send('Performance.enable');
  await page.send('DOM.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: LISTEN });
  await load(page, target.url);
  await page.evaluate('localStorage.clear()');
  await load(page, target.url);

  const report = async (label) => {
    const state = await page.evaluate(STATE);
    const geometry = await page.evaluate(GEOMETRY);
    const before = await counters(page);
    const scroll = await page.evaluate(SCROLL);
    const after = await counters(page);
    const last = await page.evaluate(LASTROW);
    const found = await page.send('DOM.performSearch', { query: last.text });
    await page.send('DOM.discardSearchResults', { searchId: found.searchId });
    const pdf = await page.send('Page.printToPDF', { printBackground: true });
    const pdfFile = '/tmp/probe-10-' + target.label + '-' + label + '.pdf';
    fs.writeFileSync(pdfFile, Buffer.from(pdf.data, 'base64'));
    execFileSync('pdftotext', ['-layout', pdfFile, '/tmp/probe-10-' + target.label + '-' + label + '.txt']);
    const printed = fs.readFileSync('/tmp/probe-10-' + target.label + '-' + label + '.txt', 'utf8');
    /* What the paper carries: commit lines (a checkbox of a date) and pages. The table is a scroll container, so the
     * print pass sees the band the shell shows rather than all 217 rows — the same in both variants. */
    const commitLines = printed.split('\n').filter((l) => /^\s*\d{4}-\d{2}-\d{2}/.test(l)).length;
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/tmp/probe-10-' + target.label + '-' + label + '-last.png', Buffer.from(shot.data, 'base64'));

    console.log('\n-- ' + target.label + ', ' + label + '  (' + target.url + ')');
    console.log('   rows ' + state.rows + ', declared ' + state.declared + ', skipped by event '
      + state.skippedByEvent + ', laid out by rect ' + state.laidOutByRect + ', events ' + JSON.stringify(state.events));
    console.log('   table ' + JSON.stringify(geometry.table) + ', scrollbar ' + JSON.stringify(geometry.scrollbar)
      + ', shell let out ' + JSON.stringify(geometry.shellLetOut));
    console.log('   row heights ' + JSON.stringify(geometry.rowHeights) + ', header ' + JSON.stringify(geometry.headHeights)
      + ', text fingerprint ' + geometry.textFingerprint + ', ids in the table ' + geometry.idsInTable);
    console.log('   scroll through the table: ' + scroll.steps + ' steps with a frame each, worst ' + scroll.worst
      + ' ms, total ' + scroll.total + ' ms');
    console.log('   layout over that pass: ' + layout(before, after));
    console.log('   scrollbar after the pass: ' + scroll.scrollHeightAtBottom + ' px at the bottom, '
      + scroll.scrollHeightAtTop + ' px back at the top, reached ' + scroll.reached + ' px');
    console.log('   last row: painted ' + last.painted + ' ' + JSON.stringify(last.box) + ', on screen ' + last.onScreen
      + ', «' + last.text + '», sticky ' + JSON.stringify(last.sticky));
    console.log('   search for «' + last.text + '»: ' + found.resultCount + ' hits');
    console.log('   print: ' + fs.statSync(pdfFile).size + ' bytes, ' + printed.split('\f').length + ' pages, '
      + commitLines + ' commit lines read back');
  };

  await report('as-shipped');
  await page.evaluate(DECLARE);
  await page.evaluate(frames);
  await page.evaluate('localStorage.clear()');
  await report('declared');

  page.socket.close();
  await fetch(debug('/json/close/' + page.id));
}

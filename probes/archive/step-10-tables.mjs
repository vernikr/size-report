/* Where `content-visibility: auto` stops working on this table, asked one page at a time and in the geometry where
 * skipping is known to happen (one scroll box at the top of the page — the same as the plain-`<div>` control that does
 * skip). Each variant has a page of its own; six of them: the property on the rows, with collapsed and with separate
 * borders, on the single `<tbody>`, on twenty `<tbody>`s of ten rows each, on a wrapper `<div>` around the whole table,
 * and a `<div>` control in the very same box.
 *
 * The witness is the platform's own: `contentvisibilityautostatechange` says whether the browser skipped an element. A
 * rectangle cannot be asked — a skipped element's descendants may still report one, which is why the artifact's first
 * probe saw 217 rows "laid out" and looked like a pass.
 *
 *   node probes/archive/step-10-tables.mjs
 */

const TABLE_BUILD = (groups, wrap) => `
    const table = document.createElement('table');
    const groups = ${groups};
    for (let g = 0; g < groups; g++) {
      const body = document.createElement('tbody');
      for (let i = 0; i < 200 / groups; i++) {
        const tr = document.createElement('tr');
        const a = document.createElement('td');
        const b = document.createElement('td');
        a.textContent = 'row ' + (g * (200 / groups) + i);
        b.textContent = (g * 7 + i) * 3;
        tr.append(a, b);
        body.appendChild(tr);
      }
      table.appendChild(body);
    }
    ${wrap ? 'const wrapper = document.createElement("div"); wrapper.id = "wrapper";' : ''}
    box.appendChild(${wrap ? 'wrapper' : 'table'});
    ${wrap ? 'wrapper.appendChild(table);' : ''}`;

const DIV_BUILD = `
    for (let i = 0; i < 200; i++) {
      const d = document.createElement('div');
      d.textContent = 'row ' + i;
      box.appendChild(d);
    }`;

const page = (variant) => `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html><html><head><style>
  body { margin: 0; font: 12px/24px system-ui; }
  #box { width: 400px; height: 300px; overflow: auto; border: 1px solid #000; margin: 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { border: 1px solid #ccc; height: 24px; }
  div { height: 24px; }
  ${variant.css}
</style></head><body><div id="box"></div>
<script>
  window.__cv = { fired: 0, skipped: 0, painted: 0 };
  document.addEventListener('contentvisibilityautostatechange', (event) => {
    window.__cv.fired++;
    if (event.skipped) { window.__cv.skipped++; event.target.dataset.cvSkipped = '1'; }
    else { window.__cv.painted++; delete event.target.dataset.cvSkipped; }
  }, true);
  const box = document.getElementById('box');
  const selector = '${variant.selector}';
  ${variant.build}
</script></body></html>`)}`;

const SKIP = 'content-visibility: auto; contain-intrinsic-height: auto 24px;';
const VARIANTS = [
  {
    name: 'rows, collapsed borders   ',
    css: `#box tr { ${SKIP} }`,
    build: TABLE_BUILD(1, false), selector: 'tr'
  },
  {
    name: 'rows, separate borders   ',
    css: `table { border-collapse: separate; } #box tr { ${SKIP} }`,
    build: TABLE_BUILD(1, false), selector: 'tr'
  },
  {
    name: 'tbody: one group of 200  ',
    css: `#box tbody { ${SKIP} }`,
    build: TABLE_BUILD(1, false), selector: 'tbody'
  },
  {
    name: 'twenty tbodies of ten    ',
    css: `#box tbody { ${SKIP} }`,
    build: TABLE_BUILD(20, false), selector: 'tbody'
  },
  {
    name: 'wrapper div around table ',
    css: `#box #wrapper { ${SKIP} height: auto; }`,
    build: TABLE_BUILD(1, true), selector: '#wrapper'
  },
  {
    name: 'control: divs in the box ',
    css: `#box > div { ${SKIP} }`,
    build: DIV_BUILD, selector: '#box > div'
  }
];

async function attach() {
  const res = await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' });
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
  return { id: target.id, socket: socket, send: send, waitFor: waitFor, evaluate: evaluate };
}

const version = await fetch('http://127.0.0.1:9222/json/version').then((r) => r.json());
console.log(version.Browser + '   (a skipped element is marked `data-cv-skipped` by the event listener)\n');

for (const variant of VARIANTS) {
  const tab = await attach();
  await tab.send('Page.enable');
  await tab.send('Page.navigate', { url: page(variant) });
  await tab.waitFor('Page.loadEventFired');
  await tab.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r(1)))))');
  console.log(variant.name + ': ' + JSON.stringify(await tab.evaluate(`(() => {
    const box = document.getElementById('box');
    const all = [...box.querySelectorAll(selector)];
    const boxBox = box.getBoundingClientRect();
    return { elements: all.length, skipped: all.filter((el) => el.dataset.cvSkipped === '1').length,
      onScreen: all.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > boxBox.top && r.top < boxBox.bottom && r.height !== 0;
      }).length,
      events: window.__cv, scrollHeight: box.scrollHeight,
      firstSkipped: all.findIndex((el) => el.dataset.cvSkipped === '1') };
  })()`)));
  tab.socket.close();
  await fetch('http://127.0.0.1:9222/json/close/' + tab.id);
}

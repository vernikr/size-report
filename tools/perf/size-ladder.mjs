// Итоговая лестница веса артефакта: каждая ступень считается из замеренных частей,
// а не оценивается на глаз. Запуск: node tools/perf/size-ladder.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { transformSync } from 'esbuild';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'docs', 'size-report.html'));
const text = html.toString('utf8');
const grab = (open, close) => {
  const i = text.indexOf(open);
  return text.slice(i + open.length, text.indexOf(close, i));
};
const DATA_OPEN = '<script type="application/json" id="data">';
const raw = grab(DATA_OPEN, '</script>');
const ui = grab('<script type="application/json" id="ui">', '</script>');
const css = grab('<style>', '</style>');
const progOpen = text.lastIndexOf('<script>');
const prog = text.slice(progOpen + '<script>'.length, text.indexOf('</script>', progOpen));
const b = (s) => Buffer.byteLength(s, 'utf8');
const b64 = (buf) => Math.ceil(buf.length / 3) * 4;

const shell = html.length - b(raw) - b(prog) - b(css) - b(ui);
const KB = (n) => (n / 1024).toFixed(1);

// --- v3 из uploads/page-size-1.txt (проверен на потерьность тем же скриптом) ---
const { encodeV3 } = await import('./proto-payload-encode.mjs');
const v3 = encodeV3(JSON.parse(raw.replace(/\\u003c/g, '<')), false);
const v3na = encodeV3(JSON.parse(raw.replace(/\\u003c/g, '<')), true);
const v3Plain = Buffer.byteLength(JSON.stringify(v3), 'utf8');
const v3PlainNa = Buffer.byteLength(JSON.stringify(v3na), 'utf8');
const v3Gz = b64(zlib.gzipSync(Buffer.from(JSON.stringify(v3)), { level: 9 }));
const v3GzNa = b64(zlib.gzipSync(Buffer.from(JSON.stringify(v3na)), { level: 9 }));
const curGz = b64(zlib.gzipSync(Buffer.from(raw), { level: 9 }));

// --- программа и CSS ---
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((line) => {
    let inS = null;
    for (let i = 0; i < line.length - 1; i++) {
      const c = line[i];
      if (inS) { if (c === inS && line[i - 1] !== '\\') inS = null; continue; }
      if (c === '"' || c === "'" || c === '`') { inS = c; continue; }
      if (c === '/' && line[i + 1] === '/') return line.slice(0, i).replace(/\s+$/, '');
    }
    return line;
  }).filter((l) => l.trim() !== '').join('\n');
const min = (src, loader) => transformSync(src, { loader, minify: true, charset: 'utf8', legalComments: 'none' }).code;
const assets = {
  'как есть': b(prog) + b(css),
  'без комментариев': b(stripComments(prog)) + b(stripComments(css)),
  'esbuild': b(min(prog, 'js')) + b(min(css, 'css'))
};

const fixed = b(ui) + shell;
const ladder = [];
const step = (name, dataBytes, assetKey, note) => {
  const total = dataBytes + assets[assetKey] + fixed;
  ladder.push([name, dataBytes, assets[assetKey], total, note]);
};
step('сейчас', b(raw), 'как есть', '');
step('только gzip+base64 данных', curGz, 'как есть', 'данные прежние, нужен декодер');
step('только v3 (без approx)', v3PlainNa, 'как есть', 'разреженная история файла');
step('v3 (с approx)', v3Plain, 'как есть', 'для сравнения');
step('v3 (без approx) − комментарии', v3PlainNa, 'без комментариев', '');
step('v3 (без approx) − esbuild', v3PlainNa, 'esbuild', 'esbuild — необязательная зависимость');
step('v3 gzip+base64 (без approx) − esbuild', v3GzNa, 'esbuild', 'плюс асинхронная распаковка');

console.log(`постоянная часть (словарь #ui + оболочка): ${KB(fixed)} KB`);
console.log('');
console.log('| Ступень | Данные | Программа+CSS | Файл целиком | Было 1433.2 KB |');
console.log('|---|---:|---:|---:|---:|');
for (const [name, d, a, t, note] of ladder) {
  console.log(`| ${name}${note ? ' (' + note + ')' : ''} | ${KB(d)} KB | ${KB(a)} KB | **${KB(t)} KB** | −${(100 * (html.length - t) / html.length).toFixed(0)} % |`);
}
console.log('');
console.log(`v3 plain: ${KB(v3Plain)} KB байт (с approx) / ${KB(v3PlainNa)} KB (без approx)`);
console.log(`v3 gzip+base64: ${KB(v3Gz)} KB / ${KB(v3GzNa)} KB`);

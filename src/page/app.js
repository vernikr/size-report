/* Программа страницы отчёта: панель выбора с легендой и таблица.
 *
 * Это обычный исходник, а не строка в движке: его видит линтер, и он же
 * вклеивается в собранную страницу (`pageScript` снимает модульный синтаксис —
 * импорт ниже и объявления с `export` из соседнего файла). Расчёт берётся из
 * производных величин, поэтому включение метрики, категории или файла зовёт тот
 * же расчёт, что считает статическую таблицу, и не может дать других чисел.
 *
 * Страница — один файл без внешних ссылок, поэтому здесь нет ни динамического
 * импорта, ни загрузки чего-либо по сети: оформление приходит тем же файлом,
 * а разметка клеток повторяет статическую таблицу (`clip` и подпись коммита —
 * правила общей части оформления).
 *
 * Панель помнит выбор читателя между открытиями и умеет передать его ссылкой
 * («Память выбора» ниже): запись привязана к паспорту отчёта и хранит только
 * выключенное по именам, поэтому чужая запись не применяется, а исчезнувшее имя
 * просто ничего не значит. Та же запись ложится в адрес — его и отправляют коллеге. */

/* Импорт — одной строкой: модульный синтаксис снимается при вклейке построчно,
 * и оставшаяся строка `import` попала бы в страницу (её ловит проверка). */
import { cellParts, commitParts, nowModel, rowModel, valueParts } from '../derived.js';

const appData = JSON.parse(document.getElementById('data').textContent);
const appUi = JSON.parse(document.getElementById('ui').textContent);
const appView = { metrics: {}, files: [] };
appData.metrics.forEach((m) => { appView.metrics[m.key] = true; });
appData.files.forEach(() => { appView.files.push(true); });

/* Ссылка — это тот же выбор в адресе, под своим именем: чужой якорь страницы
 * ссылкой не считается, и спорить с ним нечем. */
const APP_LINK = '#size-report=';

/* Три обстоятельства первой отрисовки, которые действуют только на ней:
 * адрес в ней не переписывается (его прислали читателю, а не наоборот), память
 * не трогается (присланная ссылка — не выбор читателя), а сообщение о ссылке
 * ещё не гаснет. */
let appStartup = true;
let appForeign = false;
let appTransient = false;

/* -------- память выбора читателя -------- */

/* Имя файла для записи — путь на HEAD, а если файла там уже нет, последний из
 * настроек: по нему файл и опознаётся в отчёте. */
function appFileAt(i) {
  const f = appData.files[i];
  return f.path === null ? f.paths[0] : f.path;
}

/* Отпечаток паспорта: опознавательный знак записи, а не защита от подделки,
 * поэтому 32 бит достаточно (FNV-1a). */
function appHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/* Паспорт отчёта: имя инструмента, схема данных, путь артефакта, заголовок и метки
 * колонок в порядке отчёта. Он и отделяет один отчёт от другого — по нему выбирается
 * ключ записи, поэтому выбор с чужого отчёта не подхватывается. Версии пакета и
 * верхушки истории в паспорте нет намеренно: это тот же отчёт — обновление
 * инструмента не меняет того, что значит колонка, а подросшая история это та же
 * история, к которой читатель и возвращается. */
function appPassport() {
  return appHash([appData.tool.name, appData.schema, appData.report.artifact,
    appData.report.title, appData.files.map((f) => f.label).join('|')].join('\n'));
}
const appKey = 'size-report:' + appPassport();

/* Запись выбора — одна на всё: её кладут и в память, и в адрес, поэтому двух
 * форматов одного состояния не бывает. Хранится только выключенное, по именам:
 * «включено» и «записи нет» — одно и то же состояние, поэтому возврат всех галочек
 * убирает запись, а не оставляет след, неотличимый от выбора. */
function appRecord() {
  const metrics = {};
  const files = {};
  appData.metrics.forEach((m) => { if (!appView.metrics[m.key]) metrics[m.key] = false; });
  appData.files.forEach((_f, i) => { if (!appView.files[i]) files[appFileAt(i)] = false; });
  return { v: 1, passport: appPassport(), metrics: metrics, files: files };
}

// Своя ли запись и того ли формата — одно правило и для памяти, и для адреса.
function appRecordOk(rec) {
  return rec !== null && typeof rec === 'object' && rec.v === 1 && rec.passport === appPassport();
}

function appWrite() {
  const rec = appRecord();
  const empty = Object.keys(rec.metrics).length === 0 && Object.keys(rec.files).length === 0;
  if (!appTransient) {
    try {
      if (empty) window.localStorage.removeItem(appKey);
      else window.localStorage.setItem(appKey, JSON.stringify(rec));
    } catch (_e) {
      /* Памяти нет (браузер её не даёт этой странице): выбор не переживёт закрытия,
       * а числа и разметка от этого не зависят. */
    }
  }
  /* Адрес и есть ссылка для коллеги, поэтому он повторяет выбор. Но не на первой
   * отрисовке и не тогда, когда ссылка оказалась чужой: присланный адрес — не наш,
   * его читателю ещё читать. */
  if (appStartup || appForeign) return;
  try {
    window.history.replaceState(null, '', APP_LINK + encodeURIComponent(JSON.stringify(rec)));
  } catch (_e) {
    /* Браузер не даёт менять адрес: ссылку тогда берут из памяти браузера. */
  }
}

/* Сброс к «включено всё»: граница между «в отчёте этого больше нет» и
 * «выключено» — это запись, а не отсутствие значения. Ссылка несёт весь выбор
 * отправителя, поэтому применяется на чистом виде, а не поверх чужого. */
function appAll() {
  appData.metrics.forEach((m) => { appView.metrics[m.key] = true; });
  appData.files.forEach((_f, i) => { appView.files[i] = true; });
}

/* Что говорит адрес. Отвечает либо своей записью, либо отказом (`linkForeign` —
 * ссылка другого отчёта, `linkBroken` — прочитать нечего): чужой или испорченный
 * выбор не применяется, но и не молчит — иначе читатель не поймёт, почему он видит
 * не то, что ему прислали. Адрес без имени ссылки не ссылка вовсе: молчание, чтобы
 * не спорить с обычными якорями страницы. */
function appLinkRead() {
  const hash = window.location.hash || '';
  if (hash.indexOf(APP_LINK) !== 0) return { rec: null, refused: null };
  const body = hash.slice(APP_LINK.length);
  let rec = null;
  try {
    rec = JSON.parse(decodeURIComponent(body));
  } catch (_e) {
    try {
      rec = JSON.parse(body);
    } catch (_e2) {
      return { rec: null, refused: 'linkBroken' };
    }
  }
  if (!appRecordOk(rec)) {
    return { rec: null, refused: rec === null || typeof rec !== 'object' || rec.v !== 1
      ? 'linkBroken' : 'linkForeign' };
  }
  return { rec: rec, refused: null, extra: appUnknown(rec) };
}

/* Сколько имён в ссылке этому отчёту неизвестны: о них читателю надо сказать —
 * иначе он будет искать в таблице то, чего в ней и не было. */
function appUnknown(rec) {
  const known = {};
  const metricKeys = {};
  appData.files.forEach((_f, i) => { known[appFileAt(i)] = true; });
  appData.metrics.forEach((m) => { metricKeys[m.key] = true; });
  let n = 0;
  Object.keys(rec.metrics || {}).forEach((k) => { if (!metricKeys[k]) n++; });
  Object.keys(rec.files || {}).forEach((k) => { if (!known[k]) n++; });
  return n;
}

/* Сообщение о ссылке гаснет после первого же действия читателя: он его прочитал, а
 * постоянное предупреждение — это шум поверх чисел. */
function appNotice(text) {
  const el = document.getElementById('notice');
  el.textContent = text;
  el.hidden = text === '';
}

/* Что делает с адресом его событие — открытие страницы и перемена якоря на уже
 * открытой (браузер в этом случае документ не перезагружает, а лишь переставляет
 * якорь, поэтому без этого разбора ссылка работала бы только в новой вкладке).
 * Своя ссылка заменяет вид целиком: в ней весь выбор отправителя, а не разница с
 * чужим. Отказ объясняется словами — и не трогает ни вид, ни адрес. */
function appLinkUse() {
  const link = appLinkRead();
  if (link.rec !== null) {
    appAll();
    appApply(link.rec);
    if (link.extra > 0) appNotice(appUi.linkExtra.replace('{n}', link.extra));
    return 'ours';
  }
  if (link.refused !== null) {
    appNotice(appUi[link.refused]);
    return 'refused';
  }
  return 'none';
}

/* Чтение: только своя запись — своей версии формата и своего паспорта. Запись
 * чужого отчёта лежит под другим ключом, а чужая, устаревшая или испорченная
 * равносильна её отсутствию. */
function appRead() {
  let text = null;
  try {
    text = window.localStorage.getItem(appKey);
  } catch (_e) {
    return null;
  }
  if (text === null) return null;
  let rec = null;
  try {
    rec = JSON.parse(text);
  } catch (_e) {
    return null;
  }
  return appRecordOk(rec) ? rec : null;
}

/* Применение — по именам: файл опознаётся путём, метрика ключом. Имени, которого в
 * отчёте нет, ничего не соответствует (колонку перенаправили на другой путь,
 * метрику убрали из настроек), а появившиеся файлы и метрики остаются включёнными —
 * как их видит тот, кто открыл страницу впервые. */
function appApply(rec) {
  const metrics = rec.metrics || {};
  const files = rec.files || {};
  appData.metrics.forEach((m) => { if (metrics[m.key] === false) appView.metrics[m.key] = false; });
  appData.files.forEach((_f, i) => { if (files[appFileAt(i)] === false) appView.files[i] = false; });
}

function appEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

/* Переключатель — метка вокруг поля ввода: цель нажатия одна, поэтому по нему
 * попадают и мышь, и клавиатура (`Space` на поле ввода), и вспомогательные
 * технологии. Подпись видимая, подробности — во всплывающей строке. */
function appBox(label, title, checked, onChange, cls) {
  const box = appEl('label', 'box' + (cls ? ' ' + cls : ''));
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  if (title) input.title = title;
  input.addEventListener('change', onChange);
  box.appendChild(input);
  box.appendChild(appEl('span', null, label));
  return box;
}

/* Легенда: образцы — теми же классами, что и числа в клетках (`up`/`down` из
 * общей части оформления), поэтому образец не может разойтись с цветом числа. */
function appLegend() {
  const list = appEl('ul', 'legend');
  appUi.legend.forEach((item) => {
    const li = appEl('li');
    li.appendChild(appEl('span', 'swatch ' + item.cls));
    li.appendChild(appEl('span', null, item.text));
    list.appendChild(li);
  });
  return list;
}

/* Галочку файла ставит только файл: и категория, и папка в дереве — способы
 * переставить те же галочки сразу группой, а своего состояния у них нет. Иначе
 * одно и то же решение жило бы в двух местах и расходилось. */
function appFileBox(i) {
  const f = appData.files[i];
  const where = appFileAt(i) + (f.path === null ? ' (нет на HEAD)' : '');
  return appBox(f.label, where + ' · категория: '
    + (f.categoryBy === 'config' ? 'из настроек' : 'по расширению'), appView.files[i], (e) => {
    appView.files[i] = e.target.checked;
    appRender();
  });
}

/* Все файлы поддерева — то, чем управляет переключатель папки. */
function appIndexes(node) {
  const out = node.files.slice();
  node.dirs.forEach((sub) => { out.push(...appIndexes(sub)); });
  return out;
}

/* Узлы одного уровня: сперва папки по алфавиту, затем файлы в порядке данных.
 * Переключатель папки стоит над своим поддеревом и показывает три состояния: все
 * файлы включены, часть, ни одного. */
function appTreeList(node) {
  const list = appEl('ul', 'tree');
  [...node.dirs.keys()].sort().forEach((name) => {
    const sub = node.dirs.get(name);
    const idx = appIndexes(sub);
    const on = idx.map((i) => appView.files[i]);
    const some = on.some((v) => v);
    const head = appBox(name + '/', appUi.dir.replace('{name}', name).replace('{n}', idx.length),
      some && on.every((v) => v), (e) => {
        idx.forEach((i) => { appView.files[i] = e.target.checked; });
        appRender();
      }, 'dir');
    head.querySelector('input').indeterminate = some && !on.every((v) => v);
    head.appendChild(appEl('span', 'n', idx.length));
    const li = appEl('li');
    li.appendChild(head);
    li.appendChild(appTreeList(sub));
    list.appendChild(li);
  });
  node.files.forEach((i) => {
    const li = appEl('li');
    li.appendChild(appFileBox(i));
    list.appendChild(li);
  });
  return list;
}

/* Дерево файлов: путь делится по «/», папки становятся узлами, файлы — листьями.
 * Строится из тех же путей, что показаны в подписи файла, поэтому дерево и список
 * файлов не могут разойтись. */
function appTree() {
  const root = { files: [], dirs: new Map() };
  appData.files.forEach((f, i) => {
    const parts = (f.path === null ? f.paths[0] : f.path).split('/');
    let node = root;
    for (let d = 0; d < parts.length - 1; d++) {
      if (!node.dirs.has(parts[d])) node.dirs.set(parts[d], { files: [], dirs: new Map() });
      node = node.dirs.get(parts[d]);
    }
    node.files.push(i);
  });
  return appTreeList(root);
}

function appPanel() {
  const panel = document.getElementById('panel');
  panel.textContent = '';

  const metrics = appEl('fieldset');
  metrics.appendChild(appEl('legend', null, appUi.metrics));
  const mrow = appEl('div', 'row');
  appData.metrics.forEach((m) => {
    mrow.appendChild(appBox(m.label, m.note + ' · способ: ' + m.method + ' (' + m.accuracy + ')',
      appView.metrics[m.key], (e) => {
        appView.metrics[m.key] = e.target.checked;
        appRender();
      }));
  });
  metrics.appendChild(mrow);
  panel.appendChild(metrics);

  const files = appEl('fieldset', 'files');
  files.appendChild(appEl('legend', null, appUi.files));
  const cats = appEl('div', 'row');
  appData.categories.forEach((cat) => {
    const idx = [];
    appData.files.forEach((f, i) => { if (f.category === cat.key) idx.push(i); });
    cats.appendChild(appBox(cat.label, appUi.all + ' · ' + cat.label, idx.every((i) => appView.files[i]),
      (e) => {
        idx.forEach((i) => { appView.files[i] = e.target.checked; });
        appRender();
      }, 'all'));
  });
  files.appendChild(cats);
  files.appendChild(appTree());
  panel.appendChild(files);

  panel.appendChild(appLegend());
}

// Разметка клетки строки-коммита: правила — в cellParts, здесь только узел.
function appCell(cell, first) {
  const parts = cellParts(cell.value, cell.delta, '−');
  const td = appEl('td', 'num' + (first ? ' g' : '') + (parts.miss ? ' miss' : ''));
  if (parts.dir === null) td.textContent = parts.text;
  else td.appendChild(appEl('span', 'delta ' + parts.dir, parts.text));
  return td;
}

// Разметка клетки верхней строки: правила — в valueParts.
function appValueCell(value, first) {
  const parts = valueParts(value);
  const td = appEl('td', 'num' + (first ? ' g' : '') + (parts.miss ? ' miss' : ''));
  td.textContent = parts.text;
  return td;
}

/* Подпись коммита — той же разметкой, что в статической таблице: дата, тема,
 * метка раздела журнала. Ширину колонки и обрезку длинной темы задаёт общая часть
 * оформления, поэтому колонка не прыгает при переключении файлов. */
function appCommit(row) {
  const parts = commitParts(row, appData.report.showSha, row.href);
  const name = parts.href ? appEl('a', 'subj', parts.subject) : appEl('span', 'subj', parts.subject);
  if (parts.href) name.href = parts.href;
  name.title = parts.title;
  const mark = appEl('span', 'sect', parts.mark.text);
  if (parts.mark.title) mark.title = parts.mark.title;

  const clip = appEl('div', 'clip');
  clip.appendChild(appEl('span', 'when', parts.when));
  clip.appendChild(name);
  clip.appendChild(mark);
  const th = appEl('th', 'c-commit');
  th.appendChild(clip);
  return th;
}

function appSubHead(metrics) {
  const tr = appEl('tr');
  metrics.forEach((m, mi) => tr.appendChild(appEl('th', mi === 0 ? 'g' : '', m.label)));
  return tr;
}

/* Состояния пустоты: когда чисел не будет вовсе, страница говорит об этом словами,
 * а не сеткой без колонок. Файлы можно выключить все — тогда остаётся общий объём,
 * и подсказка объясняет, почему колонок нет. */
function appState(metricsCount, filesCount) {
  const state = document.getElementById('state');
  const text = metricsCount === 0 ? appUi.empty : (filesCount === 0 ? appUi.noFiles : '');
  state.textContent = text;
  state.hidden = text === '';
  document.getElementById('shell').hidden = metricsCount === 0;
}

function appTable() {
  const shown = appData.metrics.filter((m) => appView.metrics[m.key]);
  const metrics = shown.map((m) => m.key);
  const on = appView.files;
  const files = [];
  appData.files.forEach((f, i) => { if (on[i]) files.push(i); });
  const table = document.getElementById('grid');
  table.textContent = '';
  appState(metrics.length, files.length);
  if (metrics.length === 0) return;

  const head = appEl('tr');
  const commit = appEl('th', 'c-commit', appUi.commit);
  commit.rowSpan = 2;
  head.appendChild(commit);
  const total = appEl('th', 'g', appUi.total);
  total.colSpan = metrics.length;
  head.appendChild(total);
  files.forEach((i) => {
    const th = appEl('th', 'g', appData.files[i].label);
    th.colSpan = metrics.length;
    head.appendChild(th);
  });
  const subs = appSubHead(shown);
  files.forEach(() => {
    const more = appSubHead(shown);
    while (more.firstChild) subs.appendChild(more.firstChild);
  });
  const thead = appEl('thead');
  thead.appendChild(head);
  thead.appendChild(subs);

  const body = appEl('tbody');
  for (let r = appData.rows.length - 1; r >= 0; r--) {
    const row = appData.rows[r];
    const prev = r === 0 ? null : appData.rows[r - 1];
    const model = rowModel(row.values, prev === null ? null : prev.values, metrics, on);
    const tr = appEl('tr');
    tr.appendChild(appCommit(row));
    model.total.forEach((cell, mi) => tr.appendChild(appCell(cell, mi === 0)));
    model.files.forEach((cells) => cells.forEach((cell, mi) => tr.appendChild(appCell(cell, mi === 0))));
    body.appendChild(tr);
  }

  /* Верхняя строка — «сейчас»: абсолютные размеры на HEAD. Дельты под ней сходятся
   * с ней, поэтому она и стоит первой. */
  const now = appEl('tr', 'now');
  now.appendChild(appEl('th', 'c-commit', appUi.now));
  const nowCells = nowModel(appData.now, metrics, on);
  nowCells.total.forEach((v, mi) => now.appendChild(appValueCell(v, mi === 0)));
  nowCells.files.forEach((cells) => cells.forEach((v, mi) => now.appendChild(appValueCell(v, mi === 0))));
  body.insertBefore(now, body.firstChild);

  table.appendChild(thead);
  table.appendChild(body);
  document.getElementById('note').textContent = appUi.note
    .replace('{rows}', appData.rows.length)
    .replace('{command}', appData.report.fixCommand);
  appWrite();
}

/* Панель перерисовывается целиком, поэтому поле, стоящее под клавиатурой, после
 * каждой пересборки возвращается на своё место: иначе переключение с Tab и Space
 * требовало бы начинать обход панели заново. Место опознаётся порядковым номером
 * поля — порядок полей панели от данных не зависит. */
function appRender(keepNotice) {
  const at = Array.from(document.querySelectorAll('#panel input')).indexOf(document.activeElement);
  appPanel();
  if (at >= 0) document.querySelectorAll('#panel input')[at].focus();
  appTable();
  /* Сообщение о ссылке переживает отрисовку, которая сама же им и вызвана, и
   * гаснет от действия читателя: он его уже прочитал. */
  if (keepNotice !== true) appNotice('');
}

/* Восстановление — до первой отрисовки: у того, кто открыл страницу впервые,
 * разметка обязана быть умолчанием, а не чужим выбором. Ссылка старше памяти: это
 * явный выбор отправителя, и пока читатель ничего не менял, она его собственный
 * выбор не подменяет — в память её запись не идёт. Отказ ссылки — не пустая
 * таблица, а сообщение: читателю видно и что произошло, и что показано вместо. */
const appStart = appLinkUse();
if (appStart === 'ours') appTransient = true;
else if (appStart === 'refused') appForeign = true;
if (appStart !== 'ours') {
  const appSaved = appRead();
  if (appSaved !== null) appApply(appSaved);
}
appRender(true);
appStartup = false;
appForeign = false;
appTransient = false;

/* Якорь сменился на открытой странице: выбор из нового адреса применяется тем же
 * кодом, что и при открытии. Свой собственный адрес такого события не поднимает
 * (`replaceState` его не вызывает), поэтому петли здесь нет. Отказ не трогает ни
 * вид — читатель продолжает смотреть то, что смотрел, — ни адрес: его прислали
 * читателю, и до первого его действия это не наше. */
window.addEventListener('hashchange', () => {
  const state = appLinkUse();
  if (state === 'refused') appForeign = true;
  appTransient = state === 'ours';
  appRender(true);
  appForeign = false;
  appTransient = false;
});

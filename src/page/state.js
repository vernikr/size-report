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
 * просто ничего не значит. Та же запись ложится в адрес — его и отправляют коллеге.
 *
 * Точность числа страница не выводит сама: пометки приближённых клеток приходят в
 * данных, от того же правила, по которому названа точность метрики. Из путей и
 * форматов страница такого вывода не делает — второго правила точности не будет. */

/* Импорт — одной строкой: модульный синтаксис снимается при вклейке построчно,
 * и оставшаяся строка `import` попала бы в страницу (её ловит проверка). */

export const appData = JSON.parse(document.getElementById('data').textContent);
export const appUi = JSON.parse(document.getElementById('ui').textContent);
export const appView = { metrics: {}, files: [], folded: {} };
appData.metrics.forEach((m) => { appView.metrics[m.key] = true; });
appData.files.forEach(() => { appView.files.push(true); });

/* Описание метрики по ключу: подсказка приближённой клетки называет способ её
 * числа — тот же, что стоит в подписи метрики, поэтому двух ответов про «чем
 * посчитано» у страницы нет. */
export const appMetric = {};
appData.metrics.forEach((m) => { appMetric[m.key] = m; });

/* Колонка по пути файла: дерево страницы — дерево проекта (все пути каталога), а
 * числа есть только у колонок, поэтому лист дерева по этому указателю и решает,
 * галочка он или подпись. Имя берётся тем же правилом, что у записи выбора
 * (`appFileAt`), — дерево и память читателя разойтись не могут. */
export const appMeasured = {};
appData.files.forEach((_f, i) => { appMeasured[appFileAt(i)] = i; });

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
export function appFileAt(i) {
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

export function appWrite() {
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
export function appNotice(text) {
  const el = document.getElementById('notice');
  el.textContent = text;
  el.hidden = text === '';
}

/* Что делает с адресом его событие — открытие страницы и перемена якоря на уже
 * открытой (браузер в этом случае документ не перезагружает, а лишь переставляет
 * якорь, поэтому без этого разбора ссылка работала бы только в новой вкладке).
 * Своя ссылка заменяет вид целиком: в ней весь выбор отправителя, а не разница с
 * чужим. Отказ объясняется словами — и не трогает ни вид, ни адрес. */
export function appLinkUse() {
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
export function appRead() {
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
export function appApply(rec) {
  const metrics = rec.metrics || {};
  const files = rec.files || {};
  appData.metrics.forEach((m) => { if (metrics[m.key] === false) appView.metrics[m.key] = false; });
  appData.files.forEach((_f, i) => { if (files[appFileAt(i)] === false) appView.files[i] = false; });
}

/* -------- сложенное дерево -------- */

/* Сложенные папки — память того же рода, что выбор, но своей записи: она про то,
 * сколько дерева видно, а не про то, какие числа читают. Поэтому в адрес она не
 * идёт: ссылку отправляют ради чисел, а разложенное дерево — дело смотрящего. Как и
 * у выбора, здесь помнится только сложенное (`true`), а имя папки — это путь
 * («src/page»), поэтому исчезнувшее имя просто ничего не значит. */
const appFoldKey = appKey + ':tree';

export function appFoldRead() {
  let text = null;
  try {
    text = window.localStorage.getItem(appFoldKey);
  } catch (_e) {
    return;
  }
  if (text === null) return;
  let rec = null;
  try {
    rec = JSON.parse(text);
  } catch (_e) {
    return;
  }
  if (!appRecordOk(rec)) return;
  const folded = rec.folded || {};
  Object.keys(folded).forEach((p) => { if (folded[p] === true) appView.folded[p] = true; });
}

export function appFoldSet(path, folded) {
  if (folded) appView.folded[path] = true;
  else delete appView.folded[path];
  const rec = { v: 1, passport: appPassport(), folded: Object.assign({}, appView.folded) };
  try {
    if (Object.keys(rec.folded).length === 0) window.localStorage.removeItem(appFoldKey);
    else window.localStorage.setItem(appFoldKey, JSON.stringify(rec));
  } catch (_e) {
    /* Памяти нет: сложенное не переживёт закрытия страницы, а вид от этого не
     * зависит — дерево сложено ровно так, как его сложил читатель сейчас. */
  }
}

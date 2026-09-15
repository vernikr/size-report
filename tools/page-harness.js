/* Обвязка проверок контракта и страницы: данные контракта, собранная страница и
 * чтение её в настоящем DOM. Одна на четыре набора (`contract-data`,
 * `contract-derived`, `page-view`, `page-choice`) — по той же причине, по которой
 * общая обвязка одна на пакет (`tools/harness.js`): копия настройки в двух файлах
 * расходится молча, и датчик дублей ловит это раньше человека.
 *
 * Лежит в `tools/`, а не в `test/`: раннер Node считает набором любую `.js` в
 * каталоге `test/` и исполнил бы помощник как пустой набор. jsdom грузится здесь
 * и только теми наборами, которые сюда импортируют: остальным проверкам он не
 * нужен и не оплачивается.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SYNTH, cloneFixture, runFixture } from './harness.js';

/* Данные контракта и замороженный эталон: свежий клон фикстуры плюс один прогон
 * `--data`. Контракт одинаков у всех, кто его читает, — это проверяет отдельно
 * воспроизводимость, а не общая подготовка. */
export function contractData(tmp, name) {
  const dir = cloneFixture(path.join(tmp, 'fixture-' + name));
  const run = runFixture(dir, ['--data']);
  assert.equal(run.code, 0,
    'инструмент не отдал --data (код ' + run.code + '): ' + run.stderr.trim());
  const golden = JSON.parse(fs.readFileSync(path.join(SYNTH, 'golden.json'), 'utf8'));
  // `text` — тот же ответ байтами: им сверяется воспроизводимость прогонов.
  return { dir: dir, text: run.stdout, data: JSON.parse(run.stdout), golden: golden };
}

/* Готовность набора целиком: данные контракта и собранная страница — то, с чего
 * начинается каждый из четырёх наборов. Каталог берётся у набора, чтобы клоны
 * разных процессов не спорили за имена. */
export function reportSetup(tmp, name) {
  const { data, golden } = contractData(tmp, name);
  return { data: data, golden: golden, pageText: pageHtml(tmp, name) };
}

/* Собранная страница: свой клон и ключ `--page` — тем же способом, каким её
 * собирает читатель. */
export function pageHtml(tmp, name) {
  const dir = cloneFixture(path.join(tmp, 'page-' + name));
  const run = runFixture(dir, ['--page']);
  assert.equal(run.code, 0, 'инструмент не собрал страницу: ' + run.stderr.trim());
  const file = path.join(dir, 'docs', 'size-report.html');
  assert.ok(fs.existsSync(file), 'страница не появилась рядом с таблицей');
  return fs.readFileSync(file, 'utf8');
}

/* Страница с памятью: адрес даёт ей начало координат (без него jsdom, как и
 * браузер в приватном окне, памяти не даёт), а `beforeParse` кладёт в неё то, что
 * «браузер сохранил» с прошлого захода — так перезаход и проверяется. */
export const PAGE_URL = 'https://report.invalid/size-report.html';
export function openPage(text, seed, hash) {
  return new JSDOM(text, {
    url: PAGE_URL + (hash || ''),
    runScripts: 'dangerously',
    beforeParse(window) {
      Object.keys(seed || {}).forEach((key) => window.localStorage.setItem(key, seed[key]));
    }
  });
}

// Что «браузер» сохранил к этому моменту — то, что переживёт закрытие страницы.
export function stored(dom) {
  const store = dom.window.localStorage;
  const out = {};
  for (let i = 0; i < store.length; i++) out[store.key(i)] = store.getItem(store.key(i));
  return out;
}

// Ссылка на выбор в том же виде, в каком её носит адрес: наш формат, а не пересказ.
export const linkTo = (rec) => '#size-report=' + encodeURIComponent(JSON.stringify(rec));

export const panelInputs = (doc) => [...doc.querySelectorAll('#panel input')];
export const nowCells = (doc) => doc.querySelectorAll('#grid tbody tr')[0].querySelectorAll('td').length;
export const nowTotal = (doc) => doc.querySelectorAll('#grid tbody tr')[0].querySelectorAll('td')[0].textContent;
export const allCells = (data) => (data.files.length + 1) * data.metrics.length;
export const fileBox = (doc, p) => panelInputs(doc).find((b) => b.title.indexOf(p) === 0);

/* Переключатель метрики — по видимой подписи: она не зависит от того, какими
 * словами названы способ и точность. Что слова эти есть и что они совпадают с
 * клетками — отдельная проверка. */
export const metricBox = (doc) => [...doc.querySelectorAll('#panel .box.metric')]
  .find((b) => b.textContent === 'min').querySelector('input');

export function toggleBox(doc, box, checked) {
  box.checked = checked;
  box.dispatchEvent(new doc.defaultView.Event('change'));
}

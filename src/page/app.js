import { appData, appUi, appView, appWrite, appNotice, appLinkUse, appRead, appApply } from './state.js';
import { appBody, appHead, appState } from './table.js';
import { appPanel } from './panel.js';

/* Сборка таблицы: что показывать (метрики и файлы, оставленные читателем) и куда
 * это положить. Разметку шапки и строк строит глава таблицы, числа — общий расчёт:
 * здесь остаётся только решение и вставка, своих чисел у сборки нет. */
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

  table.appendChild(appHead(shown, files, metrics));
  table.appendChild(appBody(metrics, files));
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

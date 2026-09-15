import { appEl, appBox } from './dom.js';
import { appData, appUi, appView, appFileAt, appMeasured } from './state.js';

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

/* Файл, которого в отчёте нет: он стоит в дереве на своём месте, но галочки у
 * него нет — чисел для него не измеряли, и переключать нечего. Причину читатель
 * видит во всплывающей строке, а не догадывается по виду. */
function appUnmeasuredBox(entry) {
  const box = appEl('span', 'box plain', entry.path.split('/').pop());
  box.title = entry.path + ' · '
    + (entry.why === 'rule' ? appUi.notMeasuredRule : appUi.notMeasuredChoice);
  return box;
}

/* Все измеряемые файлы поддерева — то, чем управляет переключатель папки: файл
 * вне отчёта переключать нечего. */
function appIndexes(node) {
  const out = node.files.slice();
  node.dirs.forEach((sub) => { out.push(...appIndexes(sub)); });
  return out;
}

/* Сколько файлов в поддереве — вместе с теми, что в отчёт не попали. */
function appCount(node) {
  let n = node.files.length + node.others.length;
  node.dirs.forEach((sub) => { n += appCount(sub); });
  return n;
}

/* Узел дерева: измеряемые файлы (колонки), прочие файлы проекта и подпапки. */
function appNode() {
  return { files: [], others: [], dirs: new Map() };
}

/* Переключатель папки: его галочка ведёт за собой всё поддерево и показывает три
 * состояния — все файлы включены, часть, ни одного. Рядом число файлов; если в
 * папке есть и те, что вне отчёта, оно написано долей («2/5»): читателю важно, что
 * в папке пять файлов, а измеряются два. Папка без единого измеряемого файла
 * галочки не получает — включать в ней нечего, — но на месте остаётся. */
function appDirHead(name, sub) {
  const idx = appIndexes(sub);
  const total = appCount(sub);
  const label = name + '/';
  let head;
  if (idx.length === 0) {
    head = appEl('span', 'box dir plain', label);
    head.title = appUi.dirNone.replace('{name}', name).replace('{n}', total);
  } else {
    const on = idx.map((i) => appView.files[i]);
    const every = on.every((v) => v);
    head = appBox(label, appUi.dir.replace('{name}', name).replace('{n}', idx.length),
      every, (e) => {
        idx.forEach((i) => { appView.files[i] = e.target.checked; });
        appRender();
      }, 'dir');
    head.querySelector('input').indeterminate = !every && on.some((v) => v);
  }
  head.appendChild(appEl('span', 'n', idx.length === total ? String(total) : idx.length + '/' + total));
  return head;
}

/* Листья уровня: измеряемые файлы и файлы вне отчёта — вперемешку и по алфавиту
 * имени, как в дереве файлов, а не отдельными списками. */
function appLeaves(node) {
  const items = node.files.map((i) => ({ name: appData.files[i].label, i: i, entry: null }));
  node.others.forEach((entry) => {
    items.push({ name: entry.path.split('/').pop(), i: null, entry: entry });
  });
  return items.sort((a, b) => (a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)));
}

/* Узлы одного уровня: сперва папки по алфавиту, затем листья (их порядок — из
 * `appLeaves`). */
function appTreeList(node) {
  const list = appEl('ul', 'tree');
  [...node.dirs.keys()].sort().forEach((name) => {
    const sub = node.dirs.get(name);
    const li = appEl('li');
    li.appendChild(appDirHead(name, sub));
    li.appendChild(appTreeList(sub));
    list.appendChild(li);
  });
  appLeaves(node).forEach((leaf) => {
    const li = appEl('li');
    li.appendChild(leaf.entry === null ? appFileBox(leaf.i) : appUnmeasuredBox(leaf.entry));
    list.appendChild(li);
  });
  return list;
}

/* Место листа в дереве: путь делится по «/», промежуточные папки заводятся по
 * дороге. Одно место на измеряемые и прочие — иначе они разошлись бы папками. */
function appLeafAt(node, p, i, entry) {
  const parts = p.split('/');
  for (let d = 0; d < parts.length - 1; d++) {
    if (!node.dirs.has(parts[d])) node.dirs.set(parts[d], appNode());
    node = node.dirs.get(parts[d]);
  }
  if (entry === null) node.files.push(i);
  else node.others.push(entry);
}

/* Дерево страницы — дерево проекта: узлы берутся из каталога (все пути, которые
 * видит git), поэтому в нём есть и файлы вне отчёта. Измеряемый лист — колонка, и
 * путь у него тот же, что в подписи файла; колонка, чьего файла на HEAD уже нет, в
 * каталог не попала (в индексе её нет) и стоит на месте по последнему известному
 * пути. */
function appTree() {
  const root = appNode();
  appData.files.forEach((_f, i) => appLeafAt(root, appFileAt(i), i, null));
  appData.catalog.forEach((entry) => {
    if (appMeasured[entry.path] === undefined) appLeafAt(root, entry.path, null, entry);
  });
  return appTreeList(root);
}

export function appPanel() {
  const panel = document.getElementById('panel');
  panel.textContent = '';

  const metrics = appEl('fieldset');
  metrics.appendChild(appEl('legend', null, appUi.metrics));
  const mrow = appEl('div', 'row');
  appData.metrics.forEach((m) => {
    const word = m.accuracy === 'exact' ? appUi.exact : appUi.approximate;
    mrow.appendChild(appBox(m.label, m.note + ' · ' + word, appView.metrics[m.key], (e) => {
      appView.metrics[m.key] = e.target.checked;
      appRender();
    }, 'metric'));
  });
  metrics.appendChild(mrow);
  /* Чем получено каждое число — видно, а не только во всплывающей строке: словарь
   * токенов и способ сжатия выбираются настройками запуска, переключить их
   * странице нечем, и читателю важно знать это, не наводя мышь. */
  appData.metrics.forEach((m) => {
    metrics.appendChild(appEl('p', 'about', m.label + ' — ' + appUi.methodLabel + ' ' + m.method));
  });
  panel.appendChild(metrics);

  const files = appEl('fieldset', 'files');
  files.appendChild(appEl('legend', null, appUi.files));
  /* Строка категорий помечена классом: список файлов листается, и она остаётся на
   * виду (липкость — в широкой раскладке, там панель и прокручивается). */
  const cats = appEl('div', 'row cats');
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
}

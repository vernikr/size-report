import { appEl, appBox } from './dom.js';
import { appData, appUi, appView, appFileAt } from './state.js';

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

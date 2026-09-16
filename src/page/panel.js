import { appEl, appBox, appOffBox } from './dom.js';
import { appData, appUi, appView, appFileAt, appFoldSet, appMeasured } from './state.js';

/* Only a file sets a file's checkbox: both a category and a folder in the tree are ways to set the same checkboxes as
 * a group and keep no state of their own. Otherwise one and the same decision would live in two places and drift
 * apart. */
function appFileBox(i) {
  const f = appData.files[i];
  const where = appFileAt(i) + (f.path === null ? appUi.notOnHead : '');
  return appBox(f.label, where + appUi.category
    + (f.categoryBy === 'config' ? appUi.categoryFromConfig : appUi.categoryByExtension),
  appView.files[i], (e) => {
    appView.files[i] = e.target.checked;
    appRender();
  });
}

/* A file that is not in the report: it stands in its place in the tree with its checkbox off and unavailable — no
 * numbers were measured for it, so there is nothing to switch. The reader sees the reason in the tooltip rather than
 * guessing it from the look. */
function appUnmeasuredBox(entry) {
  return appOffBox(entry.path.split('/').pop(), entry.path + ' · '
    + (entry.why === 'rule' ? appUi.notMeasuredRule : appUi.notMeasuredChoice));
}

/* Every measured file of a subtree — what a folder's switch controls: a file outside the report has nothing to
 * switch. */
function appIndexes(node) {
  const out = node.files.slice();
  node.dirs.forEach((sub) => { out.push(...appIndexes(sub)); });
  return out;
}

/* How many files a subtree holds — including the ones that made it into no report. */
function appCount(node) {
  let n = node.files.length + node.others.length;
  node.dirs.forEach((sub) => { n += appCount(sub); });
  return n;
}

/* A tree node: the measured files (columns), the project's other files and the subfolders. */
function appNode() {
  return { files: [], others: [], dirs: new Map() };
}

/* A folder's switch: its checkbox carries the whole subtree with it and shows three states — every file on, some,
 * none. The number of files stands next to it; when the folder also holds files outside the report, it is written as
 * a fraction ("2/5"): what matters to the reader is that the folder holds five files while two are measured. A folder
 * without a single measured file stays in place with its checkbox off and unavailable: there is nothing to switch on
 * in it. */
function appDirHead(name, sub) {
  const idx = appIndexes(sub);
  const total = appCount(sub);
  const label = name + '/';
  let head;
  if (idx.length === 0) {
    head = appOffBox(label, appUi.dirNone.replace('{name}', name).replace('{n}', total), 'dir');
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

/* The folder's sign is a click target of its own, separate from the checkbox: the checkbox answers for the numbers (it
 * switches the subtree's files on), while the sign answers for how much of the tree is visible. One target for two
 * different decisions would mean a folder can be folded only together with switching its files on. The sign is drawn
 * as a span rather than a button and stands beside the label rather than inside it: a label is one click target, and a
 * control nested in it would be reached as that same target.
 *
 * A click on the sign rebuilds nothing: the subtree lies in the markup and a class on the row hides it. A rebuild here
 * would be honest work for nothing — it counts the whole table (every row by every column) and so pays for numbers
 * folding does not change. That is why only the three things the reader sees change: the class, the sign and the note
 * in the memory. */
function appFoldBox(name, path) {
  const folded = appView.folded[path] === true;
  const box = appEl('span', 'fold', folded ? '▸' : '▾');
  box.title = (folded ? appUi.foldOpen : appUi.foldClose).replace('{name}', name);
  box.addEventListener('click', () => {
    const now = !(appView.folded[path] === true);
    appFoldSet(path, now);
    const li = box.closest('li');
    if (li !== null) li.classList.toggle('folded', now);
    box.textContent = now ? '▸' : '▾';
    box.title = (now ? appUi.foldOpen : appUi.foldClose).replace('{name}', name);
  });
  return box;
}

/* The leaves of one level: measured files and files outside the report mixed together and sorted by name, the way a
 * file tree reads, rather than as separate lists. */
function appLeaves(node) {
  const items = node.files.map((i) => ({ name: appData.files[i].label, i: i, entry: null }));
  node.others.forEach((entry) => {
    items.push({ name: entry.path.split('/').pop(), i: null, entry: entry });
  });
  return items.sort((a, b) => (a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)));
}

/* A folder row: the folding sign, the checkbox with the number of files and the subtree. A folded folder differs by
 * its class alone — the markup stays the same. */
function appDir(name, sub, prefix) {
  const here = prefix === '' ? name : prefix + '/' + name;
  const folded = appView.folded[here] === true;
  const li = appEl('li', folded ? 'folded' : null);
  li.appendChild(appFoldBox(name, here));
  li.appendChild(appDirHead(name, sub));
  li.appendChild(appTreeList(sub, here));
  return li;
}

// A leaf row: a measured file comes with a checkbox, a file outside the report with one switched off.
function appLeaf(leaf) {
  const li = appEl('li');
  li.appendChild(leaf.entry === null ? appFileBox(leaf.i) : appUnmeasuredBox(leaf.entry));
  return li;
}

/* The nodes of one level: first everything in the report (folders alphabetically, then the leaves in the order
 * `appLeaves` gives), then what is not in it — folders without a measured file and files outside the columns. That is
 * not a matter of taste: everything outside the report has its checkbox off and unavailable, so at the end of the list
 * it does not distract from what is in the table, while it can still be found — in the same place where it was. */
function appTreeList(node, prefix) {
  const list = appEl('ul', 'tree');
  const dirs = [...node.dirs.keys()].sort()
    .map((name) => ({ name: name, sub: node.dirs.get(name), inReport: appIndexes(node.dirs.get(name)).length > 0 }));
  const leaves = appLeaves(node);
  const inside = leaves.filter((leaf) => leaf.entry === null);
  dirs.filter((d) => d.inReport).forEach((d) => list.appendChild(appDir(d.name, d.sub, prefix)));
  inside.forEach((leaf) => list.appendChild(appLeaf(leaf)));
  dirs.filter((d) => !d.inReport).forEach((d) => list.appendChild(appDir(d.name, d.sub, prefix)));
  leaves.filter((leaf) => leaf.entry !== null).forEach((leaf) => list.appendChild(appLeaf(leaf)));
  return list;
}

/* A leaf's place in the tree: the path is split on "/" and the intermediate folders are created on the way. One place
 * for measured and other files alike — otherwise they would drift apart in folders. */
function appLeafAt(node, p, i, entry) {
  const parts = p.split('/');
  for (let d = 0; d < parts.length - 1; d++) {
    if (!node.dirs.has(parts[d])) node.dirs.set(parts[d], appNode());
    node = node.dirs.get(parts[d]);
  }
  if (entry === null) node.files.push(i);
  else node.others.push(entry);
}

/* The page's tree is the project's tree: the nodes come from the catalogue (every path git sees), which is why it also
 * holds files outside the report. A measured leaf is a column, and its path is the one in the file's caption; a column
 * whose file is gone from HEAD never entered the catalogue (the index does not hold it) and stands in place by the last
 * path known. */
function appTree() {
  const root = appNode();
  appData.files.forEach((_f, i) => appLeafAt(root, appFileAt(i), i, null));
  appData.catalog.forEach((entry) => {
    if (appMeasured[entry.path] === undefined) appLeafAt(root, entry.path, null, entry);
  });
  return appTreeList(root, '');
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
  /* What produced each number is visible rather than hidden in a tooltip: the token dictionary and the way of
   * compression are chosen by the settings of the run, the page has nothing to switch them with, and the reader needs
   * to know this without pointing a mouse. */
  appData.metrics.forEach((m) => {
    metrics.appendChild(appEl('p', 'about', m.label + ' — ' + appUi.methodLabel + ' ' + m.method));
  });
  panel.appendChild(metrics);

  const files = appEl('fieldset', 'files');
  files.appendChild(appEl('legend', null, appUi.files));
  /* The row of categories is marked by a class: the file list scrolls, and the row stays in sight (its stickiness lives
   * in the wide layout, which is where the panel scrolls). */
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

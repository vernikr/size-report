import { appEl, appBox, appOffBox } from './dom.js';
import { appData, appUi, appView, appFileAt, appFoldSet, appMeasured } from './state.js';

/* Only a file sets a file's checkbox: both a category and a folder in the tree are ways to set the same checkboxes as
 * a group and keep no state of their own. Otherwise one and the same decision would live in two places and drift
 * apart. */
function appFileBox(i) {
  const f = appData.files[i];
  const where = appFileAt(i) + (f.path === null ? appUi.notOnHead : '');
  const box = appBox(f.label, where + appUi.category
    + (f.categoryBy === 'config' ? appUi.categoryFromConfig : appUi.categoryByExtension),
  appView.files[i], (e) => appSwitch(i, e.target.checked));
  appFields.file[i] = box.querySelector('input');
  return box;
}

/* A file that is not in the report: it stands in its place in the tree with its checkbox off and unavailable — no
 * numbers were measured for it, so there is nothing to switch. The reader sees the reason in the tooltip rather than
 * guessing it from the look. */
function appUnmeasuredBox(entry) {
  return appOffBox(entry.path.split('/').pop(), entry.path + ' · '
    + (entry.why === 'rule' ? appUi.notMeasuredRule : appUi.notMeasuredChoice));
}

/* A subtree in the two figures its folder shows: the measured files its checkbox controls, and how many files the
 * folder holds at all — including the ones that made it into no report. One walk, because the two are asked together
 * (a folder of five files with two measured reads "2/5"). */
function appSub(node) {
  const idx = node.files.slice();
  let total = node.files.length + node.others.length;
  node.dirs.forEach((sub) => {
    const inner = appSub(sub);
    idx.push(...inner.idx);
    total += inner.total;
  });
  return { idx: idx, total: total };
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
function appDirHead(name, here, sub) {
  const own = appSub(sub);
  const idx = own.idx;
  const total = own.total;
  const label = name + '/';
  let head;
  if (idx.length === 0) {
    head = appOffBox(label, appUi.dirNone.replace('{name}', name).replace('{n}', total), 'dir');
  } else {
    const on = idx.map((i) => appView.files[i]);
    const every = on.every((v) => v);
    head = appBox(label, appUi.dir.replace('{name}', name).replace('{n}', idx.length),
      every, (e) => appSwitchGroup(idx, e.target.checked), 'dir');
    head.querySelector('input').indeterminate = !every && on.some((v) => v);
    appFields.dir[here] = head;
  }
  head.appendChild(appEl('span', 'n', idx.length === total ? String(total) : idx.length + '/' + total));
  return head;
}

/* The order inside one level, and the two rules of it: a hidden name (a leading dot) stands after every visible one —
 * a project's service files are not what a reader looks for first — and otherwise the alphabet decides. "Other things
 * being equal" is the whole of it: what the report holds stands before what it does not, and that partition is made
 * before the names are compared. The rule is a function of two strings, which is what lets it be checked on its own
 * rather than through a tree of a fixture that has no hidden files in it. */
export function appName(a, b) {
  const hidden = (name) => (name.charAt(0) === '.' ? 1 : 0);
  if (hidden(a) !== hidden(b)) return hidden(a) - hidden(b);
  return a < b ? -1 : (a > b ? 1 : 0);
}

/* The folder's sign is a click target of its own, separate from the checkbox: the checkbox answers for the numbers (it
 * switches the subtree's files on), while the sign answers for how much of the tree is visible. One target for two
 * different decisions would mean a folder can be folded only together with switching its files on. The sign is drawn
 * as a span rather than a button and stands beside the label rather than inside it: a label is one click target, and a
 * control nested in it would be reached as that same target.
 *
 * The tree opens folded — the sign of an untouched folder says so — and the reader's unfolding is what the memory
 * keeps (`appFoldSet`).
 *
 * A click on the sign rebuilds nothing: the subtree lies in the markup and a class on the row hides it. A rebuild here
 * would be honest work for nothing — it counts the whole table (every row by every column) and so pays for numbers
 * folding does not change. That is why only the three things the reader sees change: the class, the sign and the note
 * in the memory. */
function appFoldBox(name, path) {
  const open = appView.open[path] === true;
  const box = appEl('span', 'fold', open ? '▾' : '▸');
  box.title = (open ? appUi.foldClose : appUi.foldOpen).replace('{name}', name);
  box.addEventListener('click', () => {
    const now = !(appView.open[path] === true);
    appFoldSet(path, now);
    const li = box.closest('li');
    if (li !== null) li.classList.toggle('folded', !now);
    box.textContent = now ? '▾' : '▸';
    box.title = (now ? appUi.foldClose : appUi.foldOpen).replace('{name}', name);
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
  return items.sort((a, b) => appName(a.name, b.name));
}

/* A folder row: the folding sign, the checkbox with the number of files and the subtree. A folded folder differs by
 * its class alone — the markup stays the same. */
function appDir(name, sub, prefix) {
  const here = prefix === '' ? name : prefix + '/' + name;
  const folded = appView.open[here] !== true;
  const li = appEl('li', folded ? 'folded' : null);
  li.appendChild(appFoldBox(name, here));
  li.appendChild(appDirHead(name, here, sub));
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
  const dirs = [...node.dirs.keys()].sort(appName)
    .map((name) => ({ name: name, sub: node.dirs.get(name), inReport: appSub(node.dirs.get(name)).idx.length > 0 }));
  const leaves = appLeaves(node);
  const inside = leaves.filter((leaf) => leaf.entry === null);
  const outside = leaves.filter((leaf) => leaf.entry !== null);
  dirs.filter((d) => d.inReport).forEach((d) => list.appendChild(appDir(d.name, d.sub, prefix)));
  inside.forEach((leaf) => list.appendChild(appLeaf(leaf)));
  dirs.filter((d) => !d.inReport).forEach((d) => list.appendChild(appDir(d.name, d.sub, prefix)));
  outside.forEach((leaf) => list.appendChild(appLeaf(leaf)));
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

/* The panel: built once, at the first drawing, and afterwards only its fields change. A rebuild would count the whole
 * table for nothing — the tree, the counters and the tooltips are the same after every click — while it would also
 * take the reader's place in the list away: the scroll of the panel and of the tree, and the field under the
 * keyboard, would have to be put back by hand. Nothing of that is here, because there is nothing to put back. */
export function appPanel() {
  const panel = document.getElementById('panel');
  panel.textContent = '';

  const metrics = appEl('fieldset');
  metrics.appendChild(appEl('legend', null, appUi.metrics));
  const mrow = appEl('div', 'row');
  appData.metrics.forEach((m) => {
    const box = appBox(m.label, m.note, appView.metrics[m.key], (e) => {
      appView.metrics[m.key] = e.target.checked;
      appSwitchMetric();
    }, 'metric');
    appFields.metric[m.key] = box.querySelector('input');
    mrow.appendChild(box);
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
    const box = appBox(cat.label, appUi.all + ' · ' + cat.label, idx.every((i) => appView.files[i]),
      (e) => appSwitchGroup(idx, e.target.checked), 'all');
    appFields.cat[cat.key] = box.querySelector('input');
    cats.appendChild(box);
  });
  files.appendChild(cats);
  files.appendChild(appTree());
  panel.appendChild(files);
}

/* -------- the panel's fields after a choice -------- */

/* The fields of the panel by name: the markup is built once, so a click needs a reference to the field it changes
 * rather than a rebuild of the panel. Only a file owns a state — a folder and a category are ways to set the same
 * boxes — which is why their fields are read from the files below them rather than kept. */
const appFields = { metric: {}, file: {}, dir: {}, cat: {} };

/* The boxes of a row's own subtree, read from the tree itself: the panel keeps no second list of the files a folder
 * holds, and what the reader sees is exactly the boxes that are here. A file outside the report stands in the tree
 * with nothing to switch, hence it is left out. */
function appRowBoxes(box) {
  return [...box.closest('li').querySelectorAll('.box:not(.dir):not(.plain) input')];
}

// A folder's field from its files: all on — checked, some — the third state, none — simply unchecked.
function appDirState(path) {
  const boxes = appRowBoxes(appFields.dir[path]);
  const on = boxes.filter((b) => b.checked).length;
  const input = appFields.dir[path].querySelector('input');
  input.checked = on === boxes.length;
  input.indeterminate = on > 0 && on < boxes.length;
}

/* A category's field from its files — the same rule, taken from the data: a category's files are named by the
 * category itself (`category`), and the boxes of the tree are a different view of the same files. */
function appCatState(key) {
  let all = 0;
  let on = 0;
  appData.files.forEach((f, i) => {
    if (f.category !== key) return;
    all++;
    if (appView.files[i] === true) on++;
  });
  const input = appFields.cat[key];
  input.checked = on === all;
  input.indeterminate = on > 0 && on < all;
}

/* The folders a file lies in: the prefixes of its path, from the root down. The tree's folders are exactly those
 * prefixes — that is how it is built (`appLeafAt`) — so no second naming rule is needed. */
function appDirPath(path) {
  const parts = path.split('/');
  return parts.slice(0, -1).map((_part, i) => parts.slice(0, i + 1).join('/'));
}

/* A click reaches the fields of a folder and of a category through the files below them — one walk for both, because
 * it is one question: which groups the reader sees hold a switched file, and what do they show now. A field that is not
 * there is left alone: a folder without measured files has a box of its own, off and unavailable, which is not the
 * reader's state. */
function appReach(indexes, fields, namesOf, stateOf) {
  const seen = {};
  indexes.forEach((i) => namesOf(i).forEach((name) => {
    if (seen[name] === true || fields[name] === undefined) return;
    seen[name] = true;
    stateOf(name);
  }));
}

/* What a click changed, written where it stands: the files' own boxes, then the fields of the folders and categories
 * that hold them. Nothing is rebuilt, and no field the choice did not reach is touched. */
export function appPanelState(indexes) {
  indexes.forEach((i) => {
    const input = appFields.file[i];
    if (input !== undefined) input.checked = appView.files[i] === true;
  });
  appReach(indexes, appFields.dir, (i) => appDirPath(appFileAt(i)), appDirState);
  appReach(indexes, appFields.cat, (i) => [appData.files[i].category], appCatState);
}

/* The whole panel from the view: what a link, a record from the memory and the first drawing need. The metric boxes
 * are the reader's own click otherwise, which is why they are not refreshed on a file's switch. */
export function appPanelAll() {
  appData.categories.forEach((c) => appCatState(c.key));
  appData.metrics.forEach((m) => { appFields.metric[m.key].checked = appView.metrics[m.key] === true; });
  appData.files.forEach((_f, i) => { appFields.file[i].checked = appView.files[i] === true; });
  Object.keys(appFields.dir).forEach((path) => appDirState(path));
}

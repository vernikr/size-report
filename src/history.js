import fs from 'fs';
import path from 'path';
import { assertFullHistory, diskForm, diskHashes, git, headTree, readBlobs, readHistory } from './git.js';
import { METRICS, measureBlob, pointExact } from './metrics.js';
import { touchedSection } from './journal.js';
import { EXIT, refuse } from './refusal.js';

/* Обход истории: измерение по коммитам, сдвиг чисел, перенос состояния между
 * коммитами, сверка с рабочим деревом и сборка — та единственная точка, из
 * которой состояние и строки попадают наружу. Верхний этаж чтения: ниже — git и
 * метрики, выше — только уже собранные значения. */

/* Сдвинул ли коммит хотя бы одно число. Сравниваются числа, а не список файлов:
 * правка в пробелах или комментариях размера не меняет, и строка про неё была бы
 * пустой, а у слияния клетки выходят нулевыми всегда, когда разрешение конфликта
 * совпало с тем, что уже дала ветка. Колонка, которой коммит не касался,
 * остаётся тем же объектом состояния. */
function changesVolume(state, before, columns, metrics) {
  return columns.some((_col, i) => {
    const a = state[i], b = before[i];
    if (a === b) return false;
    if (a === null || b === null) return true;
    return metrics.some((m) => a.cells[m] !== b.cells[m]);
  });
}

/* Проход по истории. Состояние колонки переносится вперёд, а перезамер делается
 * только для изменившихся в коммите файлов. Читается всё сразу: сначала план
 * «какие пары ревизия:путь понадобятся», затем один поход в git (`readBlobs`),
 * затем собственно измерение — иначе на каждый коммит приходилось бы по
 * git-вызову на колонку. Значения метрик кэшируются по sha блоба: ревизия с тем
 * же содержимым (откат, повторный merge) не пересчитывается. */
export function measureHistory(cfg, root) {
  const commits = readHistory(root);
  const metrics = cfg.metrics;
  // Текст журнала нужен всегда: ссылка в раздел — не метрика, но тоже чтение.
  const needText = !!cfg.journal || metrics.some((m) => METRICS[m].needsText);
  const skipPaths = [cfg.output].concat(cfg.skip || []);
  const state = cfg.columns.map(() => null);
  const rows = [];
  const skipped = [];
  const mixed = [];
  let journalPrev = '';

  const plan = commits.map((c) => {
    const changed = new Set(c.files);
    /* Псевдонимов колонки, которых коммит коснулся, может быть и два: при
     * выключенном распознавании переименований git отдаёт в одном коммите и старое
     * имя, и новое. Собираются все — какой из них в коммите действительно есть,
     * решается потом, по прочитанным блобам. */
    const picks = cfg.columns.map((col) => col.paths
      .filter((cand) => changed.has(cand))
      .map((path) => ({ path: path, spec: c.sha + ':' + path })));
    const journal = cfg.journal && changed.has(cfg.journal.path) ? c.sha + ':' + cfg.journal.path : null;
    return { picks: picks, journal: journal };
  });

  const specs = [];
  plan.forEach((p) => {
    p.picks.forEach((candidates) => { candidates.forEach((cand) => specs.push(cand.spec)); });
    if (p.journal !== null) specs.push(p.journal);
  });
  const blobs = readBlobs(root, specs, needText);

  const measured = new Map(); // sha блоба + метрика → число
  const measure = (name, blob, file, rev) => {
    const key = blob.sha + '\u0000' + name;
    if (measured.has(key)) return measured.get(key);
    const value = measureBlob(name, blob, file, cfg, rev);
    measured.set(key, value);
    return value;
  };

  commits.forEach((c, ci) => {
    let section = null;
    if (plan[ci].journal !== null) {
      const journalBlob = blobs.get(plan[ci].journal);
      if (journalBlob !== undefined) {
        section = touchedSection(journalPrev, journalBlob.text, cfg.journal.pattern);
        journalPrev = journalBlob.text;
      }
    }

    const before = state.slice();
    plan[ci].picks.forEach((candidates, i) => {
      /* Из псевдонимов берётся тот, который в коммите есть, а не первый по
       * порядку настроек: исчезнувшее имя в коммите отсутствует, и состояние,
       * взятое по порядку, теряло файл (а сверка с деревом — отказывала). */
      const pick = candidates.find((cand) => blobs.get(cand.spec) !== undefined);
      if (pick === undefined) {
        // Путь в коммите есть, а файла по нему нет — файл удалён.
        if (candidates.length > 0) state[i] = null;
        return;
      }
      const blob = blobs.get(pick.spec);
      const cells = {};
      /* Приближённость числа — свойство пути, а не блоба: от расширения зависит,
       * возьмёт ли формат минификатор. Поэтому она считается здесь, вместо с
       * замером, и в кэш содержимого не попадает. */
      const approx = {};
      metrics.forEach((m) => {
        cells[m] = measure(m, blob, pick.path, c.sha);
        approx[m] = !pointExact(m, pick.path, cfg);
      });
      state[i] = { path: pick.path, sha: blob.sha, cells: cells, approx: approx };
    });

    if (c.parents.length > 1 && !cfg.rows.merges) { skipped.push(c.sha.slice(0, 7) + ' (merge)'); return; }
    if (c.files.length > 0 && c.files.every((f) => skipPaths.indexOf(f) >= 0)) {
      skipped.push(c.sha.slice(0, 7) + ' (только таблица)');
      return;
    }
    if (!changesVolume(state, before, cfg.columns, metrics)) {
      skipped.push(c.sha.slice(0, 7) + ' (без изменения объёма)');
      return;
    }
    if (c.files.some((f) => f === cfg.output)) mixed.push(c.sha.slice(0, 7));

    rows.push({
      sha: c.sha,
      when: c.when,
      subject: c.subject,
      section: section,
      cells: state.map((s) => (s === null ? null : s.cells)),
      approx: state.map((s) => (s === null ? null : s.approx))
    });
  });

  return { rows, skipped, mixed, state };
}

/* Сверка с рабочим деревом отвечает на два вопроса, и оба обязательны: состояние
 * движка на HEAD совпадает с деревом коммита, и файл на диске соответствует тому
 * же содержимому. Первый ловит правку, потерянную при переносе состояния между
 * коммитами (например, у merge-коммита, которого нет в списке изменённых путей): и
 * потерянное создание файла (в дереве он есть, а состояние о нём не знает), и
 * потерянное изменение (файл есть с обеих сторон, содержимое разное), и потерянное
 * удаление (состояние о файле знает, а в дереве его нет). Сравнение при этом идёт
 * с расхождением, а не с пустотой: колонка, чей файл жил в истории и был удалён до
 * HEAD, пуста с обеих сторон — это не потеря, а её видно в отчёте. Второй вопрос —
 * правка, которой в истории нет вовсе. Размеры для этого не годятся: на диске они
 * зависят от выкладки (при `core.autocrlf=true` — значение по умолчанию в установке
 * Git для Windows — CRLF против LF), и инструмент отказывался работать там, где всё
 * в порядке. Файлы, изменённые в дереве, из сверки с диском выпадают: их
 * содержимое в коммите и на диске различается законно. */
function assertMatchesDisk(state, cfg, root) {
  const dirty = new Set(git(root, ['status', '--porcelain']).split('\n')
    .map((l) => l.trim()).filter((l) => l !== '').map((l) => l.replace(/^\S+\s+/, '').replace(/^.* -> /, '')));
  const tree = headTree(root);
  const clean = [];
  cfg.columns.forEach((col, i) => {
    const s = state[i];
    const aliases = col.paths.filter((alias) => tree.has(alias));
    const p = s === null ? aliases[0] : s.path;
    const inTree = p === undefined ? undefined : tree.get(p);
    const lost = s === null ? aliases.length > 0 : inTree !== s.sha;
    if (lost) {
      refuse(EXIT.VIOLATION, 'состояние «' + col.label + '» на HEAD не совпало с деревом коммита (в дереве '
        + (aliases.length === 0 ? 'файла нет'
          : aliases.map((alias) => alias + ' ' + tree.get(alias).slice(0, 7)).join(', '))
        + ', в состоянии ' + (s === null ? 'файла нет' : s.path + ' ' + s.sha.slice(0, 7))
        + '): перенос состояния между коммитами пропустил правку'
        + '\n  починка: пересоберите таблицу (' + cfg.fixCommand + ') и закоммитьте ' + cfg.output);
    }
    if (p !== undefined && !dirty.has(p) && clean.indexOf(p) < 0) clean.push(p);
  });
  if (clean.length === 0) return;
  const onDisk = diskHashes(root, clean);
  clean.forEach((p) => {
    if (onDisk.get(p) === tree.get(p)) return; // git считает файл неизменным
    if (fs.readFileSync(path.join(root, p)).equals(diskForm(root, 'HEAD', p))) return; // переводы строк необратимы
    refuse(EXIT.VIOLATION, 'содержимое ' + p + ' на диске разошлось с HEAD (' + onDisk.get(p).slice(0, 7)
      + ' вместо ' + tree.get(p).slice(0, 7) + '), хотя git не считает файл изменённым: правка есть только на диске'
      + '\n  починка: закоммитьте правку или откатите её: git checkout -- ' + p);
  });
}

export function build(cfg, root) {
  assertFullHistory(root);
  const measured = measureHistory(cfg, root);
  assertMatchesDisk(measured.state, cfg, root);
  if (measured.mixed.length > 0) {
    console.error('! таблицу обновляли вместе с кодом: ' + measured.mixed.join(', ')
      + ' — так строка коммита не может попасть в сам коммит; обновляйте таблицу отдельным коммитом.');
  }
  return measured;
}

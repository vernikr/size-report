/* Разбор подмножества YAML, которого хватает описаниям рабочих процессов: отображения
 * по отступу, элементы списка `- `, скалярные значения и потоковый список (`[a, b]`).
 * Выход за подмножество — явная ошибка, а не молча пропущенная строка: описание,
 * которое перестало разбираться, обязано уронить проверку, а не пройти её.
 *
 * Блочные скаляры (`run: |`) — вне подмножества, и это названо отдельной ошибкой:
 * многострочную команду приходится собирать в одну строку, а не ловить потом странное
 * «не ключ и не элемент списка» посреди чужой команды.
 *
 * Разборщик один на оба сторожа — шаблон проверки для чужого проекта и выпуск из CI:
 * два разборщика разошлись бы так же тихо, как расходятся любые две копии проверки.
 * Зачем проверке вообще разбор, когда есть строки: поиск подстроки не отличает
 * верное описание от того, которое **не разбирается вовсе** (так и вышло с выпуском:
 * `? … : …` внутри незакавыченного значения — синтаксис YAML ломает, а подстрока
 * находится).
 *
 * Разбор идёт по шагам (`map` / `list` / `node`), а строка и указатель на неё живут в
 * одном состоянии (`p`): вложенные функции пришлось бы собирать заново на каждый
 * уровень, а рекурсия уровней здесь и есть суть разбора.
 */

/* Строки описания без комментариев и пустых, с отступом и номером в исходном тексте.
 * Отступ и хвостовые пробелы — вне подмножества: разбор по отступу на неоднозначном
 * отступе давал бы разное дерево у разных людей. */
function linesOf(src) {
  const lines = [];
  src.split('\n').forEach((raw, i) => {
    const text = raw.replace(/(^|\s)#.*$/, '').trimEnd();
    if (text.trim() === '') return;
    lines.push({ indent: text.length - text.trimStart().length, text: text.trim(), line: i + 1 });
  });
  for (const l of lines) {
    if (/\s$/.test(l.text) || l.text.indexOf('\t') >= 0) {
      throw new Error('строка ' + l.line + ': отступ или хвостовые пробелы вне подмножества');
    }
  }
  return lines;
}

/* Элемент потокового списка может быть закавычен (`tags: ['v*']`) — кавычки в
 * самом YAML не часть значения, и значение читается без них. */
function flowItem(text) {
  if (text.length > 1 && (text[0] === "'" || text[0] === '"') && text[text.length - 1] === text[0]) {
    return text.slice(1, -1);
  }
  return text;
}

function scalar(text, line) {
  if (text === '|' || text === '>') {
    throw new Error('строка ' + line + ': блочный скаляр (`' + text + '`) вне подмножества —'
      + ' соберите значение шага в одну строку');
  }
  /* Правило самого YAML, и в этом файле оно не украшение: `? … : …` в команде
   * незакавыченным значением разбирается как конец значения, то есть описание не
   * разбирается вовсе, а поиск подстроки этого не видит. */
  const quoted = text[0] === '"' || text[0] === "'" || text[0] === '[';
  if (!quoted && text.indexOf(': ') >= 0) {
    throw new Error('строка ' + line + ': двоеточие с пробелом в незакавыченном значении —'
      + ' YAML прочитает это как конец значения; закавычьте значение или перепишите команду');
  }
  if (text[0] === '[') {
    if (text[text.length - 1] !== ']') throw new Error('потоковый список не закрыт: ' + text);
    return text.slice(1, -1).split(',').map((s) => flowItem(s.trim()));
  }
  if (/^\d+$/.test(text)) return Number(text);
  return text;
}

/* Ключ и значение из строки `ключ: значение`; `null` — строка не отображение (сообщение
 * об ошибке зависит от места и потому живёт у того, кто спросил). */
function split(text) {
  const cut = text.indexOf(':');
  if (cut < 0) return null;
  return { key: text.slice(0, cut).trim(), value: text.slice(cut + 1).trim() };
}

/* Значение ключа: пустое — вложенный узел глубже по отступу, а если его нет — null. */
function valueAt(p, kv, line, indent) {
  if (kv.value !== '') return scalar(kv.value, line);
  if (p.at < p.lines.length && p.lines[p.at].indent > indent) return node(p, p.lines[p.at].indent);
  return null;
}

function map(p, indent) {
  const out = {};
  while (p.at < p.lines.length && p.lines[p.at].indent === indent && p.lines[p.at].text[0] !== '-') {
    const head = p.lines[p.at];
    const kv = split(head.text);
    if (kv === null) throw new Error('строка ' + head.line + ': не ключ и не элемент списка');
    p.at++;
    out[kv.key] = valueAt(p, kv, head.line, indent);
  }
  return out;
}

function list(p, indent) {
  const out = [];
  while (p.at < p.lines.length && p.lines[p.at].indent === indent && p.lines[p.at].text[0] === '-') {
    const head = p.lines[p.at];
    const rest = head.text.slice(1).trim();
    p.at++;
    if (rest === '') {
      out.push(node(p, head.indent + 2));
      continue;
    }
    /* Элемент-отображение записан первой строкой (`- name: …`), остальные его
     * ключи стоят на два пробела глубже. */
    const kv = split(rest);
    if (kv === null) throw new Error('строка ' + head.line + ': элемент списка не отображение');
    const item = {};
    item[kv.key] = valueAt(p, kv, head.line, head.indent);
    const more = p.at < p.lines.length && p.lines[p.at].indent > head.indent && p.lines[p.at].text[0] !== '-'
      ? map(p, head.indent + 2) : {};
    out.push(Object.assign(item, more));
  }
  return out;
}

function node(p, indent) {
  const first = p.lines[p.at];
  if (first === undefined || first.indent < indent) return null;
  if (first.text[0] === '-') return list(p, first.indent);
  if (first.indent > indent) throw new Error('строка ' + first.line + ': отступ глубже ожидаемого');
  return map(p, first.indent);
}

export function parseWorkflow(src) {
  const lines = linesOf(src);
  const p = { lines: lines, at: 0 };
  const doc = map(p, lines[0].indent);
  if (p.at !== lines.length) throw new Error('разбор кончился на строке ' + lines[p.at].line);
  return doc;
}

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
 */
export function parseWorkflow(src) {
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
  let at = 0;
  /* Элемент потокового списка может быть закавычен (`tags: ['v*']`) — кавычки в
   * самом YAML не часть значения, и значение читается без них. */
  const flowItem = (text) => {
    if (text.length > 1 && (text[0] === "'" || text[0] === '"') && text[text.length - 1] === text[0]) {
      return text.slice(1, -1);
    }
    return text;
  };
  const scalar = (text, line) => {
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
  };
  function map(indent) {
    const out = {};
    while (at < lines.length && lines[at].indent === indent && lines[at].text[0] !== '-') {
      const head = lines[at];
      const cut = head.text.indexOf(':');
      if (cut < 0) throw new Error('строка ' + head.line + ': не ключ и не элемент списка');
      const key = head.text.slice(0, cut).trim();
      const value = head.text.slice(cut + 1).trim();
      at++;
      if (value !== '') out[key] = scalar(value, head.line);
      else if (at < lines.length && lines[at].indent > indent) out[key] = node(lines[at].indent);
      else out[key] = null;
    }
    return out;
  }
  function list(indent) {
    const out = [];
    while (at < lines.length && lines[at].indent === indent && lines[at].text[0] === '-') {
      const head = lines[at];
      const rest = head.text.slice(1).trim();
      at++;
      if (rest === '') {
        out.push(node(head.indent + 2));
        continue;
      }
      /* Элемент-отображение записан первой строкой (`- name: …`), остальные его
       * ключи стоят на два пробела глубже. */
      const cut = rest.indexOf(':');
      if (cut < 0) throw new Error('строка ' + head.line + ': элемент списка не отображение');
      const item = {};
      const value = rest.slice(cut + 1).trim();
      const key = rest.slice(0, cut).trim();
      if (value !== '') item[key] = scalar(value, head.line);
      else if (at < lines.length && lines[at].indent > head.indent) item[key] = node(lines[at].indent);
      else item[key] = null;
      const more = at < lines.length && lines[at].indent > head.indent && lines[at].text[0] !== '-'
        ? map(head.indent + 2) : {};
      out.push(Object.assign(item, more));
    }
    return out;
  }
  function node(indent) {
    const first = lines[at];
    if (first === undefined || first.indent < indent) return null;
    if (first.text[0] === '-') return list(first.indent);
    if (first.indent > indent) throw new Error('строка ' + first.line + ': отступ глубже ожидаемого');
    return map(first.indent);
  }
  const doc = map(lines[0].indent);
  if (at !== lines.length) throw new Error('разбор кончился на строке ' + lines[at].line);
  return doc;
}

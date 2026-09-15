
export function appEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

/* Переключатель — метка вокруг поля ввода: цель нажатия одна, поэтому по нему
 * попадают и мышь, и клавиатура (`Space` на поле ввода), и вспомогательные
 * технологии. Подпись видимая, подробности — во всплывающей строке. */
export function appBox(label, title, checked, onChange, cls) {
  const box = appEl('label', 'box' + (cls ? ' ' + cls : ''));
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  if (title) input.title = title;
  input.addEventListener('change', onChange);
  box.appendChild(input);
  box.appendChild(appEl('span', null, label));
  return box;
}

/* Галочка, которую нечем переключить: место в дереве есть, а включать нечего —
 * файла нет в колонках, отчёт его не измеряет. Она снята и недоступна: так строка
 * выглядит как все прочие (глаз сравнивает одно с одним), но видно, что это не
 * «выключено читателем», а «не измеряется». Причина — во всплывающей строке. */
export function appOffBox(label, title, cls) {
  const box = appBox(label, title, false, null, cls);
  box.classList.add('plain');
  box.querySelector('input').disabled = true;
  /* Подсказка — на всей строке, а не только на поле: у недоступного поля браузер её
   * не показывает, а причина читателю нужна именно здесь. */
  box.title = title;
  return box;
}

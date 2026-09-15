
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

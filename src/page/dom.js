
export function appEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

/* A switch is a label around an input: one click target, which is why a mouse, the keyboard (`Space` on the input)
 * and assistive technology all reach it. The label is visible, the details live in the tooltip. */
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

/* A checkbox with nothing to switch: the place in the tree exists while there is nothing to switch on — the file is
 * not among the columns and the report does not measure it. The checkbox is off and unavailable: that way the row
 * looks like every other one (the eye compares like with like) while showing that this is not "switched off by the
 * reader" but "not measured". The reason lives in the tooltip. */
export function appOffBox(label, title, cls) {
  const box = appBox(label, title, false, null, cls);
  box.classList.add('plain');
  box.querySelector('input').disabled = true;
  /* The tooltip goes on the whole row rather than the input alone: a browser shows none for a disabled input, while
   * the reader needs the reason right here. */
  box.title = title;
  return box;
}

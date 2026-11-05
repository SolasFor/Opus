/* Меню «Камера» и диалог справки (M-05b; П-8 и §5 в 14_M05): setMenu(), toggleMenu(), menuOpen(); openHelp(),
 * closeHelp(), toggleHelp(); dropFocus().
 * Справка — нативный <dialog>: showModal() переводит фокус внутрь, Esc закрывает её раньше изоляции и выбора (onKey
 * в input.js). После закрытия браузер возвращает фокус назад.
 * M-05d: фокус с клавиатуры остаётся (ui/focus.js). Справка, закрытая мышью, снимает фокус с кнопки, на которую он
 * вернулся (dropFocus), закрытая с клавиатуры — оставляет. Меню — по образцу ARIA menu: открытое с клавиатуры ставит
 * фокус на выбранный пункт (или первый), ↑ ↓ Home End ходят по пунктам, Tab уводит фокус и закрывает меню, Esc
 * и выбор пункта закрывают его и возвращают фокус на кнопку «Камера».
 */
import { el } from './state.js';
import { viaKeyboard, moveFocusOut } from './focus.js';

const menuOpen = () => !el.camMenu.hidden;
const items = () => Array.from(el.camMenu.querySelectorAll('button'));
function setMenu(open) {
  if (!open) moveFocusOut(el.camMenu, el.btnCam);
  el.camMenu.hidden = !open;
  el.btnCam.setAttribute('aria-expanded', open);
  if (open && viaKeyboard()) (el.camMenu.querySelector('[aria-checked=true]') || items()[0]).focus();
}
function toggleMenu() { setMenu(!menuOpen()); }
function menuKey(e) {
  const list = items(), i = list.indexOf(document.activeElement), k = e.key;
  const to = k === 'ArrowDown' ? (i + 1) % list.length : k === 'ArrowUp' ? (i - 1 + list.length) % list.length
    : k === 'Home' ? 0 : k === 'End' ? list.length - 1 : -1;
  if (to < 0) return;
  list[to].focus();
  e.preventDefault();                       // onKey в input.js не обрабатывает клавишу ещё раз
}
function initMenu(signal) {
  el.camMenu.addEventListener('keydown', menuKey);
  el.camMenu.querySelectorAll('button').forEach(b => { b.tabIndex = -1; });
  el.btnCam.parentElement.addEventListener('focusout', e => {   // Tab из меню — меню закрывается
    if (menuOpen() && e.relatedTarget && !el.btnCam.parentElement.contains(e.relatedTarget)) setMenu(false);
  }, { signal });
}
function openHelp() {
  setMenu(false);
  if (!el.help.open) el.help.showModal();
}
function closeHelp() { if (el.help.open) el.help.close(); }
function onHelpClosed() { if (!viaKeyboard()) dropFocus(); }
function toggleHelp() { if (el.help.open) closeHelp(); else openHelp(); }
function dropFocus() {
  const a = document.activeElement;
  if (a && a.tagName === 'BUTTON') a.blur();
}

export { menuOpen, setMenu, toggleMenu, initMenu, openHelp, closeHelp, toggleHelp, onHelpClosed, dropFocus };

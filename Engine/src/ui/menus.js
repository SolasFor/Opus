/* Меню «Камера» и диалог справки (M-05b; П-8 и §5 в 14_M05): setMenu(), toggleMenu(), menuOpen(); openHelp(),
 * closeHelp(), toggleHelp(); dropFocus().
 * Справка — нативный <dialog>: showModal() переводит фокус внутрь, Esc закрывает её раньше изоляции и выбора (onKey
 * в input.js). После закрытия браузер возвращает фокус назад; с кнопки он снимается, как после любого клика: до M-05d
 * кнопки не держат фокус, чтобы Space не нажимал их повторно.
 */
import { el } from './state.js';

const menuOpen = () => !el.camMenu.hidden;
function setMenu(open) {
  el.camMenu.hidden = !open;
  el.btnCam.setAttribute('aria-expanded', open);
}
function toggleMenu() { setMenu(!menuOpen()); }
function openHelp() {
  setMenu(false);
  if (!el.help.open) el.help.showModal();
}
function closeHelp() { if (el.help.open) { el.help.close(); dropFocus(); } }
function toggleHelp() { if (el.help.open) closeHelp(); else openHelp(); }
function dropFocus() {
  const a = document.activeElement;
  if (a && a.tagName === 'BUTTON') a.blur();
}

export { menuOpen, setMenu, toggleMenu, openHelp, closeHelp, toggleHelp, dropFocus };

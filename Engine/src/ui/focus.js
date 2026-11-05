/* Фокус с клавиатуры (§7 в 14_M05; M-05d). До M-05d после любого клика фокус снимался со всех кнопок, чтобы Space
 * не нажимал их повторно. Теперь так только после мыши и касания: фокус, пришедший с клавиатуры, остаётся на элементе
 * и виден (рамка :focus-visible), а Space и Enter на кнопке, ползунке или пункте меню действуют на этот элемент
 * (правило — в onKey, ui/input.js).
 * trackInput() запоминает, чем пользовались последним — указателем или клавиатурой; viaKeyboard() — клавиатурой.
 * blurAfterPointer(node) снимает фокус с элемента после мыши или касания. moveFocusOut(box, to) переносит фокус
 * с элемента внутри box, который сейчас скроется (панель, карточка, меню), на элемент to — если фокус пришёл
 * с клавиатуры: иначе он пропал бы со страницы.
 */
const input = { last: 'pointer' };
// life — AbortController из main.js (снимает слушатели в dispose()). Вызывать до других слушателей document: тогда
// они видят уже обновлённое значение. Обработчик pointerdown на самом элементе срабатывает раньше — см. холст в input.js
function trackInput(life) {
  document.addEventListener('pointerdown', () => { input.last = 'pointer'; }, { signal: life.signal });
  document.addEventListener('keydown', () => { input.last = 'key'; }, { signal: life.signal });
}
const viaKeyboard = () => input.last === 'key';
function blurAfterPointer(node) { if (!viaKeyboard() && document.activeElement === node) node.blur(); }
function moveFocusOut(box, to) {
  const a = document.activeElement;
  if (a && a !== to && box.contains(a) && viaKeyboard() && to) to.focus({ preventScroll: true });
}

export { trackInput, viaKeyboard, blurAfterPointer, moveFocusOut };

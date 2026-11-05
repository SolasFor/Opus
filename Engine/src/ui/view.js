/* Режимы вида — сплошной, рентген, разрез: setView(), cycleView(); положение плоскости разреза setCut().
 * M-02c: подраздел «view modes» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * M-05b: вид выбирается сегментом в верхней панели (role=radiogroup, aria-checked); отдельной строки с названием вида
 * больше нет, ползунок разреза виден только в режиме «Разрез».
 * M-05d: подпись положения разреза — из ui/strings.ru.js («+12 мм от оси» с неразрывным пробелом), она же —
 * aria-valuetext ползунка. Сегмент «Вид» — радиогруппа с перемещаемым tabindex: в порядке Tab стоит только выбранный
 * вид, стрелки выбирают соседний (ui/input.js).
 */
import { V3 } from '../render/world.js';
import { camera, controls, cutPlane, CAP } from '../render/scene.js';
import { ui, el } from './state.js';
import { boundsWith } from './explode.js';
import { frameBox } from './camera.js';
import { S } from './strings.ru.js';

/* ---------- view modes ---------- */
function setView(mode) {
  ui.view = mode;
  CAP.uCapOn.value = mode === 'cut' ? 1 : 0;
  cutPlane.constant = mode === 'cut' ? ui.cutZ : 100;
  document.querySelectorAll('#viewSeg button').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('act', on); b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; });
  el.cutRow.classList.toggle('open', mode === 'cut');
  if (mode === 'cut' && camera.position.z - controls.target.z < 0.5) frameBox(boundsWith({}), 1.1, 0, V3(0.55, 0.32, 1));
}
function cycleView() { setView(ui.view === 'solid' ? 'xray' : ui.view === 'xray' ? 'cut' : 'solid'); }
function setCut(v) {
  ui.cutZ = -0.75 + 1.8 * v / 100;
  if (ui.view === 'cut') cutPlane.constant = ui.cutZ;
  el.cutSlider.style.setProperty('--p', v + '%');
  const t = Math.abs(ui.cutZ) < 0.05 ? S.cutAxis : S.cutOff(Math.round(ui.cutZ * 100));
  el.cutVal.textContent = t;
  el.cutSlider.setAttribute('aria-valuetext', t);
}

export { setView, cycleView, setCut };

/* Режимы вида — сплошной, рентген, разрез: setView(), cycleView(); положение плоскости разреза setCut().
 * M-02c: подраздел «view modes» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * M-05b: вид выбирается сегментом в верхней панели (role=radiogroup, aria-checked); отдельной строки с названием вида
 * больше нет, ползунок разреза виден только в режиме «Разрез».
 * M-05d: подпись положения разреза — из ui/strings.ru.js («+12 мм от оси» с неразрывным пробелом), она же —
 * aria-valuetext ползунка. Сегмент «Вид» — радиогруппа с перемещаемым tabindex: в порядке Tab стоит только выбранный
 * вид, стрелки выбирают соседний (ui/input.js).
 */
import { THROW_X, V3 } from '../render/world.js';
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
  if (mode === 'cut' && camera.position.x - controls.target.x < 0.8) frameBox(boundsWith({}), 1.1, 0, V3(1, 0.42, 0.72));
}
function cycleView() { setView(ui.view === 'solid' ? 'xray' : ui.view === 'xray' ? 'cut' : 'solid'); }
function setCut(v) {
  ui.cutZ = -3.2 + 6.4 * v / 100;
  if (ui.view === 'cut') cutPlane.constant = ui.cutZ;
  el.cutSlider.style.setProperty('--p', v + '%');
  let bestT = 0, bestD = 1e9;
  for (let i = 0; i < THROW_X.length; i++) { const d = Math.abs(ui.cutZ - THROW_X[i]); if (d < bestD) { bestD = d; bestT = i; } }
  const t = bestD < 0.16 ? S.cutCyls(bestT + 1, bestT + 7) : Math.abs(ui.cutZ) < 0.06 ? S.cutAxis : S.cutOff(Math.round(ui.cutZ * 100));
  el.cutVal.textContent = t;
  el.cutSlider.setAttribute('aria-valuetext', t);
}

export { setView, cycleView, setCut };

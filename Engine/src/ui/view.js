/* Режимы вида — сплошной, рентген, разрез: setView(), cycleView(); положение плоскости разреза setCut().
 * M-02c: подраздел «view modes» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 */
import { V3 } from '../render/world.js';
import { camera, controls, cutPlane, CAP } from '../render/scene.js';
import { ui, el } from './state.js';
import { boundsWith } from './explode.js';
import { frameBox } from './camera.js';

/* ---------- view modes ---------- */
const VIEW_NAMES = { solid: 'Сплошной', xray: 'Рентген', cut: 'Разрез' };
function setView(mode) {
  ui.view = mode;
  CAP.uCapOn.value = mode === 'cut' ? 1 : 0;
  cutPlane.constant = mode === 'cut' ? ui.cutZ : 100;
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('act', b.dataset.mode === mode));
  el.viewVal.textContent = VIEW_NAMES[mode];
  el.cutRow.classList.toggle('open', mode === 'cut');
  if (mode === 'cut' && camera.position.z - controls.target.z < 0.5) frameBox(boundsWith({}), 1.1, 0, V3(0.55, 0.32, 1));
}
function cycleView() { setView(ui.view === 'solid' ? 'xray' : ui.view === 'xray' ? 'cut' : 'solid'); }
function setCut(v) {
  ui.cutZ = -0.75 + 1.8 * v / 100;
  if (ui.view === 'cut') cutPlane.constant = ui.cutZ;
  el.cutSlider.style.setProperty('--p', v + '%');
  el.cutVal.textContent = Math.abs(ui.cutZ) < 0.05 ? 'по осям цилиндров' : (ui.cutZ > 0 ? '+' : '−') + Math.round(Math.abs(ui.cutZ) * 100) + ' мм от оси';
}

export { setView, cycleView, setCut };

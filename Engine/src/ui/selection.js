/* Выбор деталей: pick() — деталь под указателем, select(), isolate(), подсветка при наведении setHover().
 * M-02c: подраздел «selection / hover / isolation» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 */
import { camera, cutPlane } from '../render/scene.js';
import { ui, raycaster, pickables, el } from './state.js';
import { boundsWith } from './explode.js';
import { fitIfNeeded, focusOn } from './camera.js';
import { openInfo, closeInfo } from './info.js';

/* ---------- selection / hover / isolation ---------- */
function pick() {
  raycaster.setFromCamera(ui.pointer, camera);
  pickables.forEach(m => { if (m.isInstancedMesh) m.boundingSphere = null; });
  const hits = raycaster.intersectObjects(pickables, false);
  let glass = null;
  for (const h of hits) {
    const n = h.object.userData.node;
    if (!n || !h.object.visible) continue;
    if (ui.isolated && ui.isolated !== n) continue;
    const m = h.object.material;
    if (m.userData.housing && ui.view === 'cut' && h.point.z > cutPlane.constant) continue;   // clipped away
    if (n.userData.housing && ui.view === 'xray') { if (!glass) glass = n; continue; }
    return n;
  }
  return glass;
}
function select(node, focus = true) {
  ui.selected = node;
  if (node) { openInfo(node); if (focus) focusOn(node); } else closeInfo();
  Object.entries(el.chips).forEach(([k, c]) => c.classList.toggle('active', !!node && node.userData.key === k));
}
function isolate(node) {
  if (!node || ui.isolated === node) { ui.isolated = null; el.isoBar.classList.remove('on'); }
  else { ui.isolated = node; el.isoName.textContent = node.userData.info.short; el.isoBar.classList.add('on'); select(node, false); focusOn(node); }
  el.btnIsolate.textContent = ui.isolated && ui.isolated === ui.selected ? 'Показать всё' : 'Изолировать';
  Object.entries(el.chips).forEach(([k, c]) => c.classList.toggle('ghost', !!ui.isolated && ui.isolated.userData.key !== k));
  if (!ui.isolated) fitIfNeeded(boundsWith({}));
}
function setHover(n) {
  if (ui.hover === n) return;
  ui.hover = n;
  el.canvas.classList.toggle('pick', !!n);
  if (n) {
    el.tooltip.innerHTML = n.userData.info.name + '<i>клик — описание · двойной клик — изолировать</i>';
    el.tooltip.classList.add('on');
  } else el.tooltip.classList.remove('on');
}

export { pick, select, isolate, setHover };

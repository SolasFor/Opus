/* Вид узлов в каждом кадре, updateMaterials(): прозрачность корпуса в рентгене и при изоляции, свечение при наведении
 * и выборе, нагрев выпуска.
 * M-02c: подраздел «per-node materials» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { nodesList } from '../render/parts/nodes.js';
import { sim } from '../render/kinematics.js';
import { fx } from '../render/effects/strokes.js';
import { ui } from './state.js';

/* ---------- per-node materials: ghosting, x-ray, glow, exhaust heat ---------- */
const HL_HOVER = new THREE.Color(0x2c7dff), HL_SEL = new THREE.Color(0xff9a2e), HEAT = new THREE.Color(1.0, 0.30, 0.07);
const _gc = new THREE.Color();
function updateMaterials(dt) {
  const k = 1 - Math.exp(-dt * 10), kg = 1 - Math.exp(-dt * 14);
  for (const n of nodesList) {
    const ud = n.userData;
    let o = 1;
    if (ud.housing && ui.view === 'xray') o = 0.13;
    if (ui.isolated && ui.isolated !== n) o = Math.min(o, 0.05);
    ud.opacity += (o - ud.opacity) * k;
    if (Math.abs(o - ud.opacity) < 0.002) ud.opacity = o;
    let gt = 0;
    if (ui.selected === n) { gt = ui.hover === n ? 0.45 : 0.2; ud.glowColor.copy(HL_SEL); }
    else if (ui.hover === n) { gt = 0.5; ud.glowColor.copy(HL_HOVER); }
    ud.glow += (gt - ud.glow) * kg;
    if (Math.abs(gt - ud.glow) < 0.002) ud.glow = gt;
    n.visible = ud.opacity > 0.015;
    for (const m of ud.mats.values()) {
      const op = m.userData.baseOpacity * ud.opacity;
      const tr = op < 0.995;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = op;
      m.depthWrite = !tr;
      _gc.copy(m.userData.baseEmissive);
      if (m.userData.isPipe) { const h = sim.heat * 1.5 * fx.exhaust; _gc.r += HEAT.r * h; _gc.g += HEAT.g * h; _gc.b += HEAT.b * h; }
      _gc.r += ud.glowColor.r * ud.glow; _gc.g += ud.glowColor.g * ud.glow; _gc.b += ud.glowColor.b * ud.glow;
      m.emissive.copy(_gc);
    }
  }
}

export { updateMaterials };

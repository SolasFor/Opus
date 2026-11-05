/* Деталь «Шатуны»: buildRods().
 * M-02b: подраздел 6.3 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * M-07c: по прототипу M-07 в тех же размерах: кованый двутавр с выборками, нижняя головка с приливами под болты,
 * линия разъёма крышки, болты с гайками, вкладыши, втулка верхней головки.
 */
import * as THREE from 'three';
import { DEG, CRANK_Y, ROD_L } from '../../config/engine-spec.js';
import { M } from '../materials.js';
import { G, extrudeXb, Parts, holePath, poly } from './geometry.js';

/* ---------- 6.3 RODS (InstancedMesh ×4) ---------- */
let rodMeshes = [];
// (u = −z, v = y): нижняя головка с приливами под болты; withShank — со стержнем до верхней головки (ROD_L)
function rodOutline(withShank) {
  const s = new THREE.Shape();
  s.moveTo(0.27, 0.06); s.lineTo(0.27, -0.12); s.quadraticCurveTo(0.27, -0.33, 0.10, -0.335); s.lineTo(-0.10, -0.335);
  s.quadraticCurveTo(-0.27, -0.33, -0.27, -0.12); s.lineTo(-0.27, 0.06); s.quadraticCurveTo(-0.20, 0.17, -0.13, 0.22);
  if (withShank) { s.lineTo(-0.075, ROD_L - 0.12); s.absarc(0, ROD_L, 0.1415, 238 * DEG, -58 * DEG, true); }
  s.lineTo(0.13, 0.22); s.quadraticCurveTo(0.20, 0.17, 0.27, 0.06);
  s.holes.push(holePath(0, 0, 0.125));
  return s;
}
function buildRods(g) {
  const P = new Parts();
  const web = rodOutline(true); web.holes.push(holePath(0, ROD_L, 0.062));
  P.add(extrudeXb(web, 0.07, 24, 0.01), M.forged);
  // I-beam flanges along the shank
  [-1, 1].forEach(e => P.add(extrudeXb(poly([[e * 0.13, 0.22], [e * 0.092, 0.22], [e * 0.040, ROD_L - 0.135], [e * 0.075, ROD_L - 0.12]]), 0.125, 2, 0.008), M.forged));
  // big end with bolt bosses (full width) + small end eye
  P.add(extrudeXb(rodOutline(false), 0.15, 24, 0.012), M.forged);
  const se = new THREE.Shape(); se.absarc(0, 0, 0.1415, 0, Math.PI * 2, false); se.holes.push(holePath(0, 0, 0.062));
  P.add(extrudeXb(se, 0.13, 28, 0.01), M.forged, [0, ROD_L, 0]);
  // cap split line, bolts with nuts
  P.add(G.box(0.152, 0.006, 0.545), M.boltDark, [0, -0.02, 0]);
  [-0.2, 0.2].forEach(z => {
    P.add(G.hex(0.042, 0.06), M.bolt, [0, -0.365, z]);
    P.add(G.cyl(0.022, 0.022, 0.03, 10), M.bolt, [0, -0.41, z]);
  });
  // bearings
  P.add(G.cylX(0.06, 0.12, 20), M.brass, [0, ROD_L, 0]);
  P.add(G.cylX(0.127, 0.10, 32), M.brass, [0, 0, 0]);
  rodMeshes = P.instanced(g, g, 4);
  g.userData.anchor.set(0.55, CRANK_Y + 1.0, 0.5);
}

export { rodMeshes, buildRods };

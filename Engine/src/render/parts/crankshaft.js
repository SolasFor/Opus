/* Деталь «Коленвал, маховик и шестерня коленвала»: buildCrankshaft().
 * M-02b: подраздел 6.2 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { DEG, FIRE_DEG, CRANK_Y, CRANK_R } from '../../config/engine-spec.js';
import { mod } from '../../sim/math.js';
import { CYL_X, BELT_X, R_CRANK_SPR } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeX, gearShape, Parts } from './geometry.js';

/* ---------- 6.2 CRANKSHAFT + FLYWHEEL + CRANK SPROCKET ---------- */
let crankGroup;
function webShape() {
  const s = new THREE.Shape(), rr = 0.47, a0 = 200 * DEG, a1 = 340 * DEG;
  s.absarc(0, CRANK_R, 0.205, 0, Math.PI, false);
  s.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
  s.absarc(0, 0, rr, a0, a1, false);
  s.lineTo(0.205, CRANK_R);
  return s;
}
function buildCrankshaft(g) {
  crankGroup = new THREE.Group();
  crankGroup.position.set(0, CRANK_Y, 0);
  g.add(crankGroup);
  const P = new Parts();
  P.add(G.cylX(0.16, 5.0, 24), M.steel, [0.05, 0, 0]);
  [-2.2, -1.1, 0, 1.1, 2.2].forEach(x => P.add(G.cylX(0.19, 0.30, 26), M.chrome, [x, 0, 0]));
  const ws = webShape();
  CYL_X.forEach((x, i) => {
    const ph = mod(-FIRE_DEG[i], 360) * DEG;     // pin direction in crank space
    [x - 0.235, x + 0.235].forEach(wx => P.add(extrudeX(ws, 0.13, 18), M.steelDark, [wx, 0, 0], [ph, 0, 0]));
    P.add(G.cylX(0.13, 0.36, 22), M.chrome, [x, CRANK_R * Math.cos(ph), CRANK_R * Math.sin(ph)]);
  });
  // crank sprocket (20 teeth) + accessory pulley
  P.add(extrudeX(gearShape(20, R_CRANK_SPR - 0.025, R_CRANK_SPR + 0.012), 0.14, 2), M.steelDark, [BELT_X, 0, 0]);
  P.add(G.cylX(0.34, 0.18, 36), M.dark, [BELT_X + 0.24, 0, 0]);
  for (let k = 0; k < 4; k++) P.add(G.torusX(0.34, 0.012, 4, 36), M.steelDark, [BELT_X + 0.17 + k * 0.045, 0, 0]);
  P.add(G.cylX(0.07, 0.06, 6), M.chrome, [BELT_X + 0.35, 0, 0]);
  // flywheel with ring gear
  const FX = -2.62;
  P.add(G.cylX(0.90, 0.20, 48), M.steelDark, [FX, 0, 0]);
  P.add(extrudeX(gearShape(96, 0.92, 0.985), 0.09, 1), M.steel, [FX - 0.05, 0, 0]);
  P.add(G.cylX(0.30, 0.34, 28), M.steel, [FX + 0.12, 0, 0]);
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2;
    P.add(G.cylX(0.055, 0.28, 10), M.chrome, [FX + 0.06, Math.cos(a) * 0.42, Math.sin(a) * 0.42]);
  }
  P.add(G.torusX(0.68, 0.02, 6, 48), M.steel, [FX + 0.11, 0, 0]);
  P.build(crankGroup, g);
  g.userData.anchor.set(-2.62, CRANK_Y + 1.0, 0);
}

export { crankGroup, buildCrankshaft };

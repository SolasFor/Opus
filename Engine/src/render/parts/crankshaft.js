/* Деталь «Коленвал, маховик и шестерня коленвала»: buildCrankshaft().
 * M-02b: подраздел 6.2 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * M-07c: по прототипу M-07 в тех же размерах: кованые щёки с фаской и балансировочными сверлениями, точёные шейки,
 * демпфер крутильных колебаний с поликлиновыми канавками и болтом, точёный маховик с облегчающими отверстиями
 * и болтами крепления. Сверления и отверстия — тёмные заглушки (M.hole); профиль щёк, звёздочка 20 зубьев и зубчатый
 * венец прежние.
 */
import * as THREE from 'three';
import { DEG, FIRE_DEG, CRANK_Y, CRANK_R } from '../../config/engine-spec.js';
import { mod } from '../../sim/math.js';
import { CYL_X, BELT_X, R_CRANK_SPR } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeX, extrudeXb, gearShape, Parts } from './geometry.js';

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
  [-2.2, -1.1, 0, 1.1, 2.2].forEach(x => P.add(G.cylX(0.19, 0.30, 36), M.chrome, [x, 0, 0]));
  const ws = webShape();
  CYL_X.forEach((x, i) => {
    const ph = mod(-FIRE_DEG[i], 360) * DEG;     // pin direction in crank space
    [x - 0.235, x + 0.235].forEach(wx => {
      P.add(extrudeXb(ws, 0.15, 24, 0.02), M.forged, [wx, 0, 0], [ph, 0, 0]);
      // balance drillings in the counterweight
      [-0.16, 0.16].forEach(a => { const aa = ph + Math.PI + a;
        P.add(G.cylX(0.045, 0.152, 16), M.hole, [wx, 0.34 * Math.cos(aa), 0.34 * Math.sin(aa)]); });
    });
    P.add(G.cylX(0.13, 0.36, 32), M.chrome, [x, CRANK_R * Math.cos(ph), CRANK_R * Math.sin(ph)]);
  });
  // crank sprocket (20 teeth) + harmonic damper with poly-V grooves (lathe along +x), rubber ring, bolt
  P.add(extrudeX(gearShape(20, R_CRANK_SPR - 0.025, R_CRANK_SPR + 0.012), 0.14, 2), M.steelDark, [BELT_X, 0, 0]);
  const dp = [[0, 0], [0.12, 0], [0.12, 0.02], [0.30, 0.02], [0.30, 0.03]];
  for (let k = 0; k < 6; k++) { const y = 0.035 + k * 0.024; dp.push([0.34, y], [0.322, y + 0.012], [0.34, y + 0.024]); }
  dp.push([0.34, 0.185], [0.30, 0.19], [0.26, 0.19], [0.25, 0.16, 1], [0.13, 0.16], [0.13, 0.20], [0, 0.20]);
  P.add(G.latheX(dp, 64), M.iron, [BELT_X + 0.15, 0, 0]);
  P.add(G.cylX(0.255, 0.004, 48), M.wire, [BELT_X + 0.337, 0, 0]);
  P.bolt(M.bolt, [BELT_X + 0.35, 0, 0], 'x', 0.075, 0.06);
  // flywheel: turned disc with a recess on the engine side, ring gear, hub, bolts, lightening holes
  const FX = -2.62;
  P.add(G.latheX([[0, -0.10], [0.86, -0.10], [0.90, -0.08], [0.90, 0.08], [0.86, 0.10], [0.62, 0.10], [0.60, 0.06], [0.30, 0.06], [0.28, 0.10], [0, 0.10]], 72), M.forged, [FX, 0, 0]);
  P.add(extrudeX(gearShape(96, 0.92, 0.985), 0.09, 1), M.steel, [FX - 0.05, 0, 0]);
  P.add(G.cylX(0.19, 0.22, 28), M.steel, [FX + 0.15, 0, 0]);
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    P.bolt(M.boltDark, [FX - 0.11, Math.cos(a) * 0.15, Math.sin(a) * 0.15], '-x', 0.035, 0.035);
    if (k < 6) P.add(G.cylX(0.05, 0.164, 16), M.hole, [FX - 0.02, Math.cos(a + 0.5) * 0.55, Math.sin(a + 0.5) * 0.55]);   // through the recess
  }
  P.add(G.cylX(0.25, 0.02, 40), M.steel, [FX - 0.10, 0, 0]);
  P.add(G.torusX(0.68, 0.02, 6, 48), M.steel, [FX + 0.11, 0, 0]);
  P.build(crankGroup, g);
  g.userData.anchor.set(-2.62, CRANK_Y + 1.0, 0);
}

export { crankGroup, buildCrankshaft };

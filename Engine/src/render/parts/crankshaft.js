/* Деталь «Коленвал V12, маховик и демпфер»: buildCrankshaft().
 * 7 коренных шеек, 6 общих шатунных шеек под углами 120° (по 2 шатуна на шейке),
 * 12 кованых противовесов с балансировочными сверлениями, 20-зубая звёздочка ГРМ, 6PK-демпфер и маховик (108 з.).
 */
import * as THREE from 'three';
import { DEG, CRANK_Y, CRANK_R, THROW_PSI } from '../../config/engine-spec.js';
import { THROW_X, MAINS_X, BELT_X, R_CRANK_SPR, FLYWHEEL_X } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeX, extrudeXb, gearShape, Parts } from './geometry.js';

let crankGroup;
function webShape() {
  const s = new THREE.Shape(), rr = 0.48, a0 = 200 * DEG, a1 = 340 * DEG;
  s.absarc(0, CRANK_R, 0.20, 0, Math.PI, false);
  s.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
  s.absarc(0, 0, rr, a0, a1, false);
  s.lineTo(0.20, CRANK_R);
  return s;
}

function buildCrankshaft(g) {
  crankGroup = new THREE.Group();
  crankGroup.position.set(0, CRANK_Y, 0);
  g.add(crankGroup);
  const P = new Parts();

  P.add(G.cylX(0.16, 7.1, 24), M.steel, [0.05, 0, 0]);
  MAINS_X.forEach(x => P.add(G.cylX(0.19, 0.22, 32), M.chrome, [x, 0, 0]));

  const ws = webShape();
  THROW_X.forEach((x, t) => {
    const ph = THROW_PSI[t];
    [x - 0.255, x + 0.255].forEach(wx => {
      P.add(extrudeXb(ws, 0.11, 20, 0.018), M.forged, [wx, 0, 0], [ph, 0, 0]);
      [-0.16, 0.16].forEach(a => {
        const aa = ph + Math.PI + a;
        P.add(G.cylX(0.042, 0.112, 14), M.hole, [wx, 0.35 * Math.cos(aa), 0.35 * Math.sin(aa)]);
      });
    });
    P.add(G.cylX(0.13, 0.40, 32), M.chrome, [x, CRANK_R * Math.cos(ph), CRANK_R * Math.sin(ph)]);
  });

  // звёздочка ГРМ (20 зубьев) и 6-ручейковый демпфер крутильных колебаний
  P.add(extrudeX(gearShape(20, R_CRANK_SPR - 0.025, R_CRANK_SPR + 0.012), 0.14, 2), M.steelDark, [BELT_X, 0, 0]);
  const dp = [[0, 0], [0.12, 0], [0.12, 0.02], [0.30, 0.02], [0.30, 0.03]];
  for (let k = 0; k < 6; k++) { const y = 0.035 + k * 0.024; dp.push([0.34, y], [0.322, y + 0.012], [0.34, y + 0.024]); }
  dp.push([0.34, 0.185], [0.30, 0.19], [0.26, 0.19], [0.25, 0.16, 1], [0.13, 0.16], [0.13, 0.20], [0, 0.20]);
  P.add(G.latheX(dp, 56), M.iron, [BELT_X + 0.15, 0, 0]);
  P.add(G.cylX(0.255, 0.004, 40), M.wire, [BELT_X + 0.337, 0, 0]);
  P.bolt(M.bolt, [BELT_X + 0.35, 0, 0], 'x', 0.075, 0.06);

  // облегчённый маховик с 108-зубым венцом стартера
  const FX = FLYWHEEL_X;
  P.add(G.latheX([[0, -0.10], [0.90, -0.10], [0.94, -0.08], [0.94, 0.08], [0.90, 0.10], [0.64, 0.10], [0.62, 0.06], [0.32, 0.06], [0.30, 0.10], [0, 0.10]], 64), M.forged, [FX, 0, 0]);
  P.add(extrudeX(gearShape(108, 0.96, 1.02), 0.09, 1), M.steel, [FX - 0.05, 0, 0]);
  P.add(G.cylX(0.19, 0.24, 24), M.steel, [FX + 0.16, 0, 0]);
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    P.bolt(M.boltDark, [FX - 0.11, Math.cos(a) * 0.16, Math.sin(a) * 0.16], '-x', 0.034, 0.032);
    if (k < 6) P.add(G.cylX(0.055, 0.164, 16), M.hole, [FX - 0.02, Math.cos(a + 0.5) * 0.58, Math.sin(a + 0.5) * 0.58]);
  }
  P.add(G.cylX(0.26, 0.02, 36), M.steel, [FX - 0.10, 0, 0]);
  P.add(G.torusX(0.72, 0.02, 6, 44), M.steel, [FX + 0.11, 0, 0]);

  P.build(crankGroup, g);
  g.userData.anchor.set(FX, CRANK_Y + 1.0, 0);
}

export { crankGroup, buildCrankshaft };

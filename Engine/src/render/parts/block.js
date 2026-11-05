/* Деталь «Блок цилиндров»: buildBlock().
 * M-02b: подраздел 6.1 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * M-07b: литой блок по прототипу M-07 в тех же размерах: приливы цилиндров, бобышки болтов головки, обработанная
 * привалочная плоскость с гильзами, расширяющаяся юбка с рёбрами, постели коренных подшипников с крышками,
 * вкладышами и болтами, сальники, поддон-оболочка с картером, фланцем и пробкой, опоры, фильтр, датчик детонации, щуп.
 * Стенки блока и поддона — оболочки, поэтому в разрезе штриховка идёт только по металлу. Крепёж и мелочь —
 * ключи-цвета (M.bolt, M.fitting и др.): один меш на узел.
 */
import * as THREE from 'three';
import { BORE_R, CRANK_Y } from '../../config/engine-spec.js';
import { CYL_X, BLOCK_Y0, CRANK_TOP, DECK_Y } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeXb, extrudeY, extrudeZ, Parts, roundRect, holePath, poly } from './geometry.js';

/* ---------- 6.1 BLOCK ---------- */
const MAINS = [-2.2, -1.1, 0, 1.1, 2.2];
function buildBlock(g) {
  const P = new Parts();
  const W = 2.35, D = 0.95, r = 0.12;
  // cylinder bank with real bores
  const s = roundRect(-W, -D, W, D, r);
  CYL_X.forEach(x => s.holes.push(holePath(x, 0, BORE_R)));
  P.add(extrudeY(s, DECK_Y - 0.07 - CRANK_TOP - 0.08, 48), M.aluCast, [0, CRANK_TOP + 0.08, 0]);
  // machined deck plate + dark liner rims
  const sd = roundRect(-W - 0.03, -D - 0.04, W + 0.03, D + 0.04, r + 0.03);
  CYL_X.forEach(x => sd.holes.push(holePath(x, 0, BORE_R)));
  P.add(extrudeY(sd, 0.07, 48, 0.012), M.aluMach, [0, DECK_Y - 0.07, 0]);
  CYL_X.forEach(x => {
    const ls = new THREE.Shape(); ls.absarc(0, 0, BORE_R + 0.03, 0, Math.PI * 2, false); ls.holes.push(holePath(0, 0, BORE_R));
    P.add(extrudeY(ls, 0.012, 48), M.iron, [x, DECK_Y - 0.008, 0]);
  });
  // bank-to-crankcase flange (frame)
  const fr = roundRect(-W - 0.02, -D - 0.06, W + 0.02, D + 0.06, 0.1); fr.holes.push(roundRect(-W + 0.12, -D + 0.12, W - 0.12, D - 0.12, 0.08));
  P.add(extrudeY(fr, 0.10, 16, 0.015), M.aluCast, [0, CRANK_TOP - 0.02, 0]);
  [-1, 1].forEach(side => {
    // siamese bore bulges and head-bolt bosses on both flanks
    CYL_X.forEach(x => P.add(G.cyl(0.36, 0.36, DECK_Y - CRANK_TOP - 0.26, 40), M.aluCast,
      [x, (CRANK_TOP + DECK_Y) / 2 - 0.02, side * (D - 0.25)], null, [1, 1, 0.8]));
    MAINS.forEach(x => {
      P.add(G.cyl(0.07, 0.07, DECK_Y - CRANK_TOP - 0.12, 16), M.aluCast, [x * 0.985, (CRANK_TOP + DECK_Y) / 2 - 0.02, side * (D + 0.005)]);
      P.add(G.cyl(0.085, 0.07, 0.08, 16), M.aluCast, [x * 0.985, CRANK_TOP + 0.13, side * (D + 0.005)]);
    });
    // core (freeze) plugs + knock sensor
    [-1.65, 0.55].forEach(x => {
      P.add(G.cylZ(0.085, 0.03, 24), M.aluCast, [x, 1.38, side * (D + 0.045)]);
      P.add(G.cylZ(0.07, 0.03, 24), M.fitting, [x, 1.38, side * (D + 0.06)]);
    });
    // crankcase skirt: flared cast wall (u = −z)
    const zi0 = 0.88, zo0 = 0.97, zi1 = 0.99, zo1 = 1.08, y0 = CRANK_TOP, y1 = BLOCK_Y0 + 0.10;
    const ws = poly([[-side * zi0, y0], [-side * zo0, y0], [-side * zo1, y1], [-side * zi1, y1]]);
    P.add(extrudeXb(ws, 4.64, 2, 0.015), M.aluCast, [0, 0, 0]);
    // stiffening ribs following the flare
    for (let i = 0; i < 6; i++) {
      const x = -2.0 + i * 0.8;
      P.add(G.rbox(0.07, 1.12, 0.07, 0.025), M.aluCast, [x, 0.33, side * 1.035], [-side * 0.095, 0, 0]);
    }
    // engine mounts: cast pads + rubber bushes + bolts
    [-1.6, 1.6].forEach(x => {
      P.add(G.rbox(0.42, 0.34, 0.12, 0.03), M.aluCast, [x, 0.22, side * 1.11]);
      P.add(G.cylZ(0.13, 0.16, 28), M.rubber, [x, 0.22, side * 1.24]);
      P.add(G.cylZ(0.15, 0.03, 28), M.fittingDark, [x, 0.22, side * 1.33]);
      P.bolt(M.bolt, [x, 0.22, side * 1.345], side > 0 ? 'z' : '-z', 0.05, 0.04);
    });
    // pan-rail bolts along the flange
    for (let i = 0; i < 9; i++) P.bolt(M.bolt, [-2.1 + i * 0.525, BLOCK_Y0 - 0.04, side * 1.065], '-y', 0.028, 0.03);
  });
  // end walls with crank seal housings
  [-1, 1].forEach(e => {
    P.add(G.rbox(0.10, DECK_Y - BLOCK_Y0 - 0.12 - 1.42, 1.90, 0.03), M.aluCast, [e * 2.30, (CRANK_TOP + BLOCK_Y0 + 0.08) / 2 + 0.0, 0], null, [1, 1, 1]);
    const ring = new THREE.Shape(); ring.absarc(0, 0, 0.36, 0, Math.PI * 2, false); ring.holes.push(holePath(0, 0, 0.20));
    P.add(extrudeXb(ring, 0.07, 40, 0.012), M.aluCast, [e * 2.385, CRANK_Y, 0]);
    P.add(G.torusX(0.205, 0.018, 8, 36), M.rubber, [e * 2.42, CRANK_Y, 0]);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3;
      P.bolt(M.bolt, [e * 2.42, CRANK_Y + Math.cos(a) * 0.29, Math.sin(a) * 0.29], e > 0 ? 'x' : '-x', 0.025, 0.025); }
  });
  // pan rail (machined frame)
  const pr = roundRect(-W - 0.02, -1.10, W + 0.02, 1.10, 0.1); pr.holes.push(roundRect(-W + 0.08, -0.99, W - 0.08, 0.99, 0.06));
  P.add(extrudeY(pr, 0.10, 16, 0.012), M.aluCast, [0, BLOCK_Y0, 0]);
  // main bearing bulkheads (saddles) + caps with bolts and shells (u = −z, v = y)
  const bh = new THREE.Shape();
  bh.moveTo(-0.86, 1.0); bh.lineTo(0.86, 1.0); bh.lineTo(0.80, CRANK_Y); bh.lineTo(0.205, CRANK_Y);
  bh.absarc(0, CRANK_Y, 0.205, 0, Math.PI, false); bh.lineTo(-0.80, CRANK_Y); bh.closePath();
  const cp = new THREE.Shape();
  cp.moveTo(-0.42, CRANK_Y); cp.lineTo(-0.205, CRANK_Y); cp.absarc(0, CRANK_Y, 0.205, Math.PI, Math.PI * 2, false);
  cp.lineTo(0.42, CRANK_Y); cp.lineTo(0.42, 0.12); cp.quadraticCurveTo(0.42, -0.02, 0.28, -0.02); cp.lineTo(-0.28, -0.02);
  cp.quadraticCurveTo(-0.42, -0.02, -0.42, 0.12); cp.closePath();
  const sh = new THREE.Shape(); sh.absarc(0, 0, 0.205, 0, Math.PI * 2, false); sh.holes.push(holePath(0, 0, 0.19));
  MAINS.forEach(x => {
    P.add(extrudeXb(bh, 0.26, 24, 0.012), M.aluCast, [x, 0, 0]);
    P.add(extrudeXb(cp, 0.28, 24, 0.014), M.iron, [x, 0, 0]);
    P.add(extrudeXb(sh, 0.22, 36, 0.004), M.shell, [x, CRANK_Y, 0]);
    [-0.31, 0.31].forEach(z => P.bolt(M.boltDark, [x, -0.02, z], '-y', 0.045, 0.05));
  });
  // oil pan: stamped steel shell with deep sump (side profile extruded along z) + flange + drain plug
  const outer = [[-2.28, BLOCK_Y0 - 0.04], [-2.18, -0.98], [-0.05, -0.98], [0.25, -0.66], [2.20, -0.62], [2.28, BLOCK_Y0 - 0.04]];
  const inner = [[2.24, BLOCK_Y0 - 0.04], [2.165, -0.585], [0.235, -0.625], [-0.07, -0.945], [-2.145, -0.945], [-2.24, BLOCK_Y0 - 0.04]];
  P.add(extrudeZ(poly([...outer, ...inner]), 2.0, 2, 0.012), M.paintBlack, [0, 0, 0]);
  [-1, 1].forEach(side => P.add(extrudeZ(poly(outer), 0.045, 2, 0.012), M.paintBlack, [0, 0, side * 1.0]));
  const pf = roundRect(-W + 0.03, -1.10, W - 0.03, 1.10, 0.1); pf.holes.push(roundRect(-W + 0.1, -0.99, W - 0.1, 0.99, 0.06));
  P.add(extrudeY(pf, 0.04, 16, 0.008), M.paintBlack, [0, BLOCK_Y0 - 0.04, 0]);
  [-1, 1].forEach(side => P.add(G.rbox(4.3, 0.04, 0.03, 0.012), M.paintBlack, [0, -0.47, side * 1.025]));
  P.add(G.cylZ(0.07, 0.03, 20), M.fittingDark, [-1.4, -0.86, 1.04]);
  P.bolt(M.bolt, [-1.4, -0.86, 1.055], 'z', 0.045, 0.035);
  // oil filter on a cast boss (intake side)
  P.add(G.cylZ(0.15, 0.16, 32), M.aluCast, [0.95, 0.30, -1.07]);
  P.add(G.latheZ([[0, 0], [0.17, 0, 1], [0.175, -0.02, 1], [0.175, -0.30, 1], [0.16, -0.335, 1], [0.08, -0.345, 1], [0, -0.345]], 40), M.paintBlue, [0.95, 0.30, -1.15]);
  for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2;
    P.add(G.rbox(0.02, 0.02, 0.09, 0.008), M.paintBlue, [0.95 + Math.cos(a) * 0.176, 0.30 + Math.sin(a) * 0.176, -1.44]); }
  // knock sensor + connector
  P.add(G.cylZ(0.045, 0.06, 16), M.aluCast, [-0.55, 1.18, -(D + 0.03)]);
  P.add(G.cylZ(0.065, 0.05, 20), M.paintBlack, [-0.55, 1.18, -(D + 0.08)]);
  P.add(G.rbox(0.07, 0.09, 0.06, 0.015), M.paintBlack, [-0.55, 1.27, -(D + 0.08)]);
  // dipstick tube + handle (orange)
  P.add(G.cyl(0.016, 0.016, 1.45, 10), M.fitting, [-0.25, 1.30, -(D + 0.08)]);
  P.add(G.cyl(0.03, 0.03, 0.06, 12), M.fitting, [-0.25, 2.03, -(D + 0.08)]);
  P.add(G.torusY(0.05, 0.016, 8, 20), M.paintRed, [-0.25, 2.12, -(D + 0.08)], [Math.PI / 2, 0, 0]);
  P.add(G.rbox(0.05, 0.10, 0.08, 0.01), M.fitting, [-0.25, 1.75, -(D + 0.04)]);
  P.build(g, g);
  g.userData.anchor.set(-1.2, 1.9, 0.95);
}

export { buildBlock };

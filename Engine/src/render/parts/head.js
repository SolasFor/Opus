/* Деталь «Головка блока и прокладка»: buildHead().
 * M-02b: подраздел 6.5 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { BORE_R } from '../../config/engine-spec.js';
import { CYL_X, GASKET_Y, HEAD_BOT, HEAD_TOP, CAM_Y, CAM_Z } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeX, extrudeY, Parts, registerLocalPart } from './geometry.js';

/* ---------- 6.5 HEAD + GASKET ---------- */
function buildHead(g) {
  const P = new Parts();
  const hw = 0.95, hb = HEAD_BOT, ht = HEAD_TOP, tw = 0.82;
  const s = new THREE.Shape();
  s.moveTo(-hw, hb); s.lineTo(hw, hb); s.lineTo(hw, ht - 0.14); s.lineTo(tw, ht); s.lineTo(-tw, ht); s.lineTo(-hw, ht - 0.14); s.closePath();
  P.add(extrudeX(s, 4.7, 1), M.alu, [0, 0, 0]);
  // flank ribs
  [-1, 1].forEach(side => [2.70, 3.05].forEach(y => P.add(G.box(4.5, 0.06, 0.05), M.aluDark, [0, y, side * (hw + 0.02)])));
  // pent-roof chamber roofs (dark, visible from below / in the cut)
  CYL_X.forEach(x => P.add(G.cyl(0.41, 0.41, 0.012, 30), M.soot, [x, hb - 0.004, 0]));
  // port stubs: intake (−z) and exhaust (+z)
  CYL_X.forEach(x => {
    P.add(G.cylZ(0.15, 0.16, 22), M.alu, [x, 2.95, -(hw + 0.07)]);
    P.add(G.cylZ(0.16, 0.14, 22), M.alu, [x, 2.88, hw + 0.06]);
  });
  // cam carrier: bearing towers + caps, bolts
  [-2.2, -1.1, 0, 1.1, 2.2].forEach(x => [-CAM_Z, CAM_Z].forEach(z => {
    P.add(G.box(0.18, CAM_Y - ht + 0.02, 0.34), M.alu, [x, (CAM_Y + ht) / 2 - 0.01, z]);
    P.add(G.box(0.19, 0.12, 0.36), M.aluLight, [x, CAM_Y + 0.07, z]);
    [-0.13, 0.13].forEach(dz => P.add(G.cyl(0.025, 0.025, 0.04, 6), M.steelDark, [x, CAM_Y + 0.15, z + dz]));
  }));
  // spark-plug wells
  CYL_X.forEach(x => P.add(G.cyl(0.085, 0.085, 0.10, 18, true), M.aluDark, [x, ht + 0.04, 0]));
  // head bolts
  [-2.0, -1.1, 0, 1.1, 2.0].forEach(x => [-0.72, 0.72].forEach(z => P.add(G.cyl(0.075, 0.075, 0.09, 6), M.steelDark, [x, ht + 0.045, z])));
  // thermostat housing at the flywheel end
  P.add(G.cylX(0.14, 0.22, 20), M.aluCast, [-2.45, 3.05, -0.35]);
  P.add(G.cylX(0.09, 0.22, 16), M.aluCast, [-2.65, 3.05, -0.35]);
  P.build(g, g);

  // multi-layer gasket: its own local explode path inside the head node
  const gk = new THREE.Group(); g.add(gk);
  const GP = new Parts();
  const gs = new THREE.Shape();
  gs.moveTo(-2.33, -0.93); gs.lineTo(2.33, -0.93); gs.lineTo(2.33, 0.93); gs.lineTo(-2.33, 0.93); gs.closePath();
  CYL_X.forEach(x => { const h = new THREE.Path(); h.absarc(x, 0, BORE_R + 0.01, 0, Math.PI * 2, true); gs.holes.push(h); });
  GP.add(extrudeY(gs, 0.05, 32), M.gasket, [0, -0.025, 0]);
  CYL_X.forEach(x => GP.add(G.torusY(BORE_R + 0.03, 0.012, 6, 36), M.steel, [x, 0.02, 0]));
  GP.build(gk, g);
  registerLocalPart(g, gk, [0, GASKET_Y, 0], [0, GASKET_Y - 0.38, 0]);
  g.userData.anchor.set(1.1, HEAD_TOP + 0.05, -0.8);
}

export { buildHead };

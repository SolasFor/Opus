/* Деталь «Головка блока и прокладка»: buildHead().
 * M-02b: подраздел 6.5 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * M-07b: литая головка по прототипу M-07 в тех же размерах: профиль с фасками и привалочным фланцем, обработанная
 * направляющая под крышку, площадки фланцев впуска и выпуска, опоры распредвалов с крышками и болтами, колодцы свечей,
 * болты головки с шайбами, корпус термостата, рым-болты. Прокладка — прежняя, со своим смещением при разборке.
 */
import * as THREE from 'three';
import { BORE_R } from '../../config/engine-spec.js';
import { CYL_X, GASKET_Y, HEAD_BOT, HEAD_TOP, CAM_Y, CAM_Z } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeXb, extrudeY, Parts, registerLocalPart, roundRect, holePath } from './geometry.js';

/* ---------- 6.5 HEAD + GASKET ---------- */
function buildHead(g) {
  const P = new Parts();
  const hw = 0.95, hb = HEAD_BOT, ht = HEAD_TOP, tw = 0.82, L = 4.7;
  // cast body: deck flange, flanks, chamfer to the cam-cover rail (u = −z, v = y)
  const s = new THREE.Shape();
  s.moveTo(-hw - 0.02, hb); s.lineTo(hw + 0.02, hb); s.lineTo(hw + 0.02, hb + 0.07); s.lineTo(hw, hb + 0.10);
  s.lineTo(hw, ht - 0.20); s.lineTo(tw + 0.04, ht - 0.05); s.lineTo(tw + 0.04, ht); s.lineTo(-tw - 0.04, ht);
  s.lineTo(-tw - 0.04, ht - 0.05); s.lineTo(-hw, ht - 0.20); s.lineTo(-hw, hb + 0.10); s.lineTo(-hw - 0.02, hb + 0.07); s.closePath();
  P.add(extrudeXb(s, L, 1, 0.02), M.alu, [0, 0, 0]);
  // machined cam-cover gasket rail
  const rail = roundRect(-L / 2 + 0.02, -tw - 0.04, L / 2 - 0.02, tw + 0.04, 0.08);
  rail.holes.push(roundRect(-L / 2 + 0.10, -tw + 0.04, L / 2 - 0.10, tw - 0.04, 0.05));
  P.add(extrudeY(rail, 0.025, 12, 0.006), M.aluMach, [0, ht - 0.005, 0]);
  // flank ribs + bosses between ports
  [-1, 1].forEach(side => {
    P.add(G.rbox(L - 0.3, 0.05, 0.05, 0.02), M.alu, [0, 3.20, side * (hw + 0.012)]);
    [-2.2, -1.1, 0, 1.1, 2.2].forEach(x => P.add(G.rbox(0.10, ht - hb - 0.32, 0.06, 0.025), M.alu, [x * 0.99, (hb + ht) / 2 - 0.04, side * (hw + 0.012)]));
  });
  // pent-roof chamber roofs (dark, visible from below / in the cut)
  CYL_X.forEach(x => P.add(G.cyl(0.41, 0.41, 0.012, 40), M.soot, [x, hb - 0.004, 0]));
  // port faces: machined pads, intake (−z) and exhaust (+z)
  CYL_X.forEach(x => {
    P.add(G.rbox(0.46, 0.42, 0.05, 0.015), M.aluMach, [x, 2.95, -(hw + 0.03)]);
    P.add(G.cylZ(0.135, 0.004, 28), M.soot, [x, 2.95, -(hw + 0.057)]);
    P.add(G.rbox(0.48, 0.40, 0.03, 0.01), M.aluMach, [x, 2.88, hw + 0.01]);
  });
  // cam carrier: bearing towers + machined caps with bolts
  [-2.2, -1.1, 0, 1.1, 2.2].forEach(x => [-CAM_Z, CAM_Z].forEach(z => {
    P.add(G.rbox(0.18, CAM_Y - ht + 0.02, 0.34, 0.02), M.alu, [x, (CAM_Y + ht) / 2 - 0.01, z]);
    P.add(G.rbox(0.19, 0.13, 0.36, 0.03), M.aluMach, [x, CAM_Y + 0.07, z]);
    [-0.13, 0.13].forEach(dz => P.bolt(M.bolt, [x, CAM_Y + 0.135, z + dz], 'y', 0.026, 0.03));
  }));
  // spark-plug wells with cast bosses
  CYL_X.forEach(x => {
    const ring = new THREE.Shape(); ring.absarc(0, 0, 0.13, 0, Math.PI * 2, false); ring.holes.push(holePath(0, 0, 0.085));
    P.add(extrudeY(ring, 0.07, 32, 0.012), M.alu, [x, ht - 0.01, 0]);
    P.add(G.cyl(0.085, 0.085, 0.10, 24, true), M.soot, [x, ht + 0.0, 0]);
  });
  // head bolts with washers
  [-2.0, -1.1, 0, 1.1, 2.0].forEach(x => [-0.72, 0.72].forEach(z => P.bolt(M.boltDark, [x, ht + 0.012, z], 'y', 0.064, 0.07)));
  // thermostat housing + hose neck at the flywheel end, lifting eyes
  P.add(G.latheX([[0, 0], [0.17, 0], [0.17, 0.05], [0.14, 0.06, 1], [0.13, 0.20, 1], [0.10, 0.22], [0.09, 0.24], [0.09, 0.44], [0.105, 0.46, 1], [0.09, 0.48], [0, 0.48]], 32), M.alu, [-L / 2 + 0.01, 3.05, -0.35], [0, 0, Math.PI]);
  [[-1, -0.48], [1, 0.52]].forEach(([e, z]) => {
    const eye = roundRect(-0.13, ht - 0.25, 0.13, ht + 0.20, 0.06); eye.holes.push(holePath(0, ht + 0.06, 0.06));
    P.add(extrudeXb(eye, 0.05, 20, 0.01), M.fittingDark, [e * (L / 2 + 0.025), 0, z]);
    P.bolt(M.bolt, [e * (L / 2 + 0.05), ht - 0.15, z], e > 0 ? 'x' : '-x', 0.03, 0.025);
  });
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

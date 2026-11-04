/* Деталь «Выпускной коллектор 4-1»: buildExhaust().
 * M-02b: подраздел 6.9 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * M-07b: по прототипу M-07: фланцы со шпильками и медными гайками, сварные швы, лямбда-зонд, фланец приёмной
 * трубы, штампованный теплоэкран по дуге. Осевые линии труб и пути частиц прежние.
 */
import * as THREE from 'three';
import { CYL_X, V3 } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeXb, Parts } from './geometry.js';
import { exhaustPaths } from './intake.js';

/* ---------- 6.9 EXHAUST MANIFOLD (4-1) ---------- */
const COLL = { y: 1.80, z: 1.90 };
function buildExhaust(g) {
  const P = new Parts();
  const outPts = [V3(1.98, COLL.y, COLL.z), V3(2.5, COLL.y - 0.03, COLL.z + 0.17), V3(2.92, COLL.y - 0.1, COLL.z + 0.52)];
  CYL_X.forEach((x, i) => {
    const pts = [V3(x, 2.88, 0.98), V3(x, 2.88, 1.36), V3(x, 2.70, 1.72), V3(x, 2.20, COLL.z), V3(x, COLL.y + 0.05, COLL.z)];
    P.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 56, 0.15, 24, false), M.pipe);
    // port flange: cast plate with studs and copper nuts
    P.add(G.rbox(0.46, 0.38, 0.07, 0.02), M.pipe2, [x, 2.88, 1.0]);
    [-0.17, 0.17].forEach(dx => { P.add(G.cylZ(0.016, 0.10, 8), M.fitting, [x + dx, 2.88 + 0.13 * Math.sign(dx), 1.06]);
      P.add(G.hex(0.034, 0.04).rotateX(Math.PI / 2), M.copper, [x + dx, 2.88 + 0.13 * Math.sign(dx), 1.055]); });
    const path = [V3(x, 2.34, 0.08), V3(x, 2.60, 0.27), V3(x, 2.80, 0.6), ...pts.slice(0, 4), V3(x, COLL.y, COLL.z)];
    for (let px = x + 0.45; px < 1.95; px += 0.5) path.push(V3(px, COLL.y, COLL.z));
    path.push(...outPts, V3(3.35, COLL.y - 0.2, COLL.z + 0.95), V3(3.7, COLL.y - 0.25, COLL.z + 1.4));
    exhaustPaths[i] = new THREE.CatmullRomCurve3(path, false, 'centripetal');
  });
  P.add(G.cylX(0.24, 4.05, 40), M.pipe2, [-0.03, COLL.y, COLL.z]);
  P.add(new THREE.SphereGeometry(0.24, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2), M.pipe2, [-2.05, COLL.y, COLL.z]);
  [-1.1, 0, 1.1].forEach(x => P.add(G.torusX(0.243, 0.012, 6, 40), M.pipe2, [x, COLL.y, COLL.z]));   // weld beads
  // oxygen sensor on the collector
  const toZ = geo => geo.rotateX(Math.PI / 2);
  P.add(toZ(G.cyl(0.06, 0.06, 0.05, 20)), M.pipe2, [1.25, COLL.y, COLL.z + 0.25]);
  P.add(toZ(G.hex(0.055, 0.05)), M.fitting, [1.25, COLL.y, COLL.z + 0.30]);
  P.add(G.latheZ([[0, 0], [0.035, 0], [0.04, 0.06], [0.04, 0.14], [0.025, 0.16], [0, 0.16]], 16), M.fitting, [1.25, COLL.y, COLL.z + 0.32]);
  P.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(1.25, COLL.y, COLL.z + 0.48), V3(1.3, COLL.y + 0.05, COLL.z + 0.62), V3(1.5, COLL.y + 0.25, COLL.z + 0.66)]), 12, 0.012, 6), M.wire);
  const outCurve = new THREE.CatmullRomCurve3(outPts);
  P.add(new THREE.TubeGeometry(outCurve, 30, 0.22, 28, false), M.pipe2);
  const end = outCurve.getPoint(1), dir = outCurve.getTangent(1).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir);
  const fl = G.rbox(0.62, 0.07, 0.42, 0.03);
  fl.applyQuaternion(q);
  P.add(fl, M.pipe2, [end.x, end.y, end.z]);
  [-0.24, 0.24].forEach(dx => { const st = G.hex(0.038, 0.06).translate(dx, 0.06, 0); st.applyQuaternion(q); P.add(st, M.copper, [end.x, end.y, end.z]); });
  // stamped heat shield over the primaries (arc band, u = −z, v = y)
  const R0 = 0.70, cz = 1.30, cy = 2.45, a0 = 62 * Math.PI / 180, a1 = 112 * Math.PI / 180;
  const hs = new THREE.Shape();
  hs.absarc(-cz, cy, R0 + 0.025, Math.PI - a0, Math.PI - a1, true);
  hs.absarc(-cz, cy, R0, Math.PI - a1, Math.PI - a0, false);
  P.add(extrudeXb(hs, 3.8, 24, 0.008), M.shield, [-0.05, 0, 0]);
  [-1.6, -0.55, 0.55, 1.6].forEach(x => P.add(new THREE.TorusGeometry(R0 + 0.02, 0.012, 6, 24, a1 - a0).rotateZ(a0).rotateY(-Math.PI / 2), M.shield, [x * 1.08, cy, cz]));
  [-1.8, 1.8].forEach(x => P.bolt(M.bolt, [x, cy + Math.sin(a1 - 0.08) * (R0 + 0.025), cz + Math.cos(a1 - 0.08) * (R0 + 0.025)], 'y', 0.03, 0.025));
  P.build(g, g);
  g.userData.anchor.set(-1.1, 2.95, 1.6);
}

export { buildExhaust };

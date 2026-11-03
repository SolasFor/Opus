/* Деталь «Выпускной коллектор 4-1»: buildExhaust().
 * M-02b: подраздел 6.9 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { CYL_X, V3 } from '../world.js';
import { M } from '../materials.js';
import { G, Parts } from './geometry.js';
import { exhaustPaths } from './intake.js';

/* ---------- 6.9 EXHAUST MANIFOLD (4-1) ---------- */
const COLL = { y: 1.80, z: 1.90 };
function buildExhaust(g) {
  const P = new Parts();
  const outPts = [V3(1.98, COLL.y, COLL.z), V3(2.5, COLL.y - 0.03, COLL.z + 0.17), V3(2.92, COLL.y - 0.1, COLL.z + 0.52)];
  CYL_X.forEach((x, i) => {
    const pts = [V3(x, 2.88, 0.98), V3(x, 2.88, 1.36), V3(x, 2.70, 1.72), V3(x, 2.20, COLL.z), V3(x, COLL.y + 0.05, COLL.z)];
    P.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.15, 12, false), M.pipe);
    P.add(G.box(0.42, 0.36, 0.07), M.pipe2, [x, 2.88, 1.0]);
    const path = [V3(x, 2.34, 0.08), V3(x, 2.60, 0.27), V3(x, 2.80, 0.6), ...pts.slice(0, 4), V3(x, COLL.y, COLL.z)];
    for (let px = x + 0.45; px < 1.95; px += 0.5) path.push(V3(px, COLL.y, COLL.z));
    path.push(...outPts, V3(3.35, COLL.y - 0.2, COLL.z + 0.95), V3(3.7, COLL.y - 0.25, COLL.z + 1.4));
    exhaustPaths[i] = new THREE.CatmullRomCurve3(path, false, 'centripetal');
  });
  P.add(G.cylX(0.24, 4.05, 28), M.pipe2, [-0.03, COLL.y, COLL.z]);
  P.add(new THREE.SphereGeometry(0.24, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2), M.pipe2, [-2.05, COLL.y, COLL.z]);
  const outCurve = new THREE.CatmullRomCurve3(outPts);
  P.add(new THREE.TubeGeometry(outCurve, 18, 0.22, 14, false), M.pipe2);
  const end = outCurve.getPoint(1), dir = outCurve.getTangent(1).normalize();
  const fl = G.cyl(0.32, 0.32, 0.07, 28);
  fl.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir));
  P.add(fl, M.pipe2, [end.x, end.y, end.z]);
  // heat shield bracket
  P.add(G.box(3.6, 0.04, 0.5), M.pipe2, [-0.05, 2.98, 1.38], [0.5, 0, 0]);
  P.build(g, g);
  g.userData.anchor.set(-1.1, 2.95, 1.6);
}

export { buildExhaust };

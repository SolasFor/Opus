/* Деталь «Впускной коллектор»: buildIntake(); пути газа впуска и выпуска intakePaths и exhaustPaths.
 * M-02b: подраздел 6.8 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { CYL_X, V3 } from '../world.js';
import { M } from '../materials.js';
import { G, Parts } from './geometry.js';

/* ---------- 6.8 INTAKE MANIFOLD ---------- */
const intakePaths = [], exhaustPaths = [];
const PLEN = { y: 3.48, z: -2.05, r: 0.30, x0: -2.15, x1: 2.15 };
function buildIntake(g) {
  const P = new Parts();
  P.add(G.cylX(PLEN.r, PLEN.x1 - PLEN.x0, 32), M.plastic, [(PLEN.x0 + PLEN.x1) / 2, PLEN.y, PLEN.z]);
  P.add(new THREE.SphereGeometry(PLEN.r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2), M.plastic, [PLEN.x1, PLEN.y, PLEN.z], null, [0.4, 1, 1]);
  [PLEN.x0 + 0.1, 0, PLEN.x1 - 0.1].forEach(x => P.add(G.torusX(PLEN.r + 0.005, 0.02, 6, 32), M.plastic, [x, PLEN.y, PLEN.z]));
  // throttle body + intake snorkel
  P.add(G.cylX(0.22, 0.30, 28), M.alu, [PLEN.x0 - 0.15, PLEN.y, PLEN.z]);
  P.add(G.cylX(0.26, 0.05, 28), M.alu, [PLEN.x0 - 0.02, PLEN.y, PLEN.z]);
  P.add(G.box(0.16, 0.16, 0.12), M.plastic, [PLEN.x0 - 0.15, PLEN.y + 0.22, PLEN.z]);
  P.add(G.cylX(0.20, 0.35, 28), M.rubber, [PLEN.x0 - 0.47, PLEN.y, PLEN.z]);
  for (let k = 0; k < 4; k++) P.add(G.torusX(0.205, 0.015, 6, 28), M.rubber, [PLEN.x0 - 0.35 - k * 0.08, PLEN.y, PLEN.z]);
  CYL_X.forEach((x, i) => {
    const pts = [V3(x, PLEN.y - 0.05, PLEN.z + 0.15), V3(x, 3.30, -1.75), V3(x, 3.06, -1.42), V3(x, 2.96, -1.06)];
    P.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 24, 0.13, 14, false), M.plastic);
    P.add(G.box(0.40, 0.36, 0.07), M.plastic, [x, 2.95, -1.05]);
    // particle path: snorkel → plenum → runner → port → valve throat → chamber
    const path = [V3(PLEN.x0 - 0.75, PLEN.y, PLEN.z), V3(PLEN.x0 - 0.2, PLEN.y, PLEN.z)];
    for (let px = PLEN.x0 + 0.3; px < x - 0.25; px += 0.5) path.push(V3(px, PLEN.y, PLEN.z));
    path.push(V3(x, PLEN.y + 0.02, PLEN.z + 0.02), V3(x, 3.30, -1.75), V3(x, 3.06, -1.42), V3(x, 2.95, -1.0),
      V3(x, 2.80, -0.58), V3(x, 2.60, -0.27), V3(x, 2.34, -0.08));
    intakePaths[i] = new THREE.CatmullRomCurve3(path, false, 'centripetal');
  });
  P.build(g, g);
  g.userData.anchor.set(-0.6, PLEN.y + 0.35, PLEN.z);
}

export { intakePaths, exhaustPaths, buildIntake };

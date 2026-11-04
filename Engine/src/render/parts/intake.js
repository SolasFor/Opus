/* Деталь «Впускной коллектор»: buildIntake(); пути газа впуска и выпуска intakePaths и exhaustPaths.
 * M-02b: подраздел 6.8 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * M-07b: по прототипу M-07: рёбра ресивера, литой дроссельный узел с приводом и болтами, гофрированный патрубок
 * с хомутом, общий фланец с болтами, топливная рампа с форсунками. Осевые линии труб и пути частиц прежние.
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
  P.add(G.cylX(PLEN.r, PLEN.x1 - PLEN.x0, 48), M.plastic, [(PLEN.x0 + PLEN.x1) / 2, PLEN.y, PLEN.z]);
  // moulded ribs and mounting bosses on the plenum
  for (let k = 0; k < 6; k++) P.add(G.torusX(PLEN.r, 0.014, 6, 48), M.plastic, [PLEN.x0 + 0.42 + k * 0.67, PLEN.y, PLEN.z]);
  P.add(G.rbox(PLEN.x1 - PLEN.x0 - 0.2, 0.035, 0.05, 0.015), M.plastic, [0, PLEN.y + PLEN.r + 0.01, PLEN.z]);
  P.add(new THREE.SphereGeometry(PLEN.r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2), M.plastic, [PLEN.x1, PLEN.y, PLEN.z], null, [0.4, 1, 1]);
  [PLEN.x0 + 0.1, 0, PLEN.x1 - 0.1].forEach(x => P.add(G.torusX(PLEN.r + 0.005, 0.02, 8, 48), M.plastic, [x, PLEN.y, PLEN.z]));
  // throttle body (cast, machined flanges, motor housing) + rubber intake boot
  P.add(G.latheX([[0, 0], [0.27, 0], [0.27, 0.05], [0.22, 0.05], [0.22, 0.25], [0.25, 0.25], [0.25, 0.30], [0, 0.30]], 40).rotateZ(Math.PI), M.aluCast, [PLEN.x0 + 0.0, PLEN.y, PLEN.z]);
  P.add(G.rbox(0.20, 0.17, 0.14, 0.03), M.paintBlack, [PLEN.x0 - 0.15, PLEN.y + 0.24, PLEN.z - 0.02]);
  P.add(G.rbox(0.07, 0.10, 0.05, 0.012), M.paintBlack, [PLEN.x0 - 0.15, PLEN.y + 0.22, PLEN.z + 0.24]);
  [[0.17, 0.17], [-0.17, 0.17], [0.17, -0.17], [-0.17, -0.17]].forEach(([dy, dz]) => P.bolt(M.bolt, [PLEN.x0 - 0.05, PLEN.y + dy, PLEN.z + dz], '-x', 0.025, 0.025));
  P.add(G.latheX([[0, 0], [0.20, 0], [0.205, 0.04], [0.21, 0.06, 1], [0.225, 0.08, 1], [0.21, 0.10, 1], [0.225, 0.12, 1], [0.21, 0.14, 1], [0.225, 0.16, 1],
    [0.21, 0.18, 1], [0.225, 0.20, 1], [0.21, 0.22, 1], [0.20, 0.30], [0.21, 0.32], [0.21, 0.37], [0.18, 0.37], [0, 0.37]], 40).rotateZ(Math.PI), M.rubber, [PLEN.x0 - 0.30, PLEN.y, PLEN.z]);
  P.add(G.torusX(0.212, 0.014, 6, 32), M.fitting, [PLEN.x0 - 0.33, PLEN.y, PLEN.z]);
  // common runner flange with bolts, fuel rail with injectors
  P.add(G.rbox(4.10, 0.40, 0.07, 0.025), M.aluCast, [0, 2.95, -1.05]);
  [-1.95, -1.1, 0, 1.1, 1.95].forEach(x => [-0.14, 0.14].forEach(dy => P.bolt(M.bolt, [x, 2.95 + dy, -1.085], '-z', 0.032, 0.03)));
  P.add(G.rbox(3.70, 0.075, 0.075, 0.02), M.fitting, [0, 3.42, -1.22]);
  P.add(G.cylX(0.03, 0.30, 16), M.fitting, [-2.0, 3.42, -1.22]);
  [-1.1, 1.1].forEach(x => { P.add(G.rbox(0.06, 0.30, 0.16, 0.012), M.aluCast, [x, 3.27, -1.16]); P.bolt(M.bolt, [x, 3.46, -1.22], 'y', 0.025, 0.02); });
  CYL_X.forEach((x, i) => {
    const pts = [V3(x, PLEN.y - 0.05, PLEN.z + 0.15), V3(x, 3.30, -1.75), V3(x, 3.06, -1.42), V3(x, 2.96, -1.06)];
    P.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 40, 0.13, 24, false), M.plastic);
    P.add(G.latheZ([[0, 0], [0.16, 0], [0.16, 0.04], [0.135, 0.05], [0, 0.05]], 32), M.plastic, [x, 2.955, -1.135]);
    // injector: O-ring, body, connector
    P.add(G.lathe([[0, 0], [0.028, 0], [0.028, 0.06], [0.04, 0.07], [0.045, 0.16, 1], [0.05, 0.19], [0.05, 0.25], [0.036, 0.26], [0, 0.26]], 20), M.paintBlack, [x, 3.13, -1.22]);
    P.add(G.torusY(0.03, 0.008, 6, 16), M.rubber, [x, 3.15, -1.22]);
    P.add(G.rbox(0.07, 0.06, 0.09, 0.012), M.paintBlack, [x, 3.33, -1.30]);
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

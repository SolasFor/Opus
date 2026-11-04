/* Деталь «Поршни»: buildPistons().
 * M-02b: подраздел 6.4 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import { M } from '../materials.js';
import { G, Parts } from './geometry.js';

/* ---------- 6.4 PISTONS (InstancedMesh ×4) ---------- */
let pistonMeshes = [];
function buildPistons(g) {
  const P = new Parts();
  P.add(G.cyl(0.40, 0.40, 0.50, 32), M.aluLight, [0, -0.03, 0]);
  P.add(G.cyl(0.39, 0.37, 0.07, 32), M.aluLight, [0, -0.315, 0]);
  P.add(G.cyl(0.40, 0.40, 0.03, 32), M.aluLight, [0, 0.215, 0]);
  P.add(G.cyl(0.27, 0.30, 0.016, 28), M.aluDark, [0, 0.236, 0]);            // crown bowl
  P.add(G.cyl(0.418, 0.418, 0.035, 32), M.rings, [0, 0.175, 0]);
  P.add(G.cyl(0.418, 0.418, 0.035, 32), M.rings, [0, 0.125, 0]);
  P.add(G.cyl(0.420, 0.420, 0.05, 32), M.rings, [0, 0.06, 0]);
  P.add(G.cylX(0.085, 0.70, 18), M.chrome, [0, 0, 0]);
  P.add(G.cylX(0.12, 0.08, 18), M.aluDark, [0.30, 0, 0]);
  P.add(G.cylX(0.12, 0.08, 18), M.aluDark, [-0.30, 0, 0]);
  pistonMeshes = P.instanced(g, g, 4);
  g.userData.anchor.set(-0.55, 2.4, 0.4);
}

export { pistonMeshes, buildPistons };

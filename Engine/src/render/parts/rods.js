/* Деталь «Шатуны»: buildRods().
 * M-02b: подраздел 6.3 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import { CRANK_Y, ROD_L } from '../../config/engine-spec.js';
import { M } from '../materials.js';
import { G, Parts } from './geometry.js';

/* ---------- 6.3 RODS (InstancedMesh ×4) ---------- */
let rodMeshes = [];
function buildRods(g) {
  const P = new Parts();
  P.add(G.torusX(0.20, 0.08, 10, 26), M.steel);
  P.add(G.box(0.15, 0.13, 0.50), M.steel, [0, -0.24, 0]);
  [-0.2, 0.2].forEach(z => P.add(G.cyl(0.03, 0.03, 0.2, 8), M.chrome, [0.0, -0.25, z]));
  P.add(G.box(0.10, 0.80, 0.08), M.steel, [0, 0.66, 0.08]);          // I-beam flanges
  P.add(G.box(0.10, 0.80, 0.08), M.steel, [0, 0.66, -0.08]);
  P.add(G.box(0.05, 0.80, 0.16), M.steel, [0, 0.66, 0]);
  P.add(G.box(0.12, 0.14, 0.34), M.steel, [0, 0.22, 0]);
  P.add(G.torusX(0.11, 0.06, 10, 22), M.steel, [0, ROD_L, 0]);
  P.add(G.cylX(0.06, 0.12, 14), M.brass, [0, ROD_L, 0]);
  P.add(G.cylX(0.125, 0.10, 18), M.brass, [0, 0, 0]);
  rodMeshes = P.instanced(g, g, 4);
  g.userData.anchor.set(0.55, CRANK_Y + 1.0, 0.5);
}

export { rodMeshes, buildRods };

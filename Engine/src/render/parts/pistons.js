/* Деталь «Поршни»: buildPistons().
 * M-02b: подраздел 6.4 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * M-07c: по прототипу M-07 в тех же размерах: точёный поршень — купол с нагаром, канавки с кольцами (два
 * компрессионных, маслосъёмное из двух дисков), юбка «слиппер» по сторонам упора с открытыми бобышками пальца,
 * стопорные кольца пальца (материал колец).
 */
import { M } from '../materials.js';
import { G, Parts } from './geometry.js';

/* ---------- 6.4 PISTONS (InstancedMesh ×4) ---------- */
let pistonMeshes = [];
const RING = [[0.162, 0.192], [0.110, 0.140], [0.0425, 0.0875]];   // канавки колец: [низ, верх] от оси пальца
function buildPistons(g) {
  const P = new Parts();
  // crown + ring belt (origin at the pin axis)
  const pr = [[0, 0.11], [0.26, 0.085, 1], [0.37, 0.02], [0.40, 0.02]];
  RING.slice().reverse().forEach(([a, b]) => pr.push([0.40, a], [0.372, a], [0.372, b], [0.40, b]));
  pr.push([0.40, 0.212], [0.396, 0.226, 1], [0.37, 0.234, 1], [0.25, 0.241, 1], [0, 0.245, 1]);
  P.add(G.lathe(pr, 48), M.piston);
  P.add(G.cyl(0.29, 0.30, 0.006, 40), M.soot, [0, 0.2425, 0]);                // carbon on the crown, top 0.2455
  // rings: compression ×2, oil ring (two rails)
  RING.forEach(([a, b], i) => {
    const ro = 0.418, ri = 0.374;
    if (i < 2) P.add(G.lathe([[ri, a + 0.002], [ro, a + 0.002], [ro, b - 0.002], [ri, b - 0.002]], 48), M.rings);
    else [a + 0.002, b - 0.012].forEach(y => P.add(G.lathe([[ri, y], [ro, y], [ro, y + 0.01], [ri, y + 0.01]], 48), M.rings));
  });
  // slipper skirt on the thrust sides (±z), open at the pin bosses (±x)
  const sk = [[0.372, -0.35], [0.398, -0.35], [0.398, 0.021], [0.372, 0.021], [0.372, -0.35]];
  [-0.95, Math.PI - 0.95].forEach(p0 => P.add(G.lathe(sk, 20, p0, 1.9), M.piston));
  // pin bosses + struts to the crown, circlips
  [-1, 1].forEach(sx => {
    P.add(G.cylX(0.12, 0.09, 24), M.piston, [sx * 0.29, 0, 0]);
    P.add(G.rbox(0.09, 0.14, 0.24, 0.03), M.piston, [sx * 0.29, 0.06, 0]);
    P.add(G.cylX(0.088, 0.012, 20), M.rings, [sx * 0.345, 0, 0]);
  });
  P.add(G.cylX(0.085, 0.68, 24), M.chrome, [0, 0, 0]);
  pistonMeshes = P.instanced(g, g, 4);
  g.userData.anchor.set(-0.55, 2.4, 0.4);
}

export { pistonMeshes, buildPistons };

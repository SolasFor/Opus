/* Деталь «Свечи зажигания»: buildSparks().
 * M-02b: подраздел 6.7 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import { CYL_X, HEAD_BOT, HEAD_TOP } from '../world.js';
import { M } from '../materials.js';
import { G, Parts } from './geometry.js';

/* ---------- 6.7 SPARK PLUGS ---------- */
function buildSparks(g) {
  const P = new Parts();
  CYL_X.forEach(x => {
    P.add(G.cyl(0.012, 0.012, 0.04, 6), M.chrome, [x, HEAD_BOT - 0.03, 0]);
    P.add(G.cyl(0.045, 0.045, 0.16, 12), M.steel, [x, HEAD_BOT + 0.07, 0]);
    P.add(G.cyl(0.055, 0.055, 0.70, 12), M.steelDark, [x, HEAD_BOT + 0.50, 0]);
    P.add(G.cyl(0.085, 0.085, 0.10, 6), M.steel, [x, HEAD_TOP - 0.02, 0]);
    P.add(G.cyl(0.055, 0.045, 0.36, 18), M.ceramic, [x, HEAD_TOP + 0.21, 0]);
    for (let k = 0; k < 4; k++) P.add(G.torusY(0.055, 0.008, 4, 18), M.ceramic, [x, HEAD_TOP + 0.10 + k * 0.06, 0]);
    P.add(G.cyl(0.03, 0.03, 0.08, 10), M.chrome, [x, HEAD_TOP + 0.43, 0]);
  });
  P.build(g, g);
  g.userData.anchor.set(0.55, HEAD_TOP + 0.5, 0);
}

export { buildSparks };

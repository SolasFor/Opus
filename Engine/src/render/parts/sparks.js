/* Деталь «Свечи зажигания»: buildSparks().
 * M-02b: подраздел 6.7 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * M-07c: по прототипу M-07 в тех же размерах: центральный и боковой электроды, корпус с витками резьбы,
 * шестигранник с завальцовкой, ребристый изолятор, контактная гайка.
 */
import { CYL_X, HEAD_BOT, HEAD_TOP } from '../world.js';
import { M } from '../materials.js';
import { G, Parts } from './geometry.js';

/* ---------- 6.7 SPARK PLUGS ---------- */
function buildSparks(g) {
  const P = new Parts();
  const ins = [[0.040, HEAD_TOP + 0.03]];
  for (let k = 0; k < 5; k++) { const y = HEAD_TOP + 0.08 + k * 0.05; ins.push([0.048, y - 0.02, 1], [0.056, y, 1], [0.048, y + 0.02, 1]); }
  ins.push([0.042, HEAD_TOP + 0.37, 1], [0.03, HEAD_TOP + 0.40], [0, HEAD_TOP + 0.40]);
  CYL_X.forEach(x => {
    P.add(G.cyl(0.010, 0.010, 0.05, 8), M.steel, [x, HEAD_BOT - 0.03, 0]);                 // centre electrode
    P.add(G.box(0.02, 0.012, 0.05), M.steel, [x, HEAD_BOT - 0.055, 0.02]);                  // ground strap
    P.add(G.cyl(0.045, 0.045, 0.16, 16), M.steel, [x, HEAD_BOT + 0.07, 0]);                 // threaded shell
    for (let k = 0; k < 6; k++) P.add(G.torusY(0.045, 0.005, 4, 16), M.steel, [x, HEAD_BOT + 0.01 + k * 0.022, 0]);
    P.add(G.cyl(0.055, 0.055, 0.70, 16), M.steelDark, [x, HEAD_BOT + 0.50, 0]);
    P.add(G.hex(0.085, 0.09), M.steel, [x, HEAD_TOP - 0.025, 0]);
    P.add(G.cyl(0.07, 0.07, 0.03, 20), M.steel, [x, HEAD_TOP + 0.03, 0]);                   // crimped shell edge
    P.add(G.lathe(ins, 28).translate(x, 0, 0), M.ceramic);
    P.add(G.cyl(0.026, 0.03, 0.06, 14), M.steel, [x, HEAD_TOP + 0.43, 0]);
    P.add(G.cyl(0.034, 0.034, 0.025, 14), M.steel, [x, HEAD_TOP + 0.45, 0]);
  });
  P.build(g, g);
  g.userData.anchor.set(0.55, HEAD_TOP + 0.5, 0);
}

export { buildSparks };

/* Деталь «Блок цилиндров»: buildBlock().
 * M-02b: подраздел 6.1 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { BORE_R } from '../../config/engine-spec.js';
import { CYL_X, BLOCK_Y0, CRANK_TOP, DECK_Y } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeY, Parts } from './geometry.js';

/* ---------- 6.1 BLOCK ---------- */
function buildBlock(g) {
  const P = new Parts();
  // cylinder bank: rounded rectangle with 4 bores, extruded upward (real holes → visible pistons in the cut)
  const W = 2.35, D = 0.95, r = 0.12;
  const s = new THREE.Shape();
  s.moveTo(-W + r, -D); s.lineTo(W - r, -D); s.quadraticCurveTo(W, -D, W, -D + r); s.lineTo(W, D - r);
  s.quadraticCurveTo(W, D, W - r, D); s.lineTo(-W + r, D); s.quadraticCurveTo(-W, D, -W, D - r); s.lineTo(-W, -D + r);
  s.quadraticCurveTo(-W, -D, -W + r, -D);
  CYL_X.forEach(x => { const h = new THREE.Path(); h.absarc(x, 0, BORE_R, 0, Math.PI * 2, true); s.holes.push(h); });
  P.add(extrudeY(s, DECK_Y - CRANK_TOP, 40), M.aluCast, [0, CRANK_TOP, 0]);
  // water-jacket ribs on both flanks
  [-1, 1].forEach(side => {
    [1.35, 1.85].forEach(y => P.add(G.box(4.5, 0.06, 0.05), M.aluCast, [0, y, side * (D + 0.02)]));
    CYL_X.forEach(x => P.add(G.cyl(0.36, 0.36, DECK_Y - CRANK_TOP - 0.16, 28, false), M.aluCast,
      [x, (CRANK_TOP + DECK_Y) / 2, side * 0.62], null, [1, 1, 0.55]));
  });
  // crankcase: walls, end plates, skirt flare, bottom plate
  [-1, 1].forEach(side => {
    P.add(G.box(4.7, 1.30, 0.10), M.iron, [0, 0.35, side * 0.90]);
    for (let i = 0; i < 6; i++) P.add(G.box(0.07, 1.1, 0.08), M.iron, [-2.0 + i * 0.8, 0.35, side * 0.98]);
    P.add(G.box(4.8, 0.10, 0.22), M.iron, [0, -0.25, side * 0.92]);
    P.add(G.cyl(0.13, 0.13, 0.22, 16), M.iron, [-1.6, 0.25, side * 1.02], [Math.PI / 2, 0, 0]);   // mount bosses
    P.add(G.cyl(0.13, 0.13, 0.22, 16), M.iron, [1.6, 0.25, side * 1.02], [Math.PI / 2, 0, 0]);
  });
  [-2.30, 2.30].forEach(x => P.add(G.box(0.10, 1.30, 1.90), M.iron, [x, 0.35, 0]));
  P.add(G.box(4.7, 0.14, 1.90), M.iron, [0, BLOCK_Y0 + 0.07, 0]);
  // main bearing bulkheads + caps (inside, visible in the cut)
  [-2.2, -1.1, 0, 1.1, 2.2].forEach(x => {
    P.add(G.box(0.26, 0.42, 1.7), M.iron, [x, 0.80, 0]);
    P.add(G.box(0.28, 0.42, 1.10), M.steelDark, [x, 0.17, 0]);
  });
  // oil filter (blue) + dipstick handle (red): small colour accents
  P.add(G.cylZ(0.17, 0.34, 28), M.paintBlue, [0.95, 0.30, -1.12]);
  P.add(G.cylZ(0.12, 0.06, 20), M.iron, [0.95, 0.30, -0.95]);
  P.add(G.torusY(0.05, 0.016, 6, 16), M.paintRed, [-0.25, 1.35, -1.08], [Math.PI / 2, 0, 0]);
  P.add(G.cyl(0.012, 0.012, 0.6, 6), M.steel, [-0.25, 1.05, -1.0]);
  P.build(g, g);
  g.userData.anchor.set(-1.2, 1.9, 0.95);
}

export { buildBlock };

/* Деталь «Иридиевые свечи зажигания (12 шт.)»: buildSparks().
 * По 6 свечей в каждом ряду V12: центральный и боковой электроды, керамический изолятор с рёбрами,
 * шестигранник под ключ 16 мм, уплотнительная шайба и контактный наконечник.
 */
import * as THREE from 'three';
import { CRANK_Y, bankAngle, bankSign } from '../../config/engine-spec.js';
import { CYL_X, HEAD_BOT_R } from '../world.js';
import { M } from '../materials.js';
import { G, Parts, registerLocalPart } from './geometry.js';

function buildSparks(g) {
  const y0 = HEAD_BOT_R;

  for (let b = 0; b < 2; b++) {
    const P = new Parts();
    const xs = CYL_X.slice(b * 6, b * 6 + 6);
    const out = bankSign(b);

    xs.forEach(x => {
      // резьбовая часть, медное уплотнительное кольцо и шестигранный корпус
      P.add(G.cyl(0.044, 0.044, 0.24, 16), M.steelDark, [x, y0 + 0.10, 0]);
      P.add(G.cyl(0.056, 0.056, 0.018, 16), M.copper, [x, y0 + 0.22, 0]);
      P.add(G.hex(0.068, 0.14), M.chrome, [x, y0 + 0.30, 0]);

      // ребристый керамический изолятор + контактный стержень + защитный колпачок
      P.add(G.cyl(0.043, 0.046, 0.62, 18), M.ceramic, [x, y0 + 0.68, 0]);
      for (let r = 0; r < 4; r++) P.add(G.cyl(0.050, 0.050, 0.022, 18), M.ceramic, [x, y0 + 0.56 + r * 0.065, 0]);
      P.add(G.cyl(0.016, 0.016, 0.10, 12), M.brass, [x, y0 + 1.03, 0]);
      P.add(G.cyl(0.030, 0.036, 0.045, 16), M.anodizedRed, [x, y0 + 1.08, 0]);

      // центральный и загнутый боковой электрод в камере сгорания
      P.add(G.cyl(0.008, 0.008, 0.05, 10), M.chrome, [x, y0 - 0.02, 0]);
      P.add(G.box(0.012, 0.04, 0.012), M.steel, [x + 0.016, y0 - 0.02, 0]);
      P.add(G.box(0.024, 0.010, 0.012), M.steel, [x + 0.006, y0 - 0.042, 0]);
    });

    const bankGrp = new THREE.Group();
    bankGrp.rotation.x = bankAngle(b);
    g.add(bankGrp);
    P.build(bankGrp, g);
    registerLocalPart(g, bankGrp, [0, CRANK_Y, 0], [0, CRANK_Y + 4.15, out * 2.40]);
  }
  g.userData.anchor.set(-0.425, 3.60, 1.30);
}

export { buildSparks };

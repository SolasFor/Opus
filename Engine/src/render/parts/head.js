/* Деталь «ГБЦ и прокладки V12»: buildHead().
 * Две 24-клапанные алюминиевые головки блока с камерами сгорания, впускными и выпускными портами,
 * постелями распредвалов, свечными колодцами и многослойными прокладками (MLS).
 */
import * as THREE from 'three';
import { BORE_R, CRANK_Y, bankAngle, bankSign } from '../../config/engine-spec.js';
import { CYL_X, MAINS_X, BLOCK_HALF_L, GASKET_R, HEAD_BOT_R, HEAD_TOP_R, CAM_R, CAM_ZL } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeY, Parts, roundRect, holePath, registerLocalPart } from './geometry.js';

function buildHead(g) {
  const W = BLOCK_HALF_L, D = 0.78, r = 0.10;
  const H0 = 0.68; // высота нижнего массива головки (2.08 … 2.76)
  const WALL_H = HEAD_TOP_R - (HEAD_BOT_R + H0);

  for (let b = 0; b < 2; b++) {
    const xs = CYL_X.slice(b * 6, b * 6 + 6);
    const out = bankSign(b);
    const ins = -out;

    // многослойная металлическая прокладка ГБЦ (MLS) с медными огневыми кольцами
    const PG = new Parts();
    const gs = roundRect(-W - 0.02, -D + 0.04, W + 0.02, D - 0.04, r);
    xs.forEach(x => gs.holes.push(holePath(x, 0, BORE_R + 0.008)));
    PG.add(extrudeY(gs, 0.026, 32), M.gasket, [0, GASKET_R, 0]);
    xs.forEach(x => {
      const fr = new THREE.Shape();
      fr.absarc(0, 0, BORE_R + 0.046, 0, Math.PI * 2, false);
      fr.holes.push(holePath(0, 0, BORE_R + 0.006));
      PG.add(extrudeY(fr, 0.029, 32), M.copper, [x, GASKET_R - 0.001, 0]);
    });
    const gk = new THREE.Group();
    gk.rotation.x = bankAngle(b);
    g.add(gk);
    PG.build(gk, g);
    registerLocalPart(g, gk, [0, CRANK_Y, 0], [0, CRANK_Y + 2.04, out * 1.18]);

    // основная литая головка блока + постели 4 распредвалов
    const PH = new Parts();
    const sDeck = roundRect(-W, -D, W, D, r);
    xs.forEach(x => sDeck.holes.push(holePath(x, 0, BORE_R - 0.03)));
    PH.add(extrudeY(sDeck, 0.06, 32, 0.008), M.aluMach, [0, HEAD_BOT_R, 0]);
    PH.add(extrudeY(roundRect(-W, -D, W, D, r), H0 - 0.06, 20, 0.015), M.alu, [0, HEAD_BOT_R + 0.06, 0]);

    // верхняя ванна (рамка ГРМ) до уровня прокладки клапанной крышки HEAD_TOP_R
    const sRim = roundRect(-W, -D, W, D, r);
    sRim.holes.push(roundRect(-W + 0.13, -D + 0.14, W - 0.13, D - 0.14, 0.05));
    PH.add(extrudeY(sRim, WALL_H - 0.02, 18), M.alu, [0, HEAD_BOT_R + H0, 0]);
    PH.add(extrudeY(sRim.clone ? sRim : sRim, 0.025, 16), M.aluMach, [0, HEAD_TOP_R - 0.025, 0]);

    // полусферические/шатровые своды камер сгорания и свечные колодцы
    xs.forEach(x => {
      PH.add(G.cyl(0.41, 0.30, 0.06, 28), M.aluDark, [x, HEAD_BOT_R + 0.03, 0]);
      PH.add(G.cyl(0.11, 0.115, 0.44, 18), M.aluMach, [x, HEAD_BOT_R + H0 + 0.18, 0]);
      PH.add(G.cyl(0.068, 0.068, 0.46, 16), M.dark, [x, HEAD_BOT_R + H0 + 0.18, 0]);

      // впускной канал (в развал V) и выпускной порт (наружу)
      PH.add(G.rbox(0.44, 0.30, 0.16, 0.04), M.aluMach, [x, HEAD_BOT_R + 0.52, ins * (D + 0.01)]);
      PH.add(G.cylZ(0.145, 0.18, 22), M.dark, [x, HEAD_BOT_R + 0.52, ins * D]);
      PH.add(G.rbox(0.42, 0.28, 0.14, 0.04), M.aluMach, [x, HEAD_BOT_R + 0.38, out * (D + 0.01)]);
      PH.add(G.cylZ(0.13, 0.16, 22), M.soot, [x, HEAD_BOT_R + 0.38, out * D]);
    });

    // 7 опор/крышек подшипников распредвалов (между цилиндрами) + шпильки ГБЦ
    MAINS_X.forEach((x, idx) => {
      const capY = CAM_R;
      const saddleH = capY - (HEAD_BOT_R + H0);
      PH.add(G.rbox(0.12, saddleH, D * 1.62, 0.02), M.aluMach, [x, HEAD_BOT_R + H0 + saddleH * 0.5, 0]);
      [-CAM_ZL, CAM_ZL].forEach(cz => {
        PH.add(G.cylX(0.105, 0.13, 20), M.dark, [x, capY, cz]);
        PH.add(G.rbox(0.12, 0.12, 0.26, 0.025), M.aluMach, [x, capY + 0.045, cz]);
        [-0.095, 0.095].forEach(dz => PH.bolt(M.bolt, [x, capY + 0.105, cz + dz], 'y', 0.018, 0.018));
      });
      if (idx > 0 && idx < MAINS_X.length - 1) {
        PH.bolt(M.boltDark, [x, HEAD_BOT_R + H0 + 0.02, -0.24], 'y', 0.028, 0.024);
        PH.bolt(M.boltDark, [x, HEAD_BOT_R + H0 + 0.02,  0.24], 'y', 0.028, 0.024);
      }
    });

    // передний водоотводящий патрубок системы охлаждения
    PH.add(G.rbox(0.18, 0.24, 0.38, 0.04), M.aluCast, [W + 0.06, HEAD_BOT_R + 0.38, ins * 0.32]);
    PH.add(G.cylZ(0.085, 0.20, 20), M.aluMach, [W + 0.06, HEAD_BOT_R + 0.40, ins * 0.52]);

    const bankGrp = new THREE.Group();
    bankGrp.rotation.x = bankAngle(b);
    g.add(bankGrp);
    PH.build(bankGrp, g);
    registerLocalPart(g, bankGrp, [0, CRANK_Y, 0], [0, CRANK_Y + 2.30, out * 1.33]);
  }
  g.userData.anchor.set(0, 3.05, 1.55);
}

export { buildHead };

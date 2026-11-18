/* Деталь «Клапанные крышки ГБЦ (магниевый сплав)»: buildCovers().
 * Две ребристые крышки V12 с покрытием Rosso Corsa crinkle, фрезерованными рёбрами жёсткости,
 * 12 индивидуальными катушками зажигания (COP), маслозаливной горловиной и фланцевыми болтами.
 */
import * as THREE from 'three';
import { CRANK_Y, bankAngle, bankSign } from '../../config/engine-spec.js';
import { BLOCK_HALF_L, HEAD_TOP_R, COVER_TOP_R, CAM_R, CAM_ZL, CYL_X } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeXb, extrudeY, Parts, roundRect, registerLocalPart } from './geometry.js';

function coverArchShape() {
  const s = new THREE.Shape();
  const y0 = HEAD_TOP_R + 0.025, yFl = HEAD_TOP_R + 0.095, yTop = COVER_TOP_R, yVal = 3.16;
  // полый арочный профиль: внутренняя полость над двумя распредвалами освобождает кулачки при поперечном разрезе
  s.moveTo(-0.78, y0);
  s.lineTo(-0.67, y0);
  s.lineTo(-0.65, 3.43);
  s.lineTo(-0.56, yTop - 0.055);
  s.lineTo(-0.31, yTop - 0.055);
  s.lineTo(-0.22, 3.42);
  s.lineTo(-0.18, yVal - 0.05);
  s.lineTo( 0.18, yVal - 0.05);
  s.lineTo( 0.22, 3.42);
  s.lineTo( 0.31, yTop - 0.055);
  s.lineTo( 0.56, yTop - 0.055);
  s.lineTo( 0.65, 3.43);
  s.lineTo( 0.67, y0);
  s.lineTo( 0.78, y0);
  s.lineTo( 0.78, yFl);
  s.lineTo( 0.72, yFl + 0.015);
  s.lineTo( 0.69, 3.44);
  s.lineTo( 0.58, yTop);
  s.lineTo( 0.29, yTop);
  s.lineTo( 0.20, 3.43);
  s.lineTo( 0.15, yVal);
  s.lineTo(-0.15, yVal);
  s.lineTo(-0.20, 3.43);
  s.lineTo(-0.29, yTop);
  s.lineTo(-0.58, yTop);
  s.lineTo(-0.69, 3.44);
  s.lineTo(-0.72, yFl + 0.015);
  s.lineTo(-0.78, yFl);
  s.closePath();
  return s;
}

function buildCovers(g) {
  const W = BLOCK_HALF_L;
  const arch = coverArchShape();

  for (let b = 0; b < 2; b++) {
    const P = new Parts();
    const xs = CYL_X.slice(b * 6, b * 6 + 6);
    const out = bankSign(b);

    // периметральная прокладка крышки ГБЦ (нитрил-бутадиен)
    const gs = roundRect(-W - 0.01, -0.78, W + 0.01, 0.78, 0.09);
    const gi = roundRect(-W + 0.11, -0.66, W - 0.11, 0.66, 0.05);
    gs.holes.push(gi);
    P.add(extrudeY(gs, 0.026, 20), M.rubber, [0, HEAD_TOP_R, 0]);

    // основной полый корпус крышки + торцевые стенки
    P.add(extrudeXb(arch, W * 2 - 0.16, 8, 0.025), M.crinkleRed, [0, 0, 0]);
    [-W + 0.04, W - 0.04].forEach(ex => {
      P.add(G.rbox(0.08, 0.44, 1.48, 0.03), M.crinkleRed, [ex, HEAD_TOP_R + 0.24, 0]);
      [-CAM_ZL, CAM_ZL].forEach(cz => {
        if (ex > 0) P.add(G.cylX(0.155, 0.12, 22), M.rubber, [ex + 0.02, CAM_R, cz]);
        else P.add(G.cylX(0.135, 0.09, 20), M.crinkleRed, [ex, CAM_R, cz]);
      });
    });

    // фрезерованные продольные рёбра жёсткости на куполах распредвалов
    [-CAM_ZL, CAM_ZL].forEach(cz => {
      [-0.08, 0, 0.08].forEach(dz => {
        P.add(G.rbox(W * 1.88, 0.024, 0.032, 0.008), M.aluMach, [0, COVER_TOP_R + 0.026, cz + dz]);
      });
    });

    // карбоновая вставка и 6 индивидуальных катушек зажигания (COP) + жгут проводов
    P.add(G.rbox(W * 1.88, 0.025, 0.25, 0.012), M.carbonWeave, [0, 3.17, 0]);
    P.add(G.cylX(0.036, W * 1.84, 14), M.dark, [0, 3.24, out * 0.12]);
    xs.forEach(x => {
      P.add(G.cyl(0.082, 0.082, 0.09, 20), M.paintBlack, [x, 3.215, 0]);
      P.add(G.rbox(0.15, 0.055, 0.17, 0.025), M.anodizedRed, [x, 3.285, 0]);
      P.add(G.rbox(0.06, 0.04, 0.09, 0.012), M.paintBlack, [x, 3.275, out * 0.09]);
      P.bolt(M.bolt, [x + 0.095, 3.19, -out * 0.08], 'y', 0.022, 0.018);
    });

    // маслозаливная горловина (на правом ряду) и сапун ВКГ (сзади)
    if (b === 1) {
      P.add(G.cyl(0.135, 0.155, 0.10, 24), M.aluMach, [2.75, COVER_TOP_R + 0.05, CAM_ZL]);
      P.add(G.cyl(0.16, 0.16, 0.055, 24), M.anodizedRed, [2.75, COVER_TOP_R + 0.12, CAM_ZL]);
      P.add(G.rbox(0.32, 0.032, 0.08, 0.01), M.aluMach, [2.75, COVER_TOP_R + 0.155, CAM_ZL]);
    }
    P.add(G.cylX(0.055, 0.12, 16), M.anodizedBlue, [-W - 0.05, 3.30, -out * CAM_ZL]);

    // крепёжные болты периметрального фланца
    for (let i = 0; i < 8; i++) {
      const bx = -2.94 + i * 0.84;
      [-0.73, 0.73].forEach(bz => P.bolt(M.bolt, [bx, HEAD_TOP_R + 0.105, bz], 'y', 0.026, 0.025));
    }

    const bankGrp = new THREE.Group();
    bankGrp.rotation.x = bankAngle(b);
    g.add(bankGrp);
    P.build(bankGrp, g);
    registerLocalPart(g, bankGrp, [0, CRANK_Y, 0], [0, CRANK_Y + 3.60, out * 2.08]);
  }
  g.userData.anchor.set(0, 3.85, 1.80);
}

export { buildCovers };

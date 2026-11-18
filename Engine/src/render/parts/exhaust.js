/* Деталь «Выпускной коллектор 6-в-1 (Inconel / титан)»: buildExhaust().
 * Два раздельных 6-канальных коллектора «паук» для рядов A (−30°) и B (+30°) с медными гайками,
 * сводными конусами 6-в-1, датчиками λ-зонд, термоэкранами и титановыми патрубками.
 */
import * as THREE from 'three';
import { bankOf, bankSign } from '../../config/engine-spec.js';
import { CYL_X, HEAD_BOT_R, V3, bankPoint, bankQuat } from '../world.js';
import { M } from '../materials.js';
import { G, Parts, registerLocalPart } from './geometry.js';

const exhaustPaths = [];

function buildExhaust(g) {
  exhaustPaths.length = 0;
  const flQ = [bankQuat(0), bankQuat(1)];

  for (let b = 0; b < 2; b++) {
    const P = new Parts();
    const out = bankSign(b);
    const eFl = new THREE.Euler().setFromQuaternion(flQ[b]);
    const xCol = -2.18;
    const zCol = out * 2.36;
    const yCol = 0.98;

    let k = 0;
    for (let c = 0; c < 12; c++) {
      if (bankOf(c) !== b) continue;
      const cx = CYL_X[c];
      const pPort = bankPoint(b, cx, HEAD_BOT_R + 0.38, out * 0.79);
      const pExit = bankPoint(b, cx, HEAD_BOT_R + 0.34, out * 1.42);
      const pBend = V3(cx - 0.58 - k * 0.04, 1.50, out * (2.52 - k * 0.015));
      const pInto = V3(xCol + 0.15, yCol + ((k % 2) - 0.5) * 0.09, zCol + out * ((Math.floor(k / 2) - 1) * 0.065));

      P.add(G.tube(new THREE.CatmullRomCurve3([pPort, pExit, pBend, pInto]), 18, 0.105, 14), M.pipe);

      // овальный фланец к ГБЦ и две медные крепёжные гайки
      P.add(G.rbox(0.40, 0.25, 0.055, 0.03), M.aluDark, [pPort.x, pPort.y, pPort.z], [eFl.x, eFl.y, eFl.z]);
      const pN1 = bankPoint(b, cx - 0.14, HEAD_BOT_R + 0.38, out * 0.82);
      const pN2 = bankPoint(b, cx + 0.14, HEAD_BOT_R + 0.38, out * 0.82);
      P.add(G.hex(0.028, 0.035), M.copper, [pN1.x, pN1.y, pN1.z], [eFl.x + Math.PI / 2, eFl.y, eFl.z]);
      P.add(G.hex(0.028, 0.035), M.copper, [pN2.x, pN2.y, pN2.z], [eFl.x + Math.PI / 2, eFl.y, eFl.z]);

      exhaustPaths[c] = new THREE.CatmullRomCurve3([
        bankPoint(b, cx, HEAD_BOT_R + 0.25, out * 0.35),
        pPort, pExit, pBend, pInto,
        V3(-3.35, yCol, zCol),
        V3(-4.18, yCol - 0.02, zCol)
      ]);
      k++;
    }

    // сводной коллектор 6-в-1 (хвостовик уходит к −X), V-band хомуты, резонатор и λ-зонд
    P.add(G.latheX([
      [0.23,  0.22], [0.15, -0.35], [0.15, -0.72], [0.22, -0.90],
      [0.22, -1.55], [0.15, -1.70], [0.15, -2.00], [0.13, -2.00], [0.13, -1.80]
    ], 28), M.pipe2, [xCol, yCol, zCol]);
    [-2.53, -3.95].forEach(vx => P.add(G.torusX(0.165, 0.015, 8, 24), M.aluMach, [vx, yCol, zCol]));
    P.add(G.cyl(0.032, 0.032, 0.16, 12), M.steel, [-2.72, yCol + 0.20, zCol]);
    P.add(G.cyl(0.042, 0.042, 0.04, 12), M.ceramic, [-2.72, yCol + 0.28, zCol]);

    // верхний теплозащитный экран над первичными трубами
    P.add(G.rbox(4.80, 0.03, 0.44, 0.02), M.shield, [-0.25, 2.06, out * 2.52], [-out * 0.48, 0, 0]);

    const bankGrp = new THREE.Group();
    g.add(bankGrp);
    P.build(bankGrp, g);
    registerLocalPart(g, bankGrp, [0, 0, 0], [0, -0.20, out * 2.40]);
  }
  g.userData.anchor.set(-0.35, 1.65, 2.52);
}

export { exhaustPaths, buildExhaust };

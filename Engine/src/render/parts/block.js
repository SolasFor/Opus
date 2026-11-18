/* Деталь «Блок цилиндров V12 и сухой картер»: buildBlock().
 * 60° V12 с глубокой юбкой картера, 7 коренными опорами, хонингованными гильзами Nikasil,
 * оребрённым поддоном сухого картера и навесным оборудованием (генератор, помпа, компрессор A/C, стартер).
 */
import * as THREE from 'three';
import { BORE_R, CRANK_Y, bankAngle, bankSign } from '../../config/engine-spec.js';
import { CYL_X, MAINS_X, BLOCK_HALF_L, BANK_R0, DECK_R } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeXb, extrudeY, extrudeZ, Parts, roundRect, holePath, poly } from './geometry.js';
import { buildAccessories } from './accessories.js';

const PAN_Y = -0.22;

function bankMatrix(b) {
  return new THREE.Matrix4().makeTranslation(0, CRANK_Y, 0)
    .multiply(new THREE.Matrix4().makeRotationX(bankAngle(b)));
}

function addToBank(P, geo, mat, bm, pos, rot, scl) {
  const g = geo.clone ? geo : geo;
  if (pos || rot || scl) {
    const m = new THREE.Matrix4().compose(
      pos ? new THREE.Vector3(...pos) : new THREE.Vector3(),
      new THREE.Quaternion().setFromEuler(rot ? new THREE.Euler(...rot) : new THREE.Euler()),
      scl ? new THREE.Vector3(...scl) : new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
  }
  g.applyMatrix4(bm);
  return P.add(g, mat);
}

function buildBlock(g) {
  const P = new Parts();
  const W = BLOCK_HALF_L, D = 0.68, r = 0.10;
  const bankH = DECK_R - 0.06 - BANK_R0;

  for (let b = 0; b < 2; b++) {
    const bm = bankMatrix(b);
    const xs = CYL_X.slice(b * 6, b * 6 + 6);
    const outSide = bankSign(b);   // внешняя сторона ряда: −1 для A (−Z), +1 для B (+Z)

    // литой блок ряда с 6 цилиндрами
    const s = roundRect(-W, -D, W, D, r);
    xs.forEach(x => s.holes.push(holePath(x, 0, BORE_R)));
    addToBank(P, extrudeY(s, bankH, 40), M.aluCast, bm, [0, BANK_R0, 0]);

    // фрезерованная привалочная плоскость + плато-хонингованные гильзы Nikasil
    const sd = roundRect(-W - 0.02, -D - 0.03, W + 0.02, D + 0.03, r + 0.02);
    xs.forEach(x => sd.holes.push(holePath(x, 0, BORE_R)));
    addToBank(P, extrudeY(sd, 0.06, 40, 0.012), M.aluMach, bm, [0, DECK_R - 0.06, 0]);

    xs.forEach(x => {
      const ls = new THREE.Shape();
      ls.absarc(0, 0, BORE_R + 0.028, 0, Math.PI * 2, false);
      ls.holes.push(holePath(0, 0, BORE_R));
      addToBank(P, extrudeY(ls, DECK_R - BANK_R0 - 0.02, 40), M.liner, bm, [x, BANK_R0 + 0.024, 0]);
      // прилив гильзы и бобышки шпилек по наружному борту
      addToBank(P, G.cyl(0.36, 0.36, bankH - 0.14, 32), M.aluCast, bm,
        [x, BANK_R0 + bankH * 0.5, outSide * (D - 0.20)], null, [1, 1, 0.78]);
    });

    // бобышки болтов ГБЦ и заглушки водяной рубашки
    MAINS_X.forEach(x => {
      addToBank(P, G.cyl(0.065, 0.065, bankH, 14), M.aluCast, bm, [x * 0.99, BANK_R0 + bankH * 0.5, outSide * (D + 0.005)]);
      addToBank(P, G.cyl(0.065, 0.065, bankH, 14), M.aluCast, bm, [x * 0.99, BANK_R0 + bankH * 0.5, -outSide * (D + 0.005)]);
    });
    [-2.04, 0, 2.04].forEach(x => {
      addToBank(P, G.cylZ(0.085, 0.03, 20), M.aluCast, bm, [x, BANK_R0 + 0.52, outSide * (D + 0.04)]);
      addToBank(P, G.cylZ(0.068, 0.03, 20), M.fitting, bm, [x, BANK_R0 + 0.52, outSide * (D + 0.055)]);
    });
  }

  // центральный мост в развале между рядами (масляная магистраль и рёбра)
  P.add(G.rbox(W * 2 - 0.08, 0.24, 0.76, 0.04), M.aluCast, [0, 1.38, 0]);
  P.add(G.cylX(0.11, W * 2 - 0.16, 20), M.aluCast, [0, 1.54, 0]);
  MAINS_X.forEach(x => P.add(G.rbox(0.10, 0.22, 0.92, 0.025), M.aluCast, [x, 1.52, 0]));

  // глубокая юбка картера с рёбрами жёсткости и опорами двигателя
  [-1, 1].forEach(side => {
    const zi0 = 0.70, zo0 = 0.80, zi1 = 0.98, zo1 = 1.09, y0 = 1.24, y1 = PAN_Y + 0.08;
    const ws = poly([[-side * zi0, y0], [-side * zo0, y0], [-side * zo1, y1], [-side * zi1, y1]]);
    P.add(extrudeXb(ws, W * 2 - 0.04, 2, 0.015), M.aluCast);
    MAINS_X.forEach(x => P.add(G.rbox(0.075, 1.28, 0.07, 0.025), M.aluCast, [x * 0.98, 0.50, side * 0.96], [-side * 0.20, 0, 0]));
    [-2.04, 2.04].forEach(x => {
      P.add(G.rbox(0.44, 0.34, 0.12, 0.03), M.aluCast, [x, 0.26, side * 1.11]);
      P.add(G.cylZ(0.13, 0.16, 24), M.rubber, [x, 0.26, side * 1.24]);
      P.add(G.cylZ(0.15, 0.03, 24), M.fittingDark, [x, 0.26, side * 1.33]);
      P.bolt(M.bolt, [x, 0.26, side * 1.345], side > 0 ? 'z' : '-z', 0.05, 0.04);
    });
    for (let i = 0; i < 13; i++) P.bolt(M.bolt, [-3.0 + i * 0.5, PAN_Y - 0.035, side * 1.06], '-y', 0.026, 0.028);
  });

  // торцовые стенки картера с сальниками коленвала
  [-1, 1].forEach(e => {
    P.add(G.rbox(0.11, 1.38, 1.98, 0.03), M.aluCast, [e * (W - 0.05), 0.56, 0]);
    const ring = new THREE.Shape(); ring.absarc(0, 0, 0.36, 0, Math.PI * 2, false); ring.holes.push(holePath(0, 0, 0.20));
    P.add(extrudeXb(ring, 0.07, 36, 0.012), M.aluMach, [e * (W + 0.04), CRANK_Y, 0]);
    P.add(G.torusX(0.205, 0.018, 8, 32), M.rubber, [e * (W + 0.075), CRANK_Y, 0]);
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.3;
      P.bolt(M.bolt, [e * (W + 0.08), CRANK_Y + Math.cos(a) * 0.29, Math.sin(a) * 0.29], e > 0 ? 'x' : '-x', 0.024, 0.024);
    }
  });

  // фланец поддона (по периметру)
  const pr = roundRect(-W - 0.02, -1.10, W + 0.02, 1.10, 0.10);
  pr.holes.push(roundRect(-W + 0.08, -0.99, W - 0.08, 0.99, 0.06));
  P.add(extrudeY(pr, 0.09, 16, 0.012), M.aluCast, [0, PAN_Y, 0]);

  // 7 коренных перегородок и усиленных крышек с вкладышами и болтами
  const bh = new THREE.Shape();
  bh.moveTo(-0.88, 1.24); bh.lineTo(0.88, 1.24); bh.lineTo(0.80, CRANK_Y); bh.lineTo(0.205, CRANK_Y);
  bh.absarc(0, CRANK_Y, 0.205, 0, Math.PI, false); bh.lineTo(-0.80, CRANK_Y); bh.closePath();
  const cp = new THREE.Shape();
  cp.moveTo(-0.44, CRANK_Y); cp.lineTo(-0.205, CRANK_Y); cp.absarc(0, CRANK_Y, 0.205, Math.PI, Math.PI * 2, false);
  cp.lineTo(0.44, CRANK_Y); cp.lineTo(0.44, 0.12); cp.quadraticCurveTo(0.44, -0.02, 0.28, -0.02); cp.lineTo(-0.28, -0.02);
  cp.quadraticCurveTo(-0.44, -0.02, -0.44, 0.12); cp.closePath();
  const sh = new THREE.Shape(); sh.absarc(0, 0, 0.205, 0, Math.PI * 2, false); sh.holes.push(holePath(0, 0, 0.19));
  MAINS_X.forEach(x => {
    P.add(extrudeXb(bh, 0.22, 24, 0.012), M.aluCast, [x, 0, 0]);
    P.add(extrudeXb(cp, 0.23, 24, 0.014), M.iron, [x, 0, 0]);
    P.add(extrudeXb(sh, 0.20, 32, 0.004), M.shell, [x, CRANK_Y, 0]);
    [-0.32, 0.32].forEach(z => P.bolt(M.boltDark, [x, -0.02, z], '-y', 0.044, 0.05));
  });

  // оребрённый поддон сухого картера (алюминий + откачивающая магистраль + сливные пробки)
  const outer = [[-3.18, PAN_Y - 0.02], [-3.02, -0.68], [3.02, -0.68], [3.18, PAN_Y - 0.02]];
  const inner = [[3.12, PAN_Y - 0.02], [2.97, -0.62], [-2.97, -0.62], [-3.12, PAN_Y - 0.02]];
  P.add(extrudeZ(poly([...outer, ...inner]), 2.04, 2, 0.012), M.aluDark);
  [-1, 1].forEach(side => P.add(extrudeZ(poly(outer), 0.05, 2, 0.012), M.aluDark, [0, 0, side * 1.02]));
  const pf = roundRect(-W + 0.02, -1.10, W - 0.02, 1.10, 0.10);
  pf.holes.push(roundRect(-W + 0.10, -0.99, W - 0.10, 0.99, 0.06));
  P.add(extrudeY(pf, 0.04, 16, 0.008), M.aluMach, [0, PAN_Y - 0.04, 0]);
  for (let i = -3; i <= 3; i++) P.add(G.rbox(5.85, 0.055, 0.035, 0.01), M.aluDark, [0, -0.70, i * 0.24]);
  P.add(G.cylX(0.065, 5.4, 16), M.paintBlack, [0, -0.52, -1.12]);
  [-2.04, 0, 2.04].forEach(x => {
    P.add(G.cylZ(0.055, 0.08, 12), M.anodizedBlue, [x, -0.52, -1.07]);
    P.bolt(M.bolt, [x, -0.52, 1.05], 'z', 0.04, 0.03);
  });

  // масляный фильтр и теплообменник, датчики детонации, щуп уровня масла
  P.add(G.cylZ(0.16, 0.14, 28), M.aluCast, [1.15, 0.34, -1.09]);
  P.add(G.latheZ([[0, 0], [0.175, 0, 1], [0.18, -0.02, 1], [0.18, -0.32, 1], [0.16, -0.355, 1], [0.08, -0.365, 1], [0, -0.365]], 36), M.paintBlue, [1.15, 0.34, -1.17]);
  for (let k = 0; k < 18; k++) {
    const a = k / 18 * Math.PI * 2;
    P.add(G.rbox(0.02, 0.02, 0.09, 0.008), M.paintBlue, [1.15 + Math.cos(a) * 0.18, 0.34 + Math.sin(a) * 0.18, -1.46]);
  }
  [-1.2, 1.2].forEach(x => {
    P.add(G.cylZ(0.06, 0.05, 16), M.paintBlack, [x, 1.08, -0.92]);
    P.add(G.cylZ(0.06, 0.05, 16), M.paintBlack, [x, 1.08, 0.92]);
  });
  P.add(G.cyl(0.016, 0.016, 1.55, 10), M.fitting, [-0.55, 1.38, -1.04]);
  P.add(G.torusY(0.055, 0.016, 8, 20), M.paintRed, [-0.55, 2.22, -1.04], [Math.PI / 2, 0, 0]);

  buildAccessories(P, g);
  P.build(g, g);
  g.userData.anchor.set(-1.6, 1.85, 1.25);
}

export { buildBlock };

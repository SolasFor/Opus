/* Деталь «Впускной коллектор V12 и топливная система»: buildIntake().
 * Два карбоновых ресивера (2×2 twill), парные дроссельные заслонки 76 мм,
 * 12 равнодлинных патрубков с золочёными раструбами, 12 форсунок и анодированные топливные рампы.
 */
import * as THREE from 'three';
import { bankOf, bankSign } from '../../config/engine-spec.js';
import { CYL_X, HEAD_BOT_R, bankPoint, bankQuat } from '../world.js';
import { M } from '../materials.js';
import { G, Parts } from './geometry.js';

const intakePaths = [];

function buildIntake(g) {
  intakePaths.length = 0;
  const P = new Parts();

  // продольные карбоновые ресиверы над развалом V (ряд A: −Z, ряд B: +Z)
  for (let b = 0; b < 2; b++) {
    const ins = -bankSign(b);
    const plZ = b === 0 ? -0.52 : 0.52;
    const plY = 4.02;

    // основной цилиндрический ресивер с конусным сужением к дросселю и заглушкой сзади
    const plProf = [
      [0, -2.92], [0.22, -2.90, 1], [0.29, -2.68, 1],
      [0.29,  2.72], [0.21,  2.96, 1], [0,  2.98]
    ];
    P.add(G.latheX(plProf, 36), M.carbonWeave, [0, plY, plZ]);
    // хомуты и поперечный балансировочный мост между двумя ресиверами
    [-2.40, -0.80, 0.80, 2.40].forEach(rx => P.add(G.torusX(0.295, 0.014, 8, 28), M.aluMach, [rx, plY, plZ]));

    // корпус дроссельной заслонки 76 мм + латунная заслонка + входной патрубок
    P.add(G.cylX(0.21, 0.14, 24), M.aluMach, [3.02, plY, plZ]);
    P.add(G.cylX(0.18, 0.28, 24), M.aluDark, [3.22, plY, plZ]);
    P.add(G.cylX(0.165, 0.015, 24), M.brass, [3.22, plY, plZ], [0, 0.45, 0]);
    P.add(G.cylX(0.195, 0.16, 24), M.rubber, [3.40, plY, plZ]);
    P.add(G.torusX(0.205, 0.010, 6, 24), M.chrome, [3.34, plY, plZ]);
    P.add(G.torusX(0.205, 0.010, 6, 24), M.chrome, [3.46, plY, plZ]);
    P.add(G.cyl(0.06, 0.06, 0.14, 16), M.dark, [3.22, plY + 0.21, plZ]);

    // топливная рампа с регулятором давления и AN-фитингами
    const fpRail = bankPoint(b, 0, HEAD_BOT_R + 0.78, ins * 0.94);
    P.add(G.rbox(5.68, 0.085, 0.095, 0.025), M.anodizedBlue, [0, fpRail.y, fpRail.z]);
    P.add(G.cylX(0.062, 0.10, 16), M.anodizedRed, [2.90, fpRail.y, fpRail.z]);
    P.add(G.cylX(0.062, 0.10, 16), M.anodizedRed, [-2.90, fpRail.y, fpRail.z]);
  }

  // центральная карбоновая Y-перемычка, объединяющая впуск спереди, и балансировочные трубки
  P.add(G.rbox(0.32, 0.16, 0.84, 0.05), M.carbonWeave, [3.54, 4.02, 0]);
  P.add(G.cylX(0.22, 0.26, 28), M.aluMach, [3.74, 4.02, 0]);
  [-1.60, 0, 1.60].forEach(bx => P.add(G.cylZ(0.065, 0.62, 18), M.aluMach, [bx, 4.02, 0]));
  // задняя армированная перемычка топливных рамп
  const ra = bankPoint(0, -2.92, HEAD_BOT_R + 0.78, 0.94);
  const rb = bankPoint(1, -2.92, HEAD_BOT_R + 0.78, -0.94);
  P.add(G.tube(new THREE.CatmullRomCurve3([
    new THREE.Vector3(ra.x, ra.y, ra.z),
    new THREE.Vector3(-3.08, ra.y + 0.12, 0),
    new THREE.Vector3(rb.x, rb.y, rb.z)
  ]), 16, 0.026, 8), M.pipe);

  // 12 впускных раннеров + золочёные фланцы ресивера + 12 топливных форсунок
  const flQ = [bankQuat(0), bankQuat(1)];
  for (let c = 0; c < 12; c++) {
    const b = bankOf(c);
    const ins = -bankSign(b);
    const plZ = b === 0 ? -0.52 : 0.52;
    const cx = CYL_X[c];

    const pPort = bankPoint(b, cx, HEAD_BOT_R + 0.52, ins * 0.79);
    const pMid  = bankPoint(b, cx, HEAD_BOT_R + 0.80, ins * 1.12);
    const pPlen = new THREE.Vector3(cx, 3.80, plZ);
    const pTop  = new THREE.Vector3(cx, 4.02, plZ);
    const pCyl  = bankPoint(b, cx, HEAD_BOT_R + 0.30, ins * 0.28);

    // изогнутый патрубок + фланцы и уплотнительная кольцевая манжета
    P.add(G.tube(new THREE.CatmullRomCurve3([pPort, pMid, pPlen]), 16, 0.125, 16), M.aluCast);
    P.add(G.cyl(0.148, 0.148, 0.055, 20), M.gold, [cx, 3.79, plZ]);
    const e = new THREE.Euler().setFromQuaternion(flQ[b]);
    P.add(G.rbox(0.42, 0.28, 0.06, 0.03), M.aluMach, [pPort.x, pPort.y, pPort.z], [e.x, e.y, e.z]);

    // топливная форсунка от рампы в впускной канал
    const pRail = bankPoint(b, cx, HEAD_BOT_R + 0.78, ins * 0.94);
    const pInjEnd = bankPoint(b, cx, HEAD_BOT_R + 0.52, ins * 0.82);
    const dir = pInjEnd.clone().sub(pRail);
    const iq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const ie = new THREE.Euler().setFromQuaternion(iq);
    const midInj = pRail.clone().addScaledVector(dir, 0.5);
    P.add(G.cyl(0.032, 0.026, dir.length(), 14), M.anodizedBlue, [midInj.x, midInj.y, midInj.z], [ie.x, ie.y, ie.z]);

    intakePaths[c] = new THREE.CatmullRomCurve3([pTop, pPlen, pMid, pPort, pCyl]);
  }

  P.build(g, g);
  g.userData.anchor.set(0.3, 4.30, 0.55);
}

export { intakePaths, buildIntake };

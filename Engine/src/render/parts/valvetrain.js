/* Деталь «ГРМ: 4 распредвала и 48 клапанов»: buildValvetrain().
 * 4 верхних распредвала (DOHC) с 40-зубыми звёздочками привода на BELT_X,
 * 48 титановых клапанов с тарелками, толкателями-стаканами и винтовыми пружинами.
 */
import * as THREE from 'three';
import { CRANK_Y, VALVE_TILT, bankAngle, bankOf, bankSign } from '../../config/engine-spec.js';
import { camProfileLift, lobeAngle, valveSideLocal } from '../../sim/valvetrain.js';
import { CYL_X, MAINS_X, BLOCK_HALF_L, SEAT_R, SEAT_Z, TAPPET_TOP, CAM_RB, CAM_R, CAM_ZL, BELT_X, R_CAM_SPR } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeX, extrudeXb, gearShape, Parts, detail, registerLocalPart } from './geometry.js';

let valveMeshesA = [], valveMeshesB = [], springMeshesA = [], springMeshesB = [];
let camShafts = [], valves = [];
const SPRING_H = 0.62;
const SPRING_Y0 = 0.28;

function camLobeShape() {
  const s = new THREE.Shape(), N = detail.low ? 32 : 64;
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2;
    const r = CAM_RB + camProfileLift(a);
    const u = Math.sin(a) * r, v = Math.cos(a) * r;
    i === 0 ? s.moveTo(u, v) : s.lineTo(u, v);
  }
  return s;
}

function springGeometry() {
  const pts = [], N = detail.low ? 40 : 72, turns = 5.5, r = 0.088;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, SPRING_Y0 + t * SPRING_H, Math.sin(a) * r));
  }
  return G.tube(new THREE.CatmullRomCurve3(pts), N, 0.015, 6);
}

function makeValveParts(retainerMat) {
  const VP = new Parts();
  // тарелка клапана + галтель + стержень + тарелка пружины + стаканчик-толкатель
  VP.add(G.lathe([[0, 0], [0.148, 0.008], [0.150, 0.025], [0.036, 0.08], [0.030, 0.20], [0, 0.20]], 24), M.valve);
  VP.add(G.cyl(0.024, 0.024, 0.84, 14), M.valve, [0, 0.56, 0]);
  VP.add(G.cyl(0.098, 0.085, 0.032, 18), retainerMat, [0, SPRING_Y0 + SPRING_H + 0.012, 0]);
  VP.add(G.cyl(0.108, 0.108, 0.11, 20), M.steel, [0, TAPPET_TOP - 0.055, 0]);
  return VP;
}

function buildValvetrain(g) {
  camShafts = [];
  valves = [];

  const lobeShape = camLobeShape();
  const lobeGeo = extrudeXb(lobeShape, 0.092, 18, 0.008);
  const sprGeo = extrudeX(gearShape(40, R_CAM_SPR - 0.025, R_CAM_SPR + 0.012), 0.12, 1);

  const vBanks = [[], []], sBanks = [[], []];
  const Y_UP = new THREE.Vector3(0, 1, 0);

  for (let b = 0; b < 2; b++) {
    const out = bankSign(b);
    const bankGrp = new THREE.Group();
    bankGrp.rotation.x = bankAngle(b);
    g.add(bankGrp);

    const VP = makeValveParts(M.anodizedRed);
    vBanks[b] = VP.instanced(bankGrp, g, 24);
    const SP = new Parts();
    SP.add(springGeometry(), M.steel);
    sBanks[b] = SP.instanced(bankGrp, g, 24);

    // 2 распредвала в каждом ряду: выпускной (внешний) и впускной (к развалу V)
    ['exhaust', 'intake'].forEach(type => {
      const side = valveSideLocal(b, type);
      const cz = side * CAM_ZL;
      const camGrp = new THREE.Group();
      camGrp.position.set(0, CAM_R, cz);
      bankGrp.add(camGrp);

      const CP = new Parts();
      CP.add(G.cylX(0.082, BELT_X + BLOCK_HALF_L - 0.04, 20), M.cam, [(BELT_X - BLOCK_HALF_L) * 0.5 + 0.06, 0, 0]);
      MAINS_X.forEach(jx => CP.add(G.cylX(0.102, 0.13, 20), M.chrome, [jx, 0, 0]));

      // 12 кулачков на каждом распредвале (по 2 клапана на цилиндр ряда)
      for (let c = 0; c < 12; c++) {
        if (bankOf(c) !== b) continue;
        const beta = lobeAngle(type, c);
        [-0.175, 0.175].forEach(dx => {
          CP.add(lobeGeo.clone(), M.cam, [CYL_X[c] + dx, 0, 0], [beta, 0, 0]);
        });
      }

      // 40-зубый приводной шкив на переднем торце X = BELT_X с облегчающими окнами и болтом
      CP.add(sprGeo.clone(), M.steelDark, [BELT_X, 0, 0]);
      CP.add(G.cylX(0.32, 0.075, 28), M.anodizedRed, [BELT_X, 0, 0]);
      CP.add(G.cylX(0.15, 0.11, 22), M.steel, [BELT_X + 0.01, 0, 0]);
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2;
        CP.add(G.cylX(0.055, 0.082, 14), M.hole, [BELT_X, Math.cos(a) * 0.23, Math.sin(a) * 0.23]);
      }
      CP.bolt(M.bolt, [BELT_X + 0.075, 0, 0], 'x', 0.045, 0.04);

      CP.build(camGrp, g);
      camShafts.push({ bank: b, type, grp: camGrp, z: cz });
    });

    // дескрипторы 24 клапанов ряда (индекс idx ∈ 0..23)
    let idx = 0;
    for (let c = 0; c < 12; c++) {
      if (bankOf(c) !== b) continue;
      ['intake', 'exhaust'].forEach(type => {
        const side = valveSideLocal(b, type);
        const axis = new THREE.Vector3(0, Math.cos(VALVE_TILT), side * Math.sin(VALVE_TILT)).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(Y_UP, axis);
        [-0.175, 0.175].forEach(dx => {
          const seat = new THREE.Vector3(CYL_X[c] + dx, SEAT_R, side * SEAT_Z);
          valves.push({ cyl: c, bank: b, type, idx: idx++, seat, axis, quat, lift: 0 });
        });
      });
    }

    registerLocalPart(g, bankGrp, [0, CRANK_Y, 0], [0, CRANK_Y + 2.95, out * 1.70]);
  }

  lobeGeo.dispose();
  sprGeo.dispose();
  valveMeshesA = vBanks[0];
  valveMeshesB = vBanks[1];
  springMeshesA = sBanks[0];
  springMeshesB = sBanks[1];
  g.userData.anchor.set(1.25, 3.55, 1.45);
}

export { valveMeshesA, valveMeshesB, springMeshesA, springMeshesB, camShafts, valves, SPRING_H, SPRING_Y0, buildValvetrain };

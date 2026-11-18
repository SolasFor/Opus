/* Приводы ремней V12 — чистая геометрия, без three.js и DOM:
 *   1) TIMING_DRIVE: общий 8-шкивный контур зубчатого ремня ГРМ (коленвал 20 з., 4 распредвала 40 з., 3 ролика);
 *   2) DRIVE: 5-шкивный поликлиновой ремень навесного оборудования (демпфер, генератор, натяжитель, помпа, компрессор A/C).
 */
import { CRANK_Y, BANK_TILT, VALVE_TILT } from '../config/engine-spec.js';

const TIMING_X = 3.48;
const R_CRANK_S = 0.20, R_CAM_S = 0.40;
const SEAT_R = 2.09, SEAT_Z = 0.20, TAPPET_TOP = 1.06, CAM_RB = 0.105, CAM_AX = TAPPET_TOP + CAM_RB;
const CAM_R = SEAT_R + CAM_AX * Math.cos(VALVE_TILT);
const CAM_ZL = SEAT_Z + CAM_AX * Math.sin(VALVE_TILT);

function camWorldYZ(bank, zb) {
  const a = (bank === 0 ? -1 : 1) * BANK_TILT;
  return { y: CRANK_Y + CAM_R * Math.cos(a) - zb * Math.sin(a), z: CAM_R * Math.sin(a) + zb * Math.cos(a) };
}
const camAE = camWorldYZ(0, -CAM_ZL), camAI = camWorldYZ(0, +CAM_ZL);
const camBI = camWorldYZ(1, -CAM_ZL), camBE = camWorldYZ(1, +CAM_ZL);

const TIMING_TENS_R = 0.14, TIMING_VALLEY_R = 0.16, TIMING_THICK = 0.03;
const TIMING_DRIVE = [
  { key: 'crank',       u: 0,       v: CRANK_Y, r: R_CRANK_S + 0.012, s: 1 },
  { key: 'tensR',       u: 1.05,    v: 1.55,    r: TIMING_TENS_R + TIMING_THICK, s: -1 },
  { key: 'camBE',       u: camBE.z, v: camBE.y, r: R_CAM_S + 0.012, s: 1 },
  { key: 'camBI',       u: camBI.z, v: camBI.y, r: R_CAM_S + 0.012, s: 1 },
  { key: 'valleyIdler', u: 0,       v: 2.55,    r: TIMING_VALLEY_R + TIMING_THICK, s: -1 },
  { key: 'camAI',       u: camAI.z, v: camAI.y, r: R_CAM_S + 0.012, s: 1 },
  { key: 'camAE',       u: camAE.z, v: camAE.y, r: R_CAM_S + 0.012, s: 1 },
  { key: 'guideL',      u: -1.05,   v: 1.55,    r: TIMING_TENS_R + TIMING_THICK, s: -1 }
];

const ACC_X = TIMING_X + 0.15 + 0.035 + 3 * 0.024;   // 3.737: середина 6 канавок демпфера
const BELT_W = 0.144, BELT_T = 0.025, RIB_H = 0.016;
const ALT = { u: 1.48, v: 0.96 };
const WP  = { u: 0,    v: 1.58 };
const AC  = { u: -1.44, v: 0.96 };
const IDLER_R = 0.10;
const MARK = 0.12;
const DRIVE = [
  { key: 'crank', u: 0,     v: CRANK_Y, r: 0.34, s: 1 },
  { key: 'alt',   u: ALT.u, v: ALT.v,   r: 0.13, s: 1 },
  { key: 'idler', u: 0.74,  v: 1.12,    r: IDLER_R + BELT_T, s: -1 },
  { key: 'wpump', u: WP.u,  v: WP.v,    r: 0.17, s: 1 },
  { key: 'ac',    u: AC.u,  v: AC.v,    r: 0.15, s: 1 }
];

function beltLoop(C = DRIVE, stepDeg = 6) {
  const n = C.length, tan = [];
  for (let i = 0; i < n; i++) {
    const a = C[i], b = C[(i + 1) % n];
    const du = b.u - a.u, dv = b.v - a.v, L = Math.hypot(du, dv), dx = du / L, dy = dv / L;
    const k = (a.s * a.r - b.s * b.r) / L;
    if (!(Math.abs(k) < 1)) throw new Error(`beltLoop: у ${a.key} и ${b.key} нет общей касательной`);
    const g = Math.acos(k), nu = dx * Math.cos(g) + dy * Math.sin(g), nv = dy * Math.cos(g) - dx * Math.sin(g);
    tan.push({ nu, nv, len: Math.abs(L * Math.sin(g)) });
  }
  const pts = [], wraps = [], seg = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const c = C[i], tIn = tan[(i - 1 + n) % n], tOut = tan[i];
    const aIn = Math.atan2(c.s * tIn.nv, c.s * tIn.nu);
    let aOut = Math.atan2(c.s * tOut.nv, c.s * tOut.nu);
    if (c.s > 0) while (aOut < aIn) aOut += Math.PI * 2; else while (aOut > aIn) aOut -= Math.PI * 2;
    const w = Math.abs(aOut - aIn), steps = Math.max(2, Math.ceil(w / (stepDeg * Math.PI / 180)));
    for (let k = 0; k <= steps; k++) {
      const a = aIn + (aOut - aIn) * k / steps, cu = Math.cos(a), cv = Math.sin(a);
      pts.push({ u: c.u + c.r * cu, v: c.v + c.r * cv, nu: c.s * cu, nv: c.s * cv, s: s + c.r * w * k / steps });
    }
    wraps.push(w); seg.push(tOut.len);
    s += c.r * w + tOut.len;
  }
  return { pts, wraps, seg, length: s };
}

const timingDrive = theta => {
  const s = theta * R_CRANK_S;
  return { s, tensR: -s / TIMING_TENS_R, valleyIdler: -s / TIMING_VALLEY_R, guideL: -s / TIMING_TENS_R };
};
const accDrive = theta => {
  const s = theta * DRIVE[0].r;
  return { s, alt: s / DRIVE[1].r, idler: -s / (DRIVE[2].r - BELT_T), wpump: s / DRIVE[3].r, ac: s / DRIVE[4].r };
};
const markPeriod = length => length / Math.max(1, Math.round(length / MARK));

export {
  TIMING_X, TIMING_TENS_R, TIMING_VALLEY_R, TIMING_DRIVE,
  ACC_X, BELT_W, BELT_T, RIB_H, ALT, WP, AC, IDLER_R, MARK, DRIVE,
  beltLoop, timingDrive, accDrive, markPeriod
};

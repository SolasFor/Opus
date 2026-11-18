/* Константы V12 60° в мировых единицах (1 ед. = 100 мм): оси 12 цилиндров, радиусы блоков и ГБЦ,
 * распредвалы, плоскость ГРМ, пол, стартовая камера; преобразования левого (−30°) и правого (+30°) рядов.
 */
import * as THREE from 'three';
import { CRANK_Y, VALVE_TILT, bankAngle } from '../config/engine-spec.js';

const THROW_X      = [-2.55, -1.53, -0.51, 0.51, 1.53, 2.55];   // 6 общих шатунных шеек, шаг 102 мм
const ROD_OFFSET_X = 0.085;                                     // осевое смещение шатунов в паре на шейке
const CYL_X        = [...THROW_X.map(x => x - ROD_OFFSET_X), ...THROW_X.map(x => x + ROD_OFFSET_X)];
const MAINS_X      = [-3.08, -2.04, -1.02, 0, 1.02, 2.04, 3.08]; // 7 коренных опор
const BLOCK_HALF_L = 3.24;

// Радиальные размеры вдоль локальной оси +Y каждого ряда от оси коленвала
const BANK_R0     = 0.88;
const DECK_R      = 2.02;
const GASKET_R    = 2.05;
const HEAD_BOT_R  = 2.08;
const HEAD_TOP_R  = 2.94;
const COVER_TOP_R = 3.52;

const SEAT_R      = 2.09;
const SEAT_Z      = 0.20;
const TAPPET_TOP  = 1.06;
const CAM_RB      = 0.105;
const CAM_AX      = TAPPET_TOP + CAM_RB;
const CAM_R       = SEAT_R + CAM_AX * Math.cos(VALVE_TILT);
const CAM_ZL      = SEAT_Z + CAM_AX * Math.sin(VALVE_TILT);

const BELT_X      = 3.48;
const R_CRANK_SPR = 0.20;
const R_CAM_SPR   = 0.40;
const FLYWHEEL_X  = -3.56;
const FLOOR_Y     = -2.95;
const BASE_RPM = 30;
const CAM_HOME    = new THREE.Vector3(8.4, 5.3, 10.6);
const TGT_HOME    = new THREE.Vector3(0, 1.85, 0);

const STROKES = [
  { name: 'Рабочий ход', short: 'Раб. ход', color: '#ff8a3d' },   // φ 0…180
  { name: 'Выпуск',      short: 'Выпуск',   color: '#9aa3ad' },   // 180…360
  { name: 'Впуск',       short: 'Впуск',    color: '#4da3ff' },   // 360…540
  { name: 'Сжатие',      short: 'Сжатие',   color: '#a78bfa' }    // 540…720
];

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const $ = id => document.getElementById(id);

const bankQuat = b => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bankAngle(b));
function bankPoint(b, x, yb, zb) {
  const a = bankAngle(b);
  return new THREE.Vector3(x, CRANK_Y + yb * Math.cos(a) - zb * Math.sin(a), yb * Math.sin(a) + zb * Math.cos(a));
}
function makeBankGroup(parent, b) {
  const g = new THREE.Group();
  g.position.set(0, CRANK_Y, 0);
  g.rotation.x = bankAngle(b);
  parent.add(g);
  return g;
}

export {
  THROW_X, ROD_OFFSET_X, CYL_X, MAINS_X, BLOCK_HALF_L,
  BANK_R0, DECK_R, GASKET_R, HEAD_BOT_R, HEAD_TOP_R, COVER_TOP_R,
  SEAT_R, SEAT_Z, TAPPET_TOP, CAM_RB, CAM_R, CAM_ZL,
  BELT_X, R_CRANK_SPR, R_CAM_SPR, FLYWHEEL_X, FLOOR_Y, BASE_RPM,
  CAM_HOME, TGT_HOME, STROKES, V3, $, bankQuat, bankPoint, makeBankGroup
};

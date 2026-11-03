/* Константы сцены в мировых единицах (1 ед. = 100 мм): оси цилиндров, высоты блока и головки, распредвалы, ремень ГРМ,
 * пол, исходная камера; названия и цвета тактов, V3 и $.
 * M-02b: раздел 1 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { VALVE_TILT } from '../config/engine-spec.js';

const CYL_X    = [-1.65, -0.55, 0.55, 1.65];   // оси цилиндров вдоль X
const BLOCK_Y0 = -0.30, CRANK_TOP = 1.00, DECK_Y = 2.42;
const GASKET_Y = 2.45, HEAD_BOT = 2.48, HEAD_TOP = 3.42;
const SEAT_Y   = 2.49, SEAT_Z = 0.215;         // центр тарелки клапана (закрыт)
const TAPPET_TOP = 1.12, CAM_RB = 0.11;
const CAM_AX   = TAPPET_TOP + CAM_RB;          // расстояние от седла до оси распредвала вдоль оси клапана
const CAM_Y    = SEAT_Y + CAM_AX * Math.cos(VALVE_TILT);
const CAM_Z    = SEAT_Z + CAM_AX * Math.sin(VALVE_TILT);
const BELT_X   = 2.52;                         // плоскость ремня ГРМ
const R_CRANK_SPR = 0.21, R_CAM_SPR = 0.42;    // 2 : 1
const IDLER = { z: 0.66, y: 2.05, r: 0.13 };
const FLOOR_Y  = -2.90;
const BASE_RPM = 30;                           // ×1 скорости = 30 об/мин (реальное время замедлено, чтобы видеть такты)
const CAM_HOME = new THREE.Vector3(6.3, 4.3, 8.7), TGT_HOME = new THREE.Vector3(-0.35, 1.55, 0);

const STROKES = [
  { name: 'Рабочий ход', short: 'Раб. ход', color: '#ff8a3d' },   // φ 0…180
  { name: 'Выпуск',      short: 'Выпуск',   color: '#9aa3ad' },   // 180…360
  { name: 'Впуск',       short: 'Впуск',    color: '#4da3ff' },   // 360…540
  { name: 'Сжатие',      short: 'Сжатие',   color: '#a78bfa' }    // 540…720
];

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const $ = id => document.getElementById(id);

export { CYL_X, BLOCK_Y0, CRANK_TOP, DECK_Y, GASKET_Y, HEAD_BOT, HEAD_TOP, SEAT_Y, SEAT_Z, TAPPET_TOP, CAM_RB, CAM_Y, CAM_Z, BELT_X, R_CRANK_SPR, R_CAM_SPR, IDLER, FLOOR_Y, BASE_RPM, CAM_HOME, TGT_HOME, STROKES, V3, $ };

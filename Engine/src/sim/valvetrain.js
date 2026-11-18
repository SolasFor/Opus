/**
 * @file Привод 48 клапанов V12: профиль кулачка и фазировка кулачков 4 распредвалов (слой sim, L0).
 */
import { DEG, FIRE_DEG, VALVE_TILT, CAM_LIFT, CAM_HALF, IN_MID, EX_MID, bankOf } from '../config/engine-spec.js';
import { mod } from './math.js';

/**
 * Подъём по профилю кулачка: cos² в пределах ±CAM_HALF от вершины, вне — 0.
 * @param {number} psi угол от вершины кулачка, РАДИАНЫ распредвала.
 * @returns {number} подъём, u, от 0 до CAM_LIFT.
 */
export function camProfileLift(psi) {
  const a = Math.abs(mod(psi + Math.PI, Math.PI * 2) - Math.PI);
  if (a >= CAM_HALF) return 0;
  const c = Math.cos(a / CAM_HALF * Math.PI / 2);
  return CAM_LIFT * c * c;
}

/**
 * Знак смещения распредвала/клапана по локальной оси Z ряда b:
 * впуск смотрит в развал V (+1 для ряда A, −1 для ряда B), выпуск — наружу (−1 для ряда A, +1 для ряда B).
 */
export function valveSideLocal(bank, type) {
  return type === 'intake' ? (bank === 0 ? 1 : -1) : (bank === 0 ? -1 : 1);
}

/**
 * Направление (rotation.x в системе ряда), куда смотрит вершина кулачка при наибольшем подъёме.
 * @param {number} bank 0 (ряд A) или 1 (ряд B).
 * @param {string} type 'intake' или 'exhaust'.
 * @returns {number} РАДИАНЫ.
 */
export function valveDownAngle(bank, type) {
  return valveSideLocal(bank, type) < 0 ? Math.PI - VALVE_TILT : Math.PI + VALVE_TILT;
}

/**
 * Угол установки вершины кулачка β на соответствующем распредвале.
 * @param {string} type 'intake' или 'exhaust'.
 * @param {number} cyl индекс цилиндра 0…11.
 * @returns {number} β, РАДИАНЫ распредвала.
 */
export function lobeAngle(type, cyl) {
  const mid = type === 'intake' ? IN_MID : EX_MID;
  return valveDownAngle(bankOf(cyl), type) - (FIRE_DEG[cyl] + mid) / 2 * DEG;
}

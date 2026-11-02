/**
 * @file Привод клапанов: профиль кулачка и установка кулачков (слой sim, уровень L0 — геометрия профиля).
 *
 * M-01a: перенесено из Engine/Engine.html@10c79c8:1098–1103 и 1114–1119 без изменений.
 * Подъём в legacy считается в updateKinematics (Engine.html:1406, остаётся в HTML):
 *   lift = camProfileLift(θ / 2 + lobeAngle(type, cyl) − valveDownAngle(type)), где θ — угол коленвала в радианах,
 *   θ / 2 — угол распредвала.
 */
import { DEG, FIRE_DEG, VALVE_TILT, CAM_LIFT, CAM_HALF, IN_MID, EX_MID } from '../config/engine-spec.js';
import { mod } from './math.js';

/**
 * Подъём по профилю кулачка: cos² в пределах ±CAM_HALF от вершины, вне — 0.
 * @param {number} psi ψ — угол от вершины кулачка, РАДИАНЫ распредвала, любое число (период 2π).
 * @returns {number} подъём, u (1 u = 100 мм, соглашение модели), от 0 до CAM_LIFT.
 * Источник: Engine.html:1098–1103.
 */
export function camProfileLift(psi) {      // psi = angle from nose (rad) → lift (world units)
  const a = Math.abs(mod(psi + Math.PI, Math.PI * 2) - Math.PI);
  if (a >= CAM_HALF) return 0;
  const c = Math.cos(a / CAM_HALF * Math.PI / 2);
  return CAM_LIFT * c * c;
}

/* direction angle (rotation.x convention) the lobe nose must point to for max lift on a valve */
/**
 * Направление (в соглашении rotation.x распредвала), куда должна смотреть вершина кулачка
 * для наибольшего подъёма клапана.
 * @param {string} type 'intake' — впуск; любое другое значение — выпуск (как в legacy).
 * @returns {number} РАДИАНЫ: π − VALVE_TILT для впуска, π + VALVE_TILT для выпуска.
 * Источник: Engine.html:1114–1115.
 */
export function valveDownAngle(type) { return type === 'intake' ? Math.PI - VALVE_TILT : Math.PI + VALVE_TILT; }

/**
 * Угол установки вершины кулачка β на распредвале: при фазе цилиндра φ = IN_MID (впуск)
 * или EX_MID (выпуск) вершина смотрит вдоль оси клапана.
 * @param {string} type 'intake' — впуск; любое другое значение — выпуск.
 * @param {number} cyl индекс цилиндра 0…3.
 * @returns {number} β, РАДИАНЫ распредвала.
 * Источник: Engine.html:1116–1119.
 */
export function lobeAngle(type, cyl) {   // β: lobe nose angle in camshaft space
  const mid = type === 'intake' ? IN_MID : EX_MID;
  return valveDownAngle(type) - (FIRE_DEG[cyl] + mid) / 2 * DEG;
}

/**
 * @file Фазы 720-градусного цикла V12 (слой sim, уровень L0).
 *
 * θ (thetaRad) — накопленный угол поворота коленвала в РАДИАНАХ.
 */
import { DEG, FIRE_DEG } from '../config/engine-spec.js';
import { mod } from './math.js';

/**
 * Угол в 720-градусном цикле.
 * @param {number} thetaRad θ — угол коленвала, РАДИАНЫ.
 * @returns {number} угол цикла, ГРАДУСЫ коленвала, [0, 720).
 */
export const cycleDeg = thetaRad => mod(thetaRad / DEG, 720);

/**
 * Фаза цилиндра φi = θ° − FIRE_DEG[i] в 720-градусном цикле.
 * @param {number} thetaRad θ — угол коленвала, РАДИАНЫ.
 * @param {number} i индекс цилиндра 0…11 (0…5 ряд A, 6…11 ряд B).
 * @returns {number} φ, ГРАДУСЫ, [0, 720); 0 — ВМТ начала рабочего хода.
 */
export const cylinderPhaseDeg = (thetaRad, i) => mod(thetaRad / DEG - FIRE_DEG[i], 720);

/**
 * Номер такта по фазе: 0 — рабочий ход (0…180°), 1 — выпуск (180…360°),
 * 2 — впуск (360…540°), 3 — сжатие (540…720°).
 * @param {number} phi φ, ГРАДУСЫ.
 * @returns {number} целое 0…3.
 */
export const strokeOf = phi => Math.floor(mod(phi, 720) / 180);

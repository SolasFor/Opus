/**
 * @file Фазы 720-градусного цикла (слой sim, уровень L0 — точные соотношения фаз).
 *
 * M-01a: перенесено из Engine/Engine.html@10c79c8:1375–1377. Единственное отличие от legacy:
 * cycDeg и phaseOf там читают изменяемый sim.theta, здесь угол θ передаётся явным аргументом.
 * Выражения и порядок операций не изменены.
 *
 * θ (thetaRad) — накопленный угол поворота коленвала в РАДИАНАХ, без ограничения диапазона
 * (может быть < 0 и > 4π); это то же значение, что sim.theta в Engine.html:1368.
 */
import { DEG, FIRE_DEG } from '../config/engine-spec.js';
import { mod } from './math.js';

/**
 * Угол в 720-градусном цикле.
 * @param {number} thetaRad θ — угол коленвала, РАДИАНЫ, любое число.
 * @returns {number} угол цикла, ГРАДУСЫ коленвала, [0, 720).
 * Источник: Engine.html:1375 — cycDeg = () => mod(sim.theta / DEG, 720).
 */
export const cycleDeg = thetaRad => mod(thetaRad / DEG, 720);

/**
 * Фаза цилиндра φi = θ° − FIRE_DEG[i] в 720-градусном цикле.
 * @param {number} thetaRad θ — угол коленвала, РАДИАНЫ, любое число.
 * @param {number} i индекс цилиндра 0…3 (цилиндр № i + 1).
 * @returns {number} φ, ГРАДУСЫ, [0, 720); 0 — ВМТ в начале рабочего хода.
 * Источник: Engine.html:1376 — phaseOf = i => mod(sim.theta / DEG - FIRE_DEG[i], 720).
 */
export const cylinderPhaseDeg = (thetaRad, i) => mod(thetaRad / DEG - FIRE_DEG[i], 720);

/**
 * Номер такта по фазе: 0 — рабочий ход (φ 0…180°), 1 — выпуск (180…360°),
 * 2 — впуск (360…540°), 3 — сжатие (540…720°). Это индекс в STROKES (Engine.html:449–454, остаётся в HTML).
 * @param {number} phi φ, ГРАДУСЫ, любое число (приводится по модулю 720).
 * @returns {number} целое 0…3.
 * Источник: Engine.html:1377.
 */
export const strokeOf = phi => Math.floor(mod(phi, 720) / 180);

/**
 * @file Точная кинематика V12 60° (слой sim, уровень L0).
 *
 * Все двенадцать поршней работают на общих шести шатунных шейках:
 *   – шейка t ∈ 0…5 движется по окружности радиуса CRANK_R с углом θ + THROW_PSI[t];
 *   – поршень цилиндра c (ряд b = bankOf(c)) движется вдоль оси своего ряда α_b = ±30° на расстоянии
 *     pistonPinDist(φ_c) от оси коленвала, где φ_c = θ/DEG − FIRE_DEG[c].
 */
import { DEG, CRANK_Y, CRANK_R, ROD_L, FIRE_DEG, THROW_PSI, bankOf, bankAngle } from '../config/engine-spec.js';

/**
 * Радиальное расстояние оси поршневого пальца от оси коленвала вдоль оси цилиндра.
 * @param {number} phiDeg φ — фаза цилиндра, ГРАДУСЫ (0 — ВМТ).
 * @returns {number} радиус вдоль оси ряда, u.
 */
export function pistonPinDist(phiDeg) {
  const a = phiDeg * DEG, along = CRANK_R * Math.cos(a), lat = CRANK_R * Math.sin(a);
  return along + Math.sqrt(ROD_L * ROD_L - lat * lat);
}

export const PIN_TDC_R = pistonPinDist(0);
export const PIN_BDC_R = pistonPinDist(180);

/**
 * Эквивалентная высота (для термодинамического расчёта хода) = CRANK_Y + pistonPinDist(φ).
 * @param {number} phiDeg φ — фаза цилиндра, ГРАДУСЫ.
 * @returns {number} u.
 */
export function pistonPinY(phiDeg) { return CRANK_Y + pistonPinDist(phiDeg); }

export const PIN_TDC = pistonPinY(0);
export const PIN_BDC = pistonPinY(180);

/**
 * Координаты (y, z) центра шатунной шейки t ∈ 0…5 при угле коленвала θ (РАДИАНЫ).
 */
export function crankPinYZ(thetaRad, throwIdx) {
  const a = thetaRad + THROW_PSI[throwIdx];
  return [CRANK_Y + CRANK_R * Math.cos(a), CRANK_R * Math.sin(a)];
}

/**
 * Координаты (y, z) поршневого пальца цилиндра c ∈ 0…11 при угле коленвала θ (РАДИАНЫ).
 */
export function wristPinYZ(thetaRad, cylIdx) {
  const a = bankAngle(bankOf(cylIdx));
  const r = pistonPinDist(thetaRad / DEG - FIRE_DEG[cylIdx]);
  return [CRANK_Y + r * Math.cos(a), r * Math.sin(a)];
}

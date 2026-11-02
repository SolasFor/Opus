/**
 * @file Кривошипно-шатунный механизм (слой sim, уровень L0 — точная формула без упрощений).
 *
 * M-01a: перенесено из Engine/Engine.html@10c79c8:1379–1384 без изменений.
 * Параметры — группа A «3D, 85×72»: CRANK_Y, CRANK_R, ROD_L.
 * Копия формулы в updateKinematics (Engine.html:1391–1393) намеренно не объединена с этой:
 * там угол берётся от θ без приведения по модулю, и результаты расходятся до ~1e-14 u.
 */
import { DEG, CRANK_Y, CRANK_R, ROD_L } from '../config/engine-spec.js';

/* exact slider-crank position for a phase (deg) → wrist-pin height */
/**
 * Высота оси поршневого пальца для фазы цилиндра.
 * @param {number} phiDeg φ — фаза цилиндра, ГРАДУСЫ (0 — ВМТ), любое число.
 * @returns {number} координата Y оси пальца в сцене, u (1 u ≈ 100 мм), от PIN_BDC до PIN_TDC.
 * Источник: Engine.html:1380–1383.
 */
export function pistonPinY(phiDeg) {
  const a = phiDeg * DEG, pinY = CRANK_Y + CRANK_R * Math.cos(a), pinZ = CRANK_R * Math.sin(a);
  return pinY + Math.sqrt(ROD_L * ROD_L - pinZ * pinZ);
}

/**
 * Высота оси пальца в ВМТ (φ = 0°), ≈ 2,16 u.
 * Единицы: u. Источник: Engine.html:1384. Группа: A (вычисляется из CRANK_Y, CRANK_R, ROD_L).
 */
export const PIN_TDC = pistonPinY(0);

/**
 * Высота оси пальца в НМТ (φ = 180°), ≈ 1,44 u.
 * Единицы: u. Источник: Engine.html:1384. Группа: A (вычисляется из CRANK_Y, CRANK_R, ROD_L).
 */
export const PIN_BDC = pistonPinY(180);

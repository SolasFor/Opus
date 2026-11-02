/**
 * @file Скалярные помощники (слой sim).
 *
 * M-01a: перенесены из Engine/Engine.html@10c79c8:456–460 без изменений.
 * Без Three.js, DOM и состояния. Функции не привязаны к единицам: результат — в единицах входов.
 */

/**
 * Ограничивает v отрезком [a, b] (ожидается a ≤ b).
 * @param {number} v значение — любые единицы, одинаковые с a и b.
 * @param {number} a нижняя граница.
 * @param {number} b верхняя граница.
 * @returns {number} v, a или b — в тех же единицах.
 * Источник: Engine.html:456.
 */
export const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

/**
 * Ограничивает v отрезком [0, 1].
 * @param {number} v безразмерная доля.
 * @returns {number} безразмерное значение в [0, 1].
 * Источник: Engine.html:457.
 */
export const clamp01 = v => clamp(v, 0, 1);

/**
 * Остаток от деления с неотрицательным результатом.
 * @param {number} a делимое — те же единицы, что у n (обычно °).
 * @param {number} n период.
 * @returns {number} значение в [0, n) при n > 0, в тех же единицах.
 * Источник: Engine.html:458.
 */
export const mod = (a, n) => ((a % n) + n) % n;

/**
 * Линейная интерполяция от a к b.
 * @param {number} a начальное значение — любые единицы, одинаковые с b.
 * @param {number} b конечное значение.
 * @param {number} t безразмерный параметр: 0 → a, 1 → b.
 * @returns {number} в единицах a и b.
 * Источник: Engine.html:459.
 */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Плавная ступень (smoothstep, кубический полином Эрмита) по x между a и b.
 * @param {number} a начало перехода — те же единицы, что у b и x (обычно °).
 * @param {number} b конец перехода.
 * @param {number} x аргумент.
 * @returns {number} безразмерное значение в [0, 1].
 * Источник: Engine.html:460.
 */
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

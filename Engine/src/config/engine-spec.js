/**
 * @file Параметры атмосферного V12 60° DOHC 48V (слой config).
 *
 * Первичные размеры заданы в мм, параметры сцены в единицах u (1 u = 100 мм) выводятся из них;
 * рабочий объём и объём камеры сгорания считаются из той же геометрии.
 * Модуль ничего не импортирует: без Three.js, без DOM, без изменяемого состояния.
 *
 * Ряды цилиндров (развал 60°, полуразвал ±30° вокруг оси X):
 *   Ряд A (bank = 0, цилиндры 0…5 → Ц1…Ц6): наклон к −Z (α = −30°). В координатах ряда впуск (развал) при +z, выпуск при −z.
 *   Ряд B (bank = 1, цилиндры 6…11 → Ц7…Ц12): наклон к +Z (α = +30°). В координатах ряда впуск (развал) при −z, выпуск при +z.
 *
 * Шесть общих шатунных шеек (по паре соседних шатунов на шейку: Ц1+Ц7, Ц2+Ц8, …, Ц6+Ц12).
 * Порядок вспышек: 1-7-5-11-3-9-6-12-2-8-4-10 (ровный интервал 60° ПКВ).
 */

export const DEG = Math.PI / 180;
export const U_MM = 100;

export const CYLINDERS = 12;
export const BANKS = 2;
export const CYL_PER_BANK = 6;

export const V_ANGLE_DEG = 60;
export const BANK_TILT_DEG = 30;
export const BANK_TILT = BANK_TILT_DEG * DEG;

// ---------- Первичные размеры, мм ----------
export const BORE_MM = 88;
export const STROKE_MM = 75;
export const ROD_MM = 138;
export const COMPRESSION_HEIGHT_MM = 24;
export const VALVE_LIFT_MM = 10.2;
export const CR = 11.5;

// ---------- Геометрия 3D-модели, u (1 u = 100 мм) ----------
export const CRANK_Y = 0.55;
export const CRANK_R = STROKE_MM / 2 / U_MM;          // 0.375 u = 37.5 мм
export const ROD_L = ROD_MM / U_MM;                   // 1.38 u = 138 мм
export const BORE_R = BORE_MM / 2 / U_MM;             // 0.44 u = 44 мм
export const PIN_TOP = COMPRESSION_HEIGHT_MM / U_MM;  // 0.24 u = 24 мм
export const VALVE_TILT = 12 * DEG;
export const CAM_LIFT = VALVE_LIFT_MM / U_MM;         // 0.102 u = 10.2 мм

// ---------- Вспомогательные функции рядов ----------
export const bankOf = c => (c < CYL_PER_BANK ? 0 : 1);
export const bankSign = b => (b === 0 ? -1 : 1);
export const bankAngle = b => bankSign(b) * BANK_TILT;

// ---------- Фазы и углы (цикл 720°) ----------
export const FIRE_A = Object.freeze([0, 480, 240, 600, 120, 360]);
export const FIRE_B = Object.freeze(FIRE_A.map(d => (d + 60) % 720));
export const FIRE_DEG = Object.freeze([...FIRE_A, ...FIRE_B]);
export const FIRING_ORDER = Object.freeze([0, 6, 4, 10, 2, 8, 5, 11, 1, 7, 3, 9]);

// Угол каждой из 6 общих шатунных шеек в системе коленвала (при θ = 0): θ_pin = θ + THROW_PSI[t]
export const THROW_PSI = Object.freeze(FIRE_A.map(d => (-d - BANK_TILT_DEG) * DEG));

export const CAM_HALF = 58 * DEG;
export const IN_MID = 465;
export const EX_MID = 255;
export const SPARK_ADV = 12;

// ---------- Объёмы модели давления, см³ ----------
export const VS = Math.PI * (BORE_R * 10) * (BORE_R * 10) * (2 * CRANK_R * 10);
export const VC = VS / (CR - 1);
export const DISPLACEMENT_CM3 = CYLINDERS * VS;

/**
 * @file Объём и давление в цилиндре для p–V-диаграммы (слой sim).
 *
 * M-01a: перенесено из Engine/Engine.html@10c79c8:1942–1958 без изменений выражений.
 * Комментарий legacy (1942) называет модель «Otto cycle with Wiebe heat release & blowdown».
 *
 * Уровень модели — L2: эмпирическая иллюстративная кривая частичной нагрузки,
 * а НЕ термодинамический расчёт. Давление — бар; опорный уровень (абсолютное или избыточное) не определён.
 *
 * Спецификация A (D-05, см. config/engine-spec.js): форма хода — из 3D-кинематики (PIN_TDC, PIN_BDC,
 * pistonPinY; λ = CRANK_R / ROD_L = 0,288), объёмы VS и VC — из той же геометрии Ø 85 × 72 мм и степени
 * сжатия CR = 10,5. Давление зависит от объёма только через отношения (VC + VS) / V и VC / V, то есть от CR
 * и формы хода; переход D-05 на VS по A изменил его лишь на ошибку округления. CR = 10,5 — параметр этой
 * модели, 3D-геометрия его не подтверждает (ограничение описано в config/engine-spec.js).
 *
 * Числа внутри формул — из legacy, эмпирические, внешнего источника нет:
 *   pClosed
 *     0.95  бар — давление в начале сжатия (pc = −180°, V = VC + VS); совпадает с концом впуска в pressureAt;
 *     1.32  — показатель политропы сжатия и расширения, безразмерный;
 *     62    ° — длительность сгорания: доля t растёт от 0 при pc = −SPARK_ADV до 1 при pc = 52°;
 *     5, t³ — форма доли сгоревшей смеси xb = 1 − exp(−5·t³) (вид функции Вибе: a = 5, m = 2), безразмерные;
 *     47    бар — масштаб прироста давления от сгорания, отнесённый к V = VC.
 *   pressureAt (° от ВМТ рабочего хода; при φ ≥ 540° берётся pc = φ − 720)
 *     139       — открытие выпускного клапана (EX_MID − 116°, Engine.html:439): конец участка с закрытыми клапанами;
 *     139…235   — свободный выпуск: плавный переход к 1.12 бар; pClosed при этом ограничен 230°;
 *     1.12  бар — давление выпуска (235…350°);
 *     350…400   — переход к давлению впуска 0.92 бар;
 *     500…540   — переход от 0.92 к 0.95 бар перед сжатием.
 */
import { SPARK_ADV, VS, VC } from '../config/engine-spec.js';
import { clamp01, mod, lerp, smooth } from './math.js';
import { pistonPinY, PIN_TDC, PIN_BDC } from './kinematics.js';

/**
 * Объём над поршнем.
 * @param {number} phi φ — фаза цилиндра, ГРАДУСЫ (0 — ВМТ), любое число.
 * @returns {number} объём, см³: VC в ВМТ … VC + VS в НМТ.
 * Источник: Engine.html:1944.
 */
export function volumeAt(phi) { return VC + VS * (PIN_TDC - pistonPinY(phi)) / (PIN_TDC - PIN_BDC); }

/**
 * Давление при закрытых клапанах: политропа плюс прирост от сгорания.
 * Объём здесь считается той же формулой, что в volumeAt (копия в legacy, Engine.html:1946), — не объединено.
 * @param {number} pc угол от ВМТ рабочего хода, ГРАДУСЫ; рабочий диапазон −180…230.
 * @returns {number} давление, бар.
 * Источник: Engine.html:1945–1949.
 */
export function pClosed(pc) {   // pc: −180 … 230 relative to firing TDC
  const V = VC + VS * (PIN_TDC - pistonPinY(pc)) / (PIN_TDC - PIN_BDC);
  const t = clamp01((pc + SPARK_ADV) / 62), xb = 1 - Math.exp(-5 * t * t * t);
  return 0.95 * Math.pow((VC + VS) / V, 1.32) + xb * 47 * Math.pow(VC / V, 1.32);
}

/**
 * Давление в цилиндре по фазе.
 * @param {number} phi φ — фаза цилиндра, ГРАДУСЫ, любое число (приводится по модулю 720).
 * @returns {number} давление, бар.
 * Источник: Engine.html:1950–1958.
 */
export function pressureAt(phi) {
  phi = mod(phi, 720);
  const pc = phi >= 540 ? phi - 720 : phi;     // −180 … 540
  if (pc < 139) return pClosed(pc);
  if (pc < 235) return lerp(pClosed(Math.min(pc, 230)), 1.12, smooth(139, 235, pc));
  if (pc < 350) return 1.12;
  if (pc < 400) return lerp(1.12, 0.92, smooth(350, 400, pc));
  return lerp(0.92, 0.95, smooth(500, 540, pc));
}

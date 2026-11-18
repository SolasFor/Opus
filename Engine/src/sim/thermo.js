/**
 * @file Объём и давление в цилиндре для p–V-диаграммы V12 (слой sim, уровень L2).
 *
 * Эмпирическая модель частичной/полной нагрузки на основе геометрии V12 (Ø 88 × 75 мм, CR = 11,5).
 * Давление — бар (иллюстративное); объём — см³ (VC … VC + VS).
 */
import { SPARK_ADV, VS, VC } from '../config/engine-spec.js';
import { clamp01, mod, lerp, smooth } from './math.js';
import { pistonPinY, PIN_TDC, PIN_BDC } from './kinematics.js';

export function volumeAt(phi) {
  return VC + VS * (PIN_TDC - pistonPinY(phi)) / (PIN_TDC - PIN_BDC);
}

export function pClosed(pc) {
  const V = VC + VS * (PIN_TDC - pistonPinY(pc)) / (PIN_TDC - PIN_BDC);
  const t = clamp01((pc + SPARK_ADV) / 62), xb = 1 - Math.exp(-5 * t * t * t);
  return 0.95 * Math.pow((VC + VS) / V, 1.32) + xb * 47 * Math.pow(VC / V, 1.32);
}

export function pressureAt(phi) {
  phi = mod(phi, 720);
  const pc = phi >= 540 ? phi - 720 : phi;
  if (pc < 139) return pClosed(pc);
  if (pc < 235) return lerp(pClosed(Math.min(pc, 230)), 1.12, smooth(139, 235, pc));
  if (pc < 350) return 1.12;
  if (pc < 400) return lerp(1.12, 0.92, smooth(350, 400, pc));
  return lerp(0.92, 0.95, smooth(500, 540, pc));
}

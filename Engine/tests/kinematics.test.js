/**
 * Физические инварианты Engine/src для 60° V12 DOHC 48V (5,5 л, 88 × 75 мм, CR 11,5).
 * Проверяет геометрию рядов ±30°, 6 общих шатунных шеек (расстояние запястья-кривошип === ROD_L),
 * рабочий объём, степень сжатия, порядок вспышек 1-7-5-11-3-9-6-12-2-8-4-10, 48-клапанный ГРМ и термодинамику.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEG, CYLINDERS, BANKS, CYL_PER_BANK, V_ANGLE_DEG, BANK_TILT_DEG,
  FIRE_A, FIRE_B, FIRE_DEG, FIRING_ORDER, THROW_PSI,
  CRANK_R, ROD_L, CAM_LIFT, CAM_HALF, IN_MID, EX_MID, VS, VC,
  bankOf, bankAngle
} from '../src/config/engine-spec.js';
import * as spec from '../src/config/engine-spec.js';
import { cycleDeg, cylinderPhaseDeg, strokeOf } from '../src/sim/cycle.js';
import { pistonPinDist, PIN_TDC_R, PIN_BDC_R, pistonPinY, PIN_TDC, PIN_BDC, crankPinYZ, wristPinYZ } from '../src/sim/kinematics.js';
import { camProfileLift, valveDownAngle, lobeAngle, valveSideLocal } from '../src/sim/valvetrain.js';
import { volumeAt, pressureAt } from '../src/sim/thermo.js';

const EPS = 1e-12;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≉ ${b} (±${eps})`);
const nearDeg720 = (a, b, eps, msg) => {
  const d = Math.abs(a - b) % 720;
  assert.ok(Math.min(d, 720 - d) <= eps, `${msg}: ${a}° ≉ ${b}°`);
};
const grid = (from, to, step) => {
  const r = [];
  for (let k = 0; from + k * step <= to + 1e-9; k++) r.push(from + k * step);
  return r;
};

test('спецификация V12 60°: размеры в мм и единицы сцены', () => {
  const { U_MM, BORE_MM, STROKE_MM, ROD_MM, COMPRESSION_HEIGHT_MM, VALVE_LIFT_MM, CR, BORE_R, PIN_TOP } = spec;
  assert.equal(U_MM, 100, '1 ед. = 100 мм');
  assert.equal(CYLINDERS, 12);
  assert.equal(BANKS, 2);
  assert.equal(CYL_PER_BANK, 6);
  assert.equal(V_ANGLE_DEG, 60);
  assert.equal(BANK_TILT_DEG, 30);
  assert.equal(CYLINDERS, FIRE_DEG.length);
  near(2 * BORE_R * U_MM, 88, EPS, 'D, мм');
  near(2 * CRANK_R * U_MM, 75, EPS, 'S = 2R, мм');
  near(ROD_L * U_MM, 138, EPS, 'L, мм');
  near(PIN_TOP * U_MM, 24, EPS, 'компрессионная высота, мм');
  near(CAM_LIFT * U_MM, 10.2, EPS, 'подъём клапана, мм');
  assert.deepEqual([BORE_MM, STROKE_MM, ROD_MM, COMPRESSION_HEIGHT_MM, VALVE_LIFT_MM, CR], [88, 75, 138, 24, 10.2, 11.5]);
  near(Math.abs(bankAngle(1) - bankAngle(0)) / DEG, 60, EPS, 'развал 60°');
});

test('рабочий объём V12: VS = π/4 · D² · S, 12 · VS ≈ 5473,91 см³, CR = 11,5', () => {
  near(VS, Math.PI / 4 * 8.8 * 8.8 * 7.5, 1e-9, 'VS, см³');
  near(spec.DISPLACEMENT_CM3, 12 * VS, 1e-9, 'рабочий объём, см³');
  near(12 * VS, 5473.911, 0.01, '12 · VS, см³');
  near((VS + VC) / VC, spec.CR, EPS, 'степень сжатия');
  near(VC, VS / 10.5, 1e-9, 'VC, см³');
});

test('ход поршня = 2 · CRANK_R; ВМТ и НМТ — крайние положения вдоль оси ряда', () => {
  near(PIN_TDC_R - PIN_BDC_R, 2 * CRANK_R, EPS, 'ход, u');
  near(PIN_TDC - PIN_BDC, 2 * CRANK_R, EPS, 'эквивалентный ход, u');
  for (const phi of grid(-720, 720, 0.5)) {
    const r = pistonPinDist(phi);
    assert.ok(r <= PIN_TDC_R + EPS && r >= PIN_BDC_R - EPS, `pistonPinDist(${phi}) = ${r}`);
  }
});

test('pistonPinDist: симметрия φ ↔ −φ, период 360° и точная формула КШМ', () => {
  for (const phi of grid(0, 360, 1)) {
    near(pistonPinDist(-phi), pistonPinDist(phi), EPS, `симметрия ${phi}`);
    near(pistonPinDist(phi + 360), pistonPinDist(phi), EPS, `период ${phi}`);
    const a = phi * DEG;
    const x = CRANK_R * (1 - Math.cos(a)) + ROD_L - Math.sqrt(ROD_L ** 2 - (CRANK_R * Math.sin(a)) ** 2);
    near(PIN_TDC_R - pistonPinDist(phi), x, EPS, `x(${phi}°)`);
  }
  assert.ok(PIN_TDC_R - pistonPinDist(90) > CRANK_R);
});

test('общие 6 шатунных шеек: расстояние от запястья до шейки строго равно ROD_L для всех 12 цилиндров', () => {
  assert.equal(THROW_PSI.length, 6);
  for (const deg of grid(0, 715, 15)) {
    const th = deg * DEG;
    for (let c = 0; c < CYLINDERS; c++) {
      const [cy, cz] = crankPinYZ(th, c % 6);
      const [wy, wz] = wristPinYZ(th, c);
      near(Math.hypot(wy - cy, wz - cz), ROD_L, 1e-12, `θ=${deg}°, ц.${c + 1}`);
    }
  }
});

test('объём: VC в ВМТ, VC + VS в НМТ, степень сжатия 11,5', () => {
  near((VS + VC) / VC, 11.5, EPS, 'степень сжатия');
  near(volumeAt(0), VC, 1e-9, 'V(0°), см³');
  near(volumeAt(180), VS + VC, 1e-9, 'V(180°), см³');
  for (const phi of grid(0, 720, 0.5)) {
    const v = volumeAt(phi);
    assert.ok(v >= VC - 1e-9 && v <= VC + VS + 1e-9, `V(${phi}°) = ${v} см³`);
  }
});

test('фазы V12: равномерные вспышки каждые 60°, порядок 1-7-5-11-3-9-6-12-2-8-4-10', () => {
  near(cycleDeg(Math.PI), 180, 1e-9);
  nearDeg720(cycleDeg(4 * Math.PI), 0, 1e-9);
  near(cycleDeg(-Math.PI / 2), 630, 1e-9);
  for (let i = 0; i < CYLINDERS; i++) nearDeg720(cylinderPhaseDeg(FIRE_DEG[i] * DEG, i), 0, 1e-9, `ц.${i + 1}`);
  const order = Array.from({ length: 12 }, (_, i) => i).sort((a, b) => FIRE_DEG[a] - FIRE_DEG[b]);
  assert.deepEqual(order, FIRING_ORDER);
  assert.deepEqual(order.map(i => i + 1), [1, 7, 5, 11, 3, 9, 6, 12, 2, 8, 4, 10]);
  const times = order.map(i => FIRE_DEG[i]);
  assert.deepEqual(times, Array.from({ length: 12 }, (_, k) => k * 60), 'интервал ровно 60°');
  assert.equal(FIRE_B.length, FIRE_A.length);
});

test('такты и кулачки 48 клапанов: впуск 349…581°, выпуск 139…371° на обоих рядах', () => {
  for (const phi of grid(0, 719.75, 0.25)) assert.equal(strokeOf(phi), Math.floor(phi / 180), `φ = ${phi}°`);
  near(camProfileLift(0), CAM_LIFT, EPS, 'вершина, u');
  assert.equal(camProfileLift(CAM_HALF), 0);

  near(IN_MID - 2 * CAM_HALF / DEG, 349, 1e-9);
  near(IN_MID + 2 * CAM_HALF / DEG, 581, 1e-9);
  near(EX_MID - 2 * CAM_HALF / DEG, 139, 1e-9);
  near(EX_MID + 2 * CAM_HALF / DEG, 371, 1e-9);

  assert.equal(valveSideLocal(0, 'intake'), 1);
  assert.equal(valveSideLocal(1, 'intake'), -1);
  assert.equal(valveSideLocal(0, 'exhaust'), -1);
  assert.equal(valveSideLocal(1, 'exhaust'), 1);

  const lift = (type, cyl, phi) => {
    const th = (phi + FIRE_DEG[cyl]) * DEG;
    return camProfileLift(th / 2 + lobeAngle(type, cyl) - valveDownAngle(bankOf(cyl), type));
  };
  for (const [type, open, close, mid] of [['intake', 349, 581, IN_MID], ['exhaust', 139, 371, EX_MID]]) {
    for (let cyl = 0; cyl < CYLINDERS; cyl++) {
      near(lift(type, cyl, mid), CAM_LIFT, EPS, `${type}, ц. ${cyl + 1}`);
      for (const phi of grid(0, 719, 1)) {
        const l = lift(type, cyl, phi);
        if (phi > open + 0.01 && phi < close - 0.01) assert.ok(l > 0, `${type}, ц. ${cyl + 1}, φ = ${phi}°`);
        if (phi < open - 0.01 || phi > close + 0.01) assert.equal(l, 0, `${type}, ц. ${cyl + 1}, φ = ${phi}°`);
      }
    }
  }
});

test('давление: период 720°, непрерывность и пределы при CR = 11,5', () => {
  for (const phi of grid(0, 720, 0.5)) near(pressureAt(phi + 720), pressureAt(phi), 1e-9, `период, φ = ${phi}°`);
  for (const b of [0, 139, 230, 235, 350, 400, 500, 540, 720]) near(pressureAt(b - 1e-7), pressureAt(b + 1e-7), 1e-4, `стык ${b}°`);
  let min = Infinity, max = -Infinity;
  for (const phi of grid(0, 720, 0.1)) {
    const p = pressureAt(phi);
    min = Math.min(min, p);
    max = Math.max(max, p);
  }
  near(min, 0.92, EPS, 'минимум — давление впуска, бар');
  assert.ok(max > 28 && max < 36, `максимум ${max} бар`);
});

test('параметры неизменяемы', () => {
  assert.ok(Object.isFrozen(FIRE_DEG) && Object.isFrozen(FIRING_ORDER) && Object.isFrozen(THROW_PSI));
  assert.throws(() => { FIRE_DEG[0] = 1; }, TypeError);
});

/**
 * Физические инварианты M-01a для Engine/src (с допусками, без эталонов legacy).
 * Проверяют смысл формул и единицы: ход и крайние положения поршня, степень сжатия, фазы и порядок работы,
 * такты, профиль кулачка, окна клапанов, период и непрерывность давления, неизменяемость параметров.
 *
 * Запуск из корня репозитория: node --test "Engine/tests/*.test.js"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEG, FIRE_DEG, CRANK_R, ROD_L, CAM_LIFT, CAM_HALF, IN_MID, EX_MID, VS, VC } from '../src/config/engine-spec.js';
import { cycleDeg, cylinderPhaseDeg, strokeOf } from '../src/sim/cycle.js';
import { pistonPinY, PIN_TDC, PIN_BDC } from '../src/sim/kinematics.js';
import { camProfileLift, valveDownAngle, lobeAngle } from '../src/sim/valvetrain.js';
import { volumeAt, pressureAt } from '../src/sim/thermo.js';

const EPS = 1e-12;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≉ ${b} (±${eps})`);
// сравнение углов по модулю 720°: 0° и 719,999…° считаются близкими
const nearDeg720 = (a, b, eps, msg) => {
  const d = Math.abs(a - b) % 720;
  assert.ok(Math.min(d, 720 - d) <= eps, `${msg}: ${a}° ≉ ${b}°`);
};
const grid = (from, to, step) => {
  const r = [];
  for (let k = 0; from + k * step <= to + 1e-9; k++) r.push(from + k * step);
  return r;
};

test('ход поршня = 2 · CRANK_R; ВМТ и НМТ — крайние положения', () => {
  near(PIN_TDC - PIN_BDC, 2 * CRANK_R, EPS, 'ход, u');
  for (const phi of grid(-720, 720, 0.5)) {
    const y = pistonPinY(phi);
    assert.ok(y <= PIN_TDC + EPS && y >= PIN_BDC - EPS, `pistonPinY(${phi}) = ${y} вне [PIN_BDC, PIN_TDC]`);
  }
});

test('pistonPinY: симметрия φ ↔ −φ и период 360°', () => {
  for (const phi of grid(0, 360, 0.25)) {
    near(pistonPinY(-phi), pistonPinY(phi), EPS, `симметрия, φ = ${phi}°`);
    near(pistonPinY(phi + 360), pistonPinY(phi), EPS, `период, φ = ${phi}°`);
  }
});

test('pistonPinY: точная формула кривошипно-шатунного механизма', () => {
  // смещение от ВМТ: x(φ) = r·(1 − cos φ) + l − √(l² − r²·sin² φ), r = CRANK_R, l = ROD_L (u)
  for (const phi of grid(0, 360, 1)) {
    const a = phi * DEG;
    const x = CRANK_R * (1 - Math.cos(a)) + ROD_L - Math.sqrt(ROD_L ** 2 - (CRANK_R * Math.sin(a)) ** 2);
    near(PIN_TDC - pistonPinY(phi), x, EPS, `x(${phi}°)`);
  }
  // при 90° поршень уже ниже середины хода — следствие конечной длины шатуна
  assert.ok(PIN_TDC - pistonPinY(90) > CRANK_R);
});

test('объём: VC в ВМТ, VC + VS в НМТ, степень сжатия 10,5', () => {
  near((VS + VC) / VC, 10.5, EPS, 'степень сжатия');
  near(volumeAt(0), VC, 1e-9, 'V(0°), см³');
  near(volumeAt(180), VS + VC, 1e-9, 'V(180°), см³');
  for (const phi of grid(0, 720, 0.5)) {
    const v = volumeAt(phi);
    assert.ok(v >= VC - 1e-9 && v <= VC + VS + 1e-9, `V(${phi}°) = ${v} см³`);
  }
});

test('фазы: θ в радианах, цикл 720°, порядок работы 1-3-4-2', () => {
  near(cycleDeg(Math.PI), 180, 1e-9, 'θ = π рад');
  nearDeg720(cycleDeg(4 * Math.PI), 0, 1e-9, 'θ = 4π рад — полный цикл');
  near(cycleDeg(-Math.PI / 2), 630, 1e-9, 'θ = −π/2 рад');
  for (const theta of grid(-20, 60, 0.37)) {
    for (let i = 0; i < 4; i++) nearDeg720(cylinderPhaseDeg(theta, i), cycleDeg(theta) - FIRE_DEG[i], 1e-9, `φ${i}(θ = ${theta})`);
  }
  // при θ = FIRE_DEG[i]° цилиндр i в ВМТ начала рабочего хода
  for (let i = 0; i < 4; i++) nearDeg720(cylinderPhaseDeg(FIRE_DEG[i] * DEG, i), 0, 1e-9, `цилиндр ${i + 1}`);
  // с ростом θ рабочий ход начинается в цилиндрах 1, 3, 4, 2
  const order = [0, 1, 2, 3].sort((a, b) => FIRE_DEG[a] - FIRE_DEG[b]).map(i => i + 1);
  assert.deepEqual(order, [1, 3, 4, 2]);
});

test('такты: по 180° — рабочий ход, выпуск, впуск, сжатие', () => {
  for (const phi of grid(0, 719.75, 0.25)) assert.equal(strokeOf(phi), Math.floor(phi / 180), `φ = ${phi}°`);
  for (const phi of grid(0, 719, 1)) assert.equal(strokeOf(phi + 720), strokeOf(phi), `период, φ = ${phi}°`);
});

test('профиль кулачка: вершина = CAM_LIFT, вне ±CAM_HALF — 0, симметрия, период 2π', () => {
  near(camProfileLift(0), CAM_LIFT, EPS, 'вершина, u');
  assert.equal(camProfileLift(CAM_HALF), 0);
  for (const psi of grid(-Math.PI, Math.PI, 0.001)) {
    const l = camProfileLift(psi);
    assert.ok(l >= 0 && l <= CAM_LIFT + EPS, `ψ = ${psi} рад`);
    if (Math.abs(psi) >= CAM_HALF + 1e-9) assert.equal(l, 0, `ψ = ${psi} рад вне профиля`);
    near(camProfileLift(-psi), l, EPS, `симметрия, ψ = ${psi}`);
    near(camProfileLift(psi + 2 * Math.PI), l, EPS, `период, ψ = ${psi}`);
  }
});

test('окна клапанов: впуск 349…581°, выпуск 139…371° (подъём — как в Engine.html:1406)', () => {
  // открытие = середина ± 2·CAM_HALF: угол распредвала переводится в угол коленвала
  near(IN_MID - 2 * CAM_HALF / DEG, 349, 1e-9, 'впуск открывается за 11° до ВМТ');
  near(IN_MID + 2 * CAM_HALF / DEG, 581, 1e-9, 'впуск закрывается через 41° после НМТ');
  near(EX_MID - 2 * CAM_HALF / DEG, 139, 1e-9, 'выпуск открывается');
  near(EX_MID + 2 * CAM_HALF / DEG, 371, 1e-9, 'выпуск закрывается');
  const lift = (type, cyl, phi) => {
    const th = (phi + FIRE_DEG[cyl]) * DEG; // θ, рад: при нём фаза цилиндра cyl равна φ
    return camProfileLift(th / 2 + lobeAngle(type, cyl) - valveDownAngle(type));
  };
  for (const [type, open, close, mid] of [['intake', 349, 581, IN_MID], ['exhaust', 139, 371, EX_MID]]) {
    for (let cyl = 0; cyl < 4; cyl++) {
      near(lift(type, cyl, mid), CAM_LIFT, EPS, `${type}, ц. ${cyl + 1}: полный подъём в середине`);
      for (const phi of grid(0, 719.5, 0.5)) {
        const l = lift(type, cyl, phi);
        if (phi > open + 0.01 && phi < close - 0.01) assert.ok(l > 0, `${type}, ц. ${cyl + 1}, φ = ${phi}°: должен быть открыт`);
        if (phi < open - 0.01 || phi > close + 0.01) assert.equal(l, 0, `${type}, ц. ${cyl + 1}, φ = ${phi}°: должен быть закрыт`);
      }
    }
  }
});

test('давление: период 720°, непрерывность на стыках участков, пределы', () => {
  for (const phi of grid(0, 720, 0.25)) near(pressureAt(phi + 720), pressureAt(phi), 1e-9, `период, φ = ${phi}°`);
  for (const b of [0, 139, 230, 235, 350, 400, 500, 540, 720]) near(pressureAt(b - 1e-7), pressureAt(b + 1e-7), 1e-4, `стык ${b}°`);
  let min = Infinity, max = -Infinity;
  for (const phi of grid(0, 720, 0.1)) {
    const p = pressureAt(phi);
    min = Math.min(min, p);
    max = Math.max(max, p);
  }
  near(min, 0.92, EPS, 'минимум — давление впуска, бар');
  assert.ok(max > 27.4 && max < 27.5, `максимум ${max} бар`);
});

test('параметры неизменяемы', () => {
  assert.ok(Object.isFrozen(FIRE_DEG));
  assert.throws(() => { FIRE_DEG[0] = 1; }, TypeError);
});

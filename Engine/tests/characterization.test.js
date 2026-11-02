/**
 * Характеризационные тесты M-01a: модули Engine/src обязаны давать те же числа, что функции
 * Engine/Engine.html@10c79c8 (blob 6940e9e).
 *
 * Эталоны получены исполнением исходных функций legacy (Engine.html:424–447, 456–460, 1098–1103,
 * 1115–1119, 1367–1384, 1943–1958) в Node 24.22.1 с three r160; генератор хранится вне репозитория.
 * Числа записаны в кратчайшей точной десятичной форме.
 *
 * Сравнение комбинированное:
 *   точно (assert.equal, Object.is) — значения, которые получаются только из +, −, ×, ÷, %, сравнений,
 *     Math.floor, Math.round, Math.abs, Math.min, Math.max, Math.sqrt. IEEE-754 и ECMAScript задают
 *     их результат однозначно, он не зависит от движка. Это параметры, фазы и такты, направления
 *     клапанов, помощники math, ветки pressureAt без pClosed и нулевая ветка camProfileLift.
 *   до MAX_ULP = 2 ULP (assertUlp) — значения, зависящие от Math.sin, Math.cos, Math.exp, Math.pow:
 *     ECMAScript разрешает приближённую реализацию этих функций. 2 ULP — эмпирическая граница, а не
 *     гарантия JavaScript: Chromium и Node песочницы расходились не более чем на 1 ULP
 *     (pressureAt(20°), Math.exp). Это pistonPinY, PIN_TDC, PIN_BDC, volumeAt, pClosed,
 *     pressureAt через pClosed и подъём кулачка вне нулевой ветки.
 * Точный паритет с legacy в одной среде выполнения (функции Engine.html@10c79c8 и модули в одном
 * процессе, сравнение Object.is) проверяется отдельно, вне репозитория (проверка V3).
 *
 * Ограничение: перестановку операций на путях с sin, cos, exp, pow, которая меняет результат
 * не больше чем на 2 ULP, эти тесты не обнаружат; её обнаруживает V3.
 * При обновлении Node эталоны автоматически не переснимаются: если тест упал, сначала выяснить
 * причину расхождения.
 *
 * Запуск из корня репозитория: node --test "Engine/tests/*.test.js"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as spec from '../src/config/engine-spec.js';
import { clamp, clamp01, mod, lerp, smooth } from '../src/sim/math.js';
import { cycleDeg, cylinderPhaseDeg, strokeOf } from '../src/sim/cycle.js';
import { pistonPinY, PIN_TDC, PIN_BDC } from '../src/sim/kinematics.js';
import { camProfileLift, valveDownAngle, lobeAngle } from '../src/sim/valvetrain.js';
import { volumeAt, pClosed, pressureAt } from '../src/sim/thermo.js';

// Расстояние в ULP: разность порядковых номеров битовых образов IEEE-754 (+0 и −0 — один номер).
// NaN совпадает только с NaN.
const MAX_ULP = 2;
const view = new DataView(new ArrayBuffer(8));
function ordinal(x) {
  view.setFloat64(0, x);
  const bits = view.getBigInt64(0);
  return bits < 0n ? -(bits & 0x7fffffffffffffffn) : bits;
}
function ulpDistance(a, b) {
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b) ? 0 : Infinity;
  const d = ordinal(a) - ordinal(b);
  return Number(d < 0n ? -d : d);
}
function assertUlp(actual, expected, message) {
  const d = ulpDistance(actual, expected);
  assert.ok(d <= MAX_ULP, `${message}: ${actual} вместо ${expected}, ${d} ULP > ${MAX_ULP}`);
}

test('ulpDistance: опорные значения', () => {
  assert.equal(ulpDistance(1, 1), 0);
  assert.equal(ulpDistance(0, -0), 0);
  assert.equal(ulpDistance(1, 1 + Number.EPSILON), 1);
  assert.equal(ulpDistance(1 - Number.EPSILON / 2, 1), 1);
  assert.equal(ulpDistance(5e-324, -5e-324), 2);
  assert.equal(ulpDistance(-2, -2 - 2 * Number.EPSILON), 1);
  assert.equal(ulpDistance(NaN, NaN), 0);
  assert.equal(ulpDistance(NaN, 1), Infinity);
  assert.equal(ulpDistance(1, 1 + 3 * Number.EPSILON), 3);
});

// [имя, значение legacy]
const CONSTANTS = [
  ['DEG', 0.017453292519943295],
  ['CRANK_Y', 0.55],
  ['CRANK_R', 0.36],
  ['ROD_L', 1.25],
  ['BORE_R', 0.425],
  ['VALVE_TILT', 0.20943951023931956],
  ['CAM_LIFT', 0.092],
  ['CAM_HALF', 1.0122909661567112],
  ['IN_MID', 465],
  ['EX_MID', 255],
  ['SPARK_ADV', 10],
  ['VS', 499.6],
  ['VC', 52.58947368421053],
];

test('параметры совпадают с legacy', () => {
  for (const [name, value] of CONSTANTS) assert.equal(spec[name], value, name);
  assert.deepEqual([...spec.FIRE_DEG], [0, 540, 180, 360]);
  assertUlp(PIN_TDC, 2.16, 'PIN_TDC');   // через pistonPinY: cos, sin
  assertUlp(PIN_BDC, 1.44, 'PIN_BDC');
});

// [φ, °; давление legacy, бар]: углы validation §5 и дополнительные
const PRESSURE = [
  [0, 22.144430222169024],
  [10, 25.287762093970823],
  [20, 27.47348536754257],
  [30, 25.573101873140242],
  [60, 11.269658090592515],
  [90, 5.794954386852943],
  [139, 3.4123992455667467],
  [180, 2.291577181630552],
  [235, 1.12],
  [300, 1.12],
  [360, 1.0992000000000002],
  [400, 0.92],
  [540, 0.95],
  [600, 1.227670158833265],
  [700, 14.015814325940514],
  [710, 18.82864814428083],
  [-10, 18.82864814428083],
  [52, 14.283222599978156],
  [230, 1.1396421583296794],
  [520, 0.935],
  [1440.5, 22.289521772278945],
  [-359.25, 1.0962403500000002],
];
// точно: φ, где pressureAt не вызывает pClosed (pc ≥ 235°: плато 1,12 бар и переходы lerp/smooth)
const PRESSURE_EXACT = new Set([235, 300, 360, 400, 520, -359.25]);
// validation §5: те же углы, значения с округлением до 0,001 бар
const VALIDATION = [
  [0, 22.144],
  [10, 25.288],
  [20, 27.473],
  [30, 25.573],
  [60, 11.27],
  [90, 5.795],
  [139, 3.412],
  [180, 2.292],
  [235, 1.12],
  [300, 1.12],
  [360, 1.099],
  [400, 0.92],
  [540, 0.95],
  [600, 1.228],
  [700, 14.016],
  [710, 18.829],
];

test('pressureAt: контрольные углы', () => {
  for (const [phi, p] of PRESSURE) {
    if (PRESSURE_EXACT.has(phi)) assert.equal(pressureAt(phi), p, `φ = ${phi}°`);
    else assertUlp(pressureAt(phi), p, `φ = ${phi}°`);
  }
  // точно: при ±2 ULP давления запас до границы округления — не меньше 4·10⁹ ULP
  for (const [phi, p] of VALIDATION) assert.equal(Math.round(pressureAt(phi) * 1000) / 1000, p, `validation §5, φ = ${phi}°`);
});

test('pressureAt: пик на сетке 0,1°', () => {
  let best = -Infinity, bestK = -1;
  for (let k = 0; k <= 7200; k++) { const p = pressureAt(k * 0.1); if (p > best) { best = p; bestK = k; } }
  assertUlp(best, 27.493791627547665, 'пик');
  assert.equal(bestK, 209); // φ ≈ 20.9°; точно: второе по величине значение ниже пика на 2,4·10¹⁰ ULP
});

// [pc, ° от ВМТ рабочего хода; давление legacy, бар]
const P_CLOSED = [
  [-180, 0.95],
  [-90, 1.807927304965999],
  [-10, 18.82864814428083],
  [0, 22.144430222169024],
  [20.9, 27.493791627547683],
  [52, 14.283222599978156],
  [139, 3.4123992455667467],
  [230, 3.6204495815780047],
];

test('pClosed', () => {
  for (const [pc, p] of P_CLOSED) assertUlp(pClosed(pc), p, `pc = ${pc}°`);
});

// [φ, °; pistonPinY, u; volumeAt, см³]
const KINEMATICS = [
  [0, 2.16, 52.58947368421053],
  [45, 2.028363981335552, 143.9302444130414],
  [90, 1.7470380110923798, 339.1392093206648],
  [135, 1.5192470988812379, 497.20079229384044],
  [180, 1.44, 552.1894736842105],
  [225, 1.5192470988812379, 497.20079229384044],
  [270, 1.7470380110923798, 339.1392093206648],
  [315, 2.028363981335552, 143.9302444130414],
  [360, 2.16, 52.58947368421053],
  [405, 2.028363981335552, 143.9302444130414],
  [450, 1.7470380110923798, 339.1392093206648],
  [495, 1.5192470988812377, 497.2007922938406],
  [540, 1.44, 552.1894736842105],
  [585, 1.5192470988812379, 497.20079229384044],
  [630, 1.7470380110923798, 339.1392093206648],
  [675, 2.028363981335552, 143.9302444130414],
  [720, 2.16, 52.58947368421053],
  [12.5, 2.149035696759744, 60.1974818770326],
  [-77.7, 1.826183123332716, 284.2212953272316],
];

test('pistonPinY и volumeAt', () => {
  for (const [phi, y, v] of KINEMATICS) {
    assertUlp(pistonPinY(phi), y, `pistonPinY(${phi})`);
    assertUlp(volumeAt(phi), v, `volumeAt(${phi})`);
  }
});

// [θ, РАДИАНЫ; cycleDeg, °; фазы цилиндров 0…3, °] — legacy: sim.theta = θ, cycDeg(), phaseOf(i)
const CYCLE = [
  [0, 0, [0, 180, 540, 360]],
  [1, 57.29577951308238, [57.29577951308238, 237.29577951308232, 597.2957795130824, 417.2957795130823]],
  [3.141592653589793, 180, [180, 360, 0, 540]],
  [12.566370614359172, 0, [0, 180, 540, 360]],
  [-2.5, 576.7605512172942, [576.7605512172942, 36.760551217294164, 396.76055121729416, 216.76055121729416]],
  [100.123, 696.6253321883414, [696.6253321883414, 156.62533218834142, 516.6253321883414, 336.6253321883414]],
  [12345.678, 315.2446275111288, [315.2446275111288, 495.2446275111288, 135.24462751112878, 675.2446275111288]],
];

test('cycleDeg и cylinderPhaseDeg (θ в радианах)', () => {
  for (const [theta, deg, phases] of CYCLE) {
    assert.equal(cycleDeg(theta), deg, `cycleDeg(${theta})`);
    phases.forEach((phi, i) => assert.equal(cylinderPhaseDeg(theta, i), phi, `cylinderPhaseDeg(${theta}, ${i})`));
  }
});

// [φ, °; номер такта]
const STROKES = [
  [0, 0],
  [90, 0],
  [179.999, 0],
  [180, 1],
  [359.999, 1],
  [360, 2],
  [540, 3],
  [719.999, 3],
  [720, 0],
  [-0.001, 3],
  [-180, 3],
  [1000000, 3],
];

test('strokeOf: границы тактов', () => {
  for (const [phi, s] of STROKES) assert.equal(strokeOf(phi), s, `strokeOf(${phi})`);
});

// [ψ, рад распредвала; подъём, u]
const CAM = [
  [0, 0.092],
  [0.25, 0.07883560799698404],
  [-0.25, 0.07883560799698404],
  [0.5, 0.046877267501374005],
  [1, 0.000033460794302912596],
  [1.0122909661567112, 0],
  [1.0122909651567111, 2.215216823077402e-19],
  [3.141592653589793, 0],
  [-3.141592653589793, 0],
  [7, 0.018022434858672713],
  [-7, 0.018022434858672713],
  [6.283185307179586, 0.092],
];

test('camProfileLift', () => {
  for (const [psi, lift] of CAM) {
    // нулевой подъём — ветка a ≥ CAM_HALF без cos: точно; остальные строки идут через Math.cos
    if (lift === 0) assert.equal(camProfileLift(psi), lift, `camProfileLift(${psi})`);
    else assertUlp(camProfileLift(psi), lift, `camProfileLift(${psi})`);
  }
});

// [тип; направление, рад] и [тип, цилиндр; β, рад]
const VALVE_DOWN = [
  ['intake', 2.9321531433504737],
  ['exhaust', 3.3510321638291125],
  ['другое', 3.3510321638291125],
];
const LOBES = [
  ['intake', 0, -1.1257373675363422],
  ['intake', 1, -5.8381263479210315],
  ['intake', 2, -2.696533694331239],
  ['intake', 3, -4.267330021126135],
  ['exhaust', 0, 1.1257373675363422],
  ['exhaust', 1, -3.5866516128483474],
  ['exhaust', 2, -0.4450589592585543],
  ['exhaust', 3, -2.015855286053451],
];

test('valveDownAngle и lobeAngle', () => {
  for (const [type, a] of VALVE_DOWN) assert.equal(valveDownAngle(type), a, type);
  for (const [type, cyl, b] of LOBES) assert.equal(lobeAngle(type, cyl), b, `${type}, цилиндр ${cyl}`);
});

// [аргументы…, результат legacy]
const HELPERS = {
  clamp: [
    [5, 0, 1, 1],
    [-1, 0, 1, 0],
    [0.3, 0, 1, 0.3],
    [2, 3, 1, 3],
  ],
  clamp01: [
    [1.5, 1],
    [-0.2, 0],
    [0.7, 0.7],
  ],
  mod: [
    [-30, 720, 690],
    [725.5, 720, 5.5],
    [-1e-20, 720, 0],
    [1440, 720, 0],
    [-720, 720, 0],
  ],
  lerp: [
    [1.12, 0.92, 0.25, 1.07],
    [0, 10, 0.5, 5],
    [5, 5, 0.3, 5],
  ],
  smooth: [
    [350, 400, 360, 0.10400000000000002],
    [139, 235, 139, 0],
    [139, 235, 235, 1],
    [500, 540, 520, 0.5],
    [0, 1, -1, 0],
    [0, 1, 2, 1],
  ],
};

test('помощники math', () => {
  const fns = { clamp, clamp01, mod, lerp, smooth };
  for (const [name, rows] of Object.entries(HELPERS)) {
    for (const r of rows) assert.equal(fns[name](...r.slice(0, -1)), r[r.length - 1], `${name}(${r.slice(0, -1).join(', ')})`);
  }
});

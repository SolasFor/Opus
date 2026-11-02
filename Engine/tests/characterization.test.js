/**
 * Характеризационные тесты: модули Engine/src обязаны давать те же числа, что функции Engine/Engine.html.
 *
 * M-01a: эталоны сняты с функций Engine/Engine.html@10c79c8 (blob 6940e9e).
 * D-05 (спецификация A): VS и VC считаются из 3D-геометрии Ø 85 × 72 мм, поэтому пересняты эталоны,
 * которые от них зависят: VS, VC, столбец volumeAt, строки pressureAt и pClosed с допуском ULP, пик.
 * Генератор хранится вне репозитория. Он исполняет функции Engine.html@10c79c8 (строки 424–447, 456–460,
 * 1098–1103, 1115–1119, 1367–1384, 1943–1958) с единственной заменой строки 1943 на выражение VS по A,
 * в Node 24.22.1 с three r160; модули Engine/src он не использует. Остальные эталоны не изменились.
 * Числа записаны в кратчайшей точной десятичной форме.
 *
 * Сравнение комбинированное:
 *   точно (assert.equal, Object.is) — значения, которые получаются только из +, −, ×, ÷, %, сравнений,
 *     Math.floor, Math.round, Math.abs, Math.min, Math.max, Math.sqrt. IEEE-754 и ECMAScript задают
 *     их результат однозначно, он не зависит от движка. Это параметры, фазы и такты, направления
 *     клапанов, помощники math, ветки pressureAt без pClosed и нулевая ветка camProfileLift.
 *   до MAX_ULP = 2 ULP (assertUlp) — значения, зависящие от Math.sin, Math.cos, Math.exp, Math.pow:
 *     ECMAScript разрешает приближённую реализацию этих функций. Это pistonPinY, PIN_TDC, PIN_BDC,
 *     volumeAt, pClosed, pressureAt через pClosed и подъём кулачка вне нулевой ветки.
 *
 * Допуск 2 ULP — эмпирическая граница для V8 (Node и Chromium), а не гарантия JavaScript. Он выдерживается,
 * только пока Math.sin и Math.cos дают побитно тот же результат, что в V8 (Chromium и Node песочницы расходились
 * не более чем на 1 ULP: pressureAt(20°), Math.exp). Сдвиг Math.cos на 1 ULP около ВМТ усиливается
 * вычитанием близких величин: до 35 ULP в volumeAt(12,5°) и до 31 ULP в pressureAt(30°). На другом движке
 * (JavaScriptCore — Safari, Bun) тесты с допуском могут упасть без ошибки в коде. Точные проверки от такого
 * сдвига не зависят.
 * Точный паритет с функциями Engine.html (в одном процессе, Object.is) проверяет legacy-parity.test.js:
 * он обнаруживает и перестановку операций на путях с sin, cos, exp, pow, которую допуск 2 ULP пропускает.
 * При обновлении Node эталоны автоматически не переснимаются: если тест упал, сначала выяснить
 * причину расхождения.
 *
 * Требования к Node: 20.19+ (линия 20) или 22.7+. Файлы — ES-модули без package.json, нужно автоопределение
 * синтаксиса модулей; на 18.20.8, 20.18.3, 21.7.3, 22.6.0 — «SyntaxError: Cannot use import statement outside a module».
 * Запуск из корня репозитория:
 *   Node 22.7+:   node --test "Engine/tests/*.test.js"
 *   Node 20.19+:  node --test Engine/tests/*.test.js   (шаблон раскрывает оболочка: Node 20 не принимает шаблоны в --test)
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
  ['VS', 408.5641245993526],
  ['VC', 43.00674995782659],
];

test('параметры совпадают с legacy', () => {
  for (const [name, value] of CONSTANTS) assert.equal(spec[name], value, name);
  assert.deepEqual([...spec.FIRE_DEG], [0, 540, 180, 360]);
  assertUlp(PIN_TDC, 2.16, 'PIN_TDC');   // через pistonPinY: cos, sin
  assertUlp(PIN_BDC, 1.44, 'PIN_BDC');
});

// [φ, °; давление legacy, бар]: углы validation §5 и дополнительные
const PRESSURE = [
  [0, 22.144430222169028],
  [10, 25.287762093970823],
  [20, 27.47348536754258],
  [30, 25.573101873140242],
  [60, 11.269658090592515],
  [90, 5.794954386852942],
  [139, 3.4123992455667467],
  [180, 2.2915771816305517],
  [235, 1.12],
  [300, 1.12],
  [360, 1.0992000000000002],
  [400, 0.92],
  [540, 0.9499999999999998],
  [600, 1.2276701588332657],
  [700, 14.015814325940521],
  [710, 18.82864814428083],
  [-10, 18.82864814428083],
  [52, 14.283222599978153],
  [230, 1.1396421583296794],
  [520, 0.935],
  [1440.5, 22.28952177227895],
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
  [-180, 0.9499999999999998],
  [-90, 1.8079273049659987],
  [-10, 18.82864814428083],
  [0, 22.144430222169028],
  [20.9, 27.493791627547687],
  [52, 14.283222599978153],
  [139, 3.4123992455667467],
  [230, 3.620449581578006],
];

test('pClosed', () => {
  for (const [pc, p] of P_CLOSED) assertUlp(pClosed(pc), p, `pc = ${pc}°`);
});

// [φ, °; pistonPinY, u; volumeAt, см³]
const KINEMATICS = [
  [0, 2.16, 43.00674995782659],
  [45, 2.028363981335552, 117.70363152919361],
  [90, 1.7470380110923798, 277.3421020284508],
  [135, 1.5192470988812379, 406.6020945829413],
  [180, 1.44, 451.57087455717925],
  [225, 1.5192470988812379, 406.6020945829413],
  [270, 1.7470380110923798, 277.3421020284508],
  [315, 2.028363981335552, 117.70363152919361],
  [360, 2.16, 43.00674995782659],
  [405, 2.028363981335552, 117.70363152919361],
  [450, 1.7470380110923798, 277.3421020284508],
  [495, 1.5192470988812377, 406.60209458294133],
  [540, 1.44, 451.57087455717925],
  [585, 1.5192470988812379, 406.6020945829413],
  [630, 1.7470380110923798, 277.3421020284508],
  [675, 2.028363981335552, 117.70363152919361],
  [720, 2.16, 43.00674995782659],
  [12.5, 2.149035696759744, 49.22844572893358],
  [-77.7, 1.826183123332716, 232.4311943912419],
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

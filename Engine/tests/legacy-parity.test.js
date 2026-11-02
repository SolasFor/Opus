/**
 * Паритет функций Engine/Engine.html и модулей Engine/src (D-05; закрывает замечание m3 ревью M-01a).
 *
 * До M-01b Engine.html держит собственные копии функций модели. Тест извлекает их из текста страницы
 * (объявления, которые начинаются с начала строки), исполняет через new Function в той же среде
 * (тот же объект Math), что и модули, и сравнивает:
 *   1) значения — побитно (Object.is) на детерминированных сетках, случайных и особых входах;
 *   2) текст функций без комментариев и пробельных символов — тождественно. Для cycDeg и phaseOf
 *      изменяемый sim.theta заменяется явным аргументом thetaRad (имена в модулях: cycleDeg, cylinderPhaseDeg).
 * Так в репозитории проверяется то, что в M-01a делала внешняя проверка V3: перестановку операций,
 * которую не замечают эталоны characterization.test.js с допуском 2 ULP, этот тест обнаруживает.
 * Если формулу меняют намеренно, её меняют одновременно в Engine.html и в модуле.
 *
 * THREE.MathUtils.degToRad заменён заглушкой с семантикой three r160: degrees * (Math.PI / 180).
 * Без сторонних зависимостей.
 * Требования к Node: 20.19+ (линия 20) или 22.7+. Файлы — ES-модули без package.json, нужно автоопределение
 * синтаксиса модулей; на 18.20.8, 20.18.3, 21.7.3, 22.6.0 — «SyntaxError: Cannot use import statement outside a module».
 * Запуск из корня репозитория:
 *   Node 22.7+:   node --test "Engine/tests/*.test.js"
 *   Node 20.19+:  node --test Engine/tests/*.test.js   (шаблон раскрывает оболочка: Node 20 не принимает шаблоны в --test)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clamp, clamp01, mod, lerp, smooth } from '../src/sim/math.js';
import { cycleDeg, cylinderPhaseDeg, strokeOf } from '../src/sim/cycle.js';
import { pistonPinY, PIN_TDC, PIN_BDC } from '../src/sim/kinematics.js';
import { camProfileLift, valveDownAngle, lobeAngle } from '../src/sim/valvetrain.js';
import { volumeAt, pClosed, pressureAt } from '../src/sim/thermo.js';

const LINES = readFileSync(new URL('../Engine.html', import.meta.url), 'utf8').split('\n');
const DEG2RAD = Math.PI / 180;
const THREE_STUB = { MathUtils: { degToRad: degrees => degrees * DEG2RAD } };

// ---------- извлечение кода из Engine.html ----------

// Номер единственной строки, для которой re истинно (комментарий «//» в конце строки не учитывается).
function uniqueIndex(re, what) {
  const found = [];
  LINES.forEach((line, i) => { if (re.test(line.replace(/\/\/.*$/, ''))) found.push(i); });
  assert.equal(found.length, 1, `${what} в Engine.html: ${found.length}, ожидается 1`);
  return found[0];
}
// Объявление const с начала строки: одна строка; «const name = {» — до закрывающей «};».
function constDecl(name) {
  const i = uniqueIndex(new RegExp(`^const\\s(?:.*[\\s,])?${name}\\s*=(?!=)`), `объявлений const ${name}`);
  if (!/=\s*\{\s*$/.test(LINES[i].replace(/\/\/.*$/, ''))) return [i, i];
  const end = LINES.indexOf('};', i);
  assert.ok(end > i, `конец объявления ${name}`);
  return [i, end];
}
// Объявление function с начала строки: до строки, на которой скобки { } уравновешиваются.
function functionDecl(name) {
  const i = uniqueIndex(new RegExp(`^function ${name}\\(`), `объявлений function ${name}`);
  let depth = 0;
  for (let j = i; j < LINES.length; j++) {
    const code = LINES[j].replace(/\/\/.*$/, '');
    for (const ch of code) depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
    if (depth === 0 && code.includes('}')) return [i, j];
  }
  assert.fail(`конец функции ${name}`);
}

const CONSTS = ['DEG', 'FIRE_DEG', 'CRANK_Y', 'CRANK_R', 'ROD_L', 'BORE_R', 'VALVE_TILT', 'CAM_LIFT', 'CAM_HALF',
  'IN_MID', 'EX_MID', 'SPARK_ADV', 'VS', 'VC', 'clamp', 'clamp01', 'mod', 'lerp', 'smooth', 'sim',
  'cycDeg', 'phaseOf', 'strokeOf', 'PIN_TDC', 'PIN_BDC'];
const FUNCS = ['camProfileLift', 'valveDownAngle', 'lobeAngle', 'pistonPinY', 'volumeAt', 'pClosed', 'pressureAt'];

const ranges = [...CONSTS.map(constDecl), ...FUNCS.map(functionDecl)];
const starts = [...new Set(ranges.map(r => r[0]))].sort((a, b) => a - b);
const code = starts.map(s => { const [a, b] = ranges.find(r => r[0] === s); return LINES.slice(a, b + 1).join('\n'); }).join('\n');
const X = new Function('THREE', `'use strict';\n${code}\nreturn { ${[...CONSTS, ...FUNCS].join(', ')} };`)(THREE_STUB);

// ---------- входные данные: сетки, особые значения, детерминированный генератор ----------

let seed = 0x9e3779b9;
const rnd = () => {   // mulberry32
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const dv = new DataView(new ArrayBuffer(8));
const randomBits = () => { dv.setUint32(0, rnd() * 2 ** 32 >>> 0); dv.setUint32(4, rnd() * 2 ** 32 >>> 0); return dv.getFloat64(0); };
const ulpStep = (x, k) => { dv.setFloat64(0, x); dv.setBigInt64(0, dv.getBigInt64(0) + BigInt(k) * (x >= 0 ? 1n : -1n)); return dv.getFloat64(0); };
const SPECIAL = [0, -0, NaN, Infinity, -Infinity, 5e-324, -5e-324, 1e-300, 1.7976931348623157e308, -1.7976931348623157e308, 1, -1, 0.5];
const mixed = (lo, hi) => { const u = rnd(); return u < 0.1 ? SPECIAL[(rnd() * SPECIAL.length) | 0] : u < 0.25 ? randomBits() : lo + (hi - lo) * rnd(); };
const grid = (from, to, step) => { const r = []; for (let k = 0; from + k * step <= to; k++) r.push(from + k * step); return r; };
const randoms = (n, lo, hi) => Array.from({ length: n }, () => mixed(lo, hi));
const nearUlp = (xs, k = 16) => xs.flatMap(x => Array.from({ length: 2 * k + 1 }, (_, j) => ulpStep(x, j - k)));

function compare(name, inputs, moduleFn, legacyFn) {
  let n = 0, bad = 0, first = null;
  for (const x of inputs) {
    const a = moduleFn(x), b = legacyFn(x);
    n++;
    if (!Object.is(a, b)) { bad++; first ??= { input: x, module: a, legacy: b }; }
  }
  assert.equal(bad, 0, `${name}: ${bad} расхождений из ${n}; первое: ${JSON.stringify(first, (k, v) => typeof v === 'number' ? String(v) : v)}`);
  return n;
}

// ---------- значения ----------

test('значения: PIN_TDC и PIN_BDC', () => {
  assert.equal(PIN_TDC, X.PIN_TDC);
  assert.equal(PIN_BDC, X.PIN_BDC);
});

test('значения: помощники math', t => {
  const triples = Array.from({ length: 20000 }, () => [mixed(-1e3, 1e3), mixed(-1e3, 1e3), mixed(-1e3, 1e3)]);
  const PERIODS = [720, 360, 180, 2 * Math.PI, -720, 0, 0.7];
  const modArgs = [...triples.map((a, j) => [a[0], PERIODS[j % PERIODS.length]]), ...triples.map(a => [a[0], a[1]])];
  let n = 0;
  n += compare('clamp', triples, a => clamp(...a), a => X.clamp(...a));
  n += compare('clamp01', triples, a => clamp01(a[0]), a => X.clamp01(a[0]));
  n += compare('mod', modArgs, a => mod(...a), a => X.mod(...a));
  n += compare('lerp', triples, a => lerp(...a), a => X.lerp(...a));
  n += compare('smooth', triples, a => smooth(...a), a => X.smooth(...a));
  n += compare('smooth (a = b)', triples, a => smooth(a[0], a[0], a[2]), a => X.smooth(a[0], a[0], a[2]));
  t.diagnostic(`сравнений: ${n}`);
});

test('значения: фазы цикла, θ в радианах', t => {
  const thetas = [...grid(-20 * Math.PI, 60 * Math.PI, 5e-3), ...randoms(20000, -1e7, 1e7), ...SPECIAL,
    ...nearUlp([0, Math.PI, 4 * Math.PI, -4 * Math.PI, 8 * Math.PI])];
  const legacyAt = (th, f) => { X.sim.theta = th; const r = f(); X.sim.theta = 0; return r; };
  let n = compare('cycleDeg', thetas, th => cycleDeg(th), th => legacyAt(th, () => X.cycDeg()));
  for (const i of [0, 1, 2, 3, -1, 4, 1.5, '2', undefined]) {
    n += compare(`cylinderPhaseDeg(θ, ${String(i)})`, thetas, th => cylinderPhaseDeg(th, i), th => legacyAt(th, () => X.phaseOf(i)));
  }
  t.diagnostic(`сравнений: ${n}`);
});

test('значения: такт, поршень, объём, давление; φ в градусах', t => {
  const phis = [...grid(-1440, 2160, 0.025), ...randoms(20000, -1e6, 1e6), ...SPECIAL,
    ...nearUlp([0, 139, 180, 230, 235, 350, 360, 400, 500, 540, 720, -180, -540])];
  let n = 0;
  n += compare('strokeOf', phis, strokeOf, X.strokeOf);
  n += compare('pistonPinY', phis, pistonPinY, X.pistonPinY);
  n += compare('volumeAt', phis, volumeAt, X.volumeAt);
  n += compare('pressureAt', phis, pressureAt, X.pressureAt);
  const pcs = [...grid(-400, 600, 0.01), ...randoms(10000, -1e4, 1e4), ...SPECIAL, ...nearUlp([-180, -10, 52, 139, 230])];
  n += compare('pClosed', pcs, pClosed, X.pClosed);
  t.diagnostic(`сравнений: ${n}`);
});

test('значения: кулачок и клапаны', t => {
  const psis = [...grid(-8 * Math.PI, 8 * Math.PI, 5e-4), ...randoms(20000, -1e4, 1e4), ...SPECIAL,
    ...nearUlp([X.CAM_HALF, -X.CAM_HALF, Math.PI, -Math.PI, 0, 2 * Math.PI])];
  let n = compare('camProfileLift', psis, camProfileLift, X.camProfileLift);
  const types = ['intake', 'exhaust', '', undefined, null, 'Intake', 0, 'другое'];
  n += compare('valveDownAngle', types, valveDownAngle, X.valveDownAngle);
  for (const cyl of [0, 1, 2, 3, -1, 4, 1.5, '2', undefined]) n += compare(`lobeAngle(…, ${String(cyl)})`, types, ty => lobeAngle(ty, cyl), ty => X.lobeAngle(ty, cyl));
  t.diagnostic(`сравнений: ${n}`);
});

// ---------- текст функций ----------

test('текст функций совпадает (без комментариев и пробелов)', () => {
  const norm = f => String(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, '');
  const pairs = [['clamp', clamp], ['clamp01', clamp01], ['mod', mod], ['lerp', lerp], ['smooth', smooth], ['strokeOf', strokeOf],
    ['pistonPinY', pistonPinY], ['camProfileLift', camProfileLift], ['valveDownAngle', valveDownAngle], ['lobeAngle', lobeAngle],
    ['volumeAt', volumeAt], ['pClosed', pClosed], ['pressureAt', pressureAt]];
  for (const [name, fn] of pairs) assert.equal(norm(fn), norm(X[name]), name);
  assert.equal(norm(cycleDeg), norm(X.cycDeg).replace(/^\(\)=>/, 'thetaRad=>').replaceAll('sim.theta', 'thetaRad'), 'cycleDeg ↔ cycDeg');
  assert.equal(norm(cylinderPhaseDeg), norm(X.phaseOf).replace(/^i=>/, '(thetaRad,i)=>').replaceAll('sim.theta', 'thetaRad'), 'cylinderPhaseDeg ↔ phaseOf');
});

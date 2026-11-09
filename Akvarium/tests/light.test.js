/**
 * A-03, шаг 2: каустики по преломлённому солнцу и лучи света, связанные с мутностью.
 * GLSL здесь не исполняется: тесты сверяют формулы в исходнике шейдеров и проверяют их JS-зеркало.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = n => readFileSync(new URL(`../src/${n}.js`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CORE = src('core'), SCEN = src('scenery'), MAIN = src('main');
const num = (re, s) => { const m = s.match(re); assert.ok(m, `нет ${re}`); return +m[1]; };
const AQ_SCAT = num(/const float AQ_SCAT = ([\d.]+);/, CORE), AQ_M = num(/const float AQ_M = ([\d.]+);/, CORE);
const HS = num(/HS = ([\d.]+);/, CORE);
const SUN = CORE.match(/const SUN = new THREE\.Vector3\(([-\d., ]+)\)\.normalize\(\);/)[1].split(',').map(Number);
const RAY_Z = HS - 0.3;   // лучи висят от поверхности на высоту HS − 0.3 (scenery.js)

// JS-зеркало GLSL causSun() и веса каустик по ориентации поверхности
function causSun([x, y, z]) {
  const l = Math.hypot(x, y, z), s = [x / l, y / l, z / l];
  const sa = Math.hypot(s[0], s[2]), sw = sa / 1.333, k = sa > 1e-4 ? sw / sa : 0;
  return [s[0] * k, Math.sqrt(1 - sw * sw), s[2] * k];
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
const CS = causSun(SUN);
const up = n => Math.min(Math.max(dot(n, CS) / CS[1], 0), 1);
// JS-зеркало множителя лучей; uTurb = 0.4 + 2.0 · «Мутность» (main.js)
const rayK = (t, z) => t / (0.6 + 0.4 * t) * Math.exp(-1.5 * AQ_SCAT * AQ_M * (t - 1) * z);
const TURB = k => 0.4 + 2.0 * k;
const depths = Array.from({ length: 28 }, (_, i) => (RAY_Z * i) / 27);

test('каустики идут по преломлённому солнцу: закон Снелла, n = 1,333', () => {
  assert.ok(CORE.includes('vec3 causSun(){ vec3 s = normalize(uSunDir); float sa = length(s.xz), sw = sa / 1.333;'));
  assert.ok(CORE.includes('  vec3 cs = causSun(); float up = clamp(dot(n, cs) / cs.y, 0.0, 1.0);\n'));
  assert.ok(!CORE.includes('n.y * 0.8 + 0.2'), 'старый вес по n.y убран');
  assert.ok(Math.abs(Math.hypot(...CS) - 1) < 1e-12, 'направление единичное');
  const s = norm(SUN), sinA = Math.hypot(s[0], s[2]), sinW = Math.hypot(CS[0], CS[2]);
  assert.ok(Math.abs(sinW - sinA / 1.333) < 1e-12, 'sin θ в воде = sin θ в воздухе / 1,333');
  assert.ok(Math.abs(CS[0] * s[2] - CS[2] * s[0]) < 1e-12, 'азимут солнца сохраняется');
  assert.ok(sinW < sinA, 'в воде луч круче');
});

test('каустики: полные сверху, слабые на боку к солнцу, нет на теневом боку и на брюхе', () => {
  const side = norm([SUN[0], 0, SUN[2]]);
  assert.ok(Math.abs(up([0, 1, 0]) - 1) < 1e-12, 'сверху — 1');
  assert.ok(up(side) > 0.1 && up(side) < 0.4, `бок к солнцу слабый: ${up(side)}`);
  assert.equal(up(side.map(c => -c)), 0, 'теневой бок — 0');
  assert.equal(up([0, -1, 0]), 0, 'брюхо — 0');
  let prev = 2;
  for (let a = 0; a <= Math.PI; a += Math.PI / 36) {   // нормаль поворачивается сверху к теневому боку и вниз
    const w = up([-side[0] * Math.sin(a), Math.cos(a), -side[2] * Math.sin(a)]);
    assert.ok(w <= prev + 1e-12, 'вес не растёт, пока поверхность отворачивается от света'); prev = w;
  }
});

test('затухание каустик с глубиной и мутностью (causFade) сохранено', () => {
  assert.ok(CORE.includes('float causFade(vec3 p){ return exp(-1.5 * AQ_SCAT * uTurb * max(uBoxMax.y - p.y, 0.0) * AQ_M); }'));
  assert.ok(CORE.includes('caustics(vWPos, normalize(vWNrm))') && CORE.includes('causFade(vWPos)'));
});

test('лучи: глубина от поверхности и те же коэффициенты, что у causFade', () => {
  assert.ok(SCEN.includes('uniform float uTurb; uniform vec3 uBoxMax; varying vec3 vN;'));
  assert.ok(SCEN.includes('float z = max(uBoxMax.y - vP.y, 0.0), tk = uTurb / (0.6 + 0.4 * uTurb) * exp(-1.5 * 0.447 * 0.19 * (uTurb - 1.0) * z);'));
  assert.ok(SCEN.includes('float a = edge * fade * fl * streak * 0.085 * tk;'));
  assert.ok(!SCEN.includes('0.085 * (0.55 + 0.45 * uTurb)'), 'старый линейный множитель убран');
  assert.equal(AQ_SCAT, 0.447); assert.equal(AQ_M, 0.19);
  assert.ok(MAIN.includes('U.uTurb.value = 0.4 + 2.0 * K.turb;'), 'связь uTurb с ползунком «Мутность»');
});

test('лучи: при мутности по умолчанию — как раньше; в прозрачной воде слабее; в мутной ярче у поверхности и гаснут к дну', () => {
  for (const z of depths) assert.ok(Math.abs(rayK(TURB(0.3), z) - (0.55 + 0.45 * 1)) < 1e-12, 'по умолчанию (0,3) — прежний множитель 1');
  for (const z of depths) assert.ok(rayK(TURB(0), z) < 1, `прозрачная вода: ${rayK(TURB(0), z)} на глубине ${z}`);
  const m = depths.map(z => rayK(TURB(1), z));
  assert.ok(m[0] > 1.4, 'мутная вода у поверхности ярче');
  assert.ok(m.at(-1) < 0.5, 'мутная вода у дна тусклее');
  for (let i = 1; i < m.length; i++) assert.ok(m[i] < m[i - 1], 'в мутной воде лучи монотонно гаснут с глубиной');
  for (let k = 0; k <= 1.0001; k += 0.05) for (const z of depths) {
    const v = rayK(TURB(k), z); assert.ok(v > 0 && v <= 1.6, `множитель ограничен: ${v}`);
  }
});

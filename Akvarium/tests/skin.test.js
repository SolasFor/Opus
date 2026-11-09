/**
 * A-03, шаг 3: кожа рыб и песок — блики на чешуе через шероховатость (PBR), серебристый отлив вместо радуги,
 * плавники просвечивают на преломлённое солнце вместо постоянного самосвечения, зерно песка.
 * GLSL здесь не исполняется: тесты сверяют исходник шейдеров и JS-зеркало формулы просвечивания.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = n => readFileSync(new URL(`../src/${n}.js`, import.meta.url), 'utf8').split('\r\n').join('\n');
const CORE = src('core'), CRE = src('creatures'), SCEN = src('scenery');
const FISH = CRE.slice(CRE.indexOf('function fishMaterial('), CRE.indexOf('// species'));

test('patch() даёт крючок шероховатости сразу после roughnessmap_fragment', () => {
  assert.ok(CORE.includes("'#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${o.rough || ''}`"));
});

test('центры чешуек глаже краёв, плавники матовые', () => {
  assert.ok(FISH.includes('fScale = sc;'));
  assert.ok(FISH.includes('roughnessFactor = vFin > 0.5 ? 0.42 : mix(0.40, 0.17, fScale);'));
});

test('у плавников нет постоянного самосвечения 0.25 — свет идёт через плавник от солнца', () => {
  assert.ok(!FISH.includes('vFin > 0.5 ? 0.25 : 0.06'));
  assert.ok(FISH.includes('Sw = causSun()') && FISH.includes('cameraPosition - vWPos'));
  assert.ok(FISH.includes('0.15 + 0.55 * tr * uCausCol'), 'просвечивание окрашено цветом света и гаснет ночью');
});

// JS-зеркало формулы просвечивания плавника
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
function tr(n, v, s) {   // n — нормаль плавника, v — к камере, s — к солнцу (в воде)
  n = nrm(n); v = nrm(v); s = nrm(s);
  if (dot(n, v) < 0) n = n.map(x => -x);
  return 0.6 * Math.max(-dot(n, s), 0) + 0.4 * Math.max(-dot(v, s), 0) ** 3;
}

test('плавник светится, когда солнце за ним, и не светится, когда солнце за камерой', () => {
  assert.ok(tr([0, 0, 1], [0, 0, 1], [0, 0.3, -1]) > 0.5, 'контровой свет');
  assert.equal(tr([0, 0, 1], [0, 0, 1], [0, 0.3, 1]), 0, 'фронтальный свет не просвечивает');
  assert.ok(tr([0, 0, 1], [0, 0, 1], [0, 0.3, -1]) <= 1);
});

test('песок получил мелкий рельеф зерна без текстур', () => {
  assert.ok(SCEN.includes("{ key: 'sand', caustic: 2.2, bump: 0.05, bumpFreq: '7.0' }"));
});

test('серебристый отлив вместо чистой радуги', () => {
  assert.ok(FISH.includes('vec3 ir = mix(vec3(0.85, 0.92, 1.0),'));
});

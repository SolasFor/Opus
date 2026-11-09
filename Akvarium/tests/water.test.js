/**
 * A-03d: собственные шейдеры (низ поверхности, лучи, снег, пузыри, медузы) на той же линейной модели воды,
 * что и поверхности через patch(). GLSL здесь не исполняется: тесты сверяют исходник шейдеров и JS-зеркало
 * aqTrans (та же формула), а настоящая картинка проверяется снимками в браузере (см. PR).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = n => readFileSync(new URL(`../src/${n}.js`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CORE = src('core'), SCEN = src('scenery'), CRE = src('creatures');
const nums = (re, s) => { const m = s.match(re); assert.ok(m, `нет ${re}`); return m[1].split(',').map(Number); };
const count = (s, sub) => s.split(sub).length - 1;
const WT = (CORE.match(/const WATER_T = `([\s\S]*?)`;/) || [])[1];

test('старая waterApply удалена, низ поверхности — waterLinear', () => {
  for (const [n, s] of [['core', CORE], ['scenery', SCEN], ['creatures', CRE]]) assert.equal(count(s, 'waterApply('), 0, `${n}.js`);
  assert.ok(SCEN.includes('col = waterLinear(col, vP);'));
  assert.ok(CORE.includes('return col * exp(-AQ_ABS * d) * (1.0 - s) + waterColor(p.y) * uHazeK * s;'), 'waterLinear не тронута');
});

test('WATER_T: те же коэффициенты, что у waterLinear (Pope & Fry 1997; масштаб AQ_M; рассеяние AQ_SCAT)', () => {
  assert.ok(WT, 'const WATER_T в core.js');
  assert.deepEqual(nums(/exp\(-vec3\(([^)]*)\)/, WT), nums(/const vec3 AQ_ABS = vec3\(([^)]*)\);/, CORE));
  assert.equal(count(WT, '* 0.19'), 2, 'путь взгляда и глубина — в метрах (AQ_M)');
  assert.ok(CORE.includes('const float AQ_M = 0.19;') && CORE.includes('const float AQ_SCAT = 0.447;'));
  assert.ok(WT.includes('0.447 * (turb - 1.0) * d'), 'рассеяние — относительно мутности по умолчанию');
  assert.ok(WT.includes('vec3(0.4545)'), 'дисплейное пространство: шейдеры пишут цвет без тонмаппинга');
  assert.ok(!/uniform\s/.test(WT), 'WATER_T не объявляет uniform: их объявляет сам шейдер');
});

test('лучи, снег, пузыри и медузы пропускают свет через воду (aqTrans в вершине)', () => {
  assert.equal(count(SCEN, '${WATER_T}'), 2, 'лучи и снег');
  assert.equal(count(SCEN, 'aqTrans('), 3);
  assert.ok(SCEN.includes('gl_FragColor = vec4(uRayC * a * vT, 1.0);'));
  assert.ok(SCEN.includes('vec3(0.75, 0.9, 0.95) * a * vA * vT + vec3(0.25, 1.0, 0.85) * a * a * vGlow * 0.9 * vTg;'));
  assert.ok(SCEN.includes('(0.55 + 0.45 * uTurb)'), 'снег по-прежнему гуще в мутной воде');
  assert.equal(count(CRE, '${WATER_T}'), 2, 'пузыри и медузы');
  assert.equal(count(CRE, 'aqTrans('), 2);
  assert.ok(CRE.includes('uSky: U.uSky, uNight: U.uNight, uTurb: U.uTurb, uBoxMin: U.uBoxMin, uBoxMax: U.uBoxMax }'));
  assert.ok(CRE.includes('uBoxMin: U.uBoxMin, uBoxMax: U.uBoxMax, uTurb: U.uTurb }'));
});

// JS mirror of aqTrans: z = depth below the surface [m], d = view path in the water [m]
const ABS = [0.34, 0.057, 0.0092];
const aqT = (z, d, turb, sunK = 1) => ABS.map(a => Math.exp(-a * (z * sunK + d) - 0.447 * (turb - 1) * d) ** 0.4545);

test('aqTrans: у поверхности у стекла — 1; глубже и дальше — темнее, красный гаснет первым', () => {
  assert.deepEqual(aqT(0, 0, 1), [1, 1, 1]);
  for (let z = 0; z <= 1.7; z += 0.1) for (let d = 0; d <= 1.6; d += 0.1) {
    const [r, g, b] = aqT(z, d, 1);
    if (z + d > 1e-9) assert.ok(r < g && g < b && b < 1, `z ${z.toFixed(1)} d ${d.toFixed(1)}`);
    const [r2, g2, b2] = aqT(z + 0.1, d + 0.1, 1);
    assert.ok(r2 < r && g2 < g && b2 < b, 'монотонно');
    const m = aqT(z, d, 2.4), c = aqT(z, d, 0.4);
    for (let i = 0; i < 3; i++) assert.ok(m[i] <= aqT(z, d, 1)[i] + 1e-12 && c[i] >= aqT(z, d, 1)[i] - 1e-12, 'мутная вода прячет, прозрачная показывает');
    assert.ok(Math.max(...c) <= 1.25, 'прозрачная вода поднимает не больше чем на 25 %');
    assert.deepEqual(aqT(z, 0, 1, 0), [1, 1, 1], 'свечение (sunK = 0) гаснет только на пути до глаза');
  }
});

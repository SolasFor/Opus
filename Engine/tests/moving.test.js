/**
 * Подвижные узлы V12 (crankshaft.js, rods.js, pistons.js, valvetrain.js, sparks.js) и уровень детализации:
 *   1) Количество уникальных материалов у сборщиков Parts и InstancedMesh в пределах бюджета;
 *   2) Зазоры КШМ V12 (ход поршня в ВМТ до привалочной плоскости и ГБЦ, радиус колец < BORE_R, зазор кулачков < COVER_TOP_R);
 *   3) Низкий уровень детализации: lowDetail(), wantAO(), lodSeg() для всех примитивов G и выдавливаний, без прямых THREE.*Geometry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { wantAO, lowDetail } from '../src/render/quality.js';
import { CRANK_R, ROD_L, BORE_R, PIN_TOP, CAM_LIFT, VALVE_TILT } from '../src/config/engine-spec.js';
import { PIN_TDC_R } from '../src/sim/kinematics.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PART = f => read(`../src/render/parts/${f}`);
const MATS = read('../src/render/materials.js'), GEO = PART('geometry.js'), WORLD = read('../src/render/world.js');
const num = re => +WORLD.match(re)[1];
const DECK_R = num(/^const DECK_R\s*=\s*([\d.]+);/m), HEAD_BOT_R = num(/^const HEAD_BOT_R\s*=\s*([\d.]+);/m);
const COVER_TOP_R = num(/^const COVER_TOP_R\s*=\s*([\d.]+);/m), SEAT_R = num(/^const SEAT_R\s*=\s*([\d.]+);/m);
const TAPPET_TOP = num(/^const TAPPET_TOP\s*=\s*([\d.]+);/m), CAM_RB = num(/^const CAM_RB\s*=\s*([\d.]+);/m);
const CAM_R = SEAT_R + (TAPPET_TOP + CAM_RB) * Math.cos(VALVE_TILT);
const INTO = Object.fromEntries([...MATS.matchAll(/^ {4}([\w$]+): *tint\(0x[0-9a-f]{6}(?:, '([\w$]+)')?\)/gm)].map(m => [m[1], m[2] || 'hw']));
const noComments = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
const builders = src => {
  const by = new Map(); let cur = null;
  for (const m of noComments(src).matchAll(/\b([A-Z]\w*)\.(?:add|bolt)\(|(?<![\w$.])M\.([\w$]+)/g)) {
    if (m[1]) { cur = m[1]; continue; }
    if (!cur) continue;
    if (!by.has(cur)) by.set(cur, new Set());
    by.get(cur).add(m[2]);
  }
  return by;
};
const meshSet = keys => new Set([...keys].map(k => INTO[k] || k));
const BUDGET = {
  'crankshaft.js': { P: 8 },
  'rods.js':       { P: 4 },
  'pistons.js':    { P: 5 },
  'valvetrain.js': { VP: 3, SP: 1, CP: 6 },
  'sparks.js':     { P: 7 }
};

test('подвижные узлы V12: не больше BUDGET мешей на сборщик, крепёж объединён в hw', () => {
  for (const [f, budget] of Object.entries(BUDGET)) {
    const by = builders(PART(f));
    for (const [b, n] of Object.entries(budget)) {
      assert.ok(by.has(b), `${f}: нет сборщика ${b}`);
      assert.ok(meshSet(by.get(b)).size <= n, `${f} ${b}: ${[...meshSet(by.get(b))]} — бюджет ${n}`);
    }
  }
  for (const k of ['hole', 'carbon']) assert.equal(INTO[k], 'hw', `M.${k}`);
  for (const [k, surf] of [['forged', 'forged'], ['piston', 'machined'], ['crinkleRed', 'wrinkle'], ['liner', 'honed']])
    assert.match(MATS, new RegExp(`^ {4}${k}: +S\\((?:std|phys)\\(\\{[^\\n]*\\}\\), '${surf}'\\),`, 'm'), `M.${k}`);
});

test('кинематика и зазоры подвижных деталей V12: поршни в ВМТ, кольца, шатуны, кулачки и свечи', () => {
  assert.ok(PIN_TDC_R === CRANK_R + ROD_L);
  const p = PART('pistons.js');
  assert.match(p, /P\.instanced\(parent, g, 6\)/, 'по 6 инстансированных поршней в каждом ряду');
  assert.match(p, /const ro = 0\.433, ri = 0\.388;/);
  assert.ok(0.433 < BORE_R, 'кольца входят в гильзу BORE_R = 0.44');
  const pistonCrownTop = PIN_TDC_R + 0.250;
  assert.ok(pistonCrownTop < DECK_R && pistonCrownTop < HEAD_BOT_R - 0.05, `поршень в ВМТ (${pistonCrownTop}) не бьёт по ГБЦ (${HEAD_BOT_R})`);
  assert.ok(PIN_TOP <= 0.25);

  const r = PART('rods.js');
  assert.match(r, /P\.instanced\(parent, g, 6\)/, 'по 6 инстансированных шатунов в каждом ряду');

  const c = PART('crankshaft.js');
  assert.match(c, /THROW_X\.forEach\(/);
  assert.match(c, /gearShape\(20, R_CRANK_SPR/);
  assert.match(c, /gearShape\(108, 0\.96, 1\.02\)/);

  const v = PART('valvetrain.js');
  assert.match(v, /VP\.instanced\(bankGrp, g, 24\)/, 'по 24 клапана на ряд (48 всего)');
  assert.match(v, /SP\.instanced\(bankGrp, g, 24\)/, 'по 24 пружины на ряд (48 всего)');
  assert.match(v, /gearShape\(40, R_CAM_SPR/);
  assert.ok(CAM_R + CAM_RB + CAM_LIFT < COVER_TOP_R - 0.04, 'вершина кулачка свободно проходит под крышкой ГБЦ');

  const s = PART('sparks.js');
  assert.match(s, /P\.build\(bankGrp, g\)/);
  assert.match(s, /M\.ceramic/);
});

test('уровень «низкий»: lowDetail() и wantAO()', () => {
  for (const [q, coarse, want] of [['', false, false], ['', true, true], ['?lod=low', false, true], ['?lod=high', true, false], ['?lod=other', true, true]])
    assert.equal(lowDetail(new URLSearchParams(q), { coarse }), want, `«${q}» coarse=${coarse}`);
  for (const [q, low, want] of [['', true, false], ['?ao', true, true], ['?noao', true, false], ['', false, true]])
    assert.equal(wantAO(new URLSearchParams(q), { webgl2: true, coarse: false, low }), want, `«${q}» low=${low}`);
});

test('уровень «низкий»: lodSeg() во всех примитивах G/extrude, без голых THREE.*Geometry, buildEngine(low) с setDetail(low)', () => {
  const expr = GEO.match(/^const lodSeg = n => (.*);$/m);
  assert.ok(expr);
  const lodSeg = (low, n) => new Function('detail', 'n', `return ${expr[1]};`)({ low }, n);
  for (const [n, want] of [[1, 1], [8, 8], [16, 8], [24, 12], [48, 24]]) {
    assert.equal(lodSeg(true, n), want);
    assert.equal(lodSeg(false, n), n);
  }
  for (const f of readdirSync(new URL('../src/render/parts/', import.meta.url)).filter(f => f !== 'geometry.js'))
    assert.deepEqual([...noComments(PART(f)).matchAll(/new THREE\.(\w+Geometry)\(/g)].map(m => m[1]).filter(n => n !== 'BufferGeometry'), [], f);
  assert.match(PART('nodes.js'), /\nfunction buildEngine\(low = false\) \{\n {2}setDetail\(low\);\n {2}createMaterials\(\);\n {2}buildBlock\(/);
});

/* M-07c: подвижные детали — коленвал с маховиком, шатуны, поршни, ГРМ, свечи — и уровень детализации «низкий».
 * 1) вызовы отрисовки: у каждого сборщика Parts не больше BUDGET мешей (ключи-цвета идут в общий материал hw);
 * 2) размеры и кинематика как на main@307a0c0: профиль щёк, направления шатунных шеек, радиусы шеек, звёздочки
 *    20 и 40 зубьев, венец маховика, профиль кулачков и их углы, оси и сёдла клапанов, верх толкателя TAPPET_TOP,
 *    пружина, отверстия шатуна, палец и радиус поршня, якоря подписей; поршень не выше днища main@307a0c0 больше
 *    чем на 0,002 u и не задевает головку в ВМТ;
 * 3) уровень «низкий»: render/quality.js — lowDetail() (сенсорный экран, ?lod=low, ?lod=high), AO на нём выключен,
 *    ?ao включает; lodSeg() вдвое уменьшает сегменты, не меньше 8; все сегменты G и выдавливаний идут через lodSeg;
 *    Parts.add() и Parts.bolt() пропускают крепёж и мелочь (ключи hw); buildEngine(low) задаёт уровень до сборки.
 * Без сторонних зависимостей: исходники читаются как текст, quality.js и engine-spec.js импортируются.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { wantAO, lowDetail } from '../src/render/quality.js';
import { CRANK_Y, CRANK_R, ROD_L, BORE_R } from '../src/config/engine-spec.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PART = f => read(`../src/render/parts/${f}`);
const MATS = read('../src/render/materials.js'), GEO = PART('geometry.js');
const INTO = Object.fromEntries([...MATS.matchAll(/^ {4}([\w$]+): *tint\(0x[0-9a-f]{6}(?:, '([\w$]+)')?\)/gm)].map(m => [m[1], m[2] || 'hw']));
const noComments = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
const builders = src => {
  const by = new Map(); let cur = null;
  for (const m of noComments(src).matchAll(/\b([A-Z]\w*)\.(?:add|bolt)\(|(?<![\w$.])M\.([\w$]+)/g)) {
    if (m[1]) { cur = m[1]; continue; }
    assert.ok(cur, `M.${m[2]} вне add()/bolt()`);
    if (!by.has(cur)) by.set(cur, new Set());
    by.get(cur).add(m[2]);
  }
  return by;
};
const meshSet = keys => new Set([...keys].map(k => INTO[k] || k));
// сборщик → мешей; у ГРМ P собирает каждый из двух распредвалов. main@307a0c0: 4; 3; 4; VP 2, SP 1, P 5; 4.
// Прототип M-07: 9; 4; 5; VP 5, SP 1, P 4; 4
const BUDGET = { 'crankshaft.js': { P: 6 }, 'rods.js': { P: 3 }, 'pistons.js': { P: 4 }, 'valvetrain.js': { VP: 3, SP: 1, P: 4 }, 'sparks.js': { P: 3 } };

test('подвижные узлы: не больше BUDGET мешей на сборщик, крепёж и мелочь — один меш hw', () => {
  for (const [f, budget] of Object.entries(BUDGET)) {
    const by = builders(PART(f));
    assert.deepEqual([...by.keys()].sort(), Object.keys(budget).sort(), `${f}: сборщики`);
    for (const [b, n] of Object.entries(budget)) assert.ok(meshSet(by.get(b)).size <= n, `${f} ${b}: ${[...meshSet(by.get(b))]} — бюджет ${n}`);
    for (const k of ['dark', 'rubber', 'soot'].filter(k => f !== 'pistons.js' || k !== 'soot')) assert.ok(![...by.values()].some(s => s.has(k)), `${f}: M.${k} — для мелочи ключи-цвета`);
  }
  for (const k of ['hole', 'carbon']) assert.equal(INTO[k], 'hw', `M.${k}`);
  for (const [k, surf] of [['forged', 'forged'], ['piston', 'machined']])
    assert.match(MATS, new RegExp(`^ {4}${k}: +S\\(std\\(\\{ color: 0x[0-9a-f]{6}, metalness: [\\d.]+, roughness: [\\d.]+ \\}\\), '${surf}'\\),`, 'm'), `M.${k}`);
});

const KEEP = {
  'crankshaft.js': [
    'function webShape() {\n  const s = new THREE.Shape(), rr = 0.47, a0 = 200 * DEG, a1 = 340 * DEG;\n  s.absarc(0, CRANK_R, 0.205, 0, Math.PI, false);\n  s.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);\n  s.absarc(0, 0, rr, a0, a1, false);\n  s.lineTo(0.205, CRANK_R);\n  return s;\n}',
    '  crankGroup.position.set(0, CRANK_Y, 0);',
    '    const ph = mod(-FIRE_DEG[i], 360) * DEG;     // pin direction in crank space',
    '    [x - 0.235, x + 0.235].forEach(wx => {',
    '  P.add(extrudeX(gearShape(20, R_CRANK_SPR - 0.025, R_CRANK_SPR + 0.012), 0.14, 2), M.steelDark, [BELT_X, 0, 0]);',
    '  const FX = -2.62;',
    '  P.add(extrudeX(gearShape(96, 0.92, 0.985), 0.09, 1), M.steel, [FX - 0.05, 0, 0]);',
    '  g.userData.anchor.set(-2.62, CRANK_Y + 1.0, 0);'],
  'rods.js': ['  rodMeshes = P.instanced(g, g, 4);', '  g.userData.anchor.set(0.55, CRANK_Y + 1.0, 0.5);'],
  'pistons.js': ['  pistonMeshes = P.instanced(g, g, 4);', '  g.userData.anchor.set(-0.55, 2.4, 0.4);'],
  'valvetrain.js': [
    'function camLobeShape() {\n  const s = new THREE.Shape();\n  for (let k = 0; k <= 72; k++) {\n    const a = k / 72 * Math.PI * 2;               // angle from +v (nose)\n    const r = CAM_RB + camProfileLift(a);\n    const u = Math.sin(a) * r, v = Math.cos(a) * r;\n    if (k === 0) s.moveTo(u, v); else s.lineTo(u, v);\n  }\n  return s;\n}',
    '    getPoint(t, out = new THREE.Vector3()) { const a = t * Math.PI * 2 * 6.5; return out.set(Math.cos(a) * 0.068, t, Math.sin(a) * 0.068); }',
    'const SPRING_BASE = 0.52, SPRING_TOP = 0.96;',
    '  valveMeshes = VP.instanced(g, g, 16);',
    '  springMeshes = SP.instanced(g, g, 16);',
    "  valves.length = 0;\n  CYL_X.forEach((x, i) => ['intake', 'exhaust'].forEach(type => [-0.17, 0.17].forEach(dx => {\n    const sz = type === 'intake' ? -1 : 1;\n    const axis = V3(0, Math.cos(VALVE_TILT), sz * Math.sin(VALVE_TILT));\n    valves.push({ cyl: i, type, seat: V3(x + dx, SEAT_Y, sz * SEAT_Z), axis,\n      quat: new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), axis), lift: 0 });\n  })));",
    '  const lobe = extrudeX(camLobeShape(), 0.12, 1);',
    "  [['intake', -1], ['exhaust', 1]].forEach(([type, sz]) => {\n    const cam = new THREE.Group();\n    cam.position.set(0, CAM_Y, sz * CAM_Z);",
    '    CYL_X.forEach((x, i) => [-0.17, 0.17].forEach(dx => P.add(lobe.clone(), M.cam, [x + dx, 0, 0], [lobeAngle(type, i), 0, 0])));',
    '    const gs = gearShape(40, R_CAM_SPR - 0.025, R_CAM_SPR + 0.012);',
    '    P.add(extrudeX(gs, 0.14, 2), M.steelDark, [BELT_X, 0, 0]);',
    '  g.userData.anchor.set(-1.65, CAM_Y + 0.35, -CAM_Z);'],
  'sparks.js': ['  P.build(g, g);', '  g.userData.anchor.set(0.55, HEAD_TOP + 0.5, 0);']
};

test('размеры и кинематика: профили щёк и кулачков, шейки, звёздочки, венец, клапаны, якоря — как на main@307a0c0', () => {
  for (const [f, lines] of Object.entries(KEEP)) for (const l of lines) assert.ok(PART(f).includes(l), `${f}: нет «${l.split('\n')[0]}»`);
  const c = PART('crankshaft.js');
  assert.match(c, /P\.add\(G\.cylX\(0\.13, 0\.36, \d+\), M\.chrome, \[x, CRANK_R \* Math\.cos\(ph\), CRANK_R \* Math\.sin\(ph\)\]\);/, 'шатунные шейки');
  assert.match(c, /\[-2\.2, -1\.1, 0, 1\.1, 2\.2\]\.forEach\(x => P\.add\(G\.cylX\(0\.19, 0\.30, \d+\), M\.chrome, \[x, 0, 0\]\)\);/, 'коренные шейки');
  // маховик: в габарите main@307a0c0 (радиус 0,90, толщина 0,20 по FX); демпфер — в габарите шкива (радиус 0,34)
  const fly = c.match(/P\.add\(G\.latheX\((\[\[[^;]*\]\]), \d+\), M\.forged, \[FX, 0, 0\]\);/), damp = c.match(/const dp = (\[\[[^;]*\]\]);/);
  assert.ok(fly && damp, 'профили маховика и демпфера');
  const pts = JSON.parse(fly[1]);
  assert.equal(Math.max(...pts.map(p => p[0])), 0.90); assert.deepEqual([Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1]))], [-0.10, 0.10]);
  assert.ok(JSON.parse(damp[1]).every(p => p[0] <= 0.34) && /dp\.push\(\[0\.34, y\]/.test(c), 'демпфер: радиус 0,34');
  // шатун: отверстия головок, ширина меньше зазора между щёками
  const r = PART('rods.js');
  assert.match(r, /s\.holes\.push\(holePath\(0, 0, 0\.125\)\);/); assert.match(r, /web\.holes\.push\(holePath\(0, ROD_L, 0\.062\)\);/);
  assert.match(r, /extrudeXb\(se, 0\.13, \d+, 0\.01\), M\.forged, \[0, ROD_L, 0\]\);/);
  const widths = [...r.matchAll(/extrudeXb\([^;]*?, ([\d.]+), \d+, [\d.]+\), M\.forged/g)].map(m => +m[1]);
  assert.ok(widths.length === 4 && Math.max(...widths) <= 2 * (0.235 - 0.15 / 2) - 0.1, `ширина шатуна ${widths}`);
  // поршень: радиусы, палец, днище, юбка
  const p = PART('pistons.js');
  const radii = [...p.matchAll(/\[(0\.\d+), -?0\.\d+(?:, 1)?\]/g)].map(m => +m[1]);
  assert.ok(Math.max(...radii) <= 0.40, 'тело поршня — радиус 0,40, как на main');
  assert.match(p, /const ro = 0\.418, ri = 0\.374;/); assert.ok(0.418 < BORE_R, 'кольца меньше отверстия цилиндра');
  assert.match(p, /P\.add\(G\.cylX\(0\.085, 0\.68, \d+\), M\.chrome, \[0, 0, 0\]\);/, 'палец');
  assert.match(p, /\[0\.372, -0\.35\], \[0\.398, -0\.35\]/, 'юбка до −0,35, как на main');
  const soot = p.match(/G\.cyl\(0\.29, 0\.30, (0\.\d+), \d+\), M\.soot, \[0, (0\.\d+), 0\]\)/), top = Math.max(+soot[2] + soot[1] / 2, 0.245);
  assert.ok(top <= 0.244 + 0.002, `днище ${top}`);
  assert.ok(CRANK_Y + CRANK_R + ROD_L + top < 2.48 - 0.07, 'в ВМТ до HEAD_BOT больше 0,07 u');
  // клапан: тарелка радиусом 0,135 от седла (y = 0), стакан радиусом 0,10, шайба кончается на TAPPET_TOP
  const v = PART('valvetrain.js');
  assert.match(v, /VP\.add\(G\.lathe\(\[\[0, 0\], \[0\.135, 0\],/);
  assert.match(v, /\[0, TAPPET_TOP - 0\.12\], \[0\.10, TAPPET_TOP - 0\.12\]/);
  assert.match(v, /VP\.add\(G\.cyl\(0\.07, 0\.07, 0\.004, \d+\), M\.fittingDark, \[0, TAPPET_TOP - 0\.002, 0\]\);/);
  assert.match(v, /return G\.tube\(new Helix\(\), \d+, 0\.013, \d+\);/, 'пружина: тот же радиус витка');
  // свеча: электрод у HEAD_BOT, изолятор над HEAD_TOP
  const s = PART('sparks.js');
  assert.match(s, /G\.cyl\(0\.010, 0\.010, 0\.05, 8\), M\.steel, \[x, HEAD_BOT - 0\.03, 0\]\)/);
  assert.match(s, /P\.add\(G\.cyl\(0\.055, 0\.055, 0\.70, \d+\), M\.steelDark, \[x, HEAD_BOT \+ 0\.50, 0\]\);/);
});

test('уровень «низкий»: lowDetail() — сенсорный экран, ?lod=low, ?lod=high; AO на нём выключен, ?ao включает', () => {
  for (const [q, coarse, want] of [['', false, false], ['', true, true], ['?lod=low', false, true], ['?lod=high', true, false],
    ['?lod=other', true, true], ['?lod=other', false, false], ['?noao', true, true]])
    assert.equal(lowDetail(new URLSearchParams(q), { coarse }), want, `«${q}» coarse=${coarse}`);
  for (const [q, low, want] of [['', true, false], ['?ao', true, true], ['?noao', true, false], ['', false, true]])
    assert.equal(wantAO(new URLSearchParams(q), { webgl2: true, coarse: false, low }), want, `«${q}» low=${low}`);
});

test('уровень «низкий»: вдвое меньше сегментов (не меньше 8), без крепежа и мелочи; уровень задаётся до сборки', () => {
  const expr = GEO.match(/^const lodSeg = n => (.*);$/m);
  assert.ok(expr, 'lodSeg');
  const lodSeg = (low, n) => new Function('detail', 'n', `return ${expr[1]};`)({ low }, n);
  for (const [n, want] of [[1, 1], [6, 6], [8, 8], [10, 8], [16, 8], [18, 9], [24, 12], [32, 16], [48, 24], [130, 65]]) {
    assert.equal(lodSeg(true, n), want, `${n}`); assert.equal(lodSeg(false, n), n, `${n}`);
  }
  const g = GEO.slice(GEO.indexOf('const G = {'), GEO.indexOf('\n};\n', GEO.indexOf('const G = {')));
  for (const k of ['cyl', 'cylX', 'cylZ', 'torusX', 'torusY', 'lathe', 'tube']) assert.match(g, new RegExp(`^  ${k}: \\([^\\n]*lodSeg\\(`, 'm'), `G.${k}`);
  assert.equal((GEO.match(/curveSegments: lodSeg\(seg\)/g) || []).length, 4, 'extrudeX, extrudeY, extrudeZ, extrudeXb');
  assert.doesNotMatch(GEO, /curveSegments: seg\b/);
  // в деталях тела вращения, трубы и выдавливания — через G и extrude*. Не упрощаются только полусферы торцов
  // ресивера и коллектора и дуговые рёбра теплоэкрана (4 шт.) — около 2,5 тыс. треугольников
  const RAW = { 'intake.js': ['SphereGeometry'], 'exhaust.js': ['SphereGeometry', 'TorusGeometry'] };
  for (const f of readdirSync(new URL('../src/render/parts/', import.meta.url)).filter(f => f !== 'geometry.js'))
    assert.deepEqual([...noComments(PART(f)).matchAll(/new THREE\.(\w+Geometry)\(/g)].map(m => m[1]).filter(n => n !== 'BufferGeometry'), RAW[f] || [], f);
  const add = GEO.slice(GEO.indexOf('  add(geo, mat, pos, rot, scl) {'));
  assert.match(add, /^ {2}add\(geo, mat, pos, rot, scl\) \{\n {4}if \(detail\.low && mat\.userData\.into === 'hw'\) \{ geo\.dispose\(\); return this; \}/);
  assert.match(GEO, /\n {4}return detail\.low && mat\.userData\.into === 'hw' \? this : this\.add\(boltGeo\(r, h\), mat, pos, ROT\[dir\]\);/);
  assert.match(PART('nodes.js'), /\nfunction buildEngine\(low = false\) \{\n {2}setDetail\(low\);\n {2}createMaterials\(\);\n {2}buildBlock\(/);
  assert.match(GEO, /^const setDetail = low => \{ detail\.low = !!low; \};$/m);
});

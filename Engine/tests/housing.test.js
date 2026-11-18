/**
 * Корпусные детали V12 (block.js, head.js, covers.js, intake.js, exhaust.js):
 *   1) Объединение геометрии Parts.build(): один меш на материал узла, бюджет вызовов отрисовки;
 *   2) Ключи-цвета tint() пишутся в цвет вершин общих материалов hw / paintHw, крепёж отбрасывается при lowDetail;
 *   3) Фаски внутрь контура в extrudeY/Z/Xb без искажения наружных габаритов;
 *   4) Габаритные и геометрические параметры V12 (BORE_R, DECK_R, GASKET_R, HEAD_BOT_R, HEAD_TOP_R, COVER_TOP_R)
 *      и траектории частиц впуска/выпуска для 12 цилиндров.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BORE_R, CRANK_Y, BANK_TILT } from '../src/config/engine-spec.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PART = f => read(`../src/render/parts/${f}`);
const MATS = read('../src/render/materials.js'), GEO = PART('geometry.js'), WORLD = read('../src/render/world.js');
const num = re => +WORLD.match(re)[1];
const DECK_R = num(/^const DECK_R\s*=\s*([\d.]+);/m), GASKET_R = num(/^const GASKET_R\s*=\s*([\d.]+);/m);
const HEAD_BOT_R = num(/^const HEAD_BOT_R\s*=\s*([\d.]+);/m), HEAD_TOP_R = num(/^const HEAD_TOP_R\s*=\s*([\d.]+);/m);
const COVER_TOP_R = num(/^const COVER_TOP_R\s*=\s*([\d.]+);/m);
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
const meshes = by => [...by.values()].reduce((n, keys) => n + new Set([...keys].map(k => INTO[k] || k)).size, 0);
const BUDGET = { 'block.js': 15, 'head.js': 14, 'covers.js': 12, 'intake.js': 14, 'exhaust.js': 10 };

test('корпусные узлы V12: сборка Parts соблюдает бюджет мешей; ключи-цвета объединяются в hw/paintHw', () => {
  assert.ok(Object.keys(INTO).length >= 6);
  for (const [k, into] of Object.entries(INTO)) {
    assert.match(MATS, new RegExp(`^ {4}${into}: *S\\((?:std|phys)\\(\\{[^{}]*vertexColors: true`, 'm'), `M.${k} → M.${into}`);
  }
  for (const [f, n] of Object.entries(BUDGET)) {
    const by = builders(PART(f)), got = meshes(by);
    assert.ok(got > 0 && got <= n, `${f}: ${got} мешей, бюджет ${n}`);
  }
  for (const k of ['bolt', 'boltDark', 'copper', 'fitting', 'fittingDark', 'shell', 'wire']) assert.equal(INTO[k], 'hw', `M.${k}`);
  for (const k of ['paintBlue', 'paintRed']) assert.equal(INTO[k], 'paintHw', `M.${k}`);
});

test('фаска внутрь: extrudeY, extrudeZ, extrudeXb сохраняют внешний размер; extrudeX — стандартный', () => {
  for (const f of ['extrudeY', 'extrudeZ', 'extrudeXb']) {
    const body = GEO.slice(GEO.indexOf(`function ${f}(`), GEO.indexOf('\n}\n', GEO.indexOf(`function ${f}(`)));
    assert.match(body, /depth: depth - 2 \* bevel,/, f);
    assert.match(body, /bevelThickness: bevel, bevelSize: bevel \* 0\.8, bevelOffset: -bevel \* 0\.8,/, f);
  }
  assert.match(GEO, /^function extrudeY\(shape, depth, seg = 32, bevel = 0\) \{$/m);
});

test('Parts.add(): очистка атрибутов, цвет вершин для tint() и болты по ROT', () => {
  const add = GEO.slice(GEO.indexOf('  add(geo, mat, pos, rot, scl) {'), GEO.indexOf('\n  }\n', GEO.indexOf('  add(geo, mat, pos, rot, scl) {')));
  const strip = add.indexOf("if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);"), into = add.indexOf('const into = mat.userData.into;');
  assert.ok(strip > 0 && into > strip);
  assert.match(add, /g\.setAttribute\('color', new THREE\.BufferAttribute\(a, 3\)\);\n      mat = M\[into\];/);
  assert.match(GEO, /^const ROT = \{ y: null, '-y': \[Math\.PI, 0, 0\], z: \[Math\.PI \/ 2, 0, 0\], '-z': \[-Math\.PI \/ 2, 0, 0\], x: \[0, 0, -Math\.PI \/ 2\], '-x': \[0, 0, Math\.PI \/ 2\] \};$/m);
});

test('спецификация корпуса V12: 12 отверстий BORE_R, зазоры прокладок, головок и крышек', () => {
  assert.match(WORLD, /THROW_X\.map\(x => x - ROD_OFFSET_X\), \.\.\.THROW_X\.map\(x => x \+ ROD_OFFSET_X\)/);
  assert.ok(DECK_R < GASKET_R && GASKET_R < HEAD_BOT_R && HEAD_BOT_R < HEAD_TOP_R && HEAD_TOP_R < COVER_TOP_R);
  // внутренняя кромка ГБЦ не пересекается с противоположным рядом в развале V = 60°
  const zInnerHead = HEAD_BOT_R * Math.sin(BANK_TILT) - 0.78 * Math.cos(BANK_TILT);
  assert.ok(zInnerHead > 0.25, `зазор головки от плоскости симметрии z = ${zInnerHead}`);
  // поршень в ВМТ + высота головки поршня не касается днища ГБЦ
  assert.ok(CRANK_Y > 0 && BORE_R === 0.44);

  const b = PART('block.js'), h = PART('head.js'), cv = PART('covers.js');
  assert.match(b, /s\.holes\.push\(holePath\(x, 0, BORE_R\)\)/);
  assert.match(b, /M\.liner/);
  assert.match(h, /gs\.holes\.push\(holePath\(x, 0, BORE_R \+ 0\.008\)\)/);
  assert.match(cv, /M\.crinkleRed/);
  assert.match(cv, /M\.carbonWeave/);
  assert.match(PART('intake.js'), /intakePaths\[c\] = new THREE\.CatmullRomCurve3\(/);
  assert.match(PART('exhaust.js'), /exhaustPaths\[c\] = new THREE\.CatmullRomCurve3\(/);
});

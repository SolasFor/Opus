/* M-07b: корпусные детали — блок с поддоном, головка, впускной и выпускной коллекторы.
 * 1) вызовы отрисовки: Parts собирает один меш на материал узла, ключи-цвета tint() идут в общий материал (hw,
 *    paintHw). У корпусных узлов не больше BUDGET мешей: в рентгене каждый корпусный меш рисуется дважды;
 * 2) пути частиц впуска и выпуска, ресивер, коллектор и осевые линии труб — те же выражения, что на main@307a0c0,
 *    радиусы труб те же (меняется только число сегментов);
 * 3) выдавливания с фаской не меняют внешний размер: фаска внутрь контура (bevelSize = −bevelOffset), толщина
 *    depth − 2·bevel плюс две фаски;
 * 4) Parts.add() пишет цвет ключа в цвет вершин и подменяет материал общим; болт поворачивается по ROT;
 * 5) размеры спецификации: отверстия цилиндров блока — BORE_R по осям CYL_X, плоскость блока — DECK_Y.
 * Без сторонних зависимостей: исходники читаются как текст.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PART = f => read(`../src/render/parts/${f}`);
const MATS = read('../src/render/materials.js'), GEO = PART('geometry.js');
const INTO = Object.fromEntries([...MATS.matchAll(/^ {4}([\w$]+): *tint\(0x[0-9a-f]{6}(?:, '([\w$]+)')?\)/gm)].map(m => [m[1], m[2] || 'hw']));
// меши узла: для каждого сборщика Parts (P, GP …) — материалы его add()/bolt(), ключи-цвета заменены общим материалом
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
const meshes = by => [...by.values()].reduce((n, keys) => n + new Set([...keys].map(k => INTO[k] || k)).size, 0);
const BUDGET = { 'block.js': 7, 'head.js': 6, 'intake.js': 5, 'exhaust.js': 4 };   // main@307a0c0: 6, 8, 3, 2; прототип M-07: 12, 9, 7, 7

test('корпусные узлы: не больше BUDGET мешей, крепёж и мелочь — один меш общего материала', () => {
  assert.ok(Object.keys(INTO).length >= 6, 'ключи-цвета');
  for (const [k, into] of Object.entries(INTO)) assert.match(MATS, new RegExp(`^ {4}${into}: *S\\((?:std|phys)\\(\\{[^{}]*vertexColors: true`, 'm'), `M.${k} → M.${into}: нет цвета вершин`);
  for (const [f, n] of Object.entries(BUDGET)) {
    const by = builders(PART(f)), got = meshes(by);
    assert.ok(got <= n, `${f}: ${got} мешей, бюджет ${n}`);
    for (const k of ['steel', 'steelDark', 'brass']) assert.ok(!by.get('P').has(k), `${f}: M.${k} в корпусе — для мелочи M.fitting, M.fittingDark, M.shell`);
  }
  for (const k of ['bolt', 'boltDark', 'copper', 'fitting', 'fittingDark', 'shell', 'wire']) assert.equal(INTO[k], 'hw', `M.${k}`);
  for (const k of ['paintBlue', 'paintRed']) assert.equal(INTO[k], 'paintHw', `M.${k}`);
});

const PATHS = {
  'intake.js': [
  "const PLEN = { y: 3.48, z: -2.05, r: 0.30, x0: -2.15, x1: 2.15 };",
  "const pts = [V3(x, PLEN.y - 0.05, PLEN.z + 0.15), V3(x, 3.30, -1.75), V3(x, 3.06, -1.42), V3(x, 2.96, -1.06)];",
  "const path = [V3(PLEN.x0 - 0.75, PLEN.y, PLEN.z), V3(PLEN.x0 - 0.2, PLEN.y, PLEN.z)];",
  "for (let px = PLEN.x0 + 0.3;",
  "path.push(V3(px, PLEN.y, PLEN.z));",
  "path.push(V3(x, PLEN.y + 0.02, PLEN.z + 0.02), V3(x, 3.30, -1.75), V3(x, 3.06, -1.42), V3(x, 2.95, -1.0), V3(x, 2.80, -0.58), V3(x, 2.60, -0.27), V3(x, 2.34, -0.08));",
  "intakePaths[i] = new THREE.CatmullRomCurve3(path, false, 'centripetal');"
],
  'exhaust.js': [
  "const COLL = { y: 1.80, z: 1.90 };",
  "const outPts = [V3(1.98, COLL.y, COLL.z), V3(2.5, COLL.y - 0.03, COLL.z + 0.17), V3(2.92, COLL.y - 0.1, COLL.z + 0.52)];",
  "const pts = [V3(x, 2.88, 0.98), V3(x, 2.88, 1.36), V3(x, 2.70, 1.72), V3(x, 2.20, COLL.z), V3(x, COLL.y + 0.05, COLL.z)];",
  "const path = [V3(x, 2.34, 0.08), V3(x, 2.60, 0.27), V3(x, 2.80, 0.6), ...pts.slice(0, 4), V3(x, COLL.y, COLL.z)];",
  "for (let px = x + 0.45;",
  "path.push(V3(px, COLL.y, COLL.z));",
  "path.push(...outPts, V3(3.35, COLL.y - 0.2, COLL.z + 0.95), V3(3.7, COLL.y - 0.25, COLL.z + 1.4));",
  "exhaustPaths[i] = new THREE.CatmullRomCurve3(path, false, 'centripetal');",
  "const outCurve = new THREE.CatmullRomCurve3(outPts);"
]
};
const paths = s => [...s.matchAll(/(?:const (?:PLEN|COLL|outPts|pts|path|outCurve) =|for \(let px|path\.push\(|(?:intake|exhaust)Paths\[i\] =)[^;]*;/g)].map(m => m[0].replace(/\s+/g, ' '));
const tubes = s => [...s.matchAll(/(?:TubeGeometry|G\.tube)\((?:new THREE\.CatmullRomCurve3\((pts|outCurve)[^)]*\)|(outCurve)), \d+, ([\d.]+),/g)].map(m => `${m[1] || m[2]} ${m[3]}`);

test('пути частиц, ресивер, коллектор и осевые линии труб — как на main@307a0c0; радиусы труб прежние', () => {
  for (const [f, exp] of Object.entries(PATHS)) assert.deepEqual(paths(PART(f)), exp, f);
  assert.deepEqual(tubes(PART('intake.js')), ['pts 0.13']);
  assert.deepEqual(tubes(PART('exhaust.js')), ['pts 0.15', 'outCurve 0.22']);
  assert.match(PART('intake.js'), /G\.cylX\(PLEN\.r, PLEN\.x1 - PLEN\.x0, \d+\), M\.plastic, \[\(PLEN\.x0 \+ PLEN\.x1\) \/ 2, PLEN\.y, PLEN\.z\]\)/);
  assert.match(PART('exhaust.js'), /G\.cylX\(0\.24, 4\.05, \d+\), M\.pipe2, \[-0\.03, COLL\.y, COLL\.z\]\)/);
});

test('фаска внутрь: extrudeY, extrudeZ, extrudeXb не меняют внешний размер; extrudeX — прежний', () => {
  for (const f of ['extrudeY', 'extrudeZ', 'extrudeXb']) {
    const body = GEO.slice(GEO.indexOf(`function ${f}(`), GEO.indexOf('\n}\n', GEO.indexOf(`function ${f}(`)));
    assert.match(body, /depth: depth - 2 \* bevel,/, `${f}: толщина без двух фасок`);
    assert.match(body, /bevelThickness: bevel, bevelSize: bevel \* 0\.8, bevelOffset: -bevel \* 0\.8,/, `${f}: фаска внутрь контура`);
  }
  assert.match(GEO, /^function extrudeY\(shape, depth, seg = 32, bevel = 0\) \{$/m, 'extrudeY без фаски — как раньше');
  assert.match(GEO, /function extrudeX\(shape, depth, seg = 24, bevel = 0\) \{\n  const g = new THREE\.ExtrudeGeometry\(shape, \{ depth, curveSegments: lodSeg\(seg\), bevelEnabled: bevel > 0,\n    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 \}\);/);
});

test('Parts.add(): ключ-цвет → цвет вершин и общий материал; Parts.bolt() — болт по направлению ROT', () => {
  const add = GEO.slice(GEO.indexOf('  add(geo, mat, pos, rot, scl) {'), GEO.indexOf('\n  }\n', GEO.indexOf('  add(geo, mat, pos, rot, scl) {')));
  const strip = add.indexOf("if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);"), into = add.indexOf('const into = mat.userData.into;');
  assert.ok(strip > 0 && into > strip, 'цвет добавляется после очистки атрибутов');
  assert.match(add, /g\.setAttribute\('color', new THREE\.BufferAttribute\(a, 3\)\);\n      mat = M\[into\];/);
  assert.ok(add.indexOf('this.byMat.has(mat)') > add.indexOf('mat = M[into];'), 'меш группируется по общему материалу');
  assert.match(GEO, /^  bolt\(mat, pos, dir = 'y', r = 0\.04, h = 0\.035\) \{[^\n]*\n    return detail\.low && mat\.userData\.into === 'hw' \? this : this\.add\(boltGeo\(r, h\), mat, pos, ROT\[dir\]\);\n  \}/m);
  assert.match(GEO, /^const ROT = \{ y: null, '-y': \[Math\.PI, 0, 0\], z: \[Math\.PI \/ 2, 0, 0\], '-z': \[-Math\.PI \/ 2, 0, 0\], x: \[0, 0, -Math\.PI \/ 2\], '-x': \[0, 0, Math\.PI \/ 2\] \};$/m);
  assert.match(MATS, /const tint = \(color, into = 'hw'\) => \{ const m = std\(\{ color \}\); m\.userData\.into = into; return m; \};/);
});

test('размеры спецификации A: отверстия цилиндров — BORE_R по осям CYL_X, блок до DECK_Y, головка от HEAD_BOT до HEAD_TOP', () => {
  const b = PART('block.js'), h = PART('head.js');
  assert.match(b, /import \{ BORE_R, CRANK_Y \} from '\.\.\/\.\.\/config\/engine-spec\.js';/);
  assert.match(b, /import \{ CYL_X, BLOCK_Y0, CRANK_TOP, DECK_Y \} from '\.\.\/world\.js';/);
  assert.equal((b.match(/CYL_X\.forEach\(x => s[dh]?\.holes\.push\(holePath\(x, 0, BORE_R\)\)\);/g) || []).length, 2, 'отверстия блока и привалочной плоскости');
  assert.match(b, /P\.add\(extrudeY\(s, DECK_Y - 0\.07 - CRANK_TOP - 0\.08, 48\), M\.aluCast, \[0, CRANK_TOP \+ 0\.08, 0\]\);/);
  assert.match(b, /P\.add\(extrudeY\(sd, 0\.07, 48, 0\.012\), M\.aluMach, \[0, DECK_Y - 0\.07, 0\]\);/, 'плоскость блока доходит до DECK_Y');
  assert.match(h, /const hw = 0\.95, hb = HEAD_BOT, ht = HEAD_TOP, tw = 0\.82, L = 4\.7;/);
  assert.match(h, /h\.absarc\(x, 0, BORE_R \+ 0\.01, 0, Math\.PI \* 2, true\);/, 'прокладка — прежняя');
});

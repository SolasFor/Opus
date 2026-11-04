/**
 * M-07a: облик модульной версии — материалы, процедурная фактура, сглаживание нормалей, свет, уровни качества и AO.
 * 1) render/surface.js — чистый модуль без импортов. patchShader() вставляет фактуру сразу после нужных фрагментов
 *    шейдера three.js и падает с понятной ошибкой, если фрагмента нет (three.js сменил имена) — фактура не пропадает
 *    молча. applySurface() дополняет onBeforeCompile и ключ программы материала; без WebGL2 шейдер не меняет;
 *    материал без вида фактуры или с неизвестным видом не трогает.
 * 2) Статически: каждый материал M.x, который упоминает код, объявлен в createMaterials(); вид фактуры userData.surf —
 *    из KINDS; nodeMat() подключает фактуру к клону материала до makeHousing(); extrudeX и extrudeY сглаживают нормали;
 *    свет и студийное окружение умножены на GAIN при прежней экспозиции 1,0.
 * 3) render/quality.js — чистый модуль: AO по умолчанию на компьютере с WebGL2, ?ao и ?noao, без WebGL2 — никогда;
 *    адаптивное разрешение выключает AO после SLOW_RUN медленных измерений подряд при pixelRatio не выше 1.
 * 4) Статически: кадр и снимок экрана рисует renderFrame() из render/post.js, больше renderer.render() нигде нет;
 *    уровень качества задаёт setAO() сразу после initScene(), disposePost() — в dispose() до renderer.dispose().
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { KINDS, CHUNKS, patchShader, applySurface } from '../src/render/surface.js';
import { FPS_LOW, SLOW_RUN, wantAO, slowRun } from '../src/render/quality.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// фрагменты в том же порядке, что в шейдерах MeshStandardMaterial и MeshPhysicalMaterial three.js 0.160
const VERT = 'void main() {\n#include <begin_vertex>\n#include <project_vertex>\n}';
const FRAG = ['#include <color_fragment>', '#include <roughnessmap_fragment>', '#include <normal_fragment_begin>',
  '#include <normal_fragment_maps>', '#include <emissivemap_fragment>', '#include <dithering_fragment>'];
const shader = () => ({ uniforms: {}, vertexShader: VERT, fragmentShader: 'void main() {\n' + FRAG.join('\n') + '\n}' });
const WEBGL2 = { capabilities: { isWebGL2: true } }, WEBGL1 = { capabilities: { isWebGL2: false } };
const count = (s, sub) => s.split(sub).length - 1;

test('surface: patchShader() вставляет фактуру после фрагментов three.js, параметры вида — в #define', () => {
  for (const [kind, k] of Object.entries(KINDS)) {
    const sh = patchShader(shader(), kind), v = sh.vertexShader, f = sh.fragmentShader;
    assert.ok(v.startsWith('varying vec3 vSurfP;\n'), kind);
    assert.ok(v.includes('#include <begin_vertex>\n  vSurfP = position;'), `${kind}: координаты детали после begin_vertex`);
    for (const [name, val] of Object.entries({ G: k.g, B: k.b, S: k.s, C: k.c, R: k.r }))
      assert.ok(f.includes(`#define SURF_${name} ${val.toFixed(6)}\n`), `${kind}: SURF_${name}`);
    assert.equal(count(f, 'varying vec3 vSurfP;'), 1, kind);
    for (const c of FRAG) assert.equal(count(f, c), 1, `${kind}: ${c} остаётся один раз`);
    const after = (chunk, code, next) => {
      const a = f.indexOf(chunk), b = f.indexOf(code), c = f.indexOf(next);
      assert.ok(a >= 0 && a < b && b < c, `${kind}: «${code}» между ${chunk} и ${next}`);
    };
    after(CHUNKS[1], 'diffuseColor.rgb *=', CHUNKS[2]);
    after(CHUNKS[2], 'roughnessFactor = clamp(roughnessFactor', '#include <normal_fragment_begin>');
    after(CHUNKS[3], 'normal = surfPerturb(', '#include <emissivemap_fragment>');
    assert.ok(f.indexOf('float sBl') < f.indexOf('roughnessFactor = clamp'), `${kind}: пятна объявлены до шероховатости`);
  }
});

test('surface: нет фрагмента шейдера или вида фактуры — ошибка с именем, а не молча пропавшая фактура', () => {
  for (const c of CHUNKS) {
    const sh = shader();
    if (c === CHUNKS[0]) sh.vertexShader = sh.vertexShader.replace(c, ''); else sh.fragmentShader = sh.fragmentShader.replace(c, '');
    assert.throws(() => patchShader(sh, 'cast'), new RegExp(`surface: нет фрагмента шейдера ${c}`));
  }
  for (const kind of ['shield', 'toString', undefined]) assert.throws(() => patchShader(shader(), kind), /surface: неизвестный вид фактуры/);
});

test('surface: applySurface() дополняет onBeforeCompile и ключ программы; без WebGL2 шейдер не меняет', () => {
  const calls = [];
  const mat = surf => ({ userData: { surf }, onBeforeCompile(sh, r) { calls.push([sh, r, sh.fragmentShader.includes('SURF_G')]); }, customProgramCacheKey() { return 'base'; } });
  for (const kind of Object.keys(KINDS)) {
    const m = mat(kind);
    assert.equal(applySurface(m), true);
    assert.equal(m.customProgramCacheKey(), `surf-${kind}|base`);
    calls.length = 0;
    const sh = shader();
    m.onBeforeCompile(sh, WEBGL2);
    assert.deepEqual(calls, [[sh, WEBGL2, true]], `${kind}: вставка до прежнего onBeforeCompile, тот же объект шейдера`);
    calls.length = 0;
    const sh1 = shader();
    m.onBeforeCompile(sh1, WEBGL1);
    assert.deepEqual(calls, [[sh1, WEBGL1, false]], `${kind}: WebGL1 — без вставки`);
    assert.deepEqual(sh1, shader());
  }
  for (const surf of [undefined, 'shield', 'toString']) {
    const m = mat(surf), { onBeforeCompile, customProgramCacheKey } = m;
    assert.equal(applySurface(m), false, String(surf));
    assert.equal(m.onBeforeCompile, onBeforeCompile); assert.equal(m.customProgramCacheKey, customProgramCacheKey);
  }
});

test('surface: параметры видов фактуры — конечные положительные числа', () => {
  assert.ok(Object.keys(KINDS).length >= 6);
  for (const [kind, k] of Object.entries(KINDS)) {
    assert.deepEqual(Object.keys(k), ['g', 'b', 's', 'c', 'r'], kind);
    for (const [p, v] of Object.entries(k)) assert.ok(Number.isFinite(v) && v > 0, `${kind}.${p}`);
    assert.ok(k.b < 0.001 && k.c < 0.2 && k.r < 0.2, `${kind}: рельеф меньше 0,1 мм, разброс цвета и шероховатости меньше 20 %`);
  }
});

// ---------- статические проверки ----------
const SRC = new URL('../src/', import.meta.url);
const walk = d => readdirSync(new URL(d, SRC), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(`${d}${e.name}/`) : e.name.endsWith('.js') ? [d + e.name] : []);
const MATS = read('../src/render/materials.js');
const BLOCK = MATS.slice(MATS.indexOf('  M = {\n'), MATS.indexOf('\n  };\n', MATS.indexOf('  M = {\n')));
const KEYS = [...BLOCK.matchAll(/^ {4}([\w$]+):/gm)].map(m => m[1]);

test('материалы: каждый M.x, который упоминает код, объявлен; вид фактуры — из KINDS', () => {
  assert.ok(KEYS.length >= 20, 'материалы M');
  for (const f of walk('render/').concat(walk('ui/'))) for (const [, k] of read(`../src/${f}`).matchAll(/(?<![\w$.])M\.([\w$]+)/g))
    assert.ok(KEYS.includes(k), `${f}: M.${k} не объявлен в createMaterials()`);
  const lines = BLOCK.split('\n').filter(l => /^ {4}[\w$]+:/.test(l));
  assert.equal(lines.length, KEYS.length);
  for (const l of lines) {
    const s = l.match(/^ {4}([\w$]+): *S\((?:std|phys)\(\{[^{}]*\}\), '([\w$]+)'\),?(?: *\/\/.*)?$/);
    if (!s) { assert.match(l, /^ {4}ceramic: *phys\(/, `без фактуры — только керамика: ${l.trim()}`); continue; }
    assert.ok(s[2] in KINDS, `M.${s[1]}: вид фактуры ${s[2]} не из KINDS`);
  }
});

test('extrudeX и extrudeY сглаживают нормали до угла 38°: дуги и фаски не гранёные', () => {
  const geo = read('../src/render/parts/geometry.js');
  assert.match(geo, /^const CREASE = 38 \* Math\.PI \/ 180;$/m);
  assert.match(geo, /^function smooth\(g\) \{ const r = toCreasedNormals\(g, CREASE\); if \(r !== g\) g\.dispose\(\); return r; \}$/m);
  for (const f of ['extrudeX', 'extrudeY']) {
    const body = geo.slice(geo.indexOf(`function ${f}(`), geo.indexOf('\n}\n', geo.indexOf(`function ${f}(`)));
    assert.match(body, /\n  return smooth\(g\);$/, f);
  }
});

test('свет: студийное окружение и источники умножены на GAIN, экспозиция 1,0 — свечение и частицы прежние', () => {
  const scene = read('../src/render/scene.js'), studio = read('../src/render/studio.js');
  assert.match(scene, /^  renderer\.toneMappingExposure = 1\.0;$/m);
  assert.match(scene, /^  envRoom = new StudioEnvironment\(\);$/m);
  assert.doesNotMatch(scene, /RoomEnvironment\(/);
  const lights = [...scene.matchAll(/new THREE\.(?:Hemisphere|Directional)Light\(([^()]*)\)/g)].map(m => m[1]);
  assert.equal(lights.length, 4, 'небо, ключевой, заполняющий, контровой');
  for (const l of lights) assert.match(l, /, \d\.\d+ \* GAIN$/, l);
  assert.match(studio, /^const GAIN = 0\.92;$/m);
  assert.match(studio, /new THREE\.Color\(c\)\.multiplyScalar\(k \* GAIN\)/);
  assert.equal((studio.match(/^ {4}box\(/gm) || []).length, 8, 'стены, пол и шесть световых панелей');
});

test('nodeMat(): фактура подключается к клону материала узла до makeHousing()', () => {
  const geo = read('../src/render/parts/geometry.js');
  const body = geo.slice(geo.indexOf('function nodeMat('), geo.indexOf('\n}\n', geo.indexOf('function nodeMat(')));
  const clone = body.indexOf('const m = base.clone();'), surf = body.indexOf('applySurface(m);'), house = body.indexOf('if (ud.housing) makeHousing(m);');
  assert.ok(clone >= 0 && clone < surf && surf < house, 'base.clone() → applySurface(m) → makeHousing(m)');
});

test('качество: AO по умолчанию на компьютере с WebGL2, ?ao включает, ?noao выключает, без WebGL2 — никогда', () => {
  const cases = [['', true, false, true], ['', true, true, false], ['?ao', true, true, true], ['?noao', true, false, false],
    ['?ao&noao', true, true, false], ['?ao', false, false, false], ['', false, false, false], ['?noadapt', true, false, true]];
  for (const [q, webgl2, coarse, want] of cases)
    assert.equal(wantAO(new URLSearchParams(q), { webgl2, coarse }), want, `«${q}» webgl2=${webgl2} coarse=${coarse}`);
});

test('качество: AO выключается после SLOW_RUN медленных измерений подряд при pixelRatio не выше 1', () => {
  assert.equal(SLOW_RUN, 3);
  let run = 0;
  for (const [fps, pr, want] of [[30, 1.25, 0], [30, 1, 1], [FPS_LOW - 0.1, 0.75, 2], [FPS_LOW, 1, 0], [20, 1, 1], [20, 1, 2], [20, 1, 3], [59, 1, 0]]) {
    run = slowRun(run, fps, pr);
    assert.equal(run, want, `${fps} к/с при ${pr}×`);
  }
  const main = read('../src/main.js');
  assert.ok(main.includes(`if (perf.fps < ${FPS_LOW} && pr > 1)`), 'порог FPS_LOW — тот же, при котором main.js снижает разрешение');
  assert.match(main, /^ {4}perf\.slow = aoOn\(\) \? slowRun\(perf\.slow, perf\.fps, pixelRatio\) : 0;.*\n {4}if \(perf\.slow >= SLOW_RUN\) setAO\(false\);$/m);
  assert.match(main, /^const perf = \{[^\n]*adaptive: !params\.has\('noadapt'\) \};$/m, '?noadapt выключает и адаптивное разрешение, и сброс AO');
});

test('кадр и снимок экрана рисует renderFrame(); renderer.render() есть только в render/post.js', () => {
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const f of ['main.js', ...['anim/', 'audio/', 'render/', 'ui/'].flatMap(walk)].filter(f => f !== 'render/post.js'))
    assert.doesNotMatch(strip(read(`../src/${f}`)), /\.render\(/, `${f}: рисует мимо renderFrame()`);
  const fn = (t, name) => t.slice(t.indexOf(`function ${name}(`), t.indexOf('\n}\n', t.indexOf(`function ${name}(`)));
  const main = read('../src/main.js'), controls = read('../src/ui/controls.js');
  assert.match(fn(main, 'frame'), /\n  renderFrame\(\);/);
  assert.match(fn(controls, 'screenshot'), /^function screenshot\(\) \{\n  renderFrame\(\);\n  const url = renderer\.domElement\.toDataURL/);
  assert.match(fn(main, 'boot'), /^function boot\(\) \{\n  initScene\(\);\n  setAO\(wantAO\(params, \{ webgl2: renderer\.capabilities\.isWebGL2, coarse: matchMedia\('\(pointer: coarse\)'\)\.matches \}\)\);\n/);
  const dispose = fn(main, 'dispose');
  assert.ok(dispose.indexOf('disposePost();') > 0 && dispose.indexOf('disposePost();') < dispose.indexOf('renderer.dispose();'), 'disposePost() до renderer.dispose()');
  const post = read('../src/render/post.js');
  assert.match(fn(post, 'renderFrame'), /^function renderFrame\(\) \{\n  if \(!rt\) \{ renderer\.render\(scene, camera\); return; \}/, 'без AO — прежний renderer.render()');
});

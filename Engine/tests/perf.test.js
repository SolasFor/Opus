/* M-06: производительность Engine — изменения без изменения картинки.
 * 1) M-06a, карта теней по требованию (render/shadows.js): на объектах-заглушках в Node — карта перерисовывается
 *    в первом кадре, после замены renderer.shadowMap (восстановление контекста) и когда меняется то, что в неё
 *    попадает: матрица отбрасывающего тень объекта, матрицы экземпляров, геометрия, видимость, свет и его цель.
 *    Не перерисовывается, когда ничего не изменилось или изменились объекты без тени (камера, частицы).
 *    Статически: renderFrame() вызывает updateShadows() до отрисовки, больше никто не трогает shadowMap.autoUpdate
 *    и shadowMap.needsUpdate.
 * 2) M-06b, адаптивное разрешение с гистерезисом (adaptPR в render/quality.js): без неудачных повышений — прежние
 *    правила (сразу ниже при fps < 46, выше после 4 измерений > 58, шаг 0,25, от 1× до maxPR); неудачное повышение
 *    удваивает ожидание (4 → 8 → 16 с), удачное возвращает 4 с; на границе двух уровней — не больше 8 смен в минуту
 *    (было 24), после облегчения разрешение возвращается не дольше чем за 16 + 4 с на шаг.
 * Без сторонних зависимостей: render/shadows.js и render/quality.js ничего не импортируют.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { updateShadows } from '../src/render/shadows.js';
import { FPS_LOW, FPS_HIGH, HOLD, HOLD_MAX, TRIAL, ADAPT0, adaptPR } from '../src/render/quality.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const walk = d => readdirSync(new URL(`../src/${d}`, import.meta.url), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(`${d}${e.name}/`) : e.name.endsWith('.js') ? [`${d}${e.name}`] : []);

let nextId = 1;
const M4 = () => ({ elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] });
const obj = (props = {}) => ({ id: nextId++, visible: true, children: [], matrixWorld: M4(), castShadow: false, ...props });
const mesh = (props = {}) => obj({ isMesh: true, castShadow: true, geometry: { id: nextId++ }, ...props });
const add = (parent, ...kids) => { parent.children.push(...kids); return parent; };
function fakeScene(...kids) {
  const s = obj({ isScene: true, updates: 0 });
  s.updateMatrixWorld = () => { s.updates++; };
  s.traverseVisible = cb => { const go = o => { if (!o.visible) return; cb(o); o.children.forEach(go); }; go(s); };
  return add(s, ...kids);
}

test('M-06a: карта теней перерисовывается, только когда меняется то, что в неё попадает', () => {
  const target = obj(), light = obj({ isLight: true, isDirectionalLight: true, castShadow: true, target });
  const fill = obj({ isLight: true, castShadow: false });
  const block = mesh(), crank = mesh(), noShadow = mesh({ castShadow: false });
  const pistons = mesh({ isInstancedMesh: true, count: 4, instanceMatrix: { array: new Float32Array(64).fill(0.5) } });
  const node = add(obj(), crank, pistons), cam = obj({ isCamera: true }), dots = obj({ isPoints: true, geometry: { id: nextId++ } });
  const scene = fakeScene(light, target, fill, block, node, noShadow, cam, dots);
  const renderer = { shadowMap: { autoUpdate: true, needsUpdate: false } };
  const step = () => { const r = updateShadows(renderer, scene); const n = renderer.shadowMap.needsUpdate; renderer.shadowMap.needsUpdate = false; return [r, n]; };
  assert.deepEqual(step(), [true, true], 'первый кадр');
  assert.equal(renderer.shadowMap.autoUpdate, false, 'three.js сам карту не перерисовывает');
  assert.equal(scene.updates, 1, 'матрицы обновляются до сравнения');
  assert.deepEqual(step(), [false, false], 'ничего не изменилось');
  // камера, частицы, объект без тени, свет без тени — в карту не входят
  cam.matrixWorld.elements[12] = 5; dots.matrixWorld.elements[13] = 1; noShadow.matrixWorld.elements[14] = 2;
  fill.matrixWorld.elements[12] = 3; noShadow.visible = false;
  assert.deepEqual(step(), [false, false], 'камера и объекты без тени');
  const changes = [
    ['матрица детали', () => { crank.matrixWorld.elements[5] = Math.cos(0.1); }],
    ['матрица экземпляра', () => { pistons.instanceMatrix.array[61] = 0.25; }],
    ['число экземпляров', () => { pistons.count = 3; }],
    ['геометрия', () => { block.geometry = { id: nextId++ }; }],
    ['скрыт узел', () => { node.visible = false; }],
    ['показан узел', () => { node.visible = true; }],
    ['свет', () => { light.matrixWorld.elements[12] = 7.5; }],
    ['цель света', () => { target.matrixWorld.elements[13] = 1.6; }],
    ['тень выключена', () => { block.castShadow = false; }],
    ['новая деталь', () => { add(node, mesh()); }]];
  for (const [name, change] of changes) {
    change();
    assert.deepEqual(step(), [true, true], name);
    assert.deepEqual(step(), [false, false], `${name}: следующий кадр без изменений`);
  }
  // то же значение — не изменение
  crank.matrixWorld.elements[5] = Math.cos(0.1);
  assert.deepEqual(step(), [false, false], 'то же значение');
  // восстановление контекста: three.js создаёт новый renderer.shadowMap
  renderer.shadowMap = { autoUpdate: true, needsUpdate: false };
  assert.deepEqual(step(), [true, true], 'новый shadowMap');
  assert.equal(renderer.shadowMap.autoUpdate, false);
  assert.deepEqual(step(), [false, false]);
});

test('M-06a: renderFrame() решает про карту теней до отрисовки; больше её никто не перерисовывает', () => {
  const post = read('../src/render/post.js');
  assert.match(post, /^function renderFrame\(\) \{\n  updateShadows\(renderer, scene\);[^\n]*\n  if \(!rt\) \{ renderer\.render\(scene, camera\); return; \}/m);
  assert.match(post, /^import \{ updateShadows \} from '\.\/shadows\.js';$/m);
  for (const f of ['main.js', ...['anim/', 'audio/', 'render/', 'ui/'].flatMap(walk)].filter(f => f !== 'render/shadows.js'))
    assert.doesNotMatch(strip(read(`../src/${f}`)), /shadowMap\.(autoUpdate|needsUpdate)|\.shadow\.(autoUpdate|needsUpdate)/, f);
  const sh = strip(read('../src/render/shadows.js'));
  assert.doesNotMatch(sh, /^import /m, 'render/shadows.js ничего не импортирует');
  assert.match(sh, /root\.updateMatrixWorld\(\);\n {2}root\.traverseVisible\(visit\);/, 'матрицы — до снимка');
});

// fps — массив измерений (по одному в секунду) или функция (pr, t) → fps; возвращает pixelRatio после каждого шага
const runAdapt = (fps, n, pr0, maxPR = 1.75) => {
  let s = { ...ADAPT0, pr: pr0 }; const out = [];
  for (let t = 0; t < n; t++) { s = adaptPR(s, typeof fps === 'function' ? fps(s.pr, t) : fps[t], maxPR); out.push(s.pr); }
  return out;
};
const changesOf = prs => prs.filter((p, i) => i > 0 && p !== prs[i - 1]).length;

test('M-06b: без неудачных повышений adaptPR() работает по прежним правилам', () => {
  assert.deepEqual([FPS_LOW, FPS_HIGH, HOLD, HOLD_MAX, TRIAL], [46, 58, 4, 16, 10]);
  assert.deepEqual(runAdapt([30, 30, 30, 30], 4, 1.75), [1.5, 1.25, 1, 1], 'медленно: сразу ниже, не ниже 1×');
  assert.deepEqual(runAdapt([60, 60, 60, 60, 60, 60, 60, 60], 8, 1), [1, 1, 1, 1.25, 1.25, 1.25, 1.25, 1.5], 'быстро: выше после 4 измерений');
  assert.deepEqual(runAdapt([60, 60, 60, 50, 60, 60, 60, 60], 8, 1), [1, 1, 1, 1, 1, 1, 1, 1.25], 'средний fps обнуляет счёт');
  assert.deepEqual(runAdapt([60, 60, 60, 60, 60], 5, 1.75), [1.75, 1.75, 1.75, 1.75, 1.75], 'не выше maxPR');
  assert.deepEqual(runAdapt([60, 60, 60, 60], 4, 1, 1), [1, 1, 1, 1], 'maxPR 1× — без изменений');
  assert.deepEqual(runAdapt([FPS_LOW, FPS_HIGH, FPS_HIGH, FPS_HIGH, FPS_HIGH], 5, 1.5), [1.5, 1.5, 1.5, 1.5, 1.5], 'пороги не включаются');
  const s = { ...ADAPT0, pr: 1.5 }; adaptPR(s, 30, 1.75);
  assert.deepEqual(s, { ...ADAPT0, pr: 1.5 }, 'состояние не меняется на месте');
  // всплеск нагрузки без неудачных повышений: возврат к 1,75× за 3 шага по 4 с, как раньше
  const spike = runAdapt((pr, t) => (t >= 5 && t < 8 ? 30 : 60), 30, 1.75);
  assert.equal(spike.indexOf(1.75, 8), 7 + 3 * HOLD);
});

test('M-06b: неудачное повышение удваивает ожидание (4 → 8 → 16 с), удачное возвращает 4 с', () => {
  const at = (s, fps) => adaptPR(s, fps, 1.75);
  let s = { ...ADAPT0, pr: 1.25 };
  for (let k = 0; k < HOLD; k++) s = at(s, 60);
  assert.equal(s.pr, 1.5, 'повышение');
  s = at(s, 40); assert.deepEqual([s.pr, s.hold], [1.25, 2 * HOLD], 'не удалось — ждать 8');
  for (let k = 0; k < 2 * HOLD - 1; k++) s = at(s, 60);
  assert.equal(s.pr, 1.25, 'ещё ждёт');
  s = at(s, 60); assert.equal(s.pr, 1.5);
  for (let k = 0; k < TRIAL - 1; k++) s = at(s, 50);
  s = at(s, 40); assert.deepEqual([s.pr, s.hold], [1.25, 4 * HOLD], 'снижение в пределах TRIAL — неудача');
  for (let k = 0; k < 4 * HOLD; k++) s = at(s, 60);
  s = at(s, 40); assert.equal(s.hold, HOLD_MAX, 'не больше HOLD_MAX');
  for (let k = 0; k < HOLD_MAX; k++) s = at(s, 60);
  assert.equal(s.pr, 1.5);
  for (let k = 0; k < TRIAL; k++) s = at(s, 50);
  assert.equal(s.hold, HOLD_MAX, 'TRIAL измерений ещё не прошло');
  s = at(s, 50); assert.deepEqual([s.pr, s.hold], [1.5, HOLD], 'продержалось TRIAL измерений — снова 4');
  s = at(s, 40); assert.deepEqual([s.pr, s.hold], [1.25, HOLD], 'снижение позже TRIAL — не неудача');
});

test('M-06b: на границе двух уровней разрешение не качается каждые 5 с; после облегчения возвращается', () => {
  const edge = (pr, t) => (pr > 1.25 ? 44 : 60);            // 1,5× не тянет, 1,25× тянет
  const prs = runAdapt(edge, 600, 1.75);
  assert.ok(changesOf(prs) / 10 <= 8, `${changesOf(prs) / 10} смен в минуту`);
  assert.ok(prs.slice(5).every(p => p === 1.25 || p === 1.5));
  assert.ok(prs.filter(p => p === 1.5).length / 600 < 0.08, 'на неудачном уровне — меньше 8 % времени');
  // после облегчения (с 300-й секунды тянет любой уровень) — 1,75× не позже чем за HOLD_MAX + 4 с на шаг
  const relief = runAdapt((pr, t) => (t < 300 ? edge(pr) : 60), 400, 1.75);
  assert.ok(relief.indexOf(1.75, 300) - 300 <= HOLD_MAX + 2 * HOLD, `${relief.indexOf(1.75, 300) - 300} с`);
});

/**
 * A-04, шаг 2: ночной отдых и укрытия (src/sim/rest.js, параметры — src/config/ecosystem.js) и их связка в main.js.
 * Днём и на закате модель ничего не меняет; ночью скорость ближе к минимуму вида, стаи — у укрытий над рифом,
 * одиночные рыбы — у боков камней, клоуны — ближе к анемону. Без three и DOM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { REST } from '../src/config/ecosystem.js';
import { restWeight, speedHi, restAttractor, shelterTop, shelterSide, homeSpread } from '../src/sim/rest.js';
import { MAIN } from './_app.js';

const OBST = JSON.parse(MAIN.match(/const OBST = (\[\[[^;]*\]\]);/)[1]);   // камни [x, y, z, радиус] из main.js
const SPEEDS = [[0.9, 2.0], [0.8, 1.8], [0.3, 0.8], [0.5, 1.2], [0.5, 1.1], [0.45, 1.0]];   // диапазоны скоростей видов (behavior-models)
const v = (x, y, z) => ({ x, y, z });

test('днём и на закате отдыха нет: функции возвращают прежние значения', () => {
  for (const n of [0, 0.1, 0.22, REST.on, -1, NaN, undefined]) assert.equal(restWeight(n), 0, `night = ${n}`);
  const att = v(1.3, 4.1, -0.7), out = v(0, 0, 0);
  assert.deepEqual(restAttractor(att, v(-3.6, 4.6, -2), 0, out), att);
  for (const [lo, hi] of SPEEDS) assert.equal(speedHi(lo, hi, 0), hi);
  assert.equal(homeSpread(0), 1);
});

test('вес отдыха растёт с «Ночью» монотонно от 0 до 1', () => {
  let prev = 0;
  for (let i = 0; i <= 200; i++) {
    const w = restWeight(i / 200);
    assert.ok(w >= 0 && w <= 1 && w >= prev, `night = ${i / 200}: ${w}`);
    prev = w;
  }
  assert.equal(restWeight(1), 1);
  assert.equal(restWeight(2), 1);
  assert.ok(REST.on > 0.22, 'пресет «Закат» (0,22) не включает отдых');
});

test('ночью верхний предел скорости ближе к минимуму вида, но не ниже его', () => {
  for (const [lo, hi] of SPEEDS) {
    for (let i = 0; i <= 10; i++) { const s = speedHi(lo, hi, i / 10); assert.ok(s >= lo && s <= hi, `${lo}…${hi}, r = ${i / 10}: ${s}`); }
    assert.ok(Math.abs(speedHi(lo, hi, 1) - (lo + (1 - REST.act) * (hi - lo))) < 1e-12);
  }
});

test('точка стаи ночью стягивается к укрытию; out может совпадать с att', () => {
  const s = v(-3.6, 4.6, -2), att = v(5, 5, 1), d0 = Math.hypot(att.x - s.x, att.y - s.y, att.z - s.z);
  const r = restAttractor(att, s, 1, att);
  assert.equal(r, att);
  const d1 = Math.hypot(att.x - s.x, att.y - s.y, att.z - s.z);
  assert.ok(Math.abs(d1 - (1 - REST.pull) * d0) < 1e-9, `${d1} vs ${(1 - REST.pull) * d0}`);
});

test('укрытия — снаружи камней, у передней стороны и в пределах целей рыб', () => {
  const solo = Object.values(REST.solo).flat();
  for (const j of [...REST.school, ...solo]) assert.ok(Number.isInteger(j) && OBST[j], `камень ${j} есть в OBST`);
  for (const j of REST.school) {
    const o = OBST[j], p = shelterTop(o, v(0, 0, 0));
    assert.ok(Math.hypot(p.x - o[0], p.y - o[1], p.z - o[2]) > o[3] + 0.5, `укрытие стаи над камнем ${j}`);
    assert.ok(p.y < 7, `камень ${j}: укрытие ниже поверхности (${p.y})`);
  }
  for (const j of solo) for (const a of [REST.side[0], (REST.side[0] + REST.side[1]) / 2, REST.side[1]]) {
    const o = OBST[j], p = shelterSide(o, a, v(0, 0, 0));
    assert.ok(Math.abs(Math.hypot(p.x - o[0], p.z - o[2]) - (o[3] + REST.gap)) < 1e-9);
    assert.ok(p.z > o[2], `камень ${j}, угол ${a}: точка перед камнем`);
    assert.ok(Math.abs(p.x) <= 6.2 && p.z >= -2.0 && p.z <= 2.6, `камень ${j}, угол ${a}: (${p.x}, ${p.z}) в пределах целей pickTarget`);
  }
});

test('клоуны ночью держатся ближе к анемону', () => {
  let prev = 1;
  for (let i = 0; i <= 10; i++) { const s = homeSpread(i / 10); assert.ok(s <= prev && s > 0); prev = s; }
  assert.equal(homeSpread(1), REST.spread);
});

test('функции не выделяют память — пишут в переданный out', () => {
  const out = v(0, 0, 0);
  assert.equal(shelterTop(OBST[0], out), out);
  assert.equal(shelterSide(OBST[3], 1.5, out), out);
  assert.equal(restAttractor(v(1, 2, 3), v(0, 0, 0), 0.5, out), out);
});

test('связка в main.js: вес отдыха, укрытия и подпись «стилизованное поведение»', () => {
  assert.match(MAIN, /SPDK = 1 - 0\.3 \* K\.night; RW = restWeight\(K\.night\);/);
  assert.match(MAIN, /if \(RW > 0\) restAttractor\(ATT, SHELTER\[k\], RW, ATT\);/);
  assert.match(MAIN, /hi = speedHi\(sp\.speed\[0\], sp\.speed\[1\], RW\) \* boost \* SPDK/);
  assert.match(MAIN, /if \(rocks && RW > 0 && rnd\(\) < RW\)/, 'днём rnd() не вызывается — раскладка и стаи как раньше');
  assert.match(MAIN, /inp\.setAttribute\('aria-describedby', 'behaviorNote'\); row\.after\(note\);/);
});

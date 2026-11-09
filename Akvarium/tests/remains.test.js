/**
 * A-04, шаг 3: остатки корма на песке. Параметры REMAINS — src/config/ecosystem.js, функции — src/sim/hunger.js,
 * связка — updateFood в main.js. Пока на дне не больше лимита, хлопья лежат прежние 16 с и тают последние 3 с;
 * сверх лимита самые старые растворяются быстрее. Без three и DOM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { REMAINS } from '../src/config/ecosystem.js';
import { remainsAge, remainsCut, remainsGone, remainsScale } from '../src/sim/hunger.js';
import { MAIN } from './_app.js';

// зеркало цикла updateFood: N хлопьев ложатся на песок равномерно за span секунд; число хлопьев в начале каждой секунды
function settle(N, span) {
  const dt = 1 / 60, ages = new Float32Array(160), g = new Array(N).fill(0), alive = new Array(N).fill(true), counts = [];
  let prev = 0;
  for (let step = 0; step < 60 * 25; step++) {
    const t = step * dt, cut = remainsCut(ages, prev);
    let gn = 0, n = 0;
    for (let i = 0; i < N; i++) {
      if (!alive[i]) continue;
      if (t >= (i / N) * span) {
        g[i] = remainsAge(g[i], dt, cut);
        if (remainsGone(g[i])) alive[i] = false; else ages[gn++] = g[i];
      }
      if (alive[i]) n++;
    }
    prev = gn;
    if (step % 60 === 0) counts.push(n);
  }
  return counts;
}

test('параметры остатков: прежние 16 с и 3 с таяния, лимит между одной порцией и пулом корма', () => {
  assert.equal(REMAINS.life, 16);
  assert.equal(REMAINS.fade, 3);
  assert.ok(REMAINS.cap > 16 && REMAINS.cap < 160, 'лимит больше одной порции (16) и меньше FOOD_N (160)');
  assert.ok(REMAINS.rush > 1);
  assert.ok(Object.isFrozen(REMAINS));
});

test('до лимита поведение прежнее: размер, исчезновение, без ускорения', () => {
  for (let g = 0; g <= 16; g += 0.25) {
    const old = g > 13 ? (16 - g) / 3 : 1;
    assert.ok(Math.abs(remainsScale(g) - old) < 1e-9, `ground = ${g}`);
  }
  assert.equal(remainsScale(20), 0);
  assert.equal(remainsGone(16), false);
  assert.equal(remainsGone(16.01), true);
  const ages = new Float32Array(160);
  for (let n = 0; n <= REMAINS.cap; n++) assert.equal(remainsCut(ages, n), Infinity);
  assert.equal(remainsAge(5, 0.5, Infinity), 5.5);
});

test('сверх лимита ускоряются ровно n - cap самых старых', () => {
  const n = REMAINS.cap + 7, ages = new Float32Array(160);
  for (let i = 0; i < n; i++) ages[i] = n - 1 - i;
  const cut = remainsCut(ages, n);
  let fast = 0;
  for (let a = 0; a < n; a++) if (a >= cut) fast++;
  assert.equal(fast, n - REMAINS.cap);
  assert.equal(remainsAge(cut, 1, cut), cut + REMAINS.rush);
  assert.equal(remainsAge(cut - 1, 1, cut), cut);
});

test('117 хлопьев на дне: к 9 с остаётся не больше лимита; малая порция живёт прежние 16 с', () => {
  const big = settle(117, 3), small = settle(30, 3);
  assert.equal(big[4], 117);
  assert.ok(big[9] <= REMAINS.cap + 1, `9 с: ${big[9]}`);
  assert.ok(big.every((c) => c <= 117));
  assert.equal(big[20], 0);
  assert.equal(small[15], 30);
  assert.equal(small[19], 0);
});

test('updateFood в main.js пользуется лимитом остатков вместо констант 16 и 13', () => {
  const a = MAIN.indexOf('function updateFood('), b = MAIN.indexOf('foodG.attributes.position.needsUpdate', a);
  assert.ok(a > 0 && b > a);
  const body = MAIN.slice(a, b);
  for (const s of ['remainsCut(groundAges, foodGround)', 'remainsAge(f.ground, dt, cut)', 'remainsGone(f.ground)', 'groundAges[gn++] = f.ground', 'remainsScale(f.ground)', 'foodGround = gn'])
    assert.ok(body.includes(s), s);
  assert.ok(!body.includes('f.ground > 16') && !body.includes('f.ground > 13'));
  assert.ok(MAIN.includes('const groundAges = new Float32Array(FOOD_N);'));
});

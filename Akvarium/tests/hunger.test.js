/**
 * A-04: модель голода и сытости (src/sim/hunger.js) — без three и DOM.
 * Инварианты: h конечен и в [0, 1]; сытая рыба не замечает корм; гистерезис без мерцания; при h = 1 условия корма
 * совпадают с прежними (радиусы 6 / 2,5 / 5, ускорения 1,35 / 1,4); шаг не зависит от разбиения dt;
 * старт детерминирован при одном seed; кормление имеет видимый конец.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUNGER, hungerInit, hungerCopy, hungerStep, hungerBite, foodInterest, foodReach, foodBoost } from '../src/sim/hunger.js';

// ГПСЧ Park–Miller (как у аквариума): один seed — одна последовательность
const rng = seed => { let s = seed; return () => (s = s * 16807 % 2147483647, (s - 1) / 2147483646); };
const fish = h => ({ h, sat: false });
const near = (a, b, eps = 1e-12) => Math.abs(a - b) <= eps;

test('старт детерминирован и лежит в HUNGER.start', () => {
  const a = rng(2024), b = rng(2024);
  for (let i = 0; i < 1000; i++) {
    const x = hungerInit({}, a), y = hungerInit({}, b);
    assert.equal(x.h, y.h);
    assert.ok(x.h >= HUNGER.start[0] && x.h <= HUNGER.start[1] && x.sat === false, `h = ${x.h}`);
  }
  assert.notEqual(hungerInit({}, rng(1)).h, hungerInit({}, rng(2)).h);
});

test('10 000 шагов с укусами: h конечен и в [0, 1], сытая рыба всегда ниже порога возврата', () => {
  const r = rng(7), school = Array.from({ length: 90 }, () => hungerInit({}, r));
  for (let k = 0; k < 10000; k++) {
    for (const f of school) {
      hungerStep(f, 1 / 30);
      if (r() < 0.02) hungerBite(f);
      assert.ok(Number.isFinite(f.h) && f.h >= 0 && f.h <= 1, `h = ${f.h}`);
      if (f.sat) assert.ok(f.h < HUNGER.resume, `сытая рыба с h = ${f.h}`);
      const k2 = foodInterest(f);
      assert.ok(k2 >= 0 && k2 <= 1);
    }
  }
});

test('укус снимает HUNGER.bite; ниже порога рыба сыта и корм не ищет', () => {
  const f = fish(0.3);
  hungerBite(f);
  assert.ok(near(f.h, 0.15), `h = ${f.h}`);
  assert.equal(f.sat, true);
  assert.equal(foodInterest(f), 0);
  assert.equal(foodReach(f, 6), 0);
  assert.equal(foodBoost(f, 1.35), 1);
  hungerBite(f); hungerBite(f);
  assert.equal(f.h, 0);
  const g = hungerBite(fish(0.5));   // 0,35 — ещё голодна
  assert.equal(g.sat, false);
  assert.ok(foodReach(g, 6) > 0 && foodBoost(g, 1.35) > 1);
});

test('гистерезис: интерес возвращается выше HUNGER.resume и без укуса больше не пропадает', () => {
  const dt = 1 / 30, f = hungerBite(fish(0.3));   // h = 0,15, сыта
  let flips = 0, prev = f.sat;
  for (let t = 0; t < 60; t += dt) { hungerStep(f, dt); if (f.sat !== prev) { flips++; prev = f.sat; } }
  assert.equal(flips, 1);
  assert.equal(f.sat, false);
  const g = hungerBite(fish(0.3));
  let tr = 0;
  while (g.sat) { hungerStep(g, dt); tr += dt; }
  const expected = (HUNGER.resume - 0.15) / HUNGER.rate;   // 24 с
  assert.ok(Math.abs(tr - expected) <= 2 * dt, `возврат через ${tr} с, ожидалось ${expected} с`);
});

test('при полном голоде условия корма совпадают с прежними; интерес монотонен по h', () => {
  const f = fish(1);
  assert.equal(foodInterest(f), 1);
  assert.ok(near(foodReach(f, 6), 6));        // стая: корм в пределах 6
  assert.ok(near(foodBoost(f, 1.35), 1.35));
  assert.ok(near(foodReach(f, 2.5), 2.5));    // рыба-клоун у анемона
  assert.ok(near(foodReach(f, 5), 5));        // одиночные рыбы
  assert.ok(near(foodBoost(f, 1.4), 1.4));
  let prevK = -1, prevR = -1, prevB = 0;
  for (let i = 0; i <= 80; i++) {
    const g = fish(Math.min(1, HUNGER.sated + i / 100)), k = foodInterest(g), r = foodReach(g, 6), b = foodBoost(g, 1.35);
    assert.ok(k >= prevK && k >= 0 && k <= 1, `k = ${k}`);
    assert.ok(r >= prevR && r >= 6 * HUNGER.reachMin - 1e-12 && r <= 6 + 1e-12, `r = ${r}`);
    assert.ok(b >= prevB && b >= 1 && b <= 1.35 + 1e-12, `b = ${b}`);
    prevK = k; prevR = r; prevB = b;
  }
});

test('шаг не зависит от разбиения dt; пауза и некорректный dt ничего не меняют', () => {
  const a = fish(0.4), b = fish(0.4);
  hungerStep(a, 1);
  for (let i = 0; i < 30; i++) hungerStep(b, 1 / 30);
  assert.ok(near(a.h, b.h), `${a.h} ≠ ${b.h}`);
  for (const dt of [0, -1, NaN, undefined]) { const f = fish(0.4); hungerStep(f, dt); assert.equal(f.h, 0.4); }
  const f = fish(0.99);
  hungerStep(f, 10);
  assert.equal(f.h, 1);
});

test('кормление имеет видимый конец: не больше пяти укусов — и вся стая сыта', () => {
  const r = rng(2024), school = Array.from({ length: 90 }, () => hungerInit({}, r));
  const need = Math.ceil((HUNGER.start[1] - HUNGER.sated) / HUNGER.bite);
  assert.equal(need, 5);
  for (let k = 0; k < need; k++) for (const f of school) if (!f.sat) hungerBite(f);
  assert.ok(school.every(f => f.sat && foodReach(f, 6) === 0 && foodBoost(f, 1.35) === 1));
  const n = hungerCopy({}, school[0]);   // новичок из setPopulation
  assert.deepEqual(n, { h: school[0].h, sat: true });
});

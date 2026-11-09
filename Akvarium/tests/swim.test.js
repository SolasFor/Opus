/**
 * A-03d: кинематика плавания (src/sim/swim.js) и её связка в main.js и в вершинном шейдере рыб (creatures.js).
 * Модуль без three и DOM, поэтому исполняется прямо в Node; шейдер сверяется по исходнику.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SWIM, SWIM0, swimBend, swimStep, tailHz } from '../src/sim/swim.js';
import { MAIN } from './_app.js';

const CRE = readFileSync(new URL('../src/creatures.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const TAU = Math.PI * 2;
// species: body length L, tail amp, speed [lo, hi], labriform cruiser (creatures.js)
const FISH = { chromis: [0.42, 0.09, [0.9, 2.0], true], anthias: [0.55, 0.1, [0.8, 1.8], false], clown: [0.62, 0.13, [0.3, 0.8], true],
  tang: [1.3, 0.08, [0.5, 1.2], true], ytang: [1.05, 0.08, [0.5, 1.1], true], idol: [0.95, 0.07, [0.45, 1.0], false] };
const run = (s, n, dt, ...a) => { for (let i = 0; i < n; i++) swimStep(s, dt, ...a); return s; };
// tail-beat frequency [Hz] over one step of the converged state
const hz = (s, dt, ...a) => { const t0 = s.tail; swimStep(s, dt, ...a); return ((s.tail - t0 + TAU) % TAU) / (TAU * dt); };

test('частота хвоста по числу Струхаля: St = f·A/U = 0,3 — внутри 0,2–0,4 (Taylor et al. 2003)', () => {
  assert.ok(SWIM.ST >= 0.2 && SWIM.ST <= 0.4);
  for (const [L, amp, [lo, hi]] of Object.values(FISH)) for (let u = lo; u <= hi + 1e-9; u += 0.05) {
    const A = SWIM.APP * amp * L;
    assert.ok(Math.abs(tailHz(u, L, amp) * A / u - SWIM.ST) < 1e-12);
  }
  assert.equal(tailHz(0, 1, 0.1), 0);
  assert.equal(tailHz(1, 0, 0.1), 0);
});

test('BCF (антиас, идол): хвост чаще с скоростью, в пределах TAIL_MIN…TAIL_MAX, тело целиком в волне', () => {
  for (const k of ['anthias', 'idol']) {
    const [L, amp, [lo, hi]] = FISH[k];
    let prev = 0;
    for (let u = 0; u <= hi * 1.5; u += 0.05) {
      const s = run(SWIM0(0, false), 30, 1 / 60, u, hi, L, amp, 0, false, 1), f = hz(s, 1 / 60, u, hi, L, amp, 0, false, 1);
      assert.ok(f >= prev - 1e-9, `${k}: частота не падает с ростом скорости (u = ${u.toFixed(2)})`);
      assert.ok(f >= SWIM.TAIL_MIN - 1e-9 && f <= SWIM.TAIL_MAX + 1e-9);
      assert.equal(s.w, 1); assert.equal(s.finA, 1);
      prev = f;
    }
  }
  const [L, amp] = FISH.idol, u = 0.7, s = run(SWIM0(), 30, 1 / 60, u, 1, L, amp, 0, false, 1);
  assert.ok(Math.abs(hz(s, 1 / 60, u, 1, L, amp, 0, false, 1) * SWIM.APP * amp * L / u - SWIM.ST) < 1e-9, 'без ограничения — ровно St');
});

test('лабриформные: крейсер на грудных плавниках, бросок и испуг — телом и хвостом', () => {
  for (const k of ['chromis', 'clown', 'tang', 'ytang']) {
    const [L, amp, [, hi]] = FISH[k];
    const cruise = run(SWIM0(0, true), 600, 1 / 60, 0.4 * hi, hi, L, amp, 0, true, 1);
    assert.ok(Math.abs(cruise.w - SWIM.CRUISE_W) < 1e-6, `${k}: при 0,4 vmax тело почти прямое`);
    assert.ok(Math.abs(cruise.finA - SWIM.FIN_A) < 1e-5, `${k}: грудные плавники работают в полный размах`);
    const f0 = cruise.fin; swimStep(cruise, 1 / 60, 0.4 * hi, hi, L, amp, 0, true, 1);
    const fin = ((cruise.fin - f0 + TAU) % TAU) / (TAU / 60);
    assert.ok(fin >= SWIM.FIN_MIN && fin <= SWIM.FIN_MAX, `${k}: частота грудных ${fin.toFixed(2)} Гц`);
    const burst = run(SWIM0(0, true), 600, 1 / 60, hi, hi, L, amp, 0, true, 1);
    assert.ok(burst.w > 0.99 && burst.finA < 0.35, `${k}: у vmax — волна тела, плавники прижаты`);
    const scared = run(SWIM0(0, true), 600, 1 / 60, 0.4 * hi, hi, L, amp, 0.8, true, 1);
    assert.ok(scared.w > 0.99, `${k}: испуг включает хвост`);
  }
});

test('C-старт: запуск резким испугом, изгиб в сторону поворота, затухание и пауза между стартами', () => {
  const [L, amp, [, hi]] = FISH.chromis, dt = 1 / 120;
  const s = run(SWIM0(0, true), 120, dt, 1, hi, L, amp, 0, true, 1);
  swimStep(s, dt, 1, hi, L, amp, 0.2, true, -1);
  assert.equal(s.ct, -1, 'малый рост испуга — без C-старта');
  swimStep(s, dt, 1, hi, L, amp, 0.9, true, -1);
  assert.equal(s.ct, 0); assert.equal(s.side, -1);
  let peak = 0, steps = 0;
  while (s.ct >= 0) {
    swimStep(s, dt, 1, hi, L, amp, 0.9, true, 1); steps++;
    if (s.ct >= 0 && s.ct / SWIM.C_T < 0.45) assert.ok(s.bend <= 0, 'стадия 1 — в сторону side, запомненную при запуске');
    peak = Math.max(peak, Math.abs(s.bend));
  }
  assert.ok(peak > 0.9 && peak < 1.05, `пик изгиба ${peak.toFixed(3)}`);
  assert.ok(Math.abs(steps * dt - SWIM.C_T) <= dt + 1e-9, 'длится C_T');
  assert.equal(s.bend, 0);
  run(s, 2, dt, 1, hi, L, amp, 0, true, 1); swimStep(s, dt, 1, hi, L, amp, 0.9, true, 1);
  assert.equal(s.ct, -1, 'повтор внутри C_REF — нет');
  run(s, Math.ceil(SWIM.C_REF / dt) + 2, dt, 1, hi, L, amp, 0, true, 1); swimStep(s, dt, 1, hi, L, amp, 0.9, true, 1);
  assert.equal(s.ct, 0, 'после C_REF — снова можно');
  assert.equal(swimBend(0), 0); assert.equal(swimBend(1), 0); assert.ok(swimBend(0.25) > 0 && swimBend(0.75) < 0);
});

test('пауза (dt = 0) ничего не меняет; фазы остаются в [0, 2π)', () => {
  const [L, amp, [, hi]] = FISH.clown, s = run(SWIM0(123.4, true), 50, 1 / 60, 0.5, hi, L, amp, 0.3, true, 1), ref = { ...s };
  for (const dt of [0, -1, NaN, undefined]) { assert.equal(swimStep(s, dt, 2, hi, L, amp, 1, true, -1), s); assert.deepEqual(s, ref); }
  const f = run(SWIM0(5, false), 100000, 1 / 30, 3, 1, 0.55, 0.1, 1, false, 1);
  for (const k of ['tail', 'fin']) assert.ok(f[k] >= 0 && f[k] < TAU, k);
  const z = SWIM0(7, true);
  assert.ok(z.tail >= 0 && z.tail < TAU && Math.abs(z.tail - (7 % TAU)) < 1e-12, 'старт с текущей фазы — без скачка');
});

test('связка: шейдер рыб читает aSwim, main.js считает его в swimStep и отдаёт на GPU', () => {
  assert.ok(CRE.includes('attribute vec4 aSwim;'));
  for (const k of ['aSwim.x', 'aSwim.y', 'aSwim.z', 'aSwim.w']) assert.ok(CRE.includes(k), k);
  assert.ok(CRE.includes("g.setAttribute('aSwim', sw);") && CRE.includes('{ mesh, fish, ph, sw, count: def.n }'));
  assert.ok(!CRE.includes('sin(aPhase * 0.7 + 1.0)'), 'грудные плавники больше не привязаны к фазе хвоста');
  const pect = { 'Chromis viridis': true, 'Pseudanthias squamipinnis': false, 'Amphiprion ocellaris': true, 'Paracanthurus hepatus': true, 'Zebrasoma flavescens': true, 'Zanclus cornutus': false };
  for (const [latin, p] of Object.entries(pect)) {
    const line = CRE.split('\n').find(l => l.includes(`latin: '${latin}'`));
    assert.ok(line, latin); assert.equal(line.includes('pect: true'), p, latin);
  }
  assert.ok(MAIN.includes("import { SWIM0, swimStep } from './sim/swim.js';"));
  assert.ok(MAIN.includes('swimStep(swS, dt, '));
  assert.ok(MAIN.includes('sp.sw.needsUpdate = true;'));
  assert.ok(!MAIN.includes('sp.freq * (0.45 + 0.9 * spd + f.st)'), 'старая формула фазы убрана');
});

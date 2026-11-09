/**
 * A-05b (Р-A15): бюджет кадра iGPU — неудачная проба повышения снимается за одно окно, старт — в 2,6 Мп.
 * Модель — замер 9 ноября 2026 г. (Intel UHD 0x46A3, 1440×900, DPR 1.75, vsync): на 1.5 и выше 57 fps и 7 % долгих
 * кадров (JS кадра 1–7 мс — упор в GPU), на 1.25 — 60 fps и 1,5 %.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ADAPT, ADAPT0, adaptStep } from '../src/adapt.js';
import { startPR } from '../src/perf/quality.js';

function run(fpsOf, jankOf, windows, pr, maxPR = 1.75) {
  let s = { ...ADAPT0, pr };
  const hist = [];
  for (let i = 0; i < windows; i++) { s = adaptStep(s, fpsOf(s.pr), maxPR, jankOf(s.pr)); hist.push(s.pr); }
  return { s, hist };
}
const fps = pr => (pr >= 1.5 ? 57 : 60), jank = pr => (pr >= 1.5 ? 0.07 : 0.015);

test('Р-A15: проба с долгими кадрами снимается первым же окном, ожидание удваивается', () => {
  const { s, hist } = run(fps, jank, 9, 1.25);
  assert.deepEqual(hist, [1.25, 1.25, 1.5, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25]);
  assert.equal(s.hold, ADAPT.HOLD * 2);
});

test('Р-A15: без долгих кадров проба по-прежнему снимается по fps за SLOW окон', () => {
  assert.deepEqual(run(pr => (pr >= 1.5 ? 50 : 60), () => 0, 5, 1.25).hist, [1.25, 1.25, 1.5, 1.5, 1.25]);
  // вне пробы долгие кадры по-прежнему нужны два окна подряд (Р-A14)
  assert.deepEqual(run(() => 57, () => 0.08, 4, 1.75).hist, [1.75, 1.5, 1.5, 1.25]);
});

test('Р-A15: модель iGPU — старт 1.25, за 10 минут на 1.5 меньше 5 % окон и никогда два окна подряд', () => {
  const pr0 = startPR(1.75, 1440, 900, false);
  assert.equal(pr0, 1.25);
  const { hist } = run(fps, jank, 300, pr0);
  const hi = hist.filter(p => p >= 1.5).length / hist.length;
  assert.ok(hi < 0.05, String(hi));
  assert.ok(hist.every((p, i) => p < 1.5 || !i || hist[i - 1] < 1.5));
  assert.ok(hist.every(p => p >= 1.25 && p <= 1.5));
});

test('Р-A15: на ровных кадрах (мощный GPU) старт 1.25 поднимается до MAXPR 1.75 за 2 × HOLD окон', () => {
  const { hist } = run(() => 60, () => 0, 8, startPR(1.75, 1440, 900, false));
  assert.deepEqual(hist, [1.25, 1.25, 1.5, 1.5, 1.5, 1.75, 1.75, 1.75]);
});

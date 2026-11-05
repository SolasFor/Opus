/**
 * M-05b, П-4: свободная область кадра (src/ui/free-area.js):
 *   1) область — между верхней панелью, видимыми боковыми панелями и лентой, с отступом; если панели оставляют меньше
 *      40 % ширины (высоты), по этой оси область — всё окно;
 *   2) сдвиг setViewOffset ставит точку прицела в центр области;
 *   3) для области во всё окно расстояние совпадает с прежней формулой distFor(), NDC не меняются, стартовый кадр —
 *      прежний CAM_HOME (в альбомном окне); меньшая область отодвигает камеру, сфера вписывается в область.
 * M-05c: focusDistance() — «Приблизить» на телефоне (режим шторки) отодвигает камеру не меньше, чем стартовый кадр
 *      (homeScale), и так, что сфера детали вписывается в область; на десктопе и планшете расстояние прежнее.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_FREE, freeRect, viewShift, fitDistance, toFreeNdc, homeScale, focusDistance } from '../src/ui/free-area.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
const DEG = Math.PI / 180;
// прежняя формула distFor() из ui/camera.js (M-02c): s.radius / sin(min(fov, fovH) / 2) * pad * 0.92
const oldDist = (radius, fovDeg, aspect, pad = 1.18) => {
  const fov = fovDeg * DEG, fovH = 2 * Math.atan(Math.tan(fov / 2) * aspect);
  return radius / Math.sin(Math.min(fov, fovH) / 2) * pad * 0.92;
};

test('область: панели, отступы, правило 40 %', () => {
  // десктоп 1440×900: верхняя панель до 56, левая до 312, правая с 1088, лента с 763, отступ 12
  assert.deepEqual(freeRect(1440, 900, { top: 56, left: 312, right: 1088, bottom: 763, gap: 12 }), { l: 324, t: 68, r: 1076, b: 751 });
  assert.deepEqual(freeRect(1440, 900, { top: 56, gap: 12 }), { l: 0, t: 68, r: 1440, b: 900 });
  assert.deepEqual(freeRect(800, 600), { l: 0, t: 0, r: 800, b: 600 });
  // шторка оставляет меньше 40 % ширины — по горизонтали не сдвигаем
  assert.deepEqual(freeRect(600, 800, { top: 56, right: 240, gap: 12 }), { l: 0, t: 68, r: 600, b: 800 });
  assert.ok(MIN_FREE === 0.4);
  // лента и панель сверху оставляют меньше 40 % высоты — по вертикали не сдвигаем
  assert.deepEqual(freeRect(800, 400, { top: 56, bottom: 200, gap: 12 }), { l: 0, t: 56, r: 800, b: 400 });
});

test('сдвиг: точка прицела в центре области', () => {
  const W = 1440, H = 900, f = { l: 324, t: 68, r: 1076, b: 751 }, s = viewShift(W, H, f);
  assert.deepEqual(s, { x: 720 - 700, y: 450 - 409.5 });
  // setViewOffset(W, H, x, y, W, H): центр виртуального кадра (W/2, H/2) виден в точке (W/2 − x, H/2 − y)
  assert.equal(W / 2 - s.x, (f.l + f.r) / 2); assert.equal(H / 2 - s.y, (f.t + f.b) / 2);
  assert.deepEqual(viewShift(W, H, { l: 0, t: 0, r: W, b: H }), { x: 0, y: 0 });
});

test('область во всё окно: прежнее расстояние, прежние NDC, прежний стартовый кадр', () => {
  for (const [W, H] of [[1440, 900], [1024, 768], [390, 844], [844, 390], [1920, 1080]]) {
    const full = { l: 0, t: 0, r: W, b: H };
    for (const r of [1, 3.7]) for (const pad of [1.18, 1.35]) assert.ok(near(fitDistance(r, 40, W, H, full, pad), oldDist(r, 40, W / H, pad), 1e-12), `${W}×${H}`);
    for (const [x, y] of [[-1, -1], [0.3, -0.7], [1, 1]]) { const [a, b] = toFreeNdc(x, y, W, H, full); assert.ok(near(a, x, 1e-12) && near(b, y, 1e-12)); }
    if (W >= H) assert.ok(near(homeScale(40, W, H, full), 1, 1e-12));
    else assert.ok(near(homeScale(40, W, H, full), H / W, 1e-12), 'узкое окно: камера дальше, двигатель помещается по ширине');
  }
});

test('меньшая область: камера дальше, сфера вписывается в область, края области — ±1 в её NDC', () => {
  const W = 1440, H = 900, f = { l: 324, t: 68, r: 1076, b: 751 }, full = { l: 0, t: 0, r: W, b: H };
  const d = fitDistance(2, 40, W, H, f), d0 = fitDistance(2, 40, W, H, full);
  assert.ok(d > d0);
  // половина угла обзора, которая приходится на область (по меньшей стороне), видит сферу с запасом pad * 0.92
  const t = Math.tan(20 * DEG), half = Math.atan(Math.min(t * (f.b - f.t) / H, t * (f.r - f.l) / H));
  assert.ok(near(Math.sin(half) * d, 2 * 1.18 * 0.92, 1e-12));
  const toNdc = (px, py) => [px / W * 2 - 1, 1 - py / H * 2];
  assert.deepEqual(toFreeNdc(...toNdc(f.l, f.t), W, H, f).map(v => Math.round(v * 1e9) / 1e9), [-1, 1]);
  assert.deepEqual(toFreeNdc(...toNdc(f.r, f.b), W, H, f).map(v => Math.round(v * 1e9) / 1e9), [1, -1]);
  assert.ok(near(homeScale(40, W, H, f), H / (f.b - f.t), 1e-12));
});

test('M-05c: «Приблизить» на телефоне — дальше, чем во всё окно, сфера детали в области; на десктопе и планшете — прежнее расстояние', () => {
  const d0 = r => Math.max(r * 2.3, 2.6);
  const cases = [[1440, 900, { l: 324, t: 68, r: 1076, b: 751 }], [1024, 768, { l: 340, t: 68, r: 1024, b: 640 }]];
  for (const [W, H, f] of cases) for (const r of [0.2, 1, 1.5, 3]) assert.equal(focusDistance(r, 40, W, H, f, false), d0(r));
  const phone = [[390, 844, { l: 0, t: 60, r: 390, b: 456 }], [360, 800, { l: 0, t: 60, r: 360, b: 668 }], [844, 390, { l: 0, t: 64, r: 490, b: 390 }]];
  for (const [W, H, f] of phone) for (const r of [0.2, 1, 1.5, 3]) {
    const d = focusDistance(r, 40, W, H, f, true), k = homeScale(40, W, H, f);
    assert.ok(k > 1, `${W}×${H}: узкая область — дальше`);
    assert.ok(d >= d0(r) * k - 1e-12, `${W}×${H}, r=${r}: не ближе стартового масштаба`);
    // угловой радиус сферы не больше половины угла области по меньшей стороне
    const t = Math.tan(20 * DEG), m = Math.min(t * (f.b - f.t) / H, t * (f.r - f.l) / H);
    assert.ok(Math.asin(r / d) <= Math.atan(m) + 1e-12, `${W}×${H}, r=${r}: сфера в области`);
    assert.ok(near(d, Math.max(d0(r) * k, fitDistance(r, 40, W, H, f)), 1e-12));
  }
  // длинная деталь в квадратной области 390×396 над шторкой: вписывание сферы дальше стартового масштаба
  const [W, H, f] = phone[0];
  assert.ok(focusDistance(1.5, 40, W, H, f, true) > d0(1.5) * homeScale(40, W, H, f));
});

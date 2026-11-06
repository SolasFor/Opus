/**
 * Жесты на сцене (A-02, src/ui/gestures.js): клик и касание — корм через dblMs, двойное — следить, удержание —
 * сыпать, перетаскивание и второй палец отменяют корм. Пороги мыши — прежние (6 px, 260 мс, 14 px, 380 мс, 600 мс),
 * у пальца — 10 px, 300 мс, 30 px. Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLD_MS, KIND, TAP_MS, createGestures } from '../src/ui/gestures.js';

const tap = (g, id, x, y, t, type = 'mouse', dt = 80) => { g.down(id, x, y, t, type); return g.up(id, x, y, t + dt); };

test('пороги мыши — прежние, у пальца — шире', () => {
  assert.deepEqual(KIND.mouse, { movePx: 6, dblMs: 260, dblPx: 14, pickPx: 0 });
  assert.deepEqual(KIND.touch, { movePx: 10, dblMs: 300, dblPx: 30, pickPx: 16 }, 'pickPx — допуск выбора рыбы пальцем');
  assert.equal(HOLD_MS, 380); assert.equal(TAP_MS, 600);
});

test('клик и касание — корм через dblMs; второе рядом и вовремя — двойное', () => {
  const g = createGestures();
  assert.deepEqual(tap(g, 1, 100, 100, 0), { type: 'tap', wait: 260 });
  assert.deepEqual(tap(g, 1, 108, 104, 200), { type: 'double' });
  assert.deepEqual(tap(g, 1, 108, 104, 400), { type: 'tap', wait: 260 }, 'после двойного — снова одиночное');
  const t = createGestures();
  assert.deepEqual(tap(t, 5, 50, 50, 0, 'touch'), { type: 'tap', wait: 300 });
  assert.deepEqual(tap(t, 6, 74, 60, 200, 'touch'), { type: 'double' }, 'палец: 26 px — ещё двойное');
});

test('второе далеко, поздно или другим указателем — не двойное', () => {
  const g = createGestures();
  tap(g, 1, 100, 100, 0);
  assert.equal(tap(g, 1, 120, 100, 150).type, 'tap', 'мышь: 20 px — далеко');
  assert.equal(tap(g, 1, 120, 100, 150 + 80 + 270).type, 'tap', 'мышь: позже 260 мс');
  const t = createGestures();
  tap(t, 1, 50, 50, 0, 'touch');
  assert.equal(tap(t, 2, 50, 50, 301, 'touch').type, 'tap', 'палец: позже 300 мс после отпускания');
  const m = createGestures();
  tap(m, 1, 50, 50, 0, 'mouse');
  assert.equal(tap(m, 2, 50, 50, 100, 'touch').type, 'tap', 'мышь, потом палец — не двойное');
});

test('сдвиг — вращение камеры, а не корм; у пальца порог выше', () => {
  const g = createGestures();
  g.down(1, 0, 0, 0, 'mouse'); g.move(1, 7, 0);
  assert.equal(g.up(1, 7, 0, 100).type, 'none');
  const t = createGestures();
  t.down(1, 0, 0, 0, 'touch'); t.move(1, 8, 4);
  assert.equal(t.up(1, 8, 4, 100).type, 'tap', 'палец дрожит на 9 px — всё ещё касание');
  t.down(2, 0, 0, 1000, 'touch'); t.move(2, 11, 0);
  assert.equal(t.up(2, 11, 0, 1100).type, 'none');
});

test('удержание без сдвига — сыпать; начинается один раз, после него отпускание ничего не кормит', () => {
  const g = createGestures();
  tap(g, 1, 10, 10, 0, 'touch');                           // ждёт второго касания
  g.down(2, 10, 10, 200, 'touch');
  assert.equal(g.hold(200 + HOLD_MS), false, 'ровно HOLD_MS — ещё нет');
  assert.equal(g.hold(200 + HOLD_MS + 1), true);
  assert.equal(g.hold(700), false, 'второй раз — нет'); assert.equal(g.holding(), true);
  g.move(2, 30, 10); assert.equal(g.holding(), false, 'сдвиг останавливает');
  assert.equal(g.up(2, 30, 10, 900).type, 'none');
  assert.equal(tap(g, 3, 10, 10, 950, 'touch').type, 'tap', 'удержание сбросило ожидание двойного');
});

test('долгое нажатие без удержания (кадры не шли) — не корм', () => {
  const g = createGestures();
  g.down(1, 0, 0, 0, 'mouse');
  assert.equal(g.up(1, 0, 0, TAP_MS + 1).type, 'none');
});

test('второй палец — только масштаб: ни корма, ни удержания, ни двойного', () => {
  const g = createGestures();
  g.down(1, 100, 100, 0, 'touch'); g.down(2, 200, 200, 30, 'touch');
  assert.equal(g.active(), true);
  assert.equal(g.hold(1000), false); assert.equal(g.holding(), false);
  assert.equal(g.up(2, 200, 200, 120).type, 'none');
  assert.equal(g.up(1, 100, 100, 140).type, 'none');
  assert.equal(g.active(), false);
  assert.equal(tap(g, 3, 100, 100, 200, 'touch').type, 'tap', 'после щипка касание снова кормит');
});

test('pointercancel сбрасывает нажатие', () => {
  const g = createGestures();
  g.down(1, 0, 0, 0, 'touch'); g.cancel(1);
  assert.equal(g.active(), false); assert.equal(g.hold(1000), false);
  assert.equal(g.up(1, 0, 0, 50).type, 'none');
});

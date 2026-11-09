/**
 * Шторка панели на телефоне (A-02, src/ui/sheet.js, по образцу Engine M-05c): три высоты, выбор после перетаскивания,
 * порядок по ручке и стрелкам. Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLING_MS, FLING_V, PHONE, SHEET, SHEET_FULL, SHEET_HALF, SHEET_MIN, STOPS, TAP_PX, nextStop, snapStop, stopHeight,
} from '../src/ui/sheet.js';

test('шторка — уже 760 px; в свёрнутом виде видны ручка и ряд кнопок', () => {
  assert.equal(PHONE, '(max-width: 759px)');
  assert.equal(SHEET_MIN, 96);                          // ручка 40 + кнопки 44 + отступ 10, с запасом
  assert.deepEqual(STOPS, ['min', 'half', 'full']);
  assert.deepEqual(SHEET, { on: false, stop: 'min', h: 0 });
  assert.deepEqual([SHEET_HALF, SHEET_FULL], [0.5, 0.85]);
  assert.deepEqual([FLING_MS, FLING_V, TAP_PX], [150, 0.4, 8], 'взмах — скорость за последние 150 мс; ручка — касание до 8 px');
});

test('высоты: свёрнутая + безопасная зона, половина и 85 % окна; на низком окне не меньше свёрнутой', () => {
  assert.deepEqual(STOPS.map(s => stopHeight(s, 844)), [96, 422, 717]);
  assert.deepEqual(STOPS.map(s => stopHeight(s, 844, 34)), [130, 422, 717]);
  assert.deepEqual(STOPS.map(s => stopHeight(s, 160)), [96, 96, 136]);
  assert.deepEqual(STOPS.map(s => stopHeight(s, 100)), [96, 96, 96]);
});

test('после перетаскивания — ближайшая высота, при взмахе — следующая в его сторону', () => {
  assert.equal(snapStop(200, 0, 844), 'min');
  assert.equal(snapStop(300, 0, 844), 'half');
  assert.equal(snapStop(600, 0, 844), 'full');
  assert.equal(snapStop(120, FLING_V + 0.1, 844), 'half', 'вверх от свёрнутой');
  assert.equal(snapStop(430, FLING_V + 0.1, 844), 'full');
  assert.equal(snapStop(717, FLING_V + 0.1, 844), 'full', 'выше некуда');
  assert.equal(snapStop(700, -FLING_V - 0.1, 844), 'half', 'вниз от почти полной');
  assert.equal(snapStop(400, -FLING_V - 0.1, 844), 'min');
  assert.equal(snapStop(96, -FLING_V - 0.1, 844), 'min');
  assert.equal(snapStop(300, FLING_V, 844), 'half', 'скорость ровно FLING_V — не взмах');
});

test('ручка: по кругу; стрелки — выше и ниже без перехода через край', () => {
  assert.deepEqual(STOPS.map(s => nextStop(s)), ['half', 'full', 'min']);
  assert.deepEqual(STOPS.map(s => nextStop(s, 1)), ['half', 'full', 'full']);
  assert.deepEqual(STOPS.map(s => nextStop(s, -1)), ['min', 'min', 'half']);
});

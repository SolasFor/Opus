/**
 * A-05: решения качества кадра (src/perf/quality.js) — без three и DOM.
 * MSAA выключен на плотных экранах и на больших кадрах, ?aa=1 / ?aa=0 — принудительно; стартовое разрешение не выше
 * MAXPR, на сетке adaptStep, кадр в бюджете пикселей (кроме нижней границы MIN); связка в core.js и main.js.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { msaaFor, QUALITY, startPR } from '../src/perf/quality.js';
import { ADAPT } from '../src/adapt.js';
import { MODULES } from './_app.js';

test('QUALITY: сетка как у adaptStep, бюджеты положительны, объект заморожен', () => {
  assert.equal(QUALITY.STEP, ADAPT.STEP);
  assert.equal(QUALITY.MIN, ADAPT.MIN);
  assert.ok(QUALITY.AA_PIX > 0 && QUALITY.PIX >= QUALITY.AA_PIX);
  assert.ok(Object.isFrozen(QUALITY));
});

test('msaaFor: обычный экран — с MSAA, плотный или большой кадр — без', () => {
  assert.equal(msaaFor(1, 1920, 1080, ''), true);       // 2,07 Мп
  assert.equal(msaaFor(1.25, 1536, 864, ''), true);     // ноутбук FHD при 125 %
  assert.equal(msaaFor(1, 2560, 1440, ''), false);      // 3,7 Мп
  assert.equal(msaaFor(1.5, 1280, 720, ''), false);     // FHD при 150 %
  assert.equal(msaaFor(1.75, 1440, 900, ''), false);    // окно замера A-05
  assert.equal(msaaFor(3, 390, 844, ''), false);        // телефон
  assert.equal(msaaFor(undefined, 1280, 720, ''), true);
  assert.equal(msaaFor(NaN, 1280, 720, ''), true);
});

test('msaaFor: ?aa=1 и ?aa=0 переопределяют выбор, прочие значения — нет', () => {
  assert.equal(msaaFor(1.75, 1440, 900, '?aa=1'), true);
  assert.equal(msaaFor(1, 1920, 1080, '?noadapt&aa=0'), false);
  assert.equal(msaaFor(1.75, 1440, 900, '?aa=2'), false);
  assert.equal(msaaFor(1, 1920, 1080, '?aa=yes'), true);
  assert.equal(msaaFor(1, 1920, 1080, undefined), true);
});

test('startPR: типичные окна', () => {
  assert.equal(startPR(1.75, 1440, 900, false), 1.75);   // 3,97 Мп — как до A-05
  assert.equal(startPR(1, 1920, 1080, true), 1);
  assert.equal(startPR(1.1, 1920, 1080, true), 1);       // 2,5 Мп с MSAA — ступень 1
  assert.equal(startPR(1.5, 2560, 1440, false), 1);      // 4K при 150 %: 8,3 → 3,7 Мп
  assert.equal(startPR(1, 3840, 2160, false), 0.75);     // 8,3 Мп: не ниже MIN
  assert.equal(startPR(1.75, 390, 844, false), 1.75);    // телефон
});

test('startPR: не выше MAXPR и не ниже MIN, на сетке или равно MAXPR, кадр в бюджете', () => {
  for (const maxPR of [0.75, 1, 1.1, 1.25, 1.5, 1.75]) for (const w of [320, 390, 800, 1280, 1440, 1920, 2560, 3840])
    for (const h of [480, 720, 844, 900, 1080, 1440, 2160]) for (const msaa of [false, true]) {
      const pr = startPR(maxPR, w, h, msaa), at = `${maxPR} ${w}×${h} msaa=${msaa}`;
      assert.ok(pr <= maxPR && pr >= Math.min(maxPR, QUALITY.MIN), at);
      assert.ok(pr === maxPR || Number.isInteger(pr / QUALITY.STEP), at);
      if (pr > QUALITY.MIN) assert.ok(w * h * pr * pr <= (msaa ? QUALITY.AA_PIX : QUALITY.PIX), at);
    }
});

test('связка: core.js создаёт renderer с antialias: MSAA, main.js применяет startPR без ?noadapt и отдаёт счётчики', () => {
  assert.ok(MODULES.core.includes('const MSAA = msaaFor(window.devicePixelRatio || 1, innerWidth, innerHeight, location.search);'));
  assert.ok(MODULES.core.includes('antialias: MSAA,') && !MODULES.core.includes('antialias: true'));
  assert.ok(MODULES.main.includes('if (!NOADAPT) { const pr0 = startPR(MAXPR, innerWidth, innerHeight, MSAA);'));
  assert.ok(MODULES.main.includes('msaa: MSAA, programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries'));
});

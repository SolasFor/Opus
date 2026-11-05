/**
 * Тестовые хуки и API аквариума (A-01): набор ключей window.__aqAPI и поля window.__aq — как на main@4b8d33a
 * (их используют проверки в браузере); setPopulation из API двигает слайдер «Рыбы» и не выходит за его диапазон (T-11).
 * Статические проверки текста Akvarium/Aquarium.html, без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../Aquarium.html', import.meta.url), 'utf8');
const API = HTML.match(/window\.__aqAPI = \{([^\n]*)\};\n/)[1];

test('ключи window.__aqAPI — прежние, в прежнем порядке', () => {
  const keys = API.trim().replace(/\([^)]*\) \{[^}]*\}/g, '').split(', ').map(k => k.replace(/^get /, '').replace(/:.*$/, ''));
  assert.deepEqual(keys, ['skipIntro', 'introT', 'K', 'setPreset', 'setToggle', 'setPopulation', 'dropFood', 'feedAt', 'knockAt',
    'pickAt', 'startFollow', 'stopFollow', 'screenshot', 'togglePause', 'togglePanel', 'SPECIES', 'camera', 'controls', 'fol', 'foodAlive']);
});

test('глобальные хуки запуска: __ok, __aqFail, __aqScreen, __aqEsc, __aqModuleError, __aq', () => {
  for (const name of ['__aqFail', '__aqScreen', '__aqEsc', '__aqModuleError']) assert.match(HTML, new RegExp(`window\\.${name} = function`));
  assert.match(HTML, /window\.__ok = 1;/);
  assert.match(HTML, /window\.__aq = \{ ft, pixelRatio, calls, |window\.__aq = \{ ft, pixelRatio, calls: /);
});

test('T-11: setPopulation из API — с ограничением диапазона и синхронизацией слайдеров', () => {
  assert.match(API, /setPopulation: apiSetPopulation,/);
  assert.match(HTML, /function apiSetPopulation\(p\) \{ setPopulation\(clamp\(\+p \|\| 0, 0\.05, 1\)\); syncSliders\(\); \}/);
  // диапазон — как у слайдера «Рыбы»
  assert.match(HTML, /\['pop', 'Рыбы', 0\.05, 1, 0\.01\]/);
  // syncSliders больше не пропускает «Рыбы»
  const sync = HTML.match(/function syncSliders\(\) \{[^\n]*\n/)[0];
  assert.doesNotMatch(sync, /pop/);
  assert.match(sync, /SL\[k\]\.inp\.value = K\[k\]; SL\[k\]\.out\.textContent = fmt\[k\]\(K\[k\]\);/);
});
